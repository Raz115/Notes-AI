import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { PAGE_SIZE_OPTIONS, type CanvasObject, type Folder, type Notebook, type Page, type PageOrientation, type PageSize, type PageTemplate } from "@ai-notes/shared";
import { PageThumbnail } from "./PageThumbnail.js";
import { Icon } from "./Icon.js";

export interface NotebookOptions {
  name: string;
  folderId: string | null;
  size: PageSize;
  orientation: PageOrientation;
  template: PageTemplate;
}

interface DashboardProps {
  notebooks: Notebook[];
  folders: Folder[];
  pages: Page[];
  objects: CanvasObject[];
  folderId: string | null;
  onFolderChange: (id: string | null) => void;
  defaults: Pick<NotebookOptions, "size" | "orientation" | "template">;
  onDefaultsChange: (defaults: Pick<NotebookOptions, "size" | "orientation" | "template">) => void;
  onOpen: (id: string) => void;
  onCreateNotebook: (options: NotebookOptions) => void;
  onCreateFolder: (name: string, parent: string | null) => void;
  onRenameNotebook: (id: string, name: string) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteNotebook: (id: string) => void;
  onDeleteFolder: (id: string) => void;
  onDuplicateNotebook: (id: string) => void;
  onPinNotebook: (id: string) => void;
  onMoveNotebook: (id: string, folderId: string | null) => void;
  onMoveFolder: (id: string, parent: string | null) => void;
}

export function canMoveFolder(folders: Folder[], id: string, target: string | null): boolean {
  let current = target;
  while (current) {
    if (current === id) return false;
    const folder = folders.find((item) => item.id === current);
    if (!folder) return false;
    current = folder.parentFolderId;
  }
  return true;
}

type Dialog = { kind: "settings" | "new-notebook" | "new-folder" | "rename-notebook" | "rename-folder" |
  "delete-notebook" | "delete-folder"; id?: string };

