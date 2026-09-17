import { getStroke } from "perfect-freehand";
import type { StrokeObject, StrokePoint, StrokeStyle } from "@ai-notes/shared";

/**
 * Options for perfect-freehand stroke geometry generation based on tool type.
 */
export function getStrokeOptions(
  style: StrokeStyle,
  toolType: "pen-stroke" | "pencil-stroke" | "highlighter-stroke" = "pen-stroke"
) {
  if (toolType === "highlighter-stroke") {
    return {
      size: style.thickness,
      thinning: 0,
      smoothing: 0.5,
      streamline: 0.55,
      simulatePressure: false,
      last: true,
    };
  }

  if (toolType === "pencil-stroke") {
    return {
      size: style.thickness,
      thinning: 0.35,
      smoothing: 0.45,
      streamline: 0.4,
      simulatePressure: true,
      last: true,
    };
  }

  // Standard Pen stroke
  return {
    size: style.thickness,
    thinning: 0.5,
    smoothing: 0.5,
    streamline: 0.55,
    simulatePressure: true,
    last: true,
  };
}

/**
 * Draws a stroke outline polygon onto a 2D canvas context.
 */
export function drawStrokeOutline(
  ctx: CanvasRenderingContext2D,
  outline: number[][],
  color: string,
  opacity = 1.0,
  compositeOperation: GlobalCompositeOperation = "source-over"
) {
  if (outline.length < 2) return;

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.globalCompositeOperation = compositeOperation;
  ctx.fillStyle = color;

  ctx.beginPath();
  const first = outline[0];
  if (!first) {
    ctx.restore();
    return;
  }

  ctx.moveTo(first[0] ?? 0, first[1] ?? 0);

  for (let i = 1; i < outline.length; i++) {
    const pt = outline[i];
    if (pt) {
      ctx.lineTo(pt[0] ?? 0, pt[1] ?? 0);
    }
  }

  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Renders a completed StrokeObject in page coordinates onto the given 2D canvas context.
 */
export function renderStrokeObject(
  ctx: CanvasRenderingContext2D,
  stroke: StrokeObject
) {
  if (stroke.points.length === 0) return;

  const isHighlighter = stroke.type === "highlighter-stroke";
  const options = getStrokeOptions(stroke.style, stroke.type);
  const outline = getStroke(stroke.points, options);

  drawStrokeOutline(
    ctx,
    outline,
    stroke.style.color,
    stroke.style.opacity,
    isHighlighter ? "multiply" : "source-over"
  );
}

/**
 * Renders an in-progress stroke (array of points) currently being drawn by the user.
 */
export function renderLiveStroke(
  ctx: CanvasRenderingContext2D,
  points: StrokePoint[],
  style: StrokeStyle,
  toolType: "pen-stroke" | "pencil-stroke" | "highlighter-stroke" = "pen-stroke"
) {
  if (points.length === 0) return;

  const isHighlighter = toolType === "highlighter-stroke";
  const options = getStrokeOptions(style, toolType);
  const outline = getStroke(points, options);

  drawStrokeOutline(
    ctx,
    outline,
    style.color,
    style.opacity,
    isHighlighter ? "multiply" : "source-over"
  );
}
