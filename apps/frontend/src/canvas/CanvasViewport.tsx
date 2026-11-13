import { useEffect, useRef, useState } from "react";
import {
  PAGE_DIMENSIONS,
  clamp,
  MIN_ZOOM,
  type ActiveToolType,
  type CanvasObject,
  type Page,
  type StrokeObject,
  type StrokeStyle,
} from "@ai-notes/shared";
import { useViewport } from "./useViewport.js";
import type { UseStrokeInputProps } from "./useStrokeInput.js";
import { PageSurface } from "./PageSurface.js";
import type { ObjectTool, ShapeKind } from "../components/ObjectToolbar.js";

export interface CanvasViewportProps {
  page: Page;
  pages?: Page[];
  onPageActivate?: (id: string) => void;
  onAppendPage?: () => void;
  onPageEraseAtPoint?: (
    pageId: string,
    ...args: Parameters<NonNullable<UseStrokeInputProps["onEraseAtPoint"]>>
  ) => void;
  strokes: StrokeObject[];
  objects?: CanvasObject[];
  onObjectsChange?: (
    update: CanvasObject[] | ((previous: CanvasObject[]) => CanvasObject[]),
    recordHistory?: boolean,
  ) => void;
  objectTool?: ObjectTool | null;
  shapeKind?: ShapeKind;
  shapeFilled?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  onObjectGestureStart?: () => void;
  onObjectGestureEnd?: () => void;
  onStrokeComplete: (stroke: StrokeObject) => void;
  onEraseStart?: () => void;
  onEraseAtPoint?: UseStrokeInputProps["onEraseAtPoint"];
  onEraseEnd?: () => void;
  activeStyle: StrokeStyle;
  activeTool: ActiveToolType;
  onViewportChange?: (zoom: number) => void;
  viewportControlsRef?: React.MutableRefObject<{
    zoomIn: () => void;
    zoomOut: () => void;
    resetZoom: () => void;
    fitPage: () => void;
    goToPage?: (pageId: string) => void;
  } | null>;
}

