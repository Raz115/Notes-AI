import { computeBoundingBox } from "./geometry.js";
import type { Point, StrokeObject, StrokePoint } from "./canvas.js";

/**
 * Calculates shortest distance from point `p` to segment defined by `a` and `b`.
 */
export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;

  if (l2 === 0) {
    // a and b are the same point
    return Math.hypot(p.x - a.x, p.y - a.y);
  }

  // Projection scalar t along segment
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
  t = Math.max(0, Math.min(1, t));

  const projX = a.x + t * dx;
  const projY = a.y + t * dy;

  return Math.hypot(p.x - projX, p.y - projY);
}

/**
 * Fast AABB check with padding.
 */
export function isPointNearAABB(
  point: Point,
  stroke: StrokeObject,
  padding: number
): boolean {
  return (
    point.x >= stroke.x - padding &&
    point.x <= stroke.x + stroke.width + padding &&
    point.y >= stroke.y - padding &&
    point.y <= stroke.y + stroke.height + padding
  );
}

/**
 * Checks if an eraser point touches a stroke object.
 */
export function isStrokeIntersected(
  stroke: StrokeObject,
  eraserPoint: Point,
  radius: number
): boolean {
  const effectiveRadius = radius + stroke.style.thickness / 2;

  // Fast bounding box rejection check
  if (!isPointNearAABB(eraserPoint, stroke, effectiveRadius)) {
    return false;
  }

  const { points } = stroke;
  if (points.length === 0) return false;
  const firstPt = points[0];
  if (!firstPt) return false;

  if (points.length === 1) {
    return Math.hypot(eraserPoint.x - firstPt.x, eraserPoint.y - firstPt.y) <= effectiveRadius;
  }

  for (let i = 0; i < points.length - 1; i++) {
    const ptA = points[i];
    const ptB = points[i + 1];
    if (ptA && ptB) {
      const dist = distanceToSegment(eraserPoint, ptA, ptB);
      if (dist <= effectiveRadius) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Splits or trims a stroke object when hit by a partial eraser.
 * Returns an array of remaining stroke objects (0, 1, or multiple sub-strokes).
 */
export function eraseStrokeObject(
  stroke: StrokeObject,
  eraserPoint: Point,
  radius: number
): StrokeObject[] {
  if (!isStrokeIntersected(stroke, eraserPoint, radius)) {
    return [stroke];
  }

  const effectiveRadius = radius + stroke.style.thickness / 2;
  const subPointGroups: StrokePoint[][] = [];
  let currentGroup: StrokePoint[] = [];

  for (const pt of stroke.points) {
    const dist = Math.hypot(eraserPoint.x - pt.x, eraserPoint.y - pt.y);
    if (dist > effectiveRadius) {
      currentGroup.push(pt);
    } else {
      if (currentGroup.length > 0) {
        subPointGroups.push(currentGroup);
        currentGroup = [];
      }
    }
  }

  if (currentGroup.length > 0) {
    subPointGroups.push(currentGroup);
  }

  const resultStrokes: StrokeObject[] = [];

  for (const group of subPointGroups) {
    if (group.length < 2) continue; // Ignore single isolated points
    const bbox = computeBoundingBox(group);
    resultStrokes.push({
      ...stroke,
      id: `${stroke.id}-split-${Math.random().toString(36).substring(2, 7)}`,
      x: bbox.x,
      y: bbox.y,
      width: bbox.width,
      height: bbox.height,
      points: group,
      updatedAt: new Date().toISOString(),
    });
  }

  return resultStrokes;
}
