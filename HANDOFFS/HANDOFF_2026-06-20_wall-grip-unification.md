# HANDOFF — Wall grip unification (column/beam parity)

**Date:** 2026-06-20
**Owner of next session:** you (fresh session)
**Goal:** Give the WALL the SAME selection-grip set the COLUMN and BEAM already have —
**4 corner grips + 4 mid-edge grips (one per face) + a centre 4-arrow MOVE glyph +
rotation** — Revit-grade, **FULL SSoT, FULL enterprise, ZERO duplicates**.

> This mirrors the work just completed for the BEAM (uncommitted, in the shared tree).
> Read `src/subapps/dxf-viewer/bim/beams/beam-grips.ts` first — it is the template.

---

## 0. HARD CONSTRAINTS (read first)

- **The working tree is SHARED with another agent.** Touch ONLY the grip files listed
  in §5. **DO NOT** touch anything under `bim/structural/**`, `bim/foundations/**`,
  i18n, or any file you did not change — another agent owns those.
- **DO NOT COMMIT and DO NOT PUSH.** Giorgio commits. (CLAUDE.md N.(-1).)
- **DO NOT revert** the uncommitted changes already in the tree (beam grips, column
  label, guide-panel position). They are the BASELINE you build on.
- **MANDATORY FIRST STEP: a real SSoT audit by `grep`** (see §2) before writing any code.
  The shared edge SSoT already exists — reuse it, never re-implement.
- Respond to Giorgio in **Greek** (CLAUDE.md language rule).
- One `tsc` at a time on this machine (N.17). Prefer running the jest grip tests.

---

## 1. WHAT ALREADY EXISTS (the SSoT you MUST reuse)

The beam session extracted two shared primitives into the axis-anchored box SSoT —
**they already exist, do NOT recreate them:**

`src/subapps/dxf-viewer/bim/grips/axis-box-grips.ts`
- `axisBoxEdgeMidpoint(params, edge)` → world midpoint of ANY rect edge (emission).
- `applyAxisBoxEdgeDrag(params, edge, delta, minWidthMm)` → opposite-edge-fixed edge
  resize → `AxisBoxPatch`. The ONE edge-drag implementation; already used by the
  standard `width-edge`/`length-edge` roles AND by the beam's 2 extra edges.

Shared move-glyph system (already wired for ALL entities — activates on EMIT only):
- Glyph render (4 autonomous arrows, per-arm hover grow + cold→orange):
  `rendering/grips/GripShapeRenderer.ts` → `renderMoveGlyph`.
- Per-arm hover hit-test + store: `bim/grips/move-glyph-zones.ts`,
  `bim/grips/move-glyph-zone-store.ts`.
- Click→dialog→move: `hooks/grips/grip-mouse-handlers.ts` (`runDirectionalMove`) +
  `systems/prompt-dialog/*`.
- Glyph shape registry: `bim/grips/grip-glyph-registry.ts` — **`wall-midpoint` → 'move'
  and `wall-rotation` → 'rotation' are ALREADY registered.**
- Hot-grip FSM: `hooks/grips/wall-hot-grip-fsm.ts` — **`wall-midpoint` → 'move',
  `wall-rotation` → 'rotate', `wall-corner-*` → 'corner' ALREADY registered.**
- Move-glyph local frame supports linear entities (wall start→end):
  `bim/grips/move-glyph-frame.ts` → `resolveMoveGlyphFrame` (no change needed).

**Conclusion:** like the beam, the wall needs almost no new infrastructure — only to
EMIT the missing grips and DELEGATE their drag to the shared SSoT.

---

## 2. MANDATORY SSoT AUDIT (run these BEFORE coding)

