"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import type { KgNodeDetail, TopicNodeRole, EdgeKind } from "@mathgraph/shared";
import {
  listNodes,
  createNode,
  updateNode,
  deleteNode,
  updateNodeStatus,
  createEdge,
  deleteEdge,
} from "@/lib/knowledgeApi";
import { fetchNodeVersions, revertNodeToVersion, type NodeVersion, type VersionList } from "@/lib/versioningApi";
import { exportGraph, importGraph, type ImportResult } from "@/lib/importExportApi";
import { LaTeXModal } from "@/features/editor/ui/LaTeXModal";

const ROLES: TopicNodeRole[] = ["TOPIC", "CONCEPT", "METHOD", "SKILL", "TASK"];
const EDGE_TYPES: EdgeKind[] = ["PREREQ_REQUIRED", "CONTAINS"];

const ROLE_LABELS: Record<TopicNodeRole, string> = {
  TOPIC: "Тема",
  CONCEPT: "Понятие",
  METHOD: "Метод",
  SKILL: "Навык",
  TASK: "Задача",
};

type ModalState =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; node: KgNodeDetail }
  | { kind: "edge" }
  | { kind: "history"; node: KgNodeDetail }
  | { kind: "import" }
  | { kind: "csv-import" };

export default function EditorPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [nodes, setNodes] = useState<KgNodeDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState<string>("");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<ModalState>({ kind: "closed" });
  const [error, setError] = useState("");

  // Guard: only COMPOSER/ADMIN
  useEffect(() => {
    if (user && user.role !== "COMPOSER" && user.role !== "ADMIN") {
      router.replace("/");
    }
  }, [user, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listNodes(filterRole || undefined);
      setNodes(data);
    } catch {
      setError("Не удалось загрузить узлы");
    } finally {
      setLoading(false);
    }
  }, [filterRole]);

  useEffect(() => { load(); }, [load]);

  const filtered = nodes.filter((n) =>
    n.title.toLowerCase().includes(search.toLowerCase()),
  );

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Удалить узел «${title}»?`)) return;
    try {
      await deleteNode(id);
      setNodes((prev) => prev.filter((n) => n.id !== id));
    } catch {
      setError("Не удалось удалить узел");
    }
  };

  const handleExport = async () => {
    try {
      const data = await exportGraph();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mathgraph-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Не удалось экспортировать граф");
    }
  };

  const handleToggleStatus = async (node: KgNodeDetail) => {
    const next = node.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
    try {
      const updated = await updateNodeStatus(node.id, next);
      setNodes((prev) => prev.map((n) => (n.id === updated.id ? { ...n, status: updated.status } : n)));
    } catch {
      setError("Не удалось изменить статус");
    }
  };

  if (!user || (user.role !== "COMPOSER" && user.role !== "ADMIN")) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ color: "var(--text-muted)" }}>
        Доступ запрещён
      </div>
    );
  }

  return (
    <main className="min-h-screen p-6" style={{ background: "var(--bg-primary)" }}>
      {/* Header */}
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
              Редактор графа знаний
            </h1>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              {nodes.length} узлов
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleExport}
              className="btn-ghost text-xs px-3 py-2"
            >
              ↓ Экспорт
            </button>
            <button
              onClick={() => setModal({ kind: "import" })}
              className="btn-ghost text-xs px-3 py-2"
            >
              ↑ Импорт JSON
            </button>
            <button
              onClick={() => setModal({ kind: "csv-import" })}
              className="btn-ghost text-xs px-3 py-2"
            >
              ↑ Импорт CSV
            </button>
            <button
              onClick={() => setModal({ kind: "edge" })}
              className="btn-ghost text-xs px-3 py-2"
            >
              + Связь
            </button>
            <button
              onClick={() => setModal({ kind: "create" })}
              className="btn-primary text-xs px-4 py-2"
            >
              + Узел
            </button>
          </div>
        </div>

        {error && (
          <div
            className="rounded-lg p-3 text-xs mb-4 animate-fade-in"
            style={{ background: "rgba(248,113,133,0.1)", color: "var(--danger)", border: "1px solid rgba(248,113,133,0.2)" }}
          >
            {error}
            <button onClick={() => setError("")} className="ml-2 underline">✕</button>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск..."
            className="input-field text-xs flex-1"
            style={{ maxWidth: "300px" }}
          />
          <div className="flex gap-1">
            <button
              onClick={() => setFilterRole("")}
              className={`px-2.5 py-1.5 rounded-lg text-xs transition-colors ${!filterRole ? "btn-primary" : ""}`}
              style={!filterRole ? undefined : { color: "var(--text-muted)", background: "var(--bg-card)" }}
            >
              Все
            </button>
            {ROLES.map((r) => (
              <button
                key={r}
                onClick={() => setFilterRole(r)}
                className={`px-2.5 py-1.5 rounded-lg text-xs transition-colors ${filterRole === r ? "btn-primary" : ""}`}
                style={filterRole === r ? undefined : { color: "var(--text-muted)", background: "var(--bg-card)" }}
              >
                {ROLE_LABELS[r]}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton h-12 rounded-lg" />
            ))}
          </div>
        ) : (
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: "1px solid var(--border)" }}
          >
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: "var(--bg-card)", color: "var(--text-muted)" }}>
                  <th className="text-left px-4 py-3 font-medium">Название</th>
                  <th className="text-left px-4 py-3 font-medium w-24">Роль</th>
                  <th className="text-left px-4 py-3 font-medium w-24">Статус</th>
                  <th className="px-4 py-3 w-28" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((node, i) => (
                  <tr
                    key={node.id}
                    className="transition-colors hover:bg-[var(--bg-card)]"
                    style={{
                      borderTop: i > 0 ? "1px solid var(--border)" : undefined,
                      color: "var(--text-primary)",
                    }}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{node.title}</div>
                      {node.description && (
                        <div className="text-[10px] mt-0.5 truncate max-w-[400px]" style={{ color: "var(--text-muted)" }}>
                          {node.description}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="badge"
                        style={{
                          background: `var(--role-${node.role.toLowerCase()}-bg)`,
                          color: `var(--role-${node.role.toLowerCase()})`,
                        }}
                      >
                        {ROLE_LABELS[node.role]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                        style={{
                          background: node.status === "PUBLISHED"
                            ? "rgba(52,211,153,0.1)"
                            : "rgba(251,191,36,0.1)",
                          color: node.status === "PUBLISHED"
                            ? "rgb(52,211,153)"
                            : "rgb(251,191,36)",
                        }}
                      >
                        {node.status === "PUBLISHED" ? "Опубл." : "Черновик"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {user.role === "ADMIN" && (
                        <button
                          onClick={() => handleToggleStatus(node)}
                          className="text-[10px] px-2 py-1 rounded transition-colors hover:bg-[var(--bg-input)]"
                          style={{ color: node.status === "PUBLISHED" ? "rgb(251,191,36)" : "rgb(52,211,153)" }}
                        >
                          {node.status === "PUBLISHED" ? "Снять" : "Опубл."}
                        </button>
                      )}
                      <button
                        onClick={() => setModal({ kind: "history", node })}
                        className="text-[10px] px-2 py-1 rounded transition-colors hover:bg-[var(--bg-input)]"
                        style={{ color: "var(--text-muted)" }}
                      >
                        История
                      </button>
                      <button
                        onClick={() => setModal({ kind: "edit", node })}
                        className="text-[10px] px-2 py-1 rounded transition-colors hover:bg-[var(--bg-input)]"
                        style={{ color: "var(--accent)" }}
                      >
                        Изменить
                      </button>
                      <button
                        onClick={() => handleDelete(node.id, node.title)}
                        className="text-[10px] px-2 py-1 rounded transition-colors hover:bg-[var(--bg-input)] ml-1"
                        style={{ color: "var(--danger)" }}
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filtered.length === 0 && (
              <div className="py-12 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                Узлы не найдены
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Node Modal ── */}
      {(modal.kind === "create" || modal.kind === "edit") && (
        <NodeModal
          initial={modal.kind === "edit" ? modal.node : undefined}
          onClose={() => setModal({ kind: "closed" })}
          onSave={async (dto) => {
            if (modal.kind === "edit") {
              await updateNode(modal.node.id, dto);
            } else {
              await createNode(dto as any);
            }
            load();
            setModal({ kind: "closed" });
          }}
          nodes={nodes}
        />
      )}

      {/* ── Import Modal ── */}
      {modal.kind === "import" && (
        <ImportModal
          onClose={() => setModal({ kind: "closed" })}
          onImported={() => { load(); setModal({ kind: "closed" }); }}
        />
      )}

      {/* ── CSV Import Modal ── */}
      {modal.kind === "csv-import" && (
        <CsvImportModal
          onClose={() => setModal({ kind: "closed" })}
          onImported={() => { load(); setModal({ kind: "closed" }); }}
        />
      )}

      {/* ── Version History Modal ── */}
      {modal.kind === "history" && (
        <VersionHistoryModal
          node={modal.node}
          isAdmin={user.role === "ADMIN"}
          onClose={() => setModal({ kind: "closed" })}
          onReverted={() => { load(); setModal({ kind: "closed" }); }}
        />
      )}

      {/* ── Edge Modal ── */}
      {modal.kind === "edge" && (
        <EdgeModal
          nodes={nodes}
          onClose={() => setModal({ kind: "closed" })}
          onSave={async (dto) => {
            await createEdge(dto);
            setModal({ kind: "closed" });
          }}
        />
      )}
    </main>
  );
}

// ── Node Create/Edit Modal ──

function NodeModal({
  initial,
  onClose,
  onSave,
  nodes,
}: {
  initial?: KgNodeDetail;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  nodes: KgNodeDetail[];
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [role, setRole] = useState<TopicNodeRole>(initial?.role ?? "CONCEPT");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [resources, setResources] = useState(initial?.resources?.join("\n") ?? "");
  const [fipiCode, setFipiCode] = useState(initial?.fipiCode ?? "");
  const [parentTopicId, setParentTopicId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [latexTarget, setLatexTarget] = useState<"description" | "content" | null>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  const insertLatex = (latex: string, display: boolean) => {
    const wrapped = display ? `$$${latex}$$` : `$${latex}$`;
    const ref = latexTarget === "description" ? descRef : contentRef;
    const setter = latexTarget === "description" ? setDescription : setContent;
    const el = ref.current;
    if (el) {
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? el.value.length;
      const next = el.value.slice(0, start) + wrapped + el.value.slice(end);
      setter(next);
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start + wrapped.length, start + wrapped.length);
      }, 0);
    } else {
      setter((v) => v + wrapped);
    }
    setLatexTarget(null);
  };

  const topics = nodes.filter((n) => n.role === "TOPIC");

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    setError("");
    try {
      const dto: any = {
        title: title.trim(),
        role,
        description: description.trim() || undefined,
        content: content.trim() || undefined,
        resources: resources.trim() ? resources.trim().split("\n").map((s) => s.trim()).filter(Boolean) : undefined,
        fipiCode: fipiCode.trim() || undefined,
      };
      if (!initial && parentTopicId) {
        dto.parentTopicId = parentTopicId;
      }
      await onSave(dto);
    } catch (e: any) {
      setError(e.message ?? "Ошибка");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div
        className="w-[500px] max-h-[85vh] overflow-y-auto rounded-2xl p-6 animate-fade-in-scale"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
      >
        <h2 className="text-sm font-bold mb-4" style={{ color: "var(--text-primary)" }}>
          {initial ? "Редактировать узел" : "Новый узел"}
        </h2>

        {error && (
          <div className="text-xs mb-3 p-2 rounded-lg" style={{ background: "rgba(248,113,133,0.1)", color: "var(--danger)" }}>
            {error}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <div>
            <label className="text-[10px] font-medium mb-1 block" style={{ color: "var(--text-muted)" }}>Название *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="input-field text-xs w-full" />
          </div>

          <div>
            <label className="text-[10px] font-medium mb-1 block" style={{ color: "var(--text-muted)" }}>Роль</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as TopicNodeRole)}
              className="input-field text-xs w-full"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </div>

          {!initial && (
            <div>
              <label className="text-[10px] font-medium mb-1 block" style={{ color: "var(--text-muted)" }}>Родительская тема (CONTAINS)</label>
              <select
                value={parentTopicId}
                onChange={(e) => setParentTopicId(e.target.value)}
                className="input-field text-xs w-full"
              >
                <option value="">— нет —</option>
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>Описание</label>
              <button
                type="button"
                onClick={() => setLatexTarget("description")}
                className="text-[11px] px-2 py-0.5 rounded-lg transition-colors hover:bg-[var(--accent-subtle)]"
                style={{ color: "var(--accent)", border: "1px solid var(--accent)" }}
                title="Вставить формулу"
              >
                ∑ формула
              </button>
            </div>
            <textarea
              ref={descRef}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-field text-xs w-full resize-none"
              rows={2}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>Содержание (учебный текст)</label>
              <button
                type="button"
                onClick={() => setLatexTarget("content")}
                className="text-[11px] px-2 py-0.5 rounded-lg transition-colors hover:bg-[var(--accent-subtle)]"
                style={{ color: "var(--accent)", border: "1px solid var(--accent)" }}
                title="Вставить формулу"
              >
                ∑ формула
              </button>
            </div>
            <textarea
              ref={contentRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="input-field text-xs w-full resize-none"
              rows={4}
            />
          </div>

          <div>
            <label className="text-[10px] font-medium mb-1 block" style={{ color: "var(--text-muted)" }}>Ресурсы (по одной ссылке на строку)</label>
            <textarea
              value={resources}
              onChange={(e) => setResources(e.target.value)}
              className="input-field text-xs w-full resize-none"
              rows={2}
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="text-[10px] font-medium mb-1 block" style={{ color: "var(--text-muted)" }}>Код ФИПИ</label>
            <input value={fipiCode} onChange={(e) => setFipiCode(e.target.value)} className="input-field text-xs w-full" placeholder="1.2.3" />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="btn-ghost text-xs px-4 py-2">Отмена</button>
          <button onClick={handleSubmit} disabled={saving || !title.trim()} className="btn-primary text-xs px-4 py-2 disabled:opacity-40">
            {saving ? "Сохранение..." : initial ? "Сохранить" : "Создать"}
          </button>
        </div>
      </div>
    </div>

    {latexTarget && (
      <LaTeXModal
        onInsert={insertLatex}
        onClose={() => setLatexTarget(null)}
      />
    )}
    </>
  );
}

// ── Import Modal ──

function ImportModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [overwrite, setOverwrite] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setError("");
    setResult(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text) as { nodes: unknown[]; edges: unknown[] };
      if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
        throw new Error("Неверный формат файла: нужны поля nodes[] и edges[]");
      }
      const res = await importGraph(data, overwrite);
      setResult(res);
      if (res.errors.length === 0) {
        setTimeout(onImported, 1200);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ошибка импорта");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div
        className="w-[480px] rounded-2xl p-6 animate-fade-in-scale"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            Импорт графа
          </h2>
          <button onClick={onClose} className="btn-ghost !p-1.5" style={{ color: "var(--text-muted)" }}>✕</button>
        </div>

        <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
          Загрузите JSON-файл в формате экспорта MathGraph (поля <code>nodes</code> и <code>edges</code>).
        </p>

        {error && (
          <div className="text-xs mb-3 p-3 rounded-lg" style={{ background: "rgba(248,113,133,0.1)", color: "var(--danger)" }}>
            {error}
          </div>
        )}

        {result && (
          <div
            className="text-xs mb-4 p-3 rounded-lg space-y-1"
            style={{
              background: result.errors.length ? "rgba(251,191,36,0.08)" : "rgba(52,211,153,0.08)",
              border: `1px solid ${result.errors.length ? "rgba(251,191,36,0.3)" : "rgba(52,211,153,0.3)"}`,
            }}
          >
            <div className="font-semibold mb-1" style={{ color: result.errors.length ? "rgb(251,191,36)" : "rgb(52,211,153)" }}>
              {result.errors.length ? "Импорт с предупреждениями" : "Импорт завершён"}
            </div>
            <div style={{ color: "var(--text-secondary)" }}>
              Узлов создано: <b>{result.nodesCreated}</b> · обновлено: <b>{result.nodesUpdated}</b> · пропущено: <b>{result.nodesSkipped}</b>
            </div>
            <div style={{ color: "var(--text-secondary)" }}>
              Связей создано: <b>{result.edgesCreated}</b> · пропущено: <b>{result.edgesSkipped}</b>
            </div>
            {result.errors.map((e, i) => (
              <div key={i} className="text-[10px] mt-1" style={{ color: "var(--danger)" }}>• {e}</div>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-medium mb-1.5 block" style={{ color: "var(--text-muted)" }}>
              JSON-файл *
            </label>
            <input
              type="file"
              accept=".json,application/json"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="input-field text-xs w-full"
            />
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={overwrite}
              onChange={(e) => setOverwrite(e.target.checked)}
              className="rounded"
            />
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Перезаписать существующие узлы (по ID)
            </span>
          </label>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="btn-ghost text-xs px-4 py-2">Отмена</button>
          <button
            onClick={handleImport}
            disabled={!file || importing}
            className="btn-primary text-xs px-4 py-2 disabled:opacity-40"
          >
            {importing ? "Импорт..." : "Импортировать"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Version History Modal ──

function VersionHistoryModal({
  node,
  isAdmin,
  onClose,
  onReverted,
}: {
  node: KgNodeDetail;
  isAdmin: boolean;
  onClose: () => void;
  onReverted: () => void;
}) {
  const [data, setData] = useState<VersionList | null>(null);
  const [loading, setLoading] = useState(true);
  const [reverting, setReverting] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchNodeVersions(node.id)
      .then(setData)
      .catch(() => setError("Не удалось загрузить историю"))
      .finally(() => setLoading(false));
  }, [node.id]);

  const handleRevert = async (version: number) => {
    if (!confirm(`Откатить к версии ${version}?`)) return;
    setReverting(version);
    try {
      await revertNodeToVersion(node.id, version);
      onReverted();
    } catch {
      setError("Не удалось откатить версию");
      setReverting(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div
        className="w-[560px] max-h-[80vh] overflow-y-auto rounded-2xl p-6 animate-fade-in-scale"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
              История версий
            </h2>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
              {node.title} · текущая v{data?.currentVersion ?? "…"}
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost !p-1.5 text-xs" style={{ color: "var(--text-muted)" }}>✕</button>
        </div>

        {error && (
          <div className="text-xs mb-3 p-2 rounded-lg" style={{ background: "rgba(248,113,133,0.1)", color: "var(--danger)" }}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="skeleton h-16 rounded-xl" />)}
          </div>
        ) : !data || data.versions.length === 0 ? (
          <div className="py-10 text-center text-xs" style={{ color: "var(--text-muted)" }}>
            Изменений пока нет. История создаётся при каждом сохранении.
          </div>
        ) : (
          <ol className="space-y-2">
            {data.versions.map((v) => (
              <li
                key={v.id}
                className="rounded-xl p-3.5 flex items-start justify-between gap-3"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold" style={{ color: "var(--accent)" }}>v{v.version}</span>
                    <span className="text-[11px] font-medium truncate">{v.title}</span>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0"
                      style={{
                        background: v.status === "PUBLISHED" ? "rgba(52,211,153,0.1)" : "rgba(251,191,36,0.1)",
                        color: v.status === "PUBLISHED" ? "rgb(52,211,153)" : "rgb(251,191,36)",
                      }}
                    >
                      {v.status === "PUBLISHED" ? "Опубл." : "Черновик"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px]" style={{ color: "var(--text-muted)" }}>
                    <span>{new Date(v.createdAt).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                    {v.changeNote && <span className="italic">"{v.changeNote}"</span>}
                  </div>
                  {v.description && (
                    <div className="text-[10px] mt-1 truncate" style={{ color: "var(--text-muted)" }}>
                      {v.description}
                    </div>
                  )}
                </div>
                {isAdmin && (
                  <button
                    onClick={() => handleRevert(v.version)}
                    disabled={reverting === v.version}
                    className="shrink-0 text-[10px] px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                    style={{ background: "var(--bg-input)", color: "var(--text-secondary)" }}
                  >
                    {reverting === v.version ? "..." : "Откатить"}
                  </button>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

// ── Edge Create Modal ──

function EdgeModal({
  nodes,
  onClose,
  onSave,
}: {
  nodes: KgNodeDetail[];
  onClose: () => void;
  onSave: (dto: any) => Promise<void>;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [type, setType] = useState<EdgeKind>("PREREQ_REQUIRED");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!from || !to) return;
    setSaving(true);
    setError("");
    try {
      await onSave({ from, to, type });
    } catch (e: any) {
      setError(e.message ?? "Ошибка");
      setSaving(false);
      return;
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div
        className="w-[440px] rounded-2xl p-6 animate-fade-in-scale"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
      >
        <h2 className="text-sm font-bold mb-4" style={{ color: "var(--text-primary)" }}>
          Новая связь
        </h2>

        {error && (
          <div className="text-xs mb-3 p-2 rounded-lg" style={{ background: "rgba(248,113,133,0.1)", color: "var(--danger)" }}>
            {error}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <div>
            <label className="text-[10px] font-medium mb-1 block" style={{ color: "var(--text-muted)" }}>Из (From)</label>
            <select value={from} onChange={(e) => setFrom(e.target.value)} className="input-field text-xs w-full">
              <option value="">Выберите узел...</option>
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>[{ROLE_LABELS[n.role]}] {n.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-medium mb-1 block" style={{ color: "var(--text-muted)" }}>В (To)</label>
            <select value={to} onChange={(e) => setTo(e.target.value)} className="input-field text-xs w-full">
              <option value="">Выберите узел...</option>
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>[{ROLE_LABELS[n.role]}] {n.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-medium mb-1 block" style={{ color: "var(--text-muted)" }}>Тип связи</label>
            <select value={type} onChange={(e) => setType(e.target.value as EdgeKind)} className="input-field text-xs w-full">
              {EDGE_TYPES.map((t) => (
                <option key={t} value={t}>{t === "CONTAINS" ? "CONTAINS (тема → дочерний)" : "PREREQ_REQUIRED (пререквизит)"}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="btn-ghost text-xs px-4 py-2">Отмена</button>
          <button onClick={handleSubmit} disabled={saving || !from || !to} className="btn-primary text-xs px-4 py-2 disabled:opacity-40">
            {saving ? "Создание..." : "Создать связь"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── CSV Import Modal ──────────────────────────────────────────────────────────

const CSV_ROLES = ["TOPIC", "CONCEPT", "METHOD", "SKILL", "TASK"] as const;

type CsvRow = {
  title: string;
  role: string;
  description: string;
  content: string;
  fipiCode: string;
  resources: string;
  _valid: boolean;
  _error: string;
};

function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const delim = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(delim).map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ""));
  const col = (name: string) => headers.indexOf(name);

  return lines.slice(1).map((line): CsvRow => {
    const cells = line.split(delim).map((c) => c.trim().replace(/^"|"$/g, ""));
    const get = (name: string) => (col(name) >= 0 ? (cells[col(name)] ?? "") : "");

    const title = get("title") || get("название") || get("тема");
    const role = (get("role") || get("роль") || "CONCEPT").toUpperCase();
    const description = get("description") || get("описание");
    const content = get("content") || get("содержание");
    const fipiCode = get("fipicode") || get("fipikod") || get("код");
    const resources = get("resources") || get("ресурсы");

    const validRole = (CSV_ROLES as readonly string[]).includes(role);
    return {
      title,
      role: validRole ? role : "CONCEPT",
      description,
      content,
      fipiCode,
      resources,
      _valid: !!title,
      _error: !title ? "Нет заголовка" : !validRole ? `Неверная роль: ${role}` : "",
    };
  });
}

function CsvImportModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => void;
}) {
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [overwrite, setOverwrite] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    setError("");
    const text = await file.text();
    const parsed = parseCsv(text);
    if (parsed.length === 0) {
      setError("Не удалось распарсить CSV. Убедитесь, что первая строка — заголовки.");
    }
    setRows(parsed);
  };

  const handleImport = async () => {
    const valid = rows.filter((r) => r._valid);
    if (valid.length === 0) return;
    setImporting(true);
    setError("");
    setResult(null);
    try {
      const nodes = valid.map((r) => ({
        title: r.title,
        role: r.role,
        description: r.description || undefined,
        content: r.content || undefined,
        fipiCode: r.fipiCode || undefined,
        resources: r.resources ? r.resources.split(/\s+/).filter(Boolean) : [],
        status: "PUBLISHED",
      }));
      const res = await importGraph({ nodes, edges: [] }, overwrite);
      setResult(res);
      if (res.errors.length === 0) setTimeout(onImported, 1400);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ошибка импорта");
    } finally {
      setImporting(false);
    }
  };

  const valid = rows.filter((r) => r._valid);
  const invalid = rows.filter((r) => !r._valid);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.45)" }}>
      <div
        className="w-[640px] max-h-[85vh] flex flex-col rounded-2xl animate-fade-in-scale"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <h2 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Импорт из CSV</h2>
          <button onClick={onClose} className="btn-ghost !p-1.5" style={{ color: "var(--text-muted)" }}>✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div className="rounded-xl p-3 text-[11px] leading-relaxed" style={{ background: "var(--bg-input)", color: "var(--text-muted)" }}>
            <b style={{ color: "var(--text-secondary)" }}>Формат CSV</b> — первая строка заголовки:
            <code className="block mt-1.5 px-2 py-1.5 rounded-lg text-[10px]" style={{ background: "var(--bg-card)", color: "var(--accent)" }}>
              title, role, description, content, fipiCode, resources
            </code>
            <span className="mt-1 block">Роли: TOPIC · CONCEPT · METHOD · SKILL · TASK. Разделитель: запятая или точка с запятой.</span>
          </div>

          <div>
            <label className="text-[10px] font-medium mb-1.5 block" style={{ color: "var(--text-muted)" }}>CSV-файл *</label>
            <input type="file" accept=".csv,text/csv" onChange={handleFile} className="input-field text-xs w-full" />
          </div>

          {error && (
            <div className="text-xs p-3 rounded-lg" style={{ background: "rgba(248,113,133,0.1)", color: "var(--danger)" }}>
              {error}
            </div>
          )}

          {rows.length > 0 && !result && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  Предпросмотр — {rows.length} строк
                </span>
                <div className="flex items-center gap-3 text-[11px]">
                  <span style={{ color: "#10b981" }}>✓ {valid.length} верных</span>
                  {invalid.length > 0 && <span style={{ color: "var(--danger)" }}>✕ {invalid.length} ошибок</span>}
                </div>
              </div>
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                <table className="w-full text-[11px]">
                  <thead>
                    <tr style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border)" }}>
                      {["Название", "Роль", "Описание", "ФИПИ", ""].map((h, i) => (
                        <th key={i} className="text-left px-3 py-2 font-medium" style={{ color: "var(--text-muted)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 50).map((r, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border)", background: r._valid ? "transparent" : "rgba(248,113,133,0.04)" }}>
                        <td className="px-3 py-2 font-medium max-w-[180px] truncate" style={{ color: "var(--text-primary)" }}>
                          {r.title || <span style={{ color: "var(--danger)" }}>—</span>}
                        </td>
                        <td className="px-3 py-2">
                          <span className="badge" style={{ background: `var(--role-${r.role.toLowerCase()}-bg, var(--bg-input))`, color: `var(--role-${r.role.toLowerCase()}, var(--text-muted))` }}>
                            {r.role}
                          </span>
                        </td>
                        <td className="px-3 py-2 max-w-[140px] truncate" style={{ color: "var(--text-muted)" }}>{r.description || "—"}</td>
                        <td className="px-3 py-2" style={{ color: "var(--text-muted)" }}>{r.fipiCode || "—"}</td>
                        <td className="px-3 py-2">{r._valid ? <span style={{ color: "#10b981" }}>✓</span> : <span style={{ color: "var(--danger)" }} title={r._error}>✕</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 50 && (
                  <div className="px-3 py-2 text-[10px]" style={{ color: "var(--text-muted)", background: "var(--bg-card)" }}>
                    Показано 50 из {rows.length}
                  </div>
                )}
              </div>
            </div>
          )}

          {result && (
            <div className="text-xs p-4 rounded-xl space-y-1" style={{ background: result.errors.length ? "rgba(251,191,36,0.08)" : "rgba(52,211,153,0.08)", border: `1px solid ${result.errors.length ? "rgba(251,191,36,0.3)" : "rgba(52,211,153,0.3)"}` }}>
              <div className="font-semibold mb-1" style={{ color: result.errors.length ? "rgb(251,191,36)" : "rgb(52,211,153)" }}>
                {result.errors.length ? "Импорт с предупреждениями" : "Импорт завершён ✓"}
              </div>
              <div style={{ color: "var(--text-secondary)" }}>
                Создано: <b>{result.nodesCreated}</b> · обновлено: <b>{result.nodesUpdated}</b> · пропущено: <b>{result.nodesSkipped}</b>
              </div>
              {result.errors.map((e, i) => (
                <div key={i} className="text-[10px] mt-1" style={{ color: "var(--danger)" }}>• {e}</div>
              ))}
            </div>
          )}

          {rows.length > 0 && !result && (
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} className="rounded" />
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Перезаписать существующие узлы</span>
            </label>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={onClose} className="btn-ghost text-xs px-4 py-2">{result ? "Закрыть" : "Отмена"}</button>
          {!result && (
            <button onClick={handleImport} disabled={valid.length === 0 || importing} className="btn-primary text-xs px-4 py-2 disabled:opacity-40">
              {importing ? "Импорт..." : `Импортировать ${valid.length} узлов`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
