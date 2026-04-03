"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import type { Asset } from "@/lib/dam-api";
import {
  createAsset,
  uploadFile,
  addCategoryToAsset,
  updateAsset,
} from "@/lib/dam-api";

// ── Icons ─────────────────────────────────────────────────────────────────────

function IconCrop() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M6 2v14a2 2 0 0 0 2 2h14" />
      <path d="M18 22V8a2 2 0 0 0-2-2H2" />
    </svg>
  );
}

function IconRotateCcw() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 .49-4.6" />
    </svg>
  );
}

function IconRotateCw() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-.49-4.6" />
    </svg>
  );
}

function IconX() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Rotation = 0 | 90 | 180 | 270;

interface CropBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface ImgDisplay {
  x: number;
  y: number;
  w: number;
  h: number;
  scale: number;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  asset: Asset;
  assetCategoryIds: string[];
  token: string;
  username: string;
  onClose: () => void;
  onAssetCreated: (asset: Asset, categoryIds: string[]) => void;
  onAssetUpdated: (asset: Asset) => void;
}

const SUPPORTED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

export default function ImageEditorModal({
  asset,
  assetCategoryIds,
  token,
  username,
  onClose,
  onAssetCreated,
  onAssetUpdated,
}: Props) {
  const t = useTranslations("imageEditor");

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const imgDisplayRef = useRef<ImgDisplay | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  // Refs that mirror state — used inside the stable drawCanvas callback
  const rotationRef = useRef<Rotation>(0);
  const cropBoxRef = useRef<CropBox | null>(null);

  // State
  const [rotation, setRotation] = useState<Rotation>(0);
  const [cropBox, setCropBox] = useState<CropBox | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [cropMode, setCropMode] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [saving, setSaving] = useState<"new" | "replace" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ── Close on Escape ──────────────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // ── Load full image (authenticated fetch → object URL) ─────────────────────

  useEffect(() => {
    let cancelled = false;
    setImgLoaded(false);
    setImgError(false);

    fetch(`/api/assets/${asset.id}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        const img = new window.Image();
        img.onload = () => {
          if (cancelled) return;
          imageRef.current = img;
          setImgLoaded(true);
        };
        img.onerror = () => {
          if (!cancelled) setImgError(true);
        };
        img.src = url;
      })
      .catch(() => {
        if (!cancelled) setImgError(true);
      });

    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [asset.id, token]);

  // ── Canvas drawing ───────────────────────────────────────────────────────────

  // Stable draw function — reads from refs so it doesn't need to be recreated
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rot = rotationRef.current;
    const crop = cropBoxRef.current;
    const cw = canvas.width;
    const ch = canvas.height;

    ctx.clearRect(0, 0, cw, ch);
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, cw, ch);

    // Rotated image natural dimensions
    const isSwapped = rot === 90 || rot === 270;
    const rotW = isSwapped ? img.naturalHeight : img.naturalWidth;
    const rotH = isSwapped ? img.naturalWidth : img.naturalHeight;

    // Scale to fit canvas with padding
    const pad = 20;
    const scale = Math.min((cw - 2 * pad) / rotW, (ch - 2 * pad) / rotH);
    const dw = rotW * scale;
    const dh = rotH * scale;
    const dx = (cw - dw) / 2;
    const dy = (ch - dh) / 2;
    imgDisplayRef.current = { x: dx, y: dy, w: dw, h: dh, scale };

    // Draw image with rotation
    ctx.save();
    ctx.translate(dx + dw / 2, dy + dh / 2);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.drawImage(
      img,
      (-img.naturalWidth * scale) / 2,
      (-img.naturalHeight * scale) / 2,
      img.naturalWidth * scale,
      img.naturalHeight * scale,
    );
    ctx.restore();

    // Draw crop overlay
    if (crop) {
      const cx1 = Math.min(crop.x1, crop.x2);
      const cy1 = Math.min(crop.y1, crop.y2);
      const cx2 = Math.max(crop.x1, crop.x2);
      const cy2 = Math.max(crop.y1, crop.y2);
      const bw = cx2 - cx1;
      const bh = cy2 - cy1;

      // Dim area outside crop
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, 0, cw, cy1);
      ctx.fillRect(0, cy1, cx1, bh);
      ctx.fillRect(cx2, cy1, cw - cx2, bh);
      ctx.fillRect(0, cy2, cw, ch - cy2);

      // Crop border
      ctx.strokeStyle = "#60a5fa";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cx1, cy1, bw, bh);

      // Rule-of-thirds grid lines
      ctx.strokeStyle = "rgba(255,255,255,0.22)";
      ctx.lineWidth = 0.5;
      for (let i = 1; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(cx1 + (bw * i) / 3, cy1);
        ctx.lineTo(cx1 + (bw * i) / 3, cy2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx1, cy1 + (bh * i) / 3);
        ctx.lineTo(cx2, cy1 + (bh * i) / 3);
        ctx.stroke();
      }

      // Corner handles
      const hs = 8;
      ctx.fillStyle = "#60a5fa";
      for (const [hx, hy] of [
        [cx1, cy1], [cx2, cy1], [cx1, cy2], [cx2, cy2],
      ] as [number, number][]) {
        ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
      }
    }
  }, []); // stable — reads from refs

  // Sync state → refs and trigger redraw
  useEffect(() => {
    rotationRef.current = rotation;
    drawCanvas();
  }, [rotation, drawCanvas]);

  useEffect(() => {
    cropBoxRef.current = cropBox;
    drawCanvas();
  }, [cropBox, drawCanvas]);

  useEffect(() => {
    if (imgLoaded) drawCanvas();
  }, [imgLoaded, drawCanvas]);

  // Observe container size changes and resize canvas accordingly
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    function resize() {
      if (!container || !canvas) return;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      drawCanvas();
    }

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    return () => observer.disconnect();
  }, [drawCanvas]);

  // ── Crop mouse interaction ───────────────────────────────────────────────────

  function canvasPt(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  }

  function clampToImg(pt: { x: number; y: number }) {
    const d = imgDisplayRef.current;
    if (!d) return pt;
    return {
      x: Math.max(d.x, Math.min(d.x + d.w, pt.x)),
      y: Math.max(d.y, Math.min(d.y + d.h, pt.y)),
    };
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!cropMode) return;
    e.preventDefault();
    const pt = clampToImg(canvasPt(e));
    setDragStart(pt);
    setCropBox({ x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y });
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!dragStart || !cropMode) return;
    const pt = clampToImg(canvasPt(e));
    setCropBox({ x1: dragStart.x, y1: dragStart.y, x2: pt.x, y2: pt.y });
  }

  function handleMouseUp(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!dragStart || !cropMode) return;
    const pt = clampToImg(canvasPt(e));
    const box = { x1: dragStart.x, y1: dragStart.y, x2: pt.x, y2: pt.y };
    // Discard tiny accidental clicks
    if (Math.abs(box.x2 - box.x1) < 5 && Math.abs(box.y2 - box.y1) < 5) {
      setCropBox(null);
    } else {
      setCropBox(box);
    }
    setDragStart(null);
  }

  // ── Image processing ─────────────────────────────────────────────────────────

  const outputMime = SUPPORTED_MIME.has(asset.asset_type) ? asset.asset_type : "image/png";

  function outputFilename() {
    const ext =
      outputMime === "image/jpeg" ? "jpg"
      : outputMime === "image/webp" ? "webp"
      : "png";
    return asset.name.replace(/\.[^.]+$/, "") + "." + ext;
  }

  function blobFromCanvas(c: HTMLCanvasElement): Promise<Blob> {
    return new Promise<Blob>((resolve, reject) =>
      c.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
        outputMime,
        outputMime === "image/jpeg" ? 0.92 : undefined,
      ),
    );
  }

  async function getEditedBlob(): Promise<Blob> {
    const img = imageRef.current!;
    const rot = rotationRef.current;
    const crop = cropBoxRef.current;
    const d = imgDisplayRef.current;

    const isSwapped = rot === 90 || rot === 270;
    const rotW = isSwapped ? img.naturalHeight : img.naturalWidth;
    const rotH = isSwapped ? img.naturalWidth : img.naturalHeight;

    // Step 1: draw the full rotated image at its natural size
    const c1 = document.createElement("canvas");
    c1.width = rotW;
    c1.height = rotH;
    const ctx1 = c1.getContext("2d")!;
    ctx1.translate(rotW / 2, rotH / 2);
    ctx1.rotate((rot * Math.PI) / 180);
    ctx1.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

    // Step 2: apply crop (convert display coords → rotated-image pixel coords)
    if (crop && d) {
      const cx1 = (Math.min(crop.x1, crop.x2) - d.x) / d.scale;
      const cy1 = (Math.min(crop.y1, crop.y2) - d.y) / d.scale;
      const cx2 = (Math.max(crop.x1, crop.x2) - d.x) / d.scale;
      const cy2 = (Math.max(crop.y1, crop.y2) - d.y) / d.scale;
      const sx = Math.round(Math.max(0, cx1));
      const sy = Math.round(Math.max(0, cy1));
      const sw = Math.round(Math.min(cx2, rotW) - sx);
      const sh = Math.round(Math.min(cy2, rotH) - sy);
      if (sw > 0 && sh > 0) {
        const c2 = document.createElement("canvas");
        c2.width = sw;
        c2.height = sh;
        c2.getContext("2d")!.drawImage(c1, sx, sy, sw, sh, 0, 0, sw, sh);
        return blobFromCanvas(c2);
      }
    }
    return blobFromCanvas(c1);
  }

  // ── Save handlers ─────────────────────────────────────────────────────────────

  async function handleSaveAsNew() {
    setSaving("new");
    setError(null);
    try {
      const blob = await getEditedBlob();
      const file = new File([blob], outputFilename(), { type: outputMime });

      // Create asset record (creator = current session user)
      const created = await createAsset(
        {
          name: asset.name,
          description: asset.description,
          asset_type: outputMime,
          caption: asset.caption,
          keywords: asset.keywords,
          creator: username,
          copyright_notice: asset.copyright_notice,
          available: asset.available,
          available_until: asset.available_until,
        },
        token,
      );

      // Upload the edited file
      const uploaded = await uploadFile(created.id, file, token);

      // Mirror visibility settings from the original
      const finalAsset = await updateAsset(
        uploaded.id,
        {
          is_private: asset.is_private,
          public_read: asset.public_read,
          public_download: asset.public_download,
          public_write: asset.public_write,
        },
        token,
      );

      // Assign to the same categories as the original
      const results = await Promise.allSettled(
        assetCategoryIds.map((catId) =>
          addCategoryToAsset(finalAsset.id, catId, token).then(() => catId),
        ),
      );
      const assignedIds = results
        .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
        .map((r) => r.value);

      onAssetCreated(finalAsset, assignedIds);
      setSuccess(t("successNew"));
      setTimeout(onClose, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorCreate"));
    } finally {
      setSaving(null);
    }
  }

  async function handleReplace() {
    setSaving("replace");
    setError(null);
    try {
      const blob = await getEditedBlob();
      const file = new File([blob], outputFilename(), { type: outputMime });
      const updated = await uploadFile(asset.id, file, token);
      onAssetUpdated(updated);
      setSuccess(t("successReplace"));
      setTimeout(onClose, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorReplace"));
    } finally {
      setSaving(null);
    }
  }

  function handleReset() {
    setRotation(0);
    setCropBox(null);
    setCropMode(false);
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const isSaving = saving !== null;
  const hasEdits = rotation !== 0 || cropBox !== null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900">

      {/* ── Header toolbar ── */}
      <div className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 bg-slate-800 border-b border-slate-700">
        <h2 className="text-sm font-semibold text-white truncate max-w-xs mr-2">
          {asset.name}
        </h2>

        <div className="w-px h-5 bg-slate-600 mx-1" />

        {/* Crop toggle */}
        <button
          type="button"
          onClick={() => setCropMode((m) => !m)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            cropMode
              ? "bg-blue-600 text-white"
              : "text-slate-300 hover:bg-slate-700 hover:text-white"
          }`}
        >
          <IconCrop />
          {t("crop")}
        </button>

        {/* Rotate CCW */}
        <button
          type="button"
          onClick={() => setRotation((r) => (((r - 90) % 360 + 360) % 360) as Rotation)}
          title={t("rotateLeft")}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
        >
          <IconRotateCcw />
          <span className="hidden sm:inline">{t("rotateLeft")}</span>
        </button>

        {/* Rotate CW */}
        <button
          type="button"
          onClick={() => setRotation((r) => ((r + 90) % 360) as Rotation)}
          title={t("rotateRight")}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
        >
          <IconRotateCw />
          <span className="hidden sm:inline">{t("rotateRight")}</span>
        </button>

        {hasEdits && (
          <>
            <div className="w-px h-5 bg-slate-600 mx-1" />
            <button
              type="button"
              onClick={handleReset}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
            >
              {t("reset")}
            </button>
          </>
        )}

        <div className="flex-1" />

        {/* Close (×) */}
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
          title={t("cancel")}
        >
          <IconX />
        </button>
      </div>

      {/* ── Canvas area ── */}
      <div ref={containerRef} className="flex-1 overflow-hidden relative">
        {!imgLoaded && !imgError && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">
            {t("loading")}
          </div>
        )}
        {imgError && (
          <div className="absolute inset-0 flex items-center justify-center text-red-400 text-sm">
            {t("errorLoad")}
          </div>
        )}
        <canvas
          ref={canvasRef}
          className={`block w-full h-full${cropMode ? " cursor-crosshair" : ""}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
        {cropMode && !cropBox && imgLoaded && (
          <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-800/90 text-slate-300 text-xs px-3 py-1.5 rounded-lg shadow">
            {t("cropHint")}
          </div>
        )}
      </div>

      {/* ── Footer action bar ── */}
      <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 bg-slate-800 border-t border-slate-700">
        <div className="flex-1 min-w-0">
          {error && (
            <p className="text-xs text-red-400 truncate">{error}</p>
          )}
          {success && (
            <p className="text-xs text-green-400 truncate">{success}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-50 transition-colors"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={handleSaveAsNew}
            disabled={isSaving || !imgLoaded}
            title={t("saveAsNewTitle")}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white transition-colors"
          >
            {saving === "new" ? t("saving") : t("saveAsNew")}
          </button>
          <button
            type="button"
            onClick={handleReplace}
            disabled={isSaving || !imgLoaded}
            title={t("replaceTitle")}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-colors"
          >
            {saving === "replace" ? t("saving") : t("replace")}
          </button>
        </div>
      </div>
    </div>
  );
}
