"use client";

import { useState, useRef, useCallback } from "react";
import type { Asset, Category, ZipUploadResult } from "@/lib/dam-api";
import { createAsset, uploadFile, uploadZip, addCategoryToAsset } from "@/lib/dam-api";

const inputCls =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm w-full focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

type FileStatus = "pending" | "uploading" | "done" | "error";

/** How a ZIP file should be handled on upload. */
type ZipMode =
  | "zip-only"          // upload the ZIP as a regular asset, ignore contents
  | "zip-and-contents"  // upload ZIP as asset AND expand contents into category tree
  | "contents-only";    // expand contents only; do not store the ZIP itself

function isZip(file: File): boolean {
  return (
    file.type === "application/zip" ||
    file.type === "application/x-zip-compressed" ||
    file.type === "application/x-zip" ||
    file.name.toLowerCase().endsWith(".zip")
  );
}

const ZIP_MODE_OPTIONS: { mode: ZipMode; label: string; title: string }[] = [
  { mode: "zip-only",         label: "ZIP only",         title: "Upload the ZIP file as an asset; do not expand its contents" },
  { mode: "zip-and-contents", label: "ZIP + contents",   title: "Upload the ZIP file and expand its contents into a category tree" },
  { mode: "contents-only",    label: "Contents only",    title: "Expand ZIP contents into a category tree; do not store the ZIP file itself" },
];

interface FileEntry {
  file: File;
  /** Display name — filename without extension, editable before upload */
  name: string;
  /** MIME type detected by browser */
  mimeType: string;
  status: FileStatus;
  error?: string;
  asset?: Asset;
  /** Populated after a successful ZIP upload (modes: zip-and-contents, contents-only). */
  zipResult?: ZipUploadResult;
  /** Only set for ZIP files. */
  zipMode?: ZipMode;
}

