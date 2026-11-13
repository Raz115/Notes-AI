# AI Handwritten Notes App — Technical Requirements Document

**Version:** 1.0  
**Status:** Engineering Baseline  
**Purpose:** Primary technical specification for implementation by Claude Code / Antigravity

---

# 1. Product Definition

The AI Handwritten Notes App is a desktop/laptop-first web application combining a GoodNotes-style handwriting canvas with an AI tutor that works directly inside the notebook.

The defining interaction is **not chat**.

The user writes on a page, selects or circles content, and invokes AI. The AI responds directly on the same page by writing, annotating, solving, drawing, graphing, or summarizing content.

The intended experience is:

> **A teacher/tutor sharing the notebook or whiteboard with the user, not a chatbot sitting beside it.**

AI is explicitly scoped as a contextual learning assistant. It is not an autonomous notebook-management agent.

---

# 2. Technical Objectives

The system shall:

1. Provide smooth desktop/laptop handwriting.
2. Store notes as structured canvas objects rather than flattened images.
3. Support notebooks, folders, pages, and cloud persistence.
4. Support offline note editing.
5. Allow AI requests directly from page content.
6. Minimize AI token usage and unnecessary API calls.
7. Render AI-generated content as native canvas objects.
8. Support simple AI-generated diagrams using structured drawing primitives.
9. Support graph generation through a graphing engine such as Desmos.
10. Keep AI output independently editable, movable, deletable, and undoable.
11. Maintain a clean separation between frontend rendering and backend AI/API responsibilities.
12. Be structured so tablet/stylus support can be added later without rewriting the canvas architecture.

---

# 3. Platform

## 3.1 Initial Platform

The first release shall target:

- Desktop browsers
- Laptop browsers
- Mouse/trackpad input
- Keyboard input

The canvas architecture shall remain compatible with future:

- Touch input
- Stylus input
- Pressure sensitivity
- Tablet layouts

Mobile-first optimization is not required for V1.

---

# 4. Recommended Technology Stack

## 4.1 Frontend

- React
- TypeScript
- Vite
- HTML/CSS
- Canvas-based rendering

## 4.2 Backend

Use a lightweight TypeScript backend/API layer.

The browser shall **not** contain the AI provider secret.

All AI provider requests shall be routed through the backend.

## 4.3 Database / Authentication

Use Supabase/Postgres for the initial implementation.

Supabase currently provides a free tier with Postgres, authentication-related infrastructure, storage, and usage quotas suitable for a prototype. citeturn0search0turn0search2

## 4.4 Local Persistence

Use IndexedDB for local notebook persistence.

Local persistence is required for:

- Offline editing
- Fast autosave
- Temporary sync queue
- Recovery from connection loss

## 4.5 Canvas / Stroke Rendering

Use an established stroke-rendering library rather than implementing a custom handwriting stroke engine.

The exact library shall be selected during implementation based on:

- React/TypeScript compatibility
- Pressure support
- Performance
- Active maintenance
- License
- Serialization compatibility

`perfect-freehand` is a candidate, not a hard dependency.

The rendering architecture shall be a **hybrid two-tier canvas stack**:
1. **Base Canvas Layer (`<canvas>`)**: Hardware-accelerated 2D context dedicated to high-frequency freehand strokes (pen, pencil, highlighter) for 60fps responsiveness.
2. **Overlay DOM/SVG Layer**: HTML and SVG elements positioned via CSS transforms matching viewport pan/zoom for interactive textboxes (`contentEditable`), lasso/selection bounding boxes, transform handles, and embedded widgets (e.g. Desmos).

## 4.6 AI Provider

The AI provider should be selected primarily on:

1. Multimodal capability
2. Structured output reliability
3. Token cost
4. Availability of a useful free/development tier
5. OCR/vision suitability
6. API stability

The application shall isolate the model behind an `AIProvider` interface so the model can be changed without rewriting the application.

As of September 2026, Google's Gemini API provides free-tier access for several models and substantially lower published token prices on paid tiers than Anthropic's listed Claude API prices for comparable usage categories. This makes Gemini a reasonable V1 cost-optimization candidate, while the provider abstraction keeps Claude or another provider available later. citeturn0search1turn0search4turn0search36

**Implementation decision:** begin with the lowest-cost suitable multimodal/structured-output provider available at implementation time, behind the provider abstraction.

Do not hard-code provider-specific assumptions throughout the application.

---

# 5. High-Level Architecture

