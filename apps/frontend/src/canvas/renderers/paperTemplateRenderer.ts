import type { PageDimensions, PageTemplate } from "@ai-notes/shared";

export interface TemplateRenderOptions {
  template: PageTemplate;
  dimensions: PageDimensions;
  backgroundColor?: string;
  lineColor?: string;
  marginColor?: string;
}

/**
 * Draws the paper background and ruling lines (plain, lined, graph, notepad)
 * onto the 2D canvas context.
 */
export function renderPaperTemplate(
  ctx: CanvasRenderingContext2D,
  options: TemplateRenderOptions,
) {
  const { width, height } = options.dimensions;
  const bg = options.backgroundColor ?? "#ffffff";
  const lineColor = options.lineColor ?? "#e2e8f0";
  const marginColor = options.marginColor ?? "#fca5a5";

  ctx.save();

  // 1. Fill base paper sheet
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  ctx.lineWidth = 1;

  if (options.template === "lined") {
    ctx.strokeStyle = lineColor;
    const lineSpacing = 30;
    const topMargin = 80;

    ctx.beginPath();
    for (let y = topMargin; y < height - 20; y += lineSpacing) {
      ctx.moveTo(0, Math.floor(y) + 0.5);
      ctx.lineTo(width, Math.floor(y) + 0.5);
    }
    ctx.stroke();
  } else if (options.template === "graph") {
    ctx.strokeStyle = lineColor;
    const gridSize = 24;

    ctx.beginPath();
    // Vertical grid lines
    for (let x = gridSize; x < width; x += gridSize) {
      ctx.moveTo(Math.floor(x) + 0.5, 0);
      ctx.lineTo(Math.floor(x) + 0.5, height);
    }
    // Horizontal grid lines
    for (let y = gridSize; y < height; y += gridSize) {
      ctx.moveTo(0, Math.floor(y) + 0.5);
      ctx.lineTo(width, Math.floor(y) + 0.5);
    }
    ctx.stroke();
  } else if (options.template === "notepad") {
    const lineSpacing = 30;
    const topMargin = 80;
    const leftMargin = 90;

    // Horizontal notebook rules
    ctx.strokeStyle = lineColor;
    ctx.beginPath();
    for (let y = topMargin; y < height - 20; y += lineSpacing) {
      ctx.moveTo(0, Math.floor(y) + 0.5);
      ctx.lineTo(width, Math.floor(y) + 0.5);
    }
    ctx.stroke();

    // Red left margin line
    ctx.strokeStyle = marginColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(leftMargin + 0.5, 0);
    ctx.lineTo(leftMargin + 0.5, height);
    ctx.stroke();
  }

  ctx.restore();
}
