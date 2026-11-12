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
  onEraseStart?: () => void;
  onEraseAtPoint?: (
    eraserPoint: Point,
    radius: number,
    isStrokeEraser: boolean,
    eraserEnd?: Point,
  ) => void;
  onEraseEnd?: () => void;
  isPanningActive?: boolean;
}

/**
 * Converts a pointer event on the canvas element to page-relative coordinates.
 */
function pointerToPage(
  e: React.PointerEvent<HTMLCanvasElement>,
  viewport: ViewportState,
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
  onEraseStart,
  onEraseAtPoint,
  onEraseEnd,
  isPanningActive = false,
}: UseStrokeInputProps) {
  const [livePoints, setLivePoints] = useState<StrokePoint[]>([]);
  const [cursorPos, setCursorPos] = useState<Point | null>(null);
  const isDrawingRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);
  const strokePointsRef = useRef<StrokePoint[]>([]);
  const previousErasePointRef = useRef<Point | null>(null);
  const gestureRef = useRef<{
    tool: ActiveToolType;
    style: StrokeStyle;
    pageId: string;
  } | null>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.button !== 0 || isPanningActive || isDrawingRef.current) return;

      const canvas = e.currentTarget;
      canvas.setPointerCapture?.(e.pointerId);

      isDrawingRef.current = true;
      activePointerIdRef.current = e.pointerId;
      gestureRef.current = { tool: activeTool, style: { ...style }, pageId };

      const pagePoint = pointerToPage(e, viewport);
      setCursorPos(pagePoint);

      if (activeTool === "eraser-partial" || activeTool === "eraser-stroke") {
        previousErasePointRef.current = pagePoint;
        onEraseStart?.();
        onEraseAtPoint?.(pagePoint, style.thickness / 2, activeTool === "eraser-stroke");
        return;
      }

      const pressure = e.pointerType === "pen" && e.pressure > 0 ? e.pressure : 0.85;

      const firstPoint: StrokePoint = {
        x: pagePoint.x,
        y: pagePoint.y,
        pressure,
      };

      strokePointsRef.current = [firstPoint];
      setLivePoints([firstPoint]);
    },
    [viewport, isPanningActive, onEraseStart, onEraseAtPoint, style, activeTool, pageId],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (isDrawingRef.current && e.pointerId !== activePointerIdRef.current) return;
      const pagePoint = pointerToPage(e, viewport);
      setCursorPos(pagePoint);

      if (!isDrawingRef.current || e.pointerId !== activePointerIdRef.current) {
        return;
      }

      const gesture = gestureRef.current;
      if (!gesture) return;
      if (gesture.tool === "eraser-partial" || gesture.tool === "eraser-stroke") {
        onEraseAtPoint?.(
          previousErasePointRef.current ?? pagePoint,
          gesture.style.thickness / 2,
          gesture.tool === "eraser-stroke",
          pagePoint,
        );
        previousErasePointRef.current = pagePoint;
        return;
      }

      const pressure = e.pointerType === "pen" && e.pressure > 0 ? e.pressure : 0.85;

      const nextPoint: StrokePoint = {
        x: pagePoint.x,
        y: pagePoint.y,
        pressure,
      };

      strokePointsRef.current.push(nextPoint);
      setLivePoints([...strokePointsRef.current]);
    },
    [viewport, onEraseAtPoint],
  );

  const handlePointerLeave = useCallback(() => {
    setCursorPos(null);
  }, []);

  const finishStroke = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>, includeEndPoint: boolean) => {
      if (!isDrawingRef.current || e.pointerId !== activePointerIdRef.current) {
        return;
      }

      const gesture = gestureRef.current;
      if (!gesture) return;
      isDrawingRef.current = false;
      activePointerIdRef.current = null;
      gestureRef.current = null;
      const canvas = e.currentTarget;
      if (canvas.hasPointerCapture?.(e.pointerId)) {
        canvas.releasePointerCapture?.(e.pointerId);
      }

      if (gesture.tool === "eraser-partial" || gesture.tool === "eraser-stroke") {
        const previous = previousErasePointRef.current;
        if (includeEndPoint && previous) {
          const end = pointerToPage(e, viewport);
          if (previous.x !== end.x || previous.y !== end.y) {
            onEraseAtPoint?.(
              previous,
              gesture.style.thickness / 2,
              gesture.tool === "eraser-stroke",
              end,
            );
          }
        }
        previousErasePointRef.current = null;
        strokePointsRef.current = [];
        setLivePoints([]);
        onEraseEnd?.();
        return;
      }

      const points = strokePointsRef.current;
      strokePointsRef.current = [];
      setLivePoints([]);

      if (points.length < 1) return;

      const last = points[points.length - 1];
      if (includeEndPoint && last) {
        const end = pointerToPage(e, viewport);
        if (last.x !== end.x || last.y !== end.y) {
          points.push({ ...end, pressure: last.pressure });
        }
      }
      const bbox = computeBoundingBox(points, gesture.style.thickness / 2);
      const now = new Date().toISOString();

      let strokeType: "pen-stroke" | "pencil-stroke" | "highlighter-stroke" =
        "pen-stroke";
      if (gesture.tool === "pencil") strokeType = "pencil-stroke";
      if (gesture.tool === "highlighter") strokeType = "highlighter-stroke";

      const newStroke: StrokeObject = {
        id: crypto.randomUUID(),
        pageId: gesture.pageId,
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
        style: gesture.style,
      };

      onStrokeComplete(newStroke);
    },
    [viewport, onStrokeComplete, onEraseAtPoint, onEraseEnd],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      finishStroke(e, true);
    },
    [finishStroke],
  );

  const handlePointerCancel = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      finishStroke(e, false);
    },
    [finishStroke],
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