```text
┌──────────────────────────────────────────────┐
│                  React Client                │
│                                              │
│  Dashboard                                   │
│  Notebook UI                                 │
│  Canvas                                      │
│  Tools                                       │
│  Selection                                   │
│  Local Persistence                           │
│  Sync Queue                                  │
└──────────────────────┬───────────────────────┘
                       │
                       │ HTTPS
                       ▼
┌──────────────────────────────────────────────┐
│                Application API               │
│                                              │
│  Authentication validation                  │
│  Notebook operations                         │
│  AI orchestration                            │
│  OCR orchestration                           │
│  Graph integration                            │
│  Rate limiting                               │
└───────────────┬─────────────────┬────────────┘
                │                 │
                ▼                 ▼
       ┌────────────────┐  ┌──────────────────┐
       │ Supabase       │  │ AI Provider      │
       │ PostgreSQL     │  │ Multimodal LLM   │
       │ Auth           │  │ Structured JSON  │
       │ Storage        │  └──────────────────┘
       └────────────────┘
                │
                ▼
       ┌────────────────┐
       │ IndexedDB      │
       │ Local cache    │
       │ Sync queue     │
       └────────────────┘
```

---

# 6. Core Data Model

Everything placed on the canvas shall be represented as a structured object.

## 6.1 Base Canvas Object

Every object shall have a common identity structure similar to:

```ts
interface CanvasObject {
  id: string;
  pageId: string;
  type: CanvasObjectType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  createdAt: string;
  updatedAt: string;
  source: "user" | "ai";
  groupId?: string;
}
```

The exact implementation may differ, but the architectural requirement is that objects are independently addressable.

**Geometry Invariant:** For path, stroke, line, and polygon objects, `x`, `y`, `width`, and `height` serve as the **computed axis-aligned bounding box (AABB)** used for spatial indexing (R-Tree / spatial hash) and lasso intersection queries. The canonical geometric definition is stored in `points` (for strokes/polygons) or `(x1, y1), (x2, y2)` (for lines/arrows). Transforming an object updates the canonical coordinates and recomputes the AABB.

---

# 7. Canvas Object Types

V1 shall support at minimum:

- Pen stroke
- Pencil stroke
- Highlighter stroke
- Textbox
- Rectangle
- Circle/ellipse
- Line
- Arrow
- Polygon
- Image
- Graph
- AI generation group

Future object types may include:

- Rich mathematical expressions
- Advanced diagram objects
- Embedded Desmos objects
- Tables
- Media

---

# 8. Coordinate System

Canvas objects shall use **page-relative coordinates**, not screen coordinates.

This is required for:

- Zoom
- Pan
- Persistence
- Export
- Device independence
- Future touch/stylus support
- Canvas resizing

The renderer converts page coordinates into screen coordinates based on the current viewport transform.

---

# 9. Page Model

Each notebook consists of ordered pages.

Each page shall have:

- Fixed paper dimensions
- Orientation
- Background/template
- Canvas objects
- Page ordering
- Creation/update timestamps

Supported page sizes:

- Letter
- A4
- Legal (8.5 x 14 inches)
- Cue card (4 x 6 inches)

Supported orientations:

- Portrait
- Landscape

The notebook creation flow determines the default page configuration.

Pages are displayed in a continuous vertical document view.
Scrolling downward 240 screen pixels beyond the last page adds and activates
a new page with the last page's paper settings. Only one page is added per
scroll gesture, preventing scroll inertia from creating unwanted pages.

---

# 10. Notebook Model

A notebook shall contain:

- Name
- Owner
- Ordered pages
- Folder location
- Pin state
- Creation timestamp
- Last modified timestamp
- Thumbnail information

Notebook operations:

- Create
- Rename
- Delete
- Duplicate
- Pin/unpin
- Move
- Open

---

# 11. Folder Model

Folders support:

- Create
- Rename
- Delete
- Move
- Nested folders
- Notebook containment

Notebook/folder movement shall support drag-and-drop.

---

# 12. Dashboard Requirements

The dashboard is the application's primary home screen.

It shall display:

- Folders
- Notebook thumbnails
- Notebook names
- New notebook tile
- Folder creation control
- Sync indicator
- Settings

Notebook thumbnails shall use a zoomed-out representation of the notebook's first page.

Pinned notebooks shall appear toward the top.

A new-notebook tile shall visually behave as a blank notebook and expose a plus icon on hover.

---

# 13. Notebook Creation

The notebook creation dialog shall collect:

- Notebook name
- Letter/A4/Legal/Cue card
- Portrait/landscape
- Page template

Initial templates include:

- Plain/black
- Lined
- Graph
- Beige lined/notepad style

---

# 14. Core Writing Tools

V1 shall include:

- Pen
- Pencil
- Highlighter
- Eraser
- Lasso
- Text
- Shape

---

# 15. Pen / Pencil / Highlighter

The writing tools shall support:

- Thickness
- Color
- Opacity

Holding the writing-tool control shall expose:

- Pen
- Pencil
- Highlighter

The color picker shall include:

- Common colors
- Recently used colors
- Approximately 15 recent colors
- Color wheel/custom picker

Thickness shall use a slider.

Opacity shall use a slider.

---

# 16. Eraser

Two eraser modes are required.

## 16.1 Partial Eraser

Removes the portions of strokes directly touched by the eraser.

The eraser has adjustable thickness.

## 16.2 Stroke Eraser

