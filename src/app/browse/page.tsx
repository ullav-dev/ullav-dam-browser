"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import CategoryTree from "@/components/CategoryTree";
import AssetGrid from "@/components/AssetGrid";
import AssetDetails from "@/components/AssetDetails";
import UploadModal from "@/components/UploadModal";
import * as api from "@/lib/dam-api";
import { createCategory, updateCategory } from "@/lib/dam-api";

export default function BrowsePage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();

  const [assets, setAssets] = useState<api.Asset[]>([]);
  const [categories, setCategories] = useState<api.Category[]>([]);
  const [assetCategories, setAssetCategories] = useState<Map<string, string[]>>(new Map());
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<api.AssetWithCategories | null>(null);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  // Lock state — persisted in localStorage, shared across both grid and details
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

  // Category creation form
  const [showCatForm, setShowCatForm] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatParentId, setNewCatParentId] = useState<string>("");
  const [savingCat, setSavingCat] = useState(false);
  const [catError, setCatError] = useState<string | null>(null);

  const openCatForm = useCallback((parentId: string | null = null) => {
    setNewCatName("");
    setNewCatParentId(parentId ?? "");
    setCatError(null);
    setShowCatForm(true);
  }, []);

  const handleCreateCategory = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!token || !newCatName.trim()) return;
      setSavingCat(true);
      setCatError(null);
      try {
        const created = await createCategory(
          { name: newCatName.trim(), parent_id: newCatParentId || null },
          token
        );
        setCategories((prev) => [...prev, created]);
        setShowCatForm(false);
        setNewCatName("");
        setNewCatParentId("");
      } catch (err) {
        setCatError(err instanceof Error ? err.message : "Failed to create category.");
      } finally {
        setSavingCat(false);
      }
    },
    [token, newCatName, newCatParentId]
  );

  // Drag-and-drop: track which asset is being dragged onto the category tree
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
        // Non-critical — tree will remain unchanged on failure
      }
    },
    [token]
  );

  const handleCategoryDrop = useCallback(
    async (assetId: string, categoryId: string) => {
      if (!token) return;
      try {
        await api.addCategoryToAsset(assetId, categoryId, token);
        // Update the assetCategories cache
        setAssetCategories((prev) => {
          const next = new Map(prev);
          next.set(assetId, [...(next.get(assetId) ?? []), categoryId]);
          return next;
        });
        // If this is the selected asset, update its categories in the details panel
        setSelectedAsset((prev) => {
          if (!prev || prev.id !== assetId) return prev;
          const cat = categories.find((c) => c.id === categoryId);
          if (!cat) return prev;
          return { ...prev, categories: [...prev.categories, cat] };
        });
      } catch {
        // Server returns a conflict or error — silently ignore (already assigned)
      }
    },
    [token, categories]
  );

  // Track which asset IDs have had their categories loaded
  const loadedAssetIds = useRef(new Set<string>());

  useEffect(() => {
    if (!isLoading && !user) router.push("/login");
  }, [isLoading, user, router]);

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoadingAssets(true);
    setLoadError(null);
    try {
      const [assetsData, categoriesData] = await Promise.all([
        api.listAssets(token),
        api.listCategories(token),
      ]);
      setAssets(assetsData);
      setCategories(categoriesData);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load data.");
    } finally {
      setLoadingAssets(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) loadData();
  }, [token, loadData]);

  // Background-load categories for all assets in batches of 5
  useEffect(() => {
    if (!token || assets.length === 0) return;

    let cancelled = false;

    async function loadCats() {
      const toLoad = assets.filter((a) => !loadedAssetIds.current.has(a.id));
      if (toLoad.length === 0) return;

      for (let i = 0; i < toLoad.length; i += 5) {
        if (cancelled) break;
        const chunk = toLoad.slice(i, i + 5);
        await Promise.all(
          chunk.map(async (asset) => {
            if (loadedAssetIds.current.has(asset.id)) return;
            loadedAssetIds.current.add(asset.id);
            try {
              const detail = await api.getAsset(asset.id, token!);
              setAssetCategories((prev) => {
                const next = new Map(prev);
                next.set(asset.id, detail.categories.map((c) => c.id));
                return next;
              });
            } catch {
              // Non-critical — leave as undefined (shows all)
            }
          })
        );
      }
    }

    loadCats();
    return () => {
      cancelled = true;
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
        // Fall back to showing asset without categories
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

  const handleAssetDeleted = useCallback((id: string) => {
    setAssets((prev) => prev.filter((a) => a.id !== id));
    setAssetCategories((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
    loadedAssetIds.current.delete(id);
    setSelectedAsset(null);
  }, []);

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
    async (asset: api.Asset) => {
      setAssets((prev) => [asset, ...prev]);
      if (token) {
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
      }
      setShowUpload(false);
    },
    [token]
  );

  if (isLoading) return null;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: Category tree */}
      <aside className="w-56 shrink-0 bg-slate-50 border-r border-slate-200 flex flex-col overflow-hidden">
        <div className="p-3 border-b border-slate-200 shrink-0 flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Categories
          </p>
          <button
            onClick={() => openCatForm(null)}
            title="New top-level category"
            className="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-blue-600 hover:bg-blue-100 text-sm leading-none transition-colors"
          >
            +
          </button>
        </div>

        {/* Inline category creation form */}
        {showCatForm && (
          <form
            onSubmit={handleCreateCategory}
            className="p-2 border-b border-slate-200 bg-white space-y-2 shrink-0"
          >
            <input
              autoFocus
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="Category name"
              required
              className="w-full rounded border border-slate-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <select
              value={newCatParentId}
              onChange={(e) => setNewCatParentId(e.target.value)}
              className="w-full rounded border border-slate-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
            >
              <option value="">None (top level)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {catError && <p className="text-xs text-red-600">{catError}</p>}
            <div className="flex gap-1.5">
              <button
                type="submit"
                disabled={savingCat || !newCatName.trim()}
                className="flex-1 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-medium py-1 rounded transition-colors"
              >
                {savingCat ? "Creating…" : "Create"}
              </button>
              <button
                type="button"
                onClick={() => setShowCatForm(false)}
                className="flex-1 border border-slate-300 text-slate-600 hover:bg-slate-50 text-xs font-medium py-1 rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="flex-1 overflow-y-auto p-2">
          {loadingAssets ? (
            <p className="text-xs text-slate-400 px-2 py-1">Loading…</p>
          ) : (
            <CategoryTree
              categories={categories}
              selectedId={selectedCategoryId}
              onSelect={setSelectedCategoryId}
              draggingAssetId={draggingAssetId}
              draggingAssetCategoryIds={
                draggingAssetId
                  ? (assetCategories.get(draggingAssetId) ?? [])
                  : []
              }
              onCategoryDrop={handleCategoryDrop}
              onAddSubcategory={openCatForm}
              onMoveCategory={handleMoveCategory}
            />
          )}
        </div>
      </aside>

      {/* Middle: Search + asset grid */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Toolbar */}
        <div className="p-3 border-b border-slate-200 bg-white flex items-center gap-3 shrink-0">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
            <input
              type="search"
              placeholder="Search by name, keywords, caption…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-300 pl-8 pr-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={() => setShowUpload(true)}
            className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 shrink-0"
          >
            <span>+</span> Upload
          </button>
          <button
            onClick={loadData}
            title="Refresh"
            className="border border-slate-300 text-slate-600 hover:bg-slate-50 text-sm font-medium px-2.5 py-2 rounded-lg transition-colors shrink-0"
          >
            ↺
          </button>
        </div>

        {/* Asset count */}
        <div className="px-4 py-2 border-b border-slate-100 bg-white shrink-0">
          <p className="text-xs text-slate-400">
            {loadingAssets
              ? "Loading…"
              : `${assets.length} asset${assets.length !== 1 ? "s" : ""}${
                  selectedCategoryId
                    ? ` · filtered by category`
                    : ""
                }${searchQuery ? ` · "${searchQuery}"` : ""}`}
          </p>
        </div>

        {loadError ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8">
            <p className="text-sm text-red-600">{loadError}</p>
            <button
              onClick={loadData}
              className="text-sm text-blue-700 hover:underline"
            >
              Retry
            </button>
          </div>
        ) : loadingAssets ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
            Loading assets…
          </div>
        ) : (
          <AssetGrid
            assets={assets}
            assetCategories={assetCategories}
            selectedCategoryId={selectedCategoryId}
            searchQuery={searchQuery}
            selectedAssetId={selectedAsset?.id ?? null}
            lockedIds={lockedIds}
            onSelect={handleSelectAsset}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          />
        )}
      </div>

      {/* Right: Asset details */}
      <aside className="w-72 shrink-0 bg-white border-l border-slate-200 overflow-hidden flex flex-col">
        {selectedAsset ? (
          <AssetDetails
            asset={selectedAsset}
            categories={categories}
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
              <p>Select an asset to view and edit its details</p>
            </div>
          </div>
        )}
      </aside>

      {showUpload && (
        <UploadModal
          token={token ?? ""}
          categories={categories}
          onComplete={handleUploadComplete}
          onClose={() => setShowUpload(false)}
        />
      )}
    </div>
  );
}
