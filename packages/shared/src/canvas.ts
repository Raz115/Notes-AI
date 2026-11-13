/**
 * Canvas object model.
 *
 * Everything placed on a notebook page is represented as a structured,
 * independently addressable object rather than flattened pixels.
 * See technical-requirements.md sections 6-8.
 */

export type CanvasObjectType =
  | "pen-stroke"
  | "pencil-stroke"
  | "highlighter-stroke"
  | "textbox"
  | "rectangle"
  | "ellipse"
  | "line"
  | "arrow"
  | "polygon"
  | "image"
  | "graph"
  | "ai-generation-group";

export type CanvasObjectSource = "user" | "ai";

/**
 * Base identity/geometry shared by every object on a page.
 * Coordinates are page-relative (see technical-requirements.md section 8),
 * never screen-relative, so zoom/pan/export/device changes never mutate
 * stored data.
 *
 * Invariant: For path, stroke, line, and polygon objects, `x, y, width, height`
 * define the computed axis-aligned bounding box (AABB) used for spatial indexing
 * and lasso hit-testing. Canonical geometry is defined by `points` or `(x1,y1,x2,y2)`.
 */
export interface CanvasObjectBase {
  id: string;
  pageId: string;
  type: CanvasObjectType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  createdAt: string;
  updatedAt: string;
  source: CanvasObjectSource;
  /** Present when this object is part of an AI generation group or a user grouping. */
  groupId?: string;
}

export interface StrokePoint {
  x: number;
  y: number;
  /** 0-1 pressure; defaults to 1 for mouse/trackpad input in V1. */
  pressure?: number;
}

export interface StrokeStyle {
  color: string;
  thickness: number;
  /** 0-1 */
  opacity: number;
}

export type ActiveToolType =
  | "pen"
  | "pencil"
  | "highlighter"
  | "eraser-partial"
  | "eraser-stroke";

export interface ToolSettings {
  color: string;
  thickness: number;
  opacity: number;
}

export type ToolSettingsMap = Record<ActiveToolType, ToolSettings>;

export interface StrokeObject extends CanvasObjectBase {
  type: "pen-stroke" | "pencil-stroke" | "highlighter-stroke";
  points: StrokePoint[];
  style: StrokeStyle;
  /** Cached OCR result so handwriting isn't reprocessed on every request. See section 28. */
  recognizedText?: string;
  ocrConfidence?: number;
}

export type SupportedFont = "sans" | "serif";

export interface TextboxObject extends CanvasObjectBase {
  type: "textbox";
  text: string;
  font: SupportedFont;
  fontSize: number;
  bold: boolean;
  color: string;
}

export interface ShapeStyle {
  strokeColor: string;
  fillColor?: string;
  strokeWidth: number;
  opacity?: number;
}

export interface RectangleObject extends CanvasObjectBase {
  type: "rectangle";
  style: ShapeStyle;
}

export interface EllipseObject extends CanvasObjectBase {
  type: "ellipse";
  style: ShapeStyle;
}

export interface LineObject extends CanvasObjectBase {
  type: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  style: ShapeStyle;
}

export interface ArrowObject extends CanvasObjectBase {
  type: "arrow";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  style: ShapeStyle;
}

export interface PolygonObject extends CanvasObjectBase {
  type: "polygon";
  points: Array<{ x: number; y: number }>;
  style: ShapeStyle;
}

export interface ImageObject extends CanvasObjectBase {
  type: "image";
  src: string;
  alt?: string;
}

export interface GraphObject extends CanvasObjectBase {
  type: "graph";
  /** Normalized mathematical expression retained for future re-editing (section 48). */
  expression: string;
  renderedImageSrc: string;
}

export interface AiGenerationGroupObject extends CanvasObjectBase {
  type: "ai-generation-group";
  childObjectIds: string[];
  /** The original request/action this group was generated from, for auditability. */
  sourceAction: string;
}

export type CanvasObject =
  | StrokeObject
  | TextboxObject
  | RectangleObject
  | EllipseObject
  | LineObject
  | ArrowObject
  | PolygonObject
  | ImageObject
  | GraphObject
  | AiGenerationGroupObject;

export type PageSize = "letter" | "a4" | "legal" | "cue-card";
export type PageOrientation = "portrait" | "landscape";
export type PageTemplate = "plain" | "lined" | "graph" | "notepad";

export interface Page {
  id: string;
  notebookId: string;
  order: number;
  size: PageSize;
  orientation: PageOrientation;
  template: PageTemplate;
  createdAt: string;
  updatedAt: string;
}

export interface Notebook {
  id: string;
  ownerId: string;
  name: string;
  folderId: string | null;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  thumbnailUrl?: string;
}

export interface Folder {
  id: string;
  ownerId: string;
  name: string;
  parentFolderId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ViewportState {
  x: number;
  y: number;
  zoom: number;
}

export interface PageDimensions {
  width: number;
  height: number;
}

export const PAGE_SIZE_OPTIONS: { value: PageSize; label: string; dimensions: string }[] = [
  { value: "a4", label: "A4", dimensions: "210 × 297 mm" },
  { value: "letter", label: "Letter", dimensions: "8.5 × 11 in" },
  { value: "legal", label: "Legal", dimensions: "8.5 × 14 in" },
  { value: "cue-card", label: "Cue card", dimensions: "4 × 6 in" },
];

/** Standard page dimensions in 96 DPI CSS pixels. */
export const PAGE_DIMENSIONS: Record<PageSize, Record<PageOrientation, PageDimensions>> = {
  a4: {
    portrait: { width: 794, height: 1123 },
    landscape: { width: 1123, height: 794 },
  },
  letter: {
    portrait: { width: 816, height: 1056 },
    landscape: { width: 1056, height: 816 },
  },
  legal: {
    portrait: { width: 816, height: 1344 },
    landscape: { width: 1344, height: 816 },
  },
  "cue-card": {
    portrait: { width: 384, height: 576 },
    landscape: { width: 576, height: 384 },
  },
};
