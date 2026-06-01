# HANDOFF — ADR-401 Phase G (stair consumers) = mirror F.2 + F.3

- **Ημερομηνία**: 2026-06-01
- **Συντάκτης**: Claude (Opus 4.8)
- **Για**: ΝΕΑ συνεδρία (μετά /clear)
- **Εύρος**: Οι **consumers** του stair attach-to-structural (3D geometry / 2D τομή / BOQ / auto-attach / ribbon / 3D grip). Ο **πυρήνας (resolver) είναι ΗΔΗ DONE + committed** — βλ. §1.
- **⚠️ COMMIT**: ΤΟ ΚΑΝΕΙ Ο GIORGIO. Ο agent ΔΕΝ κάνει commit/push. Στο τέλος → «έτοιμο για commit» + λίστα αρχείων.
- **⚠️ ΜΕΓΕΘΟΣ**: Αυτή είναι **μεγάλη** φάση (mirror **δύο** ολόκληρων column phases F.2+F.3 = 15+ αρχεία, 2+ domains). **N.8 → Plan Mode (Opus) + υποδιαίρεση σε G.2/G.3, με έγκριση Giorgio.** ΜΗΝ τα κάνεις όλα σε μία συνεδρία.

---

## 0. Μοντέλο (N.14)

🎯 **Opus 4.7/4.8** — cross-cutting, 2+ domains, αρχιτεκτονική απόφαση (πού εγχέεται το resolved profile στο stair geometry pipeline). Ξεκίνα με **Plan Mode** (recognition: διάβασε column F.2/F.3 ως πρότυπο + stair geometry/2D/BOQ pipelines → υποδιαίρεσε → ζήτα έγκριση).

---

## 1. Τι ΕΙΝΑΙ ΗΔΗ DONE (μην το ξανακάνεις)

**Phase G CORE — committed `cf76362b` (κώδικας) + `3ca09f6e` (doc+test):**

- **SSoT resolver** `src/subapps/dxf-viewer/bim/geometry/stair-vertical-profile.ts`:
  - `resolveStairVerticalProfile(params, ctx) → StairVerticalProfile { baseZmm, topZmm, totalRise, stepCount, rise, topHasAttach, baseHasAttach, degenerate, missingHostIds }`
  - `resolveStairBaseZmm` (upper-envelope), `resolveStairTopZmm` (lower-envelope unbounded), `makeStairHostResolver`
  - **Whole-step snap** (Revit ίσα risers): resolved `totalRise = top − base` → `stepCount = round(totalRise/rise)`, `rise' = totalRise/stepCount`.
  - **Run-άξονας** (ΟΧΙ per-corner όπως κολώνα): sample-points = κέντρο + ±width/2 στο `basePoint` (base) και `basePoint + dir·totalRun` (top).
  - Fast path (καμία attach) = byte-for-byte nominal. Degenerate/missing → fallback + flags.
- **Boy-Scout SSoT** `src/subapps/dxf-viewer/bim/geometry/host-footprint-eval.ts` (`hostUndersideAt`/`hostTopsideAt`/`collectHostFootprints`/`makeHostFootprintResolver`/`HOST_Z_EPS`) — point-in-footprint host-face primitive, ΚΟΙΝΟ με κολώνα (το `column-vertical-profile.ts` τα re-exports).
- **Schemas/types**: `stair.schemas.ts` strict attach Zod + `stair-types.ts`/`bim-binding.ts` (`StairTopBinding`/`StairBaseBinding` = alias των wall· `attachTopToIds?`/`attachBaseToIds?`).
- **Test**: `bim/geometry/__tests__/stair-vertical-profile.test.ts` (20 cases) — 39/39 με regression column.

> ✅ Δηλαδή: ο resolver **υπολογίζει** σωστά base/top/stepCount/rise. **ΛΕΙΠΕΙ**: κανείς consumer δεν τον **καλεί** ακόμα. Η attached σκάλα ΔΕΝ αλλάζει γεωμετρία/BOQ/UI.

---

## 2. ΤΙ ΛΕΙΠΕΙ — consumers (mirror F.2 + F.3)

Πρότυπο = πώς έγινε για την **κολώνα** (F.2 = geometry consumers, F.3 = UX). Διάβασε ΠΡΩΤΑ τα column αρχεία και κάνε ακριβές mirror με stair semantics.

