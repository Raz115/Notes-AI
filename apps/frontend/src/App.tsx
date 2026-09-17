import { useCallback, useEffect, useRef, useState } from "react";
import {
  eraseStrokeObject,
  isStrokeIntersected,
  type ActiveToolType,
  type Page,
  type PageOrientation,
  type PageSize,
  type PageTemplate,
  type Point,
  type StrokeObject,
  type ToolSettings,
  type ToolSettingsMap,
} from "@ai-notes/shared";
import { CanvasViewport } from "./canvas/CanvasViewport.js";
import { Toolbar } from "./components/Toolbar.js";
import { ToolPalette } from "./components/ToolPalette.js";
import { ZoomWidget } from "./components/ZoomWidget.js";
import { useHistory } from "./hooks/useHistory.js";

type BackendStatus = "checking" | "online" | "offline";

const DEFAULT_TOOL_SETTINGS: ToolSettingsMap = {
  pen: { color: "#1e293b", thickness: 4, opacity: 1.0 },
  pencil: { color: "#475569", thickness: 3, opacity: 0.65 },
  highlighter: { color: "#fef08a", thickness: 24, opacity: 0.5 },
  "eraser-partial": { color: "#ffffff", thickness: 20, opacity: 1.0 },
  "eraser-stroke": { color: "#ffffff", thickness: 20, opacity: 1.0 },
};

export function App() {
  const [backendStatus, setBackendStatus] = useState<BackendStatus>("checking");

  // Health check polling on startup
  useEffect(() => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:8787";
    let cancelled = false;

    fetch(`${backendUrl}/health`)
      .then((res) => {
        if (!cancelled) setBackendStatus(res.ok ? "online" : "offline");
      })
      .catch(() => {
        if (!cancelled) setBackendStatus("offline");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Page state
  const [page, setPage] = useState<Page>({
    id: "demo-page-1",
    notebookId: "demo-notebook",
    order: 0,
    size: "a4",
    orientation: "portrait",
    template: "lined",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // History stack for strokes
  const { strokes, setStrokes, undo, redo, canUndo, canRedo } = useHistory([]);

  // Active Tool & Settings
  const [activeTool, setActiveTool] = useState<ActiveToolType>("pen");
  const [toolSettings, setToolSettings] = useState<ToolSettingsMap>(
    DEFAULT_TOOL_SETTINGS
  );

  const activeStyle: ToolSettings = toolSettings[activeTool];

  const handleUpdateActiveSettings = useCallback(
    (updated: Partial<ToolSettings>) => {
      setToolSettings((prev) => ({
        ...prev,
        [activeTool]: {
          ...prev[activeTool],
          ...updated,
        },
      }));
    },
    [activeTool]
  );

  // Viewport zoom state for the zoom widget
  const [currentZoom, setCurrentZoom] = useState(1.0);
  const viewportControlsRef = useRef<{
    zoomIn: () => void;
    zoomOut: () => void;
    resetZoom: () => void;
    fitPage: () => void;
  } | null>(null);

  const handleStrokeComplete = useCallback(
    (newStroke: StrokeObject) => {
      setStrokes((prev) => [...prev, newStroke]);
    },
    [setStrokes]
  );

  const handleEraseAtPoint = useCallback(
    (eraserPoint: Point, radius: number, isStrokeEraser: boolean) => {
      setStrokes((prevStrokes) => {
        if (isStrokeEraser) {
          return prevStrokes.filter(
            (stroke) => !isStrokeIntersected(stroke, eraserPoint, radius)
          );
        }

        // Partial eraser: trim / split affected strokes
        let hasChanges = false;
        const result: StrokeObject[] = [];

        for (const stroke of prevStrokes) {
          const remaining = eraseStrokeObject(stroke, eraserPoint, radius);
          if (
            remaining.length !== 1 ||
            remaining[0] !== stroke
          ) {
            hasChanges = true;
          }
          result.push(...remaining);
        }

        return hasChanges ? result : prevStrokes;
      });
    },
    [setStrokes]
  );

  const handleClearPage = useCallback(() => {
    setStrokes([]);
  }, [setStrokes]);

  const handleTemplateChange = useCallback((template: PageTemplate) => {
    setPage((prev) => ({ ...prev, template }));
  }, []);

  const handleSizeChange = useCallback((size: PageSize) => {
    setPage((prev) => ({ ...prev, size }));
  }, []);

  const handleOrientationChange = useCallback((orientation: PageOrientation) => {
    setPage((prev) => ({ ...prev, orientation }));
  }, []);

  return (
    <div className="app-container">
      <Toolbar
        template={page.template}
        onTemplateChange={handleTemplateChange}
        size={page.size}
        onSizeChange={handleSizeChange}
        orientation={page.orientation}
        onOrientationChange={handleOrientationChange}
        strokeCount={strokes.length}
        onClearPage={handleClearPage}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        backendStatus={backendStatus}
      />

      <main className="canvas-main">
        <ToolPalette
          activeTool={activeTool}
          onSelectTool={setActiveTool}
          settings={activeStyle}
          onUpdateSettings={handleUpdateActiveSettings}
        />

        <CanvasViewport
          page={page}
          strokes={strokes}
          onStrokeComplete={handleStrokeComplete}
          onEraseAtPoint={handleEraseAtPoint}
          activeStyle={activeStyle}
          activeTool={activeTool}
          onViewportChange={setCurrentZoom}
          viewportControlsRef={viewportControlsRef}
        />

        {/* Floating zoom widget — bottom-right, visible on hover */}
        <ZoomWidget
          zoom={currentZoom}
          onZoomIn={() => viewportControlsRef.current?.zoomIn()}
          onZoomOut={() => viewportControlsRef.current?.zoomOut()}
          onResetZoom={() => viewportControlsRef.current?.resetZoom()}
          onFitPage={() => viewportControlsRef.current?.fitPage()}
        />
      </main>
    </div>
  );
}

export default App;
