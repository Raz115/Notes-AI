import type { PageOrientation, PageSize, PageTemplate } from "@ai-notes/shared";

export interface ToolbarProps {
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

export function Toolbar({
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
  return (
    <header className="app-toolbar" data-testid="app-toolbar">
      {/* Brand & Status */}
      <div className="toolbar-section">
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

      {/* History Actions (Undo / Redo) */}
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
