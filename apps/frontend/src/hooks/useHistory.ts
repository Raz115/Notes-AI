import { useCallback, useEffect, useState } from "react";
import type { CanvasObject, StrokeObject } from "@ai-notes/shared";

export interface UseHistoryReturn<T extends CanvasObject = StrokeObject> {
  strokes: T[];
  setStrokes: (
    strokes: T[] | ((prev: T[]) => T[]),
    recordHistory?: boolean,
  ) => void;
  beginTransaction: () => void;
  commitTransaction: () => void;
  discardWhere: (predicate: (item: T) => boolean) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

interface HistoryState<T> {
  scopes: Record<string, { past: T[][]; future: T[][] }>;
  present: T[];
  transactionStart: T[] | null;
}

export function useHistory<T extends CanvasObject = StrokeObject>(
  initialStrokes: NoInfer<T>[] = [],
  scope = "default",
  belongs?: (item: NoInfer<T>) => boolean,
): UseHistoryReturn<T> {
  const [history, setHistory] = useState<HistoryState<T>>({
    scopes: {},
    present: initialStrokes,
    transactionStart: null,
  });

  const setStrokes = useCallback(
    (
      action: T[] | ((prev: T[]) => T[]),
      recordHistory = true,
    ) => {
      setHistory((curr) => {
        const nextPresent = typeof action === "function" ? action(curr.present) : action;
        if (nextPresent === curr.present) return curr;

        if (!recordHistory || curr.transactionStart !== null) {
          return {
            ...curr,
            present: nextPresent,
          };
        }

        const stack = curr.scopes[scope] ?? { past: [], future: [] };
        return { ...curr, present: nextPresent,
          scopes: { ...curr.scopes, [scope]: {
            past: [...stack.past, belongs ? curr.present.filter(belongs) : curr.present],
            future: [],
          } } };
      });
    },
    [scope, belongs],
  );

  const beginTransaction = useCallback(() => {
    setHistory((curr) =>
      curr.transactionStart === null ? { ...curr, transactionStart: curr.present } : curr,
    );
  }, []);

  const commitTransaction = useCallback(() => {
    setHistory((curr) => {
      if (curr.transactionStart === null) return curr;
      if (curr.transactionStart === curr.present ||
        (curr.transactionStart.length === curr.present.length &&
          curr.transactionStart.every((item, index) => item === curr.present[index]))) {
        return { ...curr, transactionStart: null };
      }
      const stack = curr.scopes[scope] ?? { past: [], future: [] };
      return { ...curr, transactionStart: null,
        scopes: { ...curr.scopes, [scope]: {
          past: [...stack.past, belongs ? curr.transactionStart.filter(belongs) : curr.transactionStart],
          future: [],
        } } };
    });
  }, [scope, belongs]);

  const discardWhere = useCallback((predicate: (item: T) => boolean) => {
    setHistory((curr) => {
      const keep = (items: T[]) => {
        const filtered = items.filter((item) => !predicate(item));
        return filtered.length === items.length ? items : filtered;
      };
      return {
        scopes: Object.fromEntries(Object.entries(curr.scopes).map(([key, stack]) =>
          [key, { past: stack.past.map(keep), future: stack.future.map(keep) }])),
        present: keep(curr.present),
        transactionStart: curr.transactionStart ? keep(curr.transactionStart) : null,
      };
    });
  }, []);

  const undo = useCallback(() => {
    setHistory((curr) => {
      const stack = curr.scopes[scope];
      if (curr.transactionStart !== null || !stack || stack.past.length === 0) return curr;
      const previous = stack.past[stack.past.length - 1];
      if (!previous) return curr;
      return {
        ...curr,
        present: belongs ? [...curr.present.filter((item) => !belongs(item)), ...previous] : previous,
        scopes: { ...curr.scopes, [scope]: {
          past: stack.past.slice(0, -1),
          future: [belongs ? curr.present.filter(belongs) : curr.present, ...stack.future],
        } },
      };
    });
  }, [scope, belongs]);

  const redo = useCallback(() => {
    setHistory((curr) => {
      const stack = curr.scopes[scope];
      if (curr.transactionStart !== null || !stack || stack.future.length === 0) return curr;
      const next = stack.future[0];
      if (!next) return curr;
      return {
        ...curr,
        present: belongs ? [...curr.present.filter((item) => !belongs(item)), ...next] : next,
        scopes: { ...curr.scopes, [scope]: {
          past: [...stack.past, belongs ? curr.present.filter(belongs) : curr.present],
          future: stack.future.slice(1),
        } },
      };
    });
  }, [scope, belongs]);

  // Global Undo / Redo keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      if (
        (activeElement instanceof HTMLInputElement && activeElement.type !== "range") ||
        activeElement instanceof HTMLTextAreaElement ||
        (activeElement instanceof HTMLElement && activeElement.isContentEditable)
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
    beginTransaction,
    commitTransaction,
    discardWhere,
    undo,
    redo,
    canUndo: history.transactionStart === null && (history.scopes[scope]?.past.length ?? 0) > 0,
    canRedo: history.transactionStart === null && (history.scopes[scope]?.future.length ?? 0) > 0,
  };
}
