# ADR-466 — Cross-Floor Entity Clipboard (Ctrl+C / Ctrl+V)

> **Status:** ✅ APPROVED (implemented v1, UNCOMMITTED) — 2026-06-17
> **Scope:** DXF Viewer · keyboard input · entity clone/persistence
> **Relates:** ADR-363 §7.2 (BIM copy clone SSoT + persistence broadcasts), ADR-420 (scene autosave), ADR-462 (DXF+BIM in one entities array)

---

## 1. Context / Problem

The user selects entities (DXF or BIM) on one floor, presses **Ctrl+C**, switches floor,
presses **Ctrl+V** — and nothing pastes. Confirmed in code:

1. **No Ctrl+V binding** exists anywhere (`V` alone = overlay-select).
2. **Ctrl+C** mapped to `action:copy-selected` → activates the **`bim-copy` tool** (AutoCAD COPY:
   base→target, **same floor**, BIM-only). It is not a clipboard — it stores nothing for paste
   elsewhere.

➡️ A real clipboard is needed: Ctrl+C snapshots the selection, Ctrl+V pastes onto the current
floor (Revit/AutoCAD COPYCLIP / PASTECLIP).

## 2. Decision

### 2.1 Revit-grade semantics
- **Ctrl+C** = copy selection to an in-memory clipboard (frozen snapshots).
- **Ctrl+V** = **paste in place** (same X/Y — Revit «Aligned to Same Place»), onto the **current**
  floor → works cross-floor.
- The old base-point **`bim-copy`** tool is preserved and moved to the **C+O** chord
  (AutoCAD-correct: CO = copy-with-base-point; Ctrl+C/V = clipboard).

### 2.2 Maximum SSoT reuse (no duplicates, N.0.2)
- **Clone + re-id**: `buildBimCopyClones` (ADR-363 §7.2) was refactored to extract a pure
  `buildClonesFromEntities(sources, transform)` core; the in-floor tool (resolve ids from the live
  scene) and clipboard paste (frozen snapshots) share it. Kind-specific enterprise IDs + host
  rewire + fresh IFC GlobalId unchanged.
- **BIM persistence**: paste reuses the `broadcastBimClone{Created,Deleted,Restored}` SSoT (else
  "paste flashes then vanishes", ADR-363 §7.2).
- **Scene mutation**: `LevelSceneManagerAdapter` (current level) + `executeCommand` (CommandHistory)
  — identical wiring to every modify tool.

### 2.3 Persistence split
- **BIM clones** → `PasteEntitiesCommand` broadcasts create/restore/delete (own Firestore docs).
- **DXF raw geometry** → id-swap clone, added to `scene.entities`, persisted by scene autosave
  (ADR-420); no broadcast.

BIM vs DXF split uses the `isBimEntity` SSoT. Unsupported BIM kinds (clone builder returns them in
`skipped`) are dropped — never raw-cloned (would orphan a BIM type with no doc → vanish bug).

## 3. Flow

```
Ctrl+C ─ useDxfToolbarShortcuts ─ onAction('clipboard-copy') ─ useDxfViewerState
        └─ EventBus.emit('clipboard:copy-requested') ─ useEntityClipboard.copySelection
              └─ EntityClipboardStore.copy(snapshots, sourceFloorId)

Ctrl+V ─ … onAction('clipboard-paste') … EventBus.emit('clipboard:paste-requested')
        └─ useEntityClipboard.pasteClipboard
              ├─ split BIM/DXF → buildClonesFromEntities (BIM) + id-swap (DXF)
              ├─ PasteEntitiesCommand → executeCommand (undoable)
              └─ select pasted entities (Revit feedback)
```

The keyboard-shortcut SSoT (`keyboard-shortcuts.ts`) stays the single binding source; the EventBus
decouples the keyboard layer from the tool layer (the hook lives in `useModifyTools`, where
selection + sceneManager + executeCommand exist).

## 4. Implementation

**New**
- `systems/clipboard/EntityClipboardStore.ts` — in-memory snapshot SSoT (deep-frozen copies).
- `core/commands/entity-commands/PasteEntitiesCommand.ts` — undoable add (+BIM broadcasts).
- `hooks/tools/useEntityClipboard.ts` — copy/paste orchestration (EventBus-driven).
- tests: `EntityClipboardStore.test.ts`, `build-clones-from-entities.test.ts`.

**Modified**
- `bim/transforms/bim-copy-builder.ts` — extracted `buildClonesFromEntities` core; `buildBimCopyClones`
  now a thin resolve-then-delegate wrapper (behaviour preserved).
- `hooks/tools/useModifyTools.ts` — wired `useEntityClipboard`.
- `systems/events/drawing-event-map.ts` — `clipboard:copy-requested` / `:paste-requested`.
- `config/keyboard-shortcuts.ts` — `paste` (Ctrl+V); `copy` → `action:clipboard-copy`.
- `hooks/useDxfToolbarShortcuts.ts` — copy→clipboard-copy (select+grip-edit), paste, C+O chord.
- `hooks/useDxfViewerState.ts` — `clipboard-copy` / `clipboard-paste` → EventBus emit.
- `i18n/locales/{el,en}/dxf-viewer.json` — `shortcuts.actions.copy` / `.paste`.

## 5. Verification

- Select DXF + BIM on Ισόγειο → Ctrl+C → go to 1ος → Ctrl+V → entities appear at same X/Y,
  selected; survive reload; undo removes them; redo restores.
- BIM clones get new `kind_*` ids + Firestore docs on the dest floor; DXF persists via scene.json.

## 6. Changelog

- **2026-06-17** — v1 implemented (paste-in-place), UNCOMMITTED. DEFER: paste-at-cursor / base-point,
  cross-project paste, multi-floor batch paste, BIM host re-resolution to dest-floor hosts.
