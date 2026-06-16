# HANDOFF — BIM οντότητες ΑΚΟΜΑ αόρατες στο 3Δ (μετά το ADR-462 Phase 3 units fix)

**Ημερομηνία:** 2026-06-16
**Συντάκτης:** Opus 4.8 (συνεδρία «ADR-462 Phase 3 — 3Δ structural canonical-mm scaling»)
**Σύμπτωμα Giorgio:** Προσθέτει κολώνα 40×40 / ύψος 3m στο 2Δ· πάει στο 3Δ → **ΔΕΝ τη βλέπει**. Έγινε fix (παρακάτω) αλλά **ΠΑΛΙ δεν φαίνεται**.

> ⚠️ **ΓΛΩΣΣΑ:** Απαντάς ΠΑΝΤΑ Ελληνικά.
> ⚠️ **COMMIT/PUSH:** Τα κάνει ο **Giorgio**, ΟΧΙ εσύ (N.(-1)). ΠΟΤΕ `git add -A` — μόνο τα δικά σου αρχεία.
> ⚠️ **SHARED WORKING TREE:** Δουλεύει κι άλλος agent (ADR-459/460/461 reinforcement+special-levels). **ΜΗΝ αγγίξεις** χωρίς λόγο τα δικά του (ADR-459/460/461, active-reinforcement, structural-settings, foundation-level, slab-grid-commit, useDxfSceneConversion, useFloors3DAggregator, proposal-ghost, BeamFromWallGhost, mesh-to-object3d). git add ΜΟΝΟ δικά σου.
> ⚠️ **MODEL (N.14):** δήλωσε μοντέλο & περίμενε «ok». (Πρόταση: Opus — 3Δ pipeline debug, cross-cutting.)
> ⚠️ **TSC (N.17):** ΕΝΑ tsc τη φορά — έλεγξε ότι δεν τρέχει άλλος (ο shared agent τρέχει συχνά tsc).
> ⚠️ **SSoT + GREP (Giorgio αυστηρός):** ΠΡΙΝ γράψεις ΟΠΟΙΟΝΔΗΠΟΤΕ helper/formatter/util → **grep για υπάρχον SSoT**. ΜΗΝ δημιουργήσεις διπλότυπο. Αν υπάρχει → χρησιμοποίησέ το/επέκτεινέ το. (Μάθημα αυτής της συνεδρίας: παραλίγο να φτιάξω `scalePlanXY` ενώ υπήρχε ήδη `scalePoint`.)
> ⚠️ **FULL ENTERPRISE + FULL SSOT, Revit-grade** (ρητή εντολή Giorgio).

---

## 🎯 ΤΟ ΑΝΟΙΧΤΟ ΠΡΟΒΛΗΜΑ (ΚΥΡΙΑ ΔΟΥΛΕΙΑ)

Οι BIM οντότητες (κολώνα/δοκάρι/τοίχος…) **δεν εμφανίζονται στο 3Δ**, παρότι έγινε το units fix (canonical-mm scaling). Άρα είτε (Α) το fix δεν εφαρμόζεται στο runtime, είτε (Β) **υπάρχει ΔΕΥΤΕΡΗ, ανεξάρτητη ρίζα** (τα BIM δεν φτάνουν καν στο 3Δ scene). Το units fix ήταν **σωστό** (jest+tsc το αποδεικνύουν — βλ. ΜΕΡΟΣ 1) αλλά **προφανώς ΔΕΝ ήταν η (μόνη) αιτία**.

### ΚΑΤΕΥΘΥΝΣΗ (runtime/Firestore-first — ΜΗΝ μαντέψεις· διάγνωσε ΠΡΙΝ γράψεις κώδικα):

**Βήμα 1 — Εφαρμόζεται όντως το fix;** Hard-refresh ο browser (τα uncommitted fixes τρέχουν local με hot-reload, ΔΕΝ θέλουν commit). Στο 3Δ: inspect το three.js scene (π.χ. `window`/devtools ή προσωρινό log στο `columnToMesh`) — υπάρχει mesh για την κολώνα; Αν ναι, ποιο είναι το `bbox`/`position`; Πρέπει ~0.4m κοντά στην origin (ΟΧΙ 400m / 50.000m). Αν είναι ακόμα 400m → το fix δεν τρέχει (cache) ή λάθος path.

**Βήμα 2 — Φτάνουν τα BIM στο 3Δ scene;** ⭐ **ΙΣΧΥΡΟΤΕΡΟ LEAD:** Τα 3Δ BIM entities **ΔΕΝ** διαβάζονται κατευθείαν από το `scene.entities` — έρχονται από το **`Bim3DEntitiesStore`** (`useBim3DEntitiesStore`, καταναλώνεται στο `hooks/data/useFloors3DAggregator.ts:105` → `s.columns/beams/...`). Το `BimSceneLayer.ts` + `bim-scene-attach-syncs.ts` (`syncColumns`/`syncBeams`/`syncSlabs`) χτίζουν τα meshes ΑΠΟ αυτό το store.
   - **Έλεγξε runtime:** το `Bim3DEntitiesStore` έχει την κολώνα; (log `useBim3DEntitiesStore.getState().columns.length` όταν είσαι 3Δ). 
   - Αν **0** → η ρίζα είναι ο **resync/aggregation** (SceneModel BIM → Bim3DEntitiesStore), ΟΧΙ τα units. Ψάξε τον resync (grep `Bim3DEntitiesStore`, `resync`, `setColumns`, scene→store sync) + το active-floor BIM load.
   - Αν **>0 αλλά δεν φαίνεται** → camera/frustum (Βήμα 3) ή υπολειπόμενο units/visibility path.

