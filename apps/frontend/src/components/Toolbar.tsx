import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import type {
  ActiveToolType,
  PageOrientation,
  PageSize,
  PageTemplate,
  ToolSettings,
} from "@ai-notes/shared";
import { Icon, type IconName } from "./Icon.js";

export interface ToolbarProps {
  activeTool: ActiveToolType;
  onSelectTool: (tool: ActiveToolType) => void;
  activeStyle: ToolSettings;
  onUpdateStyle: (style: Partial<ToolSettings>) => void;
  template: PageTemplate;
  onTemplateChange: (t: PageTemplate) => void;
  size: PageSize;
  onSizeChange: (s: PageSize) => void;
  orientation: PageOrientation;
  onOrientationChange: (o: PageOrientation) => void;
  strokeCount: number;
  onClearPage: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  backendStatus: "checking" | "online" | "offline";
}

const PRESET_COLORS = [
  { name: "Black", color: "#000000" },
  { name: "Blue", color: "#2563eb" },
  { name: "Red", color: "#dc2626" },
  { name: "Green", color: "#16a34a" },
  { name: "Amber", color: "#d97706" },
  { name: "Purple", color: "#9333ea" },
  { name: "Yellow", color: "#fef08a" },
  { name: "Graphite", color: "#475569" },
];

const WRITING_TOOLS: {
  tool: ActiveToolType;
  name: string;
  icon: IconName;
  description: string;
}[] = [
  { tool: "pen", name: "Pen", icon: "pen", description: "Solid vector stroke" },
  { tool: "pencil", name: "Pencil", icon: "pencil", description: "Graphite texture" },
  {
    tool: "highlighter",
    name: "Highlighter",
    icon: "highlighter",
    description: "Multiply blend",
  },
];

type EraserTool = "eraser-partial" | "eraser-stroke";

const ERASER_MODES: { tool: EraserTool; label: string }[] = [
  { tool: "eraser-partial", label: "Partial" },
  { tool: "eraser-stroke", label: "Whole stroke" },
];

const TEMPLATES: { value: PageTemplate; label: string }[] = [
  { value: "plain", label: "Plain" },
  { value: "lined", label: "Lined" },
  { value: "graph", label: "Grid" },
  { value: "notepad", label: "Notepad" },
];

type PanelKind = "color" | "tool" | "page" | "more";
const PANEL_TITLES: Record<PanelKind, string> = {
  color: "Ink color",
  tool: "Tool settings",
  page: "Page settings",
  more: "Notebook options",
};

