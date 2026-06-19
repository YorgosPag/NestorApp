# ADR-501 — DXF Grip Multi-Arm + Group Move (AutoCAD/Revit-grade)

**Status:** 🟡 Slice 1 implemented — pending browser-verify + commit (2026-06-19)
**Discipline:** DXF Viewer · Grip interaction · Canvas rendering (ADR-040-sensitive)
**Related:** ADR-397 (grip glyph/temperature SSoT), ADR-363 (grip system phases), ADR-040 (canvas performance / micro-leaf subscribers), ADR-183 (unified grip system)

> ⚠️ Numbering: CLAUDE.md listed «ADR-370 = next free» but that is stale (ADRs exist up to ADR-500). This ADR took the next sequential free number **ADR-501** (the only actual `ADR-501-*.md` file). Code comments were corrected to ADR-501 (an earlier draft mistakenly wrote «ADR-370», which is the unrelated corner-snap ADR).
>
> 🔶 **Collision flag:** a concurrent agent has a staged HANDOFF named
> `HANDOFF_2026-06-19_ADR-501_live-reaction-aware-takedown-…` that also claims ADR-501
> for a different (structural load-takedown) feature. Since this grip ADR is the actual
> ADR-501 file, the takedown work should renumber to the next free (ADR-502+). Flagged to
> Giorgio for cross-agent coordination.

---

## 1. Context / Problem

When an entity is selected, its grips render **cold** (azure). Today, pressing a
(non-hot-kind) grip immediately enters a press-drag stretch of that single grip, and
there is **no way to select several grips and move them together**. Giorgio's request
(AutoCAD/Revit "hot grips"): *click cold grips → they turn orange (armed) → select as
many as you want (shift+click + marquee) → move them all together to where you want,
with an optional typed distance.*

The pre-existing system already had:
- A temperature SSoT (`resolveGripTemperature`) — but only cold/warm/hot/snappable.
- Multi-vertex select+drag, but **only for overlay polygons** (`selectedGrips[]`), not
  for DXF entity grips.
- `StretchEntityCommand` whose params are **already multi-entity capable**
  (`vertexMoves[]` + one `displacement`), but no caller populates >1 entity.
- Reusable marquee infra (`UniversalMarqueeSelector` / `selectItemsInMarquee`).

## 2. Decision — three slices

A new imperative **`GripArmedStore`** (Set of grip keys, `systems/grip/`) is the SSoT for
"which grips are armed". Mirror of the other `systems/grip/*` stores but with a reactive
`subscribe` (the colour is a render concern). Armed grips render a new **`'armed'`
temperature → orange** (`GRIP_ARMED_COLOR #FF6A00`, distinct from the fleeting warm-hover
orange; hot red stays reserved for the grip under active drag).

| Slice | Scope | Status |
|-------|-------|--------|
| **1** | Arm + multi-select (click / shift+click) + orange visual | 🟡 implemented (this ADR) |
| **2** | Marquee rubber-band over grips → arm many | ⏳ pending |
| **3** | Group move (all armed grips, one delta, single undo) + numeric distance | ⏳ pending |

### Slice 1 — arming + visual (implemented)

- **Click-vs-drag** (`grip-mouse-handlers.runGripMouseUp`): a press-release on a DXF grip
  that moved the cursor `< ARM_CLICK_MAX_MOVE_PX` (4px) is a **click** → arm the grip
  (`GripArmedStore`); a real drag (moved ≥ threshold) falls through to the existing
  stretch/move commit **unchanged** (no regression to single-grip drag-editing).
- **Plain click** → `setOnly` (the grip becomes the sole armed grip). **Shift+click** →
  `toggle` (add/remove from the set). Read via `ShiftKeyTracker` at event time.
- **Clear**: click-away-miss (no Shift) and `Esc` clear the armed set.
- **Scope**: standard (non-hot-kind) DXF grips. Wall/column hot-grip kinds keep their
  dedicated click-click move/rotate/corner flow (ADR-363/397) and are not armed in Slice 1.
- **Excluded**: Alt-move (whole-entity base-point move) keeps its drag intent.

### Temperature priority (extended SSoT)

`resolveGripTemperature` now resolves, in order:
`hot` (active drag) → **`armed` (clicked-to-select, orange)** → `snappable` (cyan, ADR-397)
→ `warm` (hover) → `cold`. `hot` wins over `armed` so the dragged grip turns red even while
in the armed set; `armed` wins over hover so a selected grip stays orange under the cursor.

### Render thread (ADR-040-safe)

