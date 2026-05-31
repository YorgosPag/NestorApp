# 🤝 HANDOFF — ADR-401 Phase G (Stair Attach-to-Structural: base/top → πλάκα/landing)

**Date:** 2026-06-01
**Agent target:** Opus 4.8 (Plan Mode → Implementation)
**Status:** ⏳ G NOT started · Phase A→E (wall) + F.1/F.2/F.3 (column) DONE — **F.3 pending commit στο working tree** (ο Giorgio κάνει commit, ΟΧΙ ο agent)

---

## 📍 TL;DR — Πού είμαστε

**ADR-401 = top/base attach-to-structural (Revit «Attach Top/Base»).** Ο τοίχος/κολώνα «κολλάει» κορυφή ή βάση σε structural host (πλάκα/δοκάρι/στέγη) και το ύψος προσαρμόζεται **συσχετιστικά** (associative), όχι με στατική αφαίρεση.

- ✅ **Wall** (Phases A→E.4) — DONE, committed.
- ✅ **Column** (F.1+F.2+F.3) — DONE. **F.3 (auto-attach + ribbon + 3D grip + edit-break + Boy-Scout γενίκευση) είναι στο working tree, pending commit.**
- ❌ **Stair (Phase G = ΑΥΤΟ ΤΟ TASK)** — η σκάλα δεν έχει καθόλου attach ακόμα.

> ⚠️ **COMMIT:** Ο Giorgio κάνει commit, ΟΧΙ ο agent (N.(-1)). Άσε τη δουλειά στο working tree και σταμάτα.

---

## 🧱 Boy-Scout θεμέλιο που ΗΔΗ υπάρχει (το F.3 το έφτιαξε — ΧΡΗΣΙΜΟΠΟΙΗΣΕ ΤΟ)

Το F.3 δημιούργησε **γενικό SSoT** που η σκάλα πρέπει να καταναλώσει (μηδέν διπλότυπο):

| SSoT | Αρχείο | Τι κάνει |
|------|--------|----------|
| **Generic attach/detach** | `bim/entities/entity-attach-detach.ts` | `detachEntitySide` / `isEntitySideAttached` / `detachSidesAffectedByVerticalEdit` πάνω σε **`VerticalAttachParams`** (wall+column ικανοποιούν δομικά· η σκάλα πρέπει να ικανοποιήσει το ίδιο shape ή adapter) |
| **Host underside SSoT** | `bim/geometry/wall-host-plan-builder.ts` | `buildWallHostInputs(beams, slabs)` + `beamHostInput`/`slabHostInput` + `HostFootprintInput` (underside/topface formulas σε mm, κεκλιμένα μέσω `undersideZmmAt?`) — **REUSE ΑΥΤΟΥΣΙΟ** |
| **Per-corner profile (column)** | `bim/geometry/column-vertical-profile.ts` | blueprint για «οντότητα χωρίς άξονα» — top=lower-envelope, base=upper-envelope. Η σκάλα είναι ενδιάμεση (έχει run-άξονα ΑΛΛΑ base+top σε διαφορετικά elevations). |
| **Slab slope** | `bim/geometry/slab-slope.ts` | `slabUndersideZmmAt`/`slabTopZmmAt` — κεκλιμένη πλάκα/landing |

---

## 🎯 Phase G — Τι πρέπει να γίνει (mirror column F.3, ΜΕ stair semantics)

### ⚠️ Κρίσιμες ΔΙΑΦΟΡΕΣ της σκάλας από wall/column (διάβασέ τις ΠΡΩΤΑ):