export function CanvasViewport({
  page,
  pages,
  onPageActivate,
  onAppendPage,
  onPageEraseAtPoint,
  strokes,
  objects,
  onObjectsChange,
  objectTool,
  shapeKind,
  shapeFilled,
  selectedIds,
  onSelectionChange,
  onObjectGestureStart,
  onObjectGestureEnd,
  onStrokeComplete,
  onEraseStart,
  onEraseAtPoint,
  onEraseEnd,
  activeStyle,
  activeTool,
  onViewportChange,
  viewportControlsRef,
}: CanvasViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const pageDimensions = PAGE_DIMENSIONS[page.size][page.orientation];
  const documentPages = pages ?? [page];
  const documentWidth = Math.max(...documentPages.map((item) => PAGE_DIMENSIONS[item.size][item.orientation].width));
  let nextOffset = 0;
  const layouts = documentPages.map((item) => {
    const dimensions = PAGE_DIMENSIONS[item.size][item.orientation];
    const layout = { page: item, x: (documentWidth - dimensions.width) / 2, y: nextOffset };
    nextOffset += dimensions.height + 28;
    return layout;
  });
  const activeLayout = layouts.find((layout) => layout.page.id === page.id);
  const documentHeight = Math.max(0, nextOffset - 28);
  const lastPageId = documentPages[documentPages.length - 1]?.id;

  const { viewport, setViewport, panBy, zoomTo, zoomIn, zoomOut, resetZoom, centerPage } =
    useViewport();
  const viewportRef = useRef(viewport);
  const appendGestureRef = useRef<{ lastWheelAt: number; requested: boolean; pageId: string | null }>({
    lastWheelAt: 0, requested: false, pageId: null,
  });
  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);
  useEffect(() => {
    if (appendGestureRef.current.pageId !== lastPageId) appendGestureRef.current.pageId = null;
  }, [lastPageId]);

  // Expose viewport controls to parent toolbar
  useEffect(() => {
    if (viewportControlsRef) {
      viewportControlsRef.current = {
        zoomIn,
        zoomOut,
        resetZoom,
        fitPage: () => {
          if (containerRef.current) {
            const { clientWidth, clientHeight } = containerRef.current;
            centerPage(
              pageDimensions.width,
              pageDimensions.height,
              clientWidth,
              clientHeight,
            );
            if (activeLayout) {
              setViewport((previous) => ({
                ...previous,
                x: previous.x - activeLayout.x * previous.zoom,
                y: previous.y - activeLayout.y * previous.zoom,
              }));
            }
          }
        },
        goToPage: (pageId) => {
          const target = layouts.find((layout) => layout.page.id === pageId);
          if (target) setViewport((previous) => ({
            ...previous,
            y: 36 - target.y * previous.zoom,
          }));
        },
      };
    }
  }, [viewportControlsRef, zoomIn, zoomOut, resetZoom, centerPage, pageDimensions,
    activeLayout?.x, activeLayout?.y, setViewport, pages]);

  // Report zoom changes
  useEffect(() => {
    onViewportChange?.(viewport.zoom);
  }, [viewport.zoom, onViewportChange]);

  // Open at a readable page width; the separate fit control shows the entire page.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const fitWidth = () => {
      const { clientWidth, clientHeight } = container;
      if (clientWidth <= 0 || clientHeight <= 0) return;
      const zoom = clamp((clientWidth - 72) / documentWidth, MIN_ZOOM, 1);
      setViewport({
        x: (clientWidth - documentWidth * zoom) / 2,
        y: 36,
        zoom,
      });
    };
    fitWidth();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(fitWidth);
    observer.observe(container);
    return () => observer.disconnect();
  }, [documentWidth, setViewport]);

  // Panning state (Middle mouse or Space + Left click drag)
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Spacebar hotkey listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (
        activeTag === "input" ||
        activeTag === "textarea" ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      if (e.code === "Space" && !e.repeat && !isSpacePressed) {
        e.preventDefault();
        setIsSpacePressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsSpacePressed(false);
        setIsPanning(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isSpacePressed]);

  // Pan interaction on the viewport background
  const handleContainerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button === 1 || (e.button === 0 && isSpacePressed)) {
      e.preventDefault();
      setIsPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY };
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const handleContainerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPanning) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    panStartRef.current = { x: e.clientX, y: e.clientY };
    panBy(dx, dy);
  };

  const handleContainerPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isPanning) {
      setIsPanning(false);
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    }
  };

  // React's passive wheel listener cannot cancel browser scrolling/zooming.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const current = viewportRef.current;
      if (event.ctrlKey || event.metaKey) {
        const rect = container.getBoundingClientRect();
        const anchor = { x: event.clientX - rect.left, y: event.clientY - rect.top };
        zoomTo(current.zoom * (event.deltaY < 0 ? 1.08 : 0.92), anchor);
      } else {
        const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? container.clientHeight : 1;
        const dx = event.deltaX * unit;
        const dy = event.deltaY * unit;
        const gesture = appendGestureRef.current;
        const now = Date.now();
        if (now - gesture.lastWheelAt > 350) gesture.requested = false;
        gesture.lastWheelAt = now;
        if (gesture.requested && dy > 0) return;
        const next = { ...current, x: current.x - dx, y: current.y - dy };
        viewportRef.current = next;
        setViewport(next);
        const restingBottom = Math.min(container.clientHeight - 36, 36 + documentHeight * next.zoom);
        // Require 240 screen pixels of overscroll, and only append once per wheel gesture.
        if (onAppendPage && lastPageId && container.clientHeight > 0 &&
          dy > 0 && Math.abs(dy) > Math.abs(dx) && !gesture.requested &&
          gesture.pageId !== lastPageId && next.y + documentHeight * next.zoom <= restingBottom - 240) {
          gesture.requested = true;
          gesture.pageId = lastPageId;
          onAppendPage();
        }
      }
    };
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [documentHeight, lastPageId, onAppendPage, setViewport, zoomTo]);

  const isEraser = !objectTool && (activeTool === "eraser-partial" || activeTool === "eraser-stroke");
  const cursorClass = isPanning
    ? "cursor-grabbing"
    : isSpacePressed
      ? "cursor-grab"
      : isEraser
        ? "cursor-none"
        : "cursor-crosshair";

  return (
    <div
      ref={containerRef}
      className={`canvas-workspace ${cursorClass}`}
      onPointerDown={handleContainerPointerDown}
      onPointerMove={handleContainerPointerMove}
      onPointerUp={handleContainerPointerUp}
      onPointerCancel={handleContainerPointerUp}
      data-testid="canvas-workspace"
    >
      <div
        className="paper-document"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          transformOrigin: "0 0",
          width: documentWidth,
          height: documentHeight,
        }}
      >
        {layouts.map((layout) => (
          <PageSurface key={layout.page.id} page={layout.page} offsetX={layout.x} offsetY={layout.y}
            viewport={viewport} strokes={strokes.filter((stroke) => stroke.pageId === layout.page.id)}
            objects={objects?.filter((object) => object.pageId === layout.page.id)}
            onObjectsChange={onObjectsChange} objectTool={objectTool} shapeKind={shapeKind} shapeFilled={shapeFilled}
            selectedIds={selectedIds} onSelectionChange={onSelectionChange}
            onObjectGestureStart={onObjectGestureStart} onObjectGestureEnd={onObjectGestureEnd}
            onStrokeComplete={onStrokeComplete} onEraseStart={onEraseStart}
            onEraseAtPoint={onPageEraseAtPoint
              ? (...args) => onPageEraseAtPoint(layout.page.id, ...args) : onEraseAtPoint}
            onEraseEnd={onEraseEnd} onActivate={onPageActivate}
            activeStyle={activeStyle} activeTool={activeTool}
            isPanningActive={isSpacePressed || isPanning} />
        ))}
      </div>
    </div>
  );
}
