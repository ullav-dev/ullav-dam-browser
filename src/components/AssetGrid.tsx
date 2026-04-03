"use client";

import { useState, useEffect, useMemo } from "react";
import type { Asset } from "@/lib/dam-api";
import { thumbnailUrl } from "@/lib/dam-api";
import { useTranslations } from "next-intl";
import ImageEditorModal from "@/components/ImageEditorModal";

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50];
const DEFAULT_PAGE_SIZE = 20;

type SortField = "name" | "asset_type" | "created_at" | "size";
type SortDir = "asc" | "desc";


function sortAssets(assets: Asset[], field: SortField, dir: SortDir): Asset[] {
  const mul = dir === "asc" ? 1 : -1;
  return [...assets].sort((a, b) => {
    let cmp = 0;
    if (field === "name") {
      cmp = a.name.localeCompare(b.name);
    } else if (field === "asset_type") {
      cmp = a.asset_type.localeCompare(b.asset_type);
    } else if (field === "created_at") {
      cmp = a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;
    } else if (field === "size") {
      cmp = a.size - b.size;
    }
    return cmp * mul;
  });
}

function totalPages(count: number, size: number) {
  return Math.max(1, Math.ceil(count / size));
}

function pageSlice<T>(items: T[], page: number, size: number): T[] {
  return items.slice((page - 1) * size, page * size);
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function typeInfo(raw: string): { label: string; cls: string } {
  const t = raw.toLowerCase();
  // Handles both full MIME types (e.g. "image/png") and legacy short names
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
  // Fall back: show the subtype portion of the MIME (e.g. "octet-stream" → "FILE")
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

  useEffect(() => {
    setImgState("loading");
  }, [updatedAt]);

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
  assets: Asset[];
  assetCategories: Map<string, string[]>;
  selectedCategoryId: string | null | undefined;
  searchQuery: string;
  selectedAssetId: string | null;
  lockedIds: Set<string>;
  username?: string;
  token?: string;
  onSelect: (asset: Asset) => void;
  onDragStart: (assetId: string) => void;
  onDragEnd: () => void;
  onAssetCreated?: (asset: Asset, categoryIds: string[]) => void;
  onAssetUpdated?: (asset: Asset) => void;
}

export default function AssetGrid({
  assets,
  assetCategories,
  selectedCategoryId,
  searchQuery,
  selectedAssetId,
  lockedIds,
  username,
  token,
  onSelect,
  onDragStart,
  onDragEnd,
  onAssetCreated,
  onAssetUpdated,
}: Props) {
  const t = useTranslations("assetGrid");
  const [editingAsset, setEditingAsset] = useState<{ asset: Asset; categoryIds: string[] } | null>(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [myAssetsOnly, setMyAssetsOnly] = useState(false);

  const SORT_OPTIONS: { field: SortField; label: string }[] = [
    { field: "name",       label: t("sortName") },
    { field: "asset_type", label: t("sortType") },
    { field: "created_at", label: t("sortDate") },
    { field: "size",       label: t("sortSize") },
  ];

  // Reset to page 1 when filters or sort changes
  useEffect(() => { setPage(1); }, [searchQuery, selectedCategoryId, pageSize, sortField, sortDir, myAssetsOnly]);

  const filtered = useMemo(() => assets.filter((asset) => {
    // undefined = nothing selected; only show results when a search is active
    if (selectedCategoryId === undefined && !searchQuery) return false;
    // Hide private assets owned by other users
    if (asset.is_private && asset.creator !== username) return false;
    if (myAssetsOnly && username && asset.creator !== username) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matches =
        asset.name.toLowerCase().includes(q) ||
        (asset.caption ?? "").toLowerCase().includes(q) ||
        (asset.keywords ?? "").toLowerCase().includes(q) ||
        (asset.creator ?? "").toLowerCase().includes(q) ||
        (asset.description ?? "").toLowerCase().includes(q);
      if (!matches) return false;
    }
    if (selectedCategoryId) {
      const cats = assetCategories.get(asset.id);
      if (cats === undefined) return true; // not loaded yet — show optimistically
      return cats.includes(selectedCategoryId);
    }
    return true;
  }), [assets, assetCategories, searchQuery, selectedCategoryId, myAssetsOnly, username]);

  const sorted = useMemo(() => sortAssets(filtered, sortField, sortDir), [filtered, sortField, sortDir]);

  const numPages = totalPages(sorted.length, pageSize);
  const safePage = Math.min(page, numPages);
  const paged = pageSlice(sorted, safePage, pageSize);

  function handleSortField(field: SortField) {
    if (field === sortField) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  if (selectedCategoryId === undefined && !searchQuery) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
        {t("emptyPrompt")}
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
        {searchQuery || selectedCategoryId ? t("noResults") : t("noAssets")}
      </div>
    );
  }

  // Build page number list with ellipsis gaps (same as clann-webapp)
  const pageNumbers = Array.from({ length: numPages }, (_, i) => i + 1)
    .filter((n) => n === 1 || n === numPages || Math.abs(n - safePage) <= 1)
    .reduce<(number | "…")[]>((acc, n, idx, arr) => {
      if (idx > 0 && n - (arr[idx - 1] as number) > 1) acc.push("…");
      acc.push(n);
      return acc;
    }, []);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Sort bar */}
      <div className="shrink-0 px-4 py-1.5 border-b border-slate-100 bg-white flex items-center gap-1.5">
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
              onClick={() => setMyAssetsOnly((v) => !v)}
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
          {paged.map((asset) => (
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
                selectedAssetId === asset.id
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
                      setEditingAsset({ asset, categoryIds: assetCategories.get(asset.id) ?? [] });
                    }}
                    className="absolute top-1.5 left-1.5 opacity-0 group-hover:opacity-100 bg-white/90 hover:bg-white text-blue-700 rounded-lg p-1 shadow transition-opacity"
                  >
                    <IconEditImage />
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
          ))}
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
          {/* Page size selector */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>{t("paginationShow")}</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="rounded border border-slate-300 px-1.5 py-0.5 text-xs focus:border-blue-500 focus:outline-none bg-white"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <span>{t("paginationPerPage", { count: sorted.length })}</span>
          </div>

          {/* Page controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
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
                  onClick={() => setPage(item)}
                  className={`min-w-[28px] px-2 py-1 rounded text-xs border transition-colors ${
                    item === safePage
                      ? "bg-blue-700 text-white border-blue-700 font-medium"
                      : "text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {item}
                </button>
              )
            )}

            <button
              onClick={() => setPage((p) => Math.min(numPages, p + 1))}
              disabled={safePage === numPages}
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
