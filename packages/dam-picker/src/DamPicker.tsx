"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createDamClient } from "./api";
import type { Asset, AssetWithCategories, Category, PickedAsset } from "./api";
import PickerTree from "./PickerTree";
import PickerGrid from "./PickerGrid";

type SortField = "name" | "asset_type" | "created_at" | "size";
type SortDir = "asc" | "desc";

export interface DamPickerProps {
  apiBase: string;
  token: string;
  username?: string;
  onSelect: (asset: PickedAsset) => void;
  onDragStart?: (asset: PickedAsset, e: React.DragEvent) => void;
  filter?: (asset: Asset) => boolean;
}

export default function DamPicker({ apiBase, token, username, onSelect, onDragStart, filter }: DamPickerProps) {
  const client = useMemo(() => createDamClient(apiBase, token), [apiBase, token]);

  // ── Server-driven state ───────────────────────────────────────────────────────
  const [assets, setAssets] = useState<AssetWithCategories[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Resizable category panel ──────────────────────────────────────────────────
  const TREE_MIN = 120;
  const TREE_MAX = 400;
  const TREE_DEFAULT = 208;
  const [treeWidth, setTreeWidth] = useState(TREE_DEFAULT);
  const dragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    dragStartX.current = e.clientX;
    dragStartWidth.current = treeWidth;

    function onMouseMove(ev: MouseEvent) {
      if (!dragging.current) return;
      const delta = ev.clientX - dragStartX.current;
      setTreeWidth(Math.min(TREE_MAX, Math.max(TREE_MIN, dragStartWidth.current + delta)));
    }
    function onMouseUp() {
      dragging.current = false;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [treeWidth]);

  const visibleCategories = useMemo(
    () => categories.filter((c) => !c.creator || c.creator === username || c.access_level === "Global"),
    [categories, username]
  );

  // ── Search debounce ───────────────────────────────────────────────────────────

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ── Reset to page 1 on filter/sort change ─────────────────────────────────────

  useEffect(() => { setPage(1); }, [selectedCategoryId, debouncedSearch, sortField, sortDir]);

  // ── Load categories once ──────────────────────────────────────────────────────

  useEffect(() => {
    client.listCategories().then(setCategories).catch(() => {});
  }, [client]);

  // ── Fetch asset page ──────────────────────────────────────────────────────────

  const fetchAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const idle = selectedCategoryId === undefined && !debouncedSearch;
    if (idle) {
      setAssets([]);
      setTotal(0);
      setLoading(false);
      return;
    }

    fetchAbortRef.current?.abort();
    fetchAbortRef.current = new AbortController();

    if (page === 1) setLoading(true);
    else setRefreshing(true);
    setError(null);

    client
      .listAssets({
        categoryId: typeof selectedCategoryId === "string" ? selectedCategoryId : undefined,
        q: debouncedSearch || undefined,
        sortField,
        sortDir,
        page,
        perPage,
      })
      .then((data) => {
        setAssets(data.items);
        setTotal(data.total);
        setLoading(false);
        setRefreshing(false);
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load assets.");
        setLoading(false);
        setRefreshing(false);
      });

    return () => { fetchAbortRef.current?.abort(); };
  }, [client, selectedCategoryId, debouncedSearch, sortField, sortDir, page, perPage]);

  // ── Apply optional host-side filter (e.g. images-only) ───────────────────────
  const visibleAssets = useMemo(
    () => (filter ? assets.filter(filter) : assets),
    [assets, filter]
  );

  const toPickedAsset = useCallback(
    (asset: Asset): PickedAsset => ({
      id: asset.id,
      name: asset.name,
      assetType: asset.asset_type,
      size: asset.size,
      url: client.assetUrl(asset.id),
      thumbnailUrl: client.thumbnailUrl(asset.id),
    }),
    [client]
  );

  function handleSelect(picked: PickedAsset) {
    setSelectedAssetId(picked.id);
    onSelect(picked);
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading && assets.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400 text-sm">
        Loading assets…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-red-600 text-sm p-4 text-center">
        {error}
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden bg-white">
      {/* Category tree */}
      <aside className="shrink-0 overflow-y-auto p-2 relative" style={{ width: treeWidth }}>
        <PickerTree
          categories={visibleCategories}
          selectedId={selectedCategoryId}
          onSelect={setSelectedCategoryId}
        />
      </aside>

      {/* Resize handle */}
      <div
        className="shrink-0 w-1.5 cursor-col-resize bg-slate-200 hover:bg-[var(--tdam-400,#60a5fa)] transition-colors"
        onMouseDown={onResizeMouseDown}
      />

      {/* Search + grid */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="shrink-0 px-4 py-3 border-b border-slate-200 bg-white flex items-center gap-2">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search assets…"
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-[var(--tdam-500,#3b82f6)] focus:outline-none focus:ring-1 focus:ring-[var(--tdam-500,#3b82f6)]"
          />
          <button
            type="button"
            onClick={() => setPage((p) => p)} // force re-fetch via identity bump
            disabled={refreshing}
            title="Refresh"
            className="shrink-0 p-1.5 rounded-lg border border-slate-300 text-slate-500 hover:text-[var(--tdam-600,#2563eb)] hover:border-[var(--tdam-400,#60a5fa)] disabled:opacity-40 transition-colors bg-white"
          >
            <svg
              className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        <PickerGrid
          assets={visibleAssets}
          total={filter ? visibleAssets.length : total}
          page={page}
          perPage={perPage}
          sortField={sortField}
          sortDir={sortDir}
          isIdle={selectedCategoryId === undefined && !searchQuery}
          hasFilter={typeof selectedCategoryId === "string" || !!debouncedSearch}
          selectedAssetId={selectedAssetId}
          getThumbnailUrl={client.thumbnailUrl}
          toPickedAsset={toPickedAsset}
          onSelect={handleSelect}
          onDragStart={onDragStart}
          onPageChange={setPage}
          onSortChange={(field, dir) => { setSortField(field); setSortDir(dir); }}
        />
      </div>
    </div>
  );
}