Touching a stroke removes the complete stroke.

The UI may represent this mode with the previously discussed playful "ninja with katana" icon.

---

# 17. Lasso Selection

The lasso shall select canvas objects/strokes.

Selected content shall support appropriate operations including:

- Move
- Resize
- Delete
- Copy
- Paste
- Change color where supported
- AI action

The lasso shall also be able to select typed textboxes.

---

# 18. Text Tool

V1 text formatting shall remain intentionally simple.

Supported:

- Two fonts
- Font size
- Bold
- Text color

Typed text shall be represented as an independent textbox object.

Textboxes shall:

- Be selectable with lasso
- Be movable
- Be resizable
- Be directly editable
- Support wrapping/reflow where appropriate

The application shall not introduce a full word processor in V1.

---

# 19. Manual Shape Tool

The shape system shall support basic shapes.

Examples:

- Circle
- Oval
- Rectangle
- Triangle
- Cube
- Arrow
- Straight line
- Curved line
- Diamond
- Rhombus
- Heart
- Pentagon
- Hexagon
- Star

The implementation should use deterministic geometry rather than an LLM for ordinary shape creation.

The main ribbon shall expose an icon-based shape picker. Closed shapes may be
hollow or solid, using the stroke color for solid fill. Users may adjust the
stroke width and opacity of selected shapes; lines and arrows do not have fill.

---

# 20. Shape Recognition

If the application provides freehand shape cleanup, it shall use local/deterministic recognition or a specialized library.

The LLM shall not be used for ordinary shape recognition.

Example:

```text
User draws rough circle
        ↓
Local recognition
        ↓
Clean circle
```

Undo must restore the user's original drawing.

---

# 21. Zoom and Viewport

The canvas shall support:

- Mouse-wheel zoom
- Visible zoom percentage
- Reset zoom
- Pan

The internal architecture shall leave room for future:

- Pinch zoom
- Touch pan
- Stylus input

---

# 22. Undo / Redo

Normal user operations shall remain granular.

Examples:

- Stroke → individual undo
- Object move → move undo
- Resize → resize undo
- Delete → delete undo

AI generation shall be atomic.

If AI creates:

- Five strokes
- Three shapes
- One textbox

all generated as one response, one undo shall remove the entire AI generation.

AI modifications to existing content shall also be grouped as one logical AI operation.

Undo must restore the user's prior state.

---

# 23. AI Interaction Model

The AI shall not use a conventional chat panel.

The interaction is:

```text
User writes
     ↓
User identifies content
     ↓
User activates AI
     ↓
AI interprets request
     ↓
AI generates result
     ↓
Result appears directly on page
```

The AI experience should feel like a teacher/tutor sharing the same whiteboard.

---

# 24. AI Selection Modes

Two AI input methods are required.

## 24.1 AI Circle

The user can circle handwritten content using the AI interaction.

Because users naturally write with a pen, the AI interaction should avoid requiring repeated switching to a separate lasso tool.

The circle interaction should:

1. Capture the user's loop.
2. Determine the selected region.
3. Identify objects/content inside the region.
4. Temporarily highlight/glow the selected area.
5. Expose the AI action.
6. Remove the temporary indicator after completion/failure.

The exact gesture recognizer shall tolerate imperfect handwriting.

## 24.2 Lasso → AI

If the user has already selected content with the lasso, the AI action shall be available contextually.

---

# 25. Normal Handwriting vs AI Circle

Normal handwriting circles should not automatically trigger AI.

AI selection behavior is associated with the AI interaction mode/context.

However, the system should tolerate imperfect handwritten circles when the user is intentionally using the AI interaction.

---

# 26. AI Action Determination

The AI shall automatically determine the requested action.

The user does not need to choose:

- Solve
- Explain
- Draw
- Summarize
- Graph

from a large command menu.

Written instructions take precedence.

Example:

```text
"Don't answer this. Just solve it."
```

The instruction is part of the selected AI context.

---

# 27. AI Context Pipeline

The system shall use a **direct multimodal pipeline with cropped visual context**.

For real-time handwriting and canvas requests:
- The system crops the canvas to the selected/circled region into a lightweight JPEG/WebP snippet.
- The cropped image and any extracted instruction text are dispatched to the multimodal AI provider in a single request.
- This avoids the multi-second latency, fragility, and duplicate token cost of running an explicit preliminary OCR pass before reasoning.
- Spatial relationships, diagrams, handwriting nuances, and mathematical formulas are accurately preserved in one shot.

The system shall crop strictly to the relevant selection bounding box rather than send an entire page image whenever possible, minimizing token payload.

---

# 28. OCR Strategy

OCR shall not run as a blocking pre-step for real-time AI canvas requests.

Instead, OCR (derived from multimodal AI responses or asynchronous background transcription during idle time) is used for:

- Local notebook search
- Summarization and topic indexing
- Exporting notes to plain text or markdown

