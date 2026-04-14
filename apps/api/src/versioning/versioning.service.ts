import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class VersioningService {
  constructor(private prisma: PrismaService) {}

  async listVersions(nodeId: string) {
    const node = await this.prisma.kgNodeRegistry.findUnique({ where: { id: nodeId } });
    if (!node) throw new NotFoundException("Node not found");

    const versions = await this.prisma.kgNodeVersion.findMany({
      where: { nodeId },
      orderBy: { version: "desc" },
    });

    return { currentVersion: node.version, versions };
  }

  async getVersion(nodeId: string, version: number) {
    const v = await this.prisma.kgNodeVersion.findUnique({
      where: { nodeId_version: { nodeId, version } },
    });
    if (!v) throw new NotFoundException("Version not found");
    return v;
  }

  async revertToVersion(nodeId: string, version: number, editedBy: string) {
    const snap = await this.prisma.kgNodeVersion.findUnique({
      where: { nodeId_version: { nodeId, version } },
    });
    if (!snap) throw new NotFoundException("Version not found");

    const current = await this.prisma.kgNodeRegistry.findUnique({ where: { id: nodeId } });
    if (!current) throw new NotFoundException("Node not found");

    // Snapshot current state before revert
    const lastVersion = await this.prisma.kgNodeVersion.findFirst({
      where: { nodeId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const nextVersion = (lastVersion?.version ?? 0) + 1;

    await this.prisma.kgNodeVersion.create({
      data: {
        nodeId,
        version: nextVersion,
        title: current.title,
        description: current.description,
        content: current.content,
        resources: current.resources,
        role: current.role,
        status: current.status,
        editedBy,
        changeNote: `Revert to v${version}`,
      },
    });

    const updated = await this.prisma.kgNodeRegistry.update({
      where: { id: nodeId },
      data: {
        title: snap.title,
        description: snap.description,
        content: snap.content,
        resources: snap.resources,
        role: snap.role,
        version: { increment: 1 },
      },
    });

    return updated;
  }
}