```
rg -n "wall-midpoint|wall-thickness|wall-edge-length|wall-rotation" src/subapps/dxf-viewer
rg -n "applyAxisBoxEdgeDrag|axisBoxEdgeMidpoint" src/subapps/dxf-viewer
rg -n "WALL_ROLE_TO_KIND|wallAxisBoxParams|invertAxisBoxRoleMap" src/subapps/dxf-viewer
rg -n "Record<WallGripKind|: WallGripKind\]" src/subapps/dxf-viewer   # exhaustive maps?
rg -n "moveMidpoint|resizeThickness|rotateWall|dna" src/subapps/dxf-viewer/bim/walls
```
Confirm (these were true on 2026-06-20 — re-verify, docs are stale):
- The wall's straight path emits ONLY the 7 axis-box grips (2 mids + 4 corners + rot).
- `wall-midpoint` MOVE transform EXISTS (`wall-grip-transforms.ts` `moveMidpoint`) and
  is REGISTERED, but is **not emitted** (see `wall-grips.test.ts` test #5).
- No `Record<WallGripKind, …>` exhaustive map exists (adding kinds is safe).
- The `wall-grips.ts` doc comment about "suppressRedundantStraightGrips" / "Phase
  1C-ter" is **STALE** — CODE is the source of truth (CLAUDE.md N.0.1).

---

## 3. CURRENT WALL STATE (code = truth, 2026-06-20)

`src/subapps/dxf-viewer/bim/walls/wall-grips.ts`
- `getWallGrips` straight path (`kind !== 'curved' && !== 'polyline'`):
  `getAxisBoxGrips(wallAxisBoxParams(params)).map(... wallGripKind: WALL_ROLE_TO_KIND[g.role])`.
- Curved/polyline: bespoke (start/end + single thickness handle + curve/vertices),
  **no centre MOVE marker** ("Alt+drag translates").

`src/subapps/dxf-viewer/bim/walls/wall-rect-adapter.ts`
- `WALL_ROLE_TO_KIND: Record<AxisBoxGripRole, WallGripKind>` →
  `width-edge:'wall-thickness'`, `length-edge:'wall-edge-length'`,
  4 corners → `wall-corner-*`, `rotation:'wall-rotation'`.
- `wallAxisBoxParams(params)` sets **`widthFaceSign = flip`** → the +perp face (and the
  single `wall-thickness` handle) follow the wall flip. **The 2 extra edges MUST be the
  OPPOSITE faces relative to flip.**
- Rect-grip drag dispatch lives here (delegates to `applyAxisBoxGripDrag`); rotation is
  handled bespoke in `wall-grip-transforms.ts` (omitted from the rect dispatch).

`src/subapps/dxf-viewer/bim/walls/wall-grip-transforms.ts`
- `applyWallGripDrag` dispatch: `wall-midpoint`→`moveMidpoint` (translate both
  endpoints), `wall-thickness`→`resizeThickness` (curved/polyline only),
  `wall-rotation`→`rotateWall`. **The axis-patch→WallParams mapping + `dna` drop +
  thickness clamp live here / in the rect dispatch — REUSE that, do not re-derive.**

---

## 4. THE TASK (mirror the beam, respect wall semantics)

### 4.1 Add 2 mid-edge grips so ALL 4 faces carry a midpoint (column/beam parity)
- New `WallGripKind` members in `hooks/grip-kinds.ts`:
  `'wall-thickness-far'` (the −perp thickness face) and `'wall-edge-length-start'`
  (the START short edge). (Name to match the existing convention; verify in audit.)
- EMIT them in `getWallGrips` straight path using **`axisBoxEdgeMidpoint(axisParams, edge)`**
  with the OPPOSITE-sign `RectEdge` of the existing handles, **respecting `flip`**:
  - existing `wall-thickness` is `{axis:'y', sign: faceSign}` where `faceSign = flip?-1:1`.
  - far thickness face → `{axis:'y', sign: -faceSign}`.
  - existing `wall-edge-length` is the END `{axis:'x', sign: 1}`.
  - start short edge → `{axis:'x', sign: -1}`.
- DRAG: delegate to **`applyAxisBoxEdgeDrag(wallAxisBoxParams(params), edge, delta, MIN)`**
  then map the `AxisBoxPatch`→`WallParams` through the EXISTING wall patch helper +
  **drop `dna`** (manual override) + thickness clamp — exactly like `wall-thickness`.
  Do this in `wall-rect-adapter.ts` / `wall-grip-transforms.ts` (whichever owns the
  rect dispatch). **DO NOT** re-derive frame/limits/resize — that is what
  `applyAxisBoxEdgeDrag` is for (zero duplicate; this was the exact mistake corrected
  in the beam work).

### 4.2 Add the centre 4-arrow MOVE glyph (`wall-midpoint`)
- EMIT one grip: `type:'center'`, `movesEntity:true`, `wallGripKind:'wall-midpoint'`,
  `position = axis midpoint`. Glyph/FSM/transform are ALREADY wired → behaviour becomes
  identical to the column/beam automatically (4 autonomous arrows, hover grow +
  cold→orange, click→distance dialog). Add it to the straight path; add it to
  curved/polyline too for consistency (the beam added it to curved as well —
  `moveMidpoint` already translates both endpoints + curveControl).

### 4.3 Rotation
- Already present (`wall-rotation`). Verify, no change expected.

### Arrow size: SAME as column/beam (Giorgio confirmed for the beam — shared glyph, no
  per-entity scale).

