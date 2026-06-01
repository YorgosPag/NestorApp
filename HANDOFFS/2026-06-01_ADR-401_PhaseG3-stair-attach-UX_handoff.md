# HANDOFF — ADR-401 Phase G.3 (stair attach UX) = mirror F.3

- **Ημερομηνία**: 2026-06-01
- **Συντάκτης**: Claude (Opus 4.8)
- **Για**: ΝΕΑ συνεδρία (μετά /clear)
- **Εύρος**: Το **UX** του stair attach-to-structural (auto-attach coordinator / Attach+Detach commands / ribbon / edit-break / 3D top-base grip) = mirror της **column Phase F.3**.
- **⚠️ COMMIT/PUSH**: ΤΑ ΚΑΝΕΙ Ο GIORGIO. Ο agent ΔΕΝ κάνει commit/push. Στο τέλος → «έτοιμο για commit» + λίστα αρχείων.
- **⚠️ ΜΕΓΕΘΟΣ**: **Μεγάλη** φάση (mirror ολόκληρου F.3 = 10+ αρχεία, 2+ domains: commands + ribbon + 3D gizmo). **N.8 → Plan Mode (Opus) + έγκριση Giorgio πριν κώδικα.**

---

## 0. Μοντέλο (N.14)
🎯 **Opus 4.8** — cross-cutting (commands + ribbon + 3D gizmo), αρχιτεκτονική (edit-break generalization). Ξεκίνα **Plan Mode**: recognition (διάβασε column F.3 ως πρότυπο + ADR-402 Sub-Phase 1 stair resize) → πλάνο → έγκριση.

---

## 1. Τι ΕΙΝΑΙ ΗΔΗ DONE (μην το ξανακάνεις)

### Phase G CORE (committed cf76362b + 3ca09f6e)
- `bim/geometry/stair-vertical-profile.ts` — `resolveStairVerticalProfile(params, {resolveHostInput}) → StairVerticalProfile` (base upper-envelope / top lower-envelope / **whole-step snap** Revit ίσα risers) + `makeStairHostResolver`.
- `bim/geometry/host-footprint-eval.ts` — point-based host-face SSoT (κοινό κολώνα+σκάλα).
- `stair.schemas.ts` strict attach Zod + `stair-types.ts`/`bim-binding.ts` attach fields (`topBinding`/`baseBinding`/`attachTopToIds`/`attachBaseToIds`).

### Phase G.2 GEOMETRY CONSUMERS ✅ **committed `0934ab94`** (αυτή η συνεδρία)
- **NEW SSoT `bim/geometry/stairs/stair-effective-params.ts`**: `applyStairVerticalProfile(params, profile)` (spread snapped z/rise/stepCount/totalRise· μη-attached → **identity** ίδιο reference) + `resolveEffectiveStairParams(params, ctx)` = resolve+apply σε ΕΝΑ βήμα (επιστρέφει & `profile`).
- **NEW SSoT `bim/geometry/stairs/stair-host-resolver.ts`**: `makeStairHostResolverFromScene(scene)` (scene → host resolver, ίδιο idiom με `column-boq-feed`).
- **3D** `BimSceneLayer.syncStairs`: `hasAttached` guard → `toEffectiveStair` (re-step → `computeStairGeometry`) → `stairToMeshes` (**αμετάβλητη υπογραφή**).
- **BOQ** `stair-boq-sync.ts` (`StairBoqContext += resolveHostInput`) + `use-stair-persistence.ts` (χτίζει resolver από `levelManager` scene, 2 call sites).
- **2D** `StairRenderer.ts` = NO-OP (doc μόνο).
- **Datum (λυμένο):** ο resolver επιστρέφει Z στο ΙΔΙΟ floor-relative datum με το `basePoint.z` → **ΧΩΡΙΣ** `±floorElevationMm`. Γι' αυτό το `StairVerticalContext` δεν έχει `floorElevationMm` (αντίθετα με κολώνα).
- Tests: `stair-effective-params.test.ts` (8) + `stair-boq-sync.test.ts` (+2) → 40/40, tsc 0.

> ✅ Δηλαδή: η attached σκάλα ψηλώνει/κόβεται στο host (3D) + μετριέται σωστά (BOQ). **ΛΕΙΠΕΙ**: δεν υπάρχει UI για να **δημιουργήσεις/σπάσεις** το attach (ribbon/auto/grip).

---

## 2. ΤΙ ΛΕΙΠΕΙ — G.3 UX (mirror F.3). Πρότυπο = κολώνα F.3.

