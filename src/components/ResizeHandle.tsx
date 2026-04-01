"use client";

import { useRef, useCallback } from "react";

interface Props {
  /** Called on every mousemove while dragging; delta is pixels moved (positive = right). */
  onResize: (delta: number) => void;
}

/**
 * A thin vertical drag handle that sits between two adjacent panels.
 * It replaces the border between the panels — the parent should remove
 * border-r / border-l from the adjacent elements.
 */
export default function ResizeHandle({ onResize }: Props) {
  const isDragging = useRef(false);
  const lastX = useRef(0);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      lastX.current = e.clientX;

      const onMouseMove = (e: MouseEvent) => {
        if (!isDragging.current) return;
        const delta = e.clientX - lastX.current;
        lastX.current = e.clientX;
        onResize(delta);
      };

      const onMouseUp = () => {
        isDragging.current = false;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [onResize]
  );

  return (
    <div
      onMouseDown={onMouseDown}
      className="w-1 shrink-0 cursor-col-resize bg-slate-200 hover:bg-blue-400 active:bg-blue-500 transition-colors"
    />
  );
}
