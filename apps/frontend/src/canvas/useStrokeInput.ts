import { useCallback, useRef, useState } from "react";
import {
  computeBoundingBox,
  type ActiveToolType,
  type Point,
  type StrokeObject,
  type StrokePoint,
  type StrokeStyle,
  type ViewportState,
} from "@ai-notes/shared";

export interface UseStrokeInputProps {
  pageId: string;
  viewport: ViewportState;
  style: StrokeStyle;
  activeTool: ActiveToolType;
  onStrokeComplete: (stroke: StrokeObject) => void;
  onEraseAtPoint?: (eraserPoint: Point, radius: number, isStrokeEraser: boolean) => void;
  isPanningActive?: boolean;
}

/**
 * Converts a pointer event on the canvas element to page-relative coordinates.
 */
function pointerToPage(
  e: React.PointerEvent<HTMLCanvasElement>,
  viewport: ViewportState
): Point {
  const rect = e.currentTarget.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) / viewport.zoom,
    y: (e.clientY - rect.top) / viewport.zoom,
  };
}

export function useStrokeInput({
  pageId,
  viewport,
  style,
  activeTool,
  onStrokeComplete,
  onEraseAtPoint,
  isPanningActive = false,
}: UseStrokeInputProps) {
  const [livePoints, setLivePoints] = useState<StrokePoint[]>([]);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const isDrawingRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);
  const strokePointsRef = useRef<StrokePoint[]>([]);

  const isEraser = activeTool === "eraser-partial" || activeTool === "eraser-stroke";

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      // Primary button only (left click / stylus tip)
      if (e.button !== 0 || isPanningActive) return;

      const canvas = e.currentTarget;
      canvas.setPointerCapture?.(e.pointerId);

      isDrawingRef.current = true;
      activePointerIdRef.current = e.pointerId;

      const pagePoint = pointerToPage(e, viewport);
      const rect = canvas.getBoundingClientRect();
      setCursorPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });

      if (isEraser) {
        onEraseAtPoint?.(
          pagePoint,
          style.thickness / 2,
          activeTool === "eraser-stroke"
        );
        return;
      }

      const pressure =
        e.pointerType === "pen" && e.pressure > 0 ? e.pressure : 0.85;

      const firstPoint: StrokePoint = {
        x: pagePoint.x,
        y: pagePoint.y,
        pressure,
      };

      strokePointsRef.current = [firstPoint];
      setLivePoints([firstPoint]);
    },
    [viewport, isPanningActive, isEraser, onEraseAtPoint, style.thickness, activeTool]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      setCursorPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });

      if (!isDrawingRef.current || e.pointerId !== activePointerIdRef.current) {
        return;
      }

      const pagePoint = pointerToPage(e, viewport);

      if (isEraser) {
        onEraseAtPoint?.(
          pagePoint,
          style.thickness / 2,
          activeTool === "eraser-stroke"
        );
        return;
      }

      const pressure =
        e.pointerType === "pen" && e.pressure > 0 ? e.pressure : 0.85;

      const nextPoint: StrokePoint = {
        x: pagePoint.x,
        y: pagePoint.y,
        pressure,
      };

      strokePointsRef.current.push(nextPoint);
      setLivePoints([...strokePointsRef.current]);
    },
    [viewport, isEraser, onEraseAtPoint, style.thickness, activeTool]
  );

  const handlePointerLeave = useCallback(() => {
    setCursorPos(null);
  }, []);

  const finishStroke = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawingRef.current || e.pointerId !== activePointerIdRef.current) {
        return;
      }

      const canvas = e.currentTarget;
      if (canvas.hasPointerCapture?.(e.pointerId)) {
        canvas.releasePointerCapture?.(e.pointerId);
      }

      isDrawingRef.current = false;
      activePointerIdRef.current = null;

      if (isEraser) {
        strokePointsRef.current = [];
        setLivePoints([]);
        return;
      }

      const points = strokePointsRef.current;
      strokePointsRef.current = [];
      setLivePoints([]);

      if (points.length < 1) return;

      const bbox = computeBoundingBox(points, style.thickness / 2);
      const now = new Date().toISOString();

      let strokeType: "pen-stroke" | "pencil-stroke" | "highlighter-stroke" = "pen-stroke";
      if (activeTool === "pencil") strokeType = "pencil-stroke";
      if (activeTool === "highlighter") strokeType = "highlighter-stroke";

      const newStroke: StrokeObject = {
        id: crypto.randomUUID(),
        pageId,
        type: strokeType,
        x: bbox.x,
        y: bbox.y,
        width: bbox.width,
        height: bbox.height,
        rotation: 0,
        zIndex: Date.now(),
        createdAt: now,
        updatedAt: now,
        source: "user",
        points,
        style: { ...style },
      };

      onStrokeComplete(newStroke);
    },
    [pageId, style, activeTool, isEraser, onStrokeComplete]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      finishStroke(e);
    },
    [finishStroke]
  );

  const handlePointerCancel = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      finishStroke(e);
    },
    [finishStroke]
  );

  return {
    livePoints,
    cursorPos,
    handlePointerDown,
    handlePointerMove,
    handlePointerLeave,
    handlePointerUp,
    handlePointerCancel,
    isDrawing: isDrawingRef.current,
  };
}