1. **Η σκάλα ΔΕΝ έχει `topBinding`/`baseBinding`/`attachTopToIds`/`attachBaseToIds`.** Πρέπει να **προστεθούν** στο `StairParams` (`bim/types/stair-types.ts:327`). Δίπλα στα υπάρχοντα `totalRise`, `stepCount`, `rise`, `tread`, `basePoint`, `storeyId?`, `offsetFromStorey?`.
2. **Η σκάλα ΔΕΝ έχει `.schemas.ts` (Zod).** Wall/column έχουν `wall.schemas.ts`/`column.schemas.ts` με refinements `attached ⇔ ≥1 id`. **Η σκάλα έχει validation engine** (`StairValidationState`, code-profile), ΟΧΙ Zod. → Απόφαση Plan Mode: ή NEW `stair.schemas.ts` (mirror) ή refinement στο validation engine. **Ρώτα τον Giorgio αν αμφιβάλλεις** (απλά ελληνικά + παράδειγμα).
3. **Stair «attach top» ≠ wall «attach top».** Η σκάλα πρέπει να φτάνει **ακριβώς** σε host elevation ΑΛΛΑ με **ακέραια σκαλοπάτια** (Revit risers = integer). → `totalRise = hostUndersideZmm − baseZmm`· `stepCount = round(totalRise / rise)`· `rise = totalRise / stepCount` (whole-step snap). **Reuse `computeStairResizeParams` axial→run/stepCount whole-step snap** (ΗΔΗ υπάρχει από ADR-402 Sub-Phase 1, βλ. `bim3d-resize-bridge` stair branch).
4. **3D κάθετο grip:** το **axis-Y resize της σκάλας είναι σήμερα `null`** (ADR-402 Sub-Phase 1 — `RESIZE_HANDLES_BY_TYPE.stair=[x,z]` μόνο, axis-Y→null). → Το «3D grip attach» part είναι **είτε deferred είτε απαιτεί νέο vertical grip πρώτα**. Πρότεινε στον Giorgio να **αρχίσουμε χωρίς το 3D grip** (auto-attach + ribbon + edit-break) και να αφήσουμε το grip για υπο-φάση.
5. **Stair «attach base» = η βάση κάθεται σε host top-face** (πλάκα/πεδιλοδοκός/landing). Το `basePoint.z` (ή `offsetFromStorey`) γίνεται resolved-from-host αντί scalar.

### Sub-tasks (mirror column F.3, προτεινόμενη σειρά):

