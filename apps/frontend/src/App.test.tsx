import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App.js";

describe("App (Phase 2 Writing Tools)", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: true } as Response)),
    );
  });

  it("selects the labelled partial eraser first and then switches modes", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Partial Eraser/i }));
    expect(screen.getByRole("button", { name: /Partial Eraser/i })).toHaveClass("active");
    fireEvent.click(screen.getByRole("button", { name: /Partial Eraser/i }));
    expect(screen.getByRole("button", { name: /Stroke Eraser/i })).toHaveClass("active");
  });

  it("renders the canvas workspace, toolbar with history buttons, tool controls, and zoom widget", async () => {
    render(<App />);

    expect(screen.getByText(/Notes AI/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Untitled notebook" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Session only")).toBeInTheDocument();

    expect(screen.getByTestId("app-toolbar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Undo/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Redo/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Page settings" }));
    expect(screen.getByRole("group", { name: /Paper template/i })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /Page size/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close settings" }));

    expect(screen.getByTitle(/Solid vector stroke/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Graphite texture/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Multiply blend/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Eraser/i)).toBeInTheDocument();

    expect(screen.getByTestId("zoom-widget")).toBeInTheDocument();

    expect(screen.getByTestId("canvas-workspace")).toBeInTheDocument();
    expect(screen.getByTestId("paper-sheet")).toBeInTheDocument();
    expect(screen.getByTestId("drawing-canvas")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Notebook options" }));
    await waitFor(() =>
      expect(screen.getByTestId("backend-status")).toHaveTextContent("API online"),
    );
  });

  it("erases sparse strokes along pointer paths and undoes each gesture atomically", () => {
    render(<App />);
    const canvas = screen.getByTestId("drawing-canvas");
    const expectStrokeCount = (count: number) => {
      fireEvent.click(screen.getByRole("button", { name: "Notebook options" }));
      expect(
        screen.getByText(`${count} ${count === 1 ? "stroke" : "strokes"} on this page`),
      ).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Close settings" }));
    };
    const point = (x: number, y: number) => ({
      button: 0,
      pointerId: 1,
      clientX: x,
      clientY: y,
    });
    fireEvent.pointerDown(canvas, point(100, 100));
    fireEvent.pointerUp(canvas, point(300, 100));
    expectStrokeCount(1);

    fireEvent.click(screen.getByRole("button", { name: /Partial eraser/i }));
    fireEvent.pointerDown(canvas, point(200, 80));
    fireEvent.pointerMove(canvas, point(200, 120));
    fireEvent.pointerUp(canvas, point(200, 120));
    expectStrokeCount(2);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expectStrokeCount(1);
    fireEvent.click(screen.getByRole("button", { name: "Redo" }));
    expectStrokeCount(2);

    fireEvent.click(screen.getByRole("button", { name: /Partial eraser/i }));
    fireEvent.pointerDown(canvas, point(90, 100));
    fireEvent.pointerMove(canvas, point(310, 100));
    fireEvent.pointerUp(canvas, point(310, 100));
    expectStrokeCount(0);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expectStrokeCount(2);

    fireEvent.pointerDown(canvas, point(600, 600));
    fireEvent.pointerUp(canvas, point(600, 600));
    expect(screen.getByRole("button", { name: "Redo" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Redo" }));
    expectStrokeCount(0);
  });
});
