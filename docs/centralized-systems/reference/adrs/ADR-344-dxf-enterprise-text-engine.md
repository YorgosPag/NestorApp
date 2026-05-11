# ADR-344: DXF Enterprise Text Engine (Autodesk-Grade Text Creation & Editing Suite)

- **Status**: 📝 PROPOSED — Awaiting Giorgio's design decisions before implementation
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

| Module | Path | Responsibility |
|---|---|---|
| `mtext-parser` | `src/subapps/dxf-viewer/text-engine/parser/` | DXF MTEXT/TEXT entity → AST |
| `mtext-serializer` | `src/subapps/dxf-viewer/text-engine/serializer/` | AST → MTEXT inline codes |
| `font-engine` | `src/subapps/dxf-viewer/text-engine/fonts/` | Glyph paths, font cache, substitution |
| `text-layout` | `src/subapps/dxf-viewer/text-engine/layout/` | Line-break, columns, attachment-point |
| `text-renderer` | `src/subapps/dxf-viewer/text-engine/render/` | Canvas 2D Path2D rendering |
| `text-toolbar` | `src/subapps/dxf-viewer/ui/text-toolbar/` | Ribbon UI + state |
| `text-commands` | `src/subapps/dxf-viewer/core/commands/text/` | ICommand impl (UpdateTextStyle, etc.) |
| `text-types` | `src/subapps/dxf-viewer/text-engine/types/` | DxfColor, MixedValue, TextNode AST types |

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

### Q4 — Collaborative editing (Yjs) day 1 or deferred?
- Day 1: architect with Y.Doc/Y.Text from the start (correct, slightly more code)
- Deferred: single-user first, Yjs retrofit when needed (faster MVP — but Giorgio explicit "no MVP" per memory)

### Q5 — Stamps & title blocks: data-driven templates or hardcoded?
- Template system: Firestore `text_templates` collection with placeholder variables (`{{project.name}}`, `{{revision.number}}`)
- Hardcoded: ship a few enterprise templates as TypeScript constants
- Hybrid: ship defaults as TS, allow override via Firestore

### Q6 — Spell check: client-side (typo.js, MIT) or skip?
- Adds ~150 KB Greek+English dictionaries
- Greek dictionary quality varies in OSS

### Q7 — Find & Replace scope: current text entity, current drawing, or all drawings?
- Scope affects undo granularity and command design

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

## 8. Implementation Plan (HIGH-LEVEL — pending Q1-Q7 answers)

**NOT a commitment — implementation only after Giorgio approves design.**

| Phase | Scope | Estimate |
|---|---|---|
| **Phase 0** | ADR finalization (Q1-Q7 answered), `.ssot-registry.json` entry, font asset selection | 1 day |
| **Phase 1** | Layer 1: DXF parsing (entities + STYLE table + MTEXT tokenizer) + unit tests | 3-4 days |
| **Phase 2** | Layer 2: opentype.js font engine + cache + substitution table | 2 days |
| **Phase 3** | Layer 3: Layout engine (line-break, columns, attachment-point) + tests | 4-5 days |
| **Phase 4** | Layer 4: Edit engine integration (TipTap headless OR canvas-native per Q1) | 2 days (TipTap) / 4-6 weeks (custom) |
| **Phase 5** | Layer 5: TextToolbar UI (Radix + react-colorful + cmdk) | 4 days |
| **Phase 6** | Text commands (CommandHistory integration) + undo/redo tests | 2 days |
| **Phase 7** | Stamps/templates system (per Q5) | 2-3 days |
| **Phase 8** | i18n (el/en locale keys, per ADR-280) + visual regression tests (ADR-343) | 2 days |

**Total** (TipTap path): ~22-25 days
**Total** (canvas-native path): ~7-10 weeks

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

- **2026-05-11** — Initial PROPOSED draft. Research complete (4 parallel deep-dive agents). Awaiting Giorgio's answers to Q1-Q7 before implementation begins.
