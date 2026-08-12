"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import type { Asset, AssetWithCategories, PickedAsset } from "./api";

type SortField = "name" | "asset_type" | "created_at" | "size";
type SortDir = "asc" | "desc";

const SORT_OPTIONS: { field: SortField; label: string }[] = [
  { field: "name",       label: "Name" },
  { field: "asset_type", label: "Type" },
  { field: "created_at", label: "Date" },
  { field: "size",       label: "Size" },
];

function totalPages(count: number, size: number) {
  return Math.max(1, Math.ceil(count / size));
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function typeInfo(raw: string): { label: string; cls: string } {
  const t = raw.toLowerCase();
  if (t.startsWith("image/") || t === "image") {
    const sub = t.includes("/") ? t.split("/")[1].split("+")[0].toUpperCase() : "IMAGE";
    return { label: sub, cls: "bg-blue-100 text-blue-700" };
  }
  if (t.startsWith("video/") || t === "video")
    return { label: "VIDEO", cls: "bg-purple-100 text-purple-700" };
  if (t.startsWith("audio/") || t === "audio")
    return { label: "AUDIO", cls: "bg-green-100 text-green-700" };
  if (t === "application/pdf" || t === "pdf")
    return { label: "PDF", cls: "bg-red-100 text-red-700" };
  if (t.startsWith("text/") || t.includes("document") || t.includes("word") || t === "document")
    return { label: "DOC", cls: "bg-amber-100 text-amber-700" };
  if (t.includes("spreadsheet") || t.includes("excel") || t === "spreadsheet")
    return { label: "XLS", cls: "bg-amber-100 text-amber-700" };
  if (t.includes("presentation") || t.includes("powerpoint") || t === "presentation")
    return { label: "PPT", cls: "bg-orange-100 text-orange-700" };
  if (t.includes("iwork-pages") || t.includes("vnd.apple.pages"))
    return { label: "PAGES", cls: "bg-amber-100 text-amber-700" };
  if (t.includes("iwork-numbers") || t.includes("vnd.apple.numbers"))
    return { label: "NUMBERS", cls: "bg-green-100 text-green-700" };
  if (t.includes("iwork-keynote") || t.includes("vnd.apple.keynote"))
    return { label: "KEYNOTE", cls: "bg-blue-100 text-blue-700" };
  if (t.includes("zip") || t.includes("archive") || t === "archive")
    return { label: "ZIP", cls: "bg-slate-100 text-slate-600" };
  const sub = t.includes("/") ? t.split("/")[1].split("+")[0] : t;
  return { label: sub === "octet-stream" ? "FILE" : sub.toUpperCase(), cls: "bg-slate-100 text-slate-600" };
}

function ThumbnailImage({
  id, name, assetType, getThumbnailUrl,
}: {
  id: string; name: string; assetType: string; getThumbnailUrl: (id: string) => string;
}) {
  const [imgState, setImgState] = useState<"loading" | "ok" | "error">("loading");
  const { label, cls } = typeInfo(assetType);
  return (
    <>
      <img
        src={getThumbnailUrl(id)}
        alt={name}
        className={`w-full h-full object-cover transition-opacity duration-150 ${imgState === "ok" ? "opacity-100" : "opacity-0 absolute inset-0"}`}
        onLoad={() => setImgState("ok")}
        onError={() => setImgState("error")}
      />
      {imgState === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50">
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${cls}`}>{label}</span>
        </div>
      )}
    </>
  );
}

interface Props {
  assets: AssetWithCategories[];
  total: number;
  page: number;
  perPage: number;
  sortField: SortField;
  sortDir: SortDir;
  isIdle: boolean;
  hasFilter: boolean;
  selectedAssetId: string | null;
  getThumbnailUrl: (id: string) => string;
  toPickedAsset: (asset: Asset) => PickedAsset;
  onSelect: (asset: PickedAsset) => void;
  onDragStart?: (asset: PickedAsset, e: React.DragEvent) => void;
  onPageChange: (page: number) => void;
  onSortChange: (field: SortField, dir: SortDir) => void;
}

export default function PickerGrid({
  assets, total, page, perPage, sortField, sortDir,
  isIdle, hasFilter, selectedAssetId,
  getThumbnailUrl, toPickedAsset, onSelect, onDragStart,
  onPageChange, onSortChange,
}: Props) {
  const [hoverPreview, setHoverPreview] = useState<{ id: string; rect: DOMRect } | null>(null);

  const numPages = totalPages(total, perPage);

  function handleSortField(field: SortField) {
    if (field === sortField) {
      onSortChange(field, sortDir === "asc" ? "desc" : "asc");
    } else {
      onSortChange(field, "asc");
    }
  }

  if (isIdle) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
        Select a category or search to browse assets.
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
        {hasFilter ? "No assets match the current filter." : "No assets yet."}
      </div>
    );
  }

  const pageNumbers = Array.from({ length: numPages }, (_, i) => i + 1)
    .filter((n) => n === 1 || n === numPages || Math.abs(n - page) <= 1)
    .reduce<(number | "…")[]>((acc, n, idx, arr) => {
      if (idx > 0 && n - (arr[idx - 1] as number) > 1) acc.push("…");
      acc.push(n);
      return acc;
    }, []);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Sort bar */}
      <div className="shrink-0 px-4 py-1.5 border-b border-slate-100 bg-white flex items-center gap-1.5">
        <span className="text-[11px] text-slate-400 mr-1">Sort:</span>
        {SORT_OPTIONS.map(({ field, label }) => {
          const active = sortField === field;
          return (
            <button
              type="button"
              key={field}
              onClick={() => handleSortField(field)}
              className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors ${
                active
                  ? "bg-[var(--tdam-700,#1d4ed8)] text-white border-[var(--tdam-700,#1d4ed8)]"
                  : "text-slate-500 border-slate-200 hover:border-[var(--tdam-300,#93c5fd)] hover:text-[var(--tdam-600,#2563eb)]"
              }`}
            >
              {label}
              {active && <span className="ml-0.5">{sortDir === "asc" ? "▲" : "▼"}</span>}
            </button>
          );
        })}
      </div>

      {/* Asset grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
          {assets.map((asset) => {
            const picked = toPickedAsset(asset);
            return (
              <div
                key={asset.id}
                draggable
                onClick={() => onSelect(picked)}
                onMouseEnter={(e) => setHoverPreview({ id: asset.id, rect: e.currentTarget.getBoundingClientRect() })}
                onMouseLeave={() => setHoverPreview(null)}
                onDragStart={(e) => {
                  setHoverPreview(null);
                  const img = e.currentTarget.querySelector("img") as HTMLImageElement | null;
                  if (img && img.complete && img.naturalWidth > 0) {
                    e.dataTransfer.setDragImage(img, img.offsetWidth / 2, img.offsetHeight / 2);
                  }
                  e.dataTransfer.effectAllowed = "copy";
                  e.dataTransfer.setData("application/json", JSON.stringify(picked));
                  e.dataTransfer.setData("text/plain", picked.url);
                  e.dataTransfer.setData("text/uri-list", picked.url);
                  onDragStart?.(picked, e);
                }}
                className={`cursor-grab active:cursor-grabbing rounded-xl border overflow-hidden transition-all hover:shadow-md ${
                  selectedAssetId === asset.id
                    ? "border-[var(--tdam-500,#3b82f6)] ring-2 ring-[var(--tdam-200,#bfdbfe)] shadow-md"
                    : "border-slate-200 hover:border-[var(--tdam-300,#93c5fd)]"
                }`}
              >
                <div className="aspect-square bg-slate-100 relative overflow-hidden">
                  <ThumbnailImage
                    id={asset.id}
                    name={asset.name}
                    assetType={asset.asset_type}
                    getThumbnailUrl={getThumbnailUrl}
                  />
                  {!asset.available && (
                    <div className="absolute top-1.5 right-1.5 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                      UNAVAILABLE
                    </div>
                  )}
                </div>
                <div className="p-2 bg-white">
                  <p className="text-xs font-medium text-slate-700 truncate mb-1" title={asset.name}>
                    {asset.name}
                  </p>
                  <div className="flex items-center justify-between gap-1">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${typeInfo(asset.asset_type).cls}`}>
                      {typeInfo(asset.asset_type).label}
                    </span>
                    <span className="text-[10px] text-slate-400 shrink-0">{formatSize(asset.size)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Hover preview */}
      {hoverPreview && (() => {
        const PREVIEW = 200;
        const { rect } = hoverPreview;
        const fitsRight = rect.right + 8 + PREVIEW <= window.innerWidth;
        const left = fitsRight ? rect.right + 8 : rect.left - PREVIEW - 8;
        const top = Math.max(8, Math.min(rect.top, window.innerHeight - PREVIEW - 8));
        const style: CSSProperties = { position: "fixed", left, top, width: PREVIEW, height: PREVIEW, zIndex: 9999, pointerEvents: "none" };
        return (
          <div style={style} className="bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden">
            <img src={getThumbnailUrl(hoverPreview.id)} className="w-full h-full object-contain" alt="" />
          </div>
        );
      })()}

      {/* Pagination bar */}
      {numPages > 1 && (
        <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-2 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500">
            {total} total
          </span>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onPageChange(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-2 py-1 rounded text-xs text-slate-600 border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              ‹
            </button>

            {pageNumbers.map((item, idx) =>
              item === "…" ? (
                <span key={`ellipsis-${idx}`} className="px-1.5 text-xs text-slate-400">…</span>
              ) : (
                <button
                  type="button"
                  key={item}
                  onClick={() => onPageChange(item)}
                  className={`min-w-[28px] px-2 py-1 rounded text-xs border transition-colors ${
                    item === page
                      ? "bg-[var(--tdam-700,#1d4ed8)] text-white border-[var(--tdam-700,#1d4ed8)] font-medium"
                      : "text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {item}
                </button>
              )
            )}

            <button
              type="button"
              onClick={() => onPageChange(Math.min(numPages, page + 1))}
              disabled={page === numPages}
              className="px-2 py-1 rounded text-xs text-slate-600 border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
