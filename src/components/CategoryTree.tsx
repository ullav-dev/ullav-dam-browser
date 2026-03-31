"use client";

import { useState } from "react";
import type { Category } from "@/lib/dam-api";

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

// Shared drag context passed through the tree to avoid prop-drilling
interface DragCtx {
  draggingAssetId: string | null;
  draggingAssetCategoryIds: string[];
  dragOverId: string | null;
  setDragOverId: (id: string | null) => void;
  onCategoryDrop: (assetId: string, categoryId: string) => void;
}

function TreeNodeItem({
  node,
  selectedId,
  onSelect,
  drag,
  depth = 0,
}: {
  node: TreeNode;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  drag: DragCtx;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedId === node.id;
  const isDragging = drag.draggingAssetId !== null;
  const isDragOver = drag.dragOverId === node.id;
  const alreadyAssigned =
    isDragging && drag.draggingAssetCategoryIds.includes(node.id);
  const canDrop = isDragging && !alreadyAssigned;

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = canDrop ? "copy" : "none";
    if (drag.dragOverId !== node.id) drag.setDragOverId(node.id);
  }

  function handleDragLeave(e: React.DragEvent) {
    // Only clear if the pointer has truly left this element (not entered a child)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      drag.setDragOverId(null);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    drag.setDragOverId(null);
    if (canDrop && drag.draggingAssetId) {
      drag.onCategoryDrop(drag.draggingAssetId, node.id);
    }
  }

  // Compute visual class for the row
  let rowCls: string;
  if (isDragOver) {
    rowCls = canDrop
      ? "bg-green-50 ring-1 ring-green-400 text-green-800 font-medium"
      : "bg-amber-50 ring-1 ring-amber-300 text-amber-700";
  } else if (isSelected) {
    rowCls = "bg-blue-100 text-blue-800 font-medium";
  } else if (isDragging && alreadyAssigned) {
    rowCls = "text-slate-400 cursor-not-allowed";
  } else {
    rowCls = "text-slate-700 hover:bg-slate-100";
  }

  return (
    <div>
      <div
        className={`flex items-center gap-1 py-1.5 rounded-md text-sm transition-colors ${rowCls} ${
          isDragging && canDrop ? "cursor-copy" : "cursor-pointer"
        }`}
        style={{ paddingLeft: `${8 + depth * 16}px`, paddingRight: "8px" }}
        onClick={() => !isDragging && onSelect(isSelected ? null : node.id)}
        onDragOver={isDragging ? handleDragOver : undefined}
        onDragLeave={isDragging ? handleDragLeave : undefined}
        onDrop={isDragging ? handleDrop : undefined}
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

        {/* Drop feedback indicator */}
        {isDragOver && (
          <span className="shrink-0 text-[10px] font-semibold ml-1">
            {canDrop ? (
              <span className="text-green-700">+ Add</span>
            ) : (
              <span className="text-amber-600">✓ Already added</span>
            )}
          </span>
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
              drag={drag}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface Props {
  categories: Category[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  assetCounts?: Map<string, number>;
  // Drag-and-drop
  draggingAssetId?: string | null;
  draggingAssetCategoryIds?: string[];
  onCategoryDrop?: (assetId: string, categoryId: string) => void;
}

export default function CategoryTree({
  categories,
  selectedId,
  onSelect,
  assetCounts,
  draggingAssetId = null,
  draggingAssetCategoryIds = [],
  onCategoryDrop,
}: Props) {
  const tree = buildTree(categories);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const isDragging = draggingAssetId !== null;

  const drag: DragCtx = {
    draggingAssetId,
    draggingAssetCategoryIds,
    dragOverId,
    setDragOverId,
    onCategoryDrop: onCategoryDrop ?? (() => {}),
  };

  return (
    <div
      className={`space-y-0.5 transition-colors rounded-lg ${
        isDragging ? "ring-1 ring-blue-200 bg-blue-50/30 p-1" : ""
      }`}
    >
      {/* "All Assets" — not a valid drop target */}
      <div
        className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors ${
          selectedId === null
            ? "bg-blue-100 text-blue-800 font-medium"
            : "text-slate-700 hover:bg-slate-100"
        } ${isDragging ? "pointer-events-none opacity-40" : ""}`}
        onClick={() => onSelect(null)}
      >
        <span className="w-4 shrink-0 text-center text-xs text-slate-400">◉</span>
        <span>All Assets</span>
        {assetCounts !== undefined && (
          <span className="ml-auto text-xs text-slate-400">
            {assetCounts.get("__all__") ?? 0}
          </span>
        )}
      </div>

      {tree.map((node) => (
        <TreeNodeItem
          key={node.id}
          node={node}
          selectedId={selectedId}
          onSelect={onSelect}
          drag={drag}
          depth={0}
        />
      ))}
    </div>
  );
}
