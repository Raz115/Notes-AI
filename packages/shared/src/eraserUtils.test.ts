import { describe, expect, it } from "vitest";
import type { StrokeObject } from "./canvas.js";
import {
  distanceToSegment,
  eraseStrokeObject,
  isStrokeIntersected,
} from "./eraserUtils.js";

describe("eraserUtils", () => {
  describe("distanceToSegment", () => {
    it("calculates perpendicular distance correctly", () => {
      const p = { x: 5, y: 5 };
      const a = { x: 0, y: 0 };
      const b = { x: 10, y: 0 };
      expect(distanceToSegment(p, a, b)).toBe(5);
    });

    it("calculates distance to segment endpoints when projection falls outside", () => {
      const p = { x: 15, y: 0 };
      const a = { x: 0, y: 0 };
      const b = { x: 10, y: 0 };
      expect(distanceToSegment(p, a, b)).toBe(5);
    });
  });

  describe("isStrokeIntersected", () => {
    const stroke: StrokeObject = {
      id: "stroke-1",
      pageId: "page-1",
      type: "pen-stroke",
      x: 0,
      y: 0,
      width: 100,
      height: 10,
      rotation: 0,
      zIndex: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: "user",
      style: { color: "#000000", thickness: 4, opacity: 1 },
      points: [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 100, y: 0 },
      ],
    };

    it("detects intersection when eraser touches stroke line", () => {
      expect(isStrokeIntersected(stroke, { x: 50, y: 3 }, 5)).toBe(true);
    });

    it("returns false when eraser is far away from stroke", () => {
      expect(isStrokeIntersected(stroke, { x: 50, y: 50 }, 5)).toBe(false);
    });
  });

  describe("eraseStrokeObject", () => {
    const stroke: StrokeObject = {
      id: "stroke-1",
      pageId: "page-1",
      type: "pen-stroke",
      x: 0,
      y: 0,
      width: 100,
      height: 10,
      rotation: 0,
      zIndex: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: "user",
      style: { color: "#000000", thickness: 2, opacity: 1 },
      points: [
        { x: 0, y: 0 },
        { x: 25, y: 0 },
        { x: 50, y: 0 },
        { x: 75, y: 0 },
        { x: 100, y: 0 },
      ],
    };

    it("splits stroke into two sub-strokes when erased in the middle", () => {
      // Erase at x=50 with radius 10 (covers pt x=50)
      const remaining = eraseStrokeObject(stroke, { x: 50, y: 0 }, 10);
      expect(remaining.length).toBe(2);
      expect(remaining[0].points.map((p) => p.x)).toEqual([0, 25]);
      expect(remaining[1].points.map((p) => p.x)).toEqual([75, 100]);
    });

    it("returns original stroke if eraser does not intersect", () => {
      const remaining = eraseStrokeObject(stroke, { x: 50, y: 100 }, 10);
      expect(remaining).toEqual([stroke]);
    });
  });
});
