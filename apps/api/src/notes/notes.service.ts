import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class NotesService {
  constructor(private prisma: PrismaService) {}

  async getNote(userId: string, nodeId: string) {
    return this.prisma.nodeNote.findUnique({
      where: { userId_nodeId: { userId, nodeId } },
    });
  }

  async upsertNote(userId: string, nodeId: string, content: string) {
    return this.prisma.nodeNote.upsert({
      where: { userId_nodeId: { userId, nodeId } },
      create: { userId, nodeId, content },
      update: { content },
    });
  }

  async deleteNote(userId: string, nodeId: string) {
    await this.prisma.nodeNote.deleteMany({
      where: { userId, nodeId },
    });
    return { deleted: true };
  }
}
