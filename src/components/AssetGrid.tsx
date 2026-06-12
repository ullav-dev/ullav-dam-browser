"use client";

import { useState, useRef } from "react";
import type { Asset, AssetWithCategories } from "@/lib/dam-api";
import { thumbnailUrl } from "@/lib/dam-api";
import { useTranslations } from "next-intl";
import ImageEditorModal from "@/components/ImageEditorModal";

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50];

export type SortField = "name" | "asset_type" | "created_at" | "size";
export type SortDir = "asc" | "desc";

function totalPages(count: number, size: number) {
  return Math.max(1, Math.ceil(count / size));
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function typeInfo(raw: string): { label: string; cls: string } {
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

function AssetTypeBadge({ type }: { type: string }) {
  const { label, cls } = typeInfo(type);
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${cls}`}>
      {label}
    </span>
  );
}

function ThumbnailImage({ id, name, assetType, updatedAt }: { id: string; name: string; assetType: string; updatedAt: string }) {
  const [imgState, setImgState] = useState<"loading" | "ok" | "error">("loading");
  const { label, cls } = typeInfo(assetType);
  const src = `${thumbnailUrl(id)}?v=${encodeURIComponent(updatedAt)}`;

  return (
    <>
      <img
        src={src}
        alt={name}
        className={`w-full h-full object-cover transition-opacity duration-150 ${imgState === "ok" ? "opacity-100" : "opacity-0 absolute inset-0"}`}
        onLoad={() => setImgState("ok")}
        onError={() => setImgState("error")}
      />
      {imgState === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 gap-1.5">
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${cls}`}>{label}</span>
        </div>
      )}
    </>
  );
}

function IconLock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  );
}

function IconEditImage() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  );
}

interface Props {
  // Server-driven data — the grid is a pure render layer
  assets: AssetWithCategories[];
  total: number;
  page: number;
  perPage: number;
  sortField: SortField;
  sortDir: SortDir;
  myAssetsOnly: boolean;
  /** true when no category is selected and no search is active → show "select a category" prompt */
  isIdle: boolean;
  /** true when a filter is active (category or search) — controls noResults vs noAssets wording */
  hasFilter: boolean;
  selectedAssetId: string | null;
  lockedIds: Set<string>;
  username?: string;
  userId?: string;
  token?: string;
  onSelect: (asset: AssetWithCategories) => void;
  onDragStart: (assetId: string) => void;
  onDragEnd: () => void;
  onAssetCreated?: (asset: Asset, categoryIds: string[]) => void;
  onAssetUpdated?: (asset: Asset) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onSortChange: (field: SortField, dir: SortDir) => void;
  onMyAssetsToggle: () => void;
  // Multi-select
  selectedAssetIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onRangeSelect?: (ids: string[]) => void;
  onSelectAll?: (pageIds: string[]) => void;
}