`GripArmedStore` (keys) → `useUnifiedGripInteraction` subscribes via `useSyncExternalStore`
(low-frequency click, not a 60fps drag) → `buildGripInteractionState(..., armedKeys)` →
`DxfGripInteractionState.armedKeys` → `DxfRenderer.setGripInteractionState` →
`EntityRendererComposite` → `BaseEntityRenderer.gripInteraction.armedKeys` →
`phaseState.gripState.armedKeys` → `GripPhaseRenderer.getGripTemperature` →
`resolveGripTemperature`. Arming is an event-time store write (no stale closures); the
colour repaint is a single low-frequency React re-render.

## 3. SSoT guarantees

- **One armed-grip store** (`GripArmedStore`) — keyed by the canonical `gripKey`
  (`grip-temperature.ts`), retaining `GripRef` for the Slice-3 group-move commit.
- **One temperature resolver** extended with `armedKeys` — no second priority logic.
- **One colour constant** (`GRIP_ARMED_COLOR`) in `color-config.ts`; threaded through the
  existing `DEFAULT_GRIP_COLORS` / `GRIP_SIZE_MULTIPLIERS` SSoTs.
- **Reuses** the existing click-vs-drag mouseup path, `ShiftKeyTracker`, and (Slice 2/3)
  `selectItemsInMarquee` + `StretchEntityCommand` multi-entity params — zero new deselect
  or marquee or move-command implementations.

## 4. Files

**NEW**
- `src/subapps/dxf-viewer/systems/grip/GripArmedStore.ts`

**MOD (Slice 1)**
- `config/color-config.ts` (`GRIP_ARMED_COLOR`)
- `rendering/grips/constants.ts` (armed size multipliers + default colour)
- `rendering/grips/types.ts` (`'armed'` temperature + `armedKeys` on render state)
- `rendering/grips/grip-temperature.ts` (`armedKeys` input + `'armed'` branch)
- `rendering/grips/GripColorManager.ts` + `GripSizeCalculator.ts` (`'armed'` entries)
- `rendering/types/Types.ts` + `systems/phase-manager/types.ts` (`armedKeys`)
- `systems/phase-manager/renderers/GripPhaseRenderer.ts` (pass `armedKeys`)
- `rendering/entities/BaseEntityRenderer.ts` (`armedKeys` field + thread to gripState)
- `canvas-v2/dxf-canvas/DxfRenderer.ts` (`armedKeys` param + 2 call sites)
- `hooks/grip-computation-types.ts` (`DxfGripInteractionState.armedKeys`)
- `hooks/grips/grip-projections.ts` (`buildGripInteractionState(..., armedKeys)`)
- `hooks/grips/useUnifiedGripInteraction.ts` (subscribe + Esc clears armed)
- `hooks/grips/grip-mouse-handlers.ts` (click-away clears armed in `runGripMouseDown`)
- `hooks/grips/grip-mouseup-handler.ts` (click-vs-drag → arm; `applyGripArmClick` +
  `ARM_CLICK_MAX_MOVE_PX`). NOTE: a concurrent refactor by another agent split
  `runGripMouseUp` out of `grip-mouse-handlers.ts` into this new file and carried the
  arming logic verbatim — the click-to-arm intercept lives here.

## 5. Google-level checklist (N.7.2)

- Proactive — arming happens at the click event, not as a render side effect ✅
- No race — event-time store writes; colour is a derived read ✅
- Idempotent — `setOnly`/`toggle`/`clear` converge; re-deriving temperature is pure ✅
- SSoT — one store, one resolver, one colour constant ✅
- ADR-040 — low-frequency click subscription, no 60fps drag path added ✅

✅ **Google-level: YES** (Slice 1) — reuses the temperature/marquee/command SSoTs, no
duplicate deselect/move logic, ADR-040-safe.

## 6. Out of scope / DEFER

- **Slice 2** — marquee rubber-band over grips (`selectItemsInMarquee` + grip-center proximity).
- **Slice 3** — group move of all armed grips by one delta (single composite undo via
  `StretchEntityCommand` multi-entity params) + typed distance/coordinate (PromptDialogStore
  / dynamic input).
- Arming hot-grip kinds (wall/column move/rotate/corner handles) into the multi-set.

## Changelog

- **2026-06-19** — Slice 1 created (Opus 4.8). `GripArmedStore` + `'armed'` orange
  temperature + click-to-arm (plain/shift) with click-vs-drag threshold + Esc/click-away
  clear. Render thread plumbed end-to-end. Pending browser-verify + commit.
