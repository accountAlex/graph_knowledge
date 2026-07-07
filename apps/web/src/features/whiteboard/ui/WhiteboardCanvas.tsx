"use client";

/**
 * Collaborative whiteboard canvas — Excalidraw <-> Yjs bridge over Hocuspocus.
 *
 * Connects to the NestJS-embedded Hocuspocus server at `/collab` (Phase 2/3):
 * the JWT gates access, the board id is the Hocuspocus document name, and server
 * persistence (Phase 3) means the board reloads its state on connect.
 *
 * Sync model: a Y.Map "elements" keyed by element id holds each Excalidraw element
 * as an opaque JSON value. Local edits flow onChange -> Y.Map; remote changes flow
 * Y.Map.observe -> reconcileElements -> updateScene. A per-id version cache breaks
 * the echo loop. Cursors ride on awareness and feed Excalidraw's `collaborators`.
 *
 * Connection status is lifted to the parent (BoardView renders the chrome) so it
 * doesn't overlap Excalidraw's own in-canvas UI.
 */
import {
  Excalidraw,
  reconcileElements,
  CaptureUpdateAction,
  convertToExcalidrawElements,
  viewportCoordsToSceneCoords,
} from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { collabWsUrl, getCollabToken } from "@/lib/whiteboardApi";
import { buildFormulaFile, FORMULA_MIME, FORMULA_DEFAULT_HEIGHT } from "../lib/formula";
import { latexToSvg, svgToDataUrl } from "../lib/mathToSvg";
import { MathFormulaModal } from "./MathFormulaModal";

type ExcalidrawProps = React.ComponentProps<typeof Excalidraw>;
type ExcalidrawAPI = Parameters<NonNullable<ExcalidrawProps["excalidrawAPI"]>>[0];
type SceneElements = Parameters<NonNullable<ExcalidrawProps["onChange"]>>[0];
type SceneElement = SceneElements[number];

const LOCAL_ORIGIN = "local";

export type ConnState = "connecting" | "connected" | "disconnected";

interface Props {
  boardId: string;
  readOnly?: boolean;
  userName: string;
  userColor: string;
  onStatusChange?: (s: ConnState) => void;
  onAuthError?: (reason: string) => void;
}