export function Toolbar({
  activeTool,
  onSelectTool,
  activeStyle,
  onUpdateStyle,
  template,
  onTemplateChange,
  size,
  onSizeChange,
  orientation,
  onOrientationChange,
  strokeCount,
  onClearPage,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  backendStatus,
}: ToolbarProps) {
  const isEraser = activeTool === "eraser-partial" || activeTool === "eraser-stroke";
  const [panel, setPanel] = useState<{
    kind: PanelKind;
    left: number;
    top: number;
  } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const [eraserHintVisible, setEraserHintVisible] = useState(false);
  const [lastEraserMode, setLastEraserMode] = useState<EraserTool>("eraser-partial");
  const eraserHintTimerRef = useRef<number | undefined>(undefined);
  const eraserHoveredRef = useRef(false);
  const displayedEraserMode = isEraser ? activeTool : lastEraserMode;
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEraser) setLastEraserMode(activeTool);
  }, [activeTool, isEraser]);

  useEffect(() => () => window.clearTimeout(eraserHintTimerRef.current), []);

  // Hover/focus keeps the hint open; a click (including touch) shows it briefly.
  const showEraserHint = (autoHideMs?: number) => {
    window.clearTimeout(eraserHintTimerRef.current);
    setEraserHintVisible(true);
    if (autoHideMs !== undefined) {
      eraserHintTimerRef.current = window.setTimeout(() => {
        if (!eraserHoveredRef.current) setEraserHintVisible(false);
      }, autoHideMs);
    }
  };
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const closePanel = useCallback((restoreFocus = true) => {
    setPanel(null);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  const togglePanel = (kind: PanelKind, event: MouseEvent<HTMLButtonElement>) => {
    const trigger = event.currentTarget;
    triggerRef.current = trigger;
    setConfirmClear(false);
    const rect = trigger.getBoundingClientRect();
    setPanel((previous) =>
      previous?.kind === kind
        ? null
        : {
            kind,
            left: Math.max(12, Math.min(rect.right - 288, window.innerWidth - 300)),
            top: rect.bottom + 10,
          },
    );
  };

  useEffect(() => {
    if (!panel) return;
    panelRef.current?.querySelector<HTMLElement>("button, input")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closePanel();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !panelRef.current?.contains(event.target) &&
        !triggerRef.current?.contains(event.target)
      )
        closePanel(false);
    };
    const onResize = () => closePanel(false);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", onResize);
    };
  }, [panel, closePanel]);

  const selectColor = (color: string) => {
    const normalized = color.toLowerCase();
    setRecentColors((previous) =>
      [normalized, ...previous.filter((item) => item !== normalized)].slice(0, 15),
    );
    onUpdateStyle({ color: normalized });
  };

  return (
    <header className="editor-header" data-testid="app-toolbar">
      <div className="document-bar">
        <div className="document-identity">
          <span className="notebook-mark">
            <Icon name="notebook" />
          </span>
          <div>
            <span className="app-name">Notes AI</span>
            <h1>Untitled notebook</h1>
          </div>
        </div>
        <div className="document-actions">
          <span
            className="session-status"
            title="This page is not saved. Notes are kept only for the current session."
          >
            <span /> Session only
          </span>
          <button
            type="button"
            className="quiet-button page-settings-trigger"
            onClick={(event) => togglePanel("page", event)}
            aria-expanded={panel?.kind === "page"}
            aria-controls="editor-settings"
            aria-label="Page settings"
            title="Page settings"
          >
            <Icon name="page" />
            <span>Paper</span>
            <Icon name="chevron" className="small-icon" />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={(event) => togglePanel("more", event)}
            aria-expanded={panel?.kind === "more"}
            aria-controls="editor-settings"
            aria-label="Notebook options"
            title="Notebook options"
          >
            <Icon name="more" />
          </button>
        </div>
      </div>

      <div className="tools-bar">
        <div className="writing-toolbar" role="toolbar" aria-label="Writing tools">
          <div className="history-controls">
            <button
              type="button"
              className="icon-button"
              onClick={onUndo}
              disabled={!canUndo}
              aria-label="Undo"
              title="Undo (Ctrl+Z)"
            >
              <Icon name="undo" />
            </button>
            <button
              type="button"
              className="icon-button"
              onClick={onRedo}
              disabled={!canRedo}
              aria-label="Redo"
              title="Redo (Ctrl+Y)"
            >
              <Icon name="redo" />
            </button>
          </div>
          <span className="toolbar-divider" />
          <div className="tools-group">
            {WRITING_TOOLS.map(({ tool, name, icon, description }) => (
              <button
                key={tool}
                type="button"
                className={`tool-btn ${activeTool === tool ? "active" : ""}`}
                onClick={() => onSelectTool(tool)}
                aria-label={name}
                aria-pressed={activeTool === tool}
                title={`${name} (${description})`}
              >
                <Icon name={icon} />
                <span className="tool-label">{name}</span>
              </button>
            ))}
            <div
              className="eraser-tool"
              onMouseEnter={() => {
                eraserHoveredRef.current = true;
                showEraserHint();
              }}
              onMouseLeave={() => {
                eraserHoveredRef.current = false;
                setEraserHintVisible(false);
              }}
              onFocus={(event) => {
                if (event.target.matches(":focus-visible")) showEraserHint();
              }}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setEraserHintVisible(false);
                }
              }}
            >
            <button
              type="button"
              className={`tool-btn ${isEraser ? "active" : ""}`}
              onClick={() => {
                onSelectTool(
                  activeTool === "eraser-partial" ? "eraser-stroke" : "eraser-partial",
                );
                showEraserHint(1600);
              }}
              aria-label={
                activeTool === "eraser-stroke" ? "Stroke eraser" : "Partial eraser"
              }
              aria-pressed={isEraser}
              title={
                activeTool === "eraser-stroke"
                  ? "Stroke eraser (click for partial)"
                  : "Partial eraser (click again for whole strokes)"
              }
            >
              <Icon name="eraser" />
              <span className="tool-label">Eraser</span>
            </button>
            {eraserHintVisible && (
              <div className="eraser-mode-hint" role="group" aria-label="Eraser mode">
                {ERASER_MODES.map(({ tool, label }) => (
                  <button
                    key={tool}
                    type="button"
                    aria-pressed={displayedEraserMode === tool}
                    onClick={() => {
                      onSelectTool(tool);
                      showEraserHint(1600);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            </div>
          </div>
          <span className="toolbar-divider" />
          {!isEraser && (
            <div className="ink-controls">
              <div className="quick-colors" aria-label="Quick colors">
                {PRESET_COLORS.slice(0, 4).map(({ name, color }) => (
                  <button
                    key={color}
                    type="button"
                    className={`color-swatch ${activeStyle.color.toLowerCase() === color ? "active" : ""}`}
                    style={{ backgroundColor: color }}
                    onClick={() => selectColor(color)}
                    aria-label={name}
                    aria-pressed={activeStyle.color.toLowerCase() === color}
                    title={name}
                  />
                ))}
              </div>
              <button
                type="button"
                className="color-menu-button"
                onClick={(event) => togglePanel("color", event)}
                aria-label="Ink color"
                aria-expanded={panel?.kind === "color"}
                aria-controls="editor-settings"
                title="Ink color"
              >
                <span
                  className="ink-preview"
                  style={{ backgroundColor: activeStyle.color }}
                />
                <Icon name="chevron" className="small-icon" />
              </button>
            </div>
          )}
          <button
            type="button"
            className="quiet-button tool-settings-trigger"
            onClick={(event) => togglePanel("tool", event)}
            aria-label="Tool settings"
            aria-expanded={panel?.kind === "tool"}
            aria-controls="editor-settings"
            title="Thickness and opacity"
          >
            <Icon name="settings" />
            <span>
              {activeStyle.thickness} <span className="unit">px</span>
            </span>
          </button>
        </div>
      </div>

      {panel && (
        <div
          ref={panelRef}
          id="editor-settings"
          className="settings-panel"
          role="dialog"
          aria-labelledby="settings-panel-title"
          style={{
            left: panel.left,
            top: panel.top,
            maxHeight: `calc(100dvh - ${panel.top + 12}px)`,
          }}
        >
          <div className="panel-heading">
            <h2 id="settings-panel-title">{PANEL_TITLES[panel.kind]}</h2>
            <button
              type="button"
              className="icon-button small-button"
              aria-label="Close settings"
              onClick={() => closePanel()}
            >
              <Icon name="close" />
            </button>
          </div>
          {panel.kind === "color" && (
            <>
              <div className="palette-colors" aria-label="Common colors">
                {PRESET_COLORS.map(({ name, color }) => (
                  <button
                    key={color}
                    type="button"
                    className={`color-swatch ${activeStyle.color.toLowerCase() === color ? "active" : ""}`}
                    style={{ backgroundColor: color }}
                    onClick={() => selectColor(color)}
                    aria-label={name}
                    aria-pressed={activeStyle.color.toLowerCase() === color}
                  >
                    {activeStyle.color.toLowerCase() === color && <Icon name="check" />}
                  </button>
                ))}
              </div>
              <label className="custom-color-row">
                Custom color
                <input
                  type="color"
                  value={activeStyle.color}
                  aria-label="Custom color"
                  onChange={(event) => selectColor(event.target.value)}
                />
              </label>
              {recentColors.length > 0 && (
                <div className="recent-color-section">
                  <h3>Recent colors</h3>
                  <div className="recent-colors" aria-label="Recent colors">
                    {recentColors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`color-swatch ${activeStyle.color.toLowerCase() === color ? "active" : ""}`}
                        style={{ backgroundColor: color }}
                        onClick={() => selectColor(color)}
                        aria-label={`Recent color ${color}`}
                        aria-pressed={activeStyle.color.toLowerCase() === color}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          {panel.kind === "tool" && (
            <>
              {isEraser && (
                <fieldset className="settings-field">
                  <legend>Eraser mode</legend>
                  <div className="segmented-control">
                    <button
                      type="button"
                      aria-pressed={activeTool === "eraser-partial"}
                      onClick={() => onSelectTool("eraser-partial")}
                    >
                      Partial
                    </button>
                    <button
                      type="button"
                      aria-pressed={activeTool === "eraser-stroke"}
                      onClick={() => onSelectTool("eraser-stroke")}
                    >
                      Whole stroke
                    </button>
                  </div>
                </fieldset>
              )}
              <div className="slider-field">
                <label htmlFor="thickness-slider-popup">
                  {isEraser ? "Eraser size" : "Thickness"}{" "}
                  <span>{activeStyle.thickness} px</span>
                </label>
                <input
                  id="thickness-slider-popup"
                  type="range"
                  min={isEraser ? 4 : 1}
                  max={isEraser || activeTool === "highlighter" ? 60 : 24}
                  value={activeStyle.thickness}
                  onChange={(event) =>
                    onUpdateStyle({ thickness: Number(event.target.value) })
                  }
                />
              </div>
              {!isEraser && (
                <>
                  <div className="slider-field">
                    <label htmlFor="opacity-slider-popup">
                      Opacity <span>{Math.round(activeStyle.opacity * 100)}%</span>
                    </label>
                    <input
                      id="opacity-slider-popup"
                      type="range"
                      min={0.1}
                      max={1}
                      step={0.05}
                      value={activeStyle.opacity}
                      onChange={(event) =>
                        onUpdateStyle({ opacity: Number(event.target.value) })
                      }
                    />
                  </div>
                  <svg className="stroke-preview" viewBox="0 0 240 48" aria-hidden="true">
                    <path
                      d="M12 32C50 5 65 42 100 25S150 8 180 23 210 32 228 16"
                      fill="none"
                      stroke={activeStyle.color}
                      strokeWidth={activeStyle.thickness}
                      opacity={activeStyle.opacity}
                      strokeLinecap="round"
                    />
                  </svg>
                </>
              )}
            </>
          )}
          {panel.kind === "page" && (
            <>
              <fieldset className="settings-field">
                <legend>Paper template</legend>
                <div className="template-options">
                  {TEMPLATES.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={template === value}
                      onClick={() => onTemplateChange(value)}
                    >
                      <span className={`template-preview template-${value}`} />
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset className="settings-field">
                <legend>Page size</legend>
                <div className="segmented-control">
                  <button
                    type="button"
                    aria-pressed={size === "a4"}
                    onClick={() => onSizeChange("a4")}
                  >
                    A4
                  </button>
                  <button
                    type="button"
                    aria-pressed={size === "letter"}
                    onClick={() => onSizeChange("letter")}
                  >
                    Letter
                  </button>
                </div>
              </fieldset>
              <fieldset className="settings-field">
                <legend>Orientation</legend>
                <div className="segmented-control">
                  <button
                    type="button"
                    aria-pressed={orientation === "portrait"}
                    onClick={() => onOrientationChange("portrait")}
                  >
                    Portrait
                  </button>
                  <button
                    type="button"
                    aria-pressed={orientation === "landscape"}
                    onClick={() => onOrientationChange("landscape")}
                  >
                    Landscape
                  </button>
                </div>
              </fieldset>
            </>
          )}
          {panel.kind === "more" && (
            <>
              <p className="session-notice">
                This is a temporary workspace. Notes are kept for this session only;
                saving is not connected yet.
              </p>
              <div className="notebook-details">
                <span>
                  {strokeCount} {strokeCount === 1 ? "stroke" : "strokes"} on this page
                </span>
                <span data-testid="backend-status">API {backendStatus}</span>
              </div>
              {confirmClear ? (
                <div className="clear-confirmation">
                  <h3>Clear this page?</h3>
                  <p>All strokes will be removed.</p>
                  <div className="confirmation-actions">
                    <button
                      type="button"
                      className="quiet-button"
                      onClick={() => setConfirmClear(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => {
                        onClearPage();
                        closePanel();
                      }}
                    >
                      Clear page
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="clear-page-button"
                  disabled={strokeCount === 0}
                  onClick={() => setConfirmClear(true)}
                >
                  <Icon name="trash" /> Clear page
                </button>
              )}
            </>
          )}
        </div>
      )}
    </header>
  );
}