export function Dashboard(props: DashboardProps) {
  const { folderId, onFolderChange: setFolderId } = props;
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [notebookMenuId, setNotebookMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [size, setSize] = useState<PageSize>("a4");
  const [orientation, setOrientation] = useState<PageOrientation>("portrait");
  const [template, setTemplate] = useState<PageTemplate>("lined");
  const { defaults } = props;
  const currentFolders = props.folders.filter((folder) => folder.parentFolderId === folderId);
  const currentNotebooks = props.notebooks.filter((notebook) => notebook.folderId === folderId)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.name.localeCompare(b.name));
  const path: Folder[] = [];
  let parent = folderId;
  while (parent) {
    const folder = props.folders.find((item) => item.id === parent);
    if (!folder) break;
    path.unshift(folder);
    parent = folder.parentFolderId;
  }
  const openDialog = (next: Dialog, initial = "") => {
    setNotebookMenuId(null);
    setName(initial);
    if (next.kind === "new-notebook" || next.kind === "settings") {
      setSize(defaults.size);
      setOrientation(defaults.orientation);
      setTemplate(defaults.template);
    }
    setError("");
    setDialog(next);
  };
  useEffect(() => {
    setNotebookMenuId(null);
  }, [folderId]);
  useEffect(() => {
    if (!notebookMenuId) return;
    menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target) &&
        !menuTriggerRef.current?.contains(event.target)) setNotebookMenuId(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setNotebookMenuId(null);
        menuTriggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [notebookMenuId]);
  useEffect(() => {
    if (!dialog) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDialog(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dialog]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!dialog) return;
    const trimmed = name.trim();
    if (dialog.kind !== "settings" && !trimmed) {
      setError("Enter a name.");
      return;
    }
    if (dialog.kind === "settings") {
      props.onDefaultsChange({ size, orientation, template });
    } else if (dialog.kind === "new-notebook" && trimmed) {
      props.onCreateNotebook({ name: trimmed, folderId, size, orientation, template });
    } else if (dialog.kind === "new-folder" && trimmed) {
      props.onCreateFolder(trimmed, folderId);
    } else if (dialog.kind === "rename-notebook" && dialog.id && trimmed) {
      props.onRenameNotebook(dialog.id, trimmed);
    } else if (dialog.kind === "rename-folder" && dialog.id && trimmed) {
      props.onRenameFolder(dialog.id, trimmed);
    } else if (dialog.kind === "delete-notebook" && dialog.id) {
      props.onDeleteNotebook(dialog.id);
    } else if (dialog.kind === "delete-folder" && dialog.id) {
      props.onDeleteFolder(dialog.id);
    } else return;
    setDialog(null);
  };
  const drop = (event: DragEvent, target: string | null) => {
    event.preventDefault();
    const notebook = event.dataTransfer.getData("application/x-notes-notebook");
    const folder = event.dataTransfer.getData("application/x-notes-folder");
    if (notebook) {
      props.onMoveNotebook(notebook, target);
      setError("");
    }
    if (folder) {
      if (canMoveFolder(props.folders, folder, target)) {
        props.onMoveFolder(folder, target);
        setError("");
      } else {
        setError("A folder cannot be moved into itself or one of its subfolders.");
      }
    }
  };
  const folderOptions = (exclude?: string) => (
    <>
      <option value="">All notebooks</option>
      {props.folders.filter((folder) => !exclude || canMoveFolder(props.folders, exclude, folder.id))
        .map((folder) => {
          const names = [folder.name];
          let ancestor = folder.parentFolderId;
          while (ancestor) {
            const parent = props.folders.find((item) => item.id === ancestor);
            if (!parent) break;
            names.unshift(parent.name);
            ancestor = parent.parentFolderId;
          }
          return <option key={folder.id} value={folder.id}>{names.join(" / ")}</option>;
        })}
    </>
  );
  const deleting = dialog?.kind === "delete-notebook" || dialog?.kind === "delete-folder";
  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <div><span className="app-name">NOTES AI</span><h1>Your notebooks</h1></div>
        <div className="dashboard-header-actions">
          <span className="dashboard-session">Session only · sync unavailable</span>
          <button type="button" className="quiet-button" onClick={() => openDialog({ kind: "settings" })}>Settings</button>
        </div>
      </header>
      <div className="dashboard-content">
        <div className="dashboard-heading">
          <nav aria-label="Folder path">
            <button type="button" onClick={() => setFolderId(null)}
              onDragOver={(event) => event.preventDefault()} onDrop={(event) => drop(event, null)}>All notebooks</button>
            {path.map((folder) => <span key={folder.id}> / <button type="button" draggable
              onDragStart={(event) => event.dataTransfer.setData("application/x-notes-folder", folder.id)}
              onClick={() => setFolderId(folder.id)} onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => drop(event, folder.id)}>{folder.name}</button></span>)}
          </nav>
          <button type="button" className="quiet-button" aria-label="New folder"
            onClick={() => openDialog({ kind: "new-folder" })}>+ New folder</button>
        </div>
        {error && !dialog && <p role="status">{error}</p>}
        <div className="dashboard-folders">
          {currentFolders.map((folder) => (
            <article key={folder.id} className="folder-card" draggable
              onDragStart={(event) => event.dataTransfer.setData("application/x-notes-folder", folder.id)}
              onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.stopPropagation(); drop(event, folder.id); }}>
              <button type="button" className="folder-open" onClick={() => setFolderId(folder.id)}>
                <Icon name="folder" /> {folder.name}
              </button>
              <div className="card-actions">
                <button type="button" onClick={() => openDialog({ kind: "rename-folder", id: folder.id }, folder.name)}>Rename</button>
                <button type="button" onClick={() => openDialog({ kind: "delete-folder", id: folder.id }, folder.name)}>Delete</button>
              </div>
              <select aria-label={`Move folder ${folder.name}`} value={folder.parentFolderId ?? ""}
                onChange={(event) => props.onMoveFolder(folder.id, event.target.value || null)}>
                {folderOptions(folder.id)}
              </select>
            </article>
          ))}
        </div>
        <div className="notebook-grid">
          <button type="button" className="new-notebook-card" aria-label="New notebook"
            onClick={() => openDialog({ kind: "new-notebook" })}>
            <span>+</span><strong>New notebook</strong>
          </button>
          {currentNotebooks.map((notebook) => {
            const first = props.pages.filter((page) => page.notebookId === notebook.id)
              .sort((a, b) => a.order - b.order)[0];
            return (
              <article key={notebook.id} className="notebook-card" draggable
                onDragStart={(event) => event.dataTransfer.setData("application/x-notes-notebook", notebook.id)}>
                <button type="button" className="notebook-open" onClick={() => props.onOpen(notebook.id)}
                  aria-label={`Open ${notebook.name}`}>
                  {first && <PageThumbnail page={first} objects={props.objects.filter((object) => object.pageId === first.id)} />}
                  <strong>{notebook.name}</strong>
                </button>
                <div className="notebook-card-actions">
                  <button type="button" className={`notebook-pin${notebook.pinned ? " is-pinned" : ""}`}
                    aria-label={notebook.pinned ? "Unpin" : "Pin"} title={notebook.pinned ? "Unpin" : "Pin"}
                    aria-pressed={notebook.pinned} onClick={() => props.onPinNotebook(notebook.id)}>
                    <Icon name="pin" />
                  </button>
                  <button type="button" className="notebook-more" aria-label={`Notebook actions for ${notebook.name}`}
                    aria-expanded={notebookMenuId === notebook.id} aria-controls={`notebook-actions-${notebook.id}`}
                    onClick={(event) => {
                      menuTriggerRef.current = event.currentTarget;
                      setNotebookMenuId((previous) => previous === notebook.id ? null : notebook.id);
                    }}>
                    <Icon name="more" />
                  </button>
                  {notebookMenuId === notebook.id && (
                    <div ref={menuRef} id={`notebook-actions-${notebook.id}`} className="notebook-menu"
                      role="group" aria-label={`Actions for ${notebook.name}`}>
                      <button type="button" onClick={() => openDialog({ kind: "rename-notebook", id: notebook.id }, notebook.name)}>Rename</button>
                      <button type="button" onClick={() => {
                        props.onDuplicateNotebook(notebook.id);
                        setNotebookMenuId(null);
                        menuTriggerRef.current?.focus();
                      }}>Duplicate</button>
                      <button type="button" className="notebook-menu-delete"
                        onClick={() => openDialog({ kind: "delete-notebook", id: notebook.id }, notebook.name)}>Delete</button>
                      <label>Move to
                        <select aria-label={`Move notebook ${notebook.name}`} value={notebook.folderId ?? ""}
                          onChange={(event) => {
                            props.onMoveNotebook(notebook.id, event.target.value || null);
                            setNotebookMenuId(null);
                          }}>
                          {folderOptions()}
                        </select>
                      </label>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
      {dialog && (
        <div className="dashboard-modal-backdrop">
          <form className="dashboard-modal" role="dialog" aria-modal="true" aria-labelledby="dashboard-dialog-title"
            onSubmit={submit}>
            <h2 id="dashboard-dialog-title">{deleting ? `Delete ${name}?` :
              dialog.kind === "settings" ? "Workspace settings" :
              dialog.kind === "new-notebook" ? "New notebook" :
              dialog.kind === "new-folder" ? "New folder" : "Rename"}</h2>
            {deleting ? <p>{dialog.kind === "delete-folder"
              ? "This also deletes everything inside this folder, including nested folders and notebooks."
              : "This deletes the notebook and all its pages."} This cannot be undone.</p> : dialog.kind !== "settings" ? (
              <label>Name <input autoFocus aria-label="Name" value={name} required
                onChange={(event) => setName(event.target.value)} /></label>
            ) : <p>These defaults apply to new notebooks in this session. Cloud sync is not connected.</p>}
            {error && <p role="alert">{error}</p>}
            {(dialog.kind === "new-notebook" || dialog.kind === "settings") && (
              <div className="dashboard-form-fields">
                <label>Paper size <select value={size} onChange={(event) => setSize(event.target.value as PageSize)}>
                  {PAGE_SIZE_OPTIONS.map((option) => <option key={option.value} value={option.value}>
                    {option.label} ({option.dimensions})
                  </option>)}
                </select></label>
                <label>Orientation <select value={orientation} onChange={(event) => setOrientation(event.target.value as PageOrientation)}>
                  <option value="portrait">Portrait</option><option value="landscape">Landscape</option>
                </select></label>
                <label>Template <select value={template} onChange={(event) => setTemplate(event.target.value as PageTemplate)}>
                  <option value="lined">Lined</option><option value="plain">Plain</option>
                  <option value="graph">Graph</option><option value="notepad">Notepad</option>
                </select></label>
              </div>
            )}
            <div className="dashboard-modal-actions">
              <button type="button" className="quiet-button" onClick={() => setDialog(null)}>Cancel</button>
              <button type="submit" className={deleting ? "danger-button" : "dashboard-primary"}>
                {deleting ? "Delete" : dialog.kind.startsWith("new") ? "Create" : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