| # | Sub-task | Column blueprint (διάβασέ το — όλα στο working tree) | Stair target |
|---|----------|------------------------------------------------------|--------------|
| **G0** | **Params + validation** | `bim/types/column-types.ts` (`attachTopToIds?`/`attachBaseToIds?`) + `column.schemas.ts` | `StairParams += topBinding?/baseBinding?/attachTopToIds?/attachBaseToIds?` + validation (Zod ή engine — βλ. ΔΙΑΦΟΡΑ #2) |
| **G1** | **Resolver SSoT** | `bim/geometry/column-vertical-profile.ts` (`resolveColumnTopProfile`/`...Base`/`makeColumnHostResolver`) | NEW `bim/geometry/stair-vertical-profile.ts` — `resolveStairTopZmm`/`resolveStairBaseZmm` (footprint=base/top landing polygons· **whole-step snap** στο top). REUSE `buildWallHostInputs`/`beamHostInput`/`slabHostInput` + `isPointInPolygon`. |
| **G2** | **Geometry consumer** | `bim-3d/converters/column-piece-geometry.ts` + `computeColumnGeometry(profile?)` + `column-boq-feed.ts` | `StairGeometryService` resolved `totalRise`/`stepCount` από profile· `StairToThreeConverter` ακολουθεί· `stair-boq-sync.ts` profile-aware. **Flat/μη-attached = byte-for-byte fast path.** |
| **G3** | **Auto-attach** | `bim/columns/column-structural-attach-coordinator.ts` (`findColumnsToAutoAttachToHost`) + `hooks/useStructuralAutoAttach.ts` (column branch) | NEW `bim/stairs/stair-structural-attach-coordinator.ts` (`findStairsToAutoAttachToHost` — top landing footprint κάτω από πλάκα επόμενου ορόφου + Z-gate) + stair branch στο `useStructuralAutoAttach` + EventBus `bim:stairs-auto-attached` + toast |
| **G4** | **Command** | `core/commands/entity-commands/AttachColumnsCommand.ts` / `DetachColumnsCommand.ts` (`side` param, one-file pattern) | NEW `AttachStairsCommand.ts` / `DetachStairsCommand.ts` (recompute stair geometry/validation· ΟΧΙ opening-cascade) |
| **G5** | **Edit-break** | `ui/.../useRibbonColumnBridge.dispatchParams` τυλίγει με `detachSidesAffectedByVerticalEdit` | `bim/hooks/use-ribbon-stair-bridge.ts` + `stair-param-helpers.ts` — manual edit `totalRise`/`stepCount`/`rise` ενώ attached → detach affected side (generic SSoT `detachSidesAffectedByVerticalEdit`) |
| **G6** | **Ribbon** | `hooks/tools/useWallAttachTool.ts` (γενικό wall+column) + `wall-attach-pick.ts` (`resolveColumnAttachTargets`) + ToolTypes `column-attach-top/-base` + `contextual-column-tab.ts` panel | γενίκευση `useWallAttachTool` → wall+column+**stair** (ToolTypes `stair-attach-top/-base`) + `resolveStairAttachTargets` + stair contextual ribbon panel `stair-structural-attach` (reuse icons + i18n el/en) |
| **G7** | **3D grip (DEFERRED;** βλ. ΔΙΑΦΟΡΑ #4) | `RESIZE_HANDLES_BY_TYPE.column += 'resize-m-y'` + `computeColumnResizeParams` axis-Y split + detach-on-drag | ΑΠΑΙΤΕΙ πρώτα stair vertical grip (axis-Y σήμερα null). **Πρότεινε deferred.** |

**Stair-side αρχεία (VERIFIED PATHS, grep'd 2026-06-01):**
- `bim/types/stair-types.ts:327` (`StairParams` — εδώ μπαίνουν τα attach params)
- `bim/geometry/stairs/StairGeometryService.ts` (resolved totalRise/stepCount)
- `core/commands/entity-commands/UpdateStairParamsCommand.ts` (υπάρχει — edit-break branch path)
- `bim/hooks/use-ribbon-stair-bridge.ts` + `bim/hooks/bridge/stair-command-keys.ts` + `bim/hooks/bridge/stair-param-helpers.ts` (ribbon wiring)
- `bim/hooks/use-stair-persistence.ts` (auto-attach listener hook reference)
- `bim-3d/converters/StairToThreeConverter.ts` (3D)
- `bim/services/stair-boq-sync.ts` (BOQ)
- `bim/renderers/StairRenderer.ts` (2D — πιθανό no-op cut-state, mirror WallRenderer B3c)
- `bim-3d/gizmo/__tests__/bim3d-resize-bridge-stair.test.ts` + `bim3d-resize-bridge` stair branch (`computeStairResizeParams` whole-step snap — REUSE)

**⚠️ ΔΕΝ υπάρχει `stair.schemas.ts`** — απόφαση Plan Mode (Zod vs engine validation).

**Προτεινόμενη σειρά:** G0 → G1 → G3 (auto-attach, highest value) → G4 → G5 (edit-break) → G6 (ribbon) → G2 (geometry consumer ενδιάμεσα, μετά G1) → G7 deferred.

---

## ⚠️ MULTI-AGENT WARNING (κρίσιμο)

Στο working tree υπάρχουν αρχεία **ΑΛΛΟΥ agent** (ADR-402/403: `BimViewport3D.tsx`, `placement/use-bim3d-column-placement.ts`, `bim-3d/animation/bim3d-edit-*`, `bim-gizmo-*`, `gizmo-geometry.ts`) **ΚΑΙ** τα δικά μας F.3 column-files (uncommitted).

- ❌ **ΜΗΝ** `git add -A` — ΠΟΤΕ. Μόνο specific files.
- ❌ **ΜΗΝ** `git checkout`/`restore` σε αρχεία άλλου agent (μόνο `git reset HEAD` αν χρειαστεί).
- ⚠️ `bim3d-resize-bridge.ts` / `bim-gizmo-overlay.ts` / `gizmo-geometry.ts` τα αγγίζουν **και column F.3 και ο 3D-edit agent** — διάβασε ΠΡΙΝ γράψεις, μην πατήσεις αλλαγές.
- Πριν από commit (που το κάνει ο Giorgio): `git diff --cached` με specific files.

---

## 🧪 Τι ισχύει τώρα (F.3, pre-G baseline)

- Column F.3 tests: `entity-attach-detach.test.ts` + `column-structural-attach-coordinator.test.ts` + `AttachColumnsCommand.test.ts` + `bim3d-resize-bridge` column grips → κατά τη μνήμη 75/75 + 41/41 PASS, tsc 0.
- 🔴 **Browser verify A→F.3 ΕΚΚΡΕΜΕΙ** (δεν έχει γίνει — runtime bugs που τα tests/tsc δεν πιάνουν).

---

## 📋 N.15 — Docs να ενημερωθούν με το Phase G (ΟΛΑ μαζί, ίδιο commit με κώδικα)

1. `docs/centralized-systems/reference/adrs/ADR-401-...md` — §5 (νέα `Phase G — Stair mirror`) + §8 changelog + status header + §scope («stair mirror»)
2. `docs/centralized-systems/reference/adr-index.md`
3. `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (❌ ΕΚΚΡΕΜΕΙ → ✅ ΥΛΟΠΟΙΗΜΕΝΟ + ημερομηνία)
4. `.claude-rules/pending-ratchet-work.md` (αν σχετίζεται με γενίκευση)
5. memory `project_adr401_wall_top_constraints.md` + `MEMORY.md` index line

---

## 🚦 Next Session — Start Here

1. **Industry research ΠΡΩΤΑ** (Giorgio: «κάνε αυτό που κάνει η Revit· αν δεν έκανες έρευνα, κάνε τώρα»): Revit «Stair Base/Top Level», αυτόματος υπολογισμός risers όταν αλλάζει το ύψος ορόφου, multistory stairs.
2. **Plan Mode**: διάβασε τα column-F.3 blueprint αρχεία (πίνακας πάνω, ΟΛΑ στο working tree) + `stair-types.ts` + `StairGeometryService` → φτιάξε plan για stair mirror **με τις 5 ΔΙΑΦΟΡΕΣ**.
3. **Ερωτήσεις στον Giorgio** (απλά ελληνικά + παραδείγματα, μία-μία — βλ. memory `feedback_questions_simple_greek_examples`): (α) Zod schema vs engine validation; (β) 3D grip deferred ή τώρα; (γ) auto-attach μόνο top ή και base;
4. Υλοποίηση με σειρά G0→G1→G3→G4→G5→G6→(G2)→G7-deferred. **«Phase per session»** — αν είναι μεγάλο, σπάσε το.
5. N.7.2 Google-level checklist + tests ανά sub-task.
6. N.15 docs update.
7. **ΜΗΝ commit** — άσε στο working tree, ενημέρωσε τον Giorgio.

**🎯 Μοντέλο:** Opus 4.8 (cross-cutting: types + geometry + commands + ribbon + 3D + BOQ = 2+ domains, 5+ αρχεία → N.8/N.14).

**Ref:** ADR-401 §5 (Phase F changelog = το ακριβές column blueprint) + adr-index. Memory: `project_adr401_wall_top_constraints.md`. Προηγ. handoff: `2026-06-01_ADR-401_PhaseF3-column-attach-auto-ribbon-grip-editbreak_handoff.md`.
