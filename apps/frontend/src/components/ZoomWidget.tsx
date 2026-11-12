export interface ZoomWidgetProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onFitPage: () => void;
}

/**
 * Floating zoom controls anchored to the bottom-right of the canvas workspace.
 * Always visible so keyboard and touch users can discover the controls.
 */
export function ZoomWidget({
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFitPage,
}: ZoomWidgetProps) {
  const zoomPercent = Math.round(zoom * 100);

  return (
    <div className="zoom-widget" data-testid="zoom-widget">
      <button
        type="button"
        className="zoom-widget-btn"
        onClick={onZoomOut}
        title="Zoom out"
        aria-label="Zoom out"
      >
        <Icon name="minus" />
      </button>
      <button
        type="button"
        className="zoom-widget-display"
        onClick={onResetZoom}
        title="Reset to 100%"
      >
        {zoomPercent}%
      </button>
      <button
        type="button"
        className="zoom-widget-btn"
        onClick={onZoomIn}
        title="Zoom in"
        aria-label="Zoom in"
      >
        <Icon name="plus" />
      </button>
      <button
        type="button"
        className="zoom-widget-btn zoom-widget-fit"
        onClick={onFitPage}
        title="Fit page in window"
        aria-label="Fit page"
      >
        <Icon name="fit" />
      </button>
    </div>
  );
}
import { Icon } from "./Icon.js";
