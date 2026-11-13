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

  it("records a multi-update gesture once, even when updates are batched", () => {
    const first = dummyStroke("1");
    const second = dummyStroke("2");
    const { result } = renderHook(() => useHistory([first, second]));

    act(() => {
      result.current.beginTransaction();
      result.current.setStrokes([second], false);
      result.current.setStrokes([], false);
      result.current.commitTransaction();
    });
    expect(result.current.strokes).toEqual([]);
    act(() => result.current.undo());
    expect(result.current.strokes).toEqual([first, second]);
    act(() => result.current.redo());
    expect(result.current.strokes).toEqual([]);
  });

  it("does not discard redo for an erase gesture that makes no change", () => {
    const first = dummyStroke("1");
    const { result } = renderHook(() => useHistory([]));
    act(() => result.current.setStrokes([first]));
    act(() => result.current.undo());
    act(() => {
      result.current.beginTransaction();
      result.current.setStrokes((strokes) => strokes, false);
      result.current.commitTransaction();
    });
    expect(result.current.canRedo).toBe(true);
    act(() => result.current.redo());
    expect(result.current.strokes).toEqual([first]);
  });

  it("leaves undo shortcuts to focused text inputs", () => {
    const first = dummyStroke("1");
    const { result } = renderHook(() => useHistory([]));
    act(() => result.current.setStrokes([first]));
    const input = document.createElement("input");
    document.body.append(input);
    try {
      input.focus();
      const event = new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true });
      act(() => { input.dispatchEvent(event); });
      expect(event.defaultPrevented).toBe(false);
      expect(result.current.strokes).toEqual([first]);
    } finally {
      input.remove();
    }
  });

  it("keeps undo histories independent when switching notebooks", () => {
    const first = dummyStroke("1");
    const second = { ...dummyStroke("2"), pageId: "page-2" };
    const { result, rerender } = renderHook(
      ({ scope }) => useHistory<StrokeObject>([], scope, (stroke) => stroke.pageId === scope),
      { initialProps: { scope: "page-1" } },
    );
    act(() => result.current.setStrokes([first]));
    rerender({ scope: "page-2" });
    expect(result.current.canUndo).toBe(false);
    act(() => result.current.setStrokes((strokes) => [...strokes, second]));
    act(() => result.current.undo());
    expect(result.current.strokes).toEqual([first]);
    rerender({ scope: "page-1" });
    act(() => result.current.undo());
    expect(result.current.strokes).toEqual([]);
    act(() => result.current.redo());
    expect(result.current.strokes).toEqual([first]);
    rerender({ scope: "page-2" });
    act(() => result.current.redo());
    expect(result.current.strokes).toEqual([first, second]);
  });
});
