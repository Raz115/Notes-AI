import type {
  CanvasObject,
  Folder,
  Notebook,
  Page,
  PageOrientation,
  PageSize,
  PageTemplate,
  ToolSettingsMap,
} from "@ai-notes/shared";

const DATABASE_VERSION = 1;
const DEFAULT_DATABASE_NAME = "notes-ai-local";
const STORE_NAMES = [
  "notebooks",
  "folders",
  "pages",
  "objects",
  "metadata",
  "syncQueue",
] as const;

type EntityType = "notebook" | "folder" | "page" | "object";
type Entity = Notebook | Folder | Page | CanvasObject;

export interface NotebookDefaults {
  size: PageSize;
  orientation: PageOrientation;
  template: PageTemplate;
}

export interface WorkspaceSnapshot {
  notebooks: Notebook[];
  folders: Folder[];
  pages: Page[];
  objects: CanvasObject[];
  activeNotebookId: string;
  activePageId: string;
  dashboardFolderId: string | null;
  notebookDefaults: NotebookDefaults;
  toolSettings: ToolSettingsMap;
}

export type LocalSaveStatus = "saving" | "saved" | "error";

interface StoredRecord<T> {
  id: string;
  dirty: boolean;
  data: T;
  pageId?: string;
}

interface WorkspaceMetadata {
  schemaVersion: number;
  activeNotebookId: string;
  activePageId: string;
  dashboardFolderId: string | null;
  notebookDefaults: NotebookDefaults;
  toolSettings: ToolSettingsMap;
}

export interface PendingSyncChange {
  id: string;
  entityType: EntityType;
  entityId: string;
  operation: "upsert" | "delete";
  updatedAt: string;
  revision: string;
}

let lastQueueTimestamp = 0;

function nextQueueTimestamp(): string {
  const timestamp = Math.max(Date.now(), lastQueueTimestamp + 1);
  lastQueueTimestamp = timestamp;
  return new Date(timestamp).toISOString();
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction was aborted."));
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction failed."));
  });
}

export function openLocalWorkspace(name = DEFAULT_DATABASE_NAME): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(
      new Error("This browser does not support local notebook storage."),
    );
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("notebooks"))
        database.createObjectStore("notebooks", { keyPath: "id" });
      if (!database.objectStoreNames.contains("folders"))
        database.createObjectStore("folders", { keyPath: "id" });
      if (!database.objectStoreNames.contains("pages")) {
        const pages = database.createObjectStore("pages", { keyPath: "id" });
        pages.createIndex("notebookId", "data.notebookId");
      }
      if (!database.objectStoreNames.contains("objects")) {
        const objects = database.createObjectStore("objects", { keyPath: "id" });
        objects.createIndex("pageId", "pageId");
        objects.createIndex("dirty", "dirty");
      }
      if (!database.objectStoreNames.contains("metadata"))
        database.createObjectStore("metadata", { keyPath: "key" });
      if (!database.objectStoreNames.contains("syncQueue")) {
        const queue = database.createObjectStore("syncQueue", { keyPath: "id" });
        queue.createIndex("updatedAt", "updatedAt");
      }
    };
    let settled = false;
    request.onblocked = () => {
      if (settled) return;
      settled = true;
      reject(new Error("Local notebook storage is blocked by another open tab."));
    };
    request.onerror = () => {
      if (settled) return;
      settled = true;
      reject(request.error ?? new Error("Could not open local notebook storage."));
    };
    request.onsuccess = () => {
      if (settled) {
        request.result.close();
        return;
      }
      settled = true;
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
}

export async function loadWorkspace(
  database: IDBDatabase,
): Promise<WorkspaceSnapshot | null> {
  const transaction = database.transaction(STORE_NAMES, "readonly");
  const complete = transactionComplete(transaction);
  const metadataRequest = transaction
    .objectStore("metadata")
    .get("workspace") as IDBRequest<
    { key: string; value: WorkspaceMetadata } | undefined
  >;
  const notebooksRequest = transaction.objectStore("notebooks").getAll() as IDBRequest<
    StoredRecord<Notebook>[]
  >;
  const foldersRequest = transaction.objectStore("folders").getAll() as IDBRequest<
    StoredRecord<Folder>[]
  >;
  const pagesRequest = transaction.objectStore("pages").getAll() as IDBRequest<
    StoredRecord<Page>[]
  >;
  const objectsRequest = transaction.objectStore("objects").getAll() as IDBRequest<
    StoredRecord<CanvasObject>[]
  >;
  const [metadata, notebooks, folders, pages, objects] = await Promise.all([
    requestResult(metadataRequest),
    requestResult(notebooksRequest),
    requestResult(foldersRequest),
    requestResult(pagesRequest),
    requestResult(objectsRequest),
  ]);
  await complete;

  if (!metadata) {
    if (notebooks.length || folders.length || pages.length || objects.length) {
      throw new Error("Local notebook data is incomplete and could not be recovered.");
    }
    return null;
  }
  if (metadata.value.schemaVersion !== DATABASE_VERSION) {
    throw new Error("Local notebook data uses an unsupported version.");
  }

  return {
    notebooks: notebooks.map((record) => record.data),
    folders: folders.map((record) => record.data),
    pages: pages.map((record) => record.data),
    objects: objects.map((record) => record.data),
    activeNotebookId: metadata.value.activeNotebookId,
    activePageId: metadata.value.activePageId,
    dashboardFolderId: metadata.value.dashboardFolderId,
    notebookDefaults: metadata.value.notebookDefaults,
    toolSettings: metadata.value.toolSettings,
  };
}

