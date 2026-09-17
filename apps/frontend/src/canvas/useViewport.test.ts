import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useViewport } from "./useViewport.js";

describe("useViewport", () => {
  it("initializes with default viewport (0, 0, 1x)", () => {
    const { result } = renderHook(() => useViewport());
    expect(result.current.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  it("pans by dx and dy", () => {
    const { result } = renderHook(() => useViewport());

    act(() => {
      result.current.panBy(50, -25);
    });

    expect(result.current.viewport.x).toBe(50);
    expect(result.current.viewport.y).toBe(-25);
  });

  it("zooms in and out within bounds", () => {
    const { result } = renderHook(() => useViewport());

    act(() => {
      result.current.zoomIn();
    });
    expect(result.current.viewport.zoom).toBeCloseTo(1.2, 2);

    act(() => {
      result.current.zoomOut();
    });
    expect(result.current.viewport.zoom).toBeCloseTo(1.0, 2);
  });

  it("clamps zoom to min and max limits", () => {
    const { result } = renderHook(() => useViewport());

    act(() => {
      result.current.zoomTo(10.0);
    });
    expect(result.current.viewport.zoom).toBe(4.0);

    act(() => {
      result.current.zoomTo(0.01);
    });
    expect(result.current.viewport.zoom).toBe(0.25);
  });

  it("resets zoom to 1.0", () => {
    const { result } = renderHook(() => useViewport());

    act(() => {
      result.current.zoomTo(2.5);
    });
    expect(result.current.viewport.zoom).toBe(2.5);

    act(() => {
      result.current.resetZoom();
    });
    expect(result.current.viewport.zoom).toBe(1.0);
  });

  it("centers page in container", () => {
    const { result } = renderHook(() => useViewport());

    act(() => {
      // Container 1000x800, Page 600x400
      result.current.centerPage(600, 400, 1000, 800);
    });

    // Best zoom is 1.0 (fits comfortably with >60px padding)
    expect(result.current.viewport.zoom).toBe(1.0);
    expect(result.current.viewport.x).toBe(200); // (1000 - 600) / 2
    expect(result.current.viewport.y).toBe(200); // (800 - 400) / 2
  });
});
