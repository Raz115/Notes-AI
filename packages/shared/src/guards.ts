import type { CanvasObject, StrokeObject, TextboxObject } from "./canvas.js";

export function isStrokeObject(obj: CanvasObject): obj is StrokeObject {
  return (
    obj.type === "pen-stroke" ||
    obj.type === "pencil-stroke" ||
    obj.type === "highlighter-stroke"
  );
}

export function isTextboxObject(obj: CanvasObject): obj is TextboxObject {
  return obj.type === "textbox";
}

export function isAiGenerated(obj: CanvasObject): boolean {
  return obj.source === "ai";
}
