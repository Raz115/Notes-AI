import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  eraseStrokeObject,
  isStrokeObject,
  isStrokeIntersected,
  type ActiveToolType,
  type CanvasObject,
  type Folder,
  type Notebook,
  type Page,
  type PageOrientation,
  type PageSize,
  type PageTemplate,
  type Point,
  type StrokeObject,
  type TextboxObject,
  type ToolSettings,
  type ToolSettingsMap,
} from "@ai-notes/shared";
import { CanvasViewport } from "./canvas/CanvasViewport.js";
import { Toolbar } from "./components/Toolbar.js";
import { ZoomWidget } from "./components/ZoomWidget.js";
import { Icon } from "./components/Icon.js";
import { useHistory } from "./hooks/useHistory.js";
import { ObjectToolbar, type ObjectTool, type SelectedShapeStyle, type ShapeKind } from "./components/ObjectToolbar.js";
import {
  hasShapeFill, isFillableShape, isShapeObject, selectionBounds, transformObjects, updateShapeStyle,
  type ShapeStyleChange,
} from "./canvas/objectGeometry.js";
import { recognizeShape } from "./canvas/recognizeShape.js";
import { canMoveFolder, Dashboard, type NotebookOptions } from "./components/Dashboard.js";

type BackendStatus = "checking" | "online" | "offline";

