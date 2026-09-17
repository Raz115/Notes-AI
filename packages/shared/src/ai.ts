/**
 * AI request/response contracts shared between frontend and backend.
 * See technical-requirements.md sections 27, 29, 31, 39.
 */

import type { CanvasObject } from "./canvas.js";

/** How much context the backend needed to escalate to for a given request. */
export type AiContextLevel = "text-only" | "text-and-region-image";

export interface AiSelectionContext {
  pageId: string;
  /** IDs of canvas objects inside the user's selection/circle. */
  selectedObjectIds: string[];
  /** Cached OCR text for the selection, if available. */
  recognizedText?: string;
  /** Base64-encoded cropped region image, only included when escalation is required. */
  regionImageBase64?: string;
}

export type AiResponseType =
  | "written-answer"
  | "multiple-choice"
  | "fill-in-blank"
  | "identify"
  | "diagram"
  | "explanation"
  | "summary"
  | "graph";

export interface AiRequest {
  notebookId: string;
  pageId: string;
  context: AiSelectionContext;
  /** Free-text instruction extracted from the user's handwriting, if any. */
  instruction?: string;
}

/** A single drawing primitive the AI may emit; validated before rendering (section 34). */
export type AiDrawingPrimitive =
  | { type: "line"; x1: number; y1: number; x2: number; y2: number }
  | { type: "circle"; x: number; y: number; radius: number }
  | { type: "ellipse"; x: number; y: number; rx: number; ry: number }
  | { type: "rectangle"; x: number; y: number; width: number; height: number }
  | { type: "polygon"; points: Array<{ x: number; y: number }> }
  | { type: "arrow"; x1: number; y1: number; x2: number; y2: number }
  | { type: "path"; points: Array<{ x: number; y: number }> }
  | { type: "text"; x: number; y: number; content: string };

export interface AiDrawingResponse {
  responseType: "diagram";
  objects: AiDrawingPrimitive[];
}

export interface AiTextResponse {
  responseType: Exclude<AiResponseType, "diagram" | "graph">;
  text: string;
  /** Suggested placement anchor near the source selection; final placement resolved by placement algorithm. */
  anchorObjectId?: string;
}

export interface AiGraphResponse {
  responseType: "graph";
  expression: string;
}

export type AiResponse = AiTextResponse | AiDrawingResponse | AiGraphResponse;

export interface AiGenerationResult {
  requestId: string;
  createdObjects: CanvasObject[];
  groupId: string;
}
