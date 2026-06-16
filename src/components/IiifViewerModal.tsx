"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";

const IiifViewerInner = dynamic(() => import("./IiifViewerInner"), { ssr: false });

interface Props {
  manifestUrl: string;
  assetName: string;
  onClose: () => void;
}

export function IiifViewerModal({ manifestUrl, assetName, onClose }: Props) {
  const t = useTranslations("assetDetails");

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label={assetName}
    >
      <div className="flex items-center justify-between px-4 py-2 shrink-0 border-b border-white/20">
        <span className="text-white/90 text-sm font-medium truncate max-w-lg">{assetName}</span>
        <button
          onClick={onClose}
          className="text-white/70 hover:text-white text-sm px-3 py-1 rounded border border-white/30 hover:border-white/60 transition-colors shrink-0 ml-4"
        >
          {t("iiifViewerClose")}
        </button>
      </div>
      <div className="flex-1 min-h-0">
        <IiifViewerInner manifestUrl={manifestUrl} />
      </div>
    </div>
  );
}
