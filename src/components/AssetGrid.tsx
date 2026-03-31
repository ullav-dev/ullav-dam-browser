"use client";

import type { Asset } from "@/lib/dam-api";
import { thumbnailUrl } from "@/lib/dam-api";

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

function ThumbnailImage({ id, name }: { id: string; name: string }) {
  return (
    <img
      src={thumbnailUrl(id)}
      alt={name}
      className="w-full h-full object-cover"
      onError={(e) => {
        const target = e.currentTarget;
        target.style.display = "none";
        const parent = target.parentElement;
        if (parent && !parent.querySelector(".fallback-icon")) {
          const div = document.createElement("div");
          div.className =
            "fallback-icon w-full h-full flex items-center justify-center text-4xl text-slate-300 bg-slate-50";
          div.textContent = "🖼";
          parent.appendChild(div);
        }
      }}
    />
  );
}

interface Props {
  assets: Asset[];
  assetCategories: Map<string, string[]>;
  selectedCategoryId: string | null;
  searchQuery: string;
  selectedAssetId: string | null;
  onSelect: (asset: Asset) => void;
}

export default function AssetGrid({
  assets,
  assetCategories,
  selectedCategoryId,
  searchQuery,
  selectedAssetId,
  onSelect,
}: Props) {
  const filtered = assets.filter((asset) => {
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
      if (cats === undefined) return true; // categories not loaded yet — show optimistically
      return cats.includes(selectedCategoryId);
    }
    return true;
  });

  if (filtered.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
        {searchQuery || selectedCategoryId ? "No assets match the current filter." : "No assets yet."}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
        {filtered.map((asset) => (
          <div
            key={asset.id}
            onClick={() => onSelect(asset)}
            className={`cursor-pointer rounded-xl border overflow-hidden transition-all hover:shadow-md group ${
              selectedAssetId === asset.id
                ? "border-blue-500 ring-2 ring-blue-200 shadow-md"
                : "border-slate-200 hover:border-blue-300"
            }`}
          >
            <div className="aspect-square bg-slate-100 relative overflow-hidden">
              <ThumbnailImage id={asset.id} name={asset.name} />
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
                <AssetTypeBadge type={asset.asset_type} />
                <span className="text-[10px] text-slate-400">{formatSize(asset.size)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