**Βήμα 3 — Camera/visibility:** Αν τα meshes υπάρχουν στο scene αλλά αόρατα: (α) 3Δ auto-fit/camera — μήπως η κάμερα δεν κεντράρει σε BIM-only σκηνή (χωρίς DXF underlay); (β) visibility gates (layer/isolate/VG — `resolveIsEntityVisible`, ADR-358 isolate). 

**Βήμα 4 — Active-floor BIM load (ADR-390 dual-persistence):** Πιθανό «render≠καθαρό DB → `.scene.json` snapshot κρατά stale/empty BIM». Δες `scene-bim-load-policy.reconcileLoadedSceneBim`. Μήπως το 3Δ φορτώνει stale/κενό BIM για τον ενεργό όροφο;

**ΥΠΟΨΙΑ συντάκτη:** πιθανότερο το **Βήμα 2** (το `Bim3DEntitiesStore` δεν τροφοδοτείται για τον ενεργό όροφο) — δηλαδή ΔΙΑΦΟΡΕΤΙΚΟ bug από τα units. Ο shared agent (ADR-459/460/461) πειράζει το 3Δ aggregation (`useFloors3DAggregator` έχει pre-existing tsc error 157) — μπορεί να έσπασε το resync. **Επιβεβαίωσε με runtime/Firestore-first, ΜΗΝ υποθέσεις.**

---

## ΜΕΡΟΣ 1 — ΤΙ ΕΓΙΝΕ ΑΥΤΗ ΤΗ ΣΥΝΕΔΡΙΑ (ADR-462 Phase 3, UNCOMMITTED, tsc clean δικά μου, 194 jest GREEN)

**Διάγνωση (επιβεβαιωμένη στον κώδικα):** Οι 3Δ structural converters υπέθεταν ότι τα plan vertices (footprint/outline/axis) είναι «**already in meters**» (ίσχυε ΜΟΝΟ όταν `sceneUnits='m'`). Με ADR-462 canonical-mm η γεωμετρία είναι πάντα **mm** → footprint περνούσε RAW → κολώνα 400m×400m, ~1000× μακριά → εκτός frustum. (Οι σιβλινγκ converters σκάλα/ΗΜ/δάπεδο/στέγη ήδη κλιμάκωναν σωστά με `sceneUnitsToMeters`.)

**FIX (mirror sibling pattern, FULL SSoT):** `sceneToM = sceneUnitsToMeters(params.sceneUnits ?? 'mm')` στην είσοδο κάθε structural converter· κλιμάκωση plan XY → μέτρα ΠΡΙΝ τη γεωμετρία· κατακόρυφα scalars (×MM_TO_M) αμετάβλητα.
- **SSoT helper:** NEW `scalePoints(points, scalar)` στο **κανονικό vector-math home** `rendering/entities/shared/geometry-vector-utils.ts` (array-sibling του υπάρχοντος `scalePoint`). ΟΛΑ τα 18 call sites importάρουν από εκεί. (⚠️ Είχα φτιάξει αρχικά λάθος `scalePlanXY` σε `bim-three-shape-helpers` → consolidated.)
- **🔑 Linchpin `mesh-slope-shear.ts`:** μόνο `applySlabSlope` διαιρεί ÷sceneToM πριν το `slabSlopeOffsetZmm` (ΔΕΝ είναι scale-invariant). `applyColumnTilt/Wall/Beam` αμετάβλητα.
- **Tests:** NEW `bim-3d/converters/__tests__/units-canonical-mm.test.ts` GREEN (κολώνα 40×40 h3m → world 0.4×0.4×3m). 194 jest GREEN συνολικά.

**⚠️ ΣΗΜΑΝΤΙΚΟ:** Το fix είναι **σωστό** (αποδείξεις) αλλά **ΔΕΝ έλυσε το ορατό πρόβλημα** → υπάρχει δεύτερη ρίζα (ΜΕΡΟΣ 0). ΜΗΝ ξανακάνεις το units fix· **διάγνωσε γιατί τα BIM δεν φτάνουν/δεν φαίνονται.**

---

