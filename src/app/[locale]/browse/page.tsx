"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import CategoryTree from "@/components/CategoryTree";
import AssetGrid from "@/components/AssetGrid";
import type { SortField, SortDir } from "@/components/AssetGrid";
import AssetDetails from "@/components/AssetDetails";
import UploadModal from "@/components/UploadModal";
import ResizeHandle from "@/components/ResizeHandle";
import UsageWidget from "@/components/UsageWidget";
import * as api from "@/lib/dam-api";
import { createCategory, updateCategory, deleteCategory, downloadUrl, fetchIiifCollectionId } from "@/lib/dam-api";
import { getDescendantIds } from "@/components/CategoryTree";
import { useTranslations } from "next-intl";
import JSZip from "jszip";

function BrowsePageInner() {
  const { user, token, damAccess, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("browse");

  // ── Asset page state (server-driven) ─────────────────────────────────────────
  const [assets, setAssets] = useState<api.AssetWithCategories[]>([]);
  const [totalAssets, setTotalAssets] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [myAssetsOnly, setMyAssetsOnly] = useState(false);

  // ── Other state ───────────────────────────────────────────────────────────────
  const [categories, setCategories] = useState<api.Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<api.AssetWithCategories | null>(null);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [usage, setUsage] = useState<api.UsageInfo | null>(null);

  // Multi-select
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [bulkDeleteProgress, setBulkDeleteProgress] = useState<{ done: number; total: number } | null>(null);
  const [bulkDownloadProgress, setBulkDownloadProgress] = useState<{ done: number; total: number } | null>(null);

  // Auto-refresh
  const AUTO_REFRESH_OPTIONS = [
    { label: t("autoRefreshOff"), value: null },
    { label: "30s", value: 30_000 },
    { label: "1m", value: 60_000 },
    { label: "5m", value: 300_000 },
    { label: "10m", value: 600_000 },
  ] as const;

  const [autoRefreshMs, setAutoRefreshMs] = useState<number | null>(() => {
    try {
      const raw = localStorage.getItem("dam_auto_refresh_ms");
      if (raw === null) return null;
      const n = parseInt(raw, 10);
      return AUTO_REFRESH_OPTIONS.some((o) => o.value === n) ? n : null;
    } catch { return null; }
  });

  const handleAutoRefreshChange = useCallback((value: number | null) => {
    setAutoRefreshMs(value);
    try {
      if (value === null) localStorage.removeItem("dam_auto_refresh_ms");
      else localStorage.setItem("dam_auto_refresh_ms", String(value));
    } catch {}
  }, []);

  // Panel widths
  const [leftWidth, setLeftWidth] = useState<number>(() => {
    try { return parseInt(localStorage.getItem("dam_left_panel_width") ?? "", 10) || 224; } catch { return 224; }
  });
  const [rightWidth, setRightWidth] = useState<number>(() => {
    try { return parseInt(localStorage.getItem("dam_right_panel_width") ?? "", 10) || 288; } catch { return 288; }
  });

  const handleLeftResize = useCallback((delta: number) => {
    setLeftWidth((w) => {
      const next = Math.max(160, Math.min(480, w + delta));
      localStorage.setItem("dam_left_panel_width", String(next));
      return next;
    });
  }, []);

  const handleRightResize = useCallback((delta: number) => {
    setRightWidth((w) => {
      const next = Math.max(200, Math.min(560, w - delta));
      localStorage.setItem("dam_right_panel_width", String(next));
      return next;
    });
  }, []);

  // Lock state
  const [lockedIds, setLockedIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem("dam_locked_assets");
      if (raw) return new Set(JSON.parse(raw) as string[]);
    } catch {}
    return new Set();
  });

  const toggleLock = useCallback((id: string) => {
    setLockedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem("dam_locked_assets", JSON.stringify([...next]));
      return next;
    });
  }, []);

  // Category form
  const [showCatForm, setShowCatForm] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [newCatName, setNewCatName] = useState("");
  const [newCatParentId, setNewCatParentId] = useState<string>("");
  const [newCatAccessLevel, setNewCatAccessLevel] = useState<string>("Private");
  const [savingCat, setSavingCat] = useState(false);
  const [catError, setCatError] = useState<string | null>(null);

  const openCatForm = useCallback((parentId: string | null = null) => {
    setEditingCatId(null);
    setNewCatName("");
    setNewCatParentId(parentId ?? "");
    setNewCatAccessLevel("Private");
    setCatError(null);
    setShowCatForm(true);
  }, []);

  const openEditCatForm = useCallback((catId: string) => {
    const cat = categories.find((c) => c.id === catId);
    if (!cat) return;
    setEditingCatId(catId);
    setNewCatName(cat.name);
    setNewCatParentId(cat.parent_id ?? "");
    setNewCatAccessLevel(cat.access_level ?? "Private");
    setCatError(null);
    setShowCatForm(true);
  }, [categories]);

  const handleSaveCategory = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!token || !newCatName.trim()) return;
      setSavingCat(true);
      setCatError(null);
      try {
        if (editingCatId) {
          const updated = await updateCategory(
            editingCatId,
            { name: newCatName.trim(), parent_id: newCatParentId || null, access_level: newCatAccessLevel },
            token
          );
          setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        } else {
          const created = await createCategory(
            { name: newCatName.trim(), parent_id: newCatParentId || null, creator: user?.username ?? null, access_level: newCatAccessLevel },
            token
          );
          setCategories((prev) => [...prev, created]);
          api.getUsage(token).then(setUsage).catch(() => {});
        }
        setShowCatForm(false);
        setEditingCatId(null);
        setNewCatName("");
        setNewCatParentId("");
        setNewCatAccessLevel("Private");
      } catch (err) {
        setCatError(err instanceof Error ? err.message : "Failed to save category.");
      } finally {
        setSavingCat(false);
      }
    },
    [token, editingCatId, newCatName, newCatParentId, newCatAccessLevel, user?.username]
  );

  // Category delete
  const [deletingCatId, setDeletingCatId] = useState<string | null>(null);
  const [deletingCat, setDeletingCat] = useState(false);

  const handleRequestDeleteCat = useCallback((catId: string) => {
    setDeletingCatId(catId);
  }, []);

  const handleConfirmDeleteCat = useCallback(async () => {
    if (!token || !deletingCatId) return;
    setDeletingCat(true);
    const allIds = (() => {
      const result: string[] = [];
      const queue = [deletingCatId];
      while (queue.length > 0) {
        const id = queue.shift()!;
        result.push(id);
        for (const cat of categories) {
          if (cat.parent_id === id) queue.push(cat.id);
        }
      }
      return result.reverse();
    })();
    try {
      for (const id of allIds) {
        await deleteCategory(id, token);
      }
      const deletedSet = new Set(allIds);
      setCategories((prev) => prev.filter((c) => !deletedSet.has(c.id)));
      // Remove deleted category IDs from inline asset data
      setAssets((prev) =>
        prev.map((a) => ({
          ...a,
          categories: a.categories.filter((c) => !deletedSet.has(c.id)),
        }))
      );
      if (selectedCategoryId && deletedSet.has(selectedCategoryId)) {
        setSelectedCategoryId(undefined);
      }
      api.getUsage(token).then(setUsage).catch(() => {});
    } catch (err) {
      setCatError(err instanceof Error ? err.message : "Failed to delete category.");
    } finally {
      setDeletingCat(false);
      setDeletingCatId(null);
    }
  }, [token, deletingCatId, categories, selectedCategoryId]);

  const [draggingAssetId, setDraggingAssetId] = useState<string | null>(null);

  const handleDragStart = useCallback((assetId: string) => {
    setDraggingAssetId(assetId);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingAssetId(null);
  }, []);

  const handleMoveCategory = useCallback(
    async (id: string, newParentId: string | null) => {
      if (!token) return;
      try {
        const updated = await updateCategory(id, { parent_id: newParentId }, token);
        setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      } catch {}
    },
    [token]
  );

  const handleCopyIiifCollection = useCallback(async (id: string) => {
    try {
      const url = await fetchIiifCollectionId(id);
      await navigator.clipboard.writeText(url);
    } catch {
      // ignore — clipboard write failures are non-critical
    }
  }, []);

  const handleCategoryDrop = useCallback(
    async (assetId: string, categoryId: string) => {
      if (!token) return;
      try {
        await api.addCategoryToAsset(assetId, categoryId, token);
        const cat = categories.find((c) => c.id === categoryId);
        setAssets((prev) =>
          prev.map((a) => {
            if (a.id !== assetId) return a;
            if (a.categories.some((c) => c.id === categoryId)) return a;
            return { ...a, categories: cat ? [...a.categories, cat] : a.categories };
          })
        );
        setSelectedAsset((prev) => {
          if (!prev || prev.id !== assetId) return prev;
          if (prev.categories.some((c) => c.id === categoryId)) return prev;
          return cat ? { ...prev, categories: [...prev.categories, cat] } : prev;
        });
      } catch {}
    },
    [token, categories]
  );

  // ── Auth redirect ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isLoading && !user) router.push("/login");
  }, [isLoading, user, router]);

  // ── Search debounce (300 ms) ──────────────────────────────────────────────────

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ── Reset to page 1 when filter / sort / page-size changes ───────────────────

  useEffect(() => {
    setPage(1);
  }, [selectedCategoryId, debouncedSearch, myAssetsOnly, sortField, sortDir, perPage]);

  // ── Load categories once on login ─────────────────────────────────────────────

  useEffect(() => {
    if (!token) return;
    api.listCategories(token).then(setCategories).catch(() => {});
    if (damAccess !== "none") api.getUsage(token).then(setUsage).catch(() => {});
  }, [token, damAccess]);

  // ── Fetch asset page whenever query params change ─────────────────────────────

  const [isRefreshing, setIsRefreshing] = useState(false);
  const fetchAbortRef = useRef<AbortController | null>(null);

  const loadData = useCallback(async (silent = false) => {
    if (!token) return;

    const idle = selectedCategoryId === undefined && !debouncedSearch;
    if (idle) {
      setAssets([]);
      setTotalAssets(0);
      setLoadingAssets(false);
      return;
    }

    // Cancel any in-flight fetch
    fetchAbortRef.current?.abort();
    fetchAbortRef.current = new AbortController();

    if (silent) setIsRefreshing(true);
    else { setLoadingAssets(true); setLoadError(null); }

    try {
      const data = await api.listAssets(token, {
        categoryId: typeof selectedCategoryId === "string" ? selectedCategoryId : undefined,
        q: debouncedSearch || undefined,
        myAssets: myAssetsOnly || undefined,
        sortField,
        sortDir,
        page,
        perPage,
      });
      setAssets(data.items);
      setTotalAssets(data.total);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      if (!silent) setLoadError(err instanceof Error ? err.message : "Failed to load assets.");
    } finally {
      if (silent) setIsRefreshing(false);
      else setLoadingAssets(false);
    }
  }, [token, selectedCategoryId, debouncedSearch, myAssetsOnly, sortField, sortDir, page, perPage]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefreshMs || !token) return;
    const id = setInterval(() => loadData(true), autoRefreshMs);
    return () => clearInterval(id);
  }, [autoRefreshMs, token, loadData]);

  // ── Deep-link: open asset in details panel ────────────────────────────────────

  const deepLinkApplied = useRef(false);
  useEffect(() => {
    if (deepLinkApplied.current || !token || loadingAssets) return;
    const selectAsset    = searchParams.get("select_asset");
    const selectCategory = searchParams.get("select_category");
    if (!selectAsset && !selectCategory) return;
    deepLinkApplied.current = true;
    if (selectCategory) setSelectedCategoryId(selectCategory);
    if (selectAsset) {
      setSelectedCategoryId(null);
      api.getAsset(selectAsset, token).then(setSelectedAsset).catch(() => {});
    }
  }, [token, loadingAssets, searchParams]);

  // ── Asset event handlers ──────────────────────────────────────────────────────

  const handleSelectAsset = useCallback(
    async (asset: api.AssetWithCategories) => {
      setSelectedAsset(asset);
      if (!token) return;
      try {
        const detail = await api.getAsset(asset.id, token);
        setSelectedAsset(detail);
      } catch {}
    },
    [token]
  );

  const handleAssetUpdated = useCallback(
    async (updated: api.Asset) => {
      setAssets((prev) => prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)));
      if (token) {
        try {
          const detail = await api.getAsset(updated.id, token);
          setSelectedAsset(detail);
        } catch {
          setSelectedAsset((prev) => (prev ? { ...updated, categories: prev.categories } : null));
        }
      }
    },
    [token]
  );

  const handleAssetCreated = useCallback(
    (_asset: api.Asset, _categoryIds: string[]) => {
      // Silent reload so the new asset appears in correct sort order
      loadData(true);
    },
    [loadData]
  );

  const handleAssetDeleted = useCallback((id: string) => {
    setAssets((prev) => prev.filter((a) => a.id !== id));
    setTotalAssets((n) => Math.max(0, n - 1));
    setSelectedAsset(null);
    if (token && damAccess !== "none") api.getUsage(token).then(setUsage).catch(() => {});
  }, [token, damAccess]);

  const refreshUsage = useCallback(async () => {
    if (!token || damAccess === "none") return;
    try { setUsage(await api.getUsage(token)); } catch {}
  }, [token, damAccess]);

  // ── Categories changed on selected asset ─────────────────────────────────────

  const handleCategoriesChanged = useCallback(
    (cats: api.Category[]) => {
      if (!selectedAsset) return;
      setAssets((prev) =>
        prev.map((a) => (a.id === selectedAsset.id ? { ...a, categories: cats } : a))
      );
      setSelectedAsset((prev) => (prev ? { ...prev, categories: cats } : null));
    },
    [selectedAsset]
  );

  // ── Multi-select ──────────────────────────────────────────────────────────────

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedAssetIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleRangeSelect = useCallback((ids: string[]) => {
    setSelectedAssetIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }, []);

  const handleSelectAll = useCallback((pageIds: string[]) => {
    setSelectedAssetIds((prev) => {
      const allSelected = pageIds.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  }, []);

  const handleClearSelection = useCallback(() => setSelectedAssetIds(new Set()), []);

  const handleBulkDelete = useCallback(async () => {
    if (!token) return;
    const ids = [...selectedAssetIds];
    const toDelete = ids.filter((id) => !lockedIds.has(id));
    const skipped = ids.length - toDelete.length;
    setBulkDeleteProgress({ done: 0, total: toDelete.length });
    const failed: string[] = [];
    for (let i = 0; i < toDelete.length; i++) {
      try {
        await api.deleteAsset(toDelete[i], token);
      } catch {
        failed.push(toDelete[i]);
      }
      setBulkDeleteProgress({ done: i + 1, total: toDelete.length });
    }
    const deleted = toDelete.filter((id) => !failed.includes(id));
    setAssets((prev) => prev.filter((a) => !deleted.includes(a.id)));
    setTotalAssets((n) => Math.max(0, n - deleted.length));
    if (selectedAsset && deleted.includes(selectedAsset.id)) setSelectedAsset(null);
    setSelectedAssetIds(new Set([...failed, ...ids.filter((id) => lockedIds.has(id))]));
    setBulkDeleteProgress(null);
    setShowBulkDeleteConfirm(false);
    refreshUsage();
    if (skipped > 0 || failed.length > 0) {
      alert(t("bulkDeleteSkipped", { count: skipped + failed.length }));
    }
  }, [token, selectedAssetIds, lockedIds, selectedAsset, refreshUsage, t]);

  const handleBulkDownload = useCallback(async () => {
    if (!token) return;
    const ids = [...selectedAssetIds];

    if (ids.length === 1) {
      const a = document.createElement("a");
      a.href = downloadUrl(ids[0]);
      a.download = "";
      a.click();
      return;
    }

    setBulkDownloadProgress({ done: 0, total: ids.length });
    const zip = new JSZip();
    const usedNames = new Map<string, number>();

    for (let i = 0; i < ids.length; i++) {
      // asset may be undefined for cross-page selections — filename falls back to UUID
      const asset = assets.find((a) => a.id === ids[i]);
      try {
        const res = await fetch(downloadUrl(ids[i]), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const mimeType = asset?.asset_type || res.headers.get("content-type") || "";
        const subtype = mimeType.split("/")[1]?.split(";")[0]?.split("+")[0] ?? "bin";
        const extNorm: Record<string, string> = { jpeg: "jpg", "octet-stream": "bin", plain: "txt" };
        const ext = extNorm[subtype] ?? subtype;
        const baseName = asset?.name ?? ids[i];
        const candidate = `${baseName}.${ext}`;
        const count = (usedNames.get(candidate) ?? 0) + 1;
        usedNames.set(candidate, count);
        zip.file(count === 1 ? candidate : `${baseName} (${count}).${ext}`, blob);
      } catch {}
      setBulkDownloadProgress({ done: i + 1, total: ids.length });
    }

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const date = new Date().toISOString().slice(0, 10);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(zipBlob);
    a.download = `comad-assets-${date}.zip`;
    a.click();
    URL.revokeObjectURL(a.href);
    setBulkDownloadProgress(null);
  }, [token, selectedAssetIds, assets]);

  // ── Upload complete ───────────────────────────────────────────────────────────

  const handleUploadComplete = useCallback(
    async (uploaded: api.Asset[], _assignedCategoryId?: string) => {
      const first = uploaded[0];
      if (first && token) {
        try {
          setSelectedAsset(await api.getAsset(first.id, token));
        } catch {
          setSelectedAsset({ ...first, categories: [] });
        }
      }
      setShowUpload(false);
      refreshUsage();
      loadData(true);
    },
    [token, refreshUsage, loadData]
  );

  // ─────────────────────────────────────────────────────────────────────────────

  if (isLoading) return null;

  const visibleCategories = categories.filter(
    (c) =>
      !c.creator ||
      c.creator === user?.username ||
      c.owner_id === user?.id ||
      c.access_level === "Global"
  );

  const selectedCategory =
    typeof selectedCategoryId === "string"
      ? visibleCategories.find((c) => c.id === selectedCategoryId)
      : undefined;

  const atCategoryLimit =
    usage !== null &&
    usage.category_limit !== null &&
    usage.category_count >= usage.category_limit;

  const isIdle = selectedCategoryId === undefined && !searchQuery;
  const hasFilter = typeof selectedCategoryId === "string" || !!debouncedSearch;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: Category tree */}
      <aside style={{ width: leftWidth }} className="shrink-0 bg-slate-50 flex flex-col overflow-hidden">
        <div className="p-3 border-b border-slate-200 shrink-0 flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {t("categoriesHeading")}
          </p>
          <button
            onClick={atCategoryLimit ? undefined : () => openCatForm(null)}
            title={atCategoryLimit ? t("categoryLimitReached") : t("newTopLevelCategoryTitle")}
            disabled={atCategoryLimit}
            className="w-5 h-5 flex items-center justify-center rounded text-sm leading-none transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-slate-400 hover:text-blue-600 hover:bg-blue-100"
          >
            +
          </button>
        </div>

        {showCatForm && (
          <form
            onSubmit={handleSaveCategory}
            className="p-2 border-b border-slate-200 bg-white space-y-2 shrink-0"
          >
            {editingCatId && (
              <p className="text-xs font-semibold text-slate-500">{t("categoryEditHeading")}</p>
            )}
            <input
              autoFocus
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder={t("categoryNamePlaceholder")}
              required
              className="w-full rounded border border-slate-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <select
              value={newCatParentId}
              onChange={(e) => setNewCatParentId(e.target.value)}
              className="w-full rounded border border-slate-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
            >
              <option value="">{t("categoryParentNone")}</option>
              {visibleCategories
                .filter((c) => c.id !== editingCatId && !getDescendantIds(editingCatId ?? "", categories).has(c.id))
                .map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
            </select>
            <select
              value={newCatAccessLevel}
              onChange={(e) => setNewCatAccessLevel(e.target.value)}
              className="w-full rounded border border-slate-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
            >
              <option value="Private">Private</option>
              <option value="Group">Group</option>
              <option value="Global">Global</option>
            </select>
            {catError && <p className="text-xs text-red-600">{catError}</p>}
            <div className="flex gap-1.5">
              <button
                type="submit"
                disabled={savingCat || !newCatName.trim()}
                className="flex-1 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-medium py-1 rounded transition-colors"
              >
                {savingCat ? t("categorySaving") : editingCatId ? t("categorySave") : t("categoryCreate")}
              </button>
              <button
                type="button"
                onClick={() => { setShowCatForm(false); setEditingCatId(null); }}
                className="flex-1 border border-slate-300 text-slate-600 hover:bg-slate-50 text-xs font-medium py-1 rounded transition-colors"
              >
                {t("categoryCancel")}
              </button>
            </div>
          </form>
        )}

        <div className="flex-1 overflow-y-auto p-2">
          {loadingAssets && assets.length === 0 ? (
            <p className="text-xs text-slate-400 px-2 py-1">{t("loading")}</p>
          ) : (
            <CategoryTree
              categories={visibleCategories}
              selectedId={selectedCategoryId}
              onSelect={(id) => { setSelectedCategoryId(id); }}
              draggingAssetId={draggingAssetId}
              draggingAssetCategoryIds={
                draggingAssetId
                  ? (assets.find((a) => a.id === draggingAssetId)?.categories.map((c) => c.id) ?? [])
                  : []
              }
              onCategoryDrop={handleCategoryDrop}
              onAddSubcategory={openCatForm}
              atCategoryLimit={atCategoryLimit}
              onMoveCategory={handleMoveCategory}
              userId={user?.id}
              onEditCategory={openEditCatForm}
              onDeleteCategory={handleRequestDeleteCat}
              onCopyIiifCollection={handleCopyIiifCollection}
            />
          )}
        </div>

        {usage && <UsageWidget usage={usage} />}
      </aside>
      <ResizeHandle onResize={handleLeftResize} />

      {/* Middle: Search + asset grid */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="p-3 border-b border-slate-200 bg-white flex items-center gap-3 shrink-0">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
            <input
              type="search"
              placeholder={t("searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); }}
              className="w-full rounded-lg border border-slate-300 pl-8 pr-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={() => setShowUpload(true)}
            disabled={damAccess === "none"}
            title={damAccess === "none" ? t("uploadNoAccessTitle") : undefined}
            className="bg-blue-700 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 shrink-0"
          >
            <span>+</span> {t("uploadButton")}
          </button>
          <div className="flex items-center shrink-0 rounded-lg border border-slate-300 overflow-hidden">
            <button
              onClick={() => loadData(assets.length > 0)}
              title={t("refreshTitle")}
              disabled={isRefreshing}
              className={`text-slate-600 hover:bg-slate-50 text-sm font-medium px-2.5 py-2 transition-colors border-r border-slate-300 disabled:opacity-50 ${isRefreshing ? "animate-spin" : ""}`}
            >
              ↺
            </button>
            <select
              value={autoRefreshMs ?? "off"}
              onChange={(e) => handleAutoRefreshChange(e.target.value === "off" ? null : Number(e.target.value))}
              title={t("autoRefreshTitle")}
              className="text-xs text-slate-600 bg-white pr-1 pl-1.5 py-2 focus:outline-none cursor-pointer"
            >
              {AUTO_REFRESH_OPTIONS.map((o) => (
                <option key={o.value ?? "off"} value={o.value ?? "off"}>
                  {o.label}
                </option>
              ))}
            </select>
            {autoRefreshMs !== null && (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5 shrink-0" title={t("autoRefreshActive")} />
            )}
          </div>
        </div>

        {/* Bulk action bar */}
        {selectedAssetIds.size > 0 && (
          <div className="shrink-0 px-4 py-2 bg-blue-50 border-b border-blue-200 flex items-center gap-3">
            <span className="text-sm font-medium text-blue-800 mr-1">
              {t("bulkSelected", { count: selectedAssetIds.size })}
            </span>
            <button
              type="button"
              onClick={handleBulkDownload}
              disabled={!!bulkDownloadProgress}
              className="px-3 py-1 rounded-lg text-xs font-medium bg-white border border-blue-300 text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-colors"
            >
              {bulkDownloadProgress
                ? t("bulkDownloadPreparing", { done: bulkDownloadProgress.done, total: bulkDownloadProgress.total })
                : t("bulkDownload")}
            </button>
            <button
              type="button"
              onClick={() => setShowBulkDeleteConfirm(true)}
              disabled={!!bulkDeleteProgress}
              className="px-3 py-1 rounded-lg text-xs font-medium bg-white border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              {t("bulkDelete")}
            </button>
            <button
              type="button"
              onClick={handleClearSelection}
              className="ml-auto text-xs text-slate-500 hover:text-slate-700 transition-colors"
            >
              {t("bulkClear")}
            </button>
          </div>
        )}

        {loadError ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8">
            <p className="text-sm text-red-600">{loadError}</p>
            <button onClick={() => loadData()} className="text-sm text-blue-700 hover:underline">
              {t("loadError")}
            </button>
          </div>
        ) : loadingAssets && assets.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
            {t("loadingAssets")}
          </div>
        ) : (
          <AssetGrid
            assets={assets}
            total={totalAssets}
            page={page}
            perPage={perPage}
            sortField={sortField}
            sortDir={sortDir}
            myAssetsOnly={myAssetsOnly}
            isIdle={isIdle}
            hasFilter={hasFilter}
            selectedAssetId={selectedAsset?.id ?? null}
            lockedIds={lockedIds}
            username={user?.username}
            userId={user?.id}
            token={token ?? ""}
            onSelect={handleSelectAsset}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onAssetCreated={handleAssetCreated}
            onAssetUpdated={handleAssetUpdated}
            onPageChange={setPage}
            onPageSizeChange={setPerPage}
            onSortChange={(field, dir) => { setSortField(field); setSortDir(dir); }}
            onMyAssetsToggle={() => setMyAssetsOnly((v) => !v)}
            selectedAssetIds={selectedAssetIds}
            onToggleSelect={handleToggleSelect}
            onRangeSelect={handleRangeSelect}
            onSelectAll={handleSelectAll}
          />
        )}
      </div>

      <ResizeHandle onResize={handleRightResize} />

      {/* Right: Asset details */}
      <aside style={{ width: rightWidth }} className="shrink-0 bg-white overflow-hidden flex flex-col">
        {selectedAsset ? (
          <AssetDetails
            asset={selectedAsset}
            categories={visibleCategories}
            token={token ?? ""}
            isLocked={lockedIds.has(selectedAsset.id)}
            onToggleLock={() => toggleLock(selectedAsset.id)}
            onUpdated={handleAssetUpdated}
            onDeleted={handleAssetDeleted}
            onCategoriesChanged={handleCategoriesChanged}
            onDragStart={() => handleDragStart(selectedAsset.id)}
            onDragEnd={handleDragEnd}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm p-8 text-center">
            <div>
              <p className="text-3xl mb-3">🖼</p>
              <p>{t("selectAssetPrompt")}</p>
            </div>
          </div>
        )}
      </aside>

      {deletingCatId && (() => {
        const cat = categories.find((c) => c.id === deletingCatId);
        const childIds = [...getDescendantIds(deletingCatId, categories)].filter((id) => id !== deletingCatId);
        const childNames = childIds.map((id) => categories.find((c) => c.id === id)?.name).filter(Boolean) as string[];
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
              <h2 className="text-base font-semibold text-slate-800 mb-2">{t("categoryDeleteConfirmTitle")}</h2>
              <p className="text-sm text-slate-600 mb-3">
                {t("categoryDeleteConfirmMessage", { name: cat?.name ?? "" })}
              </p>
              {childNames.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-amber-700 mb-1">{t("categoryDeleteConfirmWithChildren")}</p>
                  <ul className="text-xs text-slate-600 list-disc list-inside space-y-0.5 max-h-32 overflow-y-auto">
                    {childNames.map((name) => (
                      <li key={name}>{name}</li>
                    ))}
                  </ul>
                </div>
              )}
              {catError && <p className="text-xs text-red-600 mb-3">{catError}</p>}
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => { setDeletingCatId(null); setCatError(null); }}
                  disabled={deletingCat}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  {t("categoryDeleteConfirmCancel")}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteCat}
                  disabled={deletingCat}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white transition-colors"
                >
                  {deletingCat ? t("categoryDeleteConfirmDeleting") : t("categoryDeleteConfirmYes")}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Bulk delete confirmation modal */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-base font-semibold text-slate-800 mb-2">
              {t("bulkDeleteConfirmTitle", { count: selectedAssetIds.size })}
            </h2>
            <p className="text-sm text-slate-600 mb-4">{t("bulkDeleteConfirmMessage")}</p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowBulkDeleteConfirm(false)}
                disabled={!!bulkDeleteProgress}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                {t("bulkDeleteCancel")}
              </button>
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={!!bulkDeleteProgress}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white transition-colors"
              >
                {bulkDeleteProgress
                  ? t("bulkDeleteDeleting", { done: bulkDeleteProgress.done, total: bulkDeleteProgress.total })
                  : t("bulkDeleteConfirm")}
              </button>
            </div>
          </div>
        </div>
      )}

      {showUpload && (
        <UploadModal
          token={token ?? ""}
          username={user?.username ?? ""}
          initialCategoryId={selectedCategory?.id}
          initialCategoryName={selectedCategory?.name}
          onComplete={handleUploadComplete}
          onClose={() => setShowUpload(false)}
          onZipResult={(result) => {
            setCategories((prev) => [...prev, ...result.categories]);
            // Inline category data for newly uploaded zip assets
            setAssets((prev) =>
              prev.map((a) => {
                const newCatIds = result.asset_category_ids[a.id];
                if (!newCatIds) return a;
                const newCats = newCatIds
                  .map((cid) => result.categories.find((c) => c.id === cid))
                  .filter((c): c is api.Category => !!c);
                return { ...a, categories: [...a.categories, ...newCats] };
              })
            );
          }}
        />
      )}
    </div>
  );
}

export default function BrowsePage() {
  return (
    <Suspense>
      <BrowsePageInner />
    </Suspense>
  );
}