export default function WhiteboardCanvas({
  boardId,
  readOnly = false,
  userName,
  userColor,
  onStatusChange,
  onAuthError,
}: Props) {
  const apiRef = useRef<ExcalidrawAPI | null>(null);
  // Last element version already mirrored, per id — the echo-loop breaker.
  const versionsRef = useRef<Map<string, number>>(new Map());
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<HocuspocusProvider | null>(null);
  const syncedRef = useRef(false);

  // Keep latest callbacks without re-running the connect effect.
  const statusCb = useRef(onStatusChange);
  statusCb.current = onStatusChange;
  const authErrCb = useRef(onAuthError);
  authErrCb.current = onAuthError;
  const readOnlyRef = useRef(readOnly);
  readOnlyRef.current = readOnly;

  // null = formula editor closed; {id:null} = inserting; {id} = editing that element.
  const [formulaTarget, setFormulaTarget] = useState<{ id: string | null; latex: string } | null>(null);

  // ---- Y.Doc -> Excalidraw ---------------------------------------------------
  const applyRemote = () => {
    const api = apiRef.current;
    const ydoc = ydocRef.current;
    if (!api || !ydoc) return;

    const yElements = ydoc.getMap<SceneElement>("elements");
    const remote = Array.from(yElements.values()).sort((a, b) => {
      const ai = (a as { index?: string }).index ?? "";
      const bi = (b as { index?: string }).index ?? "";
      return ai < bi ? -1 : ai > bi ? 1 : 0;
    });
    if (remote.length === 0) return;

    for (const el of remote) versionsRef.current.set(el.id, el.version);

    // Re-render formula images from their latex (files aren't synced through Yjs).
    void ensureFormulaFiles(api, remote);

    const reconciled = reconcileElements(
      api.getSceneElementsIncludingDeleted() as never,
      remote as never,
      api.getAppState(),
    );
    api.updateScene({ elements: reconciled, captureUpdate: CaptureUpdateAction.NEVER });
  };

  // ---- Excalidraw -> Y.Doc ---------------------------------------------------
  const handleChange: NonNullable<ExcalidrawProps["onChange"]> = (elements) => {
    const ydoc = ydocRef.current;
    if (readOnlyRef.current || !ydoc || !syncedRef.current) return;

    ydoc.transact(() => {
      const yElements = ydoc.getMap<SceneElement>("elements");
      for (const el of elements) {
        const seen = versionsRef.current.get(el.id);
        if (seen === undefined || seen < el.version) {
          yElements.set(el.id, JSON.parse(JSON.stringify(el)) as SceneElement);
          versionsRef.current.set(el.id, el.version);
        }
      }
    }, LOCAL_ORIGIN);
  };

  // ---- Presence (cursors) ----------------------------------------------------
  const handlePointer: NonNullable<ExcalidrawProps["onPointerUpdate"]> = (payload) => {
    const awareness = providerRef.current?.awareness;
    if (!awareness) return;
    awareness.setLocalStateField("pointer", {
      x: payload.pointer.x,
      y: payload.pointer.y,
      tool: payload.pointer.tool ?? "pointer",
    });
    awareness.setLocalStateField("button", payload.button);
  };

  // ---- LaTeX formulas (image elements re-rendered from customData.latex) ------
  // Re-render formula files from latex (files aren't synced through Yjs). Async &
  // fire-and-forget: Excalidraw re-renders the image elements once addFiles lands.
  const ensureFormulaFiles = async (api: ExcalidrawAPI, elements: readonly SceneElement[]) => {
    const files = api.getFiles();
    const seen = new Set<string>();
    for (const el of elements) {
      const e = el as { type: string; fileId?: string; customData?: { latex?: string } };
      const latex = e.customData?.latex;
      const fileId = e.fileId;
      if (e.type === "image" && latex && fileId && !files[fileId] && !seen.has(fileId)) {
        seen.add(fileId);
        const { svg } = await latexToSvg(latex);
        api.addFiles([
          { id: fileId, dataURL: svgToDataUrl(svg), mimeType: FORMULA_MIME, created: Date.now() },
        ] as never);
      }
    }
  };

  const insertFormula = async (latex: string) => {
    const api = apiRef.current;
    if (!api) return;
    const { fileId, dataURL, aspect } = await buildFormulaFile(latex);
    api.addFiles([{ id: fileId, dataURL, mimeType: FORMULA_MIME, created: Date.now() }] as never);
    const app = api.getAppState();
    const center = viewportCoordsToSceneCoords(
      { clientX: app.offsetLeft + app.width / 2, clientY: app.offsetTop + app.height / 2 },
      app as never,
    );
    const height = FORMULA_DEFAULT_HEIGHT;
    const width = Math.max(24, Math.round(height * aspect));
    const created = convertToExcalidrawElements([
      {
        type: "image",
        fileId: fileId as never,
        x: center.x - width / 2,
        y: center.y - height / 2,
        width,
        height,
        customData: { latex },
      },
    ] as never);
    api.updateScene({
      elements: [...api.getSceneElementsIncludingDeleted(), ...created] as never,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  };

  const updateFormula = async (id: string, latex: string) => {
    const api = apiRef.current;
    if (!api) return;
    const { fileId, dataURL, aspect } = await buildFormulaFile(latex);
    api.addFiles([{ id: fileId, dataURL, mimeType: FORMULA_MIME, created: Date.now() }] as never);
    const next = api.getSceneElementsIncludingDeleted().map((el) => {
      if (el.id !== id) return el;
      const height = el.height;
      const width = Math.max(24, Math.round(height * aspect));
      return { ...el, fileId, width, customData: { ...el.customData, latex }, version: el.version + 1 };
    });
    api.updateScene({ elements: next as never, captureUpdate: CaptureUpdateAction.IMMEDIATELY });
  };

  // Open editor prefilled when a single formula is selected, else insert a new one.
  const openFormula = () => {
    const api = apiRef.current;
    if (!api) return;
    const selectedIds = api.getAppState().selectedElementIds ?? {};
    const sel = api.getSceneElements().find((e) => {
      const x = e as { id: string; type: string; customData?: { latex?: string } };
      return selectedIds[x.id] && x.type === "image" && !!x.customData?.latex;
    }) as { id: string; customData?: { latex?: string } } | undefined;
    setFormulaTarget(sel ? { id: sel.id, latex: sel.customData?.latex ?? "" } : { id: null, latex: "" });
  };

  // ---- Hocuspocus lifecycle --------------------------------------------------
  useEffect(() => {
    const ydoc = new Y.Doc();
    const provider = new HocuspocusProvider({
      url: collabWsUrl(),
      name: boardId,
      // Function form: resolved on every (re)connect, refreshing a near-expired
      // access token so long sessions survive the 30-min token lifetime.
      token: () => getCollabToken(),
      document: ydoc,
      onStatus: ({ status }) =>
        statusCb.current?.(
          status === "connected" ? "connected" : status === "connecting" ? "connecting" : "disconnected",
        ),
      onSynced: () => {
        syncedRef.current = true;
        applyRemote();
      },
      onAuthenticationFailed: ({ reason }) => authErrCb.current?.(reason || "Нет доступа к этой доске"),
    });
    ydocRef.current = ydoc;
    providerRef.current = provider;

    provider.awareness?.setLocalStateField("user", { name: userName, color: userColor });

    const yElements = ydoc.getMap<SceneElement>("elements");
    const onYjsChange = (_: unknown, txn: Y.Transaction) => {
      if (txn.origin === LOCAL_ORIGIN) return;
      applyRemote();
    };
    yElements.observe(onYjsChange);

    const onAwareness = () => {
      const api = apiRef.current;
      const awareness = provider.awareness;
      if (!api || !awareness) return;
      const collaborators = new Map();
      awareness.getStates().forEach((state, clientId) => {
        if (clientId === awareness.clientID || !state?.user) return;
        collaborators.set(String(clientId), {
          id: String(clientId),
          username: state.user.name,
          color: { background: state.user.color, stroke: state.user.color },
          pointer: state.pointer,
          button: state.button,
        });
      });
      api.updateScene({ collaborators });
    };
    provider.awareness?.on("change", onAwareness);

    return () => {
      yElements.unobserve(onYjsChange);
      provider.awareness?.off("change", onAwareness);
      provider.destroy();
      ydoc.destroy();
      ydocRef.current = null;
      providerRef.current = null;
      syncedRef.current = false;
      versionsRef.current.clear();
    };
  }, [boardId, userName, userColor]);

  return (
    <div style={{ height: "100%", width: "100%", position: "relative" }}>
      {!readOnly && (
        <button
          onClick={openFormula}
          className="btn-primary text-sm"
          style={{ position: "absolute", top: 12, right: 12, zIndex: 5, padding: "8px 14px" }}
          title="Вставить или изменить формулу (выделите формулу, чтобы редактировать)"
        >
          ∑ Формула
        </button>
      )}

      <Excalidraw
        viewModeEnabled={readOnly}
        excalidrawAPI={(api) => {
          apiRef.current = api;
          if (syncedRef.current) applyRemote();
        }}
        onChange={handleChange}
        onPointerUpdate={handlePointer}
      />

      {formulaTarget && (
        <MathFormulaModal
          initialLatex={formulaTarget.latex}
          onSubmit={(latex) => {
            if (formulaTarget.id) updateFormula(formulaTarget.id, latex);
            else insertFormula(latex);
            setFormulaTarget(null);
          }}
          onClose={() => setFormulaTarget(null)}
        />
      )}
    </div>
  );
}
