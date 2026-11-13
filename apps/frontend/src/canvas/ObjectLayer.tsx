import { useRef, useState, type PointerEvent } from "react";
import {
  computeBoundingBox,
  type CanvasObject,
  type Point,
  type Rect,
  type StrokeStyle,
  type TextboxObject,
} from "@ai-notes/shared";
import type { ObjectTool, ShapeKind } from "../components/ObjectToolbar.js";
import { arrowHeadPoints, lassoSelect, selectionBounds, transformObjects } from "./objectGeometry.js";

type ObjectUpdate = CanvasObject[] | ((previous: CanvasObject[]) => CanvasObject[]);

interface ObjectLayerProps {
  pageId: string;
  zoom: number;
  width: number;
  height: number;
  objects: CanvasObject[];
  tool: ObjectTool | null;
  shape: ShapeKind;
  shapeFilled: boolean;
  style: StrokeStyle;
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  onChange: (update: ObjectUpdate, recordHistory?: boolean) => void;
  beginGesture: () => void;
  endGesture: () => void;
}

function rectangle(a: Point, b: Point): Rect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) };
}

function createShape(pageId: string, shape: ShapeKind, a: Point, b: Point, ink: StrokeStyle, filled: boolean): CanvasObject {
  const now = new Date().toISOString();
  const bounds = rectangle(a, b);
  const base = { id: crypto.randomUUID(), pageId, ...bounds, rotation: 0, zIndex: Date.now(),
    createdAt: now, updatedAt: now, source: "user" as const };
  const style = { strokeColor: ink.color, strokeWidth: ink.thickness, opacity: ink.opacity };
  if (shape === "line" || shape === "arrow") {
    return { ...base, ...computeBoundingBox([a, b], style.strokeWidth / 2),
      type: shape, x1: a.x, y1: a.y, x2: b.x, y2: b.y, style };
  }
  if (shape === "triangle") {
    const points = [{ x: bounds.x + bounds.width / 2, y: bounds.y },
      { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
      { x: bounds.x, y: bounds.y + bounds.height }];
    return { ...base, ...computeBoundingBox(points, style.strokeWidth / 2), type: "polygon", points,
      style: { ...style, fillColor: filled ? ink.color : undefined } };
  }
  return { ...base, type: shape, style: { ...style, fillColor: filled ? ink.color : undefined } };
}

export function ObjectLayer({
  pageId, zoom, width, height, objects, tool, shape, shapeFilled, style, selectedIds,
  onSelect, onChange, beginGesture, endGesture,
}: ObjectLayerProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const [path, setPath] = useState<Point[]>([]);
  const [draft, setDraft] = useState<Rect | null>(null);
  const [newTextId, setNewTextId] = useState<string | null>(null);
  const gestureRef = useRef<{
    pointerId: number;
    kind: "lasso" | "shape" | "move" | "resize";
    start: Point;
    points: Point[];
    original?: CanvasObject[];
    bounds?: Rect;
    lastDx?: number;
    lastDy?: number;
  } | null>(null);
  const selected = objects.filter((object) => selectedIds.includes(object.id));
  const bounds = selectionBounds(selected);

  const pointFor = (event: PointerEvent): Point => {
    const rect = layerRef.current!.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / zoom, y: (event.clientY - rect.top) / zoom };
  };
  const start = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !tool || gestureRef.current) return;
    const point = pointFor(event);
    if (tool === "text") {
      const now = new Date().toISOString();
      const text: TextboxObject = {
        id: crypto.randomUUID(), pageId, type: "textbox", x: point.x, y: point.y,
        width: 200, height: 70, rotation: 0, zIndex: Date.now(), createdAt: now,
        updatedAt: now, source: "user", text: "", font: "sans", fontSize: 18,
        bold: false, color: style.color,
      };
      setNewTextId(text.id);
      onChange((previous) => [...previous, text]);
      return;
    }
    event.currentTarget.setPointerCapture?.(event.pointerId);
    gestureRef.current = { pointerId: event.pointerId, kind: tool, start: point, points: [point] };
    if (tool === "lasso") setPath([point]);
    else setDraft(rectangle(point, point));
  };
  const startTransform = (event: PointerEvent<HTMLDivElement>, kind: "move" | "resize") => {
    if (event.button !== 0 || !bounds || gestureRef.current) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    gestureRef.current = { pointerId: event.pointerId, kind, start: pointFor(event),
      points: [], bounds, original: selected, lastDx: 0, lastDy: 0 };
    beginGesture();
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    const point = pointFor(event);
    if (gesture.kind === "lasso") {
      gesture.points.push(point);
      setPath([...gesture.points]);
    } else if (gesture.kind === "shape") {
      setDraft(rectangle(gesture.start, point));
    } else if (gesture.bounds && gesture.original) {
      const dx = point.x - gesture.start.x;
      const dy = point.y - gesture.start.y;
      if (dx === gesture.lastDx && dy === gesture.lastDy) return;
      gesture.lastDx = dx;
      gesture.lastDy = dy;
      const target = gesture.kind === "move"
        ? { ...gesture.bounds, x: gesture.bounds.x + dx, y: gesture.bounds.y + dy }
        : { ...gesture.bounds, width: Math.max(10, gesture.bounds.width + dx),
            height: Math.max(10, gesture.bounds.height + dy) };
      const transformed = dx === 0 && dy === 0
        ? gesture.original : transformObjects(gesture.original, gesture.bounds, target);
      const byId = new Map(transformed.map((object) => [object.id, object]));
      onChange((previous) => previous.map((object) => byId.get(object.id) ?? object), false);
    }
  };
  const finish = (event: PointerEvent<HTMLDivElement>, cancel = false) => {
    const gesture = gestureRef.current;
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    const point = pointFor(event);
    if (!cancel && (gesture.kind === "move" || gesture.kind === "resize")) move(event);
    gestureRef.current = null;
    if (gesture.kind === "lasso") {
      if (!cancel) onSelect(lassoSelect(objects, [...gesture.points, point]));
      setPath([]);
    } else if (gesture.kind === "shape") {
      const area = rectangle(gesture.start, point);
      if (!cancel && (area.width > 2 || area.height > 2)) {
        onChange((previous) => [...previous, createShape(pageId, shape, gesture.start, point, style, shapeFilled)]);
      }
      setDraft(null);
    } else {
      endGesture();
    }
  };
  return (
    <div ref={layerRef} className="object-layer" data-testid="object-layer"
      style={{ width, height, pointerEvents: tool ? "auto" : "none" }}
      onPointerDown={start} onPointerMove={move}
      onPointerUp={(event) => finish(event)} onPointerCancel={(event) => finish(event, true)}
      onLostPointerCapture={(event) => finish(event, true)}>
      <svg className="object-svg" width={width} height={height} aria-hidden="true">
        {objects.map((object) => {
          if (object.type === "rectangle") return <rect key={object.id} x={object.x} y={object.y}
            width={object.width} height={object.height} fill={object.style.fillColor ?? "none"} stroke={object.style.strokeColor}
            strokeWidth={object.style.strokeWidth} opacity={object.style.opacity} />;
          if (object.type === "ellipse") return <ellipse key={object.id} cx={object.x + object.width / 2}
            cy={object.y + object.height / 2} rx={object.width / 2} ry={object.height / 2}
            fill={object.style.fillColor ?? "none"} stroke={object.style.strokeColor} strokeWidth={object.style.strokeWidth} opacity={object.style.opacity} />;
          if (object.type === "line" || object.type === "arrow") {
            return <g key={object.id} fill="none" stroke={object.style.strokeColor} strokeWidth={object.style.strokeWidth}
              opacity={object.style.opacity}>
              <line x1={object.x1} y1={object.y1} x2={object.x2} y2={object.y2} />
              {object.type === "arrow" && <polyline
                points={arrowHeadPoints(object.x1, object.y1, object.x2, object.y2, object.style.strokeWidth)} />}
            </g>;
          }
          if (object.type === "polygon") return <polygon key={object.id}
            points={object.points.map((point) => `${point.x},${point.y}`).join(" ")}
            fill={object.style.fillColor ?? "none"} stroke={object.style.strokeColor} strokeWidth={object.style.strokeWidth} opacity={object.style.opacity} />;
          return null;
        })}
        {path.length > 1 && <polyline points={path.map((point) => `${point.x},${point.y}`).join(" ")}
          fill="none" stroke="#4169d1" strokeWidth={2 / zoom} strokeDasharray="6 4" />}
        {draft && <rect {...draft} fill="none" stroke="#4169d1" strokeWidth={2 / zoom} strokeDasharray="6 4" />}
      </svg>
      {objects.filter((object): object is TextboxObject => object.type === "textbox").map((object) => (
        <textarea key={object.id} aria-label="Text box" className="canvas-textbox"
          value={object.text} autoFocus={object.id === newTextId}
          style={{ left: object.x, top: object.y, width: object.width, height: object.height,
            fontFamily: object.font === "serif" ? "serif" : "sans-serif", fontSize: object.fontSize,
            fontWeight: object.bold ? "bold" : "normal", color: object.color,
            pointerEvents: tool === "text" ? "auto" : "none" }}
          onPointerDown={(event) => event.stopPropagation()}
          onFocus={() => { setNewTextId(null); beginGesture(); }}
          onBlur={endGesture}
          onChange={(event) => {
            const text = event.target.value;
            onChange((previous) => previous.map((item) => item.id === object.id && item.type === "textbox"
              ? { ...item, text, updatedAt: new Date().toISOString() } : item), false);
          }}
        />
      ))}
      {tool === "lasso" && bounds && (
        <div className="selection-box" aria-label="Selected objects" data-testid="selection-box"
          style={{ left: bounds.x, top: bounds.y, width: Math.max(bounds.width, 2), height: Math.max(bounds.height, 2) }}
          onPointerDown={(event) => startTransform(event, "move")}>
          <div className="selection-resize" aria-label="Resize selection" data-testid="selection-resize"
            onPointerDown={(event) => startTransform(event, "resize")} />
        </div>
      )}
    </div>
  );
}
