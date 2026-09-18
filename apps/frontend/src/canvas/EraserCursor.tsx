import type { ActiveToolType, Point } from "@ai-notes/shared";

export interface EraserCursorProps {
  activeTool: ActiveToolType;
  thickness: number;
  cursorPos: Point | null;
}

export function EraserCursor({
  activeTool,
  thickness,
  cursorPos,
}: EraserCursorProps) {
  if (
    (activeTool !== "eraser-partial" && activeTool !== "eraser-stroke") ||
    !cursorPos
  ) {
    return null;
  }

  // Eraser ring positioning in page-space units.
  // The outer .paper-sheet-container handles CSS scale and pan transforms automatically,
  // guaranteeing 100% calibration between the visual cursor ring and the erased stroke points.
  return (
    <div
      className="eraser-cursor-ring"
      style={{
        left: `${cursorPos.x}px`,
        top: `${cursorPos.y}px`,
        width: `${thickness}px`,
        height: `${thickness}px`,
      }}
      aria-hidden="true"
    />
  );
}
