"use client";

import { useState, useMemo } from "react";
import type { Category } from "@/lib/dam-api";
import { useTranslations } from "next-intl";

interface TreeNode extends Category {
  children: TreeNode[];
}

function buildTree(categories: Category[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  for (const cat of categories) {
    map.set(cat.id, { ...cat, children: [] });
  }
  const roots: TreeNode[] = [];
  for (const node of map.values()) {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  function sortChildren(nodes: TreeNode[]): TreeNode[] {
    return nodes.sort((a, b) => a.name.localeCompare(b.name)).map((n) => ({
      ...n,
      children: sortChildren(n.children),
    }));
  }
  return sortChildren(roots);
}

/** Returns the ID of the given node plus all its descendants. */
export function getDescendantIds(catId: string, categories: Category[]): Set<string> {
  const result = new Set<string>();
  const queue = [catId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    result.add(id);
    for (const cat of categories) {
      if (cat.parent_id === id) queue.push(cat.id);
    }
  }
  return result;
}

// ── Asset-assign drag context ──────────────────────────────────────────────────

interface AssetDragCtx {
  draggingAssetId: string | null;
  draggingAssetCategoryIds: string[];
  dragOverId: string | null;
  setDragOverId: (id: string | null) => void;
  onCategoryDrop: (assetId: string, categoryId: string) => void;
}

// ── Category-move drag context ─────────────────────────────────────────────────

interface CatMoveCtx {
  draggingCatId: string | null;
  setDraggingCatId: (id: string | null) => void;
  dragOverId: string | "root" | null;
  setDragOverId: (id: string | "root" | null) => void;
  /** The dragged category's current parent_id (null = already top-level). */
  currentParentId: string | null;
  /** IDs of the dragged node and all its descendants — invalid drop targets. */
  descendantIds: Set<string>;
  onDrop: (catId: string, newParentId: string | null) => void;
}

// ── Tree node ──────────────────────────────────────────────────────────────────

function TreeNodeItem({
  node,
  selectedId,
  onSelect,
  assetDrag,
  catMove,
  onAddSubcategory,
  atCategoryLimit,
  userId,
  onEditCategory,
  onDeleteCategory,
  depth = 0,
}: {
  node: TreeNode;
  selectedId: string | null | undefined;
  onSelect: (id: string | null) => void;
  assetDrag: AssetDragCtx;
  catMove: CatMoveCtx;
  onAddSubcategory?: (parentId: string) => void;
  atCategoryLimit?: boolean;
  userId?: string;
  onEditCategory?: (id: string) => void;
  onDeleteCategory?: (id: string) => void;
  depth?: number;
}) {

  const t = useTranslations("categoryTree");
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);

  const hasChildren = node.children.length > 0;
  const isSelected = selectedId === node.id;

  // Asset-assign state
  const isAssetDragging = assetDrag.draggingAssetId !== null;
  const isAssetDragOver = assetDrag.dragOverId === node.id;
  const alreadyAssigned = isAssetDragging && assetDrag.draggingAssetCategoryIds.includes(node.id);
  const canAssetDrop = isAssetDragging && !alreadyAssigned;

  // Category-move state
  const isCatMoving = catMove.draggingCatId !== null;
  const isThisBeingMoved = catMove.draggingCatId === node.id;
  const isCatMoveOver = catMove.dragOverId === node.id;
  const isDescendant = isCatMoving && catMove.descendantIds.has(node.id); // includes self
  const isCurrentParent = isCatMoving && node.id === catMove.currentParentId;
  const canCatDrop = isCatMoving && !isDescendant && !isCurrentParent;

  // ── Asset-assign drag handlers ─────────────────────────────────────────────

  function handleAssetDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = canAssetDrop ? "copy" : "none";
    if (assetDrag.dragOverId !== node.id) assetDrag.setDragOverId(node.id);
  }

  function handleAssetDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      assetDrag.setDragOverId(null);
    }
  }

  function handleAssetDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    assetDrag.setDragOverId(null);
    if (canAssetDrop && assetDrag.draggingAssetId) {
      assetDrag.onCategoryDrop(assetDrag.draggingAssetId, node.id);
    }
  }

  // ── Category-move drag handlers ────────────────────────────────────────────

  function handleCatDragStart(e: React.DragEvent) {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("dam-cat-move", node.id);
    catMove.setDraggingCatId(node.id);
  }

  function handleCatDragEnd() {
    catMove.setDraggingCatId(null);
    catMove.setDragOverId(null);
  }

  function handleCatMoveOver(e: React.DragEvent) {
    if (!e.dataTransfer.types.includes("dam-cat-move")) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = canCatDrop ? "move" : "none";
    if (catMove.dragOverId !== node.id) catMove.setDragOverId(node.id);
  }

  function handleCatMoveLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      catMove.setDragOverId(null);
    }
  }

  function handleCatMoveDrop(e: React.DragEvent) {
    if (!e.dataTransfer.types.includes("dam-cat-move")) return;
    e.preventDefault();
    e.stopPropagation();
    const id = e.dataTransfer.getData("dam-cat-move") || catMove.draggingCatId;
    catMove.setDragOverId(null);
    if (canCatDrop && id) catMove.onDrop(id, node.id);
  }

  // ── Visual class ───────────────────────────────────────────────────────────

  let rowCls: string;

  if (isAssetDragging) {
    if (isAssetDragOver) {
      rowCls = canAssetDrop
        ? "bg-green-50 ring-1 ring-green-400 text-green-800 font-medium"
        : "bg-amber-50 ring-1 ring-amber-300 text-amber-700";
    } else if (alreadyAssigned) {
      rowCls = "text-slate-400 cursor-not-allowed";
    } else {
      rowCls = "text-slate-700 hover:bg-slate-100";
    }
  } else if (isCatMoving) {
    if (isThisBeingMoved) {
      rowCls = "text-slate-400 opacity-50";
    } else if (isCatMoveOver) {
      rowCls = canCatDrop
        ? "bg-green-50 ring-1 ring-green-400 text-green-800 font-medium"
        : isCurrentParent
        ? "bg-amber-50 ring-1 ring-amber-300 text-amber-700"
        : "bg-red-50 ring-1 ring-red-200 text-red-400";
    } else if (isDescendant) {
      rowCls = "text-slate-400";
    } else {
      rowCls = "text-slate-700 hover:bg-slate-100";
    }
  } else {
    rowCls = isSelected
      ? "bg-blue-100 text-blue-800 font-medium"
      : "text-slate-700 hover:bg-slate-100";
  }

  const cursor = isAssetDragging && canAssetDrop
    ? "cursor-copy"
    : isCatMoving && !isThisBeingMoved && canCatDrop
    ? "cursor-move"
    : "cursor-pointer";

  return (
    <div>
      <div
        draggable={!isAssetDragging && !isCatMoving}
        className={`flex items-center gap-1 py-1.5 rounded-md text-sm transition-colors ${rowCls} ${cursor}`}
        style={{ paddingLeft: `${8 + depth * 16}px`, paddingRight: "8px" }}
        onClick={() => !isAssetDragging && !isCatMoving && onSelect(isSelected ? null : node.id)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        // Category-move drag source
        onDragStart={!isAssetDragging ? handleCatDragStart : undefined}
        onDragEnd={!isAssetDragging ? handleCatDragEnd : undefined}
        // Asset-assign drop target
        onDragOver={isAssetDragging ? handleAssetDragOver : isCatMoving ? handleCatMoveOver : undefined}
        onDragLeave={isAssetDragging ? handleAssetDragLeave : isCatMoving ? handleCatMoveLeave : undefined}
        onDrop={isAssetDragging ? handleAssetDrop : isCatMoving ? handleCatMoveDrop : undefined}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="text-slate-400 hover:text-slate-600 w-4 shrink-0 text-xs"
          >
            {expanded ? "▾" : "▸"}
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}

        <span className="truncate flex-1">{node.name}</span>

        {/* Asset-assign drop feedback */}
        {isAssetDragOver && (
          <span className="shrink-0 text-[10px] font-semibold ml-1">
            {canAssetDrop
              ? <span className="text-green-700">{t("dropAdd")}</span>
              : <span className="text-amber-600">{t("dropAlreadyAdded")}</span>}
          </span>
        )}

        {/* Category-move drop feedback */}
        {isCatMoveOver && (
          <span className="shrink-0 text-[10px] font-semibold ml-1">
            {canCatDrop
              ? <span className="text-green-700">{t("dropMoveHere")}</span>
              : isCurrentParent
              ? <span className="text-amber-600">{t("dropAlreadyHere")}</span>
              : <span className="text-red-400">{t("dropCannotMove")}</span>}
          </span>
        )}

        {/* Add sub-category button — visible on hover when not dragging and under limit */}
        {!isAssetDragging && !isCatMoving && onAddSubcategory && hovered && !atCategoryLimit && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAddSubcategory(node.id);
            }}
            title={t("addSubcategoryTitle", { name: node.name })}
            className="shrink-0 w-4 h-4 flex items-center justify-center rounded text-slate-400 hover:text-blue-600 hover:bg-blue-100 text-xs leading-none transition-colors"
          >
            +
          </button>
        )}

        {/* Edit / Delete buttons — visible on hover for categories owned by the current user */}
        {!isAssetDragging && !isCatMoving && userId && node.owner_id === userId && hovered && (
          <>
            {onEditCategory && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onEditCategory(node.id); }}
                title={t("editCategoryTitle")}
                className="shrink-0 w-4 h-4 flex items-center justify-center rounded text-slate-400 hover:text-blue-600 hover:bg-blue-100 text-xs leading-none transition-colors"
              >
                ✏
              </button>
            )}
            {onDeleteCategory && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDeleteCategory(node.id); }}
                title={t("deleteCategoryTitle")}
                className="shrink-0 w-4 h-4 flex items-center justify-center rounded text-slate-400 hover:text-red-600 hover:bg-red-100 text-xs leading-none transition-colors"
              >
                ✕
              </button>
            )}
          </>
        )}
      </div>

      {hasChildren && expanded && (
        <div>
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              assetDrag={assetDrag}
              catMove={catMove}
              onAddSubcategory={onAddSubcategory}
              atCategoryLimit={atCategoryLimit}
              userId={userId}
              onEditCategory={onEditCategory}
              onDeleteCategory={onDeleteCategory}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Public component ───────────────────────────────────────────────────────────

interface Props {
  categories: Category[];
  selectedId: string | null | undefined;
  onSelect: (id: string | null) => void;
  assetCounts?: Map<string, number>;
  // Asset-assign drag-and-drop
  draggingAssetId?: string | null;
  draggingAssetCategoryIds?: string[];
  onCategoryDrop?: (assetId: string, categoryId: string) => void;
  // Category creation
  onAddSubcategory?: (parentId: string) => void;
  /** When true, all sub-category creation buttons are hidden. */
  atCategoryLimit?: boolean;
  // Category move drag-and-drop
  onMoveCategory?: (id: string, newParentId: string | null) => void;
  // Category edit / delete (only shown for owned categories)
  userId?: string;
  onEditCategory?: (id: string) => void;
  onDeleteCategory?: (id: string) => void;
}

export default function CategoryTree({
  categories,
  selectedId,
  onSelect,
  assetCounts,
  draggingAssetId = null,
  draggingAssetCategoryIds = [],
  onCategoryDrop,
  onAddSubcategory,
  atCategoryLimit = false,
  onMoveCategory,
  userId,
  onEditCategory,
  onDeleteCategory,
}: Props) {
  const t = useTranslations("categoryTree");
  const tree = buildTree(categories);

  // Asset-assign drag state
  const [assetDragOverId, setAssetDragOverId] = useState<string | null>(null);
  const isAssetDragging = draggingAssetId !== null;

  // Category-move drag state
  const [draggingCatId, setDraggingCatId] = useState<string | null>(null);
  const [catDragOverId, setCatDragOverId] = useState<string | "root" | null>(null);
  const isCatMoving = draggingCatId !== null;

  const currentParentId = useMemo(
    () => (draggingCatId ? (categories.find((c) => c.id === draggingCatId)?.parent_id ?? null) : null),
    [draggingCatId, categories]
  );

  const descendantIds = useMemo(
    () => (draggingCatId ? getDescendantIds(draggingCatId, categories) : new Set<string>()),
    [draggingCatId, categories]
  );

  const assetDrag: AssetDragCtx = {
    draggingAssetId,
    draggingAssetCategoryIds,
    dragOverId: assetDragOverId,
    setDragOverId: setAssetDragOverId,
    onCategoryDrop: onCategoryDrop ?? (() => {}),
  };

  const catMove: CatMoveCtx = {
    draggingCatId,
    setDraggingCatId,
    dragOverId: catDragOverId,
    setDragOverId: setCatDragOverId,
    currentParentId,
    descendantIds,
    onDrop: (catId, newParentId) => {
      setDraggingCatId(null);
      setCatDragOverId(null);
      onMoveCategory?.(catId, newParentId);
    },
  };

  // "All Assets" row as a category-move drop target (makes category top-level)
  const isRootOver = catDragOverId === "root";
  const canDropOnRoot = isCatMoving && currentParentId !== null; // not already top-level

  function handleRootDragOver(e: React.DragEvent) {
    if (!e.dataTransfer.types.includes("dam-cat-move")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = canDropOnRoot ? "move" : "none";
    if (catDragOverId !== "root") setCatDragOverId("root");
  }

  function handleRootDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setCatDragOverId(null);
    }
  }

  function handleRootDrop(e: React.DragEvent) {
    if (!e.dataTransfer.types.includes("dam-cat-move")) return;
    e.preventDefault();
    const id = e.dataTransfer.getData("dam-cat-move") || draggingCatId;
    setCatDragOverId(null);
    if (canDropOnRoot && id) catMove.onDrop(id, null);
  }

  return (
    <div
      className={`space-y-0.5 transition-colors rounded-lg ${
        isAssetDragging ? "ring-1 ring-blue-200 bg-blue-50/30 p-1" : ""
      }`}
    >
      {/* "All Assets" row — asset-assign: not a drop target; category-move: drop here = top level */}
      <div
        className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors ${
          isRootOver
            ? canDropOnRoot
              ? "bg-green-50 ring-1 ring-green-400 text-green-800 font-medium"
              : "bg-amber-50 ring-1 ring-amber-300 text-amber-700"
            : selectedId === null
            ? "bg-blue-100 text-blue-800 font-medium"
            : "text-slate-700 hover:bg-slate-100"  // undefined = nothing selected — no highlight
        } ${isAssetDragging ? "pointer-events-none opacity-40" : ""}`}
        onClick={() => !isCatMoving && onSelect(null)}
        onDragOver={isCatMoving ? handleRootDragOver : undefined}
        onDragLeave={isCatMoving ? handleRootDragLeave : undefined}
        onDrop={isCatMoving ? handleRootDrop : undefined}
      >
        <span className="w-4 shrink-0 text-center text-xs text-slate-400">◉</span>
        <span className="flex-1">{t("allAssets")}</span>
        {assetCounts !== undefined && (
          <span className="text-xs text-slate-400">
            {assetCounts.get("__all__") ?? 0}
          </span>
        )}
        {isRootOver && (
          <span className="shrink-0 text-[10px] font-semibold">
            {canDropOnRoot
              ? <span className="text-green-700">{t("dropMakeTopLevel")}</span>
              : <span className="text-amber-600">{t("dropAlreadyTopLevel")}</span>}
          </span>
        )}
      </div>

      {tree.map((node) => (
        <TreeNodeItem
          key={node.id}
          node={node}
          selectedId={selectedId}
          onSelect={onSelect}
          assetDrag={assetDrag}
          catMove={catMove}
          onAddSubcategory={onAddSubcategory}
          atCategoryLimit={atCategoryLimit}
          userId={userId}
          onEditCategory={onEditCategory}
          onDeleteCategory={onDeleteCategory}
          depth={0}
        />
      ))}
    </div>
  );
}
