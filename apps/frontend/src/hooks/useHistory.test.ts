import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { StrokeObject } from "@ai-notes/shared";
import { useHistory } from "./useHistory.js";

const dummyStroke = (id: string): StrokeObject => ({
  id,
  pageId: "page-1",
  type: "pen-stroke",
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  rotation: 0,
  zIndex: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  source: "user",
  style: { color: "#000", thickness: 2, opacity: 1 },
  points: [
    { x: 0, y: 0 },
    { x: 10, y: 10 },
  ],
});

describe("useHistory", () => {
  it("initializes with empty strokes and no history", () => {
    const { result } = renderHook(() => useHistory([]));
    expect(result.current.strokes).toEqual([]);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it("pushes state and enables undo", () => {
    const { result } = renderHook(() => useHistory([]));

    act(() => {
      result.current.setStrokes([dummyStroke("1")]);
    });

    expect(result.current.strokes.length).toBe(1);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it("undoes and redoes strokes state", () => {
    const { result } = renderHook(() => useHistory([]));

    act(() => {
      result.current.setStrokes([dummyStroke("1")]);
    });
    act(() => {
      result.current.setStrokes([dummyStroke("1"), dummyStroke("2")]);
    });

    expect(result.current.strokes.length).toBe(2);

    act(() => {
      result.current.undo();
    });
    expect(result.current.strokes.length).toBe(1);
    expect(result.current.canRedo).toBe(true);

    act(() => {
      result.current.redo();
    });
    expect(result.current.strokes.length).toBe(2);
    expect(result.current.canRedo).toBe(false);
  });
});
