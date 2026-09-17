import { describe, expect, it } from "vitest";
import { isAiGenerated, isStrokeObject, isTextboxObject } from "./guards.js";
import type { StrokeObject, TextboxObject } from "./canvas.js";

function baseFields() {
  return {
    id: "obj-1",
    pageId: "page-1",
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    rotation: 0,
    zIndex: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("isStrokeObject", () => {
  it("returns true for pen/pencil/highlighter strokes", () => {
    const stroke: StrokeObject = {
      ...baseFields(),
      type: "pen-stroke",
      source: "user",
      points: [{ x: 0, y: 0 }],
      style: { color: "#000", thickness: 2, opacity: 1 },
    };
    expect(isStrokeObject(stroke)).toBe(true);
  });

  it("returns false for non-stroke objects", () => {
    const textbox: TextboxObject = {
      ...baseFields(),
      type: "textbox",
      source: "user",
      text: "hello",
      font: "sans",
      fontSize: 14,
      bold: false,
      color: "#000",
    };
    expect(isStrokeObject(textbox)).toBe(false);
  });
});

describe("isTextboxObject", () => {
  it("identifies textboxes correctly", () => {
    const textbox: TextboxObject = {
      ...baseFields(),
      type: "textbox",
      source: "ai",
      text: "answer",
      font: "sans",
      fontSize: 14,
      bold: false,
      color: "#000",
    };
    expect(isTextboxObject(textbox)).toBe(true);
  });
});

describe("isAiGenerated", () => {
  it("flags objects with source 'ai'", () => {
    const textbox: TextboxObject = {
      ...baseFields(),
      type: "textbox",
      source: "ai",
      text: "answer",
      font: "sans",
      fontSize: 14,
      bold: false,
      color: "#000",
    };
    expect(isAiGenerated(textbox)).toBe(true);
  });

  it("returns false for user-created objects", () => {
    const textbox: TextboxObject = {
      ...baseFields(),
      type: "textbox",
      source: "user",
      text: "note",
      font: "sans",
      fontSize: 14,
      bold: false,
      color: "#000",
    };
    expect(isAiGenerated(textbox)).toBe(false);
  });
});