### G.2 — Geometry consumers (mirror F.2)

| # | Τι | Column reference (πρότυπο) | Stair target (να φτιάξεις/αγγίξεις) |
|---|----|----------------------------|--------------------------------------|
| 1 | **3D** — η attached σκάλα να ψηλώνει/κόβεται στο host + **re-step** | `bim-3d/converters/column-piece-geometry.ts` + `columnToMesh(...,topProfile?,baseProfile?)` σε `BimToThreeConverter` + `BimSceneLayer.syncColumns` | `bim-3d/converters/StairToThreeConverter.ts` + `bim/geometry/stairs/StairGeometryService.ts` (geometry SSoT entry) + `BimSceneLayer` stair sync |
| 2 | **BOQ** — profile-aware ποσότητες | `hooks/data/column-boq-feed.ts` (`columnBoqEntity`) + `computeColumnGeometry(...,profile?)` | NEW `hooks/data/stair-boq-feed.ts` (αν υπάρχει stair BOQ — αλλιώς skip/flag) + stair geometry quantities |
| 3 | **2D τομή/κάτοψη** | `ColumnRenderer` cut-state = NO-OP (doc μόνο) | stair 2D renderer — πιθανότατα παρόμοιο NO-OP, αλλά **έλεγξε** (η σκάλα τέμνεται διαφορετικά) |

**🔑 ΚΡΙΣΙΜΗ αρχιτεκτονική απόφαση (το βασικό «δύσκολο» αυτής της φάσης):**
Σε αντίθεση με την κολώνα (που απλά αλλάζει ύψος prism), η σκάλα όταν κάνει attach **αλλάζει `stepCount` + `rise`** (whole-step snap) → **όλη η γεωμετρία ξαναγεννιέται** (treads/risers/stringers/handrails/walkline). Άρα ο resolver πρέπει να εγχέεται **πριν** το `StairGeometryService` τρέξει: χτίζεις «effective StairParams» με τα snapped `basePoint.z`/`rise`/`stepCount`/`totalRise` και τα περνάς στο geometry service. **Στο Plan Mode εντόπισε ΑΚΡΙΒΩΣ το σημείο injection** (μάλλον στο scene-sync / converter, εκεί που υπάρχει host context — `buildWallHostInputs` + `makeStairHostResolver` + `resolveStairVerticalProfile`, guarded με `topBinding==='attached' || baseBinding==='attached'`).

### G.3 — UX (mirror F.3)

| # | Τι | Column reference | Stair target |
|---|----|------------------|--------------|
| 4 | **Auto-attach coordinator** | `bim/columns/column-structural-attach-coordinator.ts` (`findColumnsToAutoAttachToHost`/`...BaseToHost`) + branch στο `hooks/useStructuralAutoAttach.ts` | NEW `bim/stairs/stair-structural-attach-coordinator.ts` + stair branch στο `useStructuralAutoAttach` |
| 5 | **Commands** | `core/commands/entity-commands/AttachColumnsCommand.ts` + `DetachColumnsCommand.ts` | NEW `AttachStairsCommand` + `DetachStairsCommand` (mirror one-file `side` pattern· recompute stair geometry, ΟΧΙ opening-cascade) |
| 6 | **Ribbon** | `ui/ribbon/data/contextual-column-tab.ts` panel `column-structural-attach` + `ui/ribbon/hooks/useRibbonColumnBridge.ts` + `column-command-keys.ts` + γενίκευση `useWallAttachTool` (wall+column) | `contextual-stair-tab.ts` panel + `useRibbonStairBridge` (αν υπάρχει) + `stair-command-keys.ts` + **επέκταση `useWallAttachTool`** ώστε να χειρίζεται και stair (ToolTypes `stair-attach-top`/`-base`) |
| 7 | **Edit-break** | `useRibbonColumnBridge.dispatchParams` τυλίγει με `detachSidesAffectedByVerticalEdit` (από `bim/entities/entity-attach-detach.ts` — generic SSoT, ΗΔΗ υπάρχει) | stair ribbon dispatch ίδιο wrap (η σκάλα ικανοποιεί `VerticalAttachParams`; **έλεγξε** — αλλιώς γενίκευσε) |
| 8 | **3D top/base grip + detach-on-drag** | `RESIZE_HANDLES_BY_TYPE.column += 'resize-m-y'` + `computeColumnResizeParams` axis-Y split + detach-on-drag (`bim3d-resize-bridge.ts`) | ⚠️ Η σκάλα έχει **ΗΔΗ** resize grips (ADR-402 Sub-Phase 1 — `computeStairResizeParams`, `RESIZE_HANDLES_BY_TYPE.stair=[x,z]`, `bim3d-resize-bridge-stair.test.ts`). Πρόσθεσε axis-Y top/base attach grip + detach-on-drag ΕΠΑΝΩ σε αυτό, mirror column. |

