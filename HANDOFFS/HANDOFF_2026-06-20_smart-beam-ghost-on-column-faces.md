# HANDOFF — Smart beam-tool ghost that snaps to column faces

**Date:** 2026-06-20
**Owner of next session:** fresh session (recommended `/clear` before starting)
**Status:** SPEC LOCKED by Giorgio. NO code written yet. Start at Plan Mode (N.0.1 Phase 1).

> Respond to Giorgio in **Greek** (CLAUDE.md language rule). Do NOT commit/push (N.(-1)).
> One `tsc` at a time (N.17). Prefer jest. SSoT-first: reuse, never duplicate (N.0/N.12).

---

## 0. GOAL (one line)

When the **Beam** tool is active, show a small **smart ghost** (like the column ghost,
ADR-398) BEFORE the first click. Near a rectangular column it auto-orients + anchors to
the nearest face; the 1st click locks the START there, the 2nd click is FREE (the beam
can be diagonal; ORTHO forces axis-aligned).

---

## 1. FULL LOCKED SPEC (confirmed with Giorgio, 2026-06-20)

### 1.1 Ghost before first click
- Selecting the Beam tool immediately shows a **small** beam ghost following the cursor
  (NOT huge — same UX as the column ghost today).
- **Away from any column → ghost follows the cursor freely** (no snap).
- **Near a column face → the ghost snaps** (orientation + anchor, below).

### 1.2 Orientation per column face (beam exits OUTWARD, perpendicular to the face;
the beam's near short-edge butts flush against that face)

| Cursor near column face | Beam orientation | Which beam face butts the column |
|---|---|---|
| **East** (right)  | horizontal, exits east  | beam **WEST** (left) short end ↔ column east face |
| **West** (left)   | horizontal, exits west  | beam **EAST** (right) short end ↔ column west face |
| **South** (bottom)| vertical, exits south   | beam **NORTH** face ↔ column south face |
| **North** (top)   | vertical, exits north   | beam **SOUTH** face ↔ column north face |

### 1.3 Three DISCRETE anchor positions ALONG the face (Giorgio chose **Option A**:
3 fixed snaps, the ghost JUMPS between them — NO continuous sliding, NO in-between)

Example = EAST face (beam horizontal). Cursor moves vertically along the face:
| Cursor zone on the face | Anchor |
|---|---|
| **Bottom 1/3** | beam bottom-left corner ≡ column bottom-right (SE) corner → south faces flush |
| **Middle 1/3** | beam centre ≡ column centre (centreline alignment) |
| **Top 1/3**    | beam top-left corner ≡ column top-right (NE) corner → north faces flush |

…**symmetric for all 4 faces**. So per column there are 4 faces × 3 anchors = 12 candidate
ghost placements; the cursor's nearest-face + nearest-third selects exactly one.

### 1.4 Click flow
1. **1st click** → locks the beam **START** at the system-proposed (snapped) position.
2. **2nd click** → user-defined, sets the **END** → completes the beam.
   - The 2nd click direction is **FULLY FREE** (diagonal beams allowed).
   - **ORTHO** is the user's tool to force a perfectly horizontal/vertical beam.
   - ⇒ Do NOT lock the axis to the ghost orientation after click 1. The ghost
     orientation only chooses the START anchor, not the final beam axis.

---

## 2. MANDATORY SSoT AUDIT (run BEFORE coding — reuse, never re-implement)

```
# The column ghost-before-click this MIRRORS (ADR-398):
rg -n "resolveColumnDrawSnap|resolveColumnGhostStatusFromSnap|ColumnPlacementGhostStatusStore" src/subapps/dxf-viewer
rg -n "useColumnTool|useColumnGhostPreview|ColumnAnchorGhostRenderer" src/subapps/dxf-viewer
# The beam tool + its WYSIWYG preview (ADR-363 §5.7) to extend:
rg -n "useBeamTool|beam-completion|buildAnchoredBeamParams|wysiwygPreview|justifyGridSegment" src/subapps/dxf-viewer
# Beam↔column flush + face/axis projection SSoT to REUSE (do NOT re-derive geometry):
rg -n "beam-column-flush|beamColumnFlush|canonicalAxisNormal" src/subapps/dxf-viewer
rg -n "beam-axis-projection|projectPolygonOnAxis|projectColumnFootprintOnAxis|beamFramesColumn" src/subapps/dxf-viewer
# Snap scheduler / nearest-snap engines the column placement uses:
rg -n "NearestSnapEngine|snap-scheduler|mouse-handler-move" src/subapps/dxf-viewer
```

