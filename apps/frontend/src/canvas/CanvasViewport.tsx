import { useEffect, useRef, useState } from "react";
import {
  PAGE_DIMENSIONS,
  type ActiveToolType,
  type Page,
  type Point,
  type StrokeObject,
  type StrokeStyle,
} from "@ai-notes/shared";
import { useViewport } from "./useViewport.js";
import { useStrokeInput } from "./useStrokeInput.js";
import { renderPaperTemplate } from "./renderers/paperTemplateRenderer.js";
import {
  renderLiveStroke,
  renderStrokeObject,
} from "./renderers/strokeRenderer.js";
import { EraserCursor } from "./EraserCursor.js";

export interface CanvasViewportProps {
  page: Page;
  strokes: StrokeObject[];
  onStrokeComplete: (stroke: StrokeObject) => void;
  onEraseStart?: () => void;
  onEraseAtPoint?: (eraserPoint: Point, radius: number, isStrokeEraser: boolean) => void;
  onEraseEnd?: () => void;
  activeStyle: StrokeStyle;
  activeTool: ActiveToolType;
  onViewportChange?: (zoom: number) => void;
  viewportControlsRef?: React.MutableRefObject<{
    zoomIn: () => void;
    zoomOut: () => void;
    resetZoom: () => void;
    fitPage: () => void;
  } | null>;
}

export function CanvasViewport({
  page,
  strokes,
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
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const pageDimensions = PAGE_DIMENSIONS[page.size][page.orientation];

  const {
    viewport,
    panBy,
    zoomTo,
    zoomIn,
    zoomOut,
    resetZoom,
    centerPage,
  } = useViewport();

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
              clientHeight
            );
          }
        },
      };
    }
  }, [
    viewportControlsRef,
    zoomIn,
    zoomOut,
    resetZoom,
    centerPage,
    pageDimensions,
  ]);

  // Report zoom changes
  useEffect(() => {
    onViewportChange?.(viewport.zoom);
  }, [viewport.zoom, onViewportChange]);

  // Initial centering
  useEffect(() => {
    if (containerRef.current) {
      const { clientWidth, clientHeight } = containerRef.current;
      centerPage(
        pageDimensions.width,
        pageDimensions.height,
        clientWidth,
        clientHeight
      );
    }
  }, [page.size, page.orientation, centerPage, pageDimensions]);

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

  // Wheel handling for zoom & pan
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();

    if (e.ctrlKey || e.metaKey) {
      const containerRect = e.currentTarget.getBoundingClientRect();
      const anchorScreenPoint = {
        x: e.clientX - containerRect.left,
        y: e.clientY - containerRect.top,
      };

      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      zoomTo(viewport.zoom * zoomFactor, anchorScreenPoint);
    } else {
      panBy(-e.deltaX, -e.deltaY);
    }
  };

  // Stroke input handling on the paper surface
  const {
    livePoints,
    cursorPos,
    handlePointerDown: onCanvasPointerDown,
    handlePointerMove: onCanvasPointerMove,
    handlePointerLeave: onCanvasPointerLeave,
    handlePointerUp: onCanvasPointerUp,
    handlePointerCancel: onCanvasPointerCancel,
  } = useStrokeInput({
    pageId: page.id,
    viewport,
    style: activeStyle,
    activeTool,
    onStrokeComplete,
    onEraseStart,
    onEraseAtPoint,
    onEraseEnd,
    isPanningActive: isSpacePressed || isPanning,
  });

  // Render loop to canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const targetWidth = Math.round(pageDimensions.width * dpr);
    const targetHeight = Math.round(pageDimensions.height * dpr);

    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.scale(dpr, dpr);

    // 1. Draw paper background and ruled lines
    renderPaperTemplate(ctx, {
      template: page.template,
      dimensions: pageDimensions,
    });

    // 2. Draw existing strokes
    for (const stroke of strokes) {
      renderStrokeObject(ctx, stroke);
    }

    // 3. Draw in-progress live stroke
    if (livePoints.length > 0) {
      let liveStrokeType: "pen-stroke" | "pencil-stroke" | "highlighter-stroke" = "pen-stroke";
      if (activeTool === "pencil") liveStrokeType = "pencil-stroke";
      if (activeTool === "highlighter") liveStrokeType = "highlighter-stroke";

      renderLiveStroke(ctx, livePoints, activeStyle, liveStrokeType);
    }

    ctx.restore();
  }, [
    page.template,
    pageDimensions,
    strokes,
    livePoints,
    activeStyle,
    activeTool,
  ]);

  const isEraser = activeTool === "eraser-partial" || activeTool === "eraser-stroke";
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
      onWheel={handleWheel}
      onPointerDown={handleContainerPointerDown}
      onPointerMove={handleContainerPointerMove}
      onPointerUp={handleContainerPointerUp}
      onPointerCancel={handleContainerPointerUp}
      data-testid="canvas-workspace"
    >
      {/* Transformed Page Sheet Container */}
      <div
        className="paper-sheet-container"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          transformOrigin: "0 0",
          width: pageDimensions.width,
          height: pageDimensions.height,
        }}
        data-testid="paper-sheet"
      >
        {/* Base Canvas Layer */}
        <canvas
          ref={canvasRef}
          className="paper-canvas"
          style={{
            width: pageDimensions.width,
            height: pageDimensions.height,
          }}
          onPointerDown={onCanvasPointerDown}
          onPointerMove={onCanvasPointerMove}
          onPointerLeave={onCanvasPointerLeave}
          onPointerUp={onCanvasPointerUp}
          onPointerCancel={onCanvasPointerCancel}
          data-testid="drawing-canvas"
        />

        {/* Overlay DOM Layer */}
        <div
          className="paper-overlay-layer"
          style={{
            width: pageDimensions.width,
            height: pageDimensions.height,
          }}
        >
          <EraserCursor
            activeTool={activeTool}
            thickness={activeStyle.thickness}
            cursorPos={cursorPos}
          />
        </div>
      </div>
    </div>
  );
}
