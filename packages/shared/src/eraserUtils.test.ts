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
      expect(remaining[0]?.points.map((p) => p.x)).toEqual([0, 25, 39]);
      expect(remaining[1]?.points.map((p) => p.x)).toEqual([61, 75, 100]);
    });

    it("returns original stroke if eraser does not intersect", () => {
      const remaining = eraseStrokeObject(stroke, { x: 50, y: 100 }, 10);
      expect(remaining).toEqual([stroke]);
    });

    it("clips sparse segments and interpolates pressure at their cut edges", () => {
      const sparse = {
        ...stroke,
        points: [
          { x: 0, y: 0, pressure: 0.2 },
          { x: 100, y: 0, pressure: 0.8 },
        ],
      };
      const remaining = eraseStrokeObject(sparse, { x: 50, y: 0 }, 9);
      expect(remaining).toHaveLength(2);
      expect(remaining[0]?.points[1]?.x).toBeCloseTo(40);
      expect(remaining[0]?.points[1]?.pressure).toBeCloseTo(0.44);
      expect(remaining[1]?.points[0]?.x).toBeCloseTo(60);
      expect(remaining[1]?.points[0]?.pressure).toBeCloseTo(0.56);
      expect(remaining[0]).toMatchObject({ x: -1, y: -1, width: 42, height: 2 });
      expect(remaining[0]?.id).not.toBe(remaining[1]?.id);
    });

    it("erases along the full path between pointer events", () => {
      const vertical = {
        ...stroke,
        points: [
          { x: 50, y: -30 },
          { x: 50, y: 30 },
        ],
        x: 49,
        y: -31,
        width: 2,
        height: 62,
      };
      const start = { x: 0, y: 0 };
      const end = { x: 100, y: 0 };
      expect(isStrokeIntersected(vertical, start, 4, end)).toBe(true);
      const remaining = eraseStrokeObject(vertical, start, 4, end);
      expect(remaining).toHaveLength(2);
      expect(remaining[0]?.points[1]?.y).toBeCloseTo(-5);
      expect(remaining[1]?.points[0]?.y).toBeCloseTo(5);
    });

    it("preserves untouched dots and removes touched dots", () => {
      const dot = { ...stroke, points: [{ x: 0, y: 0 }] };
      expect(eraseStrokeObject(dot, { x: 50, y: 0 }, 4)).toEqual([dot]);
      expect(eraseStrokeObject(dot, { x: 0, y: 0 }, 4)).toEqual([]);
    });

    it("trims endpoints, completely deletes covered strokes, and preserves tangential contact", () => {
      const trimmed = eraseStrokeObject(stroke, { x: 0, y: 0 }, 9);
      expect(trimmed).toHaveLength(1);
      expect(trimmed[0]?.points[0]?.x).toBeCloseTo(10);
      expect(eraseStrokeObject(stroke, { x: 50, y: 0 }, 100)).toEqual([]);
      expect(eraseStrokeObject(stroke, { x: 50, y: 10 }, 9)).toEqual([stroke]);
    });

    it("clips diagonal swept paths identically in either direction", () => {
      const vertical = {
        ...stroke,
        points: [
          { x: 50, y: -30 },
          { x: 50, y: 30 },
        ],
        x: 49,
        y: -31,
        width: 2,
        height: 62,
      };
      const start = { x: 0, y: -10 };
      const end = { x: 100, y: 10 };
      const forward = eraseStrokeObject(vertical, start, 4, end);
      const reverse = eraseStrokeObject(vertical, end, 4, start);
      for (const parts of [forward, reverse]) {
        expect(parts).toHaveLength(2);
        expect(parts[0]?.points[1]?.y).toBeCloseTo((-5 * Math.hypot(100, 20)) / 100);
        expect(parts[1]?.points[0]?.y).toBeCloseTo((5 * Math.hypot(100, 20)) / 100);
      }
    });
  });
});
