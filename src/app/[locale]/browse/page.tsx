"use client";

import { useState, useEffect, useCallback, useRef, useMemo, Suspense } from "react";
import { useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import CategoryTree from "@/components/CategoryTree";
import AssetGrid from "@/components/AssetGrid";
import AssetDetails from "@/components/AssetDetails";
import UploadModal from "@/components/UploadModal";
import ResizeHandle from "@/components/ResizeHandle";
import UsageWidget from "@/components/UsageWidget";
import * as api from "@/lib/dam-api";
import { createCategory, updateCategory, deleteCategory, downloadUrl } from "@/lib/dam-api";
import { getDescendantIds } from "@/components/CategoryTree";
import { useTranslations } from "next-intl";
import JSZip from "jszip";

function BrowsePageInner() {
  const { user, token, damAccess, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("browse");

  const [assets, setAssets] = useState<api.Asset[]>([]);
  const [categories, setCategories] = useState<api.Category[]>([]);
  const [assetCategories, setAssetCategories] = useState<Map<string, string[]>>(new Map());
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");
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

  // Auto-refresh interval — persisted in localStorage (null = off)
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

  // Panel widths — persisted in localStorage
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

  // Lock state — persisted in localStorage
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

  // Category creation / edit form
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
    setNewCatAccessLevel(cat.access_level ?? "private");
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

  // Category delete confirmation
  const [deletingCatId, setDeletingCatId] = useState<string | null>(null);
  const [deletingCat, setDeletingCat] = useState(false);

  const handleRequestDeleteCat = useCallback((catId: string) => {
    setDeletingCatId(catId);
  }, []);

  const handleConfirmDeleteCat = useCallback(async () => {
    if (!token || !deletingCatId) return;
    setDeletingCat(true);
    // Collect all IDs to delete (BFS order), then reverse for deepest-first
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
      setAssetCategories((prev) => {
        const next = new Map(prev);
        for (const [assetId, catIds] of next.entries()) {
          const filtered = catIds.filter((cid) => !deletedSet.has(cid));
          if (filtered.length !== catIds.length) next.set(assetId, filtered);
        }
        return next;
      });
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
      } catch {
        // Non-critical
      }
    },
    [token]
  );

  const handleCategoryDrop = useCallback(
    async (assetId: string, categoryId: string) => {
      if (!token) return;
      try {
        await api.addCategoryToAsset(assetId, categoryId, token);
        setAssetCategories((prev) => {
          const next = new Map(prev);
          next.set(assetId, [...(next.get(assetId) ?? []), categoryId]);
          return next;
        });
        setSelectedAsset((prev) => {
          if (!prev || prev.id !== assetId) return prev;
          const cat = categories.find((c) => c.id === categoryId);
          if (!cat) return prev;
          return { ...prev, categories: [...prev.categories, cat] };
        });
      } catch {
        // Already assigned — silently ignore
      }
    },
    [token, categories]
  );

  const loadedAssetIds = useRef(new Set<string>());

  useEffect(() => {
    if (!isLoading && !user) router.push("/login");
  }, [isLoading, user, router]);

  const [isRefreshing, setIsRefreshing] = useState(false);

  // silent=true keeps the grid mounted (no loadingAssets spinner) so thumbnails survive.
  // Use silent when assets are already visible; use non-silent only on first load.
  const loadData = useCallback(async (silent = false) => {
    if (!token) return;
    if (silent) {
      setIsRefreshing(true);
    } else {
      setLoadingAssets(true);
      setLoadError(null);
    }
    try {
      const [assetsData, categoriesData] = await Promise.all([
        api.listAssets(token),
        api.listCategories(token),
      ]);
      setAssets(assetsData);
      setCategories(categoriesData);
      if (damAccess !== "none") {
        api.getUsage(token).then(setUsage).catch(() => {});
      }
    } catch (err) {
      if (!silent) setLoadError(err instanceof Error ? err.message : "Failed to load data.");
    } finally {
      if (silent) setIsRefreshing(false);
      else setLoadingAssets(false);
    }
  }, [token, damAccess]);

  const refreshUsage = useCallback(async () => {
    if (!token || damAccess === "none") return;
    try {
      setUsage(await api.getUsage(token));
    } catch {}
  }, [token, damAccess]);

  useEffect(() => {
    if (token) loadData();
  }, [token, loadData]);

  // Apply select_asset / select_category deep-link params once after initial load
  const deepLinkApplied = useRef(false);
  useEffect(() => {
    if (deepLinkApplied.current || !token || loadingAssets) return;
    const selectAsset    = searchParams.get("select_asset");
    const selectCategory = searchParams.get("select_category");
    if (!selectAsset && !selectCategory) return;
    deepLinkApplied.current = true;
    if (selectCategory) {
      setSelectedCategoryId(selectCategory);
    }
    if (selectAsset) {
      if (!selectCategory) setSelectedCategoryId(null); // show All Assets so the asset is visible
      api.getAsset(selectAsset, token).then(setSelectedAsset).catch(() => {});
    }
  }, [token, loadingAssets, searchParams]);

  useEffect(() => {
    if (!autoRefreshMs || !token) return;
    const id = setInterval(() => { loadData(true); }, autoRefreshMs);
    return () => clearInterval(id);
  }, [autoRefreshMs, token, loadData]);

  // Background-load categories for all assets in batches of 5, with retry on failure
  useEffect(() => {
    if (!token || assets.length === 0) return;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    async function loadCats(retryCount = 0): Promise<void> {
      const toLoad = assets.filter((a) => !loadedAssetIds.current.has(a.id));
      if (toLoad.length === 0 || cancelled) return;

      for (let i = 0; i < toLoad.length; i += 5) {
        if (cancelled) return;
        const chunk = toLoad.slice(i, i + 5);
        await Promise.all(
          chunk.map(async (asset) => {
            if (loadedAssetIds.current.has(asset.id)) return;
            try {
              const detail = await api.getAsset(asset.id, token!);
              if (cancelled) return;
              loadedAssetIds.current.add(asset.id);
              setAssetCategories((prev) => {
                const next = new Map(prev);
                next.set(asset.id, detail.categories.map((c) => c.id));
                return next;
              });
            } catch {
              // Not marked as loaded — will retry below (up to 2 more times)
            }
          })
        );
      }

      // Retry failed assets after a delay (up to 2 retries total)
      if (!cancelled && retryCount < 2 && assets.some((a) => !loadedAssetIds.current.has(a.id))) {
        retryTimer = setTimeout(() => { if (!cancelled) loadCats(retryCount + 1); }, 3000);
      }
    }

    loadCats();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [assets, token]);

  const handleSelectAsset = useCallback(
    async (asset: api.Asset) => {
      if (!token) return;
      try {
        const detail = await api.getAsset(asset.id, token);
        setSelectedAsset(detail);
        loadedAssetIds.current.add(asset.id);
        setAssetCategories((prev) => {
          const next = new Map(prev);
          next.set(asset.id, detail.categories.map((c) => c.id));
          return next;
        });
      } catch {
        setSelectedAsset({ ...asset, categories: [] });
      }
    },
    [token]
  );

  const handleAssetUpdated = useCallback(
    async (updated: api.Asset) => {
      setAssets((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
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
    (newAsset: api.Asset, categoryIds: string[]) => {
      setAssets((prev) => [newAsset, ...prev]);
      setAssetCategories((prev) => {
        const next = new Map(prev);
        next.set(newAsset.id, categoryIds);
        return next;
      });
      loadedAssetIds.current.add(newAsset.id);
    },
    [],
  );

  const handleAssetDeleted = useCallback((id: string) => {
    setAssets((prev) => prev.filter((a) => a.id !== id));
    setAssetCategories((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
    loadedAssetIds.current.delete(id);
    setSelectedAsset(null);
    refreshUsage();
  }, [refreshUsage]);

  // ── Multi-select ─────────────────────────────────────────────────────────────

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
    setAssetCategories((prev) => {
      const next = new Map(prev);
      deleted.forEach((id) => { next.delete(id); loadedAssetIds.current.delete(id); });
      return next;
    });
    if (selectedAsset && deleted.includes(selectedAsset.id)) setSelectedAsset(null);
    setSelectedAssetIds(new Set([...failed, ...ids.filter((id) => lockedIds.has(id))]));
    setBulkDeleteProgress(null);
    setShowBulkDeleteConfirm(false);
    refreshUsage();
    if (skipped > 0 || failed.length > 0) {
      const count = skipped + failed.length;
      alert(t("bulkDeleteSkipped", { count }));
    }
  }, [token, selectedAssetIds, lockedIds, selectedAsset, refreshUsage, t]);

  const handleBulkDownload = useCallback(async () => {
    if (!token) return;
    const ids = [...selectedAssetIds];

    // Single asset — use a plain anchor link (same as AssetDetails)
    if (ids.length === 1) {
      const a = document.createElement("a");
      a.href = downloadUrl(ids[0]);
      a.download = "";
      a.click();
      return;
    }

    // Multiple assets — fetch and zip
    setBulkDownloadProgress({ done: 0, total: ids.length });
    const zip = new JSZip();
    const usedNames = new Map<string, number>();

    for (let i = 0; i < ids.length; i++) {
      const asset = assets.find((a) => a.id === ids[i]);
      try {
        const res = await fetch(downloadUrl(ids[i]), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        // Prefer the asset's stored MIME type; the download response often sends
        // application/octet-stream which would produce a useless ".octet-stream" extension.
        const mimeType = asset?.asset_type || res.headers.get("content-type") || "";
        const subtype = mimeType.split("/")[1]?.split(";")[0]?.split("+")[0] ?? "bin";
        const extNorm: Record<string, string> = { jpeg: "jpg", "octet-stream": "bin", plain: "txt" };
        const ext = extNorm[subtype] ?? subtype;
        const baseName = asset?.name ?? ids[i];
        const candidate = `${baseName}.${ext}`;
        const count = (usedNames.get(candidate) ?? 0) + 1;
        usedNames.set(candidate, count);
        const fileName = count === 1 ? candidate : `${baseName} (${count}).${ext}`;
        zip.file(fileName, blob);
      } catch {
        // skip failed assets silently — they'll be absent from the ZIP
      }
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

  // ─────────────────────────────────────────────────────────────────────────────

  const handleCategoriesChanged = useCallback(
    (cats: api.Category[]) => {
      if (!selectedAsset) return;
      setAssetCategories((prev) => {
        const next = new Map(prev);
        next.set(selectedAsset.id, cats.map((c) => c.id));
        return next;
      });
      setSelectedAsset((prev) => (prev ? { ...prev, categories: cats } : null));
    },
    [selectedAsset]
  );

  const handleUploadComplete = useCallback(
    async (uploaded: api.Asset[], assignedCategoryId?: string) => {
      setAssets((prev) => [...uploaded.reverse(), ...prev]);
      const first = uploaded[0];
      if (first && token) {
        try {
          const detail = await api.getAsset(first.id, token);
          setSelectedAsset(detail);
          for (const asset of uploaded) loadedAssetIds.current.add(asset.id);
          setAssetCategories((prev) => {
            const next = new Map(prev);
            next.set(first.id, detail.categories.map((c) => c.id));
            // Seed the remaining uploaded assets with the assigned category so
            // they appear in the correct category filter before the background
            // loader picks them up.
            if (assignedCategoryId) {
              for (const asset of uploaded.slice(1)) {
                next.set(asset.id, [assignedCategoryId]);
              }
            }
            return next;
          });
        } catch {
          setSelectedAsset({ ...first, categories: [] });
        }
      }
      setShowUpload(false);
      refreshUsage();
    },
    [token, refreshUsage]
  );

  if (isLoading) return null;

  // Only show categories the user owns, or that are globally accessible,
  // or that have no creator set (legacy data created before access control was added).
  // Check owner_id (UUID) as the authoritative ownership field alongside creator (username)
  // so that categories whose creator field is stale or missing are never incorrectly hidden.
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
          {loadingAssets ? (
            <p className="text-xs text-slate-400 px-2 py-1">{t("loading")}</p>
          ) : (
            <CategoryTree
              categories={visibleCategories}
              selectedId={selectedCategoryId}
              onSelect={setSelectedCategoryId}
              draggingAssetId={draggingAssetId}
              draggingAssetCategoryIds={
                draggingAssetId ? (assetCategories.get(draggingAssetId) ?? []) : []
              }
              onCategoryDrop={handleCategoryDrop}
              onAddSubcategory={openCatForm}
              atCategoryLimit={atCategoryLimit}
              onMoveCategory={handleMoveCategory}
              userId={user?.id}
              onEditCategory={openEditCatForm}
              onDeleteCategory={handleRequestDeleteCat}
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
              onChange={(e) => setSearchQuery(e.target.value)}
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
        ) : loadingAssets ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
            {t("loadingAssets")}
          </div>
        ) : (
          <AssetGrid
            assets={assets}
            assetCategories={assetCategories}
            selectedCategoryId={selectedCategoryId}
            searchQuery={searchQuery}
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
          damAccess={damAccess}
          initialCategoryId={selectedCategory?.id}
          initialCategoryName={selectedCategory?.name}
          onComplete={handleUploadComplete}
          onClose={() => setShowUpload(false)}
          onZipResult={(result) => {
            setCategories((prev) => [...prev, ...result.categories]);
            setAssetCategories((prev) => {
              const next = new Map(prev);
              for (const [assetId, catIds] of Object.entries(result.asset_category_ids)) {
                next.set(assetId, catIds);
              }
              return next;
            });
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
