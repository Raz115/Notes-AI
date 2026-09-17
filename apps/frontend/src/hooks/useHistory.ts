import { useCallback, useEffect, useState } from "react";
import type { StrokeObject } from "@ai-notes/shared";

export interface UseHistoryReturn {
  strokes: StrokeObject[];
  setStrokes: (strokes: StrokeObject[] | ((prev: StrokeObject[]) => StrokeObject[])) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useHistory(initialStrokes: StrokeObject[] = []): UseHistoryReturn {
  const [past, setPast] = useState<StrokeObject[][]>([]);
  const [present, setPresent] = useState<StrokeObject[]>(initialStrokes);
  const [future, setFuture] = useState<StrokeObject[][]>([]);

  const setStrokes = useCallback((action: StrokeObject[] | ((prev: StrokeObject[]) => StrokeObject[])) => {
    setPresent((prevPresent) => {
      const nextPresent = typeof action === "function" ? action(prevPresent) : action;
      if (nextPresent === prevPresent) return prevPresent;

      setPast((prevPast) => [...prevPast, prevPresent]);
      setFuture([]); // clear redo stack on new action
      return nextPresent;
    });
  }, []);

  const undo = useCallback(() => {
    setPast((prevPast) => {
      if (prevPast.length === 0) return prevPast;
      const previous = prevPast[prevPast.length - 1];
      const newPast = prevPast.slice(0, prevPast.length - 1);

      setFuture((prevFuture) => [present, ...prevFuture]);
      setPresent(previous);
      return newPast;
    });
  }, [present]);

  const redo = useCallback(() => {
    setFuture((prevFuture) => {
      if (prevFuture.length === 0) return prevFuture;
      const next = prevFuture[0];
      const newFuture = prevFuture.slice(1);

      setPast((prevPast) => [...prevPast, present]);
      setPresent(next);
      return newFuture;
    });
  }, [present]);

  // Global Undo / Redo keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when user is typing inside an input/textarea
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === "input" || activeTag === "textarea" || (document.activeElement as HTMLElement)?.isContentEditable) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        if (e.shiftKey) {
          // Ctrl+Shift+Z => Redo
          e.preventDefault();
          redo();
        } else {
          // Ctrl+Z => Undo
          e.preventDefault();
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        // Ctrl+Y => Redo
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  return {
    strokes: present,
    setStrokes,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  };
}