**Generic SSoT που ΗΔΗ υπάρχει (reuse, μην ξαναφτιάξεις):**
`bim/entities/entity-attach-detach.ts` — `detachEntitySide`/`isEntitySideAttached`/`detachSidesAffectedByVerticalEdit` (generic σε `VerticalAttachParams`· wall+column ικανοποιούν· **επιβεβαίωσε** ότι το stair-types ικανοποιεί δομικά — αλλιώς γενίκευσε ελαφρώς).

---

## 3. Πρόταση υποδιαίρεσης (phase-per-session)

- **G.2** (μία συνεδρία) — geometry consumers: 3D re-step + scene-sync injection + BOQ + 2D check. Το «βαρύ» κομμάτι = το injection point.
- **G.3** (άλλη συνεδρία) — UX: auto-attach coordinator + Attach/Detach commands + ribbon + edit-break + 3D top/base grip.

(Αν στο Plan Mode φανεί ότι χωράει αλλιώς, πρότεινε στον Giorgio.)

---

## 4. Κανόνες / προσοχή

- **ΓΛΩΣΣΑ**: απαντάς ΠΑΝΤΑ στα Ελληνικά.
- **❌ ΜΗΝ commit/push** — ο Giorgio το κάνει.
- **N.2**: μηδέν `any`/`as any`/`@ts-ignore`. **N.7.1**: ≤500 γρ./αρχείο, ≤40/συνάρτηση.
- **SSoT (N.0.2)**: reuse `host-footprint-eval`, `entity-attach-detach`, `buildWallHostInputs`, `makeStairHostResolver`. ΜΗΝ διπλασιάσεις formula παρειάς ή resolver.
- **Units (latent trap)**: meter-scenes — πρόσεξε `mmScaleFor`/`MM_TO_M`. Ο resolver δουλεύει σε **mm** (params space)· οι 3D consumers μετατρέπουν σε local m `(z−FFL)·0.001`. Βλ. [[feedback_grip_positions_read_geometry]].
- **ADR-040**: αν αγγίξεις canvas/scene/gizmo αρχεία → stage ADR (CHECK 6B/6D μπλοκάρουν αλλιώς).
- **ADR update (N.0.1 + N.15)**: στο τέλος → ADR-401 §5/§8 + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + adr-index (αν χρειαστεί) + memory `project_adr401_wall_top_constraints.md` + `MEMORY.md`. Ίδιο commit με κώδικα.
- **Tests**: κάθε νέο SSoT/consumer → test (όπως όλες οι φάσεις A→G core).

## 5. Verify στο τέλος
- `npx jest <νέα tests> stair-vertical-profile --silent` → PASS.
- `npx tsc --noEmit -p tsconfig.json` (background) → clean στα αγγιγμένα.
- ADR/N.15 ενημερωμένα. Working tree = μόνο τα δικά σου αρχεία → έτοιμα για commit Giorgio.

## 6. Σχετικά handoffs / refs (context)
- Core resolver handoff: `HANDOFFS/2026-06-01_ADR-401_PhaseG-stair-attach-to-structural_handoff.md`
- Column F.2 πρότυπο: `HANDOFFS/2026-05-31_ADR-401_PhaseF2-column-consumers_after-F1-core_handoff.md`
- Column F.3 πρότυπο: `HANDOFFS/2026-06-01_ADR-401_PhaseF3-column-attach-auto-ribbon-grip-editbreak_handoff.md`
- Stair 3D grips (ADR-402 Sub-Phase 1, για το grip κομμάτι): `HANDOFFS/2026-06-01-ADR-402-subphase1-stair-handoff.md`
- ADR: `docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md` (§5 Phase G bullet + §8 changelog top row)
- Memory: `project_adr401_wall_top_constraints.md` (Phase G entry)
