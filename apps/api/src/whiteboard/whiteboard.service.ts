import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomBytes } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import type { WhiteboardRole } from "../generated/prisma/client";

/** Caller's effective role on a board: owner is implicitly above EDITOR. */
export type EffectiveRole = "OWNER" | WhiteboardRole;

const userSelect = { id: true, email: true, name: true } as const;

@Injectable()
export class WhiteboardService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: { title?: string; nodeId?: string }) {
    return this.prisma.whiteboard.create({
      data: {
        title: dto.title?.trim() || "Новая доска",
        ownerId: userId,
        nodeId: dto.nodeId ?? null,
      },
    });
  }

  /** Boards the user owns or is a member of, newest first, with the caller's role. */
  async list(userId: string) {
    const boards = await this.prisma.whiteboard.findMany({
      where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
      orderBy: { updatedAt: "desc" },
      include: {
        members: { where: { userId }, select: { role: true } },
        _count: { select: { members: true } },
      },
    });
    return boards.map(({ members, _count, ...board }) => ({
      ...board,
      memberCount: _count.members,
      role: (board.ownerId === userId ? "OWNER" : (members[0]?.role ?? "VIEWER")) as EffectiveRole,
    }));
  }

  /**
   * Resolves the caller's effective role on a board, or throws.
   * Reused by the Phase 2 Hocuspocus `onAuthenticate` to gate room access.
   */
  async getAccess(userId: string, boardId: string): Promise<{ ownerId: string; role: EffectiveRole }> {
    const board = await this.prisma.whiteboard.findUnique({
      where: { id: boardId },
      select: { ownerId: true, members: { where: { userId }, select: { role: true } } },
    });
    if (!board) throw new NotFoundException("Доска не найдена");
    if (board.ownerId === userId) return { ownerId: board.ownerId, role: "OWNER" };
    if (board.members.length) return { ownerId: board.ownerId, role: board.members[0].role };
    throw new ForbiddenException("Нет доступа к этой доске");
  }

  async get(userId: string, boardId: string) {
    const { role } = await this.getAccess(userId, boardId);
    const board = await this.prisma.whiteboard.findUnique({
      where: { id: boardId },
      include: {
        owner: { select: userSelect },
        members: { include: { user: { select: userSelect } }, orderBy: { createdAt: "asc" } },
      },
    });
    if (!board) throw new NotFoundException("Доска не найдена");
    // Share-link secrets are owner-only.
    if (role !== "OWNER") {
      const { shareToken: _t, shareRole: _r, ...rest } = board;
      return { ...rest, role };
    }
    return { ...board, role };
  }

  async rename(userId: string, boardId: string, title: string) {
    const { role } = await this.getAccess(userId, boardId);
    if (role === "VIEWER") throw new ForbiddenException("Недостаточно прав для переименования");
    return this.prisma.whiteboard.update({
      where: { id: boardId },
      data: { title: title.trim() || "Новая доска" },
    });
  }

  async remove(userId: string, boardId: string) {
    const { role } = await this.getAccess(userId, boardId);
    if (role !== "OWNER") throw new ForbiddenException("Удалить доску может только владелец");
    await this.prisma.whiteboard.delete({ where: { id: boardId } });
    return { deleted: true };
  }

  async addMember(userId: string, boardId: string, email: string, role: WhiteboardRole) {
    const access = await this.getAccess(userId, boardId);
    if (access.role !== "OWNER") throw new ForbiddenException("Управлять участниками может только владелец");

    const invitee = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!invitee) throw new NotFoundException("Пользователь с таким email не найден");
    if (invitee.id === access.ownerId) throw new BadRequestException("Владелец уже имеет доступ");

    return this.prisma.whiteboardMember.upsert({
      where: { whiteboardId_userId: { whiteboardId: boardId, userId: invitee.id } },
      create: { whiteboardId: boardId, userId: invitee.id, role },
      update: { role },
      include: { user: { select: userSelect } },
    });
  }

  async updateMember(userId: string, boardId: string, memberUserId: string, role: WhiteboardRole) {
    const access = await this.getAccess(userId, boardId);
    if (access.role !== "OWNER") throw new ForbiddenException("Управлять участниками может только владелец");
    await this.prisma.whiteboardMember.update({
      where: { whiteboardId_userId: { whiteboardId: boardId, userId: memberUserId } },
      data: { role },
    });
    return { updated: true };
  }

  async removeMember(userId: string, boardId: string, memberUserId: string) {
    const access = await this.getAccess(userId, boardId);
    if (access.role !== "OWNER") throw new ForbiddenException("Управлять участниками может только владелец");
    await this.prisma.whiteboardMember.deleteMany({
      where: { whiteboardId: boardId, userId: memberUserId },
    });
    return { removed: true };
  }

  // ─── Share links ───
  async createShareLink(userId: string, boardId: string, role: WhiteboardRole) {
    const access = await this.getAccess(userId, boardId);
    if (access.role !== "OWNER") throw new ForbiddenException("Ссылку может создавать только владелец");
    const shareToken = randomBytes(18).toString("base64url");
    await this.prisma.whiteboard.update({
      where: { id: boardId },
      data: { shareToken, shareRole: role },
    });
    return { shareToken, shareRole: role };
  }

  async revokeShareLink(userId: string, boardId: string) {
    const access = await this.getAccess(userId, boardId);
    if (access.role !== "OWNER") throw new ForbiddenException("Управлять ссылкой может только владелец");
    await this.prisma.whiteboard.update({
      where: { id: boardId },
      data: { shareToken: null, shareRole: null },
    });
    return { revoked: true };
  }

  /** Redeem a share link: add the current user as a member with the link's role. */
  async joinByToken(userId: string, token: string) {
    const board = await this.prisma.whiteboard.findUnique({
      where: { shareToken: token },
      select: { id: true, ownerId: true, shareRole: true },
    });
    if (!board || !board.shareRole) throw new NotFoundException("Ссылка недействительна");
    if (board.ownerId !== userId) {
      await this.prisma.whiteboardMember.upsert({
        where: { whiteboardId_userId: { whiteboardId: board.id, userId } },
        create: { whiteboardId: board.id, userId, role: board.shareRole },
        update: {}, // keep an existing explicit member's role; don't let the link change it
      });
    }
    return { id: board.id };
  }
}
