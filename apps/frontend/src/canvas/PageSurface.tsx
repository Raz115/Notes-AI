import { useEffect, useRef } from "react";
import {
  PAGE_DIMENSIONS, type ActiveToolType, type CanvasObject, type Page,
  type StrokeObject, type StrokeStyle, type ViewportState,
} from "@ai-notes/shared";
import type { ObjectTool, ShapeKind } from "../components/ObjectToolbar.js";
import { EraserCursor } from "./EraserCursor.js";
import { ObjectLayer } from "./ObjectLayer.js";
import { renderPaperTemplate } from "./renderers/paperTemplateRenderer.js";
import { renderLiveStroke, renderStrokeObject } from "./renderers/strokeRenderer.js";
import { useStrokeInput, type UseStrokeInputProps } from "./useStrokeInput.js";

interface PageSurfaceProps {
  page: Page;
  offsetX: number;
  offsetY: number;
  viewport: ViewportState;
  strokes: StrokeObject[];
  objects?: CanvasObject[];
  onObjectsChange?: (update: CanvasObject[] | ((previous: CanvasObject[]) => CanvasObject[]), recordHistory?: boolean) => void;
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
  onActivate?: (id: string) => void;
  activeStyle: StrokeStyle;
  activeTool: ActiveToolType;
  isPanningActive: boolean;
}

export function PageSurface({
  page, offsetX, offsetY, viewport, strokes, objects, onObjectsChange, objectTool, shapeKind, shapeFilled = false,
  selectedIds, onSelectionChange, onObjectGestureStart, onObjectGestureEnd, onStrokeComplete,
  onEraseStart, onEraseAtPoint, onEraseEnd, onActivate, activeStyle, activeTool, isPanningActive,
}: PageSurfaceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dimensions = PAGE_DIMENSIONS[page.size][page.orientation];
  const { livePoints, cursorPos, handlePointerDown, handlePointerMove, handlePointerLeave,
    handlePointerUp, handlePointerCancel } = useStrokeInput({
      pageId: page.id, viewport, style: activeStyle, activeTool, onStrokeComplete,
      onEraseStart, onEraseAtPoint, onEraseEnd, isPanningActive,
    });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const targetWidth = Math.round(dimensions.width * dpr);
    const targetHeight = Math.round(dimensions.height * dpr);
    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);
    renderPaperTemplate(ctx, { template: page.template, dimensions });
    for (const stroke of strokes) renderStrokeObject(ctx, stroke);
    if (livePoints.length) {
      const strokeType = activeTool === "pencil" ? "pencil-stroke" :
        activeTool === "highlighter" ? "highlighter-stroke" : "pen-stroke";
      renderLiveStroke(ctx, livePoints, activeStyle, strokeType);
    }
    ctx.restore();
  }, [page.template, dimensions, strokes, livePoints, activeStyle, activeTool]);

  return (
    <div className="paper-sheet-container"
      style={{ left: offsetX, top: offsetY, width: dimensions.width, height: dimensions.height }}
      data-testid="paper-sheet" data-page-id={page.id} onPointerDownCapture={() => onActivate?.(page.id)}>
      <canvas ref={canvasRef} className="paper-canvas"
        style={{ width: dimensions.width, height: dimensions.height }}
        onPointerDown={handlePointerDown} onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave} onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel} onLostPointerCapture={handlePointerCancel}
        data-testid="drawing-canvas" />
      {objects && onObjectsChange && shapeKind && selectedIds && onSelectionChange &&
        onObjectGestureStart && onObjectGestureEnd && (
          <ObjectLayer pageId={page.id} zoom={viewport.zoom} width={dimensions.width}
            height={dimensions.height} objects={objects}
            tool={isPanningActive ? null : objectTool ?? null} shape={shapeKind} shapeFilled={shapeFilled} style={activeStyle}
            selectedIds={selectedIds} onSelect={onSelectionChange} onChange={onObjectsChange}
            beginGesture={onObjectGestureStart} endGesture={onObjectGestureEnd} />
        )}
      <div className="paper-overlay-layer" style={{ width: dimensions.width, height: dimensions.height }}>
        <EraserCursor activeTool={activeTool} thickness={activeStyle.thickness} cursorPos={objectTool ? null : cursorPos} />
      </div>
    </div>
  );
}
