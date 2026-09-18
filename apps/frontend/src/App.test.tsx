import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import App from "./App.js";

describe("App (Phase 2 Writing Tools)", () => {
  it("renders the canvas workspace, toolbar with history buttons, tool controls, and zoom widget", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: true } as Response))
    );

    render(<App />);

    // Brand and Phase 2 pill
    expect(screen.getByText(/Notes AI/i)).toBeInTheDocument();
    expect(screen.getByText(/Phase 2/i)).toBeInTheDocument();

    // Toolbar controls & History
    expect(screen.getByTestId("app-toolbar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Undo/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Redo/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Paper Template/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Page Size/i)).toBeInTheDocument();

    // Tools in Toolbar by title
    expect(screen.getByTitle(/Solid vector stroke/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Graphite texture/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Multiply blend/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Eraser/i)).toBeInTheDocument();

    // Floating zoom widget
    expect(screen.getByTestId("zoom-widget")).toBeInTheDocument();

    // Canvas elements
    expect(screen.getByTestId("canvas-workspace")).toBeInTheDocument();
    expect(screen.getByTestId("paper-sheet")).toBeInTheDocument();
    expect(screen.getByTestId("drawing-canvas")).toBeInTheDocument();

    // Backend status updates to online
    await waitFor(() => expect(screen.getByText(/online/i)).toBeInTheDocument());
  });
});
