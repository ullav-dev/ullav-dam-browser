"use client";

import { useState, useEffect } from "react";
import type { AssetWithCategories, Category, Asset } from "@/lib/dam-api";
import {
  updateAsset,
  deleteAsset,
  addCategoryToAsset,
  removeCategoryFromAsset,
  downloadUrl,
} from "@/lib/dam-api";

const inputCls =
  "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm w-full focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

const labelCls = "text-xs font-medium text-slate-500 uppercase tracking-wide";

// ── Icons ─────────────────────────────────────────────────────────────────────

function IconDownload() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  );
}

function IconLocked() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  );
}

function IconUnlocked() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
    </svg>
  );
}

function IconTrash() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
      <line x1="10" y1="11" x2="10" y2="17"/>
      <line x1="14" y1="11" x2="14" y2="17"/>
    </svg>
  );
}

// ── Field helper ──────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className={labelCls}>{label}</p>
      {children}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  asset: AssetWithCategories;
  categories: Category[];
  token: string;
  isLocked: boolean;
  onToggleLock: () => void;
  onUpdated: (asset: Asset) => void;
  onDeleted: (id: string) => void;
  onCategoriesChanged: (cats: Category[]) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

export default function AssetDetails({
  asset,
  categories,
  token,
  isLocked,
  onToggleLock,
  onUpdated,
  onDeleted,
  onCategoriesChanged,
  onDragStart,
  onDragEnd,
}: Props) {
  // Form state
  const [name, setName] = useState(asset.name);
  const [description, setDescription] = useState(asset.description ?? "");
  const [caption, setCaption] = useState(asset.caption ?? "");
  const [keywords, setKeywords] = useState(asset.keywords ?? "");
  const [creator, setCreator] = useState(asset.creator ?? "");
  const [copyrightNotice, setCopyrightNotice] = useState(asset.copyright_notice ?? "");
  const [available, setAvailable] = useState(asset.available);
  const [availableUntil, setAvailableUntil] = useState(
    asset.available_until ? asset.available_until.slice(0, 10) : ""
  );

  // Operation state
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  // Drag-to-remove state for category tags
  const [draggingCatId, setDraggingCatId] = useState<string | null>(null);
  const [removeZoneOver, setRemoveZoneOver] = useState(false);

  // Reset form when the selected asset changes
  useEffect(() => {
    setName(asset.name);
    setDescription(asset.description ?? "");
    setCaption(asset.caption ?? "");
    setKeywords(asset.keywords ?? "");
    setCreator(asset.creator ?? "");
    setCopyrightNotice(asset.copyright_notice ?? "");
    setAvailable(asset.available);
    setAvailableUntil(asset.available_until ? asset.available_until.slice(0, 10) : "");
    setSaveError(null);
    setSaveSuccess(false);
    setConfirmDelete(false);
    setCategoryError(null);
    setDraggingCatId(null);
    setRemoveZoneOver(false);
  }, [asset.id]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  function toggleLock() {
    onToggleLock();
    setConfirmDelete(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const updated = await updateAsset(
        asset.id,
        {
          name: name || asset.name,
          description: description || null,
          caption: caption || null,
          keywords: keywords || null,
          creator: creator || null,
          copyright_notice: copyrightNotice || null,
          available,
          available_until: availableUntil ? new Date(availableUntil).toISOString() : null,
        },
        token
      );
      onUpdated(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      await deleteAsset(asset.id, token);
      onDeleted(asset.id);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Delete failed.");
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  async function handleAddCategory(categoryId: string) {
    setCategoryError(null);
    try {
      await addCategoryToAsset(asset.id, categoryId, token);
      const cat = categories.find((c) => c.id === categoryId);
      if (cat) onCategoriesChanged([...asset.categories, cat]);
    } catch (err) {
      setCategoryError(err instanceof Error ? err.message : "Failed to add category.");
    }
  }

  async function handleRemoveCategory(categoryId: string) {
    setCategoryError(null);
    try {
      await removeCategoryFromAsset(asset.id, categoryId, token);
      onCategoriesChanged(asset.categories.filter((c) => c.id !== categoryId));
    } catch (err) {
      setCategoryError(err instanceof Error ? err.message : "Failed to remove category.");
    }
  }

  // ── Derived ─────────────────────────────────────────────────────────────────

  const assignedIds = new Set(asset.categories.map((c) => c.id));
  const availableCategories = categories.filter((c) => !assignedIds.has(c.id));

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function formatFileSize(bytes: number): string {
    if (bytes === 0) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">

      {/* ── Header ── */}
      <div className="p-4 border-b border-slate-200 shrink-0">
        <h2 className="font-semibold text-slate-800 text-sm truncate" title={asset.name}>
          {asset.name}
        </h2>
        <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
          <span>{asset.asset_type}</span>
          <span>·</span>
          <span>{formatFileSize(asset.size)}</span>
          <span>·</span>
          <span>{formatDate(asset.created_at)}</span>
          {isLocked && (
            <>
              <span>·</span>
              <span className="inline-flex items-center gap-0.5 text-amber-600 font-medium">
                <IconLocked />
                Locked
              </span>
            </>
          )}
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Thumbnail preview — draggable onto category tree */}
        <div
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = "copy";
            e.dataTransfer.setData("text/plain", asset.id);
            onDragStart();
          }}
          onDragEnd={onDragEnd}
          title="Drag onto a category to assign it"
          className="aspect-video bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing ring-0 hover:ring-2 hover:ring-blue-300 transition-shadow"
        >
          <img
            src={`/api/assets/${asset.id}/thumbnail`}
            alt={asset.name}
            className="max-w-full max-h-full object-contain pointer-events-none"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        </div>

        {/* Lock status badge — shown beneath the thumbnail */}
        {isLocked && (
          <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium px-3 py-2 rounded-lg">
            <IconLocked />
            <span>Asset is locked — deletion disabled</span>
          </div>
        )}

        {/* Edit form */}
        <form onSubmit={handleSave} className="space-y-3">
          <Field label="Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className={inputCls}
            />
          </Field>

          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className={`${inputCls} resize-none`}
            />
          </Field>

          <Field label="Caption">
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={2}
              className={`${inputCls} resize-none`}
            />
          </Field>

          <Field label="Keywords">
            <input
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="comma-separated"
              className={inputCls}
            />
          </Field>

          <Field label="Creator">
            <input
              value={creator}
              onChange={(e) => setCreator(e.target.value)}
              className={inputCls}
            />
          </Field>

          <Field label="Copyright">
            <input
              value={copyrightNotice}
              onChange={(e) => setCopyrightNotice(e.target.value)}
              className={inputCls}
            />
          </Field>

          <div className="flex items-center gap-2">
            <input
              id="available"
              type="checkbox"
              checked={available}
              onChange={(e) => setAvailable(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="available" className="text-sm text-slate-700 font-medium">
              Available
            </label>
          </div>

          {available && (
            <Field label="Available until">
              <input
                type="date"
                value={availableUntil}
                onChange={(e) => setAvailableUntil(e.target.value)}
                className={inputCls}
              />
            </Field>
          )}

          {saveError && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {saveError}
            </div>
          )}
          {saveSuccess && (
            <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              Saved successfully.
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </form>

        {/* Categories */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <p className={labelCls}>Categories</p>
          {asset.categories.length === 0 ? (
            <p className="text-xs text-slate-400">No categories assigned.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {asset.categories.map((cat) => (
                <span
                  key={cat.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", cat.id);
                    setDraggingCatId(cat.id);
                  }}
                  onDragEnd={() => {
                    setDraggingCatId(null);
                    setRemoveZoneOver(false);
                  }}
                  className={`inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-full cursor-grab active:cursor-grabbing transition-opacity ${
                    draggingCatId === cat.id ? "opacity-40" : ""
                  }`}
                  title="Drag to remove zone below, or click × to remove"
                >
                  {cat.name}
                  <button
                    onClick={() => handleRemoveCategory(cat.id)}
                    className="hover:text-red-600 transition-colors leading-none"
                    title="Remove category"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Drag-to-remove drop zone — visible only while dragging a category tag */}
          {draggingCatId !== null && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setRemoveZoneOver(true);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setRemoveZoneOver(false);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain") || draggingCatId;
                setDraggingCatId(null);
                setRemoveZoneOver(false);
                if (id) handleRemoveCategory(id);
              }}
              className={`flex items-center justify-center gap-1.5 border-2 border-dashed rounded-lg py-2 text-xs font-medium transition-colors ${
                removeZoneOver
                  ? "border-red-400 bg-red-50 text-red-600"
                  : "border-slate-300 text-slate-400"
              }`}
            >
              <span>{removeZoneOver ? "Release to remove" : "Drop here to remove category"}</span>
            </div>
          )}

          {availableCategories.length > 0 && (
            <select
              className={`${inputCls} text-xs`}
              value=""
              onChange={(e) => { if (e.target.value) handleAddCategory(e.target.value); }}
            >
              <option value="">+ Add category…</option>
              {availableCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          )}
          {categoryError && <p className="text-xs text-red-600">{categoryError}</p>}
        </div>

        {/* Metadata */}
        <div className="space-y-1 pt-2 border-t border-slate-100 text-xs text-slate-400">
          <p>ID: {asset.id}</p>
          <p>Created: {formatDate(asset.created_at)}</p>
          <p>Updated: {formatDate(asset.updated_at)}</p>
        </div>
      </div>

      {/* ── Action bar (fixed at bottom) ── */}
      {confirmDelete ? (
        <div className="shrink-0 border-t border-red-200 bg-red-50 px-4 py-3 space-y-2">
          <p className="text-xs text-red-700 font-medium text-center">
            Delete this asset? This cannot be undone.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmDelete(false)}
              className="flex-1 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium py-2 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
            >
              {deleting ? "Deleting…" : "Yes, delete"}
            </button>
          </div>
        </div>
      ) : (
        <div className="shrink-0 border-t border-slate-200 bg-white px-2 py-2 flex items-stretch">

          {/* Download */}
          <a
            href={downloadUrl(asset.id)}
            download
            title="Download asset"
            className="flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-lg text-slate-500 hover:bg-slate-50 hover:text-blue-700 transition-colors"
          >
            <IconDownload />
            <span className="text-[10px] font-medium">Download</span>
          </a>

          <div className="w-px bg-slate-200 my-1" />

          {/* Lock / Unlock */}
          <button
            onClick={toggleLock}
            title={isLocked ? "Unlock asset" : "Lock asset"}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-lg transition-colors ${
              isLocked
                ? "text-amber-600 hover:bg-amber-50"
                : "text-slate-500 hover:bg-slate-50 hover:text-amber-600"
            }`}
          >
            {isLocked ? <IconLocked /> : <IconUnlocked />}
            <span className="text-[10px] font-medium">{isLocked ? "Unlock" : "Lock"}</span>
          </button>

          <div className="w-px bg-slate-200 my-1" />

          {/* Delete */}
          <button
            onClick={handleDelete}
            disabled={isLocked}
            title={isLocked ? "Unlock the asset before deleting" : "Delete asset"}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-lg transition-colors ${
              isLocked
                ? "text-slate-300 cursor-not-allowed"
                : "text-slate-500 hover:bg-red-50 hover:text-red-600"
            }`}
          >
            <IconTrash />
            <span className="text-[10px] font-medium">Delete</span>
          </button>

        </div>
      )}
    </div>
  );
}