## ΜΕΡΟΣ 2 — git add (ΜΟΝΟ δικά μου· ο Giorgio κάνει commit)
```
src/subapps/dxf-viewer/rendering/entities/shared/geometry-vector-utils.ts   (NEW scalePoints SSoT)
src/subapps/dxf-viewer/bim-3d/converters/bim-three-shape-helpers.ts          (pushHoles +sceneToM)
src/subapps/dxf-viewer/bim-3d/converters/bim-three-structural-converters.ts  (⚠️ MIXED ADR-459/460)
src/subapps/dxf-viewer/bim-3d/converters/BimToThreeConverter.ts              (⚠️ MIXED shared-tree· +pullback ?? 'mm' fix)
src/subapps/dxf-viewer/bim-3d/converters/foundation-to-three.ts
src/subapps/dxf-viewer/bim-3d/converters/slab-multilayer-solid-3d.ts
src/subapps/dxf-viewer/bim-3d/converters/beam-ishape-geometry.ts
src/subapps/dxf-viewer/bim-3d/converters/structural-finish-3d.ts
src/subapps/dxf-viewer/bim-3d/converters/structural-finish-horizontal-3d.ts
src/subapps/dxf-viewer/bim-3d/converters/column-rebar-3d.ts                  (⚠️ MIXED ADR-459/460)
src/subapps/dxf-viewer/bim-3d/converters/mesh-slope-shear.ts
src/subapps/dxf-viewer/bim-3d/converters/__tests__/units-canonical-mm.test.ts (NEW)
docs/centralized-systems/reference/adrs/ADR-462-canonical-mm-units.md         (⚠️ MIXED — μόνο τα δικά μου changelog bullets)
local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt                                                        (⚠️ MIXED — μόνο το ADR-462 Phase 3 sub-item)
.claude-rules/pending-ratchet-work.md                                        (⚠️ MIXED — μόνο το scalePoints entry)
```
**ΠΡΟΣΟΧΗ:** το git status έχει & άλλα M/?? από τον shared agent (ADR-459/460/461). ΜΗΝ τα stage-άρεις.

## ΜΕΡΟΣ 3 — TSC / pre-existing (ΜΗΝ ασχοληθείς — shared-tree άλλου agent)
Τα δικά μου είναι **tsc clean** (επιβεβαιωμένο). Pre-existing errors (ADR-459/460/461, ΟΧΙ δικά μου): `mesh-to-object3d.ts(124)`, `BeamFromWallGhost.ts(83,87)`, `proposal-ghost-3d-builders.ts(147,168,170,171)`, `ProposalGhost3DMount.tsx(57)`, `foundation-level.ts(30)`, `slab-grid-commit.ts(103)`, `useDxfSceneConversion.ts(206)`, `useFloors3DAggregator.ts(157)`. (Άστα — αλλά το `useFloors3DAggregator` error ίσως σχετίζεται με το ΜΕΡΟΣ 0 Βήμα 2 — άξιζε runtime check.)

## ΜΕΡΟΣ 4 — TEST ENV CAVEAT
16 converter jest suites κάνουν «fail-to-run» με `fetch is not defined` (import chain `column-rebar-3d → active-reinforcement → structural-settings-store → firestore`, commit 5ab8033d ADR-459). Για να τρέξεις converter tests τοπικά: `npx jest <path> --setupFiles <polyfill.js>` όπου polyfill ορίζει `globalThis.fetch/Headers/Request/Response`. (Pre-existing env issue, ΟΧΙ δικό μου.)

## ΜΕΡΟΣ 5 — ΑΡΧΗ ΕΡΓΑΣΙΑΣ ΝΕΑΣ ΣΥΝΕΔΡΙΑΣ
1. **PHASE 1 (recognition, ADR-driven N.0.1):** διάβασε ADR-462 + το `Bim3DEntitiesStore` resync pipeline (grep `Bim3DEntitiesStore`, `useBim3DEntitiesStore`, `setColumns`/`resync`, `BimSceneLayer`, `bim-scene-attach-syncs`). **Runtime-first διάγνωση** (ΜΕΡΟΣ 0) ΠΡΙΝ γράψεις κώδικα.
2. **GREP για υπάρχον SSoT** πριν ΟΠΟΙΑΔΗΠΟΤΕ νέα συνάρτηση (εντολή Giorgio). Μηδέν διπλότυπα.
3. **FULL ENTERPRISE + FULL SSoT, Revit-grade.** Plan Mode αν 3-5+ αρχεία.
4. Δήλωσε μοντέλο (N.14), περίμενε «ok». ΕΝΑ tsc τη φορά (N.17). Commit = Giorgio.
5. Μετά το fix: browser-verify (κολώνα/δοκάρι/τοίχος εμφανίζονται 3Δ σωστού μεγέθους) → ενημέρωσε ADR-462 + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (N.15) → ζήτα από Giorgio commit.

## ΜΕΡΟΣ 6 — BASELINE ΒΑΣΗΣ (από προηγούμενο handoff)
- company `comp_9c7c1a50` · project `proj_0df5af7a` · building `bldg_b4d3cecb` · Firestore MCP διαθέσιμο.
- Reproduce: πρόσθεσε κολώνα 40×40 h3m σε όροφο → πήγαινε 3Δ → δεν φαίνεται.
