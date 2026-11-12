import { act, createEvent, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Page, StrokeObject } from "@ai-notes/shared";
import { CanvasViewport, type CanvasViewportProps } from "./CanvasViewport.js";

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
        activeTool="pen"
      />,
    );

    const canvas = screen.getByTestId("drawing-canvas");
    expect(canvas).toBeInTheDocument();
    expect(canvas).toHaveStyle({ width: "794px", height: "1123px" });

    const paperSheet = screen.getByTestId("paper-sheet");
    expect(paperSheet).toHaveStyle({ width: "794px", height: "1123px" });
  });

  it("opens at readable width while keeping full-page fitting available", () => {
    const width = vi
      .spyOn(HTMLElement.prototype, "clientWidth", "get")
      .mockReturnValue(1000);
    const height = vi
      .spyOn(HTMLElement.prototype, "clientHeight", "get")
      .mockReturnValue(800);
    const onViewportChange = vi.fn();
    const controls: NonNullable<CanvasViewportProps["viewportControlsRef"]> = {
      current: null,
    };
    try {
      render(
        <CanvasViewport
          page={dummyPage}
          strokes={[]}
          onStrokeComplete={vi.fn()}
          activeStyle={{ color: "#000", thickness: 4, opacity: 1 }}
          activeTool="pen"
          onViewportChange={onViewportChange}
          viewportControlsRef={controls}
        />,
      );
      expect(onViewportChange).toHaveBeenLastCalledWith(1);
      act(() => controls.current?.fitPage());
      expect(onViewportChange).toHaveBeenLastCalledWith(680 / 1123);
    } finally {
      width.mockRestore();
      height.mockRestore();
    }
  });

  it("handles drawing pointer events and calls onStrokeComplete", () => {
    const onStrokeComplete = vi.fn();
    render(
      <CanvasViewport
        page={dummyPage}
        strokes={[]}
        onStrokeComplete={onStrokeComplete}
        activeStyle={{ color: "#2563eb", thickness: 4, opacity: 1 }}
        activeTool="pen"
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

  it("cancels native wheel behavior while zooming the notebook", () => {
    const onViewportChange = vi.fn();
    render(
      <CanvasViewport
        page={dummyPage}
        strokes={[]}
        onStrokeComplete={vi.fn()}
        activeStyle={{ color: "#000", thickness: 4, opacity: 1 }}
        activeTool="pen"
        onViewportChange={onViewportChange}
      />,
    );
    const workspace = screen.getByTestId("canvas-workspace");
    const wheel = createEvent.wheel(workspace, {
      ctrlKey: true,
      deltaY: -100,
      cancelable: true,
    });
    fireEvent(workspace, wheel);
    expect(wheel.defaultPrevented).toBe(true);
    expect(onViewportChange).toHaveBeenLastCalledWith(1.08);
  });

  it("keeps one active erase pointer and finishes cancellation without an extra erase", () => {
    const onEraseStart = vi.fn();
    const onEraseAtPoint = vi.fn();
    const onEraseEnd = vi.fn();
    render(
      <CanvasViewport
        page={dummyPage}
        strokes={[]}
        onStrokeComplete={vi.fn()}
        activeStyle={{ color: "#fff", thickness: 20, opacity: 1 }}
        activeTool="eraser-partial"
        onEraseStart={onEraseStart}
        onEraseAtPoint={onEraseAtPoint}
        onEraseEnd={onEraseEnd}
      />,
    );
    const canvas = screen.getByTestId("drawing-canvas");
    fireEvent.pointerDown(canvas, {
      button: 0,
      pointerId: 1,
      clientX: 100,
      clientY: 100,
    });
    fireEvent.pointerDown(canvas, {
      button: 0,
      pointerId: 2,
      clientX: 200,
      clientY: 100,
    });
    fireEvent.pointerMove(canvas, { pointerId: 2, clientX: 300, clientY: 100 });
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 140, clientY: 120 });
    fireEvent.pointerCancel(canvas, { pointerId: 1 });
    fireEvent.lostPointerCapture(canvas, { pointerId: 1 });
    expect(onEraseStart).toHaveBeenCalledTimes(1);
    expect(onEraseAtPoint).toHaveBeenCalledTimes(2);
    expect(onEraseAtPoint).toHaveBeenLastCalledWith({ x: 100, y: 100 }, 10, false, {
      x: 140,
      y: 120,
    });
    expect(onEraseEnd).toHaveBeenCalledTimes(1);
  });
});