### Known existing SSoT to build on (verify against CODE — docs may be stale, N.0.1):
- **ADR-398 column placement snap context** — `column-placement-snap-context.ts`
  (`resolveColumnDrawSnap` + `resolveColumnGhostStatusFromSnap`),
  `ColumnPlacementGhostStatusStore`, `useColumnGhostPreview`, `ColumnAnchorGhostRenderer`,
  wired through `snap-scheduler.ts` + `mouse-handler-move/up`. THIS is the mirror — the
  beam tool should get an analogous "ghost-before-click + face snap context".
- **`beam-column-flush.ts`** (ADR-363 §5.7) — geometric left/right justification so a
  beam face sits flush against a column. Reuse for the "which face butts the column".
- **`beam-axis-projection.ts`** + **`projectPolygonOnAxis` / `projectColumnFootprintOnAxis`
  / `beamFramesColumn`** (footprint-based kind-agnostic framing, ADR-494) — signed
  perpendicular projection onto a face/axis; reuse for face detection + corner anchors.
- **Beam WYSIWYG preview** (ADR-363 §5.7) — preview is a real `BeamEntity`
  (`wysiwygPreview` flag); the ghost should reuse this, not a bespoke outline.

**Principle:** like the column work, this should be mostly EMIT (ghost) + a pure
face/anchor RESOLVER that REUSES the projection/flush SSoT. Minimal new geometry.

---

## 3. SUGGESTED SHAPE (confirm in plan, do not treat as final)

- A pure **`beam-column-face-snap.ts`** resolver: given cursor + nearby column footprint →
  `{ face: 'E'|'W'|'N'|'S', anchor: 'lo'|'mid'|'hi', orientation, startPoint }` using
  `projectPolygonOnAxis` / `beam-column-flush` (no re-derived rect math).
- A transient **ghost-status store** (zero-React, mirror `ColumnPlacementGhostStatusStore`)
  for the snapped start + a small default beam preview.
- Wire into the beam tool's move handler (mirror `useColumnGhostPreview` + the
  `snap-scheduler` path). 1st click consumes the snapped start; 2nd click stays the
  existing free beam-completion path (ORTHO already handled by the generic tool).

⚠️ ADR-040 micro-leaf rules apply to any renderer/store you touch (read CLAUDE.md DXF
section). CHECK 6B/6D may require an ADR staged if you touch renderer/registry files.

---

## 4. ADR / DOC

- Mirror/extend **ADR-398** (column placement snap context + ghost status) for the beam.
- Grips/preview context: **ADR-363 §5.7** (beam placement WYSIWYG + edge-anchor),
  **ADR-494** (footprint-based framing), **ADR-487** (living structural organism vision).
- On completion: update the ADR changelog + `adr-index.md` + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`
  (1–2 lines, what REMAINS) in the SAME commit Giorgio makes — but do NOT commit yourself.

---

## 5. SHARED TREE WARNING

Working tree is SHARED with other agents. `git add` ONLY your own beam-ghost files.
Do NOT touch `bim/structural/**`, `bim/foundations/**`, i18n, or files you did not change.

---

## 6. PARKED ITEM (do not lose — separate task)

**Extra-edge grip centralization** (from the wall-grip session, 2026-06-20): the
`+2 opposite mid-edges + centre move` orchestration is DUPLICATED between
`beam-grips.ts` (`applyBeamExtraEdgeGrip` + push block) and `wall-grips.ts`
(`applyWallExtraEdgeGrip` + push block). Proper fix = lift the 2 roles
(`width-edge-far`, `length-edge-start`) into the shared `axis-box-grips.ts`
(`AxisBoxGripRole` + opt-in `getAxisBoxGrips({extraMidEdges:true})` +
`applyAxisBoxGripDrag`), then DELETE both per-entity helpers. Giorgio was asked
yes/no to do it now and pivoted to this beam feature — so it is **pending his go-ahead**,
NOT abandoned. Touches handoff-forbidden `axis-box-grips.ts` + committed beam code
(`0af3a0f6`) → needs explicit approval.
