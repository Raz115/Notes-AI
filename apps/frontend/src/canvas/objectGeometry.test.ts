import { describe, expect, it } from "vitest";
import type { ArrowObject, LineObject, PolygonObject, RectangleObject, StrokeObject, TextboxObject } from "@ai-notes/shared";
import { lassoSelect, selectionBounds, transformObjects, updateShapeStyle } from "./objectGeometry.js";

const base = {
  pageId: "page", rotation: 0, zIndex: 1, createdAt: "now", updatedAt: "now",
  source: "user" as const,
};
const stroke: StrokeObject = {
  ...base, id: "stroke", type: "pen-stroke", x: -1, y: -1, width: 102, height: 2,
  points: [{ x: 0, y: 0, pressure: 0.3 }, { x: 100, y: 0, pressure: 0.7 }],
  style: { color: "#000000", thickness: 2, opacity: 1 },
};
const textbox: TextboxObject = {
  ...base, id: "text", type: "textbox", x: 20, y: 20, width: 40, height: 30,
  text: "hello", font: "sans", fontSize: 16, bold: false, color: "#000000",
};

describe("object geometry", () => {
  it("selects crossed sparse strokes and textboxes inside a lasso", () => {
    const polygon = [{ x: 30, y: -10 }, { x: 70, y: -10 },
      { x: 70, y: 60 }, { x: 30, y: 60 }];
    expect(lassoSelect([stroke, textbox], polygon)).toEqual(["stroke", "text"]);
    expect(lassoSelect([stroke], polygon.slice(0, 2))).toEqual([]);
  });

  it("transforms canonical stroke points, bounds and textbox geometry", () => {
    const bounds = selectionBounds([stroke, textbox])!;
    const result = transformObjects([stroke, textbox], bounds,
      { x: bounds.x + 10, y: bounds.y + 20, width: bounds.width * 2, height: bounds.height * 2 });
    const movedStroke = result[0] as StrokeObject;
    const movedText = result[1] as TextboxObject;
    expect(movedStroke.points[0]).toEqual({ x: 11, y: 21, pressure: 0.3 });
    expect(movedStroke.points[1]?.x).toBe(211);
    expect(movedStroke.x).toBe(10);
    expect(movedStroke.width).toBe(202);
    expect(movedText.width).toBe(80);
    expect(movedText.height).toBe(60);
  });

  it("recalculates line, arrow and polygon bounds when their stroke width changes", () => {
    const line: LineObject = {
      ...base, id: "line", type: "line", x: 9, y: 19, width: 42, height: 22,
      x1: 10, y1: 20, x2: 50, y2: 40, style: { strokeColor: "#123456", strokeWidth: 2 },
    };
    const arrow: ArrowObject = { ...line, id: "arrow", type: "arrow" };
    const polygon: PolygonObject = {
      ...base, id: "polygon", type: "polygon", x: -1, y: -1, width: 22, height: 12,
      points: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 10, y: 10 }],
      style: { strokeColor: "#123456", strokeWidth: 2 },
    };
    for (const shape of [line, arrow]) {
      const updated = updateShapeStyle(shape, { strokeWidth: 10, opacity: 0.4 });
      expect(updated).toMatchObject({
        x: 5, y: 15, width: 50, height: 30, x1: 10, y1: 20, x2: 50, y2: 40,
        style: { strokeWidth: 10, opacity: 0.4 },
      });
      expect(updateShapeStyle(shape, { filled: true, opacity: 1 })).toBe(shape);
    }
    expect(updateShapeStyle(polygon, { strokeWidth: 10 })).toMatchObject({
      x: -5, y: -5, width: 30, height: 20, points: polygon.points,
    });
  });

  it("preserves geometry and unrelated style when changing the fill of a closed shape", () => {
    const rectangle: RectangleObject = {
      ...base, id: "rectangle", type: "rectangle", x: 10, y: 20, width: 50, height: 30,
      style: { strokeColor: "#123456", strokeWidth: 3, fillColor: "#abcdef" },
    };
    expect(updateShapeStyle(rectangle, { filled: true, opacity: 1 })).toBe(rectangle);
    const hollow = updateShapeStyle(rectangle, { filled: false });
    expect(hollow).toMatchObject({ x: 10, y: 20, width: 50, height: 30 });
    expect(hollow.style.fillColor).toBeUndefined();
    expect(updateShapeStyle(hollow, { filled: true }).style.fillColor).toBe("#123456");
  });
});
