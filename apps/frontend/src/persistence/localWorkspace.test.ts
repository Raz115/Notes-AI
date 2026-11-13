import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type {
  CanvasObject,
  Folder,
  Notebook,
  Page,
  ToolSettingsMap,
} from "@ai-notes/shared";
import {
  getPendingSyncChanges,
  loadWorkspace,
  markSyncChangesComplete,
  openLocalWorkspace,
  saveWorkspaceChanges,
  type WorkspaceSnapshot,
} from "./localWorkspace.js";

const toolSettings: ToolSettingsMap = {
  pen: { color: "#000000", thickness: 4, opacity: 1 },
  pencil: { color: "#475569", thickness: 3, opacity: 0.65 },
  highlighter: { color: "#fef08a", thickness: 24, opacity: 0.5 },
  "eraser-partial": { color: "#ffffff", thickness: 20, opacity: 1 },
  "eraser-stroke": { color: "#ffffff", thickness: 20, opacity: 1 },
};

const notebook: Notebook = {
  id: "notebook-1",
  ownerId: "local",
  name: "Notes",
  folderId: "folder-1",
  pinned: true,
  createdAt: "now",
  updatedAt: "now",
};
const folder: Folder = {
  id: "folder-1",
  ownerId: "local",
  name: "School",
  parentFolderId: null,
  createdAt: "now",
  updatedAt: "now",
};
const page: Page = {
  id: "page-1",
  notebookId: notebook.id,
  order: 0,
  size: "letter",
  orientation: "landscape",
  template: "graph",
  createdAt: "now",
  updatedAt: "now",
};
const stroke: CanvasObject = {
  id: "stroke-1",
  pageId: page.id,
  type: "pen-stroke",
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  rotation: 0,
  zIndex: 1,
  createdAt: "now",
  updatedAt: "now",
  source: "user",
  points: [
    { x: 0, y: 0 },
    { x: 10, y: 10 },
  ],
  style: { color: "#000000", thickness: 4, opacity: 1 },
};
const secondStroke: CanvasObject = { ...stroke, id: "stroke-2" };

function workspace(objects: CanvasObject[] = [stroke, secondStroke]): WorkspaceSnapshot {
  return {
    notebooks: [notebook],
    folders: [folder],
    pages: [page],
    objects,
    activeNotebookId: notebook.id,
    activePageId: page.id,
    dashboardFolderId: folder.id,
    notebookDefaults: { size: "a4", orientation: "portrait", template: "lined" },
    toolSettings,
  };
}

describe("local workspace persistence", () => {
  let database: IDBDatabase;
  let databaseName: string;

  beforeEach(async () => {
    databaseName = `notes-ai-persistence-test-${crypto.randomUUID()}`;
    database = await openLocalWorkspace(databaseName);
  });

  afterEach(() => database.close());

  it("round-trips notebook state and canvas objects after a reload", async () => {
    const saved = workspace();
    await saveWorkspaceChanges(database, null, saved);

    const recovered = await loadWorkspace(database);
    expect(recovered).toEqual(saved);
    const changes = await getPendingSyncChanges(database);
    expect(changes).toHaveLength(5);
    expect(changes.every((change) => change.operation === "upsert")).toBe(true);

    database.close();
    database = await openLocalWorkspace(databaseName);
    expect(await loadWorkspace(database)).toEqual(saved);
  });

  it("writes only changed objects and protects newer edits from stale sync acknowledgements", async () => {
    const initial = workspace();
    await saveWorkspaceChanges(database, null, initial);
    await markSyncChangesComplete(database, await getPendingSyncChanges(database));

    const changedOnce = { ...stroke, updatedAt: "changed-once" };
    const firstEdit = workspace([changedOnce, secondStroke]);
    await saveWorkspaceChanges(database, initial, firstEdit);
    const staleAcknowledgement = await getPendingSyncChanges(database);
    expect(staleAcknowledgement).toHaveLength(1);
    expect(staleAcknowledgement[0]).toMatchObject({
      entityId: stroke.id,
      operation: "upsert",
    });

    const changedAgain = { ...changedOnce, updatedAt: "changed-again" };
    const secondEdit = workspace([changedAgain]);
    await saveWorkspaceChanges(database, firstEdit, secondEdit);
    await markSyncChangesComplete(database, staleAcknowledgement);

    const pending = await getPendingSyncChanges(database);
    expect(pending).toHaveLength(2);
    expect(pending.find((change) => change.entityId === stroke.id)?.operation).toBe(
      "upsert",
    );
    expect(pending.find((change) => change.entityId === secondStroke.id)?.operation).toBe(
      "delete",
    );

    const transaction = database.transaction(["objects"], "readonly");
    const request = transaction.objectStore("objects").get(stroke.id);
    const stored = await new Promise<{ dirty: boolean }>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    expect(stored.dirty).toBe(true);

    await markSyncChangesComplete(database, pending);
    expect(await getPendingSyncChanges(database)).toEqual([]);
    const verify = database.transaction(["objects"], "readonly");
    const verifyRequest = verify.objectStore("objects").get(stroke.id);
    const clean = await new Promise<{ dirty: boolean }>((resolve, reject) => {
      verifyRequest.onsuccess = () => resolve(verifyRequest.result);
      verifyRequest.onerror = () => reject(verifyRequest.error);
    });
    expect(clean.dirty).toBe(false);
  });
});
