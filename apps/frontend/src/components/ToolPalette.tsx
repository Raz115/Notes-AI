import { useCallback, useState } from "react";
import type { ActiveToolType, ToolSettings } from "@ai-notes/shared";

export interface ToolPaletteProps {
  activeTool: ActiveToolType;
  onSelectTool: (tool: ActiveToolType) => void;
  settings: ToolSettings;
  onUpdateSettings: (settings: Partial<ToolSettings>) => void;
}

const PRESET_COLORS = [
  "#000000", // Black
  "#1E293B", // Slate
  "#2563EB", // Royal Blue
  "#0284C7", // Sky Blue
  "#0D9488", // Teal
  "#16A34A", // Emerald
  "#D97706", // Amber
  "#DC2626", // Crimson
  "#E11D48", // Rose
  "#9333EA", // Violet
];

export function ToolPalette({
  activeTool,
  onSelectTool,
  settings,
  onUpdateSettings,
}: ToolPaletteProps) {
  const [recentColors, setRecentColors] = useState<string[]>([
    "#000000",
    "#2563EB",
    "#DC2626",
    "#16A34A",
  ]);

  const addRecentColor = useCallback((color: string) => {
    setRecentColors((prev) => {
      const filtered = prev.filter((c) => c.toLowerCase() !== color.toLowerCase());
      return [color, ...filtered].slice(0, 15);
    });
  }, []);

  const handleColorChange = (color: string) => {
    onUpdateSettings({ color });
    addRecentColor(color);
  };

  const isEraser = activeTool === "eraser-partial" || activeTool === "eraser-stroke";

  const getThicknessBounds = () => {
    if (activeTool === "highlighter") return { min: 8, max: 60 };
    if (isEraser) return { min: 4, max: 60 };
    if (activeTool === "pencil") return { min: 1, max: 16 };
    return { min: 1, max: 24 }; // pen
  };

  const bounds = getThicknessBounds();

  return (
    <aside className="tool-palette" aria-label="Tool options palette">
      {/* Primary Tool Switcher */}
      <div className="tool-selector-group">
        <button
          type="button"
          className={`tool-btn ${activeTool === "pen" ? "active" : ""}`}
          onClick={() => onSelectTool("pen")}
          title="Pen (Vector stroke)"
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
          <span className="tool-label">Highlight</span>
        </button>

        <div className="eraser-dropdown-wrapper">
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
                ? "Stroke Eraser (Click to switch to Partial)"
                : "Partial Eraser (Click to switch to Stroke)"
            }
          >
            <span className="tool-icon">🧽</span>
            <span className="tool-label">
              {activeTool === "eraser-stroke" ? "Stroke Eraser" : "Partial Eraser"}
            </span>
          </button>
        </div>
      </div>

      <div className="palette-divider" />

      {/* Color Picker Section (hidden for erasers) */}
      {!isEraser && (
        <div className="color-section">
          <div className="section-label">Color</div>
          <div className="color-swatch-grid">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={`color-swatch ${
                  settings.color.toLowerCase() === color.toLowerCase()
                    ? "selected"
                    : ""
                }`}
                style={{ backgroundColor: color }}
                onClick={() => handleColorChange(color)}
                title={color}
              />
            ))}

            <label className="custom-color-picker" title="Custom color">
              <input
                type="color"
                value={settings.color}
                onChange={(e) => handleColorChange(e.target.value)}
              />
              <span
                className="custom-color-preview"
                style={{ backgroundColor: settings.color }}
              >
                +
              </span>
            </label>
          </div>

          {recentColors.length > 0 && (
            <div className="recent-colors-bar">
              <span className="sub-label">Recents:</span>
              {recentColors.map((color) => (
                <button
                  key={`recent-${color}`}
                  type="button"
                  className={`color-swatch mini ${
                    settings.color.toLowerCase() === color.toLowerCase()
                      ? "selected"
                      : ""
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => handleColorChange(color)}
                  title={color}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {!isEraser && <div className="palette-divider" />}

      {/* Thickness & Opacity Sliders */}
      <div className="sliders-section">
        <div className="slider-row">
          <label htmlFor="thickness-slider" className="section-label">
            Size ({settings.thickness}px)
          </label>
          <div className="slider-input-wrapper">
            <input
              id="thickness-slider"
              type="range"
              min={bounds.min}
              max={bounds.max}
              value={settings.thickness}
              onChange={(e) =>
                onUpdateSettings({ thickness: Number(e.target.value) })
              }
            />
            <div
              className="size-preview-dot"
              style={{
                width: `${Math.min(24, Math.max(4, settings.thickness))}px`,
                height: `${Math.min(24, Math.max(4, settings.thickness))}px`,
                backgroundColor: isEraser ? "#64748b" : settings.color,
              }}
            />
          </div>
        </div>

        {!isEraser && (
          <div className="slider-row">
            <label htmlFor="opacity-slider" className="section-label">
              Opacity ({Math.round(settings.opacity * 100)}%)
            </label>
            <input
              id="opacity-slider"
              type="range"
              min={0.1}
              max={1.0}
              step={0.05}
              value={settings.opacity}
              onChange={(e) =>
                onUpdateSettings({ opacity: Number(e.target.value) })
              }
            />
          </div>
        )}
      </div>
    </aside>
  );
}
