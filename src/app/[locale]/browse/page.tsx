"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/contexts/AuthContext";
import CategoryTree from "@/components/CategoryTree";
import AssetGrid from "@/components/AssetGrid";
import AssetDetails from "@/components/AssetDetails";
import UploadModal from "@/components/UploadModal";
import ResizeHandle from "@/components/ResizeHandle";
import * as api from "@/lib/dam-api";
import { createCategory, updateCategory, deleteCategory } from "@/lib/dam-api";
import { getDescendantIds } from "@/components/CategoryTree";
import { useTranslations } from "next-intl";

export default function BrowsePage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
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
            try {
              const detail = await api.getAsset(asset.id, token!);
              loadedAssetIds.current.add(asset.id); // mark loaded only on success
              setAssetCategories((prev) => {
                const next = new Map(prev);
                next.set(asset.id, detail.categories.map((c) => c.id));
                return next;
              });
            } catch {
              // Not marked as loaded so it can retry, but write an empty array
              // so the asset doesn't show through the category filter optimistically.
              if (!cancelled) {
                setAssetCategories((prev) => {
                  if (prev.has(asset.id)) return prev;
                  const next = new Map(prev);
                  next.set(asset.id, []);
                  return next;
                });
              }
            }
          })
        );
      }
    }

    loadCats();
    return () => { cancelled = true; };
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
    async (uploaded: api.Asset[]) => {
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
            return next;
          });
        } catch {
          setSelectedAsset({ ...first, categories: [] });
        }
      }
      setShowUpload(false);
    },
    [token]
  );

  if (isLoading) return null;

  // Only show categories the user owns, or that are globally accessible,
  // or that have no creator set (legacy data created before access control was added).
  const visibleCategories = categories.filter(
    (c) => !c.creator || c.creator === user?.username || c.access_level === "Global"
  );

  // Asset count display
  const countLabel = loadingAssets
    ? t("loading")
    : `${t("assetCount", { count: assets.length })}${selectedCategoryId ? ` ${t("filteredByCategory")}` : ""}${searchQuery ? ` ${t("filteredBySearch", { query: searchQuery })}` : ""}`;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: Category tree */}
      <aside style={{ width: leftWidth }} className="shrink-0 bg-slate-50 flex flex-col overflow-hidden">
        <div className="p-3 border-b border-slate-200 shrink-0 flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {t("categoriesHeading")}
          </p>
          <button
            onClick={() => openCatForm(null)}
            title={t("newTopLevelCategoryTitle")}
            className="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-blue-600 hover:bg-blue-100 text-sm leading-none transition-colors"
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
              onMoveCategory={handleMoveCategory}
              username={user?.username}
              onEditCategory={openEditCatForm}
              onDeleteCategory={handleRequestDeleteCat}
            />
          )}
        </div>
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
            className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 shrink-0"
          >
            <span>+</span> {t("uploadButton")}
          </button>
          <button
            onClick={loadData}
            title={t("refreshTitle")}
            className="border border-slate-300 text-slate-600 hover:bg-slate-50 text-sm font-medium px-2.5 py-2 rounded-lg transition-colors shrink-0"
          >
            ↺
          </button>
        </div>

        <div className="px-4 py-2 border-b border-slate-100 bg-white shrink-0">
          <p className="text-xs text-slate-400">{countLabel}</p>
        </div>

        {loadError ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8">
            <p className="text-sm text-red-600">{loadError}</p>
            <button onClick={loadData} className="text-sm text-blue-700 hover:underline">
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
            token={token ?? ""}
            onSelect={handleSelectAsset}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onAssetCreated={handleAssetCreated}
            onAssetUpdated={handleAssetUpdated}
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

      {showUpload && (
        <UploadModal
          token={token ?? ""}
          username={user?.username ?? ""}
          categories={visibleCategories}
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
