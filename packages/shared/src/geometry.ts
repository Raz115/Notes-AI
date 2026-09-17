import type { Point, Rect, ViewportState } from "./canvas.js";

/**
 * Transforms a point in page coordinates into screen/viewport pixel coordinates.
 */
export function pageToScreen(pagePoint: Point, viewport: ViewportState): Point {
  return {
    x: viewport.x + pagePoint.x * viewport.zoom,
    y: viewport.y + pagePoint.y * viewport.zoom,
  };
}

/**
 * Transforms a point in screen/viewport pixel coordinates into page coordinates.
 */
export function screenToPage(screenPoint: Point, viewport: ViewportState): Point {
  if (viewport.zoom === 0) {
    return { x: screenPoint.x - viewport.x, y: screenPoint.y - viewport.y };
  }
  return {
    x: (screenPoint.x - viewport.x) / viewport.zoom,
    y: (screenPoint.y - viewport.y) / viewport.zoom,
  };
}

/**
 * Clamps a number between a minimum and maximum bound.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 4.0;

/**
 * Computes a new viewport state when zooming in or out centered at a specific
 * screen coordinate (such as the user's cursor or pinch center).
 *
 * Ensures the page point under `screenAnchor` remains in the identical screen
 * position after the zoom change.
 */
export function zoomAtPoint(
  currentViewport: ViewportState,
  targetZoom: number,
  screenAnchor: Point,
  minZoom = MIN_ZOOM,
  maxZoom = MAX_ZOOM,
): ViewportState {
  const nextZoom = clamp(targetZoom, minZoom, maxZoom);
  if (nextZoom === currentViewport.zoom) {
    return currentViewport;
  }

  // Find page point under cursor before zoom
  const pagePoint = screenToPage(screenAnchor, currentViewport);

  // Compute new viewport offset such that pagePoint maps back to screenAnchor
  const nextX = screenAnchor.x - pagePoint.x * nextZoom;
  const nextY = screenAnchor.y - pagePoint.y * nextZoom;

  return {
    x: nextX,
    y: nextY,
    zoom: nextZoom,
  };
}

/**
 * Computes the axis-aligned bounding box (AABB) enclosing a set of 2D points.
 */
export function computeBoundingBox(
  points: Array<{ x: number; y: number }>,
  padding = 0,
): Rect {
  if (points.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const pt of points) {
    if (pt.x < minX) minX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y > maxY) maxY = pt.y;
  }

  return {
    x: minX - padding,
    y: minY - padding,
    width: Math.max(0, maxX - minX + padding * 2),
    height: Math.max(0, maxY - minY + padding * 2),
  };
}
