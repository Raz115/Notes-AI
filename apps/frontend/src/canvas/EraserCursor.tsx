import type { ActiveToolType, ViewportState } from "@ai-notes/shared";

export interface EraserCursorProps {
  activeTool: ActiveToolType;
  thickness: number;
  viewport: ViewportState;
  cursorPos: { x: number; y: number } | null;
}

export function EraserCursor({
  activeTool,
  thickness,
  viewport,
  cursorPos,
}: EraserCursorProps) {
  if (
    (activeTool !== "eraser-partial" && activeTool !== "eraser-stroke") ||
    !cursorPos
  ) {
    return null;
  }

  // Display radius on screen is page-space radius * viewport zoom
  const displayRadius = Math.max(4, (thickness / 2) * viewport.zoom);
  const displayDiameter = displayRadius * 2;

  return (
    <div
      className="eraser-cursor-ring"
      style={{
        left: `${cursorPos.x}px`,
        top: `${cursorPos.y}px`,
        width: `${displayDiameter}px`,
        height: `${displayDiameter}px`,
      }}
      aria-hidden="true"
    />
  );
}
