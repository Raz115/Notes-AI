import { describe, expect, it } from "vitest";
import type { StrokeObject } from "@ai-notes/shared";
import { recognizeShape } from "./recognizeShape.js";

const stroke: StrokeObject = {
  id: "s", pageId: "p", type: "pen-stroke", x: 0, y: 0, width: 100, height: 100,
  rotation: 0, zIndex: 1, createdAt: "now", updatedAt: "now", source: "user",
  style: { color: "#123456", thickness: 2, opacity: 1 },
  points: [{ x: 0, y: 0 }, { x: 50, y: 1 }, { x: 100, y: 0 }],
};

describe("shape cleanup", () => {
  it("recognizes a straight line but leaves unrecognized strokes untouched", () => {
    expect(recognizeShape(stroke)).toMatchObject({ type: "line", x1: 0, y1: 0, x2: 100, y2: 0,
      style: { opacity: 1 } });
    expect(recognizeShape({ ...stroke, points: [{ x: 0, y: 0 }, { x: 50, y: 50 }, { x: 100, y: 0 }] })).toBeNull();
  });

  it("recognizes a closed rectangle", () => {
    const points = [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 },
      { x: 100, y: 50 }, { x: 100, y: 100 }, { x: 50, y: 100 },
      { x: 0, y: 100 }, { x: 0, y: 50 }, { x: 0, y: 0 }];
    expect(recognizeShape({ ...stroke, points })).toMatchObject({ type: "rectangle", width: 100, height: 100 });
  });

  it("recognizes an ellipse sampled around its perimeter", () => {
    const points = Array.from({ length: 17 }, (_, i) => {
      const angle = i * Math.PI / 8;
      return { x: 50 + 50 * Math.cos(angle), y: 30 + 30 * Math.sin(angle) };
    });
    expect(recognizeShape({ ...stroke, points })).toMatchObject({ type: "ellipse", width: 100, height: 60 });
  });
});
