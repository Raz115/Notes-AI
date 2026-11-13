import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App.js";

function openEditor() {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Open Untitled notebook" }));
}

const point = (x: number, y: number) => ({ button: 0, pointerId: 1, clientX: x, clientY: y });

function drawShape(layer: HTMLElement, x1: number, y1: number, x2: number, y2: number) {
  fireEvent.pointerDown(layer, point(x1, y1));
  fireEvent.pointerMove(layer, point(x2, y2));
  fireEvent.pointerUp(layer, point(x2, y2));
}

function lassoArea(layer: HTMLElement, x1: number, y1: number, x2: number, y2: number) {
  fireEvent.pointerDown(layer, point(x1, y1));
  fireEvent.pointerMove(layer, point(x2, y1));
  fireEvent.pointerMove(layer, point(x2, y2));
  fireEvent.pointerMove(layer, point(x1, y2));
  fireEvent.pointerUp(layer, point(x1, y1));
}

describe("App (Phase 2 Writing Tools)", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: true } as Response)),
    );
  });

  it("selects the labelled partial eraser first and then switches modes", () => {
    openEditor();

    fireEvent.click(screen.getByRole("button", { name: /Partial Eraser/i }));
    expect(screen.getByRole("button", { name: /Partial Eraser/i })).toHaveClass("active");
    fireEvent.click(screen.getByRole("button", { name: /Partial Eraser/i }));
    expect(screen.getByRole("button", { name: /Stroke Eraser/i })).toHaveClass("active");
  });

  it("renders the canvas workspace, toolbar with history buttons, tool controls, and zoom widget", async () => {
    openEditor();

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
    openEditor();
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

  it("creates, selects, moves, copies and deletes editable shapes with undo", () => {
    openEditor();
    const layer = screen.getByTestId("object-layer");
    const point = (x: number, y: number) => ({ button: 0, pointerId: 1, clientX: x, clientY: y });
    fireEvent.click(screen.getByRole("button", { name: "Shape" }));
    fireEvent.pointerDown(layer, point(100, 100));
    fireEvent.pointerMove(layer, point(200, 200));
    fireEvent.pointerUp(layer, point(200, 200));
    expect(layer.querySelector("rect[x='100']")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    fireEvent.pointerDown(layer, point(80, 80));
    fireEvent.pointerMove(layer, point(220, 80));
    fireEvent.pointerMove(layer, point(220, 220));
    fireEvent.pointerMove(layer, point(80, 220));
    fireEvent.pointerUp(layer, point(80, 80));
    const selection = screen.getByTestId("selection-box");
    fireEvent.pointerDown(selection, point(120, 120));
    fireEvent.pointerUp(selection, point(150, 140));
    expect(layer.querySelector("rect[x='130']")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(layer.querySelector("rect[x='100']")).toBeInTheDocument();
    const handle = screen.getByTestId("selection-resize");
    fireEvent.pointerDown(handle, point(200, 200));
    fireEvent.pointerMove(handle, point(250, 250));
    fireEvent.pointerUp(handle, point(250, 250));
    expect(layer.querySelector("rect[width='150']")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    fireEvent.change(screen.getByLabelText("Selection color"), { target: { value: "#ff0000" } });
    expect(layer.querySelector("rect[stroke='#ff0000']")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    fireEvent.click(screen.getByRole("button", { name: "Paste" }));
    expect(layer.querySelectorAll("rect[x='120']")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(layer.querySelectorAll("rect[x='120']")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(layer.querySelectorAll("rect[x='120']")).toHaveLength(1);
  });

  it("creates directly editable text and restores text edits with undo", () => {
    openEditor();
    const layer = screen.getByTestId("object-layer");
    fireEvent.click(screen.getByRole("button", { name: "Text" }));
    fireEvent.pointerDown(layer, { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
    const text = screen.getByRole("textbox", { name: "Text box" });
    fireEvent.change(text, { target: { value: "Hello notes" } });
    fireEvent.blur(text);
    expect(text).toHaveValue("Hello notes");
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(text).toHaveValue("");
  });

  it("does not add an undo step when a selection is dragged back to its starting point", () => {
    openEditor();
    const layer = screen.getByTestId("object-layer");
    const point = (x: number, y: number) => ({ button: 0, pointerId: 1, clientX: x, clientY: y });
    fireEvent.click(screen.getByRole("button", { name: "Shape" }));
    fireEvent.pointerDown(layer, point(100, 100));
    fireEvent.pointerUp(layer, point(200, 200));
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    fireEvent.pointerDown(layer, point(80, 80));
    fireEvent.pointerMove(layer, point(220, 80));
    fireEvent.pointerMove(layer, point(220, 220));
    fireEvent.pointerMove(layer, point(80, 220));
    fireEvent.pointerUp(layer, point(80, 80));
    const selected = screen.getByTestId("selection-box");
    fireEvent.pointerDown(selected, point(120, 120));
    fireEvent.pointerMove(selected, point(150, 140));
    fireEvent.pointerUp(selected, point(120, 120));
    expect(layer.querySelector("rect[x='100']")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(layer.querySelector("rect[x='100']")).not.toBeInTheDocument();
  });

  it("cleans up a selected stroke and restores the original with undo", () => {
    openEditor();
    const canvas = screen.getByTestId("drawing-canvas");
    const layer = screen.getByTestId("object-layer");
    const point = (x: number, y: number) => ({ button: 0, pointerId: 1, clientX: x, clientY: y });
    fireEvent.pointerDown(canvas, point(100, 100));
    fireEvent.pointerUp(canvas, point(200, 100));
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    fireEvent.pointerDown(layer, point(80, 80));
    fireEvent.pointerMove(layer, point(220, 80));
    fireEvent.pointerMove(layer, point(220, 120));
    fireEvent.pointerMove(layer, point(80, 120));
    fireEvent.pointerUp(layer, point(80, 80));
    fireEvent.click(screen.getByRole("button", { name: "Clean up shape" }));
    expect(layer.querySelector("line")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(layer.querySelector("line")).not.toBeInTheDocument();
  });

  it("keeps pages independent when adding, reordering and deleting", () => {
    openEditor();
    const point = (x: number, y: number) => ({ button: 0, pointerId: 1, clientX: x, clientY: y });
    const first = screen.getByTestId("drawing-canvas");
    fireEvent.pointerDown(first, point(100, 100));
    fireEvent.pointerUp(first, point(200, 100));
    fireEvent.click(screen.getByRole("button", { name: "Add page" }));
    expect(screen.getAllByTestId("paper-sheet")).toHaveLength(2);
    expect(screen.getByLabelText("Current page")).toHaveDisplayValue("Page 2");
    const second = screen.getAllByTestId("drawing-canvas")[1]!;
    fireEvent.pointerDown(second, point(100, 100));
    fireEvent.pointerUp(second, point(200, 100));
    fireEvent.click(screen.getByRole("button", { name: /Partial eraser/i }));
    fireEvent.pointerDown(second, point(150, 100));
    fireEvent.pointerUp(second, point(150, 100));
    fireEvent.click(screen.getByRole("button", { name: "Move page up" }));
    expect(screen.getByLabelText("Current page")).toHaveDisplayValue("Page 1");
    fireEvent.click(screen.getByRole("button", { name: "Delete page" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete page" }));
    expect(screen.getAllByTestId("paper-sheet")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Notebook options" }));
    expect(screen.getByText("1 stroke on this page")).toBeInTheDocument();
  });

  it("pastes copied objects onto the active page without changing the source", () => {
    openEditor();
    const layer = screen.getByTestId("object-layer");
    const point = (x: number, y: number) => ({ button: 0, pointerId: 1, clientX: x, clientY: y });
    fireEvent.click(screen.getByRole("button", { name: "Shape" }));
    fireEvent.pointerDown(layer, point(100, 100));
    fireEvent.pointerUp(layer, point(200, 200));
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    fireEvent.pointerDown(layer, point(80, 80));
    fireEvent.pointerMove(layer, point(220, 80));
    fireEvent.pointerMove(layer, point(220, 220));
    fireEvent.pointerMove(layer, point(80, 220));
    fireEvent.pointerUp(layer, point(80, 80));
    fireEvent.keyDown(window, { key: "c", ctrlKey: true });
    fireEvent.click(screen.getByRole("button", { name: "Add page" }));
    fireEvent.keyDown(window, { key: "v", ctrlKey: true });
    const layers = screen.getAllByTestId("object-layer");
    expect(layers[0]?.querySelector("rect[x='100']")).toBeInTheDocument();
    expect(layers[1]?.querySelector("rect[x='120']")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(layers[0]?.querySelector("rect[x='100']")).toBeInTheDocument();
    expect(layers[1]?.querySelector("rect[x='120']")).not.toBeInTheDocument();
  });

  it("creates nested folders and duplicates a notebook with its pages and content", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "New folder" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Studies" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    fireEvent.click(screen.getByRole("button", { name: /Studies/ }));
    fireEvent.click(screen.getByRole("button", { name: "New folder" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Math" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    fireEvent.click(screen.getByRole("button", { name: /Math/ }));
    fireEvent.click(screen.getByRole("button", { name: "New notebook" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Algebra" } });
    fireEvent.change(screen.getByLabelText("Orientation"), { target: { value: "landscape" } });
    fireEvent.change(screen.getByLabelText("Template"), { target: { value: "graph" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(screen.getByRole("heading", { name: "Algebra" })).toBeInTheDocument();
    expect(screen.getByTestId("drawing-canvas")).toHaveStyle({ width: "1123px" });
    const canvas = screen.getByTestId("drawing-canvas");
    fireEvent.pointerDown(canvas, { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(canvas, { button: 0, pointerId: 1, clientX: 200, clientY: 100 });
    fireEvent.click(screen.getByRole("button", { name: "Add page" }));
    fireEvent.click(screen.getByRole("button", { name: "Back to notebooks" }));
    const card = screen.getByRole("button", { name: "Open Algebra" }).closest("article")!;
    expect(card.querySelector("polyline")).toBeInTheDocument();
    fireEvent.click(within(card).getByRole("button", { name: "Notebook actions for Algebra" }));
    fireEvent.click(within(card).getByRole("button", { name: "Duplicate" }));
    const copy = screen.getByRole("button", { name: "Open Algebra copy" }).closest("article")!;
    fireEvent.click(within(copy).getByRole("button", { name: "Pin" }));
    expect(within(copy).getByRole("button", { name: "Unpin" })).toBeInTheDocument();
    fireEvent.click(within(copy).getByRole("button", { name: "Open Algebra copy" }));
    expect(screen.getAllByTestId("paper-sheet")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Notebook options" }));
    expect(screen.getByText("1 stroke on this page")).toBeInTheDocument();
  });

  it("deletes nested folder contents only after confirmation", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "New folder" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Archive" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    fireEvent.click(screen.getByRole("button", { name: /Archive/ }));
    fireEvent.click(screen.getByRole("button", { name: "New notebook" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    fireEvent.click(screen.getByRole("button", { name: "Back to notebooks" }));
    fireEvent.click(screen.getByRole("button", { name: "All notebooks" }));
    const folder = screen.getByRole("button", { name: /Archive/ }).closest("article")!;
    fireEvent.click(within(folder).getByRole("button", { name: "Delete" }));
    expect(screen.getByText(/nested folders and notebooks/i)).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));
    expect(screen.queryByRole("button", { name: /Archive/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Untitled notebook" })).toBeInTheDocument();
  });

  it("deletes notebook page objects as well as its dashboard entry", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Open Untitled notebook" }));
    fireEvent.click(screen.getByRole("button", { name: "Shape" }));
    const layer = screen.getByTestId("object-layer");
    fireEvent.pointerDown(layer, { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(layer, { button: 0, pointerId: 1, clientX: 200, clientY: 200 });
    fireEvent.click(screen.getByRole("button", { name: "Back to notebooks" }));
    const card = screen.getByRole("button", { name: "Open Untitled notebook" }).closest("article")!;
    expect(card.querySelector("rect")).toBeInTheDocument();
    fireEvent.click(within(card).getByRole("button", { name: "Notebook actions for Untitled notebook" }));
    fireEvent.click(within(card).getByRole("button", { name: "Delete" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));
    expect(screen.queryByRole("button", { name: "Open Untitled notebook" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New notebook" })).toBeInTheDocument();
  });

  it("moves notebooks and folders by dragging and supports renaming", () => {
    render(<App />);
    for (const name of ["Projects", "Inbox"]) {
      fireEvent.click(screen.getByRole("button", { name: "New folder" }));
      fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: name } });
      fireEvent.click(screen.getByRole("button", { name: "Create" }));
    }
    const project = screen.getByRole("button", { name: /Projects/ }).closest("article")!;
    const inbox = screen.getByRole("button", { name: /Inbox/ }).closest("article")!;
    const notebook = screen.getByRole("button", { name: "Open Untitled notebook" }).closest("article")!;
    const values: Record<string, string> = {};
    const transfer = { setData: (key: string, value: string) => { values[key] = value; },
      getData: (key: string) => values[key] ?? "" };
    fireEvent.dragStart(inbox, { dataTransfer: transfer });
    fireEvent.drop(project, { dataTransfer: transfer });
    delete values["application/x-notes-folder"];
    fireEvent.dragStart(notebook, { dataTransfer: transfer });
    fireEvent.drop(project, { dataTransfer: transfer });
    expect(screen.queryByRole("button", { name: "Open Untitled notebook" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Projects/ }));
    expect(screen.getByRole("button", { name: /Inbox/ })).toBeInTheDocument();
    const moved = screen.getByRole("button", { name: "Open Untitled notebook" }).closest("article")!;
    fireEvent.click(within(moved).getByRole("button", { name: "Notebook actions for Untitled notebook" }));
    fireEvent.click(within(moved).getByRole("button", { name: "Rename" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Plans" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("button", { name: "Open Plans" })).toBeInTheDocument();
  });

  it("keeps new-notebook defaults when returning from the editor", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.change(screen.getByLabelText("Paper size"), { target: { value: "letter" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    fireEvent.click(screen.getByRole("button", { name: "Open Untitled notebook" }));
    fireEvent.click(screen.getByRole("button", { name: "Back to notebooks" }));
    fireEvent.click(screen.getByRole("button", { name: "New notebook" }));
    expect(screen.getByLabelText("Paper size")).toHaveValue("letter");
  });

  it("keeps notebook actions behind the overflow button and dismisses it with Escape or an outside click", () => {
    render(<App />);
    const card = screen.getByRole("button", { name: "Open Untitled notebook" }).closest("article")!;
    const trigger = within(card).getByRole("button", { name: "Notebook actions for Untitled notebook" });
    expect(within(card).queryByRole("button", { name: "Rename" })).not.toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Pin" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(within(card).getByRole("button", { name: "Pin" }));
    expect(within(card).getByRole("button", { name: "Unpin" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(trigger);
    expect(within(card).getByRole("button", { name: "Rename" })).toHaveFocus();
    expect(within(card).getByRole("button", { name: "Duplicate" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(within(card).queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it.each([
    ["legal", "portrait", 816, 1344],
    ["cue-card", "landscape", 576, 384],
  ])("creates and extends %s paper with actual dimensions", (size, orientation, width, height) => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "New notebook" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Paper test" } });
    fireEvent.change(screen.getByLabelText("Paper size"), { target: { value: size } });
    fireEvent.change(screen.getByLabelText("Orientation"), { target: { value: orientation } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(screen.getByTestId("drawing-canvas")).toHaveStyle({ width: `${width}px`, height: `${height}px` });
    fireEvent.click(screen.getByRole("button", { name: "Add page" }));
    for (const canvas of screen.getAllByTestId("drawing-canvas")) {
      expect(canvas).toHaveStyle({ width: `${width}px`, height: `${height}px` });
    }
  });

  it("automatically appends using the last page's paper settings and activates the new page", () => {
    const width = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1000);
    const height = vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(800);
    try {
      openEditor();
      fireEvent.click(screen.getByRole("button", { name: "Add page" }));
      fireEvent.click(screen.getByRole("button", { name: "Page settings" }));
      fireEvent.click(screen.getByRole("button", { name: "Legal" }));
      fireEvent.click(screen.getByRole("button", { name: "Close settings" }));
      fireEvent.change(screen.getByLabelText("Current page"), { target: { value: "demo-page-1" } });
      fireEvent.wheel(screen.getByTestId("canvas-workspace"), { deltaY: 2100 });
      const canvases = screen.getAllByTestId("drawing-canvas");
      expect(canvases).toHaveLength(3);
      expect(canvases[2]).toHaveStyle({ width: "816px", height: "1344px" });
      expect(screen.getByLabelText("Current page")).toHaveDisplayValue("Page 3");
      fireEvent.wheel(screen.getByTestId("canvas-workspace"), { deltaY: 3000 });
      expect(screen.getAllByTestId("drawing-canvas")).toHaveLength(3);
    } finally {
      width.mockRestore();
      height.mockRestore();
    }
  });

  it("places icon tools in the main ribbon and provides an accessible icon shape chooser", () => {
    openEditor();
    const ribbon = screen.getByRole("toolbar", { name: "Editing tools" });
    for (const name of ["Select", "Text", "Shape"]) {
      const button = within(ribbon).getByRole("button", { name });
      expect(button.querySelector("svg")).toBeInTheDocument();
      expect(button).toHaveTextContent("");
    }
    expect(screen.queryByRole("combobox", { name: "Shape type" })).not.toBeInTheDocument();
    const trigger = within(ribbon).getByRole("button", { name: "Shape" });
    fireEvent.click(trigger);
    const picker = screen.getByRole("dialog", { name: "Shapes" });
    for (const name of ["Rectangle", "Ellipse", "Line", "Arrow", "Triangle"]) {
      const option = within(picker).getByRole("button", { name });
      expect(option.querySelector("svg")).toBeInTheDocument();
      expect(option).toHaveTextContent("");
    }
    fireEvent.click(within(picker).getByRole("button", { name: "Ellipse" }));
    expect(within(picker).getByRole("button", { name: "Ellipse" })).toHaveAttribute("aria-pressed", "true");
    expect(trigger.querySelector("ellipse")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Shapes" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it.each([
    ["Rectangle", "rect[x='100']", true],
    ["Ellipse", "ellipse", true],
    ["Triangle", "polygon", true],
    ["Line", "g > line", false],
    ["Arrow", "g > polyline", false],
  ])("creates %s with the appropriate fill and renders it in the notebook thumbnail", (name, selector, closed) => {
    openEditor();
    fireEvent.click(screen.getByRole("button", { name: "Shape" }));
    const picker = screen.getByRole("dialog", { name: "Shapes" });
    fireEvent.click(within(picker).getByRole("button", { name: "Solid" }));
    fireEvent.click(within(picker).getByRole("button", { name }));
    if (!closed) expect(within(picker).queryByRole("group", { name: "Fill" })).not.toBeInTheDocument();
    const layer = screen.getByTestId("object-layer");
    drawShape(layer, 100, 100, 200, 200);
    const rendered = layer.querySelector(selector);
    expect(rendered).toBeInTheDocument();
    expect(closed ? rendered : rendered?.parentElement).toHaveAttribute("fill", closed ? "#000000" : "none");

    fireEvent.click(screen.getByRole("button", { name: "Back to notebooks" }));
    const card = screen.getByRole("button", { name: "Open Untitled notebook" }).closest("article")!;
    const preview = card.querySelector(selector);
    expect(preview).toBeInTheDocument();
    expect(closed ? preview : preview?.parentElement).toHaveAttribute("fill", closed ? "#000000" : "none");
  });

  it("changes a selected shape's size, opacity and fill with atomic undo and redo", () => {
    openEditor();
    fireEvent.click(screen.getByRole("button", { name: "Shape" }));
    const layer = screen.getByTestId("object-layer");
    drawShape(layer, 100, 100, 200, 200);
    const rectangle = layer.querySelector("rect[x='100']");
    expect(rectangle).toHaveAttribute("fill", "none");
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    lassoArea(layer, 80, 80, 220, 220);
    fireEvent.click(screen.getByRole("button", { name: "Shape style" }));
    const panel = screen.getByRole("dialog", { name: "Shape style" });
    const width = within(panel).getByRole("slider", { name: "Shape size" });
    const opacity = within(panel).getByRole("slider", { name: "Shape opacity" });
    expect(width).toHaveValue("4");
    expect(opacity).toHaveValue("1");
    fireEvent.pointerDown(width, { button: 0, pointerId: 1 });
    fireEvent.change(width, { target: { value: "9" } });
    fireEvent.change(width, { target: { value: "16" } });
    fireEvent.pointerUp(width, { pointerId: 1 });
    expect(rectangle).toHaveAttribute("stroke-width", "16");
    expect(width).toHaveAttribute("aria-valuetext", "16 pixels");

    act(() => width.focus());
    fireEvent.keyDown(width, { key: "z", ctrlKey: true });
    expect(rectangle).toHaveAttribute("stroke-width", "4");
    fireEvent.keyDown(width, { key: "z", ctrlKey: true, shiftKey: true });
    expect(rectangle).toHaveAttribute("stroke-width", "16");

    fireEvent.pointerDown(opacity, { button: 0, pointerId: 1 });
    fireEvent.change(opacity, { target: { value: "0.5" } });
    fireEvent.change(opacity, { target: { value: "0.35" } });
    fireEvent.pointerCancel(opacity, { pointerId: 1 });
    expect(rectangle).toHaveAttribute("opacity", "0.35");
    expect(opacity).toHaveAttribute("aria-valuetext", "35%");
    fireEvent.click(within(panel).getByRole("button", { name: "Solid" }));
    expect(rectangle).toHaveAttribute("fill", "#000000");

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(rectangle).toHaveAttribute("fill", "none");
    fireEvent.pointerDown(width, { button: 0, pointerId: 1 });
    fireEvent.pointerUp(width, { pointerId: 1 });
    expect(screen.getByRole("button", { name: "Redo" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(rectangle).toHaveAttribute("opacity", "1");
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(rectangle).toHaveAttribute("stroke-width", "4");
    fireEvent.click(screen.getByRole("button", { name: "Redo" }));
    fireEvent.click(screen.getByRole("button", { name: "Redo" }));
    fireEvent.click(screen.getByRole("button", { name: "Redo" }));
    expect(rectangle).toHaveAttribute("stroke-width", "16");
    expect(rectangle).toHaveAttribute("opacity", "0.35");
    expect(rectangle).toHaveAttribute("fill", "#000000");
    fireEvent.change(screen.getByLabelText("Selection color"), { target: { value: "#ff0000" } });
    expect(rectangle).toHaveAttribute("stroke", "#ff0000");
    expect(rectangle).toHaveAttribute("fill", "#ff0000");
  });

  it("formats only selected shapes in a mixed selection and reports mixed settings", () => {
    openEditor();
    fireEvent.click(screen.getByRole("button", { name: "Shape" }));
    const layer = screen.getByTestId("object-layer");
    drawShape(layer, 100, 100, 170, 170);
    fireEvent.click(screen.getByRole("button", { name: "Tool settings" }));
    fireEvent.change(screen.getByRole("slider", { name: /Thickness/i }), { target: { value: "8" } });
    fireEvent.change(screen.getByRole("slider", { name: /Opacity/i }), { target: { value: "0.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Close settings" }));
    fireEvent.click(screen.getByRole("button", { name: "Shape" }));
    fireEvent.click(screen.getByRole("button", { name: "Ellipse" }));
    fireEvent.click(screen.getByRole("button", { name: "Solid" }));
    drawShape(layer, 220, 100, 280, 170);
    fireEvent.click(screen.getByRole("button", { name: "Shape" }));
    fireEvent.click(screen.getByRole("button", { name: "Line" }));
    drawShape(layer, 320, 100, 360, 170);
    fireEvent.click(screen.getByRole("button", { name: "Shape" }));
    fireEvent.click(screen.getByRole("button", { name: "Rectangle" }));
    drawShape(layer, 500, 100, 560, 170);

    fireEvent.click(screen.getByRole("button", { name: "Text" }));
    fireEvent.pointerDown(layer, point(120, 200));
    const text = screen.getByRole("textbox", { name: "Text box" });
    fireEvent.change(text, { target: { value: "Keep me" } });
    fireEvent.blur(text);
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    lassoArea(layer, 80, 80, 400, 290);
    fireEvent.click(screen.getByRole("button", { name: "Shape style" }));
    const panel = screen.getByRole("dialog", { name: "Shape style" });
    const width = within(panel).getByRole("slider", { name: "Shape size" });
    const opacity = within(panel).getByRole("slider", { name: "Shape opacity" });
    expect(width).toHaveAttribute("aria-valuetext", "Mixed");
    expect(opacity).toHaveAttribute("aria-valuetext", "Mixed");
    expect(within(panel).getByRole("group", { name: /Fill.*Mixed/ })).toBeInTheDocument();
    fireEvent.change(width, { target: { value: "14" } });
    fireEvent.change(opacity, { target: { value: "0.6" } });
    fireEvent.click(within(panel).getByRole("button", { name: "Solid" }));

    const rectangle = layer.querySelector("rect[x='100']");
    const ellipse = layer.querySelector("ellipse");
    const line = layer.querySelector("g > line")?.parentElement;
    for (const shape of [rectangle, ellipse, line]) {
      expect(shape).toHaveAttribute("stroke-width", "14");
      expect(shape).toHaveAttribute("opacity", "0.6");
    }
    expect(rectangle).toHaveAttribute("fill", "#000000");
    expect(ellipse).toHaveAttribute("fill", "#000000");
    expect(line).toHaveAttribute("fill", "none");
    expect(layer.querySelector("rect[x='500']")).toHaveAttribute("stroke-width", "8");
    expect(text).toHaveValue("Keep me");
    expect(text).toHaveStyle({ color: "#000000", fontSize: "18px" });
  });

  it("commits an in-progress slider gesture when its panel is dismissed", () => {
    openEditor();
    fireEvent.click(screen.getByRole("button", { name: "Shape" }));
    const layer = screen.getByTestId("object-layer");
    drawShape(layer, 100, 100, 200, 200);
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    lassoArea(layer, 80, 80, 220, 220);
    fireEvent.click(screen.getByRole("button", { name: "Shape style" }));
    const opacity = screen.getByRole("slider", { name: "Shape opacity" });
    fireEvent.pointerDown(opacity, { button: 0, pointerId: 1 });
    fireEvent.change(opacity, { target: { value: "0.5" } });
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("dialog", { name: "Shape style" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(layer.querySelector("rect[x='100']")).toHaveAttribute("opacity", "1");
  });

  it("uses the last ink style for shapes after switching from the eraser", () => {
    openEditor();
    fireEvent.click(screen.getByRole("button", { name: "Ink color" }));
    fireEvent.change(screen.getByLabelText("Custom color"), { target: { value: "#ff0000" } });
    fireEvent.click(screen.getByRole("button", { name: "Close settings" }));
    fireEvent.click(screen.getByRole("button", { name: /Partial eraser/i }));
    expect(screen.getByTestId("canvas-workspace")).toHaveClass("cursor-none");
    fireEvent.pointerMove(screen.getByTestId("drawing-canvas"), point(100, 100));
    expect(document.querySelector(".eraser-cursor-ring")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    expect(screen.getByTestId("canvas-workspace")).toHaveClass("cursor-crosshair");
    expect(document.querySelector(".eraser-cursor-ring")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Shape" }));
    const layer = screen.getByTestId("object-layer");
    drawShape(layer, 100, 100, 200, 200);
    expect(layer.querySelector("rect[x='100']")).toHaveAttribute("stroke", "#ff0000");
  });
});
