import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Page, StrokeObject } from "@ai-notes/shared";
import { CanvasViewport } from "./CanvasViewport.js";

describe("CanvasViewport", () => {
  const dummyPage: Page = {
    id: "test-page-1",
    notebookId: "test-notebook",
    order: 0,
    size: "a4",
    orientation: "portrait",
    template: "plain",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it("renders the canvas and container with A4 portrait dimensions", () => {
    render(
      <CanvasViewport
        page={dummyPage}
        strokes={[]}
        onStrokeComplete={vi.fn()}
        activeStyle={{ color: "#000", thickness: 4, opacity: 1 }}
      />,
    );

    const canvas = screen.getByTestId("drawing-canvas");
    expect(canvas).toBeInTheDocument();
    expect(canvas).toHaveStyle({ width: "794px", height: "1123px" });

    const paperSheet = screen.getByTestId("paper-sheet");
    expect(paperSheet).toHaveStyle({ width: "794px", height: "1123px" });
  });

  it("handles drawing pointer events and calls onStrokeComplete", () => {
    const onStrokeComplete = vi.fn();
    render(
      <CanvasViewport
        page={dummyPage}
        strokes={[]}
        onStrokeComplete={onStrokeComplete}
        activeStyle={{ color: "#2563eb", thickness: 4, opacity: 1 }}
      />,
    );

    const canvas = screen.getByTestId("drawing-canvas");

    // Mock setPointerCapture & releasePointerCapture on canvas
    canvas.setPointerCapture = vi.fn();
    canvas.releasePointerCapture = vi.fn();

    // Start stroke
    fireEvent.pointerDown(canvas, {
      button: 0,
      clientX: 100,
      clientY: 100,
      pointerId: 1,
    });

    // Move stroke
    fireEvent.pointerMove(canvas, {
      clientX: 120,
      clientY: 130,
      pointerId: 1,
    });

    // End stroke
    fireEvent.pointerUp(canvas, {
      clientX: 120,
      clientY: 130,
      pointerId: 1,
    });

    expect(onStrokeComplete).toHaveBeenCalledTimes(1);
    const stroke: StrokeObject = onStrokeComplete.mock.calls[0][0];
    expect(stroke.type).toBe("pen-stroke");
    expect(stroke.style.color).toBe("#2563eb");
    expect(stroke.points.length).toBeGreaterThanOrEqual(1);
  });
});
