import { describe, expect, it } from "vitest";
import {
  clamp,
  computeBoundingBox,
  pageToScreen,
  screenToPage,
  zoomAtPoint,
} from "./geometry.js";

describe("geometry helpers", () => {
  describe("pageToScreen and screenToPage", () => {
    it("converts identity viewport (1x zoom, (0, 0) offset)", () => {
      const viewport = { x: 0, y: 0, zoom: 1 };
      const pagePt = { x: 150, y: 300 };

      const screenPt = pageToScreen(pagePt, viewport);
      expect(screenPt).toEqual({ x: 150, y: 300 });

      const roundtrip = screenToPage(screenPt, viewport);
      expect(roundtrip).toEqual({ x: 150, y: 300 });
    });

    it("converts transformed viewport with zoom and pan offset", () => {
      const viewport = { x: 100, y: 50, zoom: 2 };
      const pagePt = { x: 40, y: 60 };

      // screenX = 100 + 40 * 2 = 180
      // screenY = 50 + 60 * 2 = 170
      const screenPt = pageToScreen(pagePt, viewport);
      expect(screenPt).toEqual({ x: 180, y: 170 });

      const roundtrip = screenToPage(screenPt, viewport);
      expect(roundtrip).toEqual({ x: 40, y: 60 });
    });

    it("handles zoom out below 1.0", () => {
      const viewport = { x: -20, y: -40, zoom: 0.5 };
      const pagePt = { x: 200, y: 100 };

      // screenX = -20 + 200 * 0.5 = 80
      // screenY = -40 + 100 * 0.5 = 10
      const screenPt = pageToScreen(pagePt, viewport);
      expect(screenPt).toEqual({ x: 80, y: 10 });

      const roundtrip = screenToPage(screenPt, viewport);
      expect(roundtrip).toEqual({ x: 200, y: 100 });
    });
  });

  describe("clamp", () => {
    it("restricts values to [min, max]", () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
    });
  });

  describe("zoomAtPoint", () => {
    it("keeps the page coordinate under the cursor stationary during zoom in", () => {
      const viewport = { x: 50, y: 50, zoom: 1 };
      const cursorOnScreen = { x: 200, y: 200 };

      // Cursor is at page (150, 150)
      const pageBefore = screenToPage(cursorOnScreen, viewport);
      expect(pageBefore).toEqual({ x: 150, y: 150 });

      const newViewport = zoomAtPoint(viewport, 2.0, cursorOnScreen);
      expect(newViewport.zoom).toBe(2.0);

      // Verify that the cursor on screen still maps to page (150, 150)
      const pageAfter = screenToPage(cursorOnScreen, newViewport);
      expect(pageAfter.x).toBeCloseTo(pageBefore.x, 5);
      expect(pageAfter.y).toBeCloseTo(pageBefore.y, 5);
    });

    it("clamps zoom to min and max bounds", () => {
      const viewport = { x: 0, y: 0, zoom: 1 };
      const cursor = { x: 100, y: 100 };

      const clampedLow = zoomAtPoint(viewport, 0.05, cursor, 0.25, 4.0);
      expect(clampedLow.zoom).toBe(0.25);

      const clampedHigh = zoomAtPoint(viewport, 10.0, cursor, 0.25, 4.0);
      expect(clampedHigh.zoom).toBe(4.0);
    });
  });

  describe("computeBoundingBox", () => {
    it("calculates axis-aligned bounding box from points", () => {
      const points = [
        { x: 10, y: 20 },
        { x: 50, y: 5 },
        { x: 30, y: 100 },
      ];

      const aabb = computeBoundingBox(points);
      expect(aabb).toEqual({
        x: 10,
        y: 5,
        width: 40, // 50 - 10
        height: 95, // 100 - 5
      });
    });

    it("applies padding when provided", () => {
      const points = [
        { x: 20, y: 20 },
        { x: 40, y: 60 },
      ];

      const aabb = computeBoundingBox(points, 5);
      expect(aabb).toEqual({
        x: 15,
        y: 15,
        width: 30, // 20 + 10
        height: 50, // 40 + 10
      });
    });

    it("returns zero rect for empty points array", () => {
      expect(computeBoundingBox([])).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    });
  });
});
