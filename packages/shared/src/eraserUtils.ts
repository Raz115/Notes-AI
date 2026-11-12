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
  padding: number,
): boolean {
  return (
    point.x >= stroke.x - padding &&
    point.x <= stroke.x + stroke.width + padding &&
    point.y >= stroke.y - padding &&
    point.y <= stroke.y + stroke.height + padding
  );
}

type Interval = [number, number];

function circleInterval(
  a: Point,
  b: Point,
  center: Point,
  radius: number,
): Interval | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const ox = a.x - center.x;
  const oy = a.y - center.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) {
    return ox * ox + oy * oy <= radius * radius ? [0, 1] : null;
  }
  const projection = ox * dx + oy * dy;
  const discriminant =
    projection * projection - lengthSquared * (ox * ox + oy * oy - radius * radius);
  if (discriminant < 0) return null;
  const root = Math.sqrt(discriminant);
  const start = Math.max(0, (-projection - root) / lengthSquared);
  const end = Math.min(1, (-projection + root) / lengthSquared);
  return start <= end ? [start, end] : null;
}

// A moving circular eraser sweeps a capsule: two end caps and a rectangular strip.
function sweptInterval(
  a: Point,
  b: Point,
  start: Point,
  end: Point,
  radius: number,
): Interval | null {
  const intervals = [
    circleInterval(a, b, start, radius),
    circleInterval(a, b, end, radius),
  ].filter((interval): interval is Interval => interval !== null);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length > 0) {
    const ux = dx / length;
    const uy = dy / length;
    const ax = a.x - start.x;
    const ay = a.y - start.y;
    const bx = b.x - a.x;
    const by = b.y - a.y;
    let low = 0;
    let high = 1;
    const bounds: [number, number, number, number][] = [
      [ax * ux + ay * uy, bx * ux + by * uy, 0, length],
      [ax * -uy + ay * ux, bx * -uy + by * ux, -radius, radius],
    ];
    for (const [value, delta, min, max] of bounds) {
      if (delta === 0) {
        if (value < min || value > max) {
          low = 1;
          high = 0;
          break;
        }
      } else {
        const t1 = (min - value) / delta;
        const t2 = (max - value) / delta;
        low = Math.max(low, Math.min(t1, t2));
        high = Math.min(high, Math.max(t1, t2));
      }
    }
    if (low <= high) intervals.push([low, high]);
  }
  if (intervals.length === 0) return null;
  return [
    Math.min(...intervals.map((interval) => interval[0])),
    Math.max(...intervals.map((interval) => interval[1])),
  ];
}

function mayIntersect(
  stroke: StrokeObject,
  start: Point,
  end: Point,
  radius: number,
): boolean {
  const padding = radius + stroke.style.thickness / 2;
  return (
    Math.max(start.x, end.x) >= stroke.x - padding &&
    Math.min(start.x, end.x) <= stroke.x + stroke.width + padding &&
    Math.max(start.y, end.y) >= stroke.y - padding &&
    Math.min(start.y, end.y) <= stroke.y + stroke.height + padding
  );
}

/**
 * Checks if a circular eraser or its swept path touches a stroke.
 */
export function isStrokeIntersected(
  stroke: StrokeObject,
  eraserPoint: Point,
  radius: number,
  eraserEnd: Point = eraserPoint,
): boolean {
  const effectiveRadius = radius + stroke.style.thickness / 2;

  // Fast bounding box rejection check
  if (!mayIntersect(stroke, eraserPoint, eraserEnd, radius)) {
    return false;
  }

  const { points } = stroke;
  if (points.length === 0) return false;
  const firstPt = points[0];
  if (!firstPt) return false;

  if (points.length === 1) {
    return distanceToSegment(firstPt, eraserPoint, eraserEnd) <= effectiveRadius;
  }

  for (let i = 0; i < points.length - 1; i++) {
    const ptA = points[i];
    const ptB = points[i + 1];
    if (ptA && ptB) {
      if (sweptInterval(ptA, ptB, eraserPoint, eraserEnd, effectiveRadius)) {
        return true;
      }
    }
  }

  return false;
}

function interpolate(a: StrokePoint, b: StrokePoint, t: number): StrokePoint {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const point: StrokePoint = {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
  if (a.pressure !== undefined && b.pressure !== undefined) {
    point.pressure = a.pressure + (b.pressure - a.pressure) * t;
  }
  return point;
}

/**
 * Splits or trims a stroke object when hit by a partial eraser.
 * Returns an array of remaining stroke objects (0, 1, or multiple sub-strokes).
 */
export function eraseStrokeObject(
  stroke: StrokeObject,
  eraserPoint: Point,
  radius: number,
  eraserEnd: Point = eraserPoint,
): StrokeObject[] {
  if (!isStrokeIntersected(stroke, eraserPoint, radius, eraserEnd)) {
    return [stroke];
  }
  if (stroke.points.length === 1) return [];

  const effectiveRadius = radius + stroke.style.thickness / 2;
  const subPointGroups: StrokePoint[][] = [];
  let currentGroup: StrokePoint[] = [];
  let changed = false;
  const addPoint = (point: StrokePoint) => {
    const last = currentGroup[currentGroup.length - 1];
    if (!last || last.x !== point.x || last.y !== point.y) {
      currentGroup.push(point);
    }
  };
  const finishGroup = () => {
    if (currentGroup.length > 0) subPointGroups.push(currentGroup);
    currentGroup = [];
  };

  for (let i = 1; i < stroke.points.length; i++) {
    const a = stroke.points[i - 1];
    const b = stroke.points[i];
    if (!a || !b) continue;
    const interval = sweptInterval(a, b, eraserPoint, eraserEnd, effectiveRadius);
    if (!interval || interval[1] <= interval[0]) {
      addPoint(a);
      addPoint(b);
      continue;
    }
    changed = true;
    const [enter, exit] = interval;
    if (enter > 0) {
      addPoint(a);
      addPoint(interpolate(a, b, enter));
    }
    finishGroup();
    if (exit < 1) {
      addPoint(interpolate(a, b, exit));
      addPoint(b);
    }
  }

  finishGroup();
  if (!changed) return [stroke];
  return subPointGroups.map((group, index) => {
    const bbox = computeBoundingBox(group, stroke.style.thickness / 2);
    return {
      ...stroke,
      id: `${stroke.id}-split-${index}`,
      x: bbox.x,
      y: bbox.y,
      width: bbox.width,
      height: bbox.height,
      points: group,
      updatedAt: new Date().toISOString(),
      recognizedText: undefined,
      ocrConfidence: undefined,
    };
  });
}