| # | Τι | Column reference (πρότυπο — διάβασέ το) | Stair target (φτιάξε/άγγιξε) |
|---|----|------------------------------------------|-------------------------------|
| 1 | **Auto-attach coordinator** | `bim/columns/column-structural-attach-coordinator.ts` (`findColumnsToAutoAttachToHost`/`...BaseToHost`) + branch στο `hooks/useStructuralAutoAttach.ts` | NEW `bim/stairs/stair-structural-attach-coordinator.ts` (footprint/run-samples centroid-in-host + Z-gate) + stair branch στο `useStructuralAutoAttach` |
| 2 | **Commands** | `core/commands/entity-commands/AttachColumnsCommand.ts` + `DetachColumnsCommand.ts` (one-file `side` pattern) | NEW `AttachStairsCommand` + `DetachStairsCommand`. **Recompute = `resolveEffectiveStairParams` + `computeStairGeometry` (ΗΔΗ υπάρχει)**, ΟΧΙ opening-cascade. Persist binding fields. |
| 3 | **Ribbon** | `ui/ribbon/data/contextual-column-tab.ts` panel `column-structural-attach` + `ui/ribbon/hooks/useRibbonColumnBridge.ts` + `column-command-keys.ts` | `contextual-stair-tab.ts` panel + `useRibbonStairBridge` (αν υπάρχει — αλλιώς βρες το stair ribbon bridge) + `stair-command-keys.ts` (attachTop/attachBase/detachTop/detachBase) |
| 4 | **Pick-host tool** | γενίκευση `hooks/tools/useWallAttachTool.ts` (χειρίζεται ΗΔΗ wall+column) + ToolTypes `column-attach-top`/`-base` | **Επέκταση `useWallAttachTool`** για stair (ToolTypes `stair-attach-top`/`-base`) + `resolveStairAttachTargets` (mirror `wall-attach-pick`/`resolveColumnAttachTargets`) |
| 5 | **Edit-break** | `useRibbonColumnBridge.dispatchParams` τυλίγει με `detachSidesAffectedByVerticalEdit` (από `bim/entities/entity-attach-detach.ts`, generic σε `VerticalAttachParams` με `height`+`baseOffset`) | ⚠️ **Το `StairParams` ΔΕΝ ικανοποιεί `VerticalAttachParams`** — λείπουν `height`/`baseOffset`. Stair top driver = `totalRise` (ή `rise×stepCount`)· base driver = `basePoint.z`/`offsetFromStorey`. → είτε **γενίκευσε** το `VerticalAttachParams` (κάνε `height`/`baseOffset` optional + δώσε stair driver mapping) είτε γράψε **stair-specific** `detachStairSidesAffectedByVerticalEdit`. `detachEntitySide`/`isEntitySideAttached` δουλεύουν ΗΔΗ (μόνο binding fields). |
| 6 | **3D top/base grip + detach-on-drag** | `RESIZE_HANDLES_BY_TYPE.column += 'resize-m-y'` + `computeColumnResizeParams` axis-Y split (normal=height/mirror=baseOffset) + detach-on-drag (`bim3d-resize-bridge.ts`) | ⚠️ Η σκάλα έχει **ΗΔΗ** resize grips (ADR-402 Sub-Phase 1 — `computeStairResizeParams`, `RESIZE_HANDLES_BY_TYPE.stair=[x,z]`, `bim3d-resize-bridge-stair.test.ts`). Πρόσθεσε `'resize-m-y'` + axis-Y top/base split + detach-on-drag ΕΠΑΝΩ σε αυτό, mirror column F.3 step (4). |

**Reuse (μην ξαναφτιάξεις — N.0.2):** `resolveEffectiveStairParams`, `makeStairHostResolverFromScene`, `entity-attach-detach.ts` (generic), `useWallAttachTool` (wall+column ΗΔΗ), `computeStairGeometry`, `host-footprint-eval`, `buildWallHostInputs`.

**Defaults:** `DEFAULT_STAIR_TOP_BINDING='unconnected'`, `DEFAULT_STAIR_BASE_BINDING='storey-floor'`.

---

## 3. Κανόνες / προσοχή
- **ΓΛΩΣΣΑ**: απαντάς ΠΑΝΤΑ στα Ελληνικά.
- **❌ ΜΗΝ commit/push** — ο Giorgio τα κάνει.
- **N.2**: μηδέν `any`/`as any`/`@ts-ignore`. **N.7.1**: ≤500 γρ./αρχείο (το `use-stair-persistence.ts` είναι ΗΔΗ 494 — μην το φουσκώσεις), ≤40/συνάρτηση.
- **ADR-040**: αν αγγίξεις canvas/scene/gizmo αρχεία (gizmo-overlay, bim3d-resize-bridge, CanvasSection wiring) → **stage ADR** (CHECK 6B/6D μπλοκάρουν αλλιώς).
- **i18n (N.11)**: νέα ribbon labels/toasts → keys σε `el` + `en` ΠΡΩΤΑ (ns `dxf-viewer-shell`), ΟΧΙ hardcoded.
- **EventBus**: mirror column — `bim:stairs-auto-attached`/`-base`/`-attached-manual`/`-detached` + toasts.
- **⚠️ Multi-agent tree**: όταν κάνεις stage, **μόνο τα δικά σου αρχεία** (στο tree υπάρχουν αλλαγές ADR-404 tilt: `column-tilt.ts`/`wall-tilt.ts`/`BimToThreeConverter.ts`/`column-types`/`wall-types`/`adr-index.md` — ΜΗΝ τα αγγίξεις).
- **ADR update (N.0.1 + N.15)**: στο τέλος → ADR-401 §5/§8 + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + memory `project_adr401_wall_top_constraints.md` + `MEMORY.md`.
- **Tests**: κάθε νέο command/coordinator/helper → test (όπως A→G).

## 4. Verify στο τέλος
- `npx jest <νέα tests> stair-effective-params --silent` → PASS.
- `npx tsc --noEmit -p tsconfig.json` (background) → clean στα αγγιγμένα.
- ADR/N.15 ενημερωμένα. Working tree = μόνο τα δικά σου αρχεία → έτοιμα για commit Giorgio.

## 5. Σχετικά refs (context)
- **Column F.3 πρότυπο** (διάβασέ το ΠΡΩΤΟ): `HANDOFFS/2026-06-01_ADR-401_PhaseF3-column-attach-auto-ribbon-grip-editbreak_handoff.md`
- Stair 3D grips (ADR-402 Sub-Phase 1, για το grip κομμάτι #6): `HANDOFFS/2026-06-01-ADR-402-subphase1-stair-handoff.md`
- G.2 handoff (τι μόλις έγινε): `HANDOFFS/2026-06-01_ADR-401_PhaseG-stair-CONSUMERS_next-session_handoff.md`
- ADR: `docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md` (§5 Phase G/G.2/G.3 + §8 changelog top rows)
- Memory: `project_adr401_wall_top_constraints.md` (Phase G/G.2 entry)
