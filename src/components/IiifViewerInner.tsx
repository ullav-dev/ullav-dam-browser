"use client";

import { useEffect, useRef } from "react";
import type { Viewer as UniversalViewer } from "universalviewer";
import "universalviewer/dist/uv.css";

interface Props {
  manifestUrl: string;
}

export default function IiifViewerInner({ manifestUrl }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<UniversalViewer | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    import("universalviewer").then(({ init }) => {
      if (cancelled || !containerRef.current) return;
      viewerRef.current = init(containerRef.current, { iiifManifestId: manifestUrl });
    });

    return () => {
      cancelled = true;
      viewerRef.current?.dispose();
      viewerRef.current = null;
    };
  }, [manifestUrl]);

  return <div ref={containerRef} className="w-full h-full" />;
}