Recognized text and confidence may be cached on handwriting objects:

```text
stroke data
recognized text
OCR confidence
```

This ensures search and indexing remain responsive without degrading interactive drawing and AI tutoring performance.

---

# 29. AI Provider Abstraction

The backend shall expose an internal AI interface rather than allowing application code to depend directly on one vendor.

Conceptually:

```ts
interface AIProvider {
  generateText(request: AIRequest): Promise<AIResponse>;
  generateStructuredOutput<T>(
    request: AIRequest,
    schema: Schema
  ): Promise<T>;
}
```

Provider implementations may include:

- Gemini
- Claude
- Future providers

The initial provider should be selected according to current cost/free-tier and multimodal/structured-output requirements.

The provider choice must be replaceable.

---

# 30. AI Backend Security

The browser shall never receive the provider's secret API key.

Requests shall flow through:

```text
Browser
   ↓
Authenticated backend
   ↓
AI provider
```

The backend shall validate the authenticated user before processing requests.

---

# 31. AI Structured Output

Drawing and diagram requests shall use structured semantic output rather than natural-language instructions or raw hallucinated floating-point coordinates.

The system adheres to **Architecture Principle 3: "Never use an LLM when deterministic logic is sufficient"** and applies the pattern established by the Desmos integration:

1. **Diagrams, Mindmaps, and Flowcharts**: The AI outputs semantic graph/node structures (e.g. Mermaid syntax or node/edge specifications); a deterministic layout engine (such as dagre, elkjs, or roughjs) calculates coordinates, arrows, and bounding boxes.
2. **Common Objects & Sketches ("draw a cat", "draw a beaker")**: The AI classifies user intent and selects from curated, deterministic vector sketch/icon libraries (such as Google's QuickDraw stroke dataset or vector iconography) rather than guessing arbitrary 2D polygon vertices.
3. **Direct Geometric Primitives**: For explicit geometric requests (e.g. coordinate geometry, geometric proofs), the AI emits strict parameterized primitives:

```json
{
  "type": "drawing",
  "objects": [
    {
      "type": "circle",
      "x": 100,
      "y": 120,
      "radius": 30
    },
    {
      "type": "line",
      "x1": 100,
      "y1": 150,
      "x2": 100,
      "y2": 220
    }
  ]
}
```

The client shall validate structured AI output before rendering it.

---

# 32. AI Drawing and Diagram System

AI drawing and diagram generation is a core differentiating feature.

The application translates structured drawing commands and diagram models into native canvas objects.

The AI is not expected to generate complex organic artwork from scratch.

Example:

> Draw a cat.

Expected strategy:

- Deterministic vector sketch/icon retrieval or parameterized geometric composition
- Minimalistic and recognizable
- Editable, movable, and undoable as native canvas objects

The application shall use established diagramming and vector libraries where practical rather than inventing a custom drawing layout engine.

---

# 33. AI Drawing Primitives & Vector Formats

Initial primitives and vector formats shall include:

- Line
- Circle
- Ellipse
- Rectangle
- Polygon
- Arrow
- Path
- Text
- Vector sketch / icon paths (e.g. QuickDraw stroke format or SVG path primitives)

These primitives can be combined into diagrams, flowcharts, or simple illustrations.

---

# 34. AI Drawing Validation

AI drawing output shall be validated before rendering.

Validation should verify:

- Supported object types
- Valid coordinates
- Valid dimensions
- Valid style values
- Reasonable object counts
- Valid page bounds where applicable

Invalid commands should not corrupt the canvas.

Because the user can undo the complete AI generation, the system should favor a safe complete-generation transaction rather than partially inserting unpredictable results.

---

# 35. AI Output Groups

One AI request creates one logical AI generation group.

Example:

```text
Generation
 ├── Text object
 ├── Circle
 ├── Arrow
 ├── Label
 └── Graph
```

The group can be:

- Moved
- Deleted
- Undone

as a logical unit where appropriate.

Individual child objects may still be accessible for editing when the UI supports it.

---

# 36. AI Output Placement

The placement algorithm shall:

1. Determine the source region.
2. Search for suitable nearby empty space.
3. Prefer placing output close to the source.
4. Avoid unrelated content where possible.
5. Permit overlap when no suitable space exists.

AI output may overlap existing content.

Overlap must never imply deletion of the underlying content.

---

# 37. AI Modification Rules

AI may modify or annotate existing content when the operation is directly relevant to the user's request.

Examples:

- Fill in a blank
- Add an answer to a diagram
- Add labels
- Circle/highlight an answer
- Add arrows
- Write a result over a relevant diagram

AI shall not modify unrelated content.

Default scope:

> AI may modify content inside the selected region, or content directly required by the selected task.

---

# 38. AI Deletion

AI shall not delete existing user content in V1.

Users remain responsible for deletion.

This provides a strong safety boundary around original notes.

---

# 39. AI Response Types

The system shall support at minimum:

## Written Answer

Place concise answer near the relevant content.

## Multiple Choice

Visually identify the selected answer.

## Fill in the Blank

Place the result into the appropriate blank when possible.

## Identify

Mark/circle the relevant item.

## Diagram

Generate native vector objects.

## Explanation

Write a concise explanation on the page.

## Summary

Generate a concise summary in a suitable page region.

## Graph

Normalize the mathematical request and pass it to the graphing engine.

---

# 40. AI Response Length

Responses shall be concise by default.

The system should avoid generating unnecessarily long text that clutters the notebook.

Longer output is allowed when:

- User explicitly asks for detail
- The problem requires explanation
- A summary genuinely requires more information

---

# 41. AI Streaming

Text responses shall be rendered only after the complete AI response is available.

This keeps canvas placement deterministic and avoids partially positioned text blocks.

Drawing output shall also render as a complete generation.

---

# 42. AI Loading State

While AI is processing:

- The selected region remains visually identified.
- A loading state appears near the selection.
- A calculator character may display a thinking/calculation animation.

When complete:

- Loading state disappears.
- AI result appears.
- Temporary selection glow disappears.

---

# 43. AI Cancellation

The user shall be able to cancel an active AI request.

Cancellation shall:

- Stop the request where supported.
- Prevent incomplete output from being committed.
- Return the canvas to a normal state.
- Clear the temporary loading state.

---

# 44. AI Failure

If AI processing fails:

1. Remove the temporary selection glow.
2. Restore normal canvas appearance.
3. Show the calculator character's failure state.
4. Do not insert incomplete AI content.
5. Allow the user to retry using the normal AI workflow.

A dedicated Retry button is not required for V1.

---

# 45. AI Cooldown / Rate Limiting

The system shall prevent accidental repeated submissions.

Requirements:

- Only one active request for a given AI interaction.
- Disable duplicate submission while processing.
- Backend rate limiting.
- Per-user usage controls.
- Safe cancellation behavior.

Exact numerical limits shall be configurable rather than hard-coded into the UI.

---

# 46. Token and Cost Optimization

Token efficiency is a first-class technical requirement.

The system shall avoid sending:

- Entire notebooks unnecessarily
- Entire pages when only a region is relevant
- Repeated OCR results when cached
- Drawing metadata irrelevant to the current request
- Application metadata that the model does not need
- Long conversation histories for independent notebook actions

The system should prefer:

```text
smallest sufficient context
        +
cached local information
        +
deterministic processing
        +
one AI request where possible
```

Examples:

### Shape cleanup

No AI request.

### Graph generation

One AI interpretation request → deterministic graph engine.

### OCR

Cache recognized text.

### AI answer

Selected text first → visual context only when required.

---

# 47. Graphing / Desmos

The graphing architecture shall use a dedicated graphing engine.

Preferred V1 workflow:

```text
Handwritten request
       ↓
OCR / visual understanding
       ↓
AI normalizes mathematical intent
       ↓
Normalized expression
       ↓
Graphing engine
       ↓
Graph inserted into canvas
```

AI should not manually approximate mathematical graphs using drawing primitives when a graphing engine can generate the result accurately.

---

# 48. Graph Representation

V1 graphs shall be represented as static canvas content with sufficient metadata to support future editing.

The system should retain the normalized mathematical expression internally.

Future versions may make graph objects reopenable/editable through Desmos or another graphing interface.

---

# 49. Summarization

Summarization shall use the same contextual AI model as other AI interactions.

Default:

- Selected content → summary

If there is no explicit selection:

- Use relevant current-page/topic context.

If the user explicitly requests notebook-wide summarization:

- Search/index notebook content.
- Retrieve relevant recognized text.
- Send only the necessary context to AI.

The entire notebook should not be blindly sent to the model.

---

# 50. Search

Search shall support recognized content from:

- Handwriting
- Typed text
- AI-generated text

Search indexing should reuse cached OCR rather than triggering fresh OCR for every query.

---

# 51. Authentication

V1 authentication shall support:

- Email/username
- Password

Authenticated users shall be associated with their notebooks and pages.

---

# 52. Data Ownership

Every notebook shall belong to an authenticated user.

Pages and objects shall be associated with the owning notebook/user through the database relationship.

Users shall not be able to access another user's notebook data.

Future sharing/collaboration may introduce controlled access.

---

# 53. Local Persistence

IndexedDB shall provide the local source for active editing.

Local persistence shall support:

- Fast autosave
- Offline operation
- Browser refresh recovery
- Sync queue
- Local notebook cache

**Granular Storage Architecture:** IndexedDB shall store individual canvas objects indexed by `id` and `pageId` with a `dirty` flag, rather than serializing the entire multi-megabyte page tree on every stroke.

The canvas should not wait for a network request before considering a local edit saved.

---

# 54. Cloud Persistence

Supabase/Postgres shall store:

- Users/auth relationships
- Notebooks
- Folders
- Pages
- Canvas objects
- AI generation metadata
- Relevant OCR metadata
- Graph metadata

The database shall store structured canvas data rather than only page screenshots.

---

# 55. Synchronization

V1 shall use a simple owner-only synchronization model.

Recommended flow:

```text
User edit
   ↓
IndexedDB
   ↓
Sync queue
   ↓
Backend
   ↓
Postgres
```

Synchronization should use last-write-wins for V1.

More advanced conflict resolution is a future consideration.

---

# 56. Offline Mode

The core editor shall remain functional without network connectivity.

Offline functionality:

- Write
- Draw
- Erase
- Select
- Move
- Resize
- Undo/redo
- Page navigation
- Notebook management where locally available

Network-dependent functionality:

- AI
- Cloud synchronization
- Remote authentication operations

Pending changes shall synchronize when connectivity returns.

---

# 57. Autosave

Local changes shall be persisted rapidly.

Cloud synchronization shall be debounced/batched rather than writing to the database for every individual pen event.

This is especially important for handwriting because a single writing action can produce many pointer events.

---

# 58. Sync Indicator

The dashboard/toolbar shall expose synchronization state.

States:

- Green: synchronized
- Partial/half green: synchronization in progress
- Red: synchronization problem

The indicator should not interrupt normal writing.

---

# 59. PDF Export

V1 shall support PDF export.

Export shall preserve:

- Page order
- Page dimensions
- Background/template
- User handwriting
- Typed text
- AI-generated content
- Diagrams
- Graphs

Default filename:

> Notebook name

Users should be able to export:

- Entire notebook
- Selected pages

---

# 60. Performance Requirements

The application should remain responsive with large pages containing thousands of canvas objects/strokes.

Initial engineering target:

- At least 1,000–5,000 strokes/objects on a page without obvious interaction degradation.

Performance techniques should include:

- Viewport culling where useful
- Efficient object indexing
- Batched rendering
- Debounced persistence
- Avoiding unnecessary React re-renders
- Separation of canvas state from UI state

The exact benchmark shall be established during implementation testing.

---

# 61. Canvas Rendering Architecture

Canvas rendering state should not be managed entirely through ordinary React component re-rendering.

React should manage application/UI state.

The application uses a **two-tier hybrid canvas architecture**:
- **Base Canvas Layer (`<canvas>`)**: Dedicated 2D canvas context that independently manages fast continuous pointer events and stroke rasterization at 60fps.
- **Overlay DOM/SVG Layer**: React/DOM/SVG layer that handles interactive textboxes, selection lasso hulls, transform handles, and third-party widgets (Desmos) with native browser focus, selection, and accessibility.

This separation is important for:

- High-frequency pointer events
- Smooth strokes
- Large notebooks
- Zoom/pan
- Object manipulation

---

# 62. Input Handling

Pointer events should be abstracted behind an input layer so future devices can be supported.

Conceptual input types:

```text
Mouse
Trackpad
Touch
Stylus
```

V1 implementation may focus on mouse/trackpad while preserving this abstraction.

---

# 63. Error Handling

The application shall handle failures without corrupting the notebook.

Examples:

- AI failure
- Network failure
- Sync failure
- Invalid AI output
- OCR failure
- Graphing failure
- Database failure

Core notebook editing should remain available whenever possible.

AI/network errors must not destroy unsaved local work.

---

# 64. Testing Strategy

The project shall use comprehensive automated testing.

Required layers:

## Unit Tests

For:

- Geometry
- Shape recognition
- Selection
- Coordinate transformations
- Object manipulation
- Drawing command validation
- Placement logic
- Sync queue logic
- Serialization

## Integration Tests

For:

- Authentication
- Database persistence
- AI request pipeline
- OCR pipeline
- Graph pipeline
- Local/cloud synchronization

## End-to-End Tests

For critical workflows:

```text
Create account
→ Create notebook
→ Write
→ Save
→ Reload
→ Select
→ AI request
→ Render output
→ Undo
```

---

# 65. AI Testing

AI tests shall not depend on exact model wording.

Instead, test:

- Schema validity
- Required fields
- Supported drawing commands
- Output type
- Object count limits
- Error handling
- Context construction
- Provider failures
- Cancellation
- Token/context limits

Fixtures should represent expected categories of AI behavior.

Example:

```text
Input:
"Draw a triangle."

Expected:
valid structured drawing response containing
triangle-compatible primitives.
```

---

# 66. Development Workflow

The application shall be built **phase-by-phase**.

An implementation phase is not complete until:

1. Feature is implemented.
2. Relevant tests pass.
3. Existing functionality remains intact.
4. Errors are resolved.
5. Documentation is updated.
6. Acceptance criteria are verified.
7. The agent reports what changed.

Claude Code / Antigravity may make normal implementation decisions independently when those decisions remain inside this architecture.

The agent should ask for human input when a decision would materially change:

- Architecture
- Product behavior
- Security
- Data model
- AI provider strategy
- Major dependency direction

---

# 67. Phase Plan

## Phase 0 — Repository Foundation

Create:

- React/TypeScript project
- Frontend/backend separation
- Linting
- Formatting
- Testing
- Environment configuration
- Project documentation

**Exit criteria:** application starts, tests run, architecture is established.

---

## Phase 1 — Canvas Foundation

Implement:

- Page coordinate system
- Canvas viewport
- Pan
- Zoom
- Basic stroke rendering
- Pointer input

**Exit criteria:** smooth writing on a fixed-size page.

---

## Phase 2 — Writing Tools

Implement:

- Pen
- Pencil
- Highlighter
- Eraser
- Stroke eraser
- Color
- Thickness
- Opacity
- Undo/redo

**Exit criteria:** reliable core handwriting experience.

---

## Phase 3 — Objects and Selection

Implement:

- Canvas object model
- Lasso
- Move
- Resize
- Delete
- Copy/paste
- Textbox
- Shapes
- Shape recognition/cleanup

**Exit criteria:** page content behaves as structured editable objects.

---

## Phase 4 — Pages and Notebooks

Implement:

- Multiple pages
- Continuous vertical scrolling
- Notebook creation
- Notebook management
- Folders
- Nested folders
- Dashboard
- Thumbnails
- Pinning

**Exit criteria:** complete local notebook experience.

---

## Phase 5 — Local Persistence

Implement:

- IndexedDB
- Autosave
- Recovery
- Serialization/deserialization
- Local sync queue

**Exit criteria:** browser refresh/offline editing does not lose local work.

---

## Phase 6 — Authentication and Cloud

Implement:

- Supabase authentication
- Database schema
- User ownership
- Notebook persistence
- Page/object persistence
- Sync
- Sync indicator

**Exit criteria:** user can sign in and access notebooks across sessions/devices.

---

## Phase 7 — AI Selection

Implement:

- AI circle mode
- Imperfect loop detection
- Selected-region identification
- Temporary glow
- Contextual AI action
- Loading state
- Cancellation

**Exit criteria:** user can circle handwritten content and initiate AI without a chat panel.

---

## Phase 8 — AI Answering

Implement:

- Backend AI provider
- OCR/cache
- Context construction
- Text-first request
- Visual escalation
- Structured response
- Canvas text output
- Placement algorithm
- AI generation groups
- Atomic undo

**Exit criteria:** user can write a question, circle it, invoke AI, and receive an answer directly on the page.

---

## Phase 9 — AI Drawing

Implement:

- Drawing command schema
- Structured output
- Validation
- Primitive renderer
- AI generation groups
- Simple diagrams
- Simple illustrations
- Error handling

**Exit criteria:** user can request something such as "draw a cat" and receive a minimal native canvas drawing.

---

## Phase 10 — Graphing

Implement:

- Graph request interpretation
- Mathematical normalization
- Graphing-engine integration
- Graph rendering
- Expression metadata

**Exit criteria:** user can request a function/graph and receive an accurate graph on the page.

---

## Phase 11 — Summarization and Search

Implement:

- OCR indexing
- Selected-content summaries
- Topic summaries
- Notebook search
- Notebook-wide summarization
- Context retrieval

**Exit criteria:** AI can summarize relevant notes without blindly sending the entire notebook.

---

## Phase 12 — Export and Polish

Implement:

- PDF export
- Improved UI
- Error states
- Performance optimization
- Loading states
- Settings
- Onboarding

**Exit criteria:** presentable demo-ready application.

---

## Phase 13 — Production User Handling and Load Readiness

Prepare the application for public launch with a target of **250-1,000
concurrently active users**, not merely that many registered accounts.
Use 250 users as the baseline, 500 as an intermediate ramp, and 1,000 as
the peak target. This is a capacity requirement to verify, not a statement
that the current implementation already supports this load.

Implement and validate:

- Reliable account/session handling under load: sign-in, token refresh,
  expiration, logout, and strictly user-scoped notebook access.
- Stateless, horizontally scalable API instances. Keep durable sync and AI
  job state outside an individual API process.
- Indexed, paginated user/notebook/page queries and appropriately pooled
  database connections. Cache only where ownership and invalidation remain safe.
- Debounced, batched object-delta sync with bounded retries, backoff/jitter,
  and idempotent writes. Reconnection must not lose or duplicate notes.
- Bounded AI/background queues, worker concurrency limits, per-user fairness,
  and provider-aware rate limits. A slow AI provider must not block drawing,
  local autosave, or ordinary notebook synchronization.
- Per-user quotas and global request/concurrency limits, including AI usage,
  uploads, and exports. Return explicit overload/rate-limit states, such as
  HTTP 429 with retry guidance; do not silently drop work or retry indefinitely.
- Production monitoring for latency, errors, database pressure, queue depth,
  sync failures, and AI cost. Do not log note contents, credentials, or tokens.
- Capacity/cost budgets, backup and restore verification, health/readiness
  checks, and a documented deployment rollback procedure.

### Load validation

Use synthetic accounts and notes in staging, not live user data. Document
the workload before running tests: active writing percentage, objects per
page, autosave/sync frequency, notebook reads, login/refresh activity,
reconnections, and AI requests per user per minute. Do not model every
active user as continuously making an AI request.

Run a mixed-workload ramp at 250, 500, and 1,000 concurrent users for at
least 30 minutes at each level, followed by a two-hour soak at the 1,000-user
target. Include an overload spike and recovery test. Isolate infrastructure
tests from paid AI calls using controlled provider simulations, then verify
real provider latency, quotas, and costs separately within an approved budget.

Launch gates:

- Non-AI interactive API reads/writes have p95 latency at or below 500 ms
  under the defined workload. Measure AI, bulk import/export, and external
  authentication latency separately rather than hiding them in this metric.
- Unexpected server errors/timeouts remain below 1% of requests at each
  target load. Report intentional throttling separately.
- No acknowledged note changes are lost, duplicated, or exposed to another
  user; offline reconnection and restore tests pass.
- Writing remains responsive on a documented representative browser/device
  and page workload, targeting 60 fps; cloud/AI pressure must not stall input.
- Queue depth, memory use, database connections, and provider concurrency stay
  within documented bounds. Queues recover after a spike without starving users.
- The load-test report records deployment sizing, workload, p50/p95/p99 latency,
  error rates, recovery behavior, and projected infrastructure/AI costs.

**Exit criteria:** staging evidence demonstrates the 250-1,000-user target
within the launch gates and budget, and operations/recovery procedures are
ready before the application goes live.

---

# 68. Definition of Done

A feature is complete only when:

- Functional requirements are implemented.
- UI behavior matches the requirements.
- Relevant tests exist.
- Tests pass.
- Offline/local behavior is preserved where applicable.
- No existing core feature is broken.
- Error states are handled.
- Documentation is updated.
- Code is modular and maintainable.

---

# 69. Explicit Non-Goals for V1

The following shall not become scope creep:

- Autonomous notebook management
- Chat-first AI interface
- Real-time collaboration
- Mobile-first optimization
- Highly detailed AI artwork
- AI-powered basic shape recognition
- AI deletion of user notes
- Full word-processing functionality
- Advanced multi-user conflict resolution
- Excessive formatting controls
- Unnecessary AI calls

---

# 70. Future Considerations

## Device Support

- Tablet
- Stylus
- Pressure sensitivity
- Touch gestures
- Mobile

## Collaboration

- Shared notebooks
- Real-time collaboration
- Multi-user editing
- Presence
- Conflict resolution

## AI

- More advanced retrieval
- Better contextual memory
- Advanced diagrams
- More sophisticated graphing
- Additional providers
- Model routing
- Cost-aware model selection

## Canvas

- Advanced shape editing
- Smart diagram connectors
- Tables
- Rich mathematical objects

## Export

- PNG/JPEG
- Additional document formats
- Shareable links

---

# 71. Architecture Principles

1. **Use libraries for solved problems.**
2. **Build custom systems where the product differentiates itself.**
3. **Never use an LLM when deterministic logic is sufficient.**
4. **Keep AI output structured.**
5. **Keep AI provider logic behind an abstraction.**
6. **Keep the canvas object model independent of the AI provider.**
7. **Store structured notebook data rather than only screenshots.**
8. **Persist locally before relying on the network.**
9. **Keep AI output reversible.**
10. **Protect user-created content from destructive AI behavior.**
11. **Minimize AI context and token usage.**
12. **Build desktop-first without architecting away future stylus/touch support.**
13. **Treat the notebook canvas as the primary interface.**
14. **The AI should feel like a tutor sharing the user's whiteboard, not a chatbot.**

---

# 72. Primary Acceptance Scenario

The complete system should eventually support the following demonstration:

```text
User signs in
      ↓
Dashboard
      ↓
Creates notebook
      ↓
Chooses A4 portrait
      ↓
Opens page
      ↓
Writes a question
      ↓
Circles the question with AI interaction
      ↓
AI selection glows
      ↓
User activates AI
      ↓
Calculator character shows processing
      ↓
Backend determines minimal required context
      ↓
AI interprets request
      ↓
Answer is generated
      ↓
Answer appears directly on page
      ↓
User moves/edits result
      ↓
User presses Undo
      ↓
Entire AI generation disappears
      ↓
Original handwritten page is restored
```

This scenario represents the core product experience and should remain functional throughout development.

---

# 73. Engineering Priority

When trade-offs occur, prioritize in this order:

1. Correctness
2. Smooth handwriting/canvas interaction
3. User data safety
4. AI reliability
5. Token/cost efficiency
6. Performance
7. Maintainability
8. Visual polish
9. Future extensibility

Do not sacrifice the core canvas experience for secondary features.

