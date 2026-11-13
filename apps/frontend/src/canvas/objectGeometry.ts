import {
  computeBoundingBox,
  isStrokeObject,
  type CanvasObject,
  type Point,
  type Rect,
  type ShapeStyle,
} from "@ai-notes/shared";

export type ShapeObject = Extract<CanvasObject, { type: "rectangle" | "ellipse" | "line" | "arrow" | "polygon" }>;
type FillableShape = Extract<ShapeObject, { type: "rectangle" | "ellipse" | "polygon" }>;
export type ShapeStyleChange = Partial<Pick<ShapeStyle, "strokeWidth" | "opacity">> & { filled?: boolean };

export function isShapeObject(object: CanvasObject): object is ShapeObject {
  return object.type === "rectangle" || object.type === "ellipse" || object.type === "line" ||
    object.type === "arrow" || object.type === "polygon";
}

export function isFillableShape(object: ShapeObject): object is FillableShape {
  return object.type === "rectangle" || object.type === "ellipse" || object.type === "polygon";
}

export function hasShapeFill(object: FillableShape): boolean {
  return object.style.fillColor !== undefined && object.style.fillColor !== "none";
}

export function updateShapeStyle(object: ShapeObject, changes: ShapeStyleChange): ShapeObject {
  const width = changes.strokeWidth ?? object.style.strokeWidth;
  const widthChanged = width !== object.style.strokeWidth;
  const opacityChanged = changes.opacity !== undefined && changes.opacity !== (object.style.opacity ?? 1);
  const fillChanged = isFillableShape(object) && changes.filled !== undefined &&
    changes.filled !== hasShapeFill(object);
  if (!widthChanged && !opacityChanged && !fillChanged) return object;

  const style = { ...object.style, strokeWidth: width };
  if (opacityChanged) style.opacity = changes.opacity;
  if (fillChanged) {
    if (changes.filled) style.fillColor = object.style.strokeColor;
    else delete style.fillColor;
  }
  const updated = { ...object, style, updatedAt: new Date().toISOString() };
  if (widthChanged && (object.type === "line" || object.type === "arrow")) {
    return { ...updated, ...computeBoundingBox([
      { x: object.x1, y: object.y1 }, { x: object.x2, y: object.y2 },
    ], width / 2) };
  }
  if (widthChanged && object.type === "polygon") {
    return { ...updated, ...computeBoundingBox(object.points, width / 2) };
  }
  return updated;
}

export function arrowHeadPoints(x1: number, y1: number, x2: number, y2: number, width: number): string {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const size = Math.max(10, width * 3);
  return `${x2 - size * Math.cos(angle - Math.PI / 6)},${y2 - size * Math.sin(angle - Math.PI / 6)} ` +
    `${x2},${y2} ${x2 - size * Math.cos(angle + Math.PI / 6)},${y2 - size * Math.sin(angle + Math.PI / 6)}`;
}

export function selectionBounds(objects: CanvasObject[]): Rect | null {
  if (!objects.length) return null;
  return computeBoundingBox(
    objects.flatMap(({ x, y, width, height }) => [
      { x, y },
      { x: x + width, y: y + height },
    ]),
  );
}

function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (!a || !b) continue;
    if ((a.y > point.y) !== (b.y > point.y) &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const cross = (p: Point, q: Point, r: Point) =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const onSegment = (p: Point, q: Point, r: Point) =>
    q.x >= Math.min(p.x, r.x) && q.x <= Math.max(p.x, r.x) &&
    q.y >= Math.min(p.y, r.y) && q.y <= Math.max(p.y, r.y);
  const abC = cross(a, b, c);
  const abD = cross(a, b, d);
  const cdA = cross(c, d, a);
  const cdB = cross(c, d, b);
  return (abC === 0 && onSegment(a, c, b)) || (abD === 0 && onSegment(a, d, b)) ||
    (cdA === 0 && onSegment(c, a, d)) || (cdB === 0 && onSegment(c, b, d)) ||
    ((abC > 0) !== (abD > 0) && (cdA > 0) !== (cdB > 0));
}

function pathIntersectsPolygon(points: Point[], polygon: Point[]): boolean {
  if (points.some((point) => pointInPolygon(point, polygon))) return true;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (!a || !b) continue;
    for (let j = 0; j < polygon.length; j++) {
      const c = polygon[j];
      const d = polygon[(j + 1) % polygon.length];
      if (c && d && segmentsIntersect(a, b, c, d)) return true;
    }
  }
  return false;
}

export function lassoSelect(objects: CanvasObject[], polygon: Point[]): string[] {
  if (polygon.length < 3) return [];
  return objects.filter((object) => {
    if (isStrokeObject(object)) return pathIntersectsPolygon(object.points, polygon);
    if (object.type === "line" || object.type === "arrow") {
      return pathIntersectsPolygon(
        [{ x: object.x1, y: object.y1 }, { x: object.x2, y: object.y2 }],
        polygon,
      );
    }
    if (object.type === "polygon") {
      const first = object.points[0];
      return pathIntersectsPolygon(first ? [...object.points, first] : [], polygon) ||
        (first !== undefined && pointInPolygon(polygon[0]!, object.points));
    }
    const { x, y, width, height } = object;
    const corners = [
      { x, y }, { x: x + width, y }, { x: x + width, y: y + height },
      { x, y: y + height }, { x, y },
    ];
    return pathIntersectsPolygon(corners, polygon) ||
      polygon.some((point) => point.x >= x && point.x <= x + width &&
        point.y >= y && point.y <= y + height);
  }).map((object) => object.id);
}

export function transformObjects(
  objects: CanvasObject[],
  from: Rect,
  to: Rect,
): CanvasObject[] {
  const scaleX = from.width ? to.width / from.width : 1;
  const scaleY = from.height ? to.height / from.height : 1;
  const transformPoint = (point: Point) => ({
    x: to.x + (point.x - from.x) * scaleX,
    y: to.y + (point.y - from.y) * scaleY,
  });
  return objects.map((object) => {
    const start = transformPoint(object);
    const updatedAt = new Date().toISOString();
    if (isStrokeObject(object)) {
      const points = object.points.map((point) => ({ ...point, ...transformPoint(point) }));
      const bounds = computeBoundingBox(points, object.style.thickness / 2);
      return { ...object, ...bounds, points, updatedAt, recognizedText: undefined, ocrConfidence: undefined };
    }
    if (object.type === "line" || object.type === "arrow") {
      const a = transformPoint({ x: object.x1, y: object.y1 });
      const b = transformPoint({ x: object.x2, y: object.y2 });
      return { ...object, ...computeBoundingBox([a, b], object.style.strokeWidth / 2),
        x1: a.x, y1: a.y, x2: b.x, y2: b.y, updatedAt };
    }
    if (object.type === "polygon") {
      const points = object.points.map(transformPoint);
      return { ...object, ...computeBoundingBox(points, object.style.strokeWidth / 2), points, updatedAt };
    }
    return { ...object, ...start, width: object.width * scaleX, height: object.height * scaleY, updatedAt };
  });
}
