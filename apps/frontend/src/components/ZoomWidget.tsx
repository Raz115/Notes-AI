export interface ZoomWidgetProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onFitPage: () => void;
}

/**
 * Floating zoom controls anchored to the bottom-right of the canvas workspace.
 * Fades in on hover and remains visible briefly after interaction.
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
        −
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
        +
      </button>
      <button
        type="button"
        className="zoom-widget-btn zoom-widget-fit"
        onClick={onFitPage}
        title="Fit page in window"
      >
        ⊡
      </button>
    </div>
  );
}
