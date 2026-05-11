# ADR-344 DEFERRED — DIMENSION + LEADER Text Editing

**STATUS: DEFERRED** (2026-05-11, Q9 decision by Giorgio)

**Decision context**: While planning ADR-344 (DXF Enterprise Text Engine), Giorgio explicitly chose Path A for Q9: ship TEXT/MTEXT editing only in ADR-344, defer DIMENSION + LEADER + MLEADER entity text editing to a dedicated future ADR.

## What ships in ADR-344 (current scope)
- TEXT entity (single-line) — create, edit, delete
- MTEXT entity (multi-line + inline format codes) — create, edit, delete
- Full font engine (TTF/OTF/SHX via SHP parser)
- Collaborative editing via Yjs
- Templates (hybrid: TS defaults + Firestore user templates)
- Spell check (el_GR + en_US)
- Find & Replace (current drawing scope)

## What is DEFERRED to a future ADR
- DIMENSION entity editing (linear, aligned, radial, diameter, angular, ordinate)
- LEADER entity editing
- MLEADER entity editing (multi-leader with multiple endpoints)
- DIMSTYLE table management
- Auto-recalculation of dimension geometry on parent change
- Anonymous `*D` block regeneration

## Behavior of DIMENSION/LEADER in current scope
- They render correctly (text uses ADR-344's font engine)
- They are **read-only via the TextToolbar**
- Selecting a DIMENSION/LEADER shows badge: "Edit dimension geometry → coming soon (deferred ADR)"

## When to revisit
- After ADR-344 is fully implemented and shipped (Phases 0-10 complete)
- When Giorgio explicitly requests dimension/leader editing
- New ADR will reuse ADR-344 infrastructure: Font engine (Layer 2), Layout engine (Layer 3), TextToolbar UI (Layer 5), CommandHistory (Layer 4)

## Cross-references
- Main ADR: `docs/centralized-systems/reference/adrs/ADR-344-dxf-enterprise-text-engine.md` §4-BIS Q9
- Subapp pending: `src/subapps/dxf-viewer/PENDING.md` §0
- This pointer: `.claude-rules/MEMORY.md` → "Pending Work"

## Reminder protocol
This file must be surfaced at the **start of every new session** per CLAUDE.md N.0.0 + N.13, until the deferred ADR is opened and resolved.