const DEFAULT_TOOL_SETTINGS: ToolSettingsMap = {
  pen: { color: "#000000", thickness: 4, opacity: 1.0 },
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
  const [notebooks, setNotebooks] = useState<Notebook[]>([{
    id: "demo-notebook", ownerId: "local", name: "Untitled notebook", folderId: null,
    pinned: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  }]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeNotebookId, setActiveNotebookId] = useState("demo-notebook");
  const [showDashboard, setShowDashboard] = useState(true);
  const [dashboardFolderId, setDashboardFolderId] = useState<string | null>(null);
  const [notebookDefaults, setNotebookDefaults] = useState<Pick<NotebookOptions, "size" | "orientation" | "template">>({
    size: "a4", orientation: "portrait", template: "lined",
  });
  const [pages, setPages] = useState<Page[]>([{
    id: "demo-page-1",
    notebookId: "demo-notebook",
    order: 0,
    size: "a4",
    orientation: "portrait",
    template: "lined",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }]);
  const [activePageId, setActivePageId] = useState("demo-page-1");
  const notebookPages = pages.filter((item) => item.notebookId === activeNotebookId)
    .sort((a, b) => a.order - b.order);
  const page = notebookPages.find((item) => item.id === activePageId) ?? notebookPages[0] ?? pages[0] ?? {
    id: "", notebookId: "", order: 0, size: "a4" as const, orientation: "portrait" as const,
    template: "lined" as const, createdAt: "", updatedAt: "",
  };
  const [confirmDeletePage, setConfirmDeletePage] = useState(false);
  const notebookPageIds = useMemo(() =>
    new Set(pages.filter((item) => item.notebookId === activeNotebookId).map((item) => item.id)),
  [pages, activeNotebookId]);
  const belongsToNotebook = useCallback((object: CanvasObject) => notebookPageIds.has(object.pageId),
    [notebookPageIds]);

  // History stack for strokes
  const {
    strokes: objects,
    setStrokes,
    beginTransaction,
    commitTransaction,
    discardWhere,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useHistory<CanvasObject>([], activeNotebookId, belongsToNotebook);

  const [objectTool, setObjectTool] = useState<ObjectTool | null>(null);
  const [shapeKind, setShapeKind] = useState<ShapeKind>("rectangle");
  const [shapeFilled, setShapeFilled] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [objectMessage, setObjectMessage] = useState("");
  const [clipboard, setClipboard] = useState<CanvasObject[]>([]);
  const selectedObjects = objects.filter((object) => selectedIds.includes(object.id));
  const strokes = objects.filter(isStrokeObject);

  // Active Tool & Settings
  const [activeTool, setActiveTool] = useState<ActiveToolType>("pen");
  const [lastInkTool, setLastInkTool] = useState<"pen" | "pencil" | "highlighter">("pen");
  const [toolSettings, setToolSettings] =
    useState<ToolSettingsMap>(DEFAULT_TOOL_SETTINGS);

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
    [activeTool],
  );

  // Viewport zoom state for the zoom widget
  const [currentZoom, setCurrentZoom] = useState(1.0);
  const viewportControlsRef = useRef<{
    zoomIn: () => void;
    zoomOut: () => void;
    resetZoom: () => void;
    fitPage: () => void;
    goToPage?: (pageId: string) => void;
  } | null>(null);
  const pendingPageNavigation = useRef<string | null>(null);

  useEffect(() => {
    if (pendingPageNavigation.current) {
      viewportControlsRef.current?.goToPage?.(pendingPageNavigation.current);
      pendingPageNavigation.current = null;
    }
  }, [pages]);

  const handleStrokeComplete = useCallback(
    (newStroke: StrokeObject) => {
      setStrokes((prev) => [...prev, newStroke], true);
    },
    [setStrokes],
  );

  const handleEraseAtPoint = useCallback(
    (
      pageId: string,
      eraserPoint: Point,
      radius: number,
      isStrokeEraser: boolean,
      eraserEnd: Point = eraserPoint,
    ) => {
      // Live erase update (without recording individual micro-steps to undo history)
      setStrokes((prevStrokes) => {
        if (isStrokeEraser) {
          const remaining = prevStrokes.filter(
            (stroke) => stroke.pageId !== pageId || !isStrokeObject(stroke) ||
              !isStrokeIntersected(stroke, eraserPoint, radius, eraserEnd),
          );
          return remaining.length === prevStrokes.length ? prevStrokes : remaining;
        }

        let hasChanges = false;
        const result: CanvasObject[] = [];

        for (const stroke of prevStrokes) {
          if (stroke.pageId !== pageId || !isStrokeObject(stroke)) {
            result.push(stroke);
            continue;
          }
          const remaining = eraseStrokeObject(stroke, eraserPoint, radius, eraserEnd);
          if (remaining.length !== 1 || remaining[0] !== stroke) {
            hasChanges = true;
          }
          result.push(...remaining);
        }

        return hasChanges ? result : prevStrokes;
      }, false);
    },
    [setStrokes],
  );

  const handleClearPage = useCallback(() => {
    setStrokes((previous) => previous.filter((object) => object.pageId !== page.id), true);
    setSelectedIds([]);
  }, [setStrokes, page.id]);

  const deleteSelection = useCallback(() => {
    if (!selectedIds.length) return;
    setStrokes((previous) => previous.filter((object) => !selectedIds.includes(object.id)));
    setSelectedIds([]);
  }, [selectedIds, setStrokes]);

  const copySelection = useCallback(() => {
    if (selectedObjects.length) setClipboard(selectedObjects);
  }, [selectedObjects]);

  const pasteSelection = useCallback(() => {
    const bounds = selectionBounds(clipboard);
    if (!bounds) return;
    const copies = transformObjects(clipboard, bounds, { ...bounds, x: bounds.x + 20, y: bounds.y + 20 })
      .map((object) => ({ ...object, id: crypto.randomUUID(), pageId: page.id, createdAt: new Date().toISOString() }));
    setStrokes((previous) => [...previous, ...copies]);
    setClipboard(copies);
    setSelectedIds(copies.map((object) => object.id));
    setObjectTool("lasso");
  }, [clipboard, setStrokes, page.id]);

  const selectedText = selectedObjects.length === 1 && selectedObjects[0]?.type === "textbox"
    ? selectedObjects[0] : null;
  const selectedShapes = selectedObjects.filter(isShapeObject);
  const firstShape = selectedShapes[0];
  const fillableShapes = selectedShapes.filter(isFillableShape);
  const firstFillableShape = fillableShapes[0];
  const firstFilled = firstFillableShape ? hasShapeFill(firstFillableShape) : false;
  const selectedShapeStyle: SelectedShapeStyle | null = firstShape ? {
    strokeWidth: firstShape.style.strokeWidth,
    opacity: firstShape.style.opacity ?? 1,
    mixedWidth: selectedShapes.some((shape) => shape.style.strokeWidth !== firstShape.style.strokeWidth),
    mixedOpacity: selectedShapes.some((shape) => (shape.style.opacity ?? 1) !== (firstShape.style.opacity ?? 1)),
    fill: !firstFillableShape ? null :
      fillableShapes.some((shape) => hasShapeFill(shape) !== firstFilled) ? "mixed" : firstFilled ? "solid" : "hollow",
  } : null;
  const firstSelected = selectedObjects[0];
  const selectionColor = !firstSelected ? "#000000" :
    isStrokeObject(firstSelected) ? firstSelected.style.color :
    firstSelected.type === "textbox" ? firstSelected.color :
    isShapeObject(firstSelected) ? firstSelected.style.strokeColor : "#000000";
  const formatShapes = (changes: ShapeStyleChange) => {
    const ids = new Set(selectedIds);
    setStrokes((previous) => {
      let changed = false;
      const next = previous.map((object) => {
        if (!ids.has(object.id) || !isShapeObject(object)) return object;
        const updated = updateShapeStyle(object, changes);
        if (updated !== object) changed = true;
        return updated;
      });
      return changed ? next : previous;
    });
  };
  const formatText = (changes: Partial<Pick<TextboxObject, "font" | "fontSize" | "bold" | "color">>) => {
    if (!selectedText) return;
    setStrokes((previous) => previous.map((object) =>
      object.id === selectedText.id && object.type === "textbox"
        ? { ...object, ...changes, updatedAt: new Date().toISOString() } : object));
  };
  const cleanShape = () => {
    const selected = selectedObjects[0];
    if (selectedObjects.length !== 1 || !selected || !isStrokeObject(selected)) return;
    const cleaned = recognizeShape(selected);
    if (!cleaned) {
      setObjectMessage("Couldn't recognize a line, rectangle or ellipse in that stroke.");
      return;
    }
    setObjectMessage("");
    setStrokes((previous) => previous.map((object) => object.id === selected.id ? cleaned : object));
  };
  const recolorSelection = (color: string) => {
    setStrokes((previous) => previous.map((object) => {
      if (!selectedIds.includes(object.id)) return object;
      const updatedAt = new Date().toISOString();
      if (isStrokeObject(object)) return { ...object, style: { ...object.style, color }, updatedAt };
      if (object.type === "textbox") return { ...object, color, updatedAt };
      if (isShapeObject(object)) {
        const fillColor = isFillableShape(object) && hasShapeFill(object) ? color : object.style.fillColor;
        return { ...object, style: { ...object.style, strokeColor: color, fillColor }, updatedAt };
      }
      return object;
    }));
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (objectTool !== "lasso") return;
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && event.key.toLowerCase() === "c" && selectedObjects.length) {
        event.preventDefault();
        copySelection();
      } else if (modifier && event.key.toLowerCase() === "v" && clipboard.length) {
        event.preventDefault();
        pasteSelection();
      } else if ((event.key === "Delete" || event.key === "Backspace") && selectedObjects.length) {
        event.preventDefault();
        deleteSelection();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [objectTool, selectedObjects, clipboard, copySelection, pasteSelection, deleteSelection]);

  const handleTemplateChange = useCallback((template: PageTemplate) => {
    setPages((prev) => prev.map((item) => item.id === page.id ? { ...item, template } : item));
  }, [page.id]);

  const handleSizeChange = useCallback((size: PageSize) => {
    setPages((prev) => prev.map((item) => item.id === page.id ? { ...item, size } : item));
  }, [page.id]);

  const handleOrientationChange = useCallback((orientation: PageOrientation) => {
    setPages((prev) => prev.map((item) => item.id === page.id ? { ...item, orientation } : item));
  }, [page.id]);

  const activatePage = (id: string) => {
    if (id !== activePageId) {
      setActivePageId(id);
      setSelectedIds([]);
      setConfirmDeletePage(false);
    }
  };
  const addPage = (source: Page = page) => {
    const now = new Date().toISOString();
    const newPage: Page = { ...source, id: crypto.randomUUID(), order: notebookPages.length,
      createdAt: now, updatedAt: now };
    pendingPageNavigation.current = newPage.id;
    setPages((previous) => [...previous, newPage]);
    activatePage(newPage.id);
  };
  const movePage = (direction: -1 | 1) => {
    const index = notebookPages.findIndex((item) => item.id === page.id);
    const other = index + direction;
    if (other < 0 || other >= notebookPages.length) return;
    const next = [...notebookPages];
    [next[index], next[other]] = [next[other]!, next[index]!];
    pendingPageNavigation.current = page.id;
    const ordered = next.map((item, order) => ({ ...item, order }));
    setPages((previous) => previous.map((item) => ordered.find((updated) => updated.id === item.id) ?? item));
  };
  const deletePage = () => {
    if (notebookPages.length <= 1) return;
    const remaining = notebookPages.filter((item) => item.id !== page.id);
    discardWhere((object) => object.pageId === page.id);
    setStrokes((previous) => previous.filter((object) => object.pageId !== page.id), false);
    const ordered = remaining.map((item, order) => ({ ...item, order }));
    setPages((previous) => previous.filter((item) => item.id !== page.id)
      .map((item) => ordered.find((updated) => updated.id === item.id) ?? item));
    activatePage(remaining[Math.max(0, page.order - 1)]!.id);
  };

  const openNotebook = (id: string) => {
    const first = pages.filter((item) => item.notebookId === id).sort((a, b) => a.order - b.order)[0];
    if (!first) return;
    setActiveNotebookId(id);
    setActivePageId(first.id);
    setSelectedIds([]);
    setObjectTool(null);
    setShowDashboard(false);
  };

  const createNotebook = (options: NotebookOptions) => {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const first: Page = { id: crypto.randomUUID(), notebookId: id, order: 0,
      size: options.size, orientation: options.orientation, template: options.template,
      createdAt: now, updatedAt: now };
    setNotebooks((previous) => [...previous, { id, ownerId: "local", name: options.name,
      folderId: options.folderId, pinned: false, createdAt: now, updatedAt: now }]);
    setPages((previous) => [...previous, first]);
    setActiveNotebookId(id);
    setActivePageId(first.id);
    setSelectedIds([]);
    setObjectTool(null);
    setShowDashboard(false);
  };

  const deleteNotebooks = (ids: string[]) => {
    const pageIds = new Set(pages.filter((item) => ids.includes(item.notebookId)).map((item) => item.id));
    discardWhere((object) => pageIds.has(object.pageId));
    setStrokes((previous) => previous.filter((object) => !pageIds.has(object.pageId)), false);
    setClipboard((previous) => previous.filter((object) => !pageIds.has(object.pageId)));
    setSelectedIds((previous) => previous.filter((id) =>
      objects.some((object) => object.id === id && !pageIds.has(object.pageId))));
    setPages((previous) => previous.filter((item) => !ids.includes(item.notebookId)));
    setNotebooks((previous) => previous.filter((item) => !ids.includes(item.id)));
  };

  const duplicateNotebook = (id: string) => {
    const original = notebooks.find((item) => item.id === id);
    if (!original) return;
    const now = new Date().toISOString();
    const newId = crypto.randomUUID();
    const pageMap = new Map<string, string>();
    const copiedPages = pages.filter((item) => item.notebookId === id).map((item) => {
      const newPageId = crypto.randomUUID();
      pageMap.set(item.id, newPageId);
      return { ...item, id: newPageId, notebookId: newId, createdAt: now, updatedAt: now };
    });
    const sourceObjects = objects.filter((object) => pageMap.has(object.pageId));
    const objectMap = new Map(sourceObjects.map((object) => [object.id, crypto.randomUUID()]));
    const copies = sourceObjects.map((object) => {
      const id = objectMap.get(object.id)!;
      const copy = {
        ...object, id, pageId: pageMap.get(object.pageId)!,
        createdAt: now, updatedAt: now,
        groupId: object.groupId ? objectMap.get(object.groupId) : undefined,
      };
      return object.type === "ai-generation-group"
        ? { ...copy, childObjectIds: object.childObjectIds.map((childId) => objectMap.get(childId) ?? childId) }
        : copy;
    });
    setNotebooks((previous) => [...previous, { ...original, id: newId, name: `${original.name} copy`,
      pinned: false, createdAt: now, updatedAt: now }]);
    setPages((previous) => [...previous, ...copiedPages]);
    setStrokes((previous) => [...previous, ...copies], false);
  };

  const deleteFolder = (id: string) => {
    const descendants = new Set([id]);
    let size = 0;
    while (size !== descendants.size) {
      size = descendants.size;
      for (const folder of folders) {
        if (folder.parentFolderId && descendants.has(folder.parentFolderId)) descendants.add(folder.id);
      }
    }
    deleteNotebooks(notebooks.filter((item) => item.folderId && descendants.has(item.folderId)).map((item) => item.id));
    setFolders((previous) => previous.filter((item) => !descendants.has(item.id)));
    if (dashboardFolderId && descendants.has(dashboardFolderId)) setDashboardFolderId(null);
  };

  if (showDashboard) {
    return <Dashboard notebooks={notebooks} folders={folders} pages={pages} objects={objects}
      folderId={dashboardFolderId} onFolderChange={setDashboardFolderId}
      defaults={notebookDefaults} onDefaultsChange={setNotebookDefaults}
      onOpen={openNotebook} onCreateNotebook={createNotebook}
      onCreateFolder={(name, parentFolderId) => {
        const now = new Date().toISOString();
        setFolders((previous) => [...previous, { id: crypto.randomUUID(), ownerId: "local", name,
          parentFolderId, createdAt: now, updatedAt: now }]);
      }}
      onRenameNotebook={(id, name) => setNotebooks((previous) => previous.map((item) =>
        item.id === id ? { ...item, name, updatedAt: new Date().toISOString() } : item))}
      onRenameFolder={(id, name) => setFolders((previous) => previous.map((item) =>
        item.id === id ? { ...item, name, updatedAt: new Date().toISOString() } : item))}
      onDeleteNotebook={(id) => deleteNotebooks([id])} onDeleteFolder={deleteFolder}
      onDuplicateNotebook={duplicateNotebook}
      onPinNotebook={(id) => setNotebooks((previous) => previous.map((item) =>
        item.id === id ? { ...item, pinned: !item.pinned, updatedAt: new Date().toISOString() } : item))}
      onMoveNotebook={(id, folderId) => setNotebooks((previous) => previous.map((item) =>
        item.id === id ? { ...item, folderId, updatedAt: new Date().toISOString() } : item))}
      onMoveFolder={(id, parentFolderId) => {
        if (canMoveFolder(folders, id, parentFolderId)) setFolders((previous) => previous.map((item) =>
          item.id === id ? { ...item, parentFolderId, updatedAt: new Date().toISOString() } : item));
      }} />;
  }

  return (
    <div className="app-container">
      <Toolbar
        notebookName={notebooks.find((notebook) => notebook.id === activeNotebookId)?.name}
        onHome={() => { setSelectedIds([]); setShowDashboard(true); }}
        activeTool={activeTool}
        writingActive={objectTool === null}
        hasObjectSelection={objectTool === "lasso" && selectedObjects.length > 0}
        onSelectTool={(tool) => {
          setObjectTool(null);
          setSelectedIds([]);
          setActiveTool(tool);
          if (tool === "pen" || tool === "pencil" || tool === "highlighter") setLastInkTool(tool);
        }}
        activeStyle={activeStyle}
        onUpdateStyle={handleUpdateActiveSettings}
        template={page.template}
        onTemplateChange={handleTemplateChange}
        size={page.size}
        onSizeChange={handleSizeChange}
        orientation={page.orientation}
        onOrientationChange={handleOrientationChange}
        strokeCount={strokes.filter((stroke) => stroke.pageId === page.id).length}
        objectCount={objects.filter((object) => object.pageId === page.id).length}
        onClearPage={handleClearPage}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        backendStatus={backendStatus}
        objectTools={<ObjectToolbar
          tool={objectTool}
          onSelectTool={(tool) => {
            if ((tool === "shape" || tool === "text") &&
              (activeTool === "eraser-partial" || activeTool === "eraser-stroke")) setActiveTool(lastInkTool);
            setObjectTool(tool);
            setSelectedIds([]);
            setObjectMessage("");
          }}
          shape={shapeKind}
          onSelectShape={setShapeKind}
          shapeFilled={shapeFilled}
          onShapeFilledChange={setShapeFilled}
          hasSelection={selectedObjects.length > 0}
          canPaste={clipboard.length > 0}
          selectedText={selectedText}
          onFormatText={formatText}
          selectedShapeStyle={selectedShapeStyle}
          onShapeStyleChange={formatShapes}
          onShapeStyleGestureStart={beginTransaction}
          onShapeStyleGestureEnd={commitTransaction}
          canCleanShape={selectedObjects.length === 1 && !!selectedObjects[0] && isStrokeObject(selectedObjects[0])}
          onCleanShape={cleanShape}
          onRecolor={recolorSelection}
          selectionColor={selectionColor}
          onDelete={deleteSelection}
          onCopy={copySelection}
          onPaste={pasteSelection}
        />}
      />

      <main className="canvas-main">
        {objectMessage && <div className="object-message" role="status">{objectMessage}</div>}
        <CanvasViewport
          page={page}
          pages={notebookPages}
          onPageActivate={activatePage}
          onAppendPage={() => {
            const lastPage = notebookPages[notebookPages.length - 1];
            if (lastPage) addPage(lastPage);
          }}
          strokes={strokes}
          objects={objects}
          onObjectsChange={setStrokes}
          objectTool={objectTool}
          shapeKind={shapeKind}
          shapeFilled={shapeFilled}
          selectedIds={selectedIds}
          onSelectionChange={(ids) => { setSelectedIds(ids); setObjectMessage(""); }}
          onObjectGestureStart={beginTransaction}
          onObjectGestureEnd={commitTransaction}
          onStrokeComplete={handleStrokeComplete}
          onEraseStart={beginTransaction}
          onPageEraseAtPoint={handleEraseAtPoint}
          onEraseEnd={commitTransaction}
          activeStyle={activeStyle}
          activeTool={activeTool}
          onViewportChange={setCurrentZoom}
          viewportControlsRef={viewportControlsRef}
        />

        <div className="workspace-footer">
          <div className="page-indicator">
            <Icon name="page" />
            <label>
              <span className="visually-hidden">Current page</span>
              <select aria-label="Current page" value={page.id} onChange={(event) => {
                activatePage(event.target.value);
                viewportControlsRef.current?.goToPage?.(event.target.value);
              }}>
                {notebookPages.map((item, index) => <option key={item.id} value={item.id}>Page {index + 1}</option>)}
              </select>
            </label>
            <span className="page-total">/ {notebookPages.length}</span>
            <button type="button" onClick={() => addPage()}>Add page</button>
            <button type="button" aria-label="Move page up" disabled={page.order === 0} onClick={() => movePage(-1)}>↑</button>
            <button type="button" aria-label="Move page down" disabled={page.order === notebookPages.length - 1} onClick={() => movePage(1)}>↓</button>
            {confirmDeletePage ? (
              <>
                <button type="button" onClick={deletePage}>Confirm delete page</button>
                <button type="button" onClick={() => setConfirmDeletePage(false)}>Cancel</button>
              </>
            ) : <button type="button" disabled={notebookPages.length <= 1} onClick={() => setConfirmDeletePage(true)}>Delete page</button>}
          </div>
          <span className="workspace-hint">
            <kbd>Space</kbd> to pan <span>&middot;</span> <kbd>Ctrl</kbd> + scroll to zoom
          </span>
        </div>

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
