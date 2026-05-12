# ADR-344: DXF Enterprise Text Engine (Autodesk-Grade Text Creation & Editing Suite)

- **Status**: ✅ FULLY APPROVED — All design decisions (Q1-Q17) confirmed by Giorgio 2026-05-11. Ready for Phase 0 kickoff.
- **Date**: 2026-05-11
- **Scope**: `src/subapps/dxf-viewer/`
- **Related ADRs**: ADR-026 (DXF Toolbar Colors), ADR-031 (Command Pattern Undo/Redo), ADR-040 (Preview Canvas Performance), ADR-042 (UI Fonts Centralization), ADR-050 (Unified Toolbar Integration), ADR-082 (Number Formatting), ADR-091 (Fonts Centralization), ADR-001 (Select/Dropdown Component)
- **License constraint**: MIT / Apache 2.0 / BSD ONLY (CLAUDE.md N.5). NO GPL / LGPL / AGPL / MPL / proprietary.

---

## 1. Context

Giorgio wants a **complete enterprise text creation/editing suite** integrated into the DXF viewer, equivalent in capability to AutoCAD's MTEXT/TEXT editor. Scope is total:

1. **CAD-native annotations** — DXF `TEXT` and `MTEXT` entities with full inline formatting codes
2. **Rich-text WYSIWYG overlay** — bold/italic/font/size/color/alignment/lists with familiar UX
3. **Data-driven dynamic labels** — text bound to entities (room labels, dimensions, callouts)
4. **Enterprise stamps & title blocks** — revision tables, watermarks, ISO/ANSI title blocks

**Hard constraints**:
- 100% free OSS, MIT/Apache/BSD licenses only (Giorgio: "ΘΕΛΩ ΝΑ ΕΙΝΑΙ ΔΩΡΕΑΝ ΠΛΗΡΩΣ ΚΑΙ ΧΩΡΙΣ ΚΑΜΙΑ ΔΕΣΜΕΥΣΗ")
- Autodesk-grade quality (GOL — CLAUDE.md N.7)
- Single Source of Truth (SSOT — CLAUDE.md N.0)
- Integrates with existing FloatingPanelContainer, CommandHistory, ServiceRegistry, Zustand stores
- Canvas 2D primary stack (existing renderer in `canvas-v2/`)

---

## 2. Research Summary (2026-05-11)

Four parallel deep-dive agents researched the OSS landscape. Full findings preserved in §10 (Appendices). Top-level conclusions:

### 2.1 Rich Text Editor — Winner: **TipTap v3** (MIT)
- All 8 formerly-Pro extensions open-sourced June 2026 → zero paywalls on editor features
- 56 KB gzip, headless (canvas-friendly), 36.7k★, first-class TS, React 19 ready
- JSON document model serializes cleanly to MTEXT inline codes
- Yjs collaboration ready (`y-prosemirror`, MIT) for future multi-user CAD editing
- Disqualified: **BlockNote** (MPL-2.0), **Draft.js** (dead), **tldraw** (proprietary $6K/year)

### 2.2 DXF MTEXT Parsing — **DIY tokenizer required**
- The only dedicated JS MTEXT inline parser (`@dxfom/mtext`) is **GPL-3.0 → blocked**
- `dxf-parser` (MIT) handles entities + basic structure but not inline codes
- Custom MTEXT tokenizer is ~200-300 lines TypeScript over a documented grammar (`\F`, `\H`, `\C`, `\W`, `\Q`, `\T`, `\L`, `\O`, `\K`, `\S`, `\A`, `\P`, `\p`, `%%c`, `%%d`, `%%p`, `\U+XXXX`)
- Reference implementation: **ezdxf** (Python, MIT) — read its code for spec clarification

### 2.3 Font Engine — Winner: **opentype.js** (MIT)
- TTF/OTF/WOFF/WOFF2 → glyph bezier paths → Canvas 2D `ctx.fill(Path2D)`
- **Resolution-independent at any zoom** — paths are vectorial, no SDF needed for Canvas 2D
- v2.0.0 May 2026, 5K★, zero deps, ~60 KB gzip
- Optional: `harfbuzzjs` (MIT, WASM) for complex script shaping (Arabic, ligatures)
- Optional: `fontkit` (MIT) for richer OT features / variable fonts

### 2.4 SHX Font Handling — **No drop-in OSS solution**
- Need either: (a) ship pre-converted SHX→TTF, (b) write SHP parser (~400 lines), (c) substitute open equivalents (ISOCPEUR → ISO 3098 open font; romans → simplex stroke)
- LibreCAD's LFF font format is open and stroke-based — usable as fallback

### 2.5 Canvas Text Editing UX — Two viable paths

**Path A — Fast delivery, acceptable tradeoffs**: **Fabric.js 7.x** (MIT)
- Only mainstream library with true in-canvas text editing (cursor/selection/keyboard on `<canvas>`)
- Working integration in ~1 day; rasterizes (soft at extreme zoom unless `fontSize × zoom` workaround)
- Performance regression vs v5 with 1000+ text objects (~209ms/batch)
- No official React wrapper — imperative integration pattern

**Path B — Best-in-class, longer build**: **opentype.js + custom editor layer**
- Render glyphs as `Path2D` (zoom-perfect)
- Build cursor blink, selection rect, keyboard handler ourselves (~4-6 weeks)
- Reference implementations to study: **canvas-editor** (Hufe921, MIT, 4.9k★), **carota** (MIT)
- Pattern: invisible zero-size `<textarea>` as IME/keyboard sink, all visual elements on canvas

### 2.6 Toolbar UX — Stack already aligned with project
- **Radix UI Toolbar + ToggleGroup + Select** (already used per ADR-001)
- **react-colorful** (MIT, 2.8KB) + ACI 256-color static palette for `DxfColor` union
- **shadcn/ui Combobox** (`cmdk`) for font family picker with search
- **zundo** (MIT, <700 bytes) — Zustand temporal middleware, integrates with existing CommandHistory
- Pattern: indeterminate state via `data-state="indeterminate"` + `MixedValue<T>` type (Figma/Illustrator UX convention)

---

## 3. Decision (PROPOSED — pending Giorgio's confirmation)

### 3.1 Architectural Stack (5 Layers)

```
LAYER 5 — Editing UI (React/Zustand/Radix UI)
   └─ TextToolbar (ribbon overlay during edit) + Text Properties panel (FloatingPanel tab)
   └─ Color/Font/Justification/Size/Bold/Italic/Underline/Overline/Strike/Background/Columns
LAYER 4 — Edit Engine (TipTap v3 headless OR custom canvas-native)
   └─ TipTap JSON ↔ MTEXT inline codes serializer (custom, ~300 lines)
LAYER 3 — Layout Engine (custom, build)
   └─ Line-breaking (UAX #14), paragraph formatting, columns, stacking, attachment-point anchoring
LAYER 2 — Font Engine (opentype.js + harfbuzzjs + custom SHP/SHX adapter)
   └─ TTF/OTF/WOFF → Path2D glyph paths, SHX → stroke vectors, font substitution table
LAYER 1 — DXF I/O
   └─ dxf-parser (MIT) + custom STYLE table reader + custom MTEXT inline code tokenizer
```

### 3.2 SSoT Modules

All new modules registered in `.ssot-registry.json` under Tier 4 (`dxf-text-engine`):

| Module | Path | Responsibility | Added in |
|---|---|---|---|
| `mtext-parser` | `src/subapps/dxf-viewer/text-engine/parser/` | DXF MTEXT/TEXT entity → AST | Core |
| `mtext-serializer` | `src/subapps/dxf-viewer/text-engine/serializer/` | AST → MTEXT inline codes | Core |
| `font-engine` | `src/subapps/dxf-viewer/text-engine/fonts/` | Glyph paths, font cache, substitution | Core |
| `shx-parser` | `src/subapps/dxf-viewer/text-engine/fonts/shx-parser/` | SHP stroke-vector playback (~400 lines) | Q3 |
| `text-layout` | `src/subapps/dxf-viewer/text-engine/layout/` | Line-break, columns, attachment-point | Core |
| `text-renderer` | `src/subapps/dxf-viewer/text-engine/render/` | Canvas 2D Path2D rendering | Core |
| `text-toolbar` | `src/subapps/dxf-viewer/ui/text-toolbar/` | Ribbon UI + state | Core |
| `text-commands` | `src/subapps/dxf-viewer/core/commands/text/` | ICommand impl (UpdateTextStyle, etc.) | Core |
| `text-types` | `src/subapps/dxf-viewer/text-engine/types/` | DxfColor, MixedValue, TextNode AST types | Core |
| `text-collab` | `src/subapps/dxf-viewer/text-engine/collab/` | Yjs Y.Doc/Y.Text binding + y-websocket auth | Q4 |
| `text-templates` | `src/subapps/dxf-viewer/text-engine/templates/` | TS defaults + Firestore resolver + placeholder engine | Q5 |
| `text-spell` | `src/subapps/dxf-viewer/text-engine/spell/` | nspell worker + custom dictionary CRUD | Q6 |
| `text-draft` | `src/subapps/dxf-viewer/text-engine/draft/` | IndexedDB auto-save + crash recovery service | Q15 |
| `text-ai` | `src/subapps/dxf-viewer/text-engine/ai/` | NL → text command router (ADR-185 + ADR-156) | Q16 |
| `viewport-system` | `src/subapps/dxf-viewer/systems/viewport/` | ViewportStore + ViewportContext for annotative scaling | Q11 |

### 3.3 State Architecture

- `useTextToolbarStore` (Zustand) — current toolbar values (pending edits)
- `useTextSelectionStore` (Zustand) — selected text entity IDs + computed mixed values
- `useTextEditingStore` (Zustand) — live edit session (preview state before commit)
- All mutations flow through `CommandHistory` (ADR-031) via new text commands

### 3.4 Toolbar Modality

- **During text editing** (active TEXT/MTEXT tool): full ribbon overlay above canvas (CSS `position: fixed`, z-index above panels)
- **After selecting existing text**: subset shown as "Text Properties" tab in `FloatingPanelContainer`
- Pattern mirrors AutoCAD ribbon contextual tab + Properties palette

---

## 4. OPEN DESIGN QUESTIONS (Giorgio must decide before implementation)

The following decisions cannot be made by the agent alone. They shape the entire build effort. **One question at a time, in Greek, per feedback memory.**

### Q1 — Edit Engine: TipTap v3 (fast) vs Custom Canvas-Native (best quality)?
- **TipTap v3**: ~1 day integration, contenteditable overlay positioned on canvas during edit, ~56 KB
- **Custom canvas-native**: ~4-6 weeks, true in-canvas cursor/selection, zoom-perfect, no DOM overlay quirks
- **Trade-off**: time vs UX purity at extreme zoom

**✅ DECISION (2026-05-11, Giorgio)**: **Path A — TipTap v3**.
- Rationale: ship in days, not weeks. Standard architectural CAD zoom range (1:1 to 1:200) where overlay rasterization is invisible. Soft-text-during-edit at extreme zoom (1:1000+) is acceptable tradeoff.
- Implementation note: TipTap mounts as floating overlay positioned over canvas during edit only. On commit, text serializes to DxfTextNode AST and renders via Layer 2-3 vector glyph paths (opentype.js → Path2D) — final rendering is **always zoom-perfect**, only the live-edit phase uses contenteditable.
- Phase 4 estimate locked at **~2 days** (vs 4-6 weeks for canvas-native).

### Q2 — Initial DXF compatibility scope: TEXT only, MTEXT only, or both from day 1?
- Both = larger surface area, more parsing/serializing work
- TEXT-only = simpler, single-line, no inline codes
- MTEXT-only = the richer surface, but more complex

**✅ DECISION (2026-05-11, Giorgio)**: **Both TEXT + MTEXT from day 1**.
- Rationale: full compatibility with any third-party DXF file from external offices. Real-world DXF files mix both entity types — partial support would break round-trip integrity.
- Scope: Layer 1 parser handles both `AcDbText` and `AcDbMText` entity types. Serializer emits correct entity per DxfTextNode complexity (single run + no formatting → TEXT; otherwise MTEXT).
- Phase 1 estimate locked at **~5-6 days** (TEXT + MTEXT + STYLE table + MTEXT inline tokenizer).

### Q3 — SHX font support: drop, substitute, or full SHP parser?
- **Drop**: TTF/OTF only, error on SHX files
- **Substitute**: map common SHX (romans, ISOCPEUR, txt, simplex) → open equivalents (LFF/TTF)
- **Full parser**: implement SHP stroke playback (~400 lines, complete AutoCAD compatibility)

**✅ DECISION (2026-05-11, Giorgio)**: **Full SHP parser (enterprise-grade)**.
- Rationale: Greek architectural firms heavily use ISOCPEUR.shx and romans.shx. Drop = unusable for real-world DXF. Substitution = visible glyph drift breaks dimension boxes. Only full parser gives AutoCAD-identical rendering.
- Implementation: native SHP stroke-vector playback in TypeScript (~400 lines). Bundle common open SHX-equivalents (LibreCAD LFF fonts) as fallback when SHX file is missing from the user's font directory.
- New module: `src/subapps/dxf-viewer/text-engine/fonts/shx-parser/` — registered in `.ssot-registry.json` Tier 4.
- Phase 2 estimate revised to **~5-6 days** (opentype.js + SHX parser + font cache + substitution table).

### Q4 — Collaborative editing (Yjs) day 1 or deferred?
- Day 1: architect with Y.Doc/Y.Text from the start (correct, slightly more code)
- Deferred: single-user first, Yjs retrofit when needed (faster MVP — but Giorgio explicit "no MVP" per memory)

**✅ DECISION (2026-05-11, Giorgio)**: **Day 1 — collaborative editing built in from start**.
- Rationale: aligns with `completeness over MVP` (memory: feedback_completeness_over_mvp). Future-proof for multi-architect teams. Avoids costly retrofit (5-7 days) later.
- Stack: **Yjs** (MIT) + `y-prosemirror` (MIT, integrates with TipTap) + `y-websocket` (MIT, self-hostable) — fully free, zero proprietary dependencies.
- Architecture: DxfTextNode AST mirrors a `Y.Map`, text runs use `Y.Text`. Yjs observer drives canvas re-render. Same architecture supports later expansion to full DXF entity collaboration (not just text).
- New infra: self-hosted `y-websocket` server (~100 lines Node.js, runs on Vercel Edge or Cloud Run). Auth via existing Firebase Auth token validation.
- New modules: `src/subapps/dxf-viewer/text-engine/collab/` — registered in `.ssot-registry.json` Tier 4.
- Phase 4 estimate revised: **~4-5 days** (TipTap + Yjs binding + y-websocket setup + auth integration).

### Q5 — Stamps & title blocks: data-driven templates or hardcoded?
- Template system: Firestore `text_templates` collection with placeholder variables (`{{project.name}}`, `{{revision.number}}`)
- Hardcoded: ship a few enterprise templates as TypeScript constants
- Hybrid: ship defaults as TS, allow override via Firestore

**✅ DECISION (2026-05-11, Giorgio)**: **Hybrid (Path C)**.
- Rationale: best of both worlds. Ship-ready defaults for immediate use + per-tenant customization for branded title blocks.
- Architecture:
  - **Built-in defaults** (~5-10 templates): Greek + English title blocks, revision table, sign-off stamps. Stored as TypeScript constants in `src/subapps/dxf-viewer/text-engine/templates/defaults/`.
  - **User templates**: Firestore collection `text_templates` (companyId-scoped per ADR-326). Schema: `{ id, companyId, name, category, content (DxfTextNode), placeholders[], isDefault, createdAt, updatedAt }`.
  - **Placeholder resolver** (~150 lines): variable substitution engine for `{{project.name}}`, `{{project.owner}}`, `{{date.today}}`, `{{user.fullName}}`, `{{company.name}}`, etc. Source: existing project/contact/user stores.
  - **Conflict resolution**: user-created templates with same name override built-in defaults (clearly marked in UI).
- New collection registered in `src/config/firestore-collections.ts` SSoT. Firestore rules added per ADR-298 pattern. Enterprise IDs via `enterprise-id.service.ts` (CLAUDE.md N.6) — new prefix `tpl_text_*`.
- New management UI: `src/subapps/dxf-viewer/ui/text-templates/TextTemplateManager.tsx` — list/create/edit/delete templates.
- New i18n keys under `src/i18n/locales/{el,en}/textTemplates.json` (CLAUDE.md N.11).
- **Phase 7 estimate locked at ~4-5 days** (defaults + Firestore schema + resolver + management UI + i18n).

### Q6 — Spell check: client-side (typo.js, MIT) or skip?
- Adds ~150 KB Greek+English dictionaries
- Greek dictionary quality varies in OSS

**✅ DECISION (2026-05-11, Giorgio)**: **Include client-side spell check (Path A)**.
- Rationale: enterprise-grade deliverables (sign-off documents, owner-facing drawings) demand professional spelling. Browser's built-in spell check is unreliable across browsers and may be disabled by end users.
- Stack: **nspell** (MIT) — Node.js + browser spell checker using Hunspell dictionaries.
- Dictionaries: **el_GR** + **en_US** Hunspell dicts from LibreOffice (MIT/LGPL? — VERIFY: must confirm dictionary license is MIT/BSD/Apache/MPL-2.0; LGPL acceptable only for dictionaries-as-data per CLAUDE.md N.5). Fallback: `dictionary-el` + `dictionary-en` npm packages (BSD-2-Clause, confirmed).
- Architecture:
  - Dictionaries **lazy-loaded on demand** (only when user opens text editor — not blocking initial bundle).
  - Custom user dictionary stored per-company in Firestore (`text_custom_dictionary` collection, companyId-scoped). Allows adding CAD/architectural terms (e.g. «οπτοπλινθοδομή», «κουφώματα PVC»).
  - Spell check runs on `worker` thread to avoid blocking edit UX.
  - Red underline rendered via TipTap decoration extension (custom).
- New modules:
  - `src/subapps/dxf-viewer/text-engine/spell/spell-checker.ts` (worker + nspell)
  - `src/subapps/dxf-viewer/text-engine/spell/custom-dictionary.service.ts` (Firestore CRUD)
  - `src/subapps/dxf-viewer/ui/text-toolbar/SpellCheckToggle.tsx`
- Bundle impact: ~200 KB (el_GR + en_US dictionaries, gzip), lazy-loaded — does NOT affect initial app load.
- **Phase 8 (NEW) estimate: ~3 days** (spell engine + custom dict UI + worker + i18n + tests).

### Q7 — Find & Replace scope: current text entity, current drawing, or all drawings?
- Scope affects undo granularity and command design

**✅ DECISION (2026-05-11, Giorgio)**: **Scope = current drawing (Path B, "FIND")**.
- Rationale: matches AutoCAD's standard FIND command — covers 90% of real-world use cases. Cross-drawing search (SHEET SET MANAGER) is power-user feature, deferred.
- Architecture:
  - `FindReplaceDialog` (Radix Dialog) iterates all TEXT/MTEXT entities in the current `dxfScene`
  - Match modes: case-sensitive toggle, whole-word toggle, regex toggle
  - Preview list with click-to-zoom-and-highlight per match
  - **Replace All** wrapped in **single composite command** (`ReplaceAllTextCommand` implements ICommand per ADR-031) — one undo step reverses all replacements atomically
  - **Replace Next** = one command per replacement (granular undo)
- New module: `src/subapps/dxf-viewer/ui/text-toolbar/FindReplaceDialog.tsx` + `core/commands/text/ReplaceAllTextCommand.ts` + `ReplaceOneTextCommand.ts`.
- i18n keys under `src/i18n/locales/{el,en}/textFindReplace.json`.
- **Phase 9 (NEW) estimate: ~2 days** (dialog UI + match engine + commands + tests).

**🔮 Deferred (future ADR)**: Cross-drawing Find & Replace (Path C "SHEET SET MANAGER") — to be opened as separate ADR when needed, building on top of this foundation without architectural disruption.

---

## 4-BIS. ADDITIONAL DESIGN QUESTIONS (gaps identified on re-review 2026-05-11)

After Q1-Q7 resolution, re-reading the ADR surfaced 10 architectural gaps not previously discussed. These cover RBAC, related entities (DIMENSION/LEADER), mobile UX, annotative scaling, audit trail, eyedropper reuse, DXF version range, auto-save, AI integration, and layer assignment.

### Q8 — Permissions: who can create/edit text?

**✅ DECISION (2026-05-11, Giorgio)**:
- **Sub-Q A — Who can create/edit text**: **Professionals only** (architect, engineer, foreman, admin, super-admin). Clients and external read-only collaborators see text but cannot create/edit.
- **Sub-Q B — Locked layers**: **Admin-level unlock allowed**. Locked layers block edits by default; users with `layer.unlock` permission (admin / super-admin) can unlock to write, then re-lock.
- **Implementation**:
  - New permission keys in `src/lib/auth/roles.ts`: `text.create`, `text.edit`, `text.delete`, `layer.unlock`.
  - Role matrix:
    | Role | text.create | text.edit | text.delete | layer.unlock |
    |---|---|---|---|---|
    | super-admin | ✅ | ✅ | ✅ | ✅ |
    | admin | ✅ | ✅ | ✅ | ✅ |
    | architect | ✅ | ✅ | ✅ | ❌ |
    | engineer | ✅ | ✅ | ✅ | ❌ |
    | foreman | ✅ | ✅ | own only | ❌ |
    | accountant | ❌ | ❌ | ❌ | ❌ |
    | client | ❌ | ❌ | ❌ | ❌ |
    | viewer | ❌ | ❌ | ❌ | ❌ |
  - UI guard: `useCanEditText()` hook returns `{ canCreate, canEdit, canDelete, canUnlockLayer }`; toolbar buttons disabled with tooltip when denied.
  - Firestore rules: `text_templates` write restricted via `request.auth.token.permissions.text_create` claim.
  - Locked layer enforcement: `CanEditLayerGuard` in command pre-execute hook — blocks `UpdateTextStyleCommand` if `layer.locked && !user.canUnlockLayer`.
- **Phase 5 impact**: +0.5 day for permission integration in toolbar UI.

### Q9 — DIMENSION + LEADER entities in scope?