function syncEntities<T extends Entity>(
  entityType: EntityType,
  store: IDBObjectStore,
  queue: IDBObjectStore,
  previous: T[] | null,
  next: T[],
): void {
  const before = new Map((previous ?? []).map((entity) => [entity.id, entity]));
  const after = new Map(next.map((entity) => [entity.id, entity]));
  const updatedAt = nextQueueTimestamp();

  for (const entity of next) {
    if (before.get(entity.id) === entity) continue;
    const record: StoredRecord<T> = { id: entity.id, dirty: true, data: entity };
    if (entityType === "object" && "pageId" in entity) record.pageId = entity.pageId;
    store.put(record);
    queue.put({
      id: `${entityType}:${entity.id}`,
      entityType,
      entityId: entity.id,
      operation: "upsert",
      updatedAt,
      revision: crypto.randomUUID(),
    });
  }

  for (const entity of previous ?? []) {
    if (after.has(entity.id)) continue;
    store.delete(entity.id);
    queue.put({
      id: `${entityType}:${entity.id}`,
      entityType,
      entityId: entity.id,
      operation: "delete",
      updatedAt,
      revision: crypto.randomUUID(),
    });
  }
}

export async function saveWorkspaceChanges(
  database: IDBDatabase,
  previous: WorkspaceSnapshot | null,
  next: WorkspaceSnapshot,
): Promise<void> {
  const transaction = database.transaction(STORE_NAMES, "readwrite");
  const complete = transactionComplete(transaction);
  const queue = transaction.objectStore("syncQueue");

  syncEntities(
    "notebook",
    transaction.objectStore("notebooks"),
    queue,
    previous?.notebooks ?? null,
    next.notebooks,
  );
  syncEntities(
    "folder",
    transaction.objectStore("folders"),
    queue,
    previous?.folders ?? null,
    next.folders,
  );
  syncEntities(
    "page",
    transaction.objectStore("pages"),
    queue,
    previous?.pages ?? null,
    next.pages,
  );
  syncEntities(
    "object",
    transaction.objectStore("objects"),
    queue,
    previous?.objects ?? null,
    next.objects,
  );

  transaction.objectStore("metadata").put({
    key: "workspace",
    value: {
      schemaVersion: DATABASE_VERSION,
      activeNotebookId: next.activeNotebookId,
      activePageId: next.activePageId,
      dashboardFolderId: next.dashboardFolderId,
      notebookDefaults: next.notebookDefaults,
      toolSettings: next.toolSettings,
    } satisfies WorkspaceMetadata,
  });
  await complete;
}

export async function getPendingSyncChanges(
  database: IDBDatabase,
): Promise<PendingSyncChange[]> {
  const transaction = database.transaction("syncQueue", "readonly");
  const complete = transactionComplete(transaction);
  const request = transaction.objectStore("syncQueue").getAll() as IDBRequest<
    PendingSyncChange[]
  >;
  const changes = await requestResult(request);
  await complete;
  return changes;
}

export async function markSyncChangesComplete(
  database: IDBDatabase,
  changes: PendingSyncChange[],
): Promise<void> {
  if (!changes.length) return;
  const stores: Record<EntityType, string> = {
    notebook: "notebooks",
    folder: "folders",
    page: "pages",
    object: "objects",
  };
  const transaction = database.transaction(
    [...new Set(["syncQueue", ...changes.map((change) => stores[change.entityType])])],
    "readwrite",
  );
  const complete = transactionComplete(transaction);
  const queue = transaction.objectStore("syncQueue");

  for (const change of changes) {
    const store = transaction.objectStore(stores[change.entityType]);
    const queuedRequest = queue.get(change.id);
    queuedRequest.onsuccess = () => {
      const current = queuedRequest.result as PendingSyncChange | undefined;
      if (!current || current.revision !== change.revision) return;
      if (change.operation === "delete") {
        queue.delete(change.id);
        return;
      }
      const recordRequest = store.get(change.entityId);
      recordRequest.onsuccess = () => {
        const record = recordRequest.result as StoredRecord<Entity> | undefined;
        if (record) store.put({ ...record, dirty: false });
        queue.delete(change.id);
      };
    };
  }
  await complete;
}
