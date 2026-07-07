/**
 * Throwaway y-websocket server for the Phase 0 whiteboard spike.
 *
 * Canonical in-memory `setupWSConnection` (no persistence, no scaling) wired
 * against the yjs 13 / y-protocols 1.x already in node_modules. Phase 2 replaces
 * this with Hocuspocus embedded in the NestJS HTTP server (auth + Postgres + Redis).
 *
 * Run from repo root:  node scripts/yws-spike-server.mjs   (PORT=1234 by default)
 */
import http from "http";
import { WebSocketServer } from "ws";
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";

const PORT = Number(process.env.PORT ?? 1234);
const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

/** @type {Map<string, Y.Doc & { awareness: any, conns: Map<any, Set<number>>, name: string }>} */
const docs = new Map();

const send = (doc, conn, message) => {
  if (conn.readyState !== 0 /* CONNECTING */ && conn.readyState !== 1 /* OPEN */) {
    closeConn(doc, conn);
    return;
  }
  try {
    conn.send(message, (err) => err != null && closeConn(doc, conn));
  } catch {
    closeConn(doc, conn);
  }
};

const closeConn = (doc, conn) => {
  if (doc.conns.has(conn)) {
    const controlledIds = doc.conns.get(conn);
    doc.conns.delete(conn);
    awarenessProtocol.removeAwarenessStates(doc.awareness, Array.from(controlledIds), null);
  }
  conn.close();
};

const getYDoc = (name) => {
  let doc = docs.get(name);
  if (doc) return doc;

  doc = new Y.Doc();
  doc.name = name;
  doc.conns = new Map();
  doc.awareness = new awarenessProtocol.Awareness(doc);
  doc.awareness.setLocalState(null);

  doc.on("update", (update) => {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    const message = encoding.toUint8Array(encoder);
    doc.conns.forEach((_, conn) => send(doc, conn, message));
  });

  doc.awareness.on("update", ({ added, updated, removed }, conn) => {
    const changed = added.concat(updated, removed);
    if (conn !== null && doc.conns.has(conn)) {
      const ids = doc.conns.get(conn);
      added.forEach((id) => ids.add(id));
      removed.forEach((id) => ids.delete(id));
    }
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(doc.awareness, changed));
    const message = encoding.toUint8Array(encoder);
    doc.conns.forEach((_, c) => send(doc, c, message));
  });

  docs.set(name, doc);
  return doc;
};

const onMessage = (conn, doc, message) => {
  const decoder = decoding.createDecoder(message);
  const encoder = encoding.createEncoder();
  const type = decoding.readVarUint(decoder);
  switch (type) {
    case MESSAGE_SYNC:
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.readSyncMessage(decoder, encoder, doc, conn);
      if (encoding.length(encoder) > 1) send(doc, conn, encoding.toUint8Array(encoder));
      break;
    case MESSAGE_AWARENESS:
      awarenessProtocol.applyAwarenessUpdate(doc.awareness, decoding.readVarUint8Array(decoder), conn);
      break;
    default:
      break;
  }
};

const setupConnection = (conn, req) => {
  conn.binaryType = "arraybuffer";
  const room = (req.url || "").slice(1).split("?")[0] || "default";
  const doc = getYDoc(room);
  doc.conns.set(conn, new Set());

  conn.on("message", (data) => onMessage(conn, doc, new Uint8Array(data)));
  conn.on("close", () => closeConn(doc, conn));

  // Initial sync: server -> client (SyncStep1) + current awareness.
  {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(encoder, doc);
    send(doc, conn, encoding.toUint8Array(encoder));

    const states = doc.awareness.getStates();
    if (states.size > 0) {
      const aEncoder = encoding.createEncoder();
      encoding.writeVarUint(aEncoder, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(
        aEncoder,
        awarenessProtocol.encodeAwarenessUpdate(doc.awareness, Array.from(states.keys())),
      );
      send(doc, conn, encoding.toUint8Array(aEncoder));
    }
  }
};

const server = http.createServer((_, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("y-websocket spike server (Phase 0)\n");
});
const wss = new WebSocketServer({ server });
wss.on("connection", setupConnection);

server.listen(PORT, () => {
  console.log(`[yws-spike] listening on ws://localhost:${PORT}  (rooms: ${docs.size})`);
});