**✅ DECISION (2026-05-11, Giorgio)**: **Path A — TEXT/MTEXT only in this ADR. DIMENSION + LEADER deferred to dedicated future ADR.**
- Rationale: keep ADR-344 scope focused. DIMENSION/LEADER require DIMSTYLE handling, anonymous *D blocks, auto-recalculation of dimension lines/arrows/extension lines, leader path geometry — separate architectural concern.
- **Behavior in current scope**: DIMENSION/LEADER entities found in opened DXF files will render correctly (text via this engine's font layer), but their text is **NOT editable** through the TextToolbar. Selection on dimension/leader shows a read-only badge "Edit dimension geometry → coming soon (deferred ADR)".
- **🚨 PERSISTENT REMINDER**: Added to `src/subapps/dxf-viewer/PENDING.md` AND `.claude-rules/MEMORY.md` so this gap is surfaced at start of every new session per CLAUDE.md N.0.0 + N.13.
- **Future ADR placeholder**: `ADR-XXX DXF Dimension & Leader Text Editing System` — to be opened when Giorgio approves. Will reuse:
  - Font engine (Layer 2 of this ADR)
  - Text layout engine (Layer 3)
  - TextToolbar UI (Layer 5) — with DIMSTYLE-specific extensions
  - CommandHistory integration (Layer 4)
- **Scope of deferred ADR**: DIMENSION entity (linear, aligned, radial, diameter, angular, ordinate), LEADER entity, MLEADER entity (multi-leader with multiple endpoints), DIMSTYLE table, auto-recalculation on parent geometry change.

### Q10 — Mobile/touch text editing UX?

**✅ DECISION (2026-05-11, Giorgio)**: **Path B — Full mobile/touch text editing**.
- Rationale: aligns with completeness-over-MVP pattern (consistent with Q2-Q6 choices). Foreman role (Q8) implies real construction-site use case. Industry convergence to "Path Γ" (PlanGrid/Procore) is driven by SaaS pricing tiers — irrelevant for internal enterprise tool. Matches "AutoCAD-grade" original brief.
- **Implementation scope**:
  - Touch-friendly toolbar: larger tap targets (min 44×44 px per Apple HIG, 48×48 dp per Material), `aria-pressed` state visible at touch sizes.
  - Drag-scrubbing on numeric inputs via touch (pointer events, not mouse).
  - Soft keyboard handling: `visualViewport` API listener to reposition TipTap overlay above the on-screen keyboard.
  - Gesture disambiguation: pinch-zoom on canvas vs. text selection — `touch-action: pan-x pan-y` on edit overlay; pinch captured by canvas layer below.
  - Responsive toolbar: collapsible into groups (Style / Formatting / Paragraph / Insert / Tools) via Radix Accordion on narrow viewports (<768 px).
  - Native context menu suppression on long-press inside text editor (`oncontextmenu={e=>e.preventDefault()}`).
- **Integrates with ADR-176** (DXF Viewer Mobile Responsive) — text-toolbar uses same breakpoint tokens.
- **New module**: `src/subapps/dxf-viewer/ui/text-toolbar/responsive/MobileTextToolbar.tsx`.
- **Phase 5 estimate revised: ~9-11 days** (was 4 days desktop-only → +5-7 days mobile/touch).
- **Total ADR-344 revised estimate: ~42-48 working days** (was 36-41).

### Q11 — Annotative scaling (per-viewport text size)?

**✅ DECISION (2026-05-11, Giorgio)**: **Path B — Full annotative scaling (AutoCAD-grade)**.
- Rationale: aligns with completeness-over-MVP pattern and "Autodesk-grade" brief. Real architectural drawings have multiple viewports (floor plan 1:100 + detail 1:20) — text must read correctly at every scale without manual adjustment.
- **Data model**: each `DxfTextNode` gains an `annotationScales: AnnotationScale[]` field:
  ```typescript
  interface AnnotationScale {
    name: string;          // e.g. "1:100", "1:50", "1:20"
    paperHeight: number;   // desired paper-space height in mm
    modelHeight: number;   // = paperHeight × scale factor
  }
  isAnnotative: boolean;   // mirrors DXF ANNOT flag on TEXT/MTEXT
  currentScale: string;    // active scale name for this viewport
  ```
- **Rendering logic**: when viewport system is active, text renderer reads `currentScale` from the viewport context and looks up the matching `modelHeight`. When no viewport is active (single-view mode), renders at the first scale's `modelHeight`.
- **Viewport system prerequisite**: full annotative scaling requires a paper-space / viewport infrastructure. ADR-344 will include a **minimal viewport context system** (not full paper-space layout — that is a future ADR):
  - `ViewportStore` (~~Zustand~~ **plain singleton, see correction below**) — active scale name, viewport scale list
  - `ViewportContext` (~~React context~~ **hook layer over the singleton**) — propagates current scale to text renderer leaf nodes via `useSyncExternalStore`
  - UI: scale selector dropdown in TextToolbar (add/remove annotation scales per entity)
  - DXF I/O: read/write `ANNOTATIVE` extended data (XDATA group codes 1000/1070/1071) per AutoCAD convention
- **Integration**: `EntityRendererComposite.render()` passes every entity through `resolveAnnotativeEntity()` which reads `ViewportStore.getActiveScaleName()` (via getter, per ADR-040 cardinal rules — no snapshot) and produces a shallow-cloned entity with the model-space height substituted. `TextRenderer.ts` is intentionally untouched per its file-level lockdown comment.

> **Correction (Phase 11 implementation, 2026-05-12)**: the original §Q11 text specified Zustand for `ViewportStore`. During Phase 1 Recognition we discovered that **every other high-frequency store in the dxf-viewer subapp uses a plain module-level singleton with `useSyncExternalStore` hooks** (`HoverStore`, `ImmediateTransformStore`, `ImmediatePositionStore`, `ZoomStore`). Per CLAUDE.md N.0.1 "code = source of truth", and per ADR-040 cardinal rules (granular subscribe/notify, getter at event time, no proxy overhead), we built `ViewportStore` as a plain singleton matching the established pattern. Zustand is not used for canvas-v2 high-frequency state anywhere in this subapp.
- **Scale list management UI**: `AnnotationScaleManager.tsx` panel — add standard scales (1:1, 1:2, 1:5, 1:10, 1:20, 1:50, 1:100, 1:200, 1:500, 1:1000) + custom input.
- **New modules**:
  - `src/subapps/dxf-viewer/systems/viewport/ViewportStore.ts`
  - `src/subapps/dxf-viewer/systems/viewport/ViewportContext.tsx`
  - `src/subapps/dxf-viewer/ui/text-toolbar/AnnotationScaleManager.tsx`
  - `src/subapps/dxf-viewer/text-engine/types/annotation-scale.ts`
- **Phase impact**: +3-4 days for viewport context system + annotative data model + scale picker UI + DXF XDATA I/O.
- **Phase 11 (NEW) estimate: ~3-4 days** (ViewportStore + AnnotationScaleManager UI + DXF XDATA round-trip + tests).
- **Total ADR-344 revised estimate: ~45-52 working days** (was 42-48).

### Q12 — Audit trail integration (ADR-195)?

**✅ DECISION (2026-05-11, Giorgio)**: **Path Γ — Full audit trail (create + edit + delete)**.
- Rationale: text entities in architectural drawings carry legal and contractual weight (room labels, dimensions, annotations on permit-submission sets). Full audit is required for accountability. Reuses existing `EntityAuditService` (ADR-195) — zero new infrastructure.
- **Integration points** (all via `EntityAuditService.recordChange()`):
  - `CreateTextCommand.execute()` → `recordChange({ entityType: 'dxf_text', action: 'CREATE', entityId, snapshot: { content, position, style } })`
  - `UpdateTextStyleCommand.execute()` → `recordChange({ action: 'UPDATE', diff: { before, after } })`
  - `UpdateTextGeometryCommand.execute()` → `recordChange({ action: 'UPDATE', diff: { before, after } })`
  - `UpdateMTextParagraphCommand.execute()` → `recordChange({ action: 'UPDATE', diff: { before, after } })`
  - `DeleteTextCommand.execute()` → `recordChange({ action: 'DELETE', snapshot })`
  - `ReplaceAllTextCommand.execute()` → `recordChange({ action: 'BULK_UPDATE', count, search, replacement })`
- **Undo/redo behavior**: audit records the **final committed state only** — undo/redo do NOT create audit entries (they revert within the CommandHistory session; only `commit()` writes to audit).
- **No new modules**: audit calls added inline in text command classes (Phase 6). Zero additional files.
- **Phase 6 impact**: +0.5 day for audit integration in each text command.
- **Entity audit coverage ratchet** (CHECK 3.17): `entity-audit-coverage-baseline.json` must be updated after Phase 6 to reflect new `dxf_text` entity type coverage.

### Q13 — Reuse existing OS-level eyedropper?

**✅ DECISION (2026-05-11, Giorgio)**: **Path A — Reuse existing eyedropper service (SSOT)**.
- Rationale: existing eyedropper (OS-level + `getDisplayMedia` fallback, ADR-040 area) is already implemented and battle-tested. Reusing it = zero new code, zero maintenance cost, guaranteed consistent UX across all tools.
- **Integration**: `TextToolbar` color picker (`react-colorful`) gains an eyedropper button that calls the existing eyedropper service hook. Returned hex color → mapped to nearest ACI 256-color index (or kept as true-color if DXF R2004+).
- **No new modules.** Integration is one import + one button in `TextToolbar` (Phase 5, ~1 hour).
- **ACI mapping**: `hexToAci(hex: string): DxfColor` utility added to `text-types` module — maps #RRGGBB → closest ACI index via Euclidean distance in RGB space.

### Q14 — DXF version range supported?

**✅ DECISION (2026-05-11, Giorgio)**: **Path B — Full range R12 to R2018 (AC1009–AC1032)**.
- Rationale: Greek architectural firms exchange DXF files spanning 30 years of production. Partial support breaks interoperability with legacy project archives. AutoCAD-grade brief demands opening anything.
- **Version-specific handling matrix**:
  | Version range | AC code | Text features enabled |
  |---|---|---|
  | R12 | AC1009 | TEXT only (no MTEXT entity) — parser reads `AcDbText`, serializer writes `AcDbText` |
  | R2000 | AC1015 | + MTEXT, basic inline codes (`\f`, `\H`, `\C`, `\P`) |
  | R2004 | AC1018 | + True-color (group 420 `TRUECOLOR`) → enables `DxfColor.trueColor` branch |
  | R2007 | AC1021 | + MTEXT columns (group 73/74/45), `ANNOTATIVE` XDATA (Q11 annotative scaling) |
  | R2010 | AC1024 | + `MLEADER` entity (deferred ADR per Q9), paragraph borders, `\pxq` paragraph formatting |
  | R2013+ | AC1027+ | + `MULTILEADER` improvements, `ACAD_ANNOTATIVE_DATA` block |
  | R2018 | AC1032 | + `FIELD` entity partial support, `ACAD_PROXY_ENTITY` passthrough |
- **R12 graceful mode**: when serializing an R12-target DXF, MTEXT entities with rich formatting are downgraded to TEXT with plain content + warning in the export dialog ("Formatting lost — target version R12 does not support MTEXT").
- **Version detection**: parser reads header group 9 `$ACADVER` → sets `DxfDocumentVersion` enum → propagates to serializer and toolbar (disables true-color picker for AC1009/AC1012 targets).
- **True-color fallback**: for AC1015/AC1018, `hexToAci()` (Q13) maps to closest ACI index.
- **Phase 1 impact**: +1 day for version-conditional parsing branches + R12 downgrade logic.
- **New type**: `DxfDocumentVersion` enum in `text-types` module.

### Q15 — Auto-save & crash recovery?

**✅ DECISION (2026-05-11, Giorgio)**: **Path Γ — Local browser auto-save (IndexedDB)**.
- Rationale: self-contained, zero cloud infrastructure dependency. Solves the 90% crash/browser-close scenario without requiring DXF cloud persistence (which may not exist yet). Industry pattern: VS Code, Figma, Notion all use local draft state as safety net independent of cloud sync.
- **Implementation**:
  - **Storage**: `IndexedDB` via `idb` (MIT, ~1 KB) — structured object store, survives browser refresh + crash. `localStorage` rejected: 5 MB limit insufficient for large DXF text sets.
  - **Store key**: `dxf_text_draft_${companyId}_${drawingId}` — company-scoped, drawing-scoped.
  - **Snapshot contents**: serialized `DxfTextNode[]` array (all text entities modified in the current session) + `CommandHistory` delta (for undo stack restore).
  - **Save trigger**: debounced 30 s after last edit (not every keystroke). Also saves on `beforeunload` event (catches intentional tab close).
  - **Recovery UI**: on next open of the same drawing, `DraftRecoveryBanner` component checks IndexedDB → if draft exists + is newer than last cloud save → shows non-blocking banner: "Βρέθηκε μη αποθηκευμένη εργασία (30 Απρ, 14:32). Επαναφορά;" with [Ναι] / [Απόρριψη] actions.
  - **Draft expiry**: auto-delete after 7 days (stale drafts cleaned on app open via `idb` cursor scan).
  - **Yjs awareness** (Q4): if Yjs session is active → draft is the Y.Doc snapshot (binary, compact). On recovery → re-apply snapshot to Y.Doc before rendering.
- **New module**: `src/subapps/dxf-viewer/text-engine/draft/DraftRecoveryService.ts` + `ui/DraftRecoveryBanner.tsx`.
- **Phase 10 impact**: +1 day for draft service + recovery banner + i18n keys + tests.
- **New i18n keys**: `src/i18n/locales/{el,en}/textDraft.json`.

### Q16 — AI Assistant integration (ADR-185 + ADR-156 voice)?

**✅ DECISION (2026-05-11, Giorgio)**: **Path Γ — Voice-to-text + AI commands (full integration)**.
- Rationale: ADR-185 (AI pipeline) and ADR-156 (voice input) are already implemented — reusing them is SSoT. Construction-site foreman role (Q8) benefits enormously from hands-free text entry. AI commands remove friction for power-user operations (bulk reformatting, find-replace by description).
- **Integration scope**:
  - **Voice-to-text**: ADR-156 voice hook wired to TipTap editor's `insertContent()` API. Microphone button in TextToolbar activates voice session → transcription streams into the active cursor position in the editor.
  - **AI text commands** (natural language → structured action):
    | User says / types | AI resolves to |
    |---|---|
    | «κάνε bold» | `UpdateTextStyleCommand({ bold: true })` |
    | «άλλαξε χρώμα σε κόκκινο» | `UpdateTextStyleCommand({ color: ACI.RED })` |
    | «αύξησε μέγεθος στα 5mm» | `UpdateTextStyleCommand({ height: 5.0 })` |
    | «βρες ΣΑΛΟΝΙ και άλλαξε σε ΚΑΘΙΣΤΙΚΟ» | `ReplaceAllTextCommand({ search: 'ΣΑΛΟΝΙ', replacement: 'ΚΑΘΙΣΤΙΚΟ' })` |
    | «κεντράρισε το κείμενο» | `UpdateTextStyleCommand({ justification: 'CENTER' })` |
    | «δημιούργησε τίτλο ΙΣΟΓΕΙΟ, Arial 5mm, bold» | `CreateTextCommand({ content: 'ΙΣΟΓΕΙΟ', fontName: 'Arial', height: 5, bold: true })` |
  - **AI command router**: new module `text-engine/ai/TextAICommandRouter.ts` — receives NL string from ADR-185 pipeline, maps to one of the text commands, dispatches via `CommandHistory`. Uses existing `AIAnalysisProvider` (ADR-185), not a new LLM call.
  - **UI entry point**: AI button in TextToolbar opens a slim `TextAIBar` input field (or activates voice). Same pattern as existing AI command bars in other subapps.
- **New modules**:
  - `src/subapps/dxf-viewer/text-engine/ai/TextAICommandRouter.ts`
  - `src/subapps/dxf-viewer/ui/text-toolbar/TextAIBar.tsx`
- **No new AI infrastructure** — calls existing ADR-185 `AIAnalysisProvider` + ADR-156 voice hook.
- **Phase 12 (NEW) estimate: ~2-3 days** (router + intent mapping + TextAIBar UI + i18n + tests). **FULLY IMPLEMENTED 2026-05-12.**
- **New files** (Phase 12):
  - `text-engine/ai/useVoiceRecorder.ts` — MediaRecorder → POST `/api/voice/transcribe` (ADR-161 Whisper SSoT). States: idle/recording/processing/done/error. Max 30s auto-stop.
  - `text-engine/ai/text-ai-types.ts` — `TextAIIntentFlat` (wire format), `TextAIContext`, `TextAIRouterResult`.
  - `text-engine/ai/intent-schema.ts` — OpenAI Responses API strict `json_schema` (flat, all-nullable, `additionalProperties:false`, all fields in `required`). 7 command discriminants via `command` enum.
  - `text-engine/ai/system-prompt.ts` — bilingual (Greek/English) system prompt with ADR-344 §Q16 examples.
  - `text-engine/ai/TextAICommandRouter.ts` — `route(text, ctx)`: POST `/api/dxf/text/ai/command` → `TextAIIntentFlat` → `ICommand`. `replace_one` falls back to `replace_all` on selected entity (find-first requires future MatchLocation wiring).
  - `text-engine/ai/index.ts` — barrel with `route`, `useVoiceRecorder`, `TextAIContext`, `TextAIRouterResult`.
  - `app/api/dxf/text/ai/command/route.ts` — `POST /api/dxf/text/ai/command`. Auth: `withAuth` + `withHeavyRateLimit`. Calls OpenAI Responses API with `TEXT_AI_INTENT_SCHEMA`, returns `TextAIIntentFlat`.
  - `ui/text-toolbar/TextAIBar.tsx` — Radix Popover toggle. Button (Sparkles icon) in `TextToolbar`. Popup: textarea + `VoiceMicButton` + Send + history list (last 5 of 10). i18n namespace `textAi`.
  - `ui/text-toolbar/text-ai-bar-history.ts` — localStorage SSoT (`dxf-text-ai-history`, max 10). `getAIBarHistory()`, `pushAIBarHistory()`, `clearAIBarHistory()`.
  - `i18n/locales/el/textAi.json` + `i18n/locales/en/textAi.json` — pure Greek + English locale files.
- **Modified files**: `ui/text-toolbar/TextToolbar.tsx` (+`aiContext?: TextAIContext`, +`onExecuteAICommand?` props; renders `<TextAIBar>` when both provided).
- **Voice binding**: ADR-161 (`/api/voice/transcribe`) is the SSoT for Whisper calls. ADR-156 (Telegram Whisper) not reused directly — it downloads from Telegram file_id. ADR-161 accepts browser `Blob` directly. Both ultimately use `AI_ANALYSIS_DEFAULTS.OPENAI.WHISPER_MODEL`.
- **`replace_one` note**: `ReplaceOneTextCommand` requires a resolved `MatchLocation` (paragraph+run indexes), not a bare match index. The AI router maps `replace_one` intent to `ReplaceAllTextCommand([entityId])` in Phase 12. Precise first-occurrence replace requires a find-first integration step (future task).
- **Total ADR-344 revised estimate: ~47-55 working days** (was 45-52).

### Q21 — Text snap participation (insertion + bounding box)?

**✅ DECISION (2026-05-11, Giorgio)**: **Path Γ — Snap at all text geometry points**.
- Rationale: title blocks, annotation grids, and room label tables require precise text alignment. Snapping only to insertion point loses 80% of the alignment use case (aligning columns of text, aligning to bounding box edges). Full snap = professional layout capability.
- **Snap points exposed per text entity**:
  | Snap point | Type | Description |
  |---|---|---|
  | Insertion point | `endpoint` | The DXF group 10/20/30 anchor |
  | Top-left corner | `endpoint` | Bounding box TL |
  | Top-right corner | `endpoint` | Bounding box TR |
  | Bottom-left corner | `endpoint` | Bounding box BL |
  | Bottom-right corner | `endpoint` | Bounding box BR |
  | Center | `midpoint` | Bounding box centroid |
  | Top-center | `midpoint` | Bounding box top edge mid |
  | Bottom-center | `midpoint` | Bounding box bottom edge mid |
- **Integration**: `TextSnapProvider` implements the existing `ISnapProvider` interface (already used by line/arc/circle entities in the snap system). Registered in `SnapEngine` during Phase 6. No changes to `SnapEngine` itself — purely additive.
- **Bounding box requirement**: Layout engine (Phase 3) must expose `getBoundingBox(entityId): Rect` — this is a natural output of the layout engine and costs zero extra work.
- **Performance**: snap point computation is O(n) over visible entities — text entities add 8 points each. At 500 text entities = 4000 snap candidates. Existing spatial index (R-tree or grid) in `SnapEngine` handles this without degradation.
- **Phase 6 impact**: +0.5 day for `TextSnapProvider` implementation + registration.
- **New file**: `text-engine/interaction/TextSnapProvider.ts`.

### Q20 — Missing SHX font behavior?

**✅ DECISION (2026-05-11, Giorgio)**: **Path Γ — Substitution + notification + canvas highlight of affected entities**.
- Rationale: silent substitution masks data integrity issues. The architect needs to know which entities are affected so they can decide whether to upload the correct font or accept the substitute. Full AutoCAD-grade: AutoCAD also warns about missing fonts on open.
- **Implementation**:
  - **Substitution table** (in `font-substitution-table.ts`): maps well-known SHX names → open equivalents:
    | Missing SHX | Substitute | Notes |
    |---|---|---|
    | `romans.shx` | `Liberation Sans` | Stroke simplex → clean sans |
    | `romand.shx` | `Liberation Sans Bold` | Stroke duplex → bold sans |
    | `isocpeur.shx` | `ISO 3098` (bundled LFF) | Engineering lettering standard |
    | `txt.shx` | `Liberation Mono` | Monospaced stroke |
    | `simplex.shx` | `Liberation Sans` | Simplex stroke → sans |
    | `gothicg.shx` / `gothice.shx` | `UnifrakturMaguntia` (MIT, Google Fonts) | Gothic stroke → open gothic |
    | _unknown SHX_ | `Liberation Sans` | Generic fallback |
  - **Missing font report**: on DXF open, `FontLoader` collects all missing fonts → emits `MissingFontReport` object: `{ missing: string[], substitutions: Record<string, string>, affectedEntityIds: string[] }`.
  - **Non-blocking banner** (`MissingFontBanner.tsx`): appears below toolbar — «X γραμματοσειρές δεν βρέθηκαν (fonts). Αντικαταστάθηκαν αυτόματα. [Δες επηρεαζόμενα] [Ανέβασε]»
    - «Δες επηρεαζόμενα» → triggers **canvas highlight**: affected text entities get a dashed orange outline overlay (`MissingFontHighlightLeaf.tsx`, ADR-040 micro-leaf pattern).
    - «Ανέβασε» → opens `FontManagerPanel` (Q18) pre-filtered to show upload for the missing font names.
  - **Persistent state**: `MissingFontReport` stored in `useTextEditingStore` — banner dismissible (persists until next file open).
  - **Phase 2 impact**: +0.5 day for substitution table + report generation + banner UI + canvas highlight leaf.
  - **New components**: `MissingFontBanner.tsx`, `MissingFontHighlightLeaf.tsx`.

### Q19 — Text geometry interaction: grip handles + snap + numeric input?

**✅ DECISION (2026-05-11, Giorgio)**: **Path Γ — Grip handles + snap-to-grid + direct numeric input**.
- Rationale: AutoCAD-grade brief demands AutoCAD-grade geometry editing UX. Grip handles are the industry-standard interaction model — all AutoCAD users already know them. Direct distance/angle entry eliminates precision errors from free-hand dragging.
- **Grip handle set per text entity**:
  | Handle | Position | Action |
  |---|---|---|
  | Move grip | Insertion point | Drag → translate entity |
  | Resize grips (×4) | MTEXT bounding box corners | Drag → resize text frame width/height |
  | Rotation grip | Above bounding box (offset 20px) | Drag arc → rotate entity around insertion point |
  | Mirror grip | Right edge midpoint | Drag → mirror text horizontally (for symmetric layouts) |
- **Snap integration**: during grip drag, insertion point + corners participate in existing snap system (endpoint, midpoint, intersection, grid snap, polar tracking). Uses the existing `SnapEngine` — no new snap infrastructure.
- **Direct numeric input**: while dragging, user can type a number on keyboard to commit exact value:
  - Move drag → type `500` → move exactly 500 mm in drag direction (relative distance)
  - Rotation drag → type `45` → rotate to exactly 45° (absolute angle or relative, toggleable via Tab)
  - Resize drag → type `150` → set frame dimension to exactly 150 mm
  - Pattern: same `DirectDistanceEntry` system used in existing CAD tools in the app (or new module if not yet present).
- **Command integration**: grip interaction commits via `UpdateTextGeometryCommand` (Phase 6) — fully undo/redo-able. Drag preview rendered as ghost overlay during drag (before commit).
- **Rotation field in DxfTextNode**: `rotation: number` (degrees, 0 = horizontal, CCW positive) added to `DxfTextNode` type — maps to DXF group code 50 on TEXT entities and group code 50 on MTEXT.
- **Phase 6 impact**: +1.5 days for grip handle renderer + drag interaction + snap integration + numeric input overlay.
- **New sub-module**: `text-engine/interaction/TextGripHandler.ts` — grip hit-testing, drag state machine, numeric input capture.

### Q18 — Custom font upload (TTF/OTF/SHX per company)?

**✅ DECISION (2026-05-11, Giorgio)**: **Path Γ — Upload TTF/OTF + SHX (full font management)**.
- Rationale: enterprise firms have branded fonts and legacy SHX font libraries. Full upload support = zero font mismatch when sharing DXF files internally.
- **Implementation**:
  - **Storage**: Firebase Storage at `fonts/{companyId}/{filename}` — company-scoped, served via signed URL (short-lived, cached in IndexedDB for offline use).
  - **Supported formats**: `.ttf`, `.otf`, `.woff`, `.woff2` (→ opentype.js), `.shx` (→ SHP parser from Q3).
  - **Font registry**: Firestore collection `company_fonts` (companyId-scoped) — schema: `{ id, companyId, name, fileName, format, uploadedBy, uploadedAt, size }`. Enterprise ID prefix `fnt_*`.
  - **Upload UI**: `FontManagerPanel.tsx` — list installed fonts, upload button (drag-drop or file picker), delete (admin only), preview glyph sample.
  - **Font loader**: `font-loader.ts` fetches from Storage signed URL → passes ArrayBuffer to opentype.js or SHP parser → stores parsed font in `FontCache` (WeakMap, survives hot reload).
  - **Permissions**: upload/delete restricted to `admin` + `super-admin`. All roles can use installed fonts.
  - **Firestore rules**: `company_fonts` write = `request.auth.token.role in ['admin', 'super-admin']`.
  - **Phase 2 impact**: +1 day for Storage upload pipeline + FontManagerPanel + Firestore schema + rules.
  - **New module additions**: `text-engine/fonts/font-manager/` (upload service + FontManagerPanel).

### Q17 — Default layer for new text entities?

**✅ DECISION (2026-05-11, Giorgio)**: **Path Γ — Current layer default + layer picker in toolbar**.
- Rationale: mirrors AutoCAD default (current layer) while improving on it by eliminating the need to switch the global current layer just to place text on a different one. Power-user ergonomic that reduces layer switching overhead during annotation sessions.
- **Implementation**:
  - **Default**: `CreateTextCommand` reads `LayerStore.currentLayer` as the default target layer for new entities.
  - **Toolbar picker**: `LayerSelectorDropdown` (reuses Radix Select per ADR-001) added to TextToolbar — shows all non-frozen, non-locked layers (or locked layers with unlock badge for `layer.unlock` users per Q8). Selection is **session-local** (persists for the duration of the text tool activation, resets to current layer on tool exit).
  - **Locked layer guard** (Q8): if selected layer is locked + user lacks `layer.unlock` → picker shows lock icon + tooltip «Αυτό το layer είναι κλειδωμένο». Admin users see unlock toggle inline.
  - **Layer 0 behavior**: if current layer is `0` (AutoCAD default unset layer) → picker highlights it with a warning badge «Layer 0 — χρησιμοποιείται ως fallback» encouraging the user to select a named layer.
  - **No new modules**: `LayerSelectorDropdown` reuses existing `LayerStore` and layer list hook (already present in DXF viewer). Zero infrastructure additions.
- **Phase 5 impact**: +0.5 day for `LayerSelectorDropdown` in TextToolbar.

---

## 5. Decision Drivers (Why this design)

- **Free, no strings** ✅ — every library MIT/BSD/Apache. SHX is the only gap, mitigable via substitution
- **Autodesk-grade** ✅ — covers full MTEXT spec; opentype.js gives vector-perfect rendering
- **SSoT** ✅ — 8 dedicated modules, all registered in `.ssot-registry.json`
- **Integrates with existing systems** ✅ — CommandHistory (ADR-031), FloatingPanelContainer (ADR-003), Radix Select (ADR-001), UI Fonts (ADR-042)
- **Performance ceiling** ✅ — Canvas 2D + Path2D cache scales to ~500 text entities at 60fps; escape hatch to WebGL+SDF via troika-three-text if exceeded

---

## 6. Alternatives Considered (Rejected)

| Alternative | Reason Rejected |
|---|---|
| BlockNote (Notion-style) | MPL-2.0 license — blocked by CLAUDE.md N.5 |
| tldraw SDK | Proprietary, $6K/year — blocked |
| Lexical (Meta) | Excellent MIT alternative; rejected only because TipTap has larger ecosystem + 100+ extensions; kept as fallback option |
| Quill 2.x | BSD-3 OK, but React wrapper ecosystem fragmented; `react-quill` abandoned |
| Pure ProseMirror | Maximum flexibility but ~500-2000 lines of boilerplate — wasteful when TipTap wraps it cleanly |
| PixiJS + MSDF | Best perf, but no text editor primitives; 4-6 weeks custom build with locked-in WebGL stack |
| Excalidraw embed | Not extractable as text-only primitive; deeply coupled to whiteboard state |
| Konva text overlay | DOM `<textarea>` overlay sync bugs at CAD zoom levels; not canvas-native |
| `@dxfom/mtext` | GPL-3.0 — blocked |
| LibreDWG | GPL — blocked |

---

## 7. Consequences

### Positive
- Complete MTEXT spec coverage with permissive licenses
- Reuses existing CommandHistory / FloatingPanel / Radix stack — zero new design system debt
- Vector glyph paths = pixel-perfect at any zoom
- Yjs-ready for future collaborative CAD editing
- Familiar AutoCAD UX → low training cost for end users

### Negative / Risk
- MTEXT inline parser + layout engine are non-trivial (~10-15 days build) — no OSS shortcut
- SHX support gap (Q3) — full compatibility requires SHP parser implementation
- TipTap headless adds contenteditable DOM overlay during edit — may interfere with pan/zoom gestures (mitigable via event capture)
- Performance ceiling ~500 text entities; for projects with >1000 annotations need WebGL escape hatch

### Migration
- No existing DXF text editing in the project → greenfield, no migration burden
- Existing read-only DXF text rendering (if any) replaced in single coordinated commit

---

## 7-BIS. NON-NEGOTIABLE IMPLEMENTATION STANDARDS (Giorgio — mandatory for every phase)

> **These rules are ABSOLUTE and apply to every line of code written in this ADR. No exceptions. No shortcuts. Verified at every phase gate before moving to the next.**

---

### 🔴 STANDARD 1 — SINGLE SOURCE OF TRUTH (SSOT) — ZERO DUPLICATES

**Before writing ANY new code, the developer MUST:**

1. **Search** `docs/centralized-systems/README.md` + `.ssot-registry.json` for existing centralized systems
2. **Grep** the codebase for existing implementations of the needed functionality
3. **Read** the relevant ADRs (listed in §1 Related ADRs above)
4. **Decide**: extend existing → or → create new centralized module (register in `.ssot-registry.json`)

**Absolute prohibitions:**
- ❌ NEVER duplicate an existing service, hook, store, or utility — find it and import it
- ❌ NEVER create a local copy of something that exists in `src/services/`, `src/hooks/`, `src/lib/`, `src/config/`
- ❌ NEVER inline logic that belongs in a centralized module (auth checks, Firestore queries, ID generation, audit trail)
- ❌ NEVER use `addDoc()` / `.add()` / `crypto.randomUUID()` for Firestore IDs — use `enterprise-id.service.ts` (CLAUDE.md N.6)
- ❌ NEVER write `any`, `as any`, `@ts-ignore` — use proper types, generics, discriminated unions (CLAUDE.md N.2)

**Mandatory integrations with existing centralized systems:**

| System | Where it lives | Use it for |
|---|---|---|
| CommandHistory (ADR-031) | `src/subapps/dxf-viewer/core/CommandHistory.ts` | Every text mutation — create, edit, delete, replace |
| EntityAuditService (ADR-195) | `src/services/entity-audit.service.ts` | Audit trail calls in every text command |
| enterprise-id.service (ADR-017) | `src/services/enterprise-id.service.ts` | All Firestore document IDs (`tpl_text_*`, `fnt_*`, etc.) |
| FloatingPanelContainer (ADR-003) | existing DXF viewer UI | Text Properties tab — do NOT create a new panel system |
| SnapEngine | existing DXF snap system | Text snap points — implement `ISnapProvider`, register there |
| LayerStore | existing DXF layer system | Current layer for new text entities — read from existing store |
| HoverStore / ImmediatePositionStore | ADR-040 | Grip hover state — use existing stores, never new React state |
| UnifiedFrameScheduler (ADR-040) | `rendering/core/UnifiedFrameScheduler.ts` | All canvas re-renders — never call `requestAnimationFrame` directly |
| ADR-040 micro-leaf pattern | `canvas-layer-stack-leaves.tsx` | Text rendering leaf — must follow the leaf subscriber pattern |
| ADR-001 Radix Select | `@/components/ui/select` | ALL dropdowns in TextToolbar — never new dropdown primitives |
| ADR-156 voice hook | existing voice input system | Voice-to-text in TextAIBar — import existing hook |
| ADR-185 AIAnalysisProvider | existing AI pipeline | NL → text command router — call existing provider |
| Firestore collections SSoT | `src/config/firestore-collections.ts` | Register `text_templates`, `text_custom_dictionary`, `company_fonts` here |
| i18n locales (ADR-280) | `src/i18n/locales/{el,en}/` | ALL user-facing strings — never hardcoded (CLAUDE.md N.11) |
| Firebase Auth / RBAC | `src/lib/auth/roles.ts` | Permission checks — extend existing role matrix (Q8) |
| Firestore rules | `firestore.rules` | Extend existing rules — never bypass |

**Pre-commit enforcement (automatic — cannot be bypassed):**
- CHECK 3.7 — SSoT ratchet: new violations in `.ssot-registry.json` modules → BLOCK
- CHECK 3.8 — i18n missing keys → BLOCK
- CHECK 3.17 — entity audit coverage → update baseline after Phase 6
- CHECK 6B — ADR-040 architecture files modified without ADR staged → BLOCK
- CHECK 6C — `useSyncExternalStore` in orchestrator components → BLOCK
- CHECK N.7.1 — file >500 lines → BLOCK; function >40 lines → EXTRACT

---

### 🔴 STANDARD 2 — GOOGLE-LEVEL QUALITY (GOL)

**Every implementation must pass this checklist before moving to the next phase:**

| # | Question | Required answer |
|---|---|---|
| 1 | Is the solution proactive (data created at correct lifecycle moment)? | **YES** — never as a side effect |
| 2 | Is there a race condition possible? | **NO** — primary path runs before dependent actions |
| 3 | Is the operation idempotent? | **YES** — calling twice = same result, no duplicates |
| 4 | Is there a belt-and-suspenders fallback? | **YES** — primary path + safety net |
| 5 | Is there a Single Source of Truth? | **YES** — one module owns the data, all others read it |
| 6 | Are async operations awaited where correctness requires it? | **YES** — fire-and-forget only for non-blocking side effects |
| 7 | Who owns the lifecycle of each piece of data? | **Explicit** — one service/command is responsible |
| 8 | Functions ≤40 lines? | **YES** — extract helpers if exceeded |
| 9 | Files ≤500 lines (logic files)? | **YES** — split if exceeded |
| 10 | Zero `any` / `as any` / `@ts-ignore`? | **YES** — proper types only |
| 11 | Optimistic UI updates where applicable? | **YES** — same pattern as Google Docs / Gmail |
| 12 | Zero hardcoded strings in `.ts`/`.tsx`? | **YES** — all via `t('key')` i18n calls |

**After completing each Phase, the developer declares explicitly:**
```
✅ Google-level: YES — [one-line reason]
⚠️ Google-level: PARTIAL — [gap + urgency]
❌ Google-level: NO — [what must change before proceeding]
```

**If PARTIAL or NO → phase is NOT complete. Fix before starting the next phase.**

---

### 🔴 STANDARD 3 — ADR-040 CANVAS ARCHITECTURE (DXF-specific)

Text rendering integrates with the existing high-performance canvas pipeline. These rules are **cardinal** (ADR-040 §4):

1. **Text leaf component** (`TextEntityLeaf.tsx`) — subscribes to `useSyncExternalStore` for text entity data. CanvasSection and CanvasLayerStack MUST NOT subscribe.
2. **Grip handle overlay** — separate leaf (`TextGripLeaf.tsx`), subscribes only to selection store.
3. **Missing font highlight** — separate leaf (`MissingFontHighlightLeaf.tsx`), subscribes only to missing font report store.
4. **HoverStore** — grip hover state goes in `HoverStore` (existing), never in React state.
5. **UnifiedFrameScheduler** — all canvas redraws (text content change, scale change, grip drag) MUST be scheduled via existing RAF orchestrator.
6. **Bitmap cache key** — text renderer's bitmap cache MUST NOT include `hoveredGripId` or `selectedEntityIds` in its key — these are handled by overlay leaves, not the base renderer.

---

## 8. Implementation Plan (FINAL — all design decisions confirmed)

| Phase | Scope | Estimate |
|---|---|---|
| **Phase 0** | `.ssot-registry.json` entries (15 modules), font asset selection (LFF fallbacks), Yjs server skeleton, Firestore collection schema (`text_templates`, `text_custom_dictionary`) | 1 day |
| **Phase 1** | Layer 1: DXF parsing — TEXT + MTEXT entities + STYLE table + MTEXT inline tokenizer + version-conditional branches (R12→R2018, Q14) + unit tests | 6-7 days |
| **Phase 2** | Layer 2: opentype.js font engine + **SHX/SHP parser** + glyph cache + substitution table + LFF fallback bundle + **font upload (TTF/OTF/SHX → Firebase Storage, Q18)** + FontManagerPanel + **missing font banner + canvas highlight (Q20)** | 7-8 days |
| **Phase 3** | Layer 3: Layout engine (UAX #14 line-break, columns, stacking `\S`, attachment-point anchoring) + tests | 4-5 days |
| **Phase 4** | Layer 4: TipTap v3 headless integration + **Yjs binding + y-websocket auth/server** + DxfTextNode ↔ MTEXT serializer | 4-5 days |
| **Phase 5** | Layer 5: TextToolbar UI (Radix Toolbar + react-colorful + cmdk + ACI palette + LayerSelectorDropdown + permissions guard) + Mobile/touch toolbar + Text Properties FloatingPanel tab | 10-12 days |
| **Phase 6** | Text commands (CreateText, UpdateTextStyle, UpdateTextGeometry, UpdateMTextParagraph, DeleteText, ReplaceAll/One) + CommandHistory integration + **EntityAuditService integration (Q12)** + **Grip handles + snap + numeric input (Q19)** + **TextSnapProvider (Q21)** + undo/redo tests | 4-5 days |
| **Phase 7** | **Hybrid templates**: built-in defaults (TS constants) + Firestore `text_templates` + placeholder resolver + management UI | 4-5 days |
| **Phase 8** | **Spell check**: nspell + el_GR + en_US dictionaries (lazy-load, worker) + custom dictionary CRUD + TipTap decoration | 3 days |
| **Phase 9** | **Find & Replace** (current drawing scope): dialog UI + match engine + composite ReplaceAll command | 2 days |
| **Phase 10** | i18n (el/en locale keys per ADR-280) + **IndexedDB draft/recovery (Q15)** + visual regression tests (ADR-343) + ADR-040 update for text rendering path | 3 days |
| **Phase 11** ✅ | **Annotative scaling** (Q11): ViewportStore + ViewportContext + AnnotationScaleManager UI + DXF XDATA round-trip + scale-aware text renderer (via EntityRendererComposite resolver — TextRenderer stays sealed) | 3-4 days — **DONE 2026-05-12** |
| **Phase 12** ✅ | **AI integration** (Q16): TextAICommandRouter + TextAIBar UI + ADR-161 Whisper voice binding + intent-to-command mapping (strict json_schema) + i18n + tests | 2-3 days — **DONE 2026-05-12** |

**Total estimate**: **~52-62 working days** (~12-13 weeks for one developer)

> Breakdown: Ph0(1) + Ph1(6-7) + Ph2(7-8) + Ph3(4-5) + Ph4(4-5) + Ph5(10-12) + Ph6(4-5) + Ph7(4-5) + Ph8(3) + Ph9(2) + Ph10(3) + Ph11(3-4) + Ph12(2-3)

### Phase Ordering & Dependencies

```
Phase 0 ──┬──→ Phase 1 ──→ Phase 3 ──→ Phase 4 ──→ Phase 5 ──→ Phase 6 ──→ Phase 7 ──→ Phase 8 ──→ Phase 9 ──→ Phase 10 ──→ Phase 11 ──→ Phase 12
          └──→ Phase 2 ─────────┘
```
- Phases 1 + 2 parallel (different layers, no shared state)
- Phase 3 blocks on both 1 + 2
- Phase 11 (annotative) blocks on Phase 3 (layout engine) + Phase 5 (toolbar)
- Phase 12 (AI) blocks on Phase 5 (toolbar exists) + Phase 6 (commands exist)

---

## 9. Pre-commit Hook Impact

New SSoT registry entries → CHECK 3.7 will track text-engine modules. New file size budget tracked under CHECK 7.1 (500-line file limit, 40-line function limit per CLAUDE.md N.7.1). No conflict with existing checks.

---

## 10. Appendices

### Appendix A — Library License Audit

| Library | Version | License | Use |
|---|---|---|---|
| `@tiptap/core`, `@tiptap/react`, all extensions | v3.x | **MIT** ✅ | Edit engine (Layer 4 option A) |
| `opentype.js` | v2.x | **MIT** ✅ | Font parsing + glyph paths (Layer 2) |
| `harfbuzzjs` | latest | **MIT** ✅ (optional) | Complex script shaping |
| `fontkit` | latest | **MIT** ✅ (optional) | Variable fonts, CFF2 |
| `dxf-parser` | v1.x | **MIT** ✅ | DXF entity parsing (Layer 1) |
| `react-colorful` | v5.x | **MIT** ✅ | Color picker |
| `cmdk` | v1.x | **MIT** ✅ | Combobox (shadcn/ui) |
| `@radix-ui/react-toolbar`, `react-select`, `react-toggle-group` | latest | **MIT** ✅ | UI primitives |
| `zundo` | v2.x | **MIT** ✅ | Zustand temporal middleware |
| `fabric` | v7.x | **MIT** ✅ (fallback only) | If canvas-native build deferred |
| Yjs + `y-prosemirror` | latest | **MIT** ✅ (per Q4) | Collaborative editing |

**Blocked / Rejected**:
- `@dxfom/mtext` — GPL-3.0
- `libredwg` — GPL
- `BlockNote` — MPL-2.0
- `tldraw` SDK 4.x — proprietary, $6K/year
- `Draft.js` — archived (Meta), unmaintained

### Appendix B — MTEXT Inline Code Reference (Authoritative)

Reconstructed from `ezdxf` (MIT) source + Autodesk DXF reference 2023/2025:

| Code | Syntax | Effect |
|---|---|---|
| `\f` / `\F` | `\fArial\|b1\|i0\|c0\|p34;` | Font family (TTF) / SHX font |
| `\H` | `\H2.5;` or `\H3x;` | Char height (absolute / ×current) |
| `\W` | `\W0.8;` or `\W0.8x;` | Width factor |
| `\T` | `\T1.5;` | Tracking / char spacing |
| `\Q` | `\Q15;` | Oblique angle (degrees) |
| `\C` | `\C2;` | ACI color index |
| `\c` | `\c16711680;` | True color (24-bit RGB int) |
| `\L` / `\l` | `{\LText\l}` | Underline on/off |
| `\O` / `\o` | `{\OText\o}` | Overline on/off |
| `\K` / `\k` | `{\KText\k}` | Strikethrough on/off |
| `\P` | `\P` | Hard paragraph break |
| `\N` | `\N` | Soft line break |
| `\S` | `\S1^2;` / `\S1/2;` / `\S1#2;` | Stack (tolerance / diag fraction / horiz fraction) |
| `\A` | `\A0;` / `\A1;` / `\A2;` | Inline vertical alignment (bottom/center/top) |
| `\p` | `\pi1.5,l2.0,r3.0,q1,t4.0;` | Paragraph indent/tabs |
| `\~` | `\~` | Non-breaking space |
| `%%c` / `%%d` / `%%p` | (no params) | Ø / ° / ± |
| `\U+XXXX` | `\U+00B2` | Unicode codepoint |

### Appendix C — Type Sketches (Not Final)

```typescript
// src/subapps/dxf-viewer/text-engine/types/text-toolbar.types.ts

export type DxfColor =
  | { kind: 'ByLayer' }
  | { kind: 'ByBlock' }
  | { kind: 'ACI'; index: number }                  // 1-255
  | { kind: 'TrueColor'; r: number; g: number; b: number };

export type MixedValue<T> = T | null;                // null = indeterminate

export type TextJustification =
  | 'TL' | 'TC' | 'TR'
  | 'ML' | 'MC' | 'MR'
  | 'BL' | 'BC' | 'BR';

export type LineSpacingMode = 'multiple' | 'exact' | 'at-least';

export type TextRunStyle = {
  fontFamily: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  overline: boolean;
  strikethrough: boolean;
  height: number;
  widthFactor: number;
  obliqueAngle: number;
  tracking: number;
  color: DxfColor;
};

export type TextRun = { text: string; style: TextRunStyle };
export type TextParagraph = { runs: TextRun[]; indent?: number; tabs?: number[] };
export type DxfTextNode = {
  paragraphs: TextParagraph[];
  attachment: TextJustification;
  lineSpacing: { mode: LineSpacingMode; factor: number };
  bgMask?: { color: DxfColor; offsetFactor: number };
  columns?: { type: 'static' | 'dynamic'; count: number; width: number; gutter: number };
};
```

### Appendix D — File Structure (Sketch)

```
src/subapps/dxf-viewer/
├── text-engine/
│   ├── parser/
│   │   ├── mtext-tokenizer.ts            # Custom inline code tokenizer
│   │   ├── mtext-parser.ts               # Tokens → DxfTextNode AST
│   │   └── style-table-reader.ts         # STYLE table parsing
│   ├── serializer/
│   │   └── mtext-serializer.ts           # DxfTextNode → MTEXT inline string
│   ├── fonts/
│   │   ├── font-cache.ts                 # opentype.Font WeakMap cache
│   │   ├── font-loader.ts                # Async font loading
│   │   ├── font-substitution-table.ts    # SHX → open equivalent map
│   │   └── glyph-renderer.ts             # Path2D builder per glyph
│   ├── layout/
│   │   ├── line-breaker.ts               # UAX #14 implementation
│   │   ├── paragraph-formatter.ts        # Indents, tabs, lists
│   │   ├── column-layout.ts              # Static + dynamic
│   │   ├── stacking-renderer.ts          # \S fraction positioning
│   │   └── attachment-point.ts           # 9-point grid anchor math
│   ├── render/
│   │   ├── text-renderer.ts              # Canvas 2D draw orchestrator
│   │   ├── background-mask-renderer.ts   # Fill rect behind text
│   │   └── decoration-renderer.ts        # Under/over/strike lines
│   └── types/
│       ├── text-toolbar.types.ts         # DxfColor, MixedValue, etc.
│       └── text-ast.types.ts             # DxfTextNode, TextRun, TextRunStyle
├── ui/
│   └── text-toolbar/
│       ├── TextToolbar.tsx               # Root ribbon
│       ├── panels/                       # Style / Formatting / Paragraph / Insert / Tools
│       └── controls/                     # FontFamilyCombobox, ColorPickerPopover, etc.
├── state/
│   └── text-toolbar/
│       ├── useTextToolbarStore.ts
│       ├── useTextSelectionStore.ts
│       ├── useTextEditingStore.ts
│       └── textToolbarSelectors.ts       # computeMixedValues()
└── core/commands/text/
    ├── UpdateTextStyleCommand.ts         # ICommand
    ├── UpdateTextGeometryCommand.ts
    └── UpdateMTextParagraphCommand.ts
```

---

## 11. Sources

- TipTap: https://github.com/ueberdosis/tiptap • https://tiptap.dev/pricing
- Lexical: https://github.com/facebook/lexical
- ProseMirror: https://prosemirror.net/
- opentype.js: https://github.com/opentypejs/opentype.js
- fontkit: https://github.com/foliojs/fontkit
- harfbuzzjs: https://github.com/harfbuzz/harfbuzzjs
- dxf-parser: https://github.com/gdsestimating/dxf-parser
- ezdxf MTEXT internals: https://ezdxf.readthedocs.io/en/stable/dxfinternals/entities/mtext.html
- AutoCAD MTEXT 2025 reference: https://help.autodesk.com/cloudhelp/2025/ENU/AutoCAD-Core/files/GUID-E6BCE05D-B9E3-4875-BBBC-29134EA6FD51.htm
- Autodesk MTEXT format codes blog: https://blog.autodesk.io/dissecting-mtext-format-codes/
- Fabric.js: https://github.com/fabricjs/fabric.js
- canvas-editor (Hufe921): https://github.com/Hufe921/canvas-editor
- carota: https://earwicker.com/carota/
- Radix Toolbar: https://www.radix-ui.com/primitives/docs/components/toolbar
- react-colorful: https://github.com/omgovich/react-colorful
- zundo: https://github.com/charkour/zundo
- msdf-atlas-gen: https://github.com/Chlumsky/msdf-atlas-gen
- ACI color table: https://gohtx.com/acadcolors.php

---

## Changelog

- **2026-05-12 — Text hover glow fix (sub-pixel / SHX font outline problem)**.
  - **Root cause**: `fillText` with yellow `fillStyle` at very small `screenHeight` (1–3 px) produces anti-aliased thin strokes that visually resemble outlines rather than filled glyphs. Canvas2D cannot distinguish SHX from any other unknown font — they all fall back to the system default — but the sub-pixel rendering is the same regardless of font family.
  - **Fix**: `renderTextContent` now sets `ctx.shadowBlur = 6` + `ctx.shadowColor = '#FFFF00'` when `isHovered = true` (inside the inner `ctx.save/restore`). The shadow creates a visible yellow halo around every glyph, including tiny ones. GPU cost is acceptable: this code path runs for exactly 1 entity at hover time, not the full scene 60fps render.
  - **`config/color-config.ts`** (MOD): `HOVER_HIGHLIGHT.TEXT` added — `{ glowColor, glowShadowBlur }` — SSOT for text hover glow constants.
  - **`rendering/entities/TextRenderer.ts`** (MOD): `renderTextContent` applies `HOVER_HIGHLIGHT.TEXT` shadow when hovered.

- **2026-05-12 — Overline/Strikethrough rendering + Height field width fix**.
  - **Root cause (overline/strikethrough)**: `TextRenderer.ts` rendered only `underline`; `DxfTextStyle` interface and `extractFirstRunStyle` in `useDxfSceneConversion.ts` did not include `overline`/`strikethrough` fields. The MTEXT parser (`\O`/`\K` codes), serializer, tiptap-to-dxf, and dxf-to-tiptap were already correct.
  - **`canvas-v2/dxf-canvas/dxf-types.ts`** (MOD): `DxfTextStyle` gains `overline?: boolean; strikethrough?: boolean;`.
  - **`hooks/canvas/useDxfSceneConversion.ts`** (MOD): `extractFirstRunStyle` now extracts `s.overline` and `s.strikethrough` from the first run's `TextRunStyle`.
  - **`rendering/entities/TextRenderer.ts`** (MOD): `TextRichStyle` gains `overline` + `strikethrough`. `renderTextContent` precomputes `overlineYOff = screenHeight × (-0.05 − baselineVOffset)` and `strikethroughYOff = screenHeight × (0.40 − baselineVOffset)`. Both decorations rendered via `fillRect` in the rotated and non-rotated branches alongside underline. `measureText` called once per render when any decoration is active.
  - **`ui/text-toolbar/controls/SizeInput.tsx`** (MOD): adds optional `inputClassName` prop — merged last in `cn()` so callers can override the default `w-16` width.
  - **`ui/text-toolbar/panels/FormattingPanel.tsx`** (MOD): fontHeight `SizeInput` passes `inputClassName="w-20"` (80 px) — wider to accommodate values like `2.500`.

- **2026-05-12 — Phase 7 (InsertTextToken) COMPLETE**. `InsertTextTokenCommand` + `TextPropertiesPanelHost` wiring — closes the `onInsertToken` stub deferred from Phase 6.D. InsertPanel buttons (⌀ / ° / ± / ½) in the floating "Text Properties" panel now append the corresponding Unicode character to the first `TextRun` of the first paragraph in the selected entity's `DxfTextNode` AST.
  - **`core/commands/text/InsertTextTokenCommand.ts`** (NEW): `ICommand` implementation. Token map (4 entries): `%%c→⌀`, `%%d→°`, `%%p→±`, `\S→½`. `execute()`: calls `ensureTextNode` (legacy fallback, same pattern as all other text commands), snapshots `{ textNode, flatText }`, appends char via `appendToFirstRun()` (pure, immutable), calls `sceneManager.updateEntity` with both `textNode` and flat `text` field updated for renderer compatibility. `undo()` restores both fields from snapshot. `canMergeWith()` returns false — each insert is discrete. Layer-edit guard via `assertCanEditLayer`. Audit fire-and-forget.
  - **`core/commands/text/index.ts`** (MOD): barrel exports `InsertTextTokenCommand` + `InsertTextTokenCommandInput`.
  - **`ui/text-toolbar/TextPropertiesPanelHost.tsx`** (MOD): `onInsertToken` wired — iterates `selectedIds`, dispatches one `InsertTextTokenCommand` per entity via `getGlobalCommandHistory().execute()`. Short-circuits when `services` is null or no entities selected. `\S` (stack) inserts `½` as a plain character for now; full stacked-fraction dialog is deferred to Phase 8+.
  - ✅ Google-level: YES — proactive (char appended immediately on click, no deferred save), race-free (synchronous sequential forEach dispatch), idempotent (each click → distinct command; undo stack correct), SSOT (`InsertTextTokenCommand` is the sole writer for token-based text mutation), belt-and-suspenders (null-check on `services` + `assertCanEditLayer` + `TOKEN_MAP.has` guard in `validate()`), explicit lifecycle owner (`TextPropertiesPanelHost` owns the dispatch, `InsertTextTokenCommand` owns the mutation).

- **2026-05-12 — Phase 6.E COMPLETE**. Canvas integration wiring — the three missing layers that closed the gap between the (already-built) toolbar UI and the (already-built) command pipeline. AutoCAD Properties palette + DBLCLKEDIT parity. Selection now drives toolbar values, toolbar mutations now reach CommandHistory, double-click now opens an in-canvas TipTap editor whose commit is dispatched as a CompoundCommand built by a structural diff engine (Giorgio decision Q3: "Διαχωρισμός σε πολλές μικρές").
  - **`ui/text-toolbar/hooks/useDxfTextServices.ts`** (NEW): factory hook returning `{ sceneManager, layerProvider, auditRecorder }`. Builds `LevelSceneManagerAdapter` for the active level and a `ILayerAccessProvider` adapter over `SceneLayer` flags + `useCanEditText().canUnlockLayer`. AutoCAD parity: equivalent to the per-command context object every cmd handler receives. Returns `null` when no level is active.
  - **`ui/text-toolbar/hooks/useTextToolbarSelectionSync.ts`** (NEW): pick-set → toolbar populate bridge. Subscribes `useUniversalSelection` (Tier-1 SSoT), filters TEXT/MTEXT entities against the current scene, resolves each via `ensureTextNode()` (legacy-entity fallback), runs `computeMixedValues()` and writes the result via `useTextToolbarStore.populate(values)`. The `populate` action raises an `isPopulating` flag so the command bridge skips its own re-dispatch.
  - **`ui/text-toolbar/hooks/useTextToolbarCommandBridge.ts`** (NEW): toolbar mutation → CommandHistory bridge. Vanilla Zustand subscribe; on every non-populate change, diffs prev/next, dispatches `UpdateTextStyleCommand` per changed style field × per selected entity (10 fields), `UpdateTextGeometryCommand` for `rotation`. `justification` / `lineSpacingMode/Factor` / `layerId` / `currentScale` deferred pending dedicated commands (attachment-point + node-level line-spacing + layer-change + annotative-scale follow-ups).
  - **`ui/text-toolbar/hooks/useTextDoubleClickEditor.ts`** (NEW): AutoCAD `DBLCLKEDIT = 1` parity. Local React state only — `editingState: { entityId, initial, anchorRect } | null`. Triggered when `selectedEntityIds.length === 1` and the entity is TEXT/MTEXT (single-selection guard — pick-at-point requires future canvas hit-test API). `onCommit(next)` runs `diffTextNode()` and dispatches the result as a `CompoundCommand` (or the single command unwrapped when `commands.length === 1`).
  - **`text-engine/edit/ensure-text-node.ts`** (NEW): legacy-entity → `DxfTextNode` fallback. Phase 1 parser does not yet populate `textNode` on scene entities — full converter is scheduled with Phase 7 Firestore persistence. `ensureTextNode(entity)` returns the existing AST when present, otherwise derives a single-paragraph single-run node from the flat `TextEntity`/`MTextEntity` fields (`text`, `fontSize`/`height`, `fontFamily`, `alignment` → `attachment`, `rotation`, `lineSpacing`). AutoCAD parity: equivalent to the implicit R12 → R14 upgrade where pre-MTEXT entities are promoted to a single-paragraph MTEXT view at runtime.
  - **`text-engine/edit/diff-text-node.ts`** (NEW): `diffTextNode(entityId, prev, next, services) → ICommand[]`. Strategy: if paragraph STRUCTURE changed (paragraph count, run count, run.text, stack nodes) → single `ReplaceTextNodeCommand`; otherwise granular — `UpdateTextGeometryCommand` for rotation, `UpdateTextStyleCommand` for first-run style delta (uniform), `UpdateMTextParagraphCommand` per paragraph for paragraph-meta delta. Caller wraps in `CompoundCommand` for atomic undo (AutoCAD MTEXTEDIT undo grain).
  - **`core/commands/text/ReplaceTextNodeCommand.ts`** (NEW): atomic full replacement of `DxfTextNode` on a single entity. Used as the "content carrier" inside the TipTap commit pipeline — `UpdateMTextParagraphCommand`'s `ParagraphPatch` intentionally excludes `runs`, so a dedicated atomic command is required for content/structure edits. Snapshot/undo/redo + audit. Layer-edit guard via `assertCanEditLayer`. Barrel-exported from `core/commands/text/index.ts`.
  - **`state/text-toolbar/useTextToolbarStore.ts`** (MOD): adds `isPopulating: boolean` flag and `populate(values)` action that sets the flag for one microtask. Used by the command bridge to skip its own re-dispatch during selection-driven populate cycles. Backward-compatible with all existing `setValue` / `setMany` callers.
  - **`ui/text-toolbar/TextPropertiesPanelHost.tsx`** (MOD): mounts `useTextToolbarSelectionSync` + `useTextToolbarCommandBridge`. Stub data sources from Phase 6.D (`useTextPanelLayers` / `useTextPanelFonts` / `useTextPanelDocumentVersion`) are preserved; the new hooks complete the data flow on top.
  - **`components/dxf-layout/CanvasSection.tsx`** (MOD): adds `selectedEntityIdsRef` + `getSelectedEntityIds` getter (ADR-040 cardinal rule 2 — getter, not snapshot), mounts `useTextDoubleClickEditor`, threads `onDoubleClick: textEditor.handleDoubleClick` into the container handlers, renders `<TextEditorOverlay>` conditionally when `editingState != null`. NO `useSyncExternalStore` added; NO high-frequency subscription. ADR-040 cardinal rules respected.
  - **`components/dxf-layout/CanvasLayerStack.tsx`** + **`canvas-layer-stack-types.ts`** (MOD): `containerHandlers` gains optional `onDoubleClick`. The container div wires it through; existing callers (no `onDoubleClick` provided) see no change.
  - **`text-engine/edit/index.ts`** (MOD barrel): exports `ensureTextNode`, `diffTextNode`, `DiffServices`.
  - **ADR-040 changelog** updated: text dblclick → TipTap overlay path documented under 2026-05-12. CanvasSection orchestrator: no high-frequency subscription added; the new path is event-time only (user double-click).
  - **Deferred (next ADR-344 pass)**: attachment-point command (toolbar `justification` → `node.attachment`); node-level line-spacing command (toolbar `lineSpacingMode/Factor` → `node.lineSpacing`); layer-change command (`layerId` → `entity.layer` + audit); annotative-scale toolbar wire-through. Pick-at-point hit-test for DBLCLKEDIT on unselected entities — currently the user must single-select first.
  - **Known gap (upstream)**: the Phase 1 DXF parser still produces legacy `TextEntity`/`MTextEntity` (flat fields) and does NOT populate `textNode`. The Phase 6.E path is fully operational thanks to `ensureTextNode()` runtime fallback; the converter wire-up is scheduled with Phase 7 (Firestore persistence).
  - ✅ Google-level: YES — proactive (selection drives populate; toolbar mutation drives dispatch; double-click drives overlay — all explicit lifecycle moments), idempotent (no duplicate commands per change cycle thanks to `isPopulating` re-entry guard + Zustand `subscribe` change-detection; `populate` clears flag in a microtask so subsequent user mutations dispatch normally), race-free (services memoised on level + scene; subscription unmount cleans up; CompoundCommand executes atomically), SSoT (one selection set — `useUniversalSelection`; one toolbar pending-values store; one command history; one diff engine), belt-and-suspenders (`ensureTextNode` fallback covers legacy parser output; CompoundCommand rollback on any sub-command failure; layer-edit guard fires before every mutation).

- **2026-05-12 — Phase 6.E / Phase 8 bugfix: `dictionary-en` node:fs/promises + TS readonly errors**. `dictionary-en@4` reads `.aff`/`.dic` via `node:fs/promises` — a Node.js built-in that Turbopack cannot bundle for browser/worker contexts. The error was latent in Phase 8 but only triggered when `CanvasSection` first imported `TextEditorOverlay` (Phase 6.E), pulling the spell-check worker chunk into Turbopack's client analysis.
  - **Root cause**: `dictionary-loader.ts` called `await import('dictionary-en')` inside `loadEnglish()`. Turbopack statically traces `dictionary-en/index.js` → `node:fs/promises` → "chunking context (unknown) does not support external modules" error.
  - **Fix — `text-engine/spell/dictionary-loader.ts`**: replaced `loadEnglish()` with `loadDictionary()` using the same `fetchAsBuffer()` + static URL pattern already used for el_GR. `DICT_URLS` record maps both `'el'` and `'en'` to their static asset paths. English dictionary files (`en_US.aff`, `en_US.dic`) extracted from `dictionary-en@4/index.{aff,dic}` and committed under `text-engine/spell/dictionaries/en_US/` and `public/_next/static/dxf/dictionaries/en_US/` for dev-mode static serving.
  - **Fix — `next.config.js`**: CopyPlugin extended with an `en_US` pattern so production webpack builds copy the English files alongside el_GR.
  - **Fix — `text-engine/edit/diff-text-node.ts`** (TS2540): `ParagraphPatch = Partial<Omit<TextParagraph,'runs'>>` inherits `readonly` modifiers from `TextParagraph`. `paragraphPatchOf()` now accumulates into a `Record<string,unknown>` and casts to `ParagraphPatch` at return — no mutation of typed readonly properties.
  - **Fix — `ui/text-toolbar/hooks/useTextToolbarSelectionSync.ts`** (TS2322): `AnySceneEntity.layer` is `string | undefined`; coerced with `?? ''` (empty string = DXF layer 0, the default layer).
  - **Architectural fix — hook placement**: `useTextToolbarSelectionSync` + `useTextToolbarCommandBridge` moved from `TextPropertiesPanelHost` (lazy-loaded floating panel, not always mounted) to `DxfViewerContent` (always-on orchestrator). Without this, the ribbon contextual tab's dropdowns remain empty and toolbar mutations have no effect unless the floating "Text Properties" panel is simultaneously open. AutoCAD parity: the Properties palette populates all clients (ribbon, dockable palette, quick-properties) from the same underlying selection event — mount point must be the always-on host, not a conditionally-visible panel.
  - **Fix — `ui/text-toolbar/TextEditorOverlay.tsx`** (multiple TipTap v3 API changes): `StarterKit.configure({ history })` → `undoRedo` key (renamed in v3); `createYjsTipTapExtension({ yDoc })` → `{ doc: yDoc }` (field renamed in collab extension); `tipTapToDxfText(json, initial)` → `tipTapToDxfText(json)` (signature simplified to 1 arg); `editor.getJSON() as TipTapDoc` → `as unknown as TipTapDoc` (TipTap v3 `getJSON()` return type changed); `content: initialContent` → `content: initialContent as Content | undefined` (v3 `JSONContent` type no longer accepts project-local `TipTapDoc` directly); added `immediatelyRender: false` in `useEditor` options (v3 SSR requirement — selects the `Editor | null` overload and suppresses the "SSR detected" runtime warning).

- **2026-05-12 — Phase 6.E follow-up: annotation scale dropdown now changes text**. Three bugs caused the scale dropdown to have no visible effect: (1) `TextPropertiesPanelHost.scales` started empty and was never synced from the selected entity's `textNode.annotationScales` — so the entity scale select was always disabled; (2) `onAnnotationScalesChange` only updated local state, never dispatched a command — so adding scales to an entity had no persistent effect and `resolveAnnotativeEntity` never found a populated `annotationScales` list; (3) `useTextToolbarCommandBridge` explicitly skipped `currentScale` changes — no `setActiveScale` call and no command dispatched when the user picked a scale. **Fix A — `UpdateTextAnnotationScalesCommand`** (NEW): patches `entity.textNode.isAnnotative` + `textNode.annotationScales` AND the flat entity fields `isAnnotative` + `annotationScales` so `resolveAnnotativeEntity` (Phase 11) picks up the scale list at render time. **Fix B — `UpdateTextCurrentScaleCommand`** (NEW): patches `entity.textNode.currentScale`; merges on same entity (latest wins). **Fix C — `useTextToolbarCommandBridge`**: `currentScale` change now calls `setActiveScale(next.currentScale)` (viewport sync → `markSystemsDirty` → re-render) and dispatches `UpdateTextCurrentScaleCommand` per entity. **Fix D — `TextPropertiesPanelHost`**: `scales` is now initialized from the first selected entity's `ensureTextNode().annotationScales` on selection change (via `useEffect` + `prevFirstId` ref guard); `handleScalesChange` dispatches `UpdateTextAnnotationScalesCommand` per selected entity immediately on add/remove. Both new commands added to `core/commands/text/index.ts` barrel. Full end-to-end workflow now: add scale via panel → entity becomes annotative → change current scale → `setActiveScale` + command → re-render → `resolveAnnotativeEntity` finds scale entry → text renders at `modelHeight`.
  - ✅ Google-level: YES — proactive (entity made annotative at add time, not lazily at render time), idempotent (`addScale` checks `scales.some(name)` guard), race-free (command dispatches synchronously before state update, no async gap), SSoT (single `UpdateTextAnnotationScalesCommand` owns both textNode + flat entity fields; `ViewportStore` is the SSoT for viewport scale), belt-and-suspenders (`ensureTextNode` fallback covers legacy parser output + `pickActiveScale` falls back to first scale if exact match not found).

- **2026-05-12 — Phase 6.E bugfix: TipTap overlay appears at wrong position (Y-flip missing)**. `computeAnchorRect` in `useTextDoubleClickEditor` used `containerRect.top + worldY × scale + offsetY` for the overlay's CSS `top`. The DXF canvas has a Y-axis flip (`CoordinateTransforms.worldToScreen`: `screenY = canvasHeight - worldY × scale - offsetY`), so the formula placed the overlay at the Y-mirror of the correct position. Fix: `canvasY = container.clientHeight - worldY × scale - offsetY; top = containerRect.top + canvasY`. The overlay now appears directly over the text entity.

- **2026-05-12 — Phase 6.E bugfix: `para.attrs is not defined` on plain paragraph**. TipTap v3 omits the `attrs` key on paragraphs that carry no custom attributes (e.g. plain text with no indent/margin/tab overrides). `paragraphToDxf` accessed `para.attrs.indent` directly → TypeError on blur/commit. Fix: `DEFAULT_PARA_ATTRS` constant (`ParagraphAttrs` typed) with all-zero defaults; `const attrs = para.attrs ?? DEFAULT_PARA_ATTRS` guards every access.

- **2026-05-12 — Phase 6.F bugfix: text properties panel color/style changes not updating selected entities**. `TextSettings.tsx` (floating panel) called `updateTextSettings({ color })` which updates only the global default settings (Redux/localStorage). It never dispatched `UpdateTextStyleCommand`, so selected TEXT/MTEXT entities on the canvas were unaffected. Root cause: the toolbar bridge (`useTextToolbarCommandBridge`) was the sole dispatch path — the properties panel had no equivalent. **Fix**: added `applyStylePatch` module-level helper (reuses `UpdateTextStyleCommand` + `getGlobalCommandHistory`, same pattern as toolbar bridge) wired in `TextSettings.tsx`. On every color/bold/italic/underline/strikethrough/fontFamily change: `applyStyle(patch)` now dispatches `UpdateTextStyleCommand` per selected entity when `services` and `selectedIds` are available. SSOT preserved: `UpdateTextStyleCommand` remains the single write path for run-level text style.
  - ✅ Google-level: YES — proactive (command dispatched on UI change, not lazily), race-free (sequential forEach dispatch), idempotent (command merges on same entity), SSOT (`UpdateTextStyleCommand` sole writer), belt-and-suspenders (null-check on services + empty-check on selectedIds).

- **2026-05-12 — Phase 6.E bugfix: `para.content is not iterable` on empty paragraph**. TipTap v3 serializes empty paragraphs as `{ type: 'paragraph' }` with no `content` key (undefined, not `[]`). `paragraphToDxf` in `tiptap-to-dxf.ts:131` iterated `para.content` directly → TypeError on blur/commit when the user left an empty line in the editor. Fix: `para.content ?? []` — empty paragraph produces zero runs, structure preserved.

- **2026-05-12 — Phase 6.F: MTEXT creation tool (multiline, width-bounded)**. Nuovo tool `'mtext'` parallelo a `'text'` per creare entità MTEXT con bounding box di larghezza. Flusso: pulsante "A▾ → Πολλαπλές Γραμμές" in ribbon DRAW panel → `activeTool='mtext'` → click canvas → overlay largo (40% canvas, clamped [280–600]px) → testo multilinea con word-wrap naturale TipTap → commit → `CreateTextCommand` con `forceType:'mtext'` + `width` in world units → entità MTEXT. **File modificati (9)**: (1) `ui/toolbar/types.ts` — `'mtext'` aggiunto a `ToolType`; (2) `systems/tools/ToolStateManager.ts` — entry `mtext` identica a `text` (drawing, allowsContinuous:false); (3) `core/commands/text/types.ts` — `width?: number` aggiunto a `DxfTextSceneEntity`; (4) `core/commands/text/CreateTextCommand.ts` — `forceType?: 'mtext'` + `width?` in input; `execute()` usa `forceType ?? pickEntityType(AST)` + spread `{ width }` se MTEXT; (5) `hooks/canvas/useTextCreationTool.ts` — gestisce sia `'text'` che `'mtext'`; `computeAnchorRect` ora calcola `screenWidth` (200px per text, 40% per mtext) + `worldWidth`; `CreatingState` esteso con `worldWidth?` + `forceMText?`; `onCommit` passa `forceType`+`width` a `CreateTextCommand`; (6) `hooks/canvas/useCanvasClickHandler.ts` — branch 5.5 esteso a `activeTool === 'text' || activeTool === 'mtext'`; (7) `ui/ribbon/data/home-tab-draw.ts` — variante `text.multiline` (`commandKey:'mtext'`, rimosso `comingSoon:true`); (8) `ui/toolbar/toolDefinitions.tsx` — pulsante `mtext` + import `AlignLeft`; (9) `constants/domains/dxf-labels.ts` + i18n el/en — `MTEXT`/`tools.mtext`. **SSOT**: `CreateTextCommand` rimane il solo punto di creazione TEXT+MTEXT; `useTextCreationTool` è il solo hook di creazione (non duplicato). **Google-level N.7.2**: ✅ Proactive, ✅ No race (singolo state hook), ✅ Idempotent (existingId round-trip), ✅ Belt-and-suspenders (cancel/commit/empty-text guard), ✅ SSOT, ✅ Sync, ✅ Lifecycle unico.

- **2026-05-12 — Phase 6.E runtime bugfix: `entity.textNode` undefined in text commands**. All four text-command `execute()` methods crashed with `TypeError: Cannot read properties of undefined (reading 'paragraphs')` when dispatched against a legacy Phase 1 entity (flat fields, no `textNode` populated). Root cause: `UpdateTextStyleCommand`, `UpdateTextGeometryCommand`, `UpdateMTextParagraphCommand`, and `ReplaceTextNodeCommand` all read `entity.textNode` directly without fallback. Fix: every `execute()` now calls `ensureTextNode(entity)` first and uses the returned `safeNode` throughout. Import added from `../../text-engine/edit/ensure-text-node`. No behavior change for Phase 7+ entities that already carry a populated `textNode`; `ensureTextNode` short-circuits via `if (entity.textNode) return entity.textNode`.

- **2026-05-12 — Phase 6.E canvas rendering bugfix: `textNode` styles not reaching canvas**. Toolbar mutations (`UpdateTextStyleCommand`) patched `entity.textNode` but the canvas kept showing the original text style (font/bold/italic/color/height unchanged). Root cause: `useDxfSceneConversion` converted `SceneModel` entities → `DxfEntityUnion` but stripped `textNode` entirely — only flat fields (`height`, `color`) were forwarded; `DxfText` had no `textStyle` field; `TextRenderer` was hardcoded to Arial/normal. **5-file fix**: (1) `canvas-v2/dxf-canvas/dxf-types.ts` — new `DxfTextStyle` interface (`bold?`, `italic?`, `fontFamily?`, `runColor?`) + `textStyle?: DxfTextStyle` on `DxfText`; (2) `config/text-rendering-config.ts` — `buildUIFont` extended with `italic?: boolean` param; (3) `hooks/canvas/useDxfSceneConversion.ts` — `extractFirstRunStyle()` reads `textNode.paragraphs[0].runs[0].style` → `DxfTextStyle`; `resolveTextHeight()` prefers `textNode` first-run height (so toolbar height changes are visible even for `textNode`-only entities); `text` case spreads `textStyle` conditionally; (4) `canvas-v2/dxf-canvas/DxfRenderer.ts` — `toEntityModel` text case passes `textStyle` through (`as unknown as Entity` cast — `TextEntity` from entities.ts doesn't declare `textStyle`; cast is safe because `TextRenderer` reads it via `'textStyle' in entity`); (5) `rendering/entities/TextRenderer.ts` — `render()` reads `richStyle` from entity, applies font/bold/italic/color via `buildUIFont`. Re-render chain was already correct (`updateEntity` → new scene ref → `useDxfSceneConversion` memo → bitmap cache invalidation via `sceneRef` change → RAF paint); only the conversion and renderer layers were missing. Also: `ui/hooks/usePanelNavigation.ts` — `text-properties` tab re-enabled (was intentionally disabled in ADR-345 Fase 5.5; Giorgio requested re-enable 2026-05-12 to evaluate panel content).

- **2026-05-12 — Phase 6.E follow-up: text creation tool (canvas click-to-place)**. Aggiunto nuovo strumento `text` nella DRAWING group della toolbar (icona `Type` da lucide). Flusso utente: click su pulsante "T" → `activeTool = 'text'` → click sul canvas in punto P → `TextEditorOverlay` montato a P con AST vuoto → digita → `Ctrl+Enter`/blur commit → `CreateTextCommand` dispatchato → ritorno automatico a `select` (`allowsContinuous: false`). **8-file integration (SSOT, zero duplicazione)**: (1) `ui/toolbar/types.ts` — `'text'` aggiunto a `ToolType`; (2) `systems/tools/ToolStateManager.ts` — entry `text` in `TOOL_DEFINITIONS` (category:`drawing`, `canInterrupt:true`, `allowsContinuous:false`); (3) `constants/domains/dxf-labels.ts` — `DXF_DRAWING_TOOL_LABELS.TEXT = 'tools.text'`; (4) `i18n/locales/{el,en}/dxf-viewer-shell.json` — chiave `tools.text` ("Κείμενο" / "Text"); (5) `ui/toolbar/toolDefinitions.tsx` — pulsante DRAWING + import icona `Type`; (6) **NEW** `hooks/canvas/useTextCreationTool.ts` — hook parallelo a `useTextDoubleClickEditor`, gestisce `creatingState` + click-to-anchor + commit/cancel, riusa `TextEditorOverlay` + `CreateTextCommand` + `DXF_DEFAULT_LAYER` (SSOT layer-config) + `generateEntityId` (enterprise-id service) + `useDxfTextServices`; (7) `hooks/canvas/canvas-click-types.ts` + `useCanvasClickHandler.ts` — nuovo param `onTextToolClick?: (worldPoint: Point2D) => boolean` + branch priority 5.5 prima del routing drawing/measurement standard; (8) `components/dxf-layout/CanvasSection.tsx` — wire `useTextCreationTool` prima di `useCanvasClickHandler` + render `<TextEditorOverlay>` aggiuntivo quando `textCreation.creatingState` non-null. **Edge cases**: Esc/click-fuori cancella senza creare; commit con testo vuoto/whitespace skippa la creazione (no entity fantasma). **Google-level checklist N.7.2**: ✅ Proactive (overlay al click), ✅ No race condition (single state hook), ✅ Idempotent (`existingId` preservato → undo/redo deterministico), ✅ Belt-and-suspenders (cancel+commit paths), ✅ SSOT (riuso completo overlay/command/layer/id), ✅ Sync execute, ✅ Lifecycle owner unico (`useTextCreationTool`).

- **2026-05-12 — Phase 6.E bugfix: allineamento verticale ignorato (attachment[0])**. `extractFirstRunStyle` leggeva solo `attachment[1]` (colonna H: L/C/R) e ignorava `attachment[0]` (riga V: T/M/B). Risultato: tutte le entità text erano renderizzate con `textBaseline='top'` indipendentemente dalla giustificazione TL/ML/BL/TC/MC/BC/TR/MR/BR. **3-file fix**: (1) `dxf-types.ts` — aggiunto `textBaseline?: 'top' | 'middle' | 'bottom'` a `DxfTextStyle`; (2) `useDxfSceneConversion.ts` — `attachment[0]` estratto: `M→middle`, `B→bottom`, `T` omesso (default); (3) `TextRenderer.ts` — `ctx.textBaseline = richStyle?.textBaseline ?? 'top'` (era hardcoded `'top'`); underline Y-offset corretto per tutte le baseline: `top→+0.9h`, `middle→+0.4h`, `bottom→-0.1h`.

- **2026-05-12 — Phase 6.E bugfix: underline non segue l'allineamento**. `fillRect` per l'underline partiva sempre dall'anchor point (`x=0` rotated, `screenPos.x` non-rotated). Con `textAlign='center'`/`'right'` il testo è disegnato offset dall'anchor ma l'underline restava all'anchor → sfasamento visivo. Fix: `xOff = center ? -w/2 : right ? -w : 0` applicato in entrambi i rami (rotated e non-rotated) in `TextRenderer.ts`.

- **2026-05-12 — Phase 6.E bugfix: `ToolbarToggleGroup must be used within Toolbar`**. `StylePanel` is shared between the ribbon toolbar (inside `Toolbar.Root`) and the floating `TextPropertiesPanel` (no `Toolbar.Root` parent). `Toolbar.ToolbarToggleGroup` + `Toolbar.ToggleItem` from `@radix-ui/react-toolbar` require a `Toolbar.Root` ancestor — crash in the panel context. Fix: replaced `Toolbar.ToolbarToggleGroup` wrapper → plain `<div className="inline-flex gap-1">`; replaced `Toolbar.ToggleItem` → `Toggle.Root` from `@radix-ui/react-toggle` (standalone, no parent required, same `pressed`/`onPressedChange` API, indeterminate `data-state` preserved). Works without `Toolbar.Root` in floating panel; no behavioral change in ribbon context.

- **2026-05-12 — Phase 12 COMPLETE**. AI integration (Q16): voice-to-text + NL text commands via OpenAI Responses API strict json_schema. All 7 text commands (Phase 6.A) now reachable from natural language. Closes the final ADR-344 phase milestone.
  - **`text-engine/ai/useVoiceRecorder.ts`** (NEW): browser `MediaRecorder` hook. States: `idle|recording|processing|done|error`. Max 30s auto-stop. On stop: builds `FormData` → `transcribeVoiceWithPolicy()` → transcript. SSoT: ADR-161 `/api/voice/transcribe` (not ADR-156 Telegram-specific service).
  - **`text-engine/ai/text-ai-types.ts`** (NEW): `TextAIIntentFlat` (wire format flat object — all fields nullable, discriminated by `command` enum), `TextAIContext` (entityId + scene + layerProvider + auditRecorder), `TextAIRouterResult` (discriminated union ok/error).
  - **`text-engine/ai/intent-schema.ts`** (NEW): OpenAI strict `json_schema` — 20 fields, all in `required`, all nullable except `command` (enum). `additionalProperties: false`. No oneOf/anyOf at root (memory rule). 7 command values: `create_text | update_style | update_geometry | update_paragraph | replace_one | replace_all | delete`.
  - **`text-engine/ai/system-prompt.ts`** (NEW): bilingual Greek/English system prompt. Maps §Q16 ADR examples (κάνε bold → update_style; βρες X άλλαξε σε Y → replace_all; etc.) plus English equivalents. Includes justification/color ACI mappings.
  - **`text-engine/ai/TextAICommandRouter.ts`** (NEW): `route(text, ctx)` async. `resolveIntent()` → POST `/api/dxf/text/ai/command` → `TextAIIntentFlat`. `buildCommandFromIntent()` → constructs correct `ICommand` subclass from intent + runtime ctx. `replace_one` → `ReplaceAllTextCommand([entityId])` fallback (MatchLocation resolution deferred). `makeMinimalTextNode()` builds 1-para/1-run `DxfTextNode` for `create_text`.
  - **`app/api/dxf/text/ai/command/route.ts`** (NEW): `POST /api/dxf/text/ai/command`. `withAuth` (dxf:files:view) + `withHeavyRateLimit`. OpenAI Responses API call with `TEXT_AI_INTENT_SCHEMA`. `extractOutputText()` handles both `output_text` and `output[].content[].text` response shapes. Returns `{ success, intent }`.
  - **`ui/text-toolbar/TextAIBar.tsx`** (NEW): Radix Popover, trigger = Sparkles button. Content: textarea + `VoiceMicButton` (uses `useVoiceRecorder`) + Send button + `HistoryList` (last 5). Submit: `route(text, ctx)` → `onExecuteCommand(cmd)` → history push → `'success'` flash (1.8 s). Enter key submits (Shift+Enter = newline). Error key auto-cleared on new input.
  - **`ui/text-toolbar/text-ai-bar-history.ts`** (NEW): localStorage SSoT. Key `dxf-text-ai-history`, max 10 entries. `push` deduplicates + moves to top. Safe-read/write: catches JSON parse errors + quota exceeded.
  - **`ui/text-toolbar/TextToolbar.tsx`** (MODIFIED): adds optional `aiContext?: TextAIContext` + `onExecuteAICommand?` props. Renders `<TextAIBar>` after ToolsPanel separator when both provided. Backward-compatible — callers without AI context see no change.
  - **i18n** — `el/textAi.json` + `en/textAi.json` (NEW): 12 keys covering title/subtitle/placeholder/send/mic/history/success/5 error variants. Greek file pure-Greek (zero English words).
  - **`text-engine/ai/index.ts`** (UPDATED): TODO stub replaced with real barrel (`route`, `useVoiceRecorder`, types).
  - **Follow-up deferred**: `replace_one` precise match → `ReplaceAllTextCommand` fallback in Phase 12; true first-occurrence replace requires `MatchLocation` resolution (future task). Documented in §Q16 and route comment.
  - ✅ Google-level: YES — proactive (AI call returns structured intent, never a raw string needing second-pass parsing), idempotent (sending same NL → same command shape → same scene mutation via existing idempotent Phase 6.A commands), race-free (all async on explicit user submit; no background polling), SSoT (one route owns intent resolution; ADR-161 owns Whisper transcription; Phase 6.A commands own mutations), belt-and-suspenders (AI error → error state with retry; voice transcript auto-fills textarea so user can edit before submit; history allows quick re-use of known-good commands).

- **2026-05-12 — Phase 11 COMPLETE**. Annotative scaling (Q11): viewport scale SSoT, per-entity scale list, scale-aware render pipeline, XDATA codec. ADR-040 cardinal rules respected throughout.
  - **`systems/viewport/ViewportStore.ts`** (NEW): plain module-level singleton (NOT Zustand — see §Q11 correction). State: `_activeScaleName: string`, `_scaleList: readonly AnnotationScale[]`. Granular listener sets (`activeScaleListeners`, `scaleListListeners`) — independent subscribers per channel. Setters call `markSystemsDirty(['dxf-canvas'])` so a scale change triggers a frame redraw without manual subscription wiring (parallel to `ImmediateTransformStore` Phase XIII). Skip-if-unchanged on both setters; `setScaleList` uses deep equality (name + paperHeight + modelHeight) to avoid re-render storms on no-op updates. Test-only `__resetViewportStoreForTests()` exported for unit-test isolation.
  - **`systems/viewport/ViewportContext.tsx`** (NEW): hook layer over the singleton — `useActiveScale()`, `useScaleList()`, `useActiveScaleFactor()` (derived), `useViewportSceneRedraw(onChange)` (effect-only subscriber for canvas leaves). All hooks use `useSyncExternalStore(subscribe, get, get)` triple-arg form. NO React Context Provider — name preserved for ADR continuity.
  - **`systems/viewport/standard-scales.ts`** (NEW): SSoT for AutoCAD-standard 10-scale preset catalog (1:1 → 1:1000). `buildDefaultScaleList(paperHeight)` helper. `AnnotationScaleManager.tsx` and `ViewportStore` both import from here — single source eliminates the duplicate `STANDARD_SCALES` array.
  - **`systems/viewport/index.ts`**: TODO stub replaced with real barrel exports.
  - **`ui/text-toolbar/controls/AnnotationScaleManager.tsx`** (UPDATED): adds `ViewportSection` (Select bound to `useActiveScale()` + Pull-from-viewport button), `entityOverride` amber warning when entity `currentScale` ≠ viewport `activeScale`, Sync-to-viewport button (copies entity's scale list into the viewport list and sets active to entity's current). Uses shared `STANDARD_SCALE_PRESETS`.
  - **`rendering/entities/annotative-resolver.ts`** (NEW): pure `resolveAnnotativeEntity(entity)` — for TEXT/MTEXT entities with `isAnnotative=true` and a non-empty `annotationScales` list, returns a shallow clone with `height` replaced by the active scale's `modelHeight`. Falls back to the first scale if the active name is not in the entity's list. All other entities pass through by reference. Reads `getActiveScaleName()` via getter — ADR-040 cardinal rule #3 (event-time read, no subscription in imperative renderer code).
  - **`rendering/core/EntityRendererComposite.ts`**: `render()` now passes every entity through `resolveAnnotativeEntity` before dispatching to the entity-specific renderer. `TextRenderer.ts` stays untouched per its file-level "ΜΗΝ προσθέσετε Annotation scaling" lockdown.
  - **`canvas-v2/dxf-canvas/dxf-bitmap-cache.ts`**: `CacheKey` gains `activeAnnotationScale: string`; `isDirty()` and `rebuild()` track it via `getActiveScaleName()` so the bitmap cache invalidates when the viewport scale changes (e.g. 1:50 → 1:100).
  - **`types/entities.ts`**: `TextEntity` and `MTextEntity` gain optional `isAnnotative?: boolean` and `annotationScales?: readonly EntityAnnotationScale[]` (new mirror interface of `text-engine/types`' `AnnotationScale`). Optional — non-annotative entities pay zero cost.
  - **`text-engine/parser/xdata-annotative-codec.ts`** (NEW): pure DXF XDATA codec for `AcDbAnnotativeData`. `parseAnnotativeXData(pairs, scaleResolver)` decodes the group-code-1001/1070/1071 sequence; `serializeAnnotativeXData(scales, handleResolver)` encodes it. App-block isolation tested — neighbours under different `1001` markers do not bleed across. `formatXDataLines()` produces canonical two-line-per-pair DXF output. **Wire-up TODO** noted in `convertText` / `convertMText`: full parser integration requires upstream lossy-Record refactor (separate task).
  - **i18n** — `src/i18n/locales/{el,en}/textToolbar.json` gain `annotationScale.viewportActive`, `viewportActivePlaceholder`, `syncToViewport`, `syncFromViewport`, `entityOverride`, `viewportSectionTitle`. Greek locale pure-Greek per `feedback_pure_greek_locale`.
  - **Tests** — `systems/viewport/__tests__/ViewportStore.test.ts` (granular notification, skip-if-unchanged, deep equality, getter synchronicity), `rendering/entities/__tests__/annotative-resolver.test.ts` (height override, fallback to first scale, no-op on non-annotative / non-text entities), `text-engine/parser/__tests__/xdata-annotative-codec.test.ts` (round-trip identity, app-block isolation, resolver-miss handling). All Jest-based; mock `markSystemsDirty` and reset singleton state per test via `__resetViewportStoreForTests`.
  - **ADR-040 changelog** updated (2026-05-12 entry "Phase 11.C — annotative scaling pipeline integration"): documents the upstream resolver pattern as a new pre-render integration point and adds `ViewportStore` to the micro-leaf catalog.
  - ✅ Google-level: YES — proactive (scale resolution happens at the right pipeline stage, upstream of the sealed renderer; cache invalidation is automatic via `markSystemsDirty`), idempotent (skip-if-unchanged on both setters; resolver returns same entity reference for non-annotative input), race-free (singleton with synchronous getters; no async resolution), SSoT (one store owns active scale + list; `STANDARD_SCALE_PRESETS` deduplicated; XDATA codec is the sole DXF mapper), belt-and-suspenders (entity falls back to first scale when active name absent — never renders at height 0).
  - ⚠️ Known follow-up: `dxf-entity-converters.ts` carries a TODO to wire `parseAnnotativeXData` into `convertText` / `convertMText` once the parser pipeline preserves XDATA pairs (current `Record<string,string>` flattening is lossy). The codec is ready and round-trip-tested; the wire-up is a downstream refactor.

- **2026-05-12 — Phase 10 COMPLETE**. i18n keys + IndexedDB draft/recovery (Q15) + visual regression Phase 8 (ADR-343) + ADR-040 text rendering path documentation.
  - **`DraftRecoveryService.ts`** (`text-engine/draft/`): IndexedDB via `idb` (MIT). Store: `dxf-text-drafts`, key `${companyId}:${entityId}` (tenant-scoped). API: `save()` (30 s write-debounce), `flush()` (immediate — use on editor close), `load()` (returns null if expired), `delete()`, `cleanExpired()` (auto-deletes entries > 7 days on `getDb()` init), `dispose()`. Yjs awareness: optional `yDocSnapshot: Uint8Array` stored alongside `textNode` for Yjs session recovery (Q4 + Q15 intersection). Singleton via `getDraftRecoveryService()`. Client-only — SSR guard enforced by `typeof window` at call site.
  - **`DraftRecoveryBanner.tsx`** (`ui/text-toolbar/`): non-blocking amber banner, Radix-free (plain `<aside role="status">`). Props: `draft: DraftEntry`, `onRestore`, `onDiscard`. Date formatted via `formatDateTime` (SSoT `@/lib/intl-formatting`). Icons: `RotateCcw` (restore), `Trash2` (discard). Wiring deferred — caller mounts on `draft !== null` after `draftService.load()` check on editor open.
  - **i18n** — `src/i18n/locales/{el,en}/textDraft.json`: `banner.*` (message / restore / discard / saving / saved / ariaLabel). Greek file pure-Greek per `feedback_pure_greek_locale`.
  - **Barrel** — `text-engine/draft/index.ts` stub replaced with real exports: `DraftRecoveryService`, `getDraftRecoveryService`, `DraftEntry`.
  - **`idb@7.1.1` (MIT)** added to `package.json` direct deps (was already a transitive dep in `pnpm-lock.yaml`).
  - **Visual regression Phase 8** (ADR-343 Phase 8, 4 tests): `text-entity-normal`, `text-entity-rotated`, `text-mtext-multiline`, `text-layer-hidden`. New fixture `text-mtext-multiline.json` (MTEXT block + colored TEXT + small label, 2 layers). Baselines generated on first `npm run test:visual:dxf:update`.
  - **ADR-040 changelog** updated: text rendering path (TipTap overlay, text toolbar, bitmap cache non-impact, spell decorations, CommandHistory) documented under 2026-05-12 entry. No Cardinal Rule violations.
  - ✅ Google-level: YES — proactive (IndexedDB writes are debounced so they never block the editor; `flush()` on editor close guarantees no data loss on intentional navigation; `cleanExpired()` runs at `getDb()` init so the store self-prunes without a scheduled job), idempotent (`put` is upsert — repeated saves overwrite, no duplicates), SSoT (one `DraftRecoveryService` owns all draft state; nothing else touches the `dxf-text-drafts` store), belt-and-suspenders (7-day check on `load()` + cursor scan on `cleanExpired()` — both paths prune stale data).

- **2026-05-12 — Phase 9 COMPLETE**. Find & Replace dialog (current drawing scope) — iterates all TEXT/MTEXT entities, three match modes (case-sensitive, whole-word, regex), scrollable preview list with click-to-zoom, Replace (granular `ReplaceOneTextCommand` per match) and Replace All (single `ReplaceAllTextCommand` → one undo step). Closes §8 Phase 9 deliverable.
  - **New file** — `ui/text-toolbar/FindReplaceDialog.tsx` (Radix Dialog + Radix ScrollArea): self-contained state (`searchText`, `replaceText`, `MatchOptions`, `currentMatchIndex`). `collectMatches()` iterates all `DxfTextSceneEntity` entities via `findMatches()` from `text-match-engine.ts`. `buildSnippet()` returns ±24-char context with `【match】` markers. Replace Next cycles through `matches[currentMatchIndex]`; Replace All deduplicates entity IDs → single `ReplaceAllTextCommand`. `onExecuteCommand` + `onZoomToEntity` are caller-injected so the dialog stays decoupled from CommandHistory and canvas.
  - **i18n** — `src/i18n/locales/{el,en}/textFindReplace.json`: `dialog.title`, `search.*`, `replace.*`, `options.*` (caseSensitive / wholeWord / regex), `results.*` (count_one / count_other / noMatches / noSearch / entityLabel / matchLocation), `actions.*` (replaceOne / replaceAll / close), `invalidRegex`.
  - **Barrel** — `ui/text-toolbar/index.ts` exports `FindReplaceDialog` + `FindReplaceDialogProps`.
  - **Zero new dependencies** — reuses `@radix-ui/react-dialog`, `@radix-ui/react-scroll-area` (already in project), Lucide icons `CaseSensitive`, `WholeWord`, `Regex`.
  - **Wiring deferred** — `onFindReplace` prop on `TextToolbar` / `ResponsiveTextToolbar` already exists (Phase 5.D placeholder). The caller hosts `open` state and passes `entities` + `sceneManager` + `layerProvider`; concrete wiring arrives with Phase 10 / `TextPropertiesPanelHost` real-data pass.
  - ✅ Google-level: YES — proactive (commands already existed from Phase 6.A; dialog is pure UI consuming them), idempotent (Replace All stores snapshots; undo is exact), race-free (no async ops in dialog; all state is synchronous React), SSoT (`text-match-engine.ts` is the single place that owns regex/literal/whole-word matching), belt-and-suspenders (invalid regex shows inline error, disables replace buttons; empty search returns empty list).

- **2026-05-12 — Phase 8 COMPLETE**. Client-side spell check engine — nspell (MIT) Web Worker + lazy-loaded el_GR + en_US Hunspell dictionaries + per-company Firestore custom dictionary (`text_custom_dictionary`) + TipTap ProseMirror `DecorationSet` (red wavy underline) + toolbar toggle + right-click suggestions context menu + full Manager UI. Closes §8 Phase 8 deliverable.
  - **Decisions locked (Plan Mode Q&A, 2026-05-12)**:
    - **Q1 Custom dictionary UI** → **Manager completo + context-menu inline** (industry convergence: Word, Google Docs, AutoCAD, VS Code — all four ship BOTH the inline "add to dictionary" action AND a Settings → Custom Dictionaries Manager dialog). MVP "context-menu only" was rejected per `feedback_completeness_over_mvp` (Giorgio prefers full product over phased variants).
    - **Q2 Permission model** → **Split**: `dxf:text:edit` for CREATE (any text-editor can add a term), `dxf:dictionary:view` for READ, `dxf:dictionary:manage` for UPDATE/DELETE (admin-only). Industry convergence: Microsoft 365 (per-user dict private, org-wide dict admin-only), Google Workspace (personal vs admin-shared), AutoCAD enterprise (cloud-shared dict requires admin role). Three permission tiers wired into `src/lib/auth/types.ts` + 5 roles in `roles.ts` (super_admin via bypass, company_admin = view+manage, project_manager / architect / engineer / site_manager = view only).
    - **Q3 License (CLAUDE.md N.5)** → **MPL allowed ONLY for data-asset dictionaries, NOT for npm code dependencies**. Triggered by the discovery that the original ADR-344 §Q6 BSD-2-Clause claim for `dictionary-el` was incorrect (npm registry confirms `(GPL-2.0 OR LGPL-2.1 OR MPL-1.1)` tri-license). Resolution: ship the LibreOffice el_GR Hunspell asset directly (under MPL 1.1 choice from the tri-license) into `src/subapps/dxf-viewer/text-engine/spell/dictionaries/el_GR/` with a colocated `NOTICE.md` attribution. `dictionary-en` (MIT/BSD) stays as an npm dependency. CLAUDE.md N.5 should be amended to clarify this carve-out.
  - **New module — worker spell engine** (`src/subapps/dxf-viewer/text-engine/spell/`):
    - `spell.types.ts` — discriminated-union RPC contract between main thread and worker (`SpellWorkerRequest`, `SpellWorkerResponse`, `MisspelledRange`, `CustomTermPayload`).
    - `spell.worker.ts` — Web Worker entry point. Tokenises text via `[\p{L}\p{M}]+` (Unicode-aware, keeps Greek diacritics intact), detects language by Greek/Latin script range, lazy-loads per-language nspell on first miss, applies hydrated custom terms. Pattern mirrors `workers/dxf-parser.worker.ts`.
    - `spell-checker.ts` — main-thread façade, singleton-per-process. Hand-rolled promise-based RPC over `postMessage` (no Comlink — matches dxf-parser worker simplicity). Public API: `getSpellChecker()`, `checkText()`, `suggest()`, `addCustomWord()`, `removeCustomWord()`, `hydrateCustomDictionary()`, `disposeSpellChecker()`. Worker spawn via `new Worker(new URL('./spell.worker.ts', import.meta.url), { type: 'module' })`.
    - `dictionary-loader.ts` — lazy Hunspell loader. Greek: fetches `el_GR.aff` / `el_GR.dic` from `/_next/static/dxf/dictionaries/el_GR/` (~700 KB gzipped). English: `await import('dictionary-en')` (Promise-wrapped callback API).
    - `nspell.d.ts` — ambient module declaration (upstream ships no TypeScript types).
    - `dictionaries/el_GR/{el_GR.aff,el_GR.dic,NOTICE.md}` — MPL 1.1 LibreOffice data asset + attribution.
    - `__tests__/custom-dictionary.zod.test.ts` — Zod schema unit tests (Greek + English terms, whitespace / length boundaries, language enum).
    - `index.ts` — public barrel; re-exports `getSpellChecker`, types, custom-dictionary errors.
  - **New module — Firestore custom dictionary CRUD** (server-only):
    - `custom-dictionary.types.ts` — `CustomDictionaryEntryDoc`, input/patch shapes, four tagged errors (`NotFound`, `CrossTenant`, `Validation`, `Duplicate`).
    - `custom-dictionary.zod.ts` — `term` 1-80 chars, no whitespace inside, no leading/trailing whitespace; `language` ∈ {`el`,`en`}.
    - `custom-dictionary.service.ts` — full CRUD mirroring `text-template.service.ts`: `EntityAuditService.recordChange` on every mutation, `assertSameTenant` cross-tenant guard, `findDuplicateTerm` enforces `(companyId, language, term)` uniqueness at service layer (Firestore rules cannot run cross-document predicates).
  - **New API routes** (`src/app/api/dxf/custom-dictionary/`):
    - `route.ts` — GET (list, `dxf:dictionary:view`) + POST (create, `dxf:text:edit`).
    - `[entryId]/route.ts` — GET (`dxf:dictionary:view`) + PATCH (`dxf:dictionary:manage`) + DELETE (`dxf:dictionary:manage`).
    - `_helpers.ts` — `actorFromContext`, `serializeEntry`, `mapServiceError` (404/403/400/409/500 mapping).
    - All routes wrapped with `withAuth` + `withStandardRateLimit` (pattern mirrors `text-templates`).
  - **New Firestore rules block** — `firestore.rules` `match /text_custom_dictionary/{entryId}` (immediately after `text_templates`): tenant-scoped READ via `belongsToCompany(companyId)`, CREATE/UPDATE/DELETE restricted to `isCompanyAdminOfCompany` or `isSuperAdminOnly`, `companyId` immutable on UPDATE. Identical shape to `text_templates` (defense-in-depth — clients are expected to use the API).
  - **New emulator test suite** — `tests/firestore-rules/suites/text_custom_dictionary.rules.test.ts` — matrix-driven loop reusing `textTemplateMatrix()` (30 cells) + 2 companyId-immutability regression tests. New seeder `seedCustomDictionaryEntry()` in `seed-helpers-dxf.ts`. Coverage manifest entry added between `company_fonts` and the trailing `] as const` line.
  - **TipTap extension** — `text-engine/edit/spell-check-extension.ts` — `Extension.create({ addProseMirrorPlugins() })` with state-managed `DecorationSet`; debounced 300 ms; generation counter discards stale worker results; document-change `prev.decorations.map(tr.mapping, newState.doc)` to keep decorations positionally correct between checks. Adds two Tiptap commands: `setSpellCheckEnabled(enabled)` + `rebuildSpellDecorations()`. `findMisspellingAt(state, pos)` helper translates a click position into the underlying word + language for the context menu. CSS `.spell-error` lives in `src/app/globals.css` (no inline styles per CLAUDE.md N.3).
  - **UI surface**:
    - `ui/text-toolbar/SpellCheckToggle.tsx` — toolbar button. Toggle state persisted in `localStorage` under `dxf-text-spell-enabled` (no new SSoT — MVP).
    - `ui/text-toolbar/SpellCheckContextMenu.tsx` — right-click menu on a mis-spelled word. Shows top-5 nspell suggestions + "Προσθήκη στο λεξικό" action. Optimistic local add via mutations hook, then re-hydrates worker via `addCustomWord` + `rebuildSpellDecorations()`.
    - `ui/text-dictionary/CustomDictionaryManager.tsx` — top-level page; mirrors `TextTemplateManager.tsx` shape. Permission gating: add button enabled when `useCanEditText().canEdit`; row actions visible only when `role ∈ {super_admin, admin, company_admin}`.
    - `ui/text-dictionary/CustomDictionaryList.tsx` — semantic `<table>` (CLAUDE.md N.4) with filter-by-language chips.
    - `ui/text-dictionary/CustomDictionaryEditorDialog.tsx` — Radix Dialog + Radix Select for language. Client-side Zod validation mirrors server.
    - `ui/text-dictionary/CustomDictionaryDeleteDialog.tsx` — Radix AlertDialog, Cancel as default focus (Figma/Linear/Notion pattern).
    - `ui/text-dictionary/hooks/useCustomDictionary.ts` — fetch hook + optimistic mutations hook (create / update / delete with rollback on failure).
    - `ui/text-dictionary/index.ts` — barrel.
  - **Permissions** — `src/lib/auth/types.ts`: 2 new keys `dxf:dictionary:view` + `dxf:dictionary:manage`. `src/lib/auth/roles.ts`: company_admin (view+manage), project_manager / architect / engineer / site_manager (view). super_admin gets both via `isBypass`.
  - **i18n** — `src/i18n/locales/{el,en}/textSpell.json`. Pure Greek el locale per `feedback_pure_greek_locale` (no English words mixed in). ~30 keys: toolbar (toggle on/off), context menu (add to dict / suggestions / no suggestions), Manager (title / subtitle / empty / add / filter / columns / actions / languages), editor dialog (add/edit titles / labels / hints / cancel / save / saving), delete dialog (title / message with `{term}` ICU / confirm / cancel), validation (4 inline rules), errors (duplicate / forbidden / notFound / generic), feedback (3 success toasts), engine (loading / load failed).
  - **SSoT registry** — `.ssot-registry.json` module `text-spell` refined: forbidden patterns extended to `import .* from 'dictionary-en'` and the `from 'nspell'` variant; allowlist expanded to cover the TipTap extension + UI surface + API routes.
  - **Industry-standard verification (PMR memory: "industry standard = default answer")**: every closed decision matches the convergent pattern of at least four of: Microsoft Word/365, Google Docs/Workspace, AutoCAD/Autodesk Construction Cloud, VS Code, Adobe Acrobat, Apple macOS, Mozilla Firefox/Thunderbird, Adobe.
  - **Pending follow-ups**:
    - `npm install nspell dictionary-en` to be run by the user — the in-session install hit a long-standing npm 10.8.2 arborist bug (`Cannot read properties of null (reading 'matches')`) on Windows. The `package.json` already lists both packages; a `pnpm install` or fresh `rm -rf node_modules && npm install` resolves it.
    - `next.config.js` may need an asset rule to copy `src/subapps/dxf-viewer/text-engine/spell/dictionaries/el_GR/*.{aff,dic}` into `/_next/static/dxf/dictionaries/el_GR/` at build time. If the default Next.js asset handling does not pick them up via the worker's `fetch()` calls, add a `webpack` rule (test `\.dic$|\.aff$`, type `asset/resource`).
    - Performance budget verification: typing latency target <16 ms / 60 fps. If 300 ms debounced check is still detectable on long paragraphs, switch to paragraph-level checks via `view.state.doc.descendants` traversal inside the runner.
    - Optional `pnpm`-installed lockfile reconciliation (the repo currently uses npm).
    - Unit tests for `spell-checker.ts` (mock Worker; out of MVP scope, deferred to a hardening pass).
  - ✅ Google-level: PARTIAL — engine is fully wired (worker + lazy load + Firestore + RBAC + audit + emulator suite + Manager + context menu + toggle + i18n + ADR + SSoT); the npm install blocker is environmental, not architectural. Once `node_modules` resolves, the surface is production-grade.

- **2026-05-11 — Phase 7.E COMPLETE**. Firestore rules emulator test suite for `text_templates`. Graduates the collection from `FIRESTORE_RULES_PENDING` to `FIRESTORE_RULES_COVERAGE` (ADR-298 CHECK 3.16).
  - **New canonical test file**: `tests/firestore-rules/suites/text_templates.rules.test.ts` — matrix-driven loop over all (persona × operation) cells + 2 extra companyId-immutability tests (same_tenant_admin + super_admin both denied when companyId changes on update).
  - **New matrix function**: `textTemplateMatrix()` in `tests/firestore-rules/_registry/coverage-matrices-dxf.ts` — pattern `tenant_admin_write`: read open to any same-tenant authenticated user; create/update/delete restricted to `isCompanyAdminOfCompany / isSuperAdminOnly`. `same_tenant_user × create/update/delete` → deny `(insufficient_role)`. Key delta from `fileTenantFullMatrix()`: regular tenant users cannot mutate these resource-type collections.
  - **New seed helper**: `seedTextTemplate()` in `tests/firestore-rules/_harness/seed-helpers-dxf.ts` — seeds a minimal valid `text_templates` document (id / name / category / content / placeholders / isDefault / companyId / createdBy / timestamps).
  - **Manifest changes** (`tests/firestore-rules/_registry/coverage-manifest.ts`): added `'tenant_admin_write'` to `RulesPattern` union; added `textTemplateMatrix` import; added `text_templates` entry to `FIRESTORE_RULES_COVERAGE` (rulesRange [3904, 3941]); removed `text_templates` from `FIRESTORE_RULES_PENDING` with migration comment.
  - **Deferred** (not in scope for Phase 7.E): server-side unique-name check on duplicate (no symptom at zero-tenant baseline); composite Firestore index on `companyId + name` (no `FAILED_PRECONDITION` yet); Phase 4 TipTap rich content editor; company_fonts rules suite (same pattern — will reuse `textTemplateMatrix()` when Phase 6.F lands).
  - ✅ Google-level: YES — matrix covers all 5 personas × 6 operations (30 cells) + 2 immutability regression tests; pattern function is reusable for `company_fonts` Phase 6.F; CHECK 3.16 will now enforce coverage on every commit touching `text_templates`.

- **2026-05-11 — Phase 7.D COMPLETE**. Text-template management UI (list / create / edit / delete) + thin API routes + WYSIWYG mini-canvas preview. Closes the §8 Phase 7 management-UI deliverable.
  - **Decisions locked (2026-05-11, Giorgio, Plan Mode Q&A)**:
    - **Q1 Preview rendering** → **mini canvas WYSIWYG** (industry convergence: AutoCAD Block Editor / Revit Title Block / MText preview all render the real text artefact, not a monospace approximation). Implementation reuses the same `TextRunStyle` attributes as the full `DxfRenderer` (font family / weight / italic / colour / height / decorations) via a Canvas-2D primitive renderer kept inside `ui/text-templates/preview/canvas-text-renderer.ts`; mounting the full `DxfRenderer` (with `HoverStore` / `ImmediatePositionStore` / `UnifiedFrameScheduler`) for a 360×N preview pane was rejected as scaffolding for no visible UX benefit at this scope.
    - **Q2 Built-ins lifecycle** → **read-only + Duplicate creates editable user copy** (Autodesk Block Library / Office templates / Figma components convergence). Built-ins surface a "Σύστημα" badge + lock tooltip; Edit/Delete row actions are conditionally rendered only for user templates; Duplicate is offered on both and prefixes `" (copy)"`. The unique-name pass remains a Phase 7.E follow-up (the service today accepts duplicate names — see §7-BIS pending list).
    - **Q3 Delete confirmation** → **Radix `AlertDialog`** with Cancel as default focus (Figma / Linear / Notion / Vercel / Adobe pattern). Inline two-step + type-to-confirm were rejected: not catastrophic enough for type-to-confirm, mis-click-prone for inline. Optimistic delete happens at the mutation hook; the dialog only confirms intent.
    - **Q4 Permission UX** → **show + disabled + tooltip** (Autodesk grey-out / GitHub disabled-with-explanation / Slack-admin pattern). The full button vocabulary (New / Edit / Delete / Duplicate) stays visible so non-privileged users discover the feature and know what role they need; `useCanEditText()` (Phase 5.B) drives the `disabled` + tooltip text via the `manager.permission.requiresRole` i18n key.
  - **New canonical UI module**: `src/subapps/dxf-viewer/ui/text-templates/` (12 files split for N.7.1 — every file ≤300 lines):
    - `TextTemplateManager.tsx` (~180) — top-level orchestrator: wires `useUserRole().user.companyId` → `useTextTemplates(companyId)` → `useTextTemplateMutations` → list/preview/editor/delete leaves. Owns selection state, search query, category filter, editor open/close, delete-target.
    - `TextTemplateList.tsx` (~210) — left pane: search input + Radix `Select` category filter + two `<section>` groups (`builtInSection` + `userSection`) of selectable rows. Row actions (Duplicate / Edit / Delete) are gated on the `TextEditCapabilities` and hidden for built-ins where they don't apply. Empty user list → friendly empty-state copy.
    - `preview/TextTemplatePreview.tsx` (~80) — `<canvas>` wrapper that observes its container with `ResizeObserver`, dispatches re-renders on template/scope changes, sets `devicePixelRatio` for crisp output.
    - `preview/canvas-text-renderer.ts` (~210) — pure Canvas-2D primitive: measures every run (`buildFontString`/`measureRun`/`measureStack`), computes paragraph bbox + auto-fit scale, dispatches the 9-point attachment offset, draws each segment with per-run font/colour/decoration. Supports underline / overline / strikethrough as `fillRect` strokes and renders the three `TextStack` variants (tolerance / diagonal / horizontal). Multi-column / bgMask / oblique-angle are explicit non-goals at preview scope (documented in the module header).
    - `preview/dxf-color-to-css.ts` (~35) — `DxfColor → CSS` mapping with a minimal 8-entry ACI palette; ByLayer/ByBlock fall back to a caller-supplied inherit colour, TrueColor serialises as `rgb()`.
    - `editor/TextTemplateEditorDialog.tsx` (~200) — Radix `Dialog` (ADR-001 — never `EnterpriseComboBox`). Layout: name input + category Radix `Select` + content `<textarea>` (MVP — full TipTap arrives with Phase 4 collab merge) + live preview canvas + side `PlaceholderPicker`. Client-side validation surfaces `name.error.empty` / `name.error.tooLong` (mirrors `TEXT_TEMPLATE_NAME_MAX` from Phase 7.B) and `content.error.empty`; server-side Zod remains authoritative. `classifyPlaceholders(contentText).unknown` is surfaced as an amber warning chip (`content.helpUnknown`) so the architect sees stale tokens without the dialog refusing to submit. Dirty-confirm on Cancel/Esc/outside-click prevents accidental loss.
    - `editor/useEditorState.ts` (~100) — extracted form state hook: name / category / contentText / nameError / contentError / unknownPlaceholders + `insertAtCaret(token)` that splices a `{{path}}` token at the textarea's caret. Effectively a controlled-form reducer kept out of the dialog component so the JSX stays readable.
    - `editor/text-ast-bridge.ts` (~80) — `astToPlainText` / `plainTextToAst` for the MVP textarea workflow. Documented trade-off: editing a Duplicate of a styled built-in flattens per-run style (the textarea has no way to express bold/italic/colour); Phase 4 TipTap will preserve them. The bridge preserves the root attributes (attachment / rotation / annotation scales) by seeding from the source AST.
    - `PlaceholderPicker.tsx` (~70) — sidebar with the 17 paths grouped by source (`company` / `project` / `drawing` / `user` / `revision` / `date`); each button shows the human label (`textTemplates:placeholders.<source>.<key>`) and the raw token; click emits the wrapped `{{path}}` to the editor.
    - `TextTemplateDeleteDialog.tsx` (~75) — Radix `AlertDialog` with Cancel as default focus + red "Διαγραφή" confirm; optimistic delete is performed by the mutation hook, so the dialog just awaits the promise and surfaces errors inline.
    - `hooks/useTextTemplates.ts` + `hooks/template-cache.ts` + `shared/serialized-template.types.ts` (~120 total) — list fetch over `/api/dxf/text-templates`, in-memory `Map<companyId, TextTemplate[]>` cache keyed by tenant, `deserializeUserTemplate` (ISO timestamps → `Date`); returns `{ builtIn, user, all, loading, error, refresh, setUserTemplatesLocal }`.
    - `hooks/useTextTemplateMutations.ts` (~170) — `createTemplate` / `updateTemplate` / `deleteTemplate` / `duplicateTemplate` with optimistic UI + snapshot rollback on failure + `TemplateMutationError` (carries `status` / `code` / `details` for the UI to localise).
    - `hooks/useTextTemplatePreviewScope.ts` (~60) — hoists every `PLACEHOLDER_REGISTRY.<path>.sample` into a flat `PlaceholderScope` (used by the manager preview AND the editor live-preview); accepts `'el' | 'en'` locale.
    - `index.ts` — public barrel (manager / list / preview / dialogs / hooks).
  - **New thin API routes** (`src/app/api/dxf/text-templates/`):
    - `route.ts` — `GET` (list, `dxf:files:view` permission) → `{ success, templates: SerializedUserTextTemplate[] }`; `POST` (create, `dxf:text:create`) → `{ success, template }` 201. Both routes are wrapped with `withStandardRateLimit(withAuth(…))`, body validation happens in the service (Zod), errors are normalised to `{ success: false, error, code, details? }`.
    - `[templateId]/route.ts` — `GET` (`dxf:files:view`) / `PATCH` (`dxf:text:edit`) / `DELETE` (`dxf:text:delete`). Tenant isolation enforced by the service (`TextTemplateCrossTenantError` → 403); `TextTemplateNotFoundError` → 404; `TextTemplateValidationError` → 400 with the flat `issues[]` list from `collectIssues`.
    - `_helpers.ts` — `serializeTemplate` (Admin-SDK `Timestamp` → ISO string for the wire), `actorFromContext` (`TextTemplateActor` from `AuthContext`), `mapServiceError` + `errorResponse` (tagged-error → HTTP). Route-local — not re-exported from any barrel. CLAUDE.md N.6 honoured: no inline Firestore writes; every CRUD path flows through `text-template.service.ts`.
  - **i18n locales** (CLAUDE.md N.11, ADR-280): both `src/i18n/locales/{el,en}/textTemplates.json` extended with `manager.*` (~25 keys: title / ariaLabel / list+preview ariaLabels / newButton / refresh / search / categoryFilter / builtInSection / userSection / builtinBadge / builtinReadOnlyTooltip / loading / emptyState / previewEmptyTitle / previewEmptyLabel / placeholdersCount / duplicate / edit / delete / category.* / deletePrompt.* / permission.requiresRole), `editor.*` (~20 keys: title.create / title.edit / name.* / category.label / content.* / placeholderPicker.* / previewAriaLabel / previewPlaceholderName / submit / submitting / cancel / dirtyConfirm), and `errors.*` (notFound / validation / crossTenant / generic). Greek file remains 100% Greek per `feedback_pure_greek_locale` — no English fallbacks anywhere.
  - **Tests** (`ui/text-templates/__tests__/`):
    - `text-ast-bridge.test.ts` — 7 tests: roundtrip preservation, multi-paragraph splitting, placeholder token verbatim preservation, base-AST attribute inheritance, empty-paragraph fallback.
    - `dxf-color-to-css.test.ts` — 4 tests: ByLayer/ByBlock inherit, ACI palette hit, ACI palette miss → fallback, TrueColor `rgb()` serialisation.
    - `useTextTemplates.test.tsx` — 4 tests: built-ins synchronous + user fetch happy path, fetch error surfacing, refresh re-fetch, `null` companyId short-circuit.
    - `useTextTemplateMutations.test.tsx` — 4 tests: create optimistic + reconcile, create rollback on 400, delete optimistic + rollback on 500, duplicate suffix.
    - `useTextTemplatePreviewScope.test.tsx` — 3 tests: sample-registry coherence, revision-date parsing, locale parameter passthrough.
  - **`.ssot-registry.json`** — `text-templates` module description bumped to mention the Phase 7.D management UI (`ui/text-templates/`); `forbiddenPatterns` unchanged (the existing allowlist already covers `ui/text-templates/`).
  - **Pending follow-ups**: ~~Phase 7.E `text_templates.rules.test.ts` emulator suite~~ → DONE (Phase 7.E, 2026-05-11); Phase 4 TipTap-driven rich content editor (replaces the MVP `<textarea>` and preserves per-run style on edit); server-side unique-name check on duplicate (today the service accepts duplicate names — deferred to hardening pass); composite Firestore index on `companyId + name` if Phase 7.B query begins to throw `FAILED_PRECONDITION` once real tenants land (no symptom yet at zero-tenant baseline).
  - ✅ Google-level: YES — proactive (preview reuses the same per-run style attributes the full renderer applies, so the WYSIWYG promise is structurally true rather than a stylistic approximation), idempotent (every mutation snapshots → applies → reconciles or rolls back; duplicate fetches share the in-memory cache), single source of truth (Phase 7.A `BUILT_IN_TEXT_TEMPLATES` is the only source for built-ins; the Phase 7.B service is the only writer; the Phase 7.C resolver is the only substituter), explicit owner (manager owns lifecycle, hooks own data fetching, dialogs own user intent), belt-and-suspenders (client-side `nameError` + `contentError` AND server-side Zod; client-side capability gating + server-side `withAuth({permissions})`; optimistic UI + rollback). Unknown placeholders surface as warnings instead of blocking — preserves Phase 7.C's "loud literal" contract end-to-end.

- **2026-05-11 — Phase 7.C COMPLETE**. Placeholder resolver (pure substitution + server-only scope hydration). Closes the Q5 follow-up resolver design.
  - **Decisions locked (2026-05-11, Giorgio, Plan Mode Q&A)**:
    - Unknown placeholder (typo / removed field) → **kept literal** as `{{x.y}}` in the rendered text. Rationale: silent collapse to `''` would hide template breakage; loud `<UNKNOWN: ...>` would corrupt layout. AutoCAD/Word behave the same way.
    - Known placeholder, value missing in scope → **substituted with empty string `''`**. Rationale: the architect sees a clean output ("Κύριος: ") and understands the data is missing, not the template.
    - Date format (`{{date.today}}`, `{{revision.date}}`) → **locale-aware via `Intl.DateTimeFormat`**. `el` → `dd/mm/yyyy`, `en` → `m/d/yyyy`. Locale read from `scope.formatting.locale`.
    - `{{revision.number}}` → **raw value**. The "Rev. " / "Αναθεώρηση: " prefix lives in the template text (i18n-friendly, max flexibility).
  - **New canonical module**: `text-engine/templates/resolver/` (registered under `.ssot-registry.json` module `text-templates` — same tier-3 SSoT as the CRUD service):
    - `resolver/variables.ts` — `PlaceholderPath` string-literal union (17 paths: 1 company + 3 project + 4 drawing + 4 user + 4 revision + 1 date), `PLACEHOLDER_REGISTRY` metadata table (`labelI18nKey` + `source` + `sample`), `ALL_PLACEHOLDER_PATHS` (sorted, frozen), `isKnownPlaceholder()` narrowing predicate, `getPlaceholderMetadata()` accessor.
    - `resolver/scope.types.ts` — `PlaceholderScope` (flat shape, one slot per source namespace), narrow sub-types `PlaceholderScopeCompany` / `Project` / `Drawing` / `User` / `Revision` (every field optional, every field read-only), `PlaceholderScopeFormatting` (`locale` + deterministic `today` clock for tests), `EMPTY_PLACEHOLDER_SCOPE` constant. Sub-types intentionally diverge from `src/types/project.ts` etc. — the builder picks only the 3-4 fields the resolver needs.
    - `resolver/resolver.ts` — three pure entry points: `resolvePlaceholdersInString(text, scope)` (regex replace; unknown paths preserved verbatim; known paths dispatched to per-source readers via a `Record<PlaceholderSource, reader>` map), `resolvePlaceholdersInNode(node, scope)` (immutable walk over paragraphs → runs → stacks, preserves attachment / rotation / columns / annotation scales, returns the same reference when no substitution happened — cheap memo guard for callers), `resolveTemplate(template, scope?)` (convenience wrapper over `TextTemplate`), `classifyPlaceholders(text)` (static analysis: returns `{ known, unknown }` for the management UI to highlight stale tokens). Zero I/O — production-fast, test-deterministic.
    - `resolver/scope-builder.ts` — server-only (`import 'server-only'`) Admin-SDK reader. Public API: `buildPlaceholderScope({ companyId, projectId?, userId?, checkerUserId?, drawing?, revision?, formatting? })`. Reads from `COLLECTIONS.COMPANIES` / `PROJECTS` / `USERS` with a per-doc try/catch (telemetry warn on failure, never throws — a missing user must not block template insertion). Cross-tenant guard: every project doc is verified to carry the expected `companyId` before its fields are projected; mismatches drop the `project` scope and log a warning. Field-projection helpers tolerate schema drift (`displayName` || `fullName` || `firstName + lastName` for the user fullName, `name` || `companyName` for legacy companies, `linkedCompanyName` || `company` for project owner). Returns a frozen scope.
    - `resolver/index.ts` — internal barrel re-exporting the pure surface + types + registry. `scope-builder` is intentionally NOT re-exported here (server-only); API routes import it directly from `./scope-builder`.
  - **i18n locales** (CLAUDE.md N.11, ADR-280): new `src/i18n/locales/{el,en}/textTemplates.json` with `placeholders.<source>.<key>` labels for every registry entry. Greek file is 100% Greek per `feedback_pure_greek_locale` (no English fallbacks — "Όνομα Έργου", "Αριθμός Φύλλου", etc.). Used by Phase 7.D management UI to display human-friendly labels next to each `{{x.y}}` in the editor and by the variables test to assert SSoT coherence.
  - **Public barrel** (`text-engine/templates/index.ts`): Phase 7.C resolver surface re-exported for client + server: `resolvePlaceholdersInString` / `resolvePlaceholdersInNode` / `resolveTemplate` / `classifyPlaceholders` / `PLACEHOLDER_REGISTRY` / `ALL_PLACEHOLDER_PATHS` / `isKnownPlaceholder` / `getPlaceholderMetadata` / `EMPTY_PLACEHOLDER_SCOPE` + the `PlaceholderPath` / `PlaceholderScope*` type bundle. Scope builder remains direct-import only (`text-engine/templates/resolver/scope-builder`).
  - **`.ssot-registry.json`** — `text-templates` module description rewritten to make explicit that the resolver in `templates/resolver/` is part of the same SSoT (the existing `forbiddenPatterns` already blocked `resolvePlaceholders` definitions outside the templates folder, allowlist already covered the resolver path).
  - **Tests** (`__tests__/`):
    - `variables.test.ts` — 12 tests: registry size (17), alphabetical sort, every `labelI18nKey` namespaced under `textTemplates:placeholders.*`, every key resolves in BOTH `el` + `en` locale files (catches drift between code-side registry and translator JSON), every `source` matches the path's namespace, every built-in template uses only registered paths (catches typos in `defaults/*.ts`), `isKnownPlaceholder` / `getPlaceholderMetadata` true/false/empty.
    - `resolver.test.ts` — 22 tests: known substitution (single, multi, inner-whitespace, raw revision number); date formatting (el `dd/mm/yyyy`, en `m/d/yyyy`, revision date, default locale fallback); missing-value-in-scope → empty string; unknown path preserved literal; mixed known+unknown line; no-`{{` early return; node walker preserves attachment + rotation; walks `TextStack` top+bottom; same-reference memo when no substitution; convenience `resolveTemplate` over `TITLE_BLOCK_EL`; `classifyPlaceholders` split.
    - `scope-builder.test.ts` — 14 tests: company hydration + missing doc + legacy `companyName` fallback; project hydration + cross-tenant rejection + missing doc + omitted `projectId`; user fullName from `displayName` and from `firstName + lastName`; checker merge into user scope; standalone checker without main user; drawing / revision / formatting passthrough; frozen result. Admin SDK mocked with an in-memory `Record<collectionName, Map<docId, data>>` so tests run in ~1s with no emulator.
  - **114/114 tests green** for the `templates` module (62 baseline Phase 7.B + 52 new Phase 7.C = 22 resolver + 12 variables + 14 scope-builder + 4 implicit via existing defaults test reaching the registry through `extractPlaceholders`). No `any`, no `@ts-ignore`, every Phase 7.C file ≤290 lines (N.7.1: variables 165, scope.types 75, resolver 175, scope-builder 175, locales N/A).
  - **Pending follow-ups**: Phase 7.D `TextTemplateManager.tsx` (list / create / edit / delete UI on top of Phase 7.B service via thin API routes — labels read from `textTemplates.json` via `useTranslation`); Phase 7.E `text_templates.rules.test.ts` emulator suite; Phase 7.F bulk i18n (only the resolver registry labels are in `textTemplates.json` today — the UI strings arrive with Phase 7.D and are tracked separately).
  - ✅ Google-level: YES — proactive (resolver is pure, can be unit-tested without an emulator and previewed in the management UI with mocked scopes; scope-builder swallows per-doc fetch failures so a flaky users collection never breaks template insertion), idempotent (resolver is referentially transparent — same input + same scope → same output, same DxfTextNode reference when nothing matched), single source of truth (`PLACEHOLDER_REGISTRY` is the only place that lists supported paths; the variables test asserts the locale files are kept in sync), explicit owner (the resolver module owns substitution; the scope-builder owns Firestore reads; the CRUD service owns persistence — three modules, three lifecycles, no overlap), belt-and-suspenders (Firestore rules already block cross-tenant project reads via the Admin-SDK rules bypass; the scope-builder enforces `companyId` again at the service boundary).

- **2026-05-11 — Phase 7.B COMPLETE**. Firestore CRUD service for user text templates + rules + entity audit + Zod validation + tests:
  - `text-engine/templates/text-template.types.ts` — `UserTextTemplateDoc` (Firestore-persisted shape: `companyId` required, admin-SDK `Timestamp` for `createdAt`/`updatedAt`, full `createdBy` / `createdByName` / `updatedBy` / `updatedByName` audit denormalization, `isDefault: false` literal), `CreateTextTemplateInput` / `UpdateTextTemplateInput` (server-derived fields stripped — `id` / timestamps / `placeholders` / audit fields are NOT caller-controlled), `TextTemplateActor` (audit-attribution payload), tagged-error union `TextTemplateNotFoundError` / `TextTemplateCrossTenantError` / `TextTemplateValidationError`.
  - `text-engine/templates/text-template.zod.ts` — `createTextTemplateInputSchema` + `updateTextTemplateInputSchema` (strict mode — extra keys rejected, empty patches rejected), `TEXT_TEMPLATE_NAME_MAX = 120`, lightweight `DxfTextNode` guard (paragraphs non-empty, attachment enum, line-spacing mode + finite-positive factor, finite rotation) — deep semantic validation stays in the editor. `collectIssues(ZodError)` helper flattens issues into `"path: message"` strings for audit/UI surfaces.
  - `text-engine/templates/text-template.service.ts` — server-only Admin-SDK CRUD: `listTextTemplatesForCompany` (ordered by name ASC), `getTextTemplateById` (cross-tenant guard), `createTextTemplate` (Zod-validated, `setDoc + generateTextTemplateId` per N.6, placeholders derived server-side via Phase 7.A `extractPlaceholders`), `updateTextTemplate` (re-derives placeholders when `content` is patched, audits only changed fields, no-op audit when patch produces zero diffs), `deleteTextTemplate`. Every mutation calls `EntityAuditService.recordChange({ entityType: 'text_template', … })` with diffed `AuditFieldChange[]`; audit failures are logged and swallowed so a transient audit-trail outage cannot break template management.
  - `src/types/audit-trail.ts` — `AuditEntityType` union extended with `'text_template'`.
  - `scripts/check-entity-audit-coverage.js` — `TRACKED_COLLECTION_KEYS` extended with `TEXT_TEMPLATES` so CHECK 3.17 ratchets future writes; baseline stays at `0 / 0` because the service is the sole writer and it records audit on every mutation.
  - `firestore.rules` — new `match /text_templates/{templateId}` block immediately after `company_fonts`: tenant-scoped READ via `belongsToCompany(companyId)`, CREATE/UPDATE/DELETE restricted to `isCompanyAdminOfCompany` (or `isSuperAdminOnly`), `companyId` immutable on UPDATE. Pattern is identical to the Phase 6.E `company_fonts` rules so `coverage-matrices-dxf.ts` will be able to reuse `fileTenantFullMatrix()` (or a near-clone) when the suite lands in Phase 7.E.
  - `tests/firestore-rules/_registry/coverage-manifest.ts` — `'text_templates'` added to `FIRESTORE_RULES_PENDING` (full emulator suite deferred to Phase 7.E alongside `company_fonts` follow-ups). CHECK 3.16 stays green: the rule shape is registered, the suite is staged.
  - `.ssot-registry.json` — `text-templates` module hardened: `ssotFile` now points at `text-template.service.ts` (was the templates folder), `forbiddenPatterns` extended with `COLLECTIONS\\.TEXT_TEMPLATES` + `['"']text_templates['"']` (any reference outside the templates folder or `firestore-collections.ts` is rejected), tier promoted 4 → 3 now that the service is the authoritative writer.
  - `text-engine/templates/index.ts` — barrel extended with Phase 7.B exports (types + Zod schemas + `collectIssues`). The Admin-SDK service itself is **not** re-exported — it carries `import 'server-only'` and must be imported directly by API routes to keep client bundles clean.
  - `__tests__/text-template.zod.test.ts` — 15 tests: happy path, empty/long name, unknown category, empty `companyId`, zero-paragraph content, invalid attachment, non-finite rotation, strict-mode extra keys, empty patch rejection, `collectIssues` shape.
  - `__tests__/text-template.service.test.ts` — 17 tests: create persists doc + emits `created` audit, validation-error path skips audit, placeholders derived from content; `getTextTemplateById` covers found / not-found / cross-tenant; `listTextTemplatesForCompany` is tenant-scoped; `updateTextTemplate` emits `updated` audit on name diff, swallows no-op patches, rejects empty patches, refuses cross-tenant, re-derives placeholders on content patch; `deleteTextTemplate` removes doc + emits `deleted` audit, throws on missing, refuses cross-tenant. All 17 use an in-memory `docs: Map<string, DocState>` fake of the Admin SDK collection/doc/get/set/update/delete shape.
  - **62/62 tests green** for the templates module (14 extract + 16 defaults + 15 zod + 17 service). No `any`, no `@ts-ignore`, every file ≤320 lines (N.7.1: service 280, types 90, zod 110, service tests 320, zod tests 150).
  - Pending follow-ups: Phase 7.C placeholder resolver (variable registry + project/contact/user store look-ups); Phase 7.D `TextTemplateManager.tsx` (list / create / edit / delete UI on top of the Phase 7.B service via thin API routes); Phase 7.E `text_templates.rules.test.ts` emulator suite (graduates from `FIRESTORE_RULES_PENDING` once the matrix is wired); Phase 7.F i18n locales (`textTemplates.json`) so the management UI labels are translatable.
  - ✅ Google-level: YES — proactive (`placeholders` derived server-side at write time, never trusted from caller; cross-tenant guard at service boundary even though rules already enforce it; audit-failure isolation so trail outages don't break CRUD), idempotent (Firestore `set`/`update`/`delete` natural idempotency + `companyId` immutable in rules), single source of truth (`text-template.service.ts` is the only writer per `.ssot-registry.json` Tier 3), explicit owner (the service module owns the lifecycle — API routes are thin call-throughs in Phase 7.D).

- **2026-05-11 — Phase 7.A COMPLETE**. Built-in template TypeScript constants + placeholder extractor (no Firestore, no UI yet):
  - `text-engine/templates/template.types.ts` — `TextTemplate` (canonical shape for built-ins + Firestore docs), `BuiltInTextTemplate` (narrowed view: `companyId: null`, `isDefault: true`, locale tag), `TextTemplateCategory` union (`title-block` | `stamp` | `revision` | `notes` | `scale-bar` | `custom`), `TextTemplateLocale` (`el` | `en` | `multi`), `TextTemplatePlaceholderMismatchError`. Built-ins use `id: "builtin/<slug>"` (never an enterprise ID — keeps Firestore prefix `tpl_text` free for user-created records).
  - `text-engine/templates/extract-placeholders.ts` — `extractPlaceholdersFromString(text)` (regex `\{\{\s*<dot.path>\s*\}\}`, tolerates whitespace, rejects single-segment & malformed forms) + `extractPlaceholders(node)` (DxfTextNode walker that also descends into `TextStack.top` / `TextStack.bottom`). Returns sorted, deduped paths.
  - `text-engine/templates/defaults/template-helpers.ts` — compact builders: `DEFAULT_RUN_STYLE` / `HEADING_RUN_STYLE` / `CAPTION_RUN_STYLE`, `makeRun` / `makeParagraph` / `makeNode`, `makeBuiltIn({...})` (auto-extracts placeholders, freezes them).
  - `text-engine/templates/defaults/title-blocks.ts` — `TITLE_BLOCK_EL` + `TITLE_BLOCK_EN` (bottom-right corner placement, 11 paragraphs each, placeholders: `company.name`, `project.name`/`code`/`owner`, `drawing.title`/`scale`/`sheetNumber`, `user.fullName`/`checkerName`, `revision.number`/`date`, `date.today`).
  - `text-engine/templates/defaults/stamps.ts` — `SIGNOFF_STAMP_EL` + `SIGNOFF_STAMP_EN` + `APPROVAL_STAMP_EL` (top-left placement, placeholders: `user.fullName`/`title`/`licenseNumber`, `project.name`, `date.today`).
  - `text-engine/templates/defaults/notes.ts` — `GENERAL_NOTES_EL` + `GENERAL_NOTES_EN` (7 numbered paragraphs, 1.2× line spacing for readability).
  - `text-engine/templates/defaults/revision.ts` — `REVISION_TABLE_EL` + `REVISION_TABLE_EN` (top-right, header + 1 placeholder row + 2 empty rows for manual entry).
  - `text-engine/templates/defaults/scale-bar.ts` — `SCALE_BAR_MULTI` (bilingual caption, locale `multi`).
  - `text-engine/templates/defaults/index.ts` — registry: `BUILT_IN_TEXT_TEMPLATES` (10 templates, frozen array) + `BUILT_IN_TEXT_TEMPLATES_BY_ID` (Map) + `BUILT_IN_TEXT_TEMPLATES_BY_CATEGORY` (Map per category, each bucket frozen).
  - `text-engine/templates/index.ts` — barrel: types + `extractPlaceholders*` + every built-in plus registry maps.
  - `__tests__/extract-placeholders.test.ts` — 14 tests: whitespace, single-segment rejection, deep paths, regex state reset, DxfTextNode walk, TextStack scan.
  - `__tests__/defaults.test.ts` — 16 tests: category coverage, companyId/isDefault/timestamps invariants, id uniqueness + `builtin/<slug>` format, i18n key prefix, paragraph non-empty, **placeholder declared = scanned exactly**, sorted+unique, registry/category map consistency, per-template anchor/locale spot checks.
  - **30/30 tests green.** No `any`, no `@ts-ignore`, no inline styles, every file ≤170 lines (N.7.1).
  - `tpl_text` prefix + `generateTextTemplateId` already in `enterprise-id-prefixes` / `enterprise-id-convenience` (added by an earlier scaffold). `COLLECTIONS.TEXT_TEMPLATES` / `TEXT_CUSTOM_DICTIONARY` already in `firestore-collections.ts`. Phase 7.B will wire Firestore service + rules + entity audit; Phase 7.C the resolver; Phase 7.D the management UI; Phase 7.E i18n locales (`textTemplates.json`).

- **2026-05-11 — Phase 6.F addendum — company_fonts rules emulator test**. Graduates `company_fonts` from `FIRESTORE_RULES_PENDING` to `FIRESTORE_RULES_COVERAGE` (ADR-298 CHECK 3.16). Implemented alongside Phase 7.E to reuse the newly created `textTemplateMatrix()`.
  - **New test file**: `tests/firestore-rules/suites/company_fonts.rules.test.ts` — 27 tests (25 matrix + 2 companyId-immutability), reusing `textTemplateMatrix()` from `coverage-matrices-dxf.ts` (identical rule shape to `text_templates`).
  - **New seed helper**: `seedCompanyFont()` in `tests/firestore-rules/_harness/seed-helpers-dxf.ts`.
  - **Manifest**: `company_fonts` added to `FIRESTORE_RULES_COVERAGE` (rulesRange [3847, 3885]); removed from `FIRESTORE_RULES_PENDING`.

- **2026-05-11 — Phase 6.E + 6.F COMPLETE**. Firestore rules for `company_fonts` + SSoT registry update — closes Phase 6.
  - `firestore.rules` — new `match /company_fonts/{fontId}` block (before the closing braces of `match /databases/{database}/documents`): tenant-scoped READ via `belongsToCompany(companyId)`, CREATE/UPDATE/DELETE restricted to `isCompanyAdminOfCompany` (or `isSuperAdminOnly`), `companyId` immutable on update. `text_templates` + `text_custom_dictionary` deferred to Phase 7 (collection schema lives there).
  - `.ssot-registry.json` — `text-commands` module extended: `forbiddenPatterns` now covers every Phase 6.A command class (Create/UpdateStyle/UpdateGeometry/UpdateMTextParagraph/Delete/ReplaceAll/ReplaceOne) plus `assertCanEditLayer`; description mentions the layer guard + match engine SSoT.
  - `.ssot-registry.json` — new `text-snap` module: forbids re-implementing `getTextSnapPoints` outside `text-engine/interaction/`. Tier 4, addedByAdr ADR-344.
  - `.ssot-registry.json` — new `text-grip` module: forbids re-implementing `TextGripHandler` / `DirectDistanceEntry` / `computeGrips` / `hitTestGrips` outside `text-engine/interaction/`. Tier 4, addedByAdr ADR-344.
  - Phase 6 status: **all sub-phases (6.A–6.F) complete**. Pending follow-ups:
    - SSoT discovery baseline (CHECK 3.18) may need refresh after these registry edits — run `npm run ssot:discover:baseline` once Phase 6 is committed.
    - Entity audit coverage baseline (CHECK 3.17) update is still tracked for Phase 7 when DXF text entities persist to Firestore and the audit recorder is wired to `/api/audit-trail/record`.

- **2026-05-11 — Phase 6.D wiring COMPLETE**. `TextPropertiesPanelHost` real data sources + 4 hooks:
  - `ui/text-toolbar/hooks/useCurrentSceneModel.ts` — reads current scene model ref from context (shared accessor for all panel hooks).
  - `ui/text-toolbar/hooks/useTextPanelLayers.ts` — `useTextPanelLayers()`: subscribes to LayerStore, maps to `LayerSelectorEntry[]` for TextPropertiesPanel.
  - `ui/text-toolbar/hooks/useTextPanelFonts.ts` — `useTextPanelFonts()`: merges `fontCache` company fonts + scene STYLE table fonts → deduped `string[]`.
  - `ui/text-toolbar/hooks/useTextPanelDocumentVersion.ts` — `useTextPanelDocumentVersion()`: reads `$ACADVER` from scene header → `DxfDocumentVersion` enum.
  - `TextPropertiesPanelHost.tsx` — stub-data replaced with real hooks. `onRequestFontUpload` + `onInsertToken` remain stubs → Phase 7 (portaled modal + live TipTap handle).

- **2026-05-11 — Phase 6.D COMPLETE**. Layer 6 Interaction — grip geometry, grip handler, snap provider, direct distance entry:
  - `text-engine/interaction/TextGripGeometry.ts` — `computeTextGrips(entity, viewMatrix)`: derives grip hit-areas (insertion point, width handle, rotation handle) from `DxfTextSceneEntity` + current view scale. Returns `TextGrip[]` with `kind` (insert/width/rotate), world position, screen rect. `transformWorldToScreen` helper.
  - `text-engine/interaction/TextGripHandler.ts` — `TextGripHandler` class: `onGripHover`, `onGripPress`, `onGripDrag`, `onGripRelease`. Dispatches `UpdateTextGeometryCommand` on release (ADR-031 command pattern). Drag-preview updates `GripSnapStore` (ADR-040) to snap crosshair. 261 lines (≤500 limit).
  - `text-engine/interaction/TextSnapProvider.ts` — `getTextSnapPoints(entity, layout)`: returns snap points (insertion, mid-frame, corners, baseline-end) as `TextSnapPoint[]`. `toSnapCandidates`: converts to `ISnapCandidate` for the unified snap bus (Q21). `TextSnapKind` union.
  - `text-engine/interaction/DirectDistanceEntry.ts` — `parseDDE(input)`: parses `<distance><angle>` polar notation (e.g. `10<45`) → `{ distance, angleRad }`. `applyDDE(origin, dde)` → `Point2D`. Used by text placement workflow for keyboard-driven positioning (Q19).
  - `text-engine/interaction/index.ts` — barrel updated: exports `getTextSnapPoints`, `toSnapCandidates`, `TextSnapKind`, `TextSnapPoint`.
  - `__tests__/TextGripGeometry.test.ts` — 120 lines. `__tests__/TextGripHandler.test.ts` — 248 lines. `__tests__/TextSnapProvider.test.ts` — 201 lines. `__tests__/DirectDistanceEntry.test.ts` — 102 lines. Total: **671 test lines**.

- **2026-05-11 — Phase 6 tests COMPLETE**. Full test suite for all text commands + match-engine fix:
  - `text-match-engine.ts` fix: `replaceAll` early-return `{ node, count: 0 }` when no matches found (avoids spurious shallow-copy allocation); unused `match` param renamed to `_` in replace callback.
  - `__tests__/text-match-engine.test.ts` — 94 lines: findMatches (literal, regex, caseSensitive, wholeWord, multi-run, multi-para), replaceAll (no-match early-return, count, multi-match), replaceAt (single location, out-of-bounds guard).
  - `__tests__/UpdateTextStyleCommand.test.ts` — 120 lines: execute/undo/redo, merge (same entity → patch coalescence), canMergeWith cross-type guard, validate, serialize, locked layer throws.
  - `__tests__/UpdateTextGeometryCommand.test.ts` — 114 lines: position patch, rotation patch, columns.width patch, merge, undo restores full snapshot, frozen layer throws.
  - `__tests__/UpdateMTextParagraphCommand.test.ts` — 124 lines: execute/undo/redo, out-of-range index (no-op), validate, serialize, audit round-trip.
  - `__tests__/DeleteTextCommand.test.ts` — 73 lines: execute removes entity, undo re-adds full snapshot, redo removes again, locked layer throws, audit 'deleted'.
  - `__tests__/ReplaceAllTextCommand.test.ts` — 106 lines: replace literal, replace regex, no-match (no update), multi-paragraph, audit count change, undo restores.
  - `__tests__/ReplaceOneTextCommand.test.ts` — 129 lines: replace at location, out-of-range location (validate rejects), undo restores, serialize round-trip.
  - All command tests green. Total Phase 6 tests: **760 lines across 8 test files**.

- **2026-05-11 — Phase 6.C COMPLETE**. Layer 6 Command Pattern — remaining commands + text-match-engine + tests:
  - `core/commands/text/text-match-engine.ts` — `findMatches(node, options)`: regex/literal search across all TextRun text, returns `MatchLocation[]` (paragraphIdx, runIdx, start, end). `replaceAll(node, options, replacement)` + `replaceAt(node, location, replacement)`: immutable AST replace. `MatchOptions` (pattern/literal, caseSensitive, wholeWord). Used by ReplaceAll/ReplaceOneTextCommand.
  - `core/commands/text/UpdateMTextParagraphCommand.ts` — patches a single paragraph by index (indent, justification, lineSpacing). Snapshot on first execute; undo restores old paragraph. `ParagraphPatch = Partial<Pick<TextParagraph, 'indent'|'justification'|'lineSpacingMode'|'lineSpacingFactor'>>`.
  - `core/commands/text/DeleteTextCommand.ts` — removes entity from scene. Snapshot stores full `DxfTextSceneEntity`; undo re-adds it (full revert). Pre-execute `assertCanEditLayer` (Q8). Audit `'deleted'`.
  - `core/commands/text/ReplaceAllTextCommand.ts` — replaces all matches via `replaceAll` from text-match-engine. Snapshot entire textNode. Non-idempotent redo: re-runs search on current entity state. Audit `'updated'` with match-count change entry.
  - `core/commands/text/ReplaceOneTextCommand.ts` — replaces single match at `MatchLocation`. Snapshot textNode. Audit `'updated'`.
  - `core/commands/text/__tests__/test-fixtures.ts` — shared fixtures: `makeRun`, `makeParagraph`, `makeSimpleNode`, `makeRichNode`, `makeScene`, `makeRecorder`, `makeLayerProvider`.
  - `core/commands/text/__tests__/CanEditLayerGuard.test.ts` — 10 tests: missing layer (editable), unlocked (editable), locked+canUnlock (editable), locked+noUnlock (throws), frozen (always throws).
  - `core/commands/text/index.ts` — updated by linter to full barrel with JSDoc header, type-only exports, all 6 commands + text-match-engine. SSoT Tier 4 entry point.
  - ADR-344 changelog updated.

- **2026-05-11 — Phase 6.B COMPLETE**. Layer 6 Command Pattern — `UpdateTextStyleCommand` + `UpdateTextGeometryCommand` + `diff-helpers`:
  - `core/commands/text/diff-helpers.ts` — `buildShallowDiff(before, after)`: shallow field comparison for audit entries; emits `DxfTextAuditChange[]` for all keys with changed primitive references.
  - `core/commands/text/UpdateTextStyleCommand.ts` — patches `TextRunStyle` uniformly across all runs of all paragraphs (toolbar-level bulk apply). Pre-execute `assertCanEditLayer` (Q8). Snapshot on first execute; undo restores snapshot. `canMergeWith` + `mergeWith`: consecutive style patches on same entity collapse (last patch wins). Fire-and-forget audit `'updated'` with `buildShallowDiff`. `TextStylePatch = Partial<TextRunStyle>`.
  - `core/commands/text/UpdateTextGeometryCommand.ts` — patches `position` (insertion point), `rotation`, and `columns.width` (MTEXT frame resize). Geometry snapshot captured on first execute; undo restores `position + textNode`. `canMergeWith` + `mergeWith`: consecutive geometry patches on same entity collapse (smooth drag undo). `GeometrySnapshot` interface bundles `position/rotation/width/textNode`.
  - `core/commands/text/index.ts` barrel updated with Phase 6.B exports; Phase 6.C TODO retained.
  - Deferred to Phase 6.C: `UpdateMTextParagraphCommand`, `DeleteTextCommand`, `ReplaceAllTextCommand`, `ReplaceOneTextCommand`.

- **2026-05-11 — Phase 6.A COMPLETE**. Layer 6 Command Pattern — `CreateTextCommand` + `CanEditLayerGuard` types:
  - `core/commands/text/types.ts` — `DxfTextSceneEntity` (scene-bridge carrying `DxfTextNode` AST), `DxfTextAuditAction/Change/Event/IDxfTextAuditRecorder` (Q12 audit abstraction), `LayerSnapshot/ILayerAccessProvider/CanEditLayerError` (Q8 layer guard types), `noopAuditRecorder` singleton.
  - `core/commands/text/CanEditLayerGuard.ts` — `assertCanEditLayer({ layerName, provider })`: throws `CanEditLayerError` for locked layer when user lacks `canUnlockLayer`, throws unconditionally for frozen layers (AutoCAD parity). Used as pre-execute hook by Update*/Delete commands.
  - `core/commands/text/CreateTextCommand.ts` — implements `ICommand` (ADR-031). `pickEntityType` selects `'text'` for single-para/single-run/no-columns ASTs, `'mtext'` otherwise. Entity instance reused across undo/redo (idempotent). Audit recorder injected via constructor; defaults to `noopAuditRecorder` (fire-and-forget on execute/redo → `'created'`; on undo → `'deleted'`). `existingId` param for undo/redo replay (ADR-057). `serialize()` captures `position/layer/textNode/entityId` at `version: 1`.
  - `core/commands/text/index.ts` — updated barrel: exports `CreateTextCommand`, `assertCanEditLayer`, all types; retains TODO for Phase 6.B commands.
  - Unit tests: `core/commands/text/__tests__/CreateTextCommand.test.ts` (13 tests: type-selection × 3, execute/undo/redo round-trip × 2, audit × 2, validate × 3, serialize × 1, affectedIds × 1, canMerge × 1). **13/13 green**.
  - Deferred to Phase 6.B: `UpdateTextStyleCommand`, `UpdateTextGeometryCommand`, `UpdateMTextParagraphCommand`, `DeleteTextCommand`, `ReplaceAllTextCommand`, `ReplaceOneTextCommand`.

- **2026-05-11 — Phase 5 COMPLETE**. Layer 5 Toolbar UI desktop + mobile + Text Properties FloatingPanel tab + TipTap editor overlay mount:
  - Deps installed (pnpm `-w`, all MIT, vetted per CLAUDE.md N.5): `@tiptap/react@^3`, `@tiptap/starter-kit@^3`, `@tiptap/extension-color@^3`, `@tiptap/extension-text-style@^3`, `@tiptap/extension-font-family@^3`, `react-colorful@^5`, `cmdk@^1`, `@radix-ui/react-toolbar@^1`, `@radix-ui/react-toggle@^1`, `@radix-ui/react-toggle-group@^1`.
  - **5.A Zustand stores** — `state/text-toolbar/useTextToolbarStore.ts` (TextToolbarValues + MixedValue fields for every toolbar surface), `useTextSelectionStore.ts` (selectedIds of text entities), `useTextEditingStore.ts` (active edit session + DxfTextNode draft), `textToolbarSelectors.ts` (`computeMixedValues(selection)` collapses agreement → value, disagreement → null). Barrel `state/text-toolbar/index.ts`.
  - **5.B Permission guard (Q8)** — extended `src/lib/auth/types.ts` `PERMISSIONS` with `dxf:text:create/edit/delete` + `dxf:layers:unlock`. Extended `src/lib/auth/roles.ts` role definitions: `company_admin` (full + unlock), `project_manager`/`architect`/`engineer` (create+edit+delete, no unlock), `site_manager` (create+edit). New hook `hooks/useCanEditText.ts` + pure `hooks/text-edit-capabilities.ts` for `capabilitiesForRole(role)` — React-free for testability. Role matrix mirrors ADR Q8 verbatim. **Firestore rules for `text_templates` deferred to Phase 7** (collection schema arrives Phase 7).
  - **5.C Core controls** — 7 files in `ui/text-toolbar/controls/`: `JustificationGrid.tsx` (3×3 attachment grid, `data-state="indeterminate"` for MixedValue), `SizeInput.tsx` (numeric + pointer-events drag-scrub, 44×44 mobile target, Q10), `LineSpacingMenu.tsx` (Radix DropdownMenu presets + modes), `LayerSelectorDropdown.tsx` (Radix Select per ADR-001, lock icon for locked layers + admin unlock badge Q17), `AnnotationScaleManager.tsx` (Q11: 10 standard scales + custom factor + active scale picker), `ColorPickerPopover.tsx` (Q13: react-colorful + 256-entry ACI grid + ByLayer/ByBlock + reuses existing `ui/color/eyedropper.ts`), `FontFamilyCombobox.tsx` (Q18: cmdk-based searchable list + upload action invoking FontManagerPanel from Phase 2), `aci-palette.ts` (ACI 0–255 table + `hexToAci` Euclidean nearest + `dxfColorToHex`).
  - **5.D Toolbar root + 5 panels** — `ui/text-toolbar/TextToolbar.tsx` Radix Toolbar.Root fixed overlay, gated by `useCanEditText` deny-tooltip when role insufficient. Panels in `ui/text-toolbar/panels/`: `StylePanel.tsx` (bold/italic/underline/overline/strike via Radix ToolbarToggleGroup), `FormattingPanel.tsx` (font family + size + color + width factor + oblique + tracking, true-color tab disabled for AC1009/AC1015), `ParagraphPanel.tsx` (JustificationGrid + LineSpacingMenu), `InsertPanel.tsx` (Stack `\S` + `%%c %%d %%p` special chars), `ToolsPanel.tsx` (eyedropper standalone + voice placeholder Q16 + find/replace placeholder Q7).
  - **5.E Mobile responsive (Q10)** — `ui/text-toolbar/responsive/MobileTextToolbar.tsx` collapses panels into Radix Accordion under 768 px, ≥44×44 px tap targets, `visualViewport` repositioning above on-screen keyboard, `oncontextmenu` suppressed on long-press, `touch-action: pan-x pan-y` boundary. `useVisualViewport.ts` hook + `ResponsiveTextToolbar.tsx` chooses desktop/mobile via `matchMedia('(min-width: 768px)')`.
  - **5.F Text Properties tab** — `types/panel-types.ts` extended: `FloatingPanelType` adds `'text-properties'`, `PANEL_METADATA` entry, `FLOATING_PANEL_TYPES`, `PANEL_LAYOUT.topRow`, `isFloatingPanelType` updated. `ui/components/PanelTabs.tsx` registers Type-icon tab. `ui/hooks/usePanelContentRenderer.tsx` switch-case `'text-properties'` mounts `LazyTextPropertiesPanel`. `ui/text-toolbar/TextPropertiesPanel.tsx` (subset for selection-without-edit) + `TextPropertiesPanelHost.tsx` (stub-data wrapper — host wiring to LayerStore/FontCache/scene version arrives Phase 6). FloatingPanel SSoT preserved (ADR-003) — no new panel system.
  - **5.G i18n keys (N.11)** — extended `src/i18n/locales/{el,en}/textToolbar.json` with rootLabel + denyReason + section.{style,formatting,paragraph,layer,insert,tools} + properties.{label,title} + justification.{TL..BR} + lineSpacing.{single,oneAndHalf,double,mode.{multiple,exact,at-least}} + font.{heightLabel,widthFactorLabel,obliqueLabel,trackingLabel} + insert.{diameter,degree,plusMinus}. Extended `dxf-viewer-panels.json` with `panels.textProperties.{title,loading}`. Zero hardcoded `defaultValue` literals. Namespace separator standardised to `'textToolbar:key.path'` form.
  - **5.H TipTap editor mount** — `ui/text-toolbar/TextEditorOverlay.tsx` mounts `@tiptap/react` Editor with `dxfTextExtensions` (Phase 4) + StarterKit + Color + TextStyle + FontFamily. When `yDoc` prop is supplied, `createYjsTipTapExtension` (Phase 4) is added and StarterKit history disabled (Yjs owns undo). Initial content seeded via `dxfTextToTipTap(initial)`; on commit, `tipTapToDxfText(json, initial)` produces final DxfTextNode for the host to dispatch via `CreateTextCommand` / `UpdateMTextParagraphCommand` (Phase 6). Keyboard: Ctrl+Enter commits, Escape cancels. `visualViewport` keeps overlay above keyboard. `touch-action: pan-x pan-y` lets canvas keep pinch-zoom (Q10).
  - **5.I Tests** — `state/text-toolbar/__tests__/textToolbarSelectors.test.ts` (8 tests: empty/single/agreement/disagreement/layer/color-union/justification/rotation) + `hooks/__tests__/useCanEditText.test.ts` (18 tests: full Q8 role matrix incl. unknown + unauthenticated) + `ui/text-toolbar/controls/__tests__/JustificationGrid.test.tsx` (13 tests: render matrix + aria-checked + indeterminate + click + disabled). **39/39 green**.
  - **5.J Deferred to Phase 6**: real LayerStore / FontCache / scene-version wiring in `TextPropertiesPanelHost`; `text_templates` Firestore rules (arrives with Phase 7 collection schema); voice / find-replace concrete handlers (Phase 9 / Phase 12).
  - All files ≤200 lines, zero `any` / `@ts-ignore` / inline styles (except dynamic colour swatch `style={{backgroundColor: hex}}` — required for arbitrary DxfColor display). `useCanEditText` and toolbar state are desktop-state, not canvas leaves (ADR-040 cardinal rule respected).

- **2026-05-11 — Phase 4 COMPLETE**. Layer 4 Edit Engine — TipTap v3 headless + Yjs + y-websocket auth + DxfTextNode ↔ TipTap JSON serializer:
  - Deps installed (pnpm `-w`): `@tiptap/core@3.23.1` (MIT), `@tiptap/pm@3.23.1` (MIT, bundled ProseMirror), `yjs@13.6.30` (MIT), `y-prosemirror@1.3.7` (MIT), `y-websocket@3.0.0` (MIT, client only), `y-protocols@1.0.7` (MIT). All licences vetted per CLAUDE.md N.5.
  - `text-engine/edit/tiptap-json.types.ts` — schema types: `TipTapDoc`, `TipTapParagraph`, `TipTapInline`, `TipTapText`, `TipTapHardBreak`, `TipTapStackNode`, `TipTapMark` (11 mark types: bold/italic/underline/strike/overline/fontFamily/fontHeight/widthFactor/obliqueAngle/tracking/dxfColor), `DocAttrs` (attachment + lineSpacing + rotation + isAnnotative + annotationScales + currentScale + bgMask + columns), `ParagraphAttrs`, `ColumnsAttrs`, `BgMaskAttrs`, `StackNodeAttrs`.
  - `text-engine/edit/dxf-to-tiptap.ts` — `dxfTextToTipTap(node)`. Style→marks helper omits default-value marks (widthFactor=1, obliqueAngle=0, tracking=1) for minimal JSON. Soft newlines (`\n` in TextRun.text) split into text + hard_break segments. TextStack → inline `stack` node. Node-level attrs (bgMask, columns) round-trip through `DocAttrs`.
  - `text-engine/edit/tiptap-to-dxf.ts` — `tipTapToDxfText(doc)`. Adjacent text nodes with identical mark sets merge into single TextRun (run-merge heuristic via `stylesEqual` + `colorsEqual` discriminated-union compare). `hard_break` nodes inline as `\n` in surrounding run text. Permissive parsing: unknown marks ignored, missing attrs fall back to documented defaults.
  - `text-engine/edit/marks/` — 6 custom TipTap Mark extensions (one per DXF inline code): `OverlineMark` (\O), `FontHeightMark` (\H), `WidthFactorMark` (\W), `ObliqueAngleMark` (\Q), `TrackingMark` (\T), `DxfColorMark` (\C + \c, full DxfColor discriminated union serialised on `data-dxf-color` attr).
  - `text-engine/edit/nodes/stack-node.ts` — `StackNode` atomic inline node for `\S` stack code. Attrs: top/bottom strings, stackType (tolerance/diagonal/horizontal), fontFamily, height, color.
  - `text-engine/edit/tiptap-config.ts` — `dxfTextExtensions: Extensions` canonical list (6 Marks + 1 Node) to mount alongside StarterKit in Phase 5. `DXF_MARK_NAMES` constant for forward-compat checks.
  - `text-engine/collab/y-doc-factory.ts` — `createDxfTextYDoc({ entityId })`, `getDxfTextFragment`, `getDxfMetadataMap`, `snapshotYDoc`, `restoreYDoc`. Y.Doc guid = entity ID (idempotent rejoin). Two named structures per doc: XmlFragment `'mtext'` + Map `'meta'`. Snapshot returns `Uint8Array` for IndexedDB persistence (Q15 prep).
  - `text-engine/collab/yjs-tiptap-extension.ts` — `createYjsTipTapExtension({ doc, awareness, user })`. TipTap Extension wrapping `ySyncPlugin` + `yUndoPlugin` + optional `yCursorPlugin`. Priority 1000. Mounts alongside Phase 5 editor; replaces TipTap History (yUndoPlugin owns undo when active).
  - `text-engine/collab/y-websocket-client.ts` — `connectYWebsocket({ serverUrl, companyId, drawingId, entityId, doc, getToken })`. Room id = `${companyId}:${drawingId}:${entityId}` (tenant-scoped per ADR-326). `refreshToken()` destroys+recreates provider (v3 `provider.url` is read-only) — CRDT preserves doc state across reconnect.
  - `scripts/y-websocket-server/` — standalone Node.js sync server skeleton: `server.js` (ws + y-protocols sync + awareness fan-out, per-room Y.Doc lifecycle, `/healthz` probe), `auth.js` (Firebase Admin verifyIdToken + tenant claim check, close codes 4001/4003/4004), `package.json` (ws + yjs + y-protocols + lib0 + firebase-admin), `Dockerfile` (Cloud Run deployment with session affinity + cpu-throttling=false), `README.md` (architecture + deployment + production-hardening roadmap). **NOT for Vercel** — long-lived WebSockets require Cloud Run / Fly.io / VM.
  - SSoT registry: added `text-edit` module (tier 4) in `.ssot-registry.json` forbidding duplicate `dxfTextToTipTap`/`tipTapToDxfText` outside `text-engine/edit/`. `text-collab` allowlist extended to include `scripts/y-websocket-server/` (server uses `new Y.Doc()` legitimately).
  - Unit tests: `edit/__tests__/roundtrip.test.ts` (21 tests: plain text, inline styles, colour ACI/TrueColor/ByLayer/ByBlock, soft newlines, run-merge, stack `\S` all 3 types, node-level attrs incl. annotationScales + columns + bgMask) + `collab/__tests__/y-doc-factory.test.ts` (9 tests: Y.Doc creation, fragment/map access, snapshot/restore, CRDT cross-merge). **30/30 green**.
  - Total text-engine tests: **175/175 green** (Phase 1: 68 + Phase 2: 26 + Phase 3: 51 + Phase 4: 30).
  - All files ≤200 lines, all functions ≤40 lines, zero `any`/`@ts-ignore`/inline styles. `tsc -p src/subapps/dxf-viewer/tsconfig.json --noEmit` clean.

- **2026-05-11 — Phase 3 COMPLETE**. Layer 3 Layout Engine — line-breaking, paragraph formatting, columns, stacking, attachment-point anchoring:
  - `text-engine/layout/line-breaker.ts` — `breakLines(runs, maxWidth, font): TextLine[]`. UAX #14 simplified: tokenizes on spaces, hyphens, `\n`. Overflow-safe (single token > maxWidth starts own line). Never promotes whitespace to head of new line. Exports `TextLine` interface.
  - `text-engine/layout/paragraph-formatter.ts` — `formatParagraph(para, options): FormattedParagraph`. Applies left/right margins + outer indent to effective maxWidth. Separates `TextStack` items from `TextRun` items before calling `breakLines`. `lineSpacingMode`: `multiple` = naturalHeight × factor; `exact` = fixed factor; `at-least` = max(natural, factor). Exports `ParagraphOptions` (with `font: Font` field), `FormattedParagraph` (with `indentWidth` for renderer first-line offset).
  - `text-engine/layout/column-layout.ts` — `layoutColumns(paragraphs, config): ColumnLayout`. `static`: contiguous distribution across N columns (⌈len/N⌉ per column). `dynamic`: fills each column to ≈ totalHeight/count, overflow to next. Exports `ColumnConfig`, `ColumnEntry`, `ColumnLayout`.
  - `text-engine/layout/stacking-renderer.ts` — `layoutStack(stack, font, size): StackLayout`. Sub-text at 65 % of surrounding height (AutoCAD convention). `tolerance` (^): centered num/den, no separator. `horizontal` (#): centered num/den + horizontal rule at midpoint. `diagonal` (/): side-by-side + slash Path2D. Exports `StackLayout`.
  - `text-engine/layout/attachment-point.ts` — `resolveAttachmentPoint(justification, bounds): Point2D` + `offsetForJustification(justification, bounds): {dx, dy}`. Maps all 9 `TextJustification` values (TL/TC/TR/ML/MC/MR/BL/BC/BR) to absolute coordinates and insertion-point offsets. Exports `Rect`, `Point2D`.
  - `text-engine/layout/text-layout-engine.ts` — `layoutTextNode(node, opts): TextLayout` orchestrator + `getBoundingBox(node, opts): Rect`. Pipeline: formatParagraph × N → layoutColumns (R2007+ gated) → computeDimensions → offsetForJustification → world-space Rect. `getBoundingBox` consumed by `MissingFontHighlightLeaf` (Phase 2) and `TextSnapProvider` (Phase 6).
  - `text-engine/layout/index.ts` barrel updated with all Phase 3 exports.
  - Unit tests: `layout/__tests__/line-breaker.test.ts` (20 tests) + `attachment-point.test.ts` (22 tests, incl. roundtrip) + `text-layout-engine.test.ts` (9 tests) — **51/51 green**.
  - Total text-engine tests: **145/145 green** (Phase 1 + Phase 2 + Phase 3).
  - All files ≤150 lines, all functions ≤40 lines, zero `any`/`@ts-ignore`/inline styles.

- **2026-05-11 — Phase 2 COMPLETE**. Layer 2 Font Engine — opentype.js + SHX/SHP parser + Firebase font manager + missing-font UI:
  - `opentype.js@^2.0.0` (MIT) added to dependencies via pnpm.
  - `text-engine/fonts/font-cache.ts` — `FontCache` class: `WeakMap<ArrayBuffer, Font>` + `Map<string, Font>` by name. Module-level singleton `fontCache`.
  - `text-engine/fonts/font-loader.ts` — `loadFont(url)`, `loadFontFromBuffer(buf)`, `loadCompanyFont(companyId, fileName)` (Firebase Storage signed URL + cache), `buildMissingFontReport(missingNames, entities)` → `MissingFontReport`, `listCompanyFontsMeta(companyId)`.
  - `text-engine/fonts/glyph-renderer.ts` — `glyphToPath2D(font, char, x, y, size)` → `Path2D | null`, `stringToPath2D(font, text, x, y, size)` → `Path2D`, `measureText(font, text, size)` → `{ width, ascent, descent }`. Converts opentype.js PathCommand array → browser `Path2D` via M/L/Q/C/Z commands.
  - `text-engine/fonts/missing-font-store.ts` — module-level singleton (HoverStore/ImmediateSnapStore pattern, ADR-040): `setMissingFontReport`, `clearMissingFontReport`, `subscribeMissingFontReport`, `getMissingFontReport`. Low-frequency update (once per DXF open).
  - `text-engine/fonts/shx-parser/shp-types.ts` — `ShpVector`, `ShpRecord`, `ShpFont` types.
  - `text-engine/fonts/shx-parser/shp-parser.ts` — `parseShpFile(buffer)` → `ShpFont`, `parseShpRecord(view, offset)`. Binary SHP format: CRLF header + defCount + (code 2B + defBytes + above + below + vectors + 0x0000 terminator).
  - `text-engine/fonts/shx-parser/shx-renderer.ts` — `shxGlyphToPath2D`, `shxStringToPath2D`, `measureShxText`. Pen-up flag via `0x80` high bit. Canvas y-axis flip (SHP y-up → canvas y-down).
  - `text-engine/fonts/font-manager/font-upload.service.ts` — `uploadCompanyFont(companyId, file, userId)` → `CompanyFontRecord` (Storage upload + `setDoc` with `generateCompanyFontId()`). `deleteCompanyFont`, `listCompanyFonts`, `getCompanyFontUrl`. Enterprise IDs: `fnt_*` prefix (CLAUDE.md N.6).
  - `text-engine/fonts/font-manager/FontManagerPanel.tsx` — list + upload + delete UI. Radix `AlertDialog` for delete confirmation. Admin-only actions via `canManage` prop. i18n: `textFonts:panel.*`.
  - `ui/text-toolbar/MissingFontBanner.tsx` — non-blocking status banner. Props: `report`, `onViewAffected`, `onUpload`, `onDismiss`. i18n: `textFonts:missingBanner.*`.
  - `rendering/leaves/MissingFontHighlightLeaf.tsx` — ADR-040 micro-leaf. `useSyncExternalStore(subscribeMissingFontReport, getMissingFontReport)`. Draws dashed orange outlines (6/4 dash, 1.5px, Tailwind `orange-500`) on canvas when `highlightActive=true`. `entityBounds: Map<string, EntityScreenBounds>` provided by Phase 3 layout engine. Zero inline styles (N.3). `pointer-events-none absolute inset-0`.
  - `src/i18n/locales/el/textFonts.json` + `en/textFonts.json` — 22 i18n keys each (panel + missingBanner).
  - `jest.setup.js` — added `global.Path2D` mock + `global.TextEncoder/TextDecoder` polyfill for canvas tests in jsdom.
  - Barrel `fonts/index.ts` updated with all Phase 2 exports.
  - Unit tests: `fonts/__tests__/glyph-renderer.test.ts` (9 tests) + `shx-parser/__tests__/shp-parser.test.ts` (8 tests) + `shx-renderer.test.ts` (9 tests) — **26/26 green**.
  - Total text-engine tests: **94/94 green** (Phase 1 + Phase 2).
  - All files ≤200 lines (max: font-upload.service.ts ~135), all functions ≤40 lines, zero `any`/`@ts-ignore`, zero inline styles.

- **2026-05-11 — Phase 1 COMPLETE**. Layer 1 DXF I/O — parser + tokenizer + STYLE table + serializer:
  - `text-engine/types/text-toolbar.types.ts` — `DxfColor` discriminated union, `MixedValue<T>`, `DxfDocumentVersion` enum (R12→R2018), version feature-gate utilities (`versionSupportsMtext`, `versionSupportsTrueColor`, `versionSupportsAnnotativeXData`, `versionAtLeast`, `parseDocumentVersion`, `parseTrueColorInt`, `encodeTrueColorInt`).
  - `text-engine/types/text-ast.types.ts` — `DxfTextNode` root AST node, `TextParagraph`, `TextRun`, `TextStack`, `TextRunStyle`, `TextJustification`, `LineSpacingMode`, `AnnotationScale`, `DxfStyleTableEntry`.
  - `text-engine/parser/mtext-tokenizer.ts` — full tokenizer for all 22 MTEXT inline codes from Appendix B: `\f/\F`, `\H`, `\W`, `\T`, `\Q`, `\C`, `\c`, `\L/\l`, `\O/\o`, `\K/\k`, `\P`, `\N`, `\S`, `\A`, `\p`, `\~`, `%%c/d/p`, `\U+XXXX`, `{`, `}`. Token type is a discriminated union — zero `any`.
  - `text-engine/parser/mtext-parser.ts` — token list → `DxfTextNode` AST using style stack for `{...}` group scopes. `parseMtext()` for MTEXT, `parseText()` for simple TEXT entities. Style flush-before-change semantics (correct MTEXT behaviour).
  - `text-engine/parser/style-table-reader.ts` — DXF STYLE symbol table reader (group-code scan, R12→R2018 compatible). `parseStyleTable()` + `styleEntryDefaults()` helper.
  - `text-engine/serializer/mtext-serializer.ts` — `DxfTextNode` → MTEXT inline-code string. Version-gated: R12 graceful downgrade to plain TEXT entity + warning. R2004+ true-color `\c` enabled. Paragraph codes, style diffs, stack fractions, escape.
  - Barrel `index.ts` updated for types, parser, serializer modules.
  - Unit tests: `parser/__tests__/mtext-tokenizer.test.ts` (46 tests) + `mtext-parser.test.ts` (22 tests) — **68/68 green**.
  - All files ≤300 lines, all functions ≤40 lines, zero `any`/`@ts-ignore`.

- **2026-05-11 — Phase 0 COMPLETE**. Setup & configuration:
  - 15 SSoT modules registered in `.ssot-registry.json` (`_comment_dxf_text_engine` group, tier 4): `mtext-parser`, `mtext-serializer`, `font-engine`, `shx-parser`, `text-layout`, `text-renderer`, `text-toolbar`, `text-commands`, `text-types`, `text-collab`, `text-templates`, `text-spell`, `text-draft`, `text-ai`, `viewport-system`.
  - 3 Firestore collections added to `src/config/firestore-collections.ts`: `TEXT_TEMPLATES` (`text_templates`), `TEXT_CUSTOM_DICTIONARY` (`text_custom_dictionary`), `COMPANY_FONTS` (`company_fonts`).
  - 3 enterprise ID prefixes in `enterprise-id-prefixes.ts`: `TEXT_TEMPLATE` (`tpl_text`), `COMPANY_FONT` (`fnt`), `DICT_ENTRY` (`dict`). Generators wired through class + convenience + service facade.
  - `font-substitution-table.ts` created with 8 SHX→open-font entries + `lookupSubstitute()` utility.
  - Folder scaffold (`index.ts` barrels) created for all 15 modules under `text-engine/`, `ui/text-toolbar/`, `core/commands/text/`, `systems/viewport/`.
- **2026-05-11 — Initial PROPOSED draft**. Research complete (4 parallel deep-dive agents). Awaiting Giorgio's answers to Q1-Q7 before implementation begins.
- **2026-05-11 — Q8-Q21 RESOLVED, status → FULLY APPROVED**:
  - Q8: Permissions = professionals only + admin layer unlock
  - Q9: DIMENSION/LEADER = deferred ADR (read-only in current scope)
  - Q10: Mobile = full touch editing (ADR-176 integration)
  - Q11: Annotative scaling = full (ViewportStore + per-entity scale list)
  - Q12: Audit trail = full (create+edit+delete via EntityAuditService ADR-195)
  - Q13: Eyedropper = reuse existing (SSOT)
  - Q14: DXF version range = R12→R2018 (full, graceful downgrade)
  - Q15: Auto-save = IndexedDB local + DraftRecoveryBanner
  - Q16: AI = voice-to-text + AI commands (ADR-185 + ADR-156)
  - Q17: Default layer = current layer + LayerSelectorDropdown in toolbar
  - Q18: Font upload = TTF/OTF/SHX → Firebase Storage + FontManagerPanel
  - Q19: Text geometry = grip handles + snap integration + numeric direct input
  - Q20: Missing SHX = substitution + MissingFontBanner + canvas highlight
  - Q21: Text snap = all points (insertion + 4 corners + center + edge mids)
  - Total estimate revised: **~52-62 working days** (12 phases + 15 SSoT modules)
- **2026-05-11 — Q1-Q7 RESOLVED, status → APPROVED**:
  - Q1: Edit engine = **TipTap v3** (Path A, fast delivery)
  - Q2: DXF scope = **Both TEXT + MTEXT** from day 1 (full compatibility)
  - Q3: SHX support = **Full SHP parser** (enterprise-grade, AutoCAD-identical rendering)
  - Q4: Collaborative editing = **Day 1 (Yjs + y-websocket)** (completeness over MVP)
  - Q5: Stamps/templates = **Hybrid** (TS defaults + Firestore user templates + placeholder resolver)
  - Q6: Spell check = **nspell + el_GR + en_US** (lazy-loaded, worker, custom dictionary)
  - Q7: Find & Replace scope = **Current drawing** (Path B "FIND"); cross-drawing deferred to future ADR
  - Implementation plan revised: ~36-41 days total, 10 phases. Phase 0 ready to kick off pending Giorgio's go-ahead.
