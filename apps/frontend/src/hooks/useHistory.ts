import { useCallback, useEffect, useState } from "react";
import type { StrokeObject } from "@ai-notes/shared";

export interface UseHistoryReturn {
  strokes: StrokeObject[];
  setStrokes: (
    strokes: StrokeObject[] | ((prev: StrokeObject[]) => StrokeObject[]),
    recordHistory?: boolean
  ) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

interface HistoryState {
  past: StrokeObject[][];
  present: StrokeObject[];
  future: StrokeObject[][];
}

export function useHistory(initialStrokes: StrokeObject[] = []): UseHistoryReturn {
  const [history, setHistory] = useState<HistoryState>({
    past: [],
    present: initialStrokes,
    future: [],
  });

  const setStrokes = useCallback(
    (
      action: StrokeObject[] | ((prev: StrokeObject[]) => StrokeObject[]),
      recordHistory = true
    ) => {
      setHistory((curr) => {
        const nextPresent =
          typeof action === "function" ? action(curr.present) : action;
        if (nextPresent === curr.present) return curr;

        if (!recordHistory) {
          return {
            ...curr,
            present: nextPresent,
          };
        }

        return {
          past: [...curr.past, curr.present],
          present: nextPresent,
          future: [],
        };
      });
    },
    []
  );

  const undo = useCallback(() => {
    setHistory((curr) => {
      if (curr.past.length === 0) return curr;
      const previous = curr.past[curr.past.length - 1];
      const newPast = curr.past.slice(0, curr.past.length - 1);
      return {
        past: newPast,
        present: previous,
        future: [curr.present, ...curr.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((curr) => {
      if (curr.future.length === 0) return curr;
      const next = curr.future[0];
      const newFuture = curr.future.slice(1);
      return {
        past: [...curr.past, curr.present],
        present: next,
        future: newFuture,
      };
    });
  }, []);

  // Global Undo / Redo keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (
        activeTag === "input" ||
        activeTag === "textarea" ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      const isZ = key === "z" || e.code === "KeyZ";
      const isY = key === "y" || e.code === "KeyY";

      if ((e.ctrlKey || e.metaKey) && isZ) {
        if (e.shiftKey) {
          e.preventDefault();
          redo();
        } else {
          e.preventDefault();
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && isY) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  return {
    strokes: history.present,
    setStrokes,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}
