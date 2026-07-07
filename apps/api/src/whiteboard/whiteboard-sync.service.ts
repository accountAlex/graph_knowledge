import { Injectable, Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Hocuspocus } from "@hocuspocus/server";
import { WebSocketServer } from "ws";
import * as Y from "yjs";
import type { Server as HttpServer } from "node:http";
import { PrismaService } from "../prisma/prisma.service";
import { WhiteboardService } from "./whiteboard.service";
import type { JwtPayload } from "../auth/auth.service";

const COLLAB_PATH = "/collab";

/**
 * Phase 2 — real-time collaboration core.
 *
 * Embeds a Hocuspocus (Yjs) server into the existing NestJS HTTP server on the
 * `upgrade` event (same process, same port, path `/collab`). The board id travels
 * as Hocuspocus `documentName` (sent in-protocol by @hocuspocus/provider, NOT in
 * the URL). Access is gated by `onAuthenticate`, which reuses the same JWT and the
 * WhiteboardService.getAccess() authorization from the REST layer.
 *
 * Persistence (Phase 3): the Yjs document is loaded from / saved to the
 * `WhiteboardSnapshot` table as a single binary state (`Y.encodeStateAsUpdate`).
 * `onStoreDocument` is debounced by Hocuspocus and also fires on last-disconnect,
 * so board content survives server restarts and all clients leaving.
 */
@Injectable()
export class WhiteboardSyncService {
  private readonly logger = new Logger(WhiteboardSyncService.name);
  private readonly hocuspocus: Hocuspocus;
  private wss?: WebSocketServer;

  constructor(
    private readonly jwt: JwtService,
    private readonly boards: WhiteboardService,
    private readonly prisma: PrismaService,
  ) {
    // Single-instance setup. To scale horizontally (>1 API replica) install
    // `@hocuspocus/extension-redis` and add `extensions: [new Redis({ host/port from
    // REDIS_URL })]` here so document updates fan out across replicas via Redis pub/sub.
    this.hocuspocus = new Hocuspocus({
      name: "mathwin-collab",
      quiet: true,
      debounce: 3000,
      maxDebounce: 10000,
      onAuthenticate: async ({ token, documentName, connectionConfig }) => {
        let payload: JwtPayload;
        try {
          payload = await this.jwt.verifyAsync<JwtPayload>(token, {
            secret: process.env.JWT_ACCESS_SECRET || "mathgraph-access-secret-dev",
          });
        } catch {
          throw new Error("Unauthorized: invalid token");
        }

        // Throws 404/403 when the user has no access -> Hocuspocus rejects the socket.
        const { role } = await this.boards.getAccess(payload.sub, documentName);

        // Viewers may observe but their updates are dropped server-side.
        if (role === "VIEWER") connectionConfig.readOnly = true;

        // Becomes the per-connection `context` for later hooks.
        return { userId: payload.sub, role };
      },

      // Load persisted board state into the in-memory Yjs document on first connect.
      onLoadDocument: async ({ documentName, document }) => {
        try {
          const snap = await this.prisma.whiteboardSnapshot.findUnique({
            where: { whiteboardId: documentName },
          });
          if (snap?.state) Y.applyUpdate(document, snap.state);
        } catch (err) {
          this.logger.warn(`onLoadDocument(${documentName}) failed: ${(err as Error).message}`);
        }
        return document;
      },

      // Persist the document (debounced by Hocuspocus; also runs on last-disconnect).
      onStoreDocument: async ({ documentName, document }) => {
        try {
          // Copy into an ArrayBuffer-backed Uint8Array so the type matches Prisma's
          // Bytes (Uint8Array<ArrayBuffer>) — yjs returns Uint8Array<ArrayBufferLike>.
          const update = Y.encodeStateAsUpdate(document);
          const state = new Uint8Array(update.byteLength);
          state.set(update);
          await this.prisma.whiteboardSnapshot.upsert({
            where: { whiteboardId: documentName },
            create: { whiteboardId: documentName, state },
            update: { state },
          });
        } catch (err) {
          this.logger.warn(`onStoreDocument(${documentName}) failed: ${(err as Error).message}`);
        }
      },
    });
  }

  /**
   * Attach the collab websocket endpoint to NestJS's HTTP server.
   * Called from main.ts after the server is listening.
   */
  bindTo(httpServer: HttpServer) {
    if (this.wss) return;
    const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "http://localhost:3000")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const wss = new WebSocketServer({ noServer: true });
    this.wss = wss;

    httpServer.on("upgrade", (request, socket, head) => {
      const pathname = (request.url ?? "").split("?")[0];
      if (pathname !== COLLAB_PATH) {
        socket.destroy();
        return;
      }
      // Reject cross-site WebSocket from browsers (CSWSH). A missing Origin means a
      // non-browser client (no cross-site risk), so it is allowed through to auth.
      const origin = request.headers.origin;
      if (origin && allowedOrigins.length && !allowedOrigins.includes(origin)) {
        this.logger.warn(`Rejected collab upgrade from disallowed origin: ${origin}`);
        socket.destroy();
        return;
      }
      wss.handleUpgrade(request, socket, head, (ws) => {
        this.hocuspocus.handleConnection(ws, request);
      });
    });

    this.logger.log(`Collab sync (Hocuspocus) attached at ws ${COLLAB_PATH}`);
  }
}
