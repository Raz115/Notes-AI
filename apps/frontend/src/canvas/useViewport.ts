import { useCallback, useState } from "react";
import {
  clamp,
  MAX_ZOOM,
  MIN_ZOOM,
  type Point,
  type ViewportState,
  zoomAtPoint,
} from "@ai-notes/shared";

export interface UseViewportOptions {
  initialViewport?: ViewportState;
  minZoom?: number;
  maxZoom?: number;
}

export function useViewport(options: UseViewportOptions = {}) {
  const minZoom = options.minZoom ?? MIN_ZOOM;
  const maxZoom = options.maxZoom ?? MAX_ZOOM;

  const [viewport, setViewport] = useState<ViewportState>(
    options.initialViewport ?? { x: 0, y: 0, zoom: 1 },
  );

  const panBy = useCallback((dx: number, dy: number) => {
    setViewport((prev) => ({
      ...prev,
      x: prev.x + dx,
      y: prev.y + dy,
    }));
  }, []);

  const zoomTo = useCallback(
    (targetZoom: number, anchorScreenPoint?: Point) => {
      setViewport((prev) => {
        const nextZoom = clamp(targetZoom, minZoom, maxZoom);
        if (nextZoom === prev.zoom) return prev;

        if (anchorScreenPoint) {
          return zoomAtPoint(prev, nextZoom, anchorScreenPoint, minZoom, maxZoom);
        }

        return { ...prev, zoom: nextZoom };
      });
    },
    [minZoom, maxZoom],
  );

  const zoomIn = useCallback(
    (anchorScreenPoint?: Point) => {
      setViewport((prev) => {
        const nextZoom = clamp(prev.zoom * 1.2, minZoom, maxZoom);
        if (anchorScreenPoint) {
          return zoomAtPoint(prev, nextZoom, anchorScreenPoint, minZoom, maxZoom);
        }
        return { ...prev, zoom: nextZoom };
      });
    },
    [minZoom, maxZoom],
  );

  const zoomOut = useCallback(
    (anchorScreenPoint?: Point) => {
      setViewport((prev) => {
        const nextZoom = clamp(prev.zoom / 1.2, minZoom, maxZoom);
        if (anchorScreenPoint) {
          return zoomAtPoint(prev, nextZoom, anchorScreenPoint, minZoom, maxZoom);
        }
        return { ...prev, zoom: nextZoom };
      });
    },
    [minZoom, maxZoom],
  );

  const resetZoom = useCallback(
    (anchorScreenPoint?: Point) => {
      zoomTo(1.0, anchorScreenPoint);
    },
    [zoomTo],
  );

  /**
   * Centers the paper page within the available viewport container bounds,
   * fitting with comfortable padding.
   */
  const centerPage = useCallback(
    (
      pageWidth: number,
      pageHeight: number,
      containerWidth: number,
      containerHeight: number,
    ) => {
      if (containerWidth <= 0 || containerHeight <= 0) return;

      const padding = 60;
      const scaleX = (containerWidth - padding * 2) / pageWidth;
      const scaleY = (containerHeight - padding * 2) / pageHeight;
      const bestZoom = clamp(Math.min(scaleX, scaleY, 1.0), minZoom, maxZoom);

      const fittedWidth = pageWidth * bestZoom;
      const fittedHeight = pageHeight * bestZoom;

      const centeredX = Math.max(padding, (containerWidth - fittedWidth) / 2);
      const centeredY = Math.max(padding, (containerHeight - fittedHeight) / 2);

      setViewport({
        x: centeredX,
        y: centeredY,
        zoom: bestZoom,
      });
    },
    [minZoom, maxZoom],
  );

  return {
    viewport,
    setViewport,
    panBy,
    zoomTo,
    zoomIn,
    zoomOut,
    resetZoom,
    centerPage,
  };
}
