import { useState } from "react";
import type {
  ActiveToolType,
  PageOrientation,
  PageSize,
  PageTemplate,
  ToolSettings,
} from "@ai-notes/shared";

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
];

const THICKNESS_PRESETS = [
  { label: "Fine", value: 2 },
  { label: "Medium", value: 4 },
  { label: "Broad", value: 8 },
];

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
  const [showOptionsPopup, setShowOptionsPopup] = useState(false);

  return (
    <header className="app-toolbar" data-testid="app-toolbar">
      {/* Brand & Status */}
      <div className="toolbar-section brand-section">
        <div className="app-brand">
          <span className="brand-icon">✏️</span>
          <span className="brand-title">Notes AI</span>
          <span className="phase-pill">Phase 2</span>
        </div>
        <div
          className={`status-badge status-${backendStatus}`}
          title={`Backend status: ${backendStatus}`}
          data-testid="backend-status"
        >
          <span className="status-dot" />
          <span className="status-text">{backendStatus}</span>
        </div>
      </div>

      <div className="toolbar-divider" />

      {/* History Controls (Undo / Redo) */}
      <div className="toolbar-section history-controls">
        <button
          type="button"
          className="btn-history"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          ↩️ Undo
        </button>
        <button
          type="button"
          className="btn-history"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
        >
          ↪️ Redo
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Primary Tool Switcher (Pen, Pencil, Highlighter, Erasers) */}
      <div className="toolbar-section tools-group">
        <button
          type="button"
          className={`tool-btn ${activeTool === "pen" ? "active" : ""}`}
          onClick={() => onSelectTool("pen")}
          title="Pen (Solid vector stroke)"
        >
          <span className="tool-icon">✒️</span>
          <span className="tool-label">Pen</span>
        </button>

        <button
          type="button"
          className={`tool-btn ${activeTool === "pencil" ? "active" : ""}`}
          onClick={() => onSelectTool("pencil")}
          title="Pencil (Graphite texture)"
        >
          <span className="tool-icon">✏️</span>
          <span className="tool-label">Pencil</span>
        </button>

        <button
          type="button"
          className={`tool-btn ${activeTool === "highlighter" ? "active" : ""}`}
          onClick={() => onSelectTool("highlighter")}
          title="Highlighter (Multiply blend)"
        >
          <span className="tool-icon">🖍️</span>
          <span className="tool-label">Highlighter</span>
        </button>

        <button
          type="button"
          className={`tool-btn ${isEraser ? "active" : ""}`}
          onClick={() =>
            onSelectTool(
              activeTool === "eraser-stroke" ? "eraser-partial" : "eraser-stroke"
            )
          }
          title={
            activeTool === "eraser-stroke"
              ? "Stroke Eraser (Deletes full stroke. Click to switch to Partial Eraser)"
              : "Partial Eraser (Splits stroke. Click to switch to Stroke Eraser)"
          }
        >
          <span className="tool-icon">🧽</span>
          <span className="tool-label">
            {activeTool === "eraser-stroke" ? "Stroke Eraser" : "Partial Eraser"}
          </span>
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Writing Tools Customization (Colors & Thickness) */}
      {!isEraser ? (
        <div className="toolbar-section tool-settings">
          {/* Preset Swatches */}
          <div className="color-picker" aria-label="Tool Colors">
            {PRESET_COLORS.map((p) => (
              <button
                key={p.color}
                type="button"
                className={`color-swatch ${
                  activeStyle.color.toLowerCase() === p.color.toLowerCase()
                    ? "active"
                    : ""
                }`}
                style={{ backgroundColor: p.color }}
                onClick={() => onUpdateStyle({ color: p.color })}
                title={p.name}
                aria-label={p.name}
              />
            ))}

            {/* Custom Color Input */}
            <label className="custom-color-picker" title="Custom Color Picker">
              <input
                type="color"
                value={activeStyle.color}
                onChange={(e) => onUpdateStyle({ color: e.target.value })}
              />
              <span
                className="custom-color-preview"
                style={{ backgroundColor: activeStyle.color }}
              >
                +
              </span>
            </label>
          </div>

          <div className="toolbar-divider mini" />

          {/* Thickness Presets & Custom Slider */}
          <div className="thickness-picker" aria-label="Stroke Thickness">
            {THICKNESS_PRESETS.map((t) => (
              <button
                key={t.value}
                type="button"
                className={`btn-toggle ${
                  activeStyle.thickness === t.value ? "active" : ""
                }`}
                onClick={() => onUpdateStyle({ thickness: t.value })}
              >
                {t.label}
              </button>
            ))}

            <button
              type="button"
              className="btn-toggle options-toggle"
              onClick={() => setShowOptionsPopup(!showOptionsPopup)}
              title="More settings (Custom Size & Opacity)"
            >
              ⚙️ {activeStyle.thickness}px
            </button>
          </div>

          {/* Options Popup for Sliders */}
          {showOptionsPopup && (
            <div className="tool-options-popup">
              <div className="popup-row">
                <label htmlFor="thickness-slider-popup">
                  Thickness: {activeStyle.thickness}px
                </label>
                <input
                  id="thickness-slider-popup"
                  type="range"
                  min={1}
                  max={activeTool === "highlighter" ? 60 : 24}
                  value={activeStyle.thickness}
                  onChange={(e) =>
                    onUpdateStyle({ thickness: Number(e.target.value) })
                  }
                />
              </div>

              <div className="popup-row">
                <label htmlFor="opacity-slider-popup">
                  Opacity: {Math.round(activeStyle.opacity * 100)}%
                </label>
                <input
                  id="opacity-slider-popup"
                  type="range"
                  min={0.1}
                  max={1.0}
                  step={0.05}
                  value={activeStyle.opacity}
                  onChange={(e) =>
                    onUpdateStyle({ opacity: Number(e.target.value) })
                  }
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Eraser Thickness Control */
        <div className="toolbar-section tool-settings">
          <label htmlFor="eraser-size-slider" className="eraser-label">
            Eraser Size: {activeStyle.thickness}px
          </label>
          <input
            id="eraser-size-slider"
            type="range"
            min={4}
            max={60}
            value={activeStyle.thickness}
            onChange={(e) =>
              onUpdateStyle({ thickness: Number(e.target.value) })
            }
          />
        </div>
      )}

      <div className="toolbar-divider" />

      {/* Page Setup */}
      <div className="toolbar-section page-settings">
        <select
          className="select-dropdown"
          value={template}
          onChange={(e) => onTemplateChange(e.target.value as PageTemplate)}
          aria-label="Paper Template"
        >
          <option value="plain">Plain Paper</option>
          <option value="lined">Lined Paper</option>
          <option value="graph">Graph Paper</option>
          <option value="notepad">Notepad</option>
        </select>

        <select
          className="select-dropdown"
          value={size}
          onChange={(e) => onSizeChange(e.target.value as PageSize)}
          aria-label="Page Size"
        >
          <option value="a4">A4</option>
          <option value="letter">Letter</option>
        </select>

        <button
          type="button"
          className="btn-icon"
          title={`Switch orientation (currently ${orientation})`}
          onClick={() =>
            onOrientationChange(
              orientation === "portrait" ? "landscape" : "portrait"
            )
          }
        >
          {orientation === "portrait" ? "📄 Portrait" : "📃 Landscape"}
        </button>
      </div>

      {/* Actions */}
      <div className="toolbar-section actions">
        <span className="stroke-counter">{strokeCount} strokes</span>
        <button
          type="button"
          className="btn-danger"
          onClick={onClearPage}
          disabled={strokeCount === 0}
          title="Clear all strokes from this page"
        >
          Clear
        </button>
      </div>
    </header>
  );
}
