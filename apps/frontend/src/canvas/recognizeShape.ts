import { computeBoundingBox, distanceToSegment, type CanvasObject, type StrokeObject } from "@ai-notes/shared";

export function recognizeShape(stroke: StrokeObject): CanvasObject | null {
  const { points } = stroke;
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last || points.length < 2) return null;
  const bounds = computeBoundingBox(points);
  const diagonal = Math.hypot(bounds.width, bounds.height);
  if (diagonal < 10) return null;
  const endDistance = Math.hypot(last.x - first.x, last.y - first.y);
  const style = { strokeColor: stroke.style.color, strokeWidth: stroke.style.thickness,
    opacity: stroke.style.opacity };
  const base = {
    id: stroke.id, pageId: stroke.pageId, rotation: stroke.rotation, zIndex: stroke.zIndex,
    createdAt: stroke.createdAt, updatedAt: new Date().toISOString(),
    source: stroke.source, groupId: stroke.groupId,
  };
  if (endDistance >= diagonal * 0.75 &&
    points.every((point) => distanceToSegment(point, first, last) <= Math.max(3, diagonal * 0.06))) {
    return { ...base, ...computeBoundingBox([first, last], style.strokeWidth / 2),
      type: "line", x1: first.x, y1: first.y, x2: last.x, y2: last.y, style };
  }
  if (endDistance > Math.max(10, diagonal * 0.15) || bounds.width < 10 || bounds.height < 10) return null;
  const sides = [false, false, false, false];
  let edgeDistance = 0;
  let radialError = 0;
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  for (const point of points) {
    const distances = [Math.abs(point.x - bounds.x), Math.abs(point.x - bounds.x - bounds.width),
      Math.abs(point.y - bounds.y), Math.abs(point.y - bounds.y - bounds.height)];
    const nearest = Math.min(...distances);
    edgeDistance += nearest / Math.min(bounds.width, bounds.height);
    const index = distances.indexOf(nearest);
    sides[index] = true;
    radialError += Math.abs(Math.hypot((point.x - cx) / (bounds.width / 2),
      (point.y - cy) / (bounds.height / 2)) - 1);
  }
  if (sides.every(Boolean) && points.length >= 8 && radialError / points.length < 0.18) {
    return { ...base, ...bounds, type: "ellipse", style };
  }
  if (sides.every(Boolean) && edgeDistance / points.length < 0.08) {
    return { ...base, ...bounds, type: "rectangle", style };
  }
  return null;
}
