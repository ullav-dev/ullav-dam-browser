"use client";

import { useState, useRef, useCallback } from "react";
import type { Asset, Category } from "@/lib/dam-api";
import { createAsset, uploadFile } from "@/lib/dam-api";

const inputCls =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm w-full focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

// Representative MIME types used when no file is selected or the browser
// cannot detect the type. The server checks asset_type.starts_with("image/")
// to decide whether to generate a real thumbnail, so these must be real MIME types.
const ASSET_TYPE_OPTIONS = [
  { label: "Image",        value: "image/jpeg" },
  { label: "Video",        value: "video/mp4" },
  { label: "Audio",        value: "audio/mpeg" },
  { label: "PDF",          value: "application/pdf" },
  { label: "Document",     value: "application/msword" },
  { label: "Spreadsheet",  value: "application/vnd.ms-excel" },
  { label: "Presentation", value: "application/vnd.ms-powerpoint" },
  { label: "Archive",      value: "application/zip" },
  { label: "Other",        value: "application/octet-stream" },
];

interface Props {
  token: string;
  categories: Category[];
  onComplete: (asset: Asset) => void;
  onClose: () => void;
}

export default function UploadModal({ token, categories, onComplete, onClose }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [name, setName] = useState("");
  const [assetType, setAssetType] = useState("image/jpeg");
  const [description, setDescription] = useState("");
  const [caption, setCaption] = useState("");
  const [keywords, setKeywords] = useState("");
  const [creator, setCreator] = useState("");
  const [copyrightNotice, setCopyrightNotice] = useState("");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    if (!name) {
      setName(f.name.replace(/\.[^.]+$/, ""));
    }
    // Use the full MIME type from the browser so the server can generate a
    // real thumbnail (it checks asset_type.starts_with("image/")).
    if (f.type) setAssetType(f.type);
  }, [name]);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return setError("Please select a file.");
    if (!name.trim()) return setError("Name is required.");
    setError(null);
    setUploading(true);

    try {
      setProgress("Creating asset record…");
      const asset = await createAsset(
        {
          name: name.trim(),
          asset_type: assetType,
          description: description || null,
          caption: caption || null,
          keywords: keywords || null,
          creator: creator || null,
          copyright_notice: copyrightNotice || null,
        },
        token
      );

      setProgress("Uploading file…");
      const uploaded = await uploadFile(asset.id, file, token);

      setProgress("Done!");
      onComplete(uploaded);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
      setUploading(false);
      setProgress(null);
    }
  }

  function handleBackdrop(e: React.MouseEvent) {
    if (e.target === e.currentTarget && !uploading) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleBackdrop}
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <h2 className="font-bold text-slate-800">Upload Asset</h2>
          {!uploading && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 transition-colors text-xl leading-none"
            >
              ×
            </button>
          )}
        </div>

        <div className="overflow-y-auto px-6 py-4 flex-1">
          <form onSubmit={handleUpload} className="space-y-4" id="upload-form">
            {/* Drop zone */}
            <div
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                dragging
                  ? "border-blue-400 bg-blue-50"
                  : file
                  ? "border-blue-300 bg-blue-50"
                  : "border-slate-300 hover:border-blue-400 hover:bg-slate-50"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileInput}
              />
              {file ? (
                <div>
                  <p className="font-medium text-slate-700 text-sm">{file.name}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {(file.size / 1024).toFixed(1)} KB · {file.type || "unknown type"}
                  </p>
                  <p className="text-xs text-blue-600 mt-2">Click to change file</p>
                </div>
              ) : (
                <div>
                  <p className="text-2xl mb-2">📁</p>
                  <p className="text-sm text-slate-600">
                    Drop a file here or{" "}
                    <span className="text-blue-700 font-medium">click to browse</span>
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Name *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className={inputCls}
                placeholder="Asset name"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Type</label>
              {file && file.type ? (
                // Show the browser-detected MIME type; allow manual override via text
                <input
                  value={assetType}
                  onChange={(e) => setAssetType(e.target.value)}
                  className={inputCls}
                  placeholder="MIME type, e.g. image/png"
                />
              ) : (
                <select
                  value={assetType}
                  onChange={(e) => setAssetType(e.target.value)}
                  className={inputCls}
                >
                  {ASSET_TYPE_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              )}
            </div>

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
                <input
                  value={creator}
                  onChange={(e) => setCreator(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">Copyright</label>
                <input
                  value={copyrightNotice}
                  onChange={(e) => setCopyrightNotice(e.target.value)}
                  className={inputCls}
                />
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
                          onChange={(e) => {
                            setSelectedCategoryIds((prev) =>
                              e.target.checked
                                ? [...prev, cat.id]
                                : prev.filter((id) => id !== cat.id)
                            );
                          }}
                        />
                        {cat.name}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-red-700 text-sm">
                {error}
              </div>
            )}

            {uploading && progress && (
              <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-blue-700 text-sm flex items-center gap-2">
                <span className="animate-spin">⏳</span> {progress}
              </div>
            )}
          </form>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 shrink-0 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="flex-1 border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50 font-medium py-2.5 rounded-lg transition-colors text-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="upload-form"
            disabled={uploading || !file || !name.trim()}
            className="flex-1 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
          >
            {uploading ? "Uploading…" : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
}
