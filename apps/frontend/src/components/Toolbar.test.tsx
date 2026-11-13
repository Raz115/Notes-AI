import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Toolbar, type ToolbarProps } from "./Toolbar.js";

function renderToolbar(overrides: Partial<ToolbarProps> = {}) {
  const props: ToolbarProps = {
    activeTool: "pen",
    onSelectTool: vi.fn(),
    activeStyle: { color: "#000000", thickness: 4, opacity: 1 },
    onUpdateStyle: vi.fn(),
    template: "plain",
    onTemplateChange: vi.fn(),
    size: "a4",
    onSizeChange: vi.fn(),
    orientation: "portrait",
    onOrientationChange: vi.fn(),
    strokeCount: 0,
    onClearPage: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    canUndo: false,
    canRedo: false,
    backendStatus: "online",
    ...overrides,
  };
  render(<Toolbar {...props} />);
  return props;
}

describe("Toolbar", () => {
  it("keeps the 15 most recently selected colors and reapplies a selected color", () => {
    const { onUpdateStyle } = renderToolbar();
    fireEvent.click(screen.getByRole("button", { name: "Ink color" }));
    const input = screen.getByLabelText("Custom color");
    for (let i = 1; i <= 16; i++) {
      fireEvent.change(input, {
        target: { value: `#${i.toString(16).padStart(6, "0")}` },
      });
    }

    const colors = screen.getByLabelText("Recent colors");
    expect(within(colors).getAllByRole("button")).toHaveLength(15);
    expect(
      within(colors).queryByRole("button", { name: "Recent color #000001" }),
    ).toBeNull();
    fireEvent.click(within(colors).getByRole("button", { name: "Recent color #000002" }));
    expect(onUpdateStyle).toHaveBeenLastCalledWith({ color: "#000002" });
    expect(within(colors).getAllByRole("button")).toHaveLength(15);
    expect(within(colors).getAllByRole("button")[0]).toHaveAccessibleName(
      "Recent color #000002",
    );
  });

  it("updates tool settings and returns keyboard focus when dismissed", () => {
    const { onUpdateStyle } = renderToolbar();
    const trigger = screen.getByRole("button", { name: "Tool settings" });
    fireEvent.click(trigger);
    fireEvent.change(screen.getByRole("slider", { name: /Thickness/i }), {
      target: { value: "12" },
    });
    fireEvent.change(screen.getByRole("slider", { name: /Opacity/i }), {
      target: { value: "0.5" },
    });
    expect(onUpdateStyle).toHaveBeenCalledWith({ thickness: 12 });
    expect(onUpdateStyle).toHaveBeenCalledWith({ opacity: 0.5 });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("keeps paper controls available in a dismissible panel", () => {
    const { onTemplateChange, onSizeChange, onOrientationChange } = renderToolbar();
    fireEvent.click(screen.getByRole("button", { name: "Page settings" }));
    fireEvent.click(screen.getByRole("button", { name: "Notepad" }));
    fireEvent.click(screen.getByRole("button", { name: "Letter" }));
    fireEvent.click(screen.getByRole("button", { name: "Legal" }));
    fireEvent.click(screen.getByRole("button", { name: "Cue card" }));
    fireEvent.click(screen.getByRole("button", { name: "Landscape" }));
    expect(onTemplateChange).toHaveBeenCalledWith("notepad");
    expect(onSizeChange).toHaveBeenCalledWith("letter");
    expect(onSizeChange).toHaveBeenCalledWith("legal");
    expect(onSizeChange).toHaveBeenCalledWith("cue-card");
    expect(onOrientationChange).toHaveBeenCalledWith("landscape");
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the current eraser mode on hover and dims the other mode", () => {
    const { onSelectTool } = renderToolbar({ activeTool: "eraser-stroke" });
    fireEvent.mouseEnter(screen.getByRole("button", { name: "Stroke eraser" }));
    const hint = screen.getByRole("group", { name: "Eraser mode" });
    expect(within(hint).getByRole("button", { name: "Whole stroke" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(hint).getByRole("button", { name: "Partial" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    fireEvent.click(within(hint).getByRole("button", { name: "Partial" }));
    expect(onSelectTool).toHaveBeenCalledWith("eraser-partial");
    fireEvent.mouseLeave(screen.getByRole("button", { name: "Stroke eraser" }));
    expect(screen.queryByRole("group", { name: "Eraser mode" })).not.toBeInTheDocument();
  });

  it("requires confirmation before clearing a page", () => {
    const { onClearPage } = renderToolbar({ strokeCount: 3 });
    fireEvent.click(screen.getByRole("button", { name: "Notebook options" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear page" }));
    expect(onClearPage).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClearPage).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Clear page" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear page" }));
    expect(onClearPage).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
