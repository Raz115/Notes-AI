import { useCallback, useEffect, useRef, useState, type MouseEvent, type PointerEvent } from "react";
import type { TextboxObject } from "@ai-notes/shared";
import type { ShapeStyleChange } from "../canvas/objectGeometry.js";
import { Icon, type IconName } from "./Icon.js";

export type ObjectTool = "lasso" | "text" | "shape";
export type ShapeKind = "rectangle" | "ellipse" | "line" | "arrow" | "triangle";
type FillMode = "hollow" | "solid" | "mixed";

export interface SelectedShapeStyle {
  strokeWidth: number;
  opacity: number;
  mixedWidth: boolean;
  mixedOpacity: boolean;
  fill: FillMode | null;
}

interface ObjectToolbarProps {
  tool: ObjectTool | null;
  onSelectTool: (tool: ObjectTool) => void;
  shape: ShapeKind;
  onSelectShape: (shape: ShapeKind) => void;
  shapeFilled: boolean;
  onShapeFilledChange: (filled: boolean) => void;
  hasSelection: boolean;
  canPaste: boolean;
  selectedText: TextboxObject | null;
  onFormatText: (changes: Partial<Pick<TextboxObject, "font" | "fontSize" | "bold" | "color">>) => void;
  selectedShapeStyle: SelectedShapeStyle | null;
  onShapeStyleChange: (changes: ShapeStyleChange) => void;
  onShapeStyleGestureStart: () => void;
  onShapeStyleGestureEnd: () => void;
  canCleanShape: boolean;
  onCleanShape: () => void;
  onRecolor: (color: string) => void;
  selectionColor: string;
  onDelete: () => void;
  onCopy: () => void;
  onPaste: () => void;
}

const SHAPE_ICONS: Record<ShapeKind, IconName> = {
  rectangle: "rectangle", ellipse: "ellipse", line: "line", arrow: "arrow", triangle: "triangle",
};
const SHAPES: { value: ShapeKind; label: string }[] = [
  { value: "rectangle", label: "Rectangle" },
  { value: "ellipse", label: "Ellipse" },
  { value: "line", label: "Line" },
  { value: "arrow", label: "Arrow" },
  { value: "triangle", label: "Triangle" },
];

function FillOptions({ value, onChange }: { value: FillMode; onChange: (filled: boolean) => void }) {
  return (
    <fieldset className="settings-field">
      <legend>Fill {value === "mixed" && <span className="mixed-value">· Mixed</span>}</legend>
      <div className="segmented-control fill-options">
        <button type="button" aria-pressed={value === "hollow"} onClick={() => onChange(false)}>
          <span className="fill-sample" /> Hollow
        </button>
        <button type="button" aria-pressed={value === "solid"} onClick={() => onChange(true)}>
          <span className="fill-sample filled" /> Solid
        </button>
      </div>
    </fieldset>
  );
}