---

## 5. FILES YOU MAY TOUCH (and ONLY these)

| File | Change |
|---|---|
| `hooks/grip-kinds.ts` | +2 `WallGripKind` members |
| `bim/walls/wall-grips.ts` | emit 2 mids (`axisBoxEdgeMidpoint`) + `wall-midpoint` (straight + curved/polyline) |
| `bim/walls/wall-rect-adapter.ts` | drag dispatch for the 2 new edges → `applyAxisBoxEdgeDrag` + wall patch→params + `dna` drop |
| `bim/walls/wall-grip-transforms.ts` | only if the patch→params/dna helper lives here (reuse it) |
| `bim/walls/__tests__/wall-grips.test.ts` | update counts/order, flip test #5, add tests for the 2 edges + midpoint |

**Do NOT modify** `axis-box-grips.ts` (primitives already there), renderers, registries,
or the FSM — they already support everything.

---

## 6. TESTS

- Run: `npx jest src/subapps/dxf-viewer/bim/walls src/subapps/dxf-viewer/bim/grips --silent`
- Update `wall-grips.test.ts`: grip count (was 7 straight → 10), order, and **flip test
  #5** (`wall-midpoint` is now EMITTED with `movesEntity:true`).
- Add: midpoints on all 4 faces (positions), `wall-thickness-far` drag (near face fixed,
  thickness grows, `dna` dropped), `wall-edge-length-start` drag (end fixed), and a
  flip=true case (the far/start edges land on the correct faces).
- **Known PRE-EXISTING failure — NOT yours:** beam test
  `beam-grips.test.ts › 26. rotation grip … stands off the OPPOSITE perp face` fails on
  committed code too (rotation handle offset = 0). Ignore it; do not "fix" it here.

---

## 7. ACCEPTANCE CRITERIA

- Straight wall shows: 4 corners + 4 mid-edges + centre 4-arrow MOVE + rotation.
- The 4 arrows: hover → grow + cold→orange; click → distance dialog → wall translates.
- The 2 new edges resize thickness/length opposite-face-fixed, drop `dna`, clamp.
- `flip=true` places the extra faces correctly.
- Wall + foundation grip tests stay green (you reused shared code — prove zero regression).
- ZERO new duplication: the 2 edges go through `applyAxisBoxEdgeDrag`/`axisBoxEdgeMidpoint`;
  no re-derived `axisToRectFrame`/`rectFrameToAxis`/`applyRectEdgeDrag`/limits in wall code.
- Self-audit at the end (Giorgio will ask): is it centralized / enterprise / Google-grade /
  any duplicate? Answer honestly and fix before reporting.

---

## 8. ADR / DOC

- Grips SSoT: **ADR-363** (BIM grip system), **ADR-397** (grip glyph behaviour SSoT).
- Vision context (read for tone/intent, do not implement from it):
  `docs/centralized-systems/reference/adrs/ADR-487-living-structural-organism-vision.md`.
- ADR update (changelog) goes in the SAME commit Giorgio makes — prepare the text, note
  CHECK 6B/6D may require an ADR staged when renderer/registry files are involved (they
  are NOT in this task, but flag it if you end up touching one).
- Update `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (1–2 lines, what REMAINS) per N.15 — but do not commit.

---

## 9. CONTEXT: what the beam session did (your exact template)

1. `hooks/grip-kinds.ts`: added `beam-width-far`, `beam-edge-length-start`.
2. `bim/grips/axis-box-grips.ts`: extracted `axisBoxEdgeMidpoint` + `applyAxisBoxEdgeDrag`
   (the shared edge SSoT) and refactored the 7-role drag to use them.
3. `bim/beams/beam-grips.ts`: emitted the 2 extra mids (`axisBoxEdgeMidpoint`) + the
   `beam-midpoint` centre move (straight + curved); `applyBeamExtraEdgeGrip` delegates to
   `applyAxisBoxEdgeDrag`; `axisPatchToBeamParams` de-dup helper.
4. Tests updated + 3 added. Result: beam straight 7→10 grips, all grip tests green except
   the pre-existing #26.

Do the wall the SAME way — but layer the wall semantics (`flip`, `dna` drop, thickness
clamp) on top, the way the existing `wall-thickness` handler already does.
