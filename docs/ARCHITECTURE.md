# Architecture

This document covers the Phase 0 foundation: what was built, why it's
structured this way, and the decisions later phases should build on top of
rather than reopen.

## Monorepo layout

npm workspaces were chosen over a single flat project because the spec
requires a hard separation between the browser and the backend (no AI
secrets in the client — technical-requirements.md section 4.2/30), and a
shared type package that both sides depend on without either one becoming
the "owner" of the other.

```text
apps/frontend    React 19 + TypeScript + Vite. Owns the canvas, dashboard, UI.
apps/backend     Express + TypeScript. Owns AI orchestration, auth, DB access.
packages/shared  Canvas object model + AI request/response types.
```

Build order matters: `shared` must be compiled to `dist/` before `backend`
or `frontend` can resolve `@ai-notes/shared` (it's consumed as a normal
package, not via TS project references — project references were tried
and dropped early because they require every consumer to also be
`composite`, which added friction for no real benefit at this size). The
root `predev:backend` and `pretest` npm hooks build `shared` automatically;
`npm run build` builds it explicitly first.

## Shared package (`packages/shared`)

Two files carry the real content:

- `canvas.ts` — `CanvasObjectBase` and its discriminated-union variants
  (`StrokeObject`, `TextboxObject`, `RectangleObject`, ..., `GraphObject`,
  `AiGenerationGroupObject`), plus `Page`, `Notebook`, `Folder`. This is a
  direct implementation of technical-requirements.md sections 6-11: objects
  are independently addressable, coordinates are page-relative (never
  screen-relative), and AI-generated content is tagged via `source: "ai"`
  so it can be filtered, grouped, and atomically undone.
- `ai.ts` — the request/response contract between frontend and backend for
  AI interactions: `AiSelectionContext` (what got sent — text first, image
  only on escalation, per section 27), `AiDrawingPrimitive` (the structured
  drawing schema from section 31), and the discriminated `AiResponse` union
  covering the response types from section 39.

Nothing in this package has a runtime dependency on React, Express, or any
AI SDK — it's pure types plus a couple of type-guard functions, so both
apps can import it without pulling in the other's dependency tree.

## Backend (`apps/backend`)

`app.ts` exports `createApp()` — an Express app builder with no `.listen()`
call — separately from `index.ts`, which is the only file that binds a
port. This exists purely for testability: `app.test.ts` drives requests
through `supertest` without opening a real socket. As real routes get
added (auth in Phase 6, `/ai/answer` in Phase 8, etc.) they're registered
inside `createApp()`, in the same testable path.

Error handling is centralized in `middleware/errorHandler.ts`. Route
handlers should throw `AppError(message, statusCode)` for expected failures
(e.g. validation) or let unexpected errors bubble — both are caught by the
error-handling middleware and turned into a JSON response instead of a
stack trace or a crash, which is a hard requirement from
technical-requirements.md section 63 ("AI/network errors must not destroy
unsaved local work" — the backend must not go down and take a sync request
down with it).

`config/env.ts` is the only file that reads `process.env`. It already
declares the Supabase and AI-provider variables Phase 6 and Phase 8 will
need, deliberately left blank until those phases wire them up — this keeps
`.env.example` accurate to the eventual full feature set from day one
instead of growing piecemeal.

## Frontend (`apps/frontend`)

Scaffolded from the standard Vite `react-ts` template, then stripped of the
counter-demo boilerplate. The Phase 0 `App.tsx` is intentionally not a
feature — it's a placeholder that calls the backend's `/health` endpoint
and reports connectivity, existing only to prove frontend → backend wiring
works before Phase 1 introduces the actual canvas.