export function ObjectToolbar({
  tool, onSelectTool, shape, onSelectShape, shapeFilled, onShapeFilledChange,
  hasSelection, canPaste, selectedText, onFormatText, selectedShapeStyle,
  onShapeStyleChange, onShapeStyleGestureStart, onShapeStyleGestureEnd,
  canCleanShape, onCleanShape, onRecolor, selectionColor, onDelete, onCopy, onPaste,
}: ObjectToolbarProps) {
  const [panel, setPanel] = useState<{ kind: "shapes" | "style"; left: number; top: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const stylePointerRef = useRef<number | null>(null);
  const closePanel = useCallback((restoreFocus = true) => {
    setPanel(null);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);
  const finishStyleGesture = useCallback((pointerId?: number) => {
    if (stylePointerRef.current === null ||
      (pointerId !== undefined && stylePointerRef.current !== pointerId)) return;
    stylePointerRef.current = null;
    onShapeStyleGestureEnd();
  }, [onShapeStyleGestureEnd]);

  useEffect(() => {
    if (!panel) return;
    panelRef.current?.querySelector<HTMLElement>("button, input")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closePanel();
      }
    };
    const onPointerDown = (event: globalThis.PointerEvent) => {
      if (event.target instanceof Node && !panelRef.current?.contains(event.target) &&
        !triggerRef.current?.contains(event.target)) closePanel(false);
    };
    const onResize = () => closePanel(false);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", onResize);
      finishStyleGesture();
    };
  }, [panel, closePanel, finishStyleGesture]);

  useEffect(() => {
    if ((panel?.kind === "shapes" && tool !== "shape") ||
      (panel?.kind === "style" && (tool !== "lasso" || !selectedShapeStyle))) {
      closePanel(false);
    }
  }, [panel, tool, selectedShapeStyle, closePanel]);

  const togglePanel = (kind: "shapes" | "style", event: MouseEvent<HTMLButtonElement>) => {
    triggerRef.current = event.currentTarget;
    const rect = event.currentTarget.getBoundingClientRect();
    setPanel((previous) => previous?.kind === kind ? null : {
      kind,
      left: Math.max(12, Math.min(rect.right - 288, window.innerWidth - 300)),
      top: rect.bottom + 10,
    });
  };
  const startStyleGesture = (event: PointerEvent<HTMLInputElement>) => {
    if (event.button !== 0 || stylePointerRef.current !== null) return;
    stylePointerRef.current = event.pointerId;
    onShapeStyleGestureStart();
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const sliderGesture = {
    onPointerDown: startStyleGesture,
    onPointerUp: (event: PointerEvent<HTMLInputElement>) => finishStyleGesture(event.pointerId),
    onPointerCancel: (event: PointerEvent<HTMLInputElement>) => finishStyleGesture(event.pointerId),
    onLostPointerCapture: (event: PointerEvent<HTMLInputElement>) => finishStyleGesture(event.pointerId),
    onBlur: () => finishStyleGesture(),
  };
  const fillableShape = shape !== "line" && shape !== "arrow";

  return (
    <>
      <span className="toolbar-divider" />
      <div className="object-tools" aria-label="Object tools">
        <button type="button" className={`tool-btn object-tool-btn ${tool === "lasso" ? "active" : ""}`}
          aria-label="Select" aria-pressed={tool === "lasso"} title="Select objects"
          onClick={() => { closePanel(false); onSelectTool("lasso"); }}>
          <Icon name="lasso" />
        </button>
        <button type="button" className={`tool-btn object-tool-btn ${tool === "text" ? "active" : ""}`}
          aria-label="Text" aria-pressed={tool === "text"} title="Text box"
          onClick={() => { closePanel(false); onSelectTool("text"); }}>
          <Icon name="text" />
        </button>
        <button type="button" className={`tool-btn object-tool-btn shape-trigger ${tool === "shape" ? "active" : ""}`}
          aria-label="Shape" aria-pressed={tool === "shape"} aria-haspopup="dialog"
          aria-expanded={panel?.kind === "shapes"} aria-controls="object-settings" title="Shapes"
          onClick={(event) => {
            if (tool !== "shape") onSelectTool("shape");
            togglePanel("shapes", event);
          }}>
          <Icon name={SHAPE_ICONS[shape]} />
          <Icon name="chevron" className="shape-caret" />
        </button>
      </div>
      {tool === "lasso" && (hasSelection || canPaste) && (
        <>
          <span className="toolbar-divider" />
          <div className="selection-controls" aria-label="Selection actions">
            {hasSelection && <button type="button" className="icon-button" aria-label="Copy" title="Copy" onClick={onCopy}>
              <Icon name="copy" />
            </button>}
            {canPaste && <button type="button" className="icon-button" aria-label="Paste" title="Paste" onClick={onPaste}>
              <Icon name="paste" />
            </button>}
            {hasSelection && <button type="button" className="icon-button" aria-label="Delete" title="Delete" onClick={onDelete}>
              <Icon name="trash" />
            </button>}
            {canCleanShape && <button type="button" className="icon-button" aria-label="Clean up shape"
              title="Clean up shape" onClick={onCleanShape}>
              <Icon name="clean" />
            </button>}
            {hasSelection && !selectedText && <input className="selection-color" aria-label="Selection color"
              title="Selection color" type="color" value={selectionColor} onChange={(event) => onRecolor(event.target.value)} />}
            {selectedShapeStyle && (
              <button type="button" className="quiet-button shape-style-trigger" aria-label="Shape style"
                aria-haspopup="dialog" aria-expanded={panel?.kind === "style"} aria-controls="object-settings"
                title="Shape size, opacity and fill" onClick={(event) => togglePanel("style", event)}>
                <Icon name="settings" />
                <span>{selectedShapeStyle.mixedWidth ? "Mixed" : `${selectedShapeStyle.strokeWidth} px`}</span>
              </button>
            )}
            {selectedText && (
              <>
                <label>
                  <span className="visually-hidden">Font</span>
                  <select aria-label="Font" value={selectedText.font}
                    onChange={(event) => onFormatText({ font: event.target.value === "serif" ? "serif" : "sans" })}>
                    <option value="sans">Sans</option>
                    <option value="serif">Serif</option>
                  </select>
                </label>
                <input aria-label="Font size" type="number" min={8} max={96} value={selectedText.fontSize}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    if (value >= 8 && value <= 96) onFormatText({ fontSize: value });
                  }} />
                <button type="button" className="icon-button" aria-label="Bold"
                  aria-pressed={selectedText.bold}
                  onClick={() => onFormatText({ bold: !selectedText.bold })}><strong>B</strong></button>
                <input className="selection-color" aria-label="Text color" title="Text color"
                  type="color" value={selectedText.color} onChange={(event) => onFormatText({ color: event.target.value })} />
              </>
            )}
          </div>
        </>
      )}
      {panel && (
        <div ref={panelRef} id="object-settings" className="settings-panel object-settings"
          role="dialog" aria-labelledby="object-settings-title"
          style={{ left: panel.left, top: panel.top, maxHeight: `calc(100dvh - ${panel.top + 12}px)` }}>
          <div className="panel-heading">
            <h2 id="object-settings-title">{panel.kind === "shapes" ? "Shapes" : "Shape style"}</h2>
            <button type="button" className="icon-button small-button" aria-label="Close shape settings"
              onClick={() => closePanel()}>
              <Icon name="close" />
            </button>
          </div>
          {panel.kind === "shapes" && (
            <>
              <div className="shape-choices" role="group" aria-label="Shape type">
                {SHAPES.map((option) => (
                  <button key={option.value} type="button" aria-label={option.label} title={option.label}
                    aria-pressed={shape === option.value} onClick={() => onSelectShape(option.value)}>
                    <Icon name={SHAPE_ICONS[option.value]} />
                  </button>
                ))}
              </div>
              {fillableShape && <FillOptions value={shapeFilled ? "solid" : "hollow"} onChange={onShapeFilledChange} />}
            </>
          )}
          {panel.kind === "style" && selectedShapeStyle && (
            <>
              <div className="slider-field">
                <label htmlFor="selected-shape-width">
                  Size <span>{selectedShapeStyle.mixedWidth ? "Mixed" : `${selectedShapeStyle.strokeWidth} px`}</span>
                </label>
                <input id="selected-shape-width" type="range" min={1} max={60} step={1}
                  aria-label="Shape size" aria-valuetext={selectedShapeStyle.mixedWidth ? "Mixed" : `${selectedShapeStyle.strokeWidth} pixels`}
                  value={selectedShapeStyle.strokeWidth} {...sliderGesture}
                  onChange={(event) => onShapeStyleChange({ strokeWidth: Number(event.target.value) })} />
              </div>
              <div className="slider-field">
                <label htmlFor="selected-shape-opacity">
                  Opacity <span>{selectedShapeStyle.mixedOpacity ? "Mixed" : `${Math.round(selectedShapeStyle.opacity * 100)}%`}</span>
                </label>
                <input id="selected-shape-opacity" type="range" min={0.1} max={1} step={0.05}
                  aria-label="Shape opacity" aria-valuetext={selectedShapeStyle.mixedOpacity ? "Mixed" : `${Math.round(selectedShapeStyle.opacity * 100)}%`}
                  value={selectedShapeStyle.opacity} {...sliderGesture}
                  onChange={(event) => onShapeStyleChange({ opacity: Number(event.target.value) })} />
              </div>
              {selectedShapeStyle.fill && <FillOptions value={selectedShapeStyle.fill}
                onChange={(filled) => onShapeStyleChange({ filled })} />}
            </>
          )}
        </div>
      )}
    </>
  );
}