function deriveNameAndMime(f: File): { name: string; mimeType: string } {
  const name = f.name.replace(/\.[^.]+$/, "") || f.name;
  const mimeType = f.type || "application/octet-stream";
  return { name, mimeType };
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusIcon({ status }: { status: FileStatus }) {
  if (status === "done")
    return <span className="text-green-600 font-bold text-sm">✓</span>;
  if (status === "error")
    return <span className="text-red-500 font-bold text-sm">✗</span>;
  if (status === "uploading")
    return <span className="animate-spin inline-block text-blue-600 text-sm">⟳</span>;
  return <span className="text-slate-300 text-sm">○</span>;
}

interface Props {
  token: string;
  username: string;
  categories: Category[];
  onComplete: (assets: Asset[]) => void;
  onClose: () => void;
  /** Called when a ZIP is processed, before onComplete, so the parent can
   *  update its category tree and assetCategories map immediately. */
  onZipResult?: (result: ZipUploadResult) => void;
}

export default function UploadModal({ token, username, categories, onComplete, onClose, onZipResult }: Props) {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [dragging, setDragging] = useState(false);

  // Shared metadata — applied to every file
  const [description, setDescription] = useState("");
  const [caption, setCaption] = useState("");
  const [keywords, setKeywords] = useState("");
  const [creator] = useState(username);
  const [copyrightNotice, setCopyrightNotice] = useState("");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);

  const [uploading, setUploading] = useState(false);
  const [allDone, setAllDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── File helpers ────────────────────────────────────────────────────────────

  const addFiles = useCallback((files: FileList | File[]) => {
    const incoming = Array.from(files);
    setEntries((prev) => {
      const existingNames = new Set(prev.map((e) => e.file.name));
      const newEntries: FileEntry[] = incoming
        .filter((f) => !existingNames.has(f.name))
        .map((f) => {
          const { name, mimeType } = deriveNameAndMime(f);
          return { file: f, name, mimeType, status: "pending",
                   zipMode: isZip(f) ? "contents-only" as ZipMode : undefined };
        });
      return [...prev, ...newEntries];
    });
  }, []);

  function removeEntry(idx: number) {
    setEntries((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateName(idx: number, name: string) {
    setEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, name } : e)));
  }

  function updateZipMode(idx: number, mode: ZipMode) {
    setEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, zipMode: mode } : e)));
  }

  // ── Drag-and-drop ───────────────────────────────────────────────────────────

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) addFiles(e.target.files);
    // Reset so the same file(s) can be re-selected after removal
    e.target.value = "";
  }

  // ── Upload ──────────────────────────────────────────────────────────────────

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (entries.length === 0 || uploading) return;

    setUploading(true);
    const uploaded: Asset[] = [];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (entry.status === "done") {
        if (entry.asset) uploaded.push(entry.asset);
        if (entry.zipResult) uploaded.push(...entry.zipResult.assets);
        continue;
      }

      setEntries((prev) =>
        prev.map((e, idx) => (idx === i ? { ...e, status: "uploading", error: undefined } : e))
      );

      try {
        const zipMode = entry.zipMode ?? "contents-only";

        if (isZip(entry.file) && zipMode !== "zip-only") {
          // ── ZIP contents processing (contents-only or zip-and-contents) ──
          const result = await uploadZip(entry.file, token);

          if (zipMode === "zip-and-contents") {
            // Also upload the ZIP file itself as an asset and assign the root category.
            const rootCat = result.categories[0];
            const zipMeta = await createAsset(
              {
                name: entry.name.trim() || entry.file.name,
                asset_type: entry.mimeType,
                description: description || null,
                caption: caption || null,
                keywords: keywords || null,
                creator: creator || null,
                copyright_notice: copyrightNotice || null,
              },
              token
            );
            const zipAsset = await uploadFile(zipMeta.id, entry.file, token);
            if (rootCat) {
              await addCategoryToAsset(zipAsset.id, rootCat.id, token);
            }
            // Augment the result so the parent's assetCategories map is updated for the ZIP asset too.
            const augmented: ZipUploadResult = {
              ...result,
              asset_category_ids: {
                ...result.asset_category_ids,
                [zipAsset.id]: rootCat ? [rootCat.id] : [],
              },
            };
            onZipResult?.(augmented);
            setEntries((prev) =>
              prev.map((e, idx) => (idx === i ? { ...e, status: "done", zipResult: result, asset: zipAsset } : e))
            );
            uploaded.push(zipAsset, ...result.assets);
          } else {
            // contents-only
            onZipResult?.(result);
            setEntries((prev) =>
              prev.map((e, idx) => (idx === i ? { ...e, status: "done", zipResult: result } : e))
            );
            uploaded.push(...result.assets);
          }
        } else {
          // ── Regular file (or ZIP in zip-only mode): two-step create + upload ──
          const asset = await createAsset(
            {
              name: entry.name.trim() || entry.file.name,
              asset_type: entry.mimeType,
              description: description || null,
              caption: caption || null,
              keywords: keywords || null,
              creator: creator || null,
              copyright_notice: copyrightNotice || null,
            },
            token
          );

          const final = await uploadFile(asset.id, entry.file, token);

          setEntries((prev) =>
            prev.map((e, idx) => (idx === i ? { ...e, status: "done", asset: final } : e))
          );
          uploaded.push(final);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        setEntries((prev) =>
          prev.map((e, idx) => (idx === i ? { ...e, status: "error", error: msg } : e))
        );
      }
    }

    setUploading(false);
    setAllDone(true);
    if (uploaded.length > 0) onComplete(uploaded);
  }

  function handleBackdrop(e: React.MouseEvent) {
    if (e.target === e.currentTarget && !uploading) onClose();
  }

  const pendingCount = entries.filter((e) => e.status === "pending" || e.status === "error").length;
  const doneCount = entries.filter((e) => e.status === "done").length;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleBackdrop}
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <h2 className="font-bold text-slate-800">
            Upload Assets
            {entries.length > 0 && (
              <span className="ml-2 text-sm font-normal text-slate-500">
                {entries.length} file{entries.length !== 1 ? "s" : ""} selected
              </span>
            )}
          </h2>
          {!uploading && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 transition-colors text-xl leading-none"
            >
              ×
            </button>
          )}
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">

          {/* Drop zone */}
          {!allDone && (
            <div
              className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
                dragging
                  ? "border-blue-400 bg-blue-50"
                  : entries.length > 0
                  ? "border-blue-300 bg-blue-50/50"
                  : "border-slate-300 hover:border-blue-400 hover:bg-slate-50"
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileInput}
              />
              {entries.length > 0 ? (
                <p className="text-sm text-blue-600 font-medium">
                  Drop more files or click to add
                </p>
              ) : (
                <div>
                  <p className="text-2xl mb-2">📁</p>
                  <p className="text-sm text-slate-600">
                    Drop files here or{" "}
                    <span className="text-blue-700 font-medium">click to browse</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-1">You can select multiple files</p>
                </div>
              )}
            </div>
          )}

          {/* File list */}
          {entries.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Files</p>
              <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                {entries.map((entry, idx) => (
                  <div key={idx} className="flex flex-col px-3 py-2 bg-white gap-1">
                    {/* Main row */}
                    <div className="flex items-center gap-2">
                      <StatusIcon status={entry.status} />

                      {/* Editable name */}
                      <input
                        value={entry.name}
                        onChange={(e) => updateName(idx, e.target.value)}
                        disabled={uploading || entry.status === "done"}
                        className="flex-1 min-w-0 text-xs text-slate-700 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-400 focus:outline-none py-0.5 disabled:hover:border-transparent"
                        title="Click to rename"
                      />

                      {/* MIME + size */}
                      <span className="shrink-0 text-[10px] text-slate-400 hidden sm:block">
                        {entry.mimeType}
                      </span>
                      <span className="shrink-0 text-[10px] text-slate-400 w-14 text-right">
                        {formatSize(entry.file.size)}
                      </span>

                      {/* Status label / error */}
                      {entry.status === "uploading" && (
                        <span className="shrink-0 text-[10px] text-blue-600">
                          {isZip(entry.file) && entry.zipMode !== "zip-only" ? "Processing ZIP…" : "Uploading…"}
                        </span>
                      )}
                      {entry.status === "done" && entry.zipResult && (
                        <span className="shrink-0 text-[10px] text-green-600">
                          {entry.zipMode === "zip-and-contents" && "ZIP + "}
                          {entry.zipResult.assets.length} assets · {entry.zipResult.categories.length} categories
                          {entry.zipResult.errors.length > 0 && (
                            <span className="text-amber-500"> · {entry.zipResult.errors.length} errors</span>
                          )}
                        </span>
                      )}
                      {entry.status === "done" && !entry.zipResult && (
                        <span className="shrink-0 text-[10px] text-green-600">Done</span>
                      )}
                      {entry.status === "error" && (
                        <span className="shrink-0 text-[10px] text-red-500 max-w-[120px] truncate" title={entry.error}>
                          {entry.error}
                        </span>
                      )}

                      {/* Remove button */}
                      {!uploading && entry.status !== "done" && (
                        <button
                          onClick={() => removeEntry(idx)}
                          className="shrink-0 text-slate-300 hover:text-red-400 transition-colors text-base leading-none ml-1"
                          title="Remove"
                        >
                          ×
                        </button>
                      )}
                    </div>

                    {/* ZIP mode selector — shown below the main row for pending/error ZIPs */}
                    {isZip(entry.file) && !uploading && entry.status !== "done" && (
                      <div className="flex items-center gap-1 ml-5">
                        {ZIP_MODE_OPTIONS.map(({ mode, label, title }) => (
                          <button
                            key={mode}
                            type="button"
                            title={title}
                            onClick={() => updateZipMode(idx, mode)}
                            className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                              (entry.zipMode ?? "contents-only") === mode
                                ? "bg-blue-700 text-white border-blue-700"
                                : "text-slate-500 border-slate-200 hover:border-blue-300 hover:text-blue-600"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Shared metadata — shown whenever at least one file will be stored as an asset
               (regular files, zip-only ZIPs, and zip-and-contents ZIPs all receive metadata) */}
          {!allDone && entries.some((e) => !isZip(e.file) || (e.zipMode ?? "contents-only") !== "contents-only") && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Shared metadata {entries.length > 1 && <span className="font-normal normal-case">(applied to all files)</span>}
              </p>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className={`${inputCls} resize-none`}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">Caption</label>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={2}
                  className={`${inputCls} resize-none`}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">Keywords</label>
                <input
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  className={inputCls}
                  placeholder="comma-separated"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700">Creator</label>
                  <input value={creator} readOnly className={`${inputCls} bg-slate-50 text-slate-500 cursor-default`} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700">Copyright</label>
                  <input value={copyrightNotice} onChange={(e) => setCopyrightNotice(e.target.value)} className={inputCls} />
                </div>
              </div>

              {categories.length > 0 && (
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700">Categories</label>
                  <div className="flex flex-wrap gap-2 p-2 border border-slate-300 rounded-lg min-h-[40px]">
                    {categories.map((cat) => {
                      const checked = selectedCategoryIds.includes(cat.id);
                      return (
                        <label
                          key={cat.id}
                          className={`inline-flex items-center gap-1.5 cursor-pointer text-xs px-2 py-1 rounded-full border transition-colors ${
                            checked
                              ? "bg-blue-100 border-blue-300 text-blue-700"
                              : "bg-slate-50 border-slate-200 text-slate-600 hover:border-blue-200"
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="hidden"
                            checked={checked}
                            onChange={(e) =>
                              setSelectedCategoryIds((prev) =>
                                e.target.checked
                                  ? [...prev, cat.id]
                                  : prev.filter((id) => id !== cat.id)
                              )
                            }
                          />
                          {cat.name}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* All-done summary */}
          {allDone && (
            <div className={`rounded-lg px-4 py-3 text-sm font-medium ${
              doneCount === entries.length
                ? "bg-green-50 border border-green-200 text-green-700"
                : "bg-amber-50 border border-amber-200 text-amber-700"
            }`}>
              {doneCount === entries.length
                ? `All ${doneCount} file${doneCount !== 1 ? "s" : ""} uploaded successfully.`
                : `${doneCount} of ${entries.length} files uploaded. ${entries.length - doneCount} failed.`}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 shrink-0 flex gap-3">
          {allDone ? (
            <button
              onClick={onClose}
              className="flex-1 bg-blue-700 hover:bg-blue-800 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
            >
              Close
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={uploading}
                className="flex-1 border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50 font-medium py-2.5 rounded-lg transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading || entries.filter(e => e.status !== "done").length === 0}
                className="flex-1 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
              >
                {uploading
                  ? `Uploading ${entries.filter(e => e.status === "uploading").map((_, i) => i + 1)[0] ?? "…"}/${entries.length}…`
                  : pendingCount > 0
                  ? `Upload ${pendingCount} file${pendingCount !== 1 ? "s" : ""}`
                  : "Upload"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