`vite.config.ts` also configures Vitest (`jsdom` environment, Testing
Library's jest-dom matchers loaded via `setupTests.ts`). No canvas
rendering library (e.g. `perfect-freehand`) is installed yet — the spec
treats that as an implementation-time choice for Phase 1
(technical-requirements.md section 4.5), not a Phase 0 concern.

Phase 1 will implement a **hybrid canvas architecture**:
- A base HTML5 `<canvas>` 2D surface for high-frequency freehand stroke
  rendering (with `perfect-freehand` for smooth stroke geometry).
- An HTML/SVG DOM overlay layer for interactive textboxes
  (`contentEditable`), lasso/selection bounding boxes and transformation
  handles, and embedded widgets like Desmos.

## Current editor (Phase 2)

The canvas foundation now includes pen, pencil, highlighter, and both eraser
modes. Partial erasing clips canonical stroke segments against the circular
eraser's swept capsule, including between pointer events. Cut edges interpolate
pressure, and fragment bounds include stroke thickness. Whole-stroke erasing
uses the same intersection geometry.

`useHistory` keeps gesture transactions in the same state queue as live
mutations. Beginning an erase records the pre-gesture snapshot; committing
adds one undo entry only when the gesture changed the page. Undo/redo is
disabled while that transaction is active, and no-op erasing preserves redo.
Pointer cancellation or lost capture commits the already-applied gesture
without adding a spurious endpoint.

The editor uses light, system-font chrome and local SVG icons, with separate
document and writing-tool rows. Ink, tool, paper, and notebook options share
a dismissible settings panel with Escape/focus restoration. Zoom controls
remain visible for keyboard and touch users. Clear-page requires confirmation.
The UI explicitly labels this as a session-only workspace; it does not claim
local/cloud saving or AI actions before those exist.

## Object editing (Phase 3)

The page history contains the shared `CanvasObject` union, so freehand strokes,
text and shapes participate in the same undo/redo transactions. The canvas
continues rendering strokes, while an overlay renders shapes and editable
textboxes. Lasso hit testing uses page-relative canonical stroke/line geometry;
selection transforms update points and recompute their bounding boxes.
Copy/paste uses an in-session object clipboard. Shape cleanup is deterministic
and explicitly requested; undo restores the original stroke.

Select, text and shape tools share the main ribbon. The icon-based shape picker
chooses hollow or solid fill for newly drawn closed shapes. Selected shapes can
change stroke width and opacity together; fill applies only to closed shapes
and follows their stroke color. Mixed selections show mixed values, and
non-shape objects are not changed by shape-specific controls. Slider gestures
are grouped in history, and line/arrow/polygon bounds are recomputed when
stroke width changes. Filled shapes render consistently on pages and thumbnails.

## Pages and notebooks (Phase 4)

The dashboard manages notebooks and nested folders, with thumbnails and pinned
notebooks. The editor displays pages in a continuous vertical layout and
supports page creation, navigation, reordering, deletion, and paper settings.
Downward wheel scrolling 240 screen pixels beyond the last page appends and
activates a page with the last page's settings. Appending is limited to once
per wheel gesture, with a 350 ms idle gap before another gesture; zooming,
upward scrolling, and horizontal panning do not append pages.
Shared paper sizes cover A4, Letter, Legal, and 4 x 6 inch cue cards.
Object history is scoped by notebook; deleting a page or notebook removes its
objects from current state and history.

## Local persistence (Phase 5)

IndexedDB is the source of truth for the local workspace. Separate object stores
hold notebooks, folders, pages, individual canvas objects, workspace metadata,
and pending sync changes. Canvas objects are keyed by ID and indexed by page ID
and dirty status; each record carries its page ID and dirty flag. Autosave
debounces edits and writes only added, changed, or deleted records in an atomic
transaction rather than serializing all page content. A page-hide or app
unmount flushes a pending save.

Startup waits for IndexedDB recovery before showing the dashboard. The most
recent notebook/page, notebook defaults, and writing-tool settings are restored
with the content. Browser storage failures are reported in the UI while the
editor remains usable in memory. Upserts and deletion tombstones are coalesced
in a local sync queue for the later cloud phase; no server synchronization or
cross-device backup is implemented yet. Clearing browser storage removes this
local workspace.

## Tooling decisions

- **ESLint**: a single flat config (`eslint.config.js`) at the repo root
  covers both apps and the shared package, rather than per-workspace
  configs, so the rules can't drift between them.
- **Prettier**: `eslint-config-prettier` disables any ESLint formatting
  rules that would conflict with Prettier, so the two tools never fight
  over the same line.
- **Testing**: Vitest everywhere (shared, backend, frontend) for one
  consistent test runner and CLI across the whole repo, instead of mixing
  Jest and Vitest. Every workspace has a `vitest.config.ts`/`test` block
  that explicitly excludes `dist/`, because Vitest's default excludes did
  not reliably keep it from picking up compiled `.test.js` output
  alongside the `.test.ts` source during Phase 0 testing — better to be
  explicit than rely on defaults that were observed to double-run tests.
- **Dependency security**: `vitest` is pinned to the exact `5.0.0` release
  rather than a caret range. During setup, `^4.x` ranges caused npm's
  dependency resolver to error out entirely (an arborist bug triggered by
  the presence of `5.0.0-beta.*`/`-rc.*` prereleases in the version range),
  and `^2.x`/`^3.x` pulled in a moderately vulnerable transitive `esbuild`/
  `vite`. Pinning the exact stable release avoided both problems. An `npm
  overrides` entry also forces `qs@^6.16.0` since Express 4's own
  dependency on `qs` lagged behind a moderate-severity fix. `npm audit`
  currently reports zero vulnerabilities.

## Architectural Refinements & Execution Guidelines

The following architectural guardrails refine the technical specifications
for upcoming phases:

### 1. Hybrid Canvas Stack (`apps/frontend`)
Rendering all objects directly to a single 2D canvas bitmap makes interactive
text editing (`contentEditable`, caret blinking, IME keyboards, selection)
and third-party widgets (Desmos) prohibitively complex and fragile.
From Phase 1 onward, the application uses a two-tier hybrid canvas:
- **Base Canvas Layer (`<canvas>`)**: Hardware-accelerated 2D context
  dedicated to freehand strokes (pen, pencil, highlighter) using
  `perfect-freehand` for smooth 60fps rendering.
- **Overlay DOM/SVG Layer**: HTML and SVG elements positioned via CSS
  transforms matching viewport pan/zoom for editable textboxes, lasso
  selection outlines, transformation handles, and embedded widgets (e.g.
  Desmos).

### 2. Geometry Invariant: Canonical Points vs. Computed Bounding Box (`packages/shared`)
In `CanvasObjectBase`, `x`, `y`, `width`, and `height` serve as the
**computed axis-aligned bounding box (AABB)** used for spatial indexing
(R-Tree / spatial hash), hit-testing, and lasso intersection queries:
- On `StrokeObject`, `points` is the canonical geometric definition.
- On `LineObject` and `ArrowObject`, `(x1, y1)` and `(x2, y2)` are canonical.
- On `PolygonObject`, `points` is canonical.
Moving or resizing updates canonical geometry, and the bounding box is
derived/cached from those points, preventing drift between dimensions and
coordinates.

### 3. Deterministic Drawing & Diagram Engines (The "Desmos Pattern")
Asking an LLM to guess floating-point 2D coordinates for illustrations and
diagrams produces distorted, malformed results. Following the successful
pattern established for Desmos graphing:
- **Never use an LLM for spatial layout when a deterministic engine exists**
  (Architecture Principle 3).
- **Diagrams / Flowcharts / Mindmaps**: The AI extracts semantic structure
  (e.g. nodes, edges, labels, Mermaid/roughjs markup); a deterministic
  layout engine (such as dagre or elkjs) computes clean, readable coordinates.
- **Common Objects / Sketches ("draw a cat", "draw a microscope")**: The AI
  identifies the requested concept and maps to curated, deterministic vector
  sketch datasets (such as Google's QuickDraw stroke dataset or vector
  iconography like Lucide) rather than hallucinating raw pixel coordinates.
- **Direct Geometry**: The AI emits strict geometric primitives only when
  explicit parametric geometry is requested (e.g. math proofs, polygons).

### 4. Direct Multimodal AI Pipeline (`apps/backend`)
Rather than running an expensive, slow local OCR engine (e.g. Tesseract.js)
followed by a second LLM reasoning call, the backend sends a tightly cropped
canvas image snippet directly to a multimodal model (e.g. Gemini 1.5/2.0 Flash)
in a single request. This cuts latency to sub-second, eliminates multiple API
roundtrips, preserves critical visual context (arrows, fractions, math formulas),
and minimizes token cost. Cached OCR text is generated or updated during
idle/sync for search and summarization, rather than blocking real-time AI actions.

### 5. Granular Dirty-Flag Persistence & Batched Sync (`apps/frontend` & `apps/backend`)
To maintain 60fps responsiveness with 1,000–5,000 strokes on a page:
- IndexedDB stores individual canvas objects indexed by `id` and `pageId`,
  avoiding multi-megabyte document serialization on every stroke.
- Local mutations mark affected objects with a `dirty` flag.
- Cloud synchronization debounces and batches delta updates to Supabase
  instead of transmitting whole page trees.

## Final launch phase: production user handling

Phase 13 is the public-launch gate for a planned 250-1,000 concurrently
active users. Capacity is not inferred from account count or a local demo.
The technical requirements define staging workload ramps, a soak test,
latency/error targets, data-isolation/recovery checks, and a capacity/cost report.

Build toward stateless API instances, durable bounded AI queues, provider-aware
worker limits, pooled/indexed database access, and batched idempotent object
sync. Keep writing/local autosave independent of cloud and AI congestion.
Apply per-user quotas and explicit overload states, monitor without logging
private note contents, and verify backup/restore and deployment rollback.
Production capacity must be measured on the intended deployment before launch.

## What Phase 0 deliberately does not include

- No canvas rendering, no strokes, no notebooks — that's Phase 1 onward.
- No Supabase project or real database — the schema and connection are
  Phase 6.
- No AI provider wired up — `AIProvider`-shaped types exist in
  `packages/shared`, but no implementation exists until Phase 8/9.
- No CI pipeline configuration — not called for by the spec's Phase 0 exit
  criteria ("application starts, tests run, architecture is established"),
  but the `build`/`test`/`typecheck`/`lint` scripts are structured so a CI
  workflow can call them directly whenever one is added.