export default function AssetGrid({
  assets,
  total,
  page,
  perPage,
  sortField,
  sortDir,
  myAssetsOnly,
  isIdle,
  hasFilter,
  selectedAssetId,
  lockedIds,
  username,
  userId,
  token,
  onSelect,
  onDragStart,
  onDragEnd,
  onAssetCreated,
  onAssetUpdated,
  onPageChange,
  onPageSizeChange,
  onSortChange,
  onMyAssetsToggle,
  selectedAssetIds,
  onToggleSelect,
  onRangeSelect,
  onSelectAll,
}: Props) {
  const t = useTranslations("assetGrid");
  const [editingAsset, setEditingAsset] = useState<{ asset: Asset; categoryIds: string[] } | null>(null);
  const lastCheckedId = useRef<string | null>(null);

  const SORT_OPTIONS: { field: SortField; label: string }[] = [
    { field: "name",       label: t("sortName") },
    { field: "asset_type", label: t("sortType") },
    { field: "created_at", label: t("sortDate") },
    { field: "size",       label: t("sortSize") },
  ];

  function handleSortField(field: SortField) {
    if (field === sortField) {
      onSortChange(field, sortDir === "asc" ? "desc" : "asc");
    } else {
      onSortChange(field, "asc");
    }
  }

  function handleCheckboxClick(e: React.MouseEvent, asset: AssetWithCategories) {
    e.stopPropagation();
    if (!onToggleSelect) return;

    if (e.shiftKey && lastCheckedId.current && onRangeSelect) {
      const lastIdx = assets.findIndex((a) => a.id === lastCheckedId.current);
      const thisIdx = assets.findIndex((a) => a.id === asset.id);
      if (lastIdx !== -1 && thisIdx !== -1) {
        const [lo, hi] = lastIdx < thisIdx ? [lastIdx, thisIdx] : [thisIdx, lastIdx];
        onRangeSelect(assets.slice(lo, hi + 1).map((a) => a.id));
        lastCheckedId.current = asset.id;
        return;
      }
    }

    onToggleSelect(asset.id);
    lastCheckedId.current = asset.id;
  }

  const numPages = totalPages(total, perPage);
  const allPageSelected = assets.length > 0 && assets.every((a) => selectedAssetIds?.has(a.id));
  const somePageSelected = !allPageSelected && assets.some((a) => selectedAssetIds?.has(a.id));

  if (isIdle) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
        {t("emptyPrompt")}
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
        {hasFilter ? t("noResults") : t("noAssets")}
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
        {onToggleSelect && onSelectAll && (
          <>
            <input
              type="checkbox"
              title={t("selectAllOnPage")}
              checked={allPageSelected}
              ref={(el) => { if (el) el.indeterminate = somePageSelected; }}
              onChange={() => onSelectAll(assets.map((a) => a.id))}
              className="rounded border-slate-300 text-blue-600 cursor-pointer"
            />
            <span className="w-px h-3 bg-slate-200 mx-0.5" />
          </>
        )}
        <span className="text-[11px] text-slate-400 mr-1">{t("sortLabel")}</span>
        {SORT_OPTIONS.map(({ field, label }) => {
          const active = sortField === field;
          return (
            <button
              key={field}
              onClick={() => handleSortField(field)}
              className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors ${
                active
                  ? "bg-blue-700 text-white border-blue-700"
                  : "text-slate-500 border-slate-200 hover:border-blue-300 hover:text-blue-600"
              }`}
            >
              {label}
              {active && (
                <span className="ml-0.5">{sortDir === "asc" ? "▲" : "▼"}</span>
              )}
            </button>
          );
        })}
        {username && (
          <>
            <span className="w-px h-3 bg-slate-200 mx-0.5" />
            <button
              onClick={onMyAssetsToggle}
              className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors ${
                myAssetsOnly
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "text-slate-500 border-slate-200 hover:border-emerald-400 hover:text-emerald-600"
              }`}
            >
              {t("myAssets")}
            </button>
          </>
        )}
      </div>

      {/* Asset grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
          {assets.map((asset) => {
            const isChecked = selectedAssetIds?.has(asset.id) ?? false;
            return (
              <div
                key={asset.id}
                draggable
                onClick={() => onSelect(asset)}
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "copy";
                  e.dataTransfer.setData("text/plain", asset.id);
                  onDragStart(asset.id);
                }}
                onDragEnd={onDragEnd}
                className={`cursor-grab active:cursor-grabbing rounded-xl border overflow-hidden transition-all hover:shadow-md group ${
                  isChecked
                    ? "border-blue-500 ring-2 ring-blue-300 shadow-md bg-blue-50/30"
                    : selectedAssetId === asset.id
                    ? "border-blue-500 ring-2 ring-blue-200 shadow-md"
                    : "border-slate-200 hover:border-blue-300"
                }`}
              >
                <div className="aspect-square bg-slate-100 relative overflow-hidden">
                  <ThumbnailImage id={asset.id} name={asset.name} assetType={asset.asset_type} updatedAt={asset.updated_at} />
                  {!asset.available && (
                    <div className="absolute top-1.5 right-1.5 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                      {t("unavailable")}
                    </div>
                  )}
                  {asset.asset_type.startsWith("image/") && token && onAssetCreated && onAssetUpdated && (
                    <button
                      type="button"
                      title={t("editImage")}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingAsset({ asset, categoryIds: asset.categories.map((c) => c.id) });
                      }}
                      className="absolute top-1.5 left-1.5 opacity-0 group-hover:opacity-100 bg-white/90 hover:bg-white text-blue-700 rounded-lg p-1 shadow transition-opacity"
                    >
                      <IconEditImage />
                    </button>
                  )}
                  {onToggleSelect && (
                    <button
                      type="button"
                      title={t("selectAsset")}
                      onClick={(e) => handleCheckboxClick(e, asset)}
                      className={`absolute top-1.5 right-1.5 rounded p-0.5 shadow transition-opacity ${
                        isChecked
                          ? "opacity-100 bg-blue-600 text-white"
                          : "opacity-0 group-hover:opacity-100 bg-white/90 hover:bg-white text-slate-500"
                      }`}
                    >
                      <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                        {isChecked
                          ? <path d="M2 2h12v12H2V2zm10 3.5L7 11 4.5 8.5l1-1L7 9l4-4 1 1.5z" />
                          : <path fillRule="evenodd" d="M2 2h12v12H2V2zm1 1v10h10V3H3z" />
                        }
                      </svg>
                    </button>
                  )}
                </div>
                <div className="p-2 bg-white">
                  <p className="text-xs font-medium text-slate-700 truncate mb-1" title={asset.name}>
                    {asset.name}
                  </p>
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1 min-w-0">
                      <AssetTypeBadge type={asset.asset_type} />
                      {lockedIds.has(asset.id) && (
                        <span
                          title="Locked"
                          className="inline-flex items-center gap-0.5 bg-amber-100 text-amber-600 text-[10px] font-medium px-1 py-0.5 rounded"
                        >
                          <IconLock />
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0">{formatSize(asset.size)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Image editor modal */}
      {editingAsset && token && username && onAssetCreated && onAssetUpdated && (
        <ImageEditorModal
          asset={editingAsset.asset}
          assetCategoryIds={editingAsset.categoryIds}
          token={token}
          username={username}
          onClose={() => setEditingAsset(null)}
          onAssetCreated={(newAsset, catIds) => {
            onAssetCreated(newAsset, catIds);
            setEditingAsset(null);
          }}
          onAssetUpdated={(updated) => {
            onAssetUpdated(updated);
            setEditingAsset(null);
          }}
        />
      )}

      {/* Pagination bar */}
      {numPages > 1 && (
        <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>{t("paginationShow")}</span>
            <select
              value={perPage}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="rounded border border-slate-300 px-1.5 py-0.5 text-xs focus:border-blue-500 focus:outline-none bg-white"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <span>{t("paginationPerPage", { count: total })}</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-2 py-1 rounded text-xs text-slate-600 border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {t("paginationPrev")}
            </button>

            {pageNumbers.map((item, idx) =>
              item === "…" ? (
                <span key={`ellipsis-${idx}`} className="px-1.5 text-xs text-slate-400">…</span>
              ) : (
                <button
                  key={item}
                  onClick={() => onPageChange(item)}
                  className={`min-w-[28px] px-2 py-1 rounded text-xs border transition-colors ${
                    item === page
                      ? "bg-blue-700 text-white border-blue-700 font-medium"
                      : "text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {item}
                </button>
              )
            )}

            <button
              onClick={() => onPageChange(Math.min(numPages, page + 1))}
              disabled={page === numPages}
              className="px-2 py-1 rounded text-xs text-slate-600 border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {t("paginationNext")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
