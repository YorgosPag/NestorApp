# ADR-401 — BIM Wall Top/Base Constraints + Attach-to-Structural (associative auto-height)

- **Status**: 🟢 ACCEPTED — **Phase A + B1 + B2 DONE** (A: 2026-05-30 resolver SSoT + τύποι + Zod· B1: 2026-05-31 host-plan builder SSoT + 2D section full-profile· B2: 2026-05-31 stepped/sloped 3D solid + syncWalls wiring + tests). Phase B3 + C–F εκκρεμούν.
- **Date**: 2026-05-30
- **Author**: Giorgio Pagonis + Claude (Opus 4.8)
- **Scope**: BIM `wall` (primary) — `column` mirror σε επόμενη φάση. Καταναλώνει `beam` + `slab` ως «structural hosts».
- **Builds on**: ADR-369 (Elevation Convention — datum), ADR-363 §5.4 (derived-geometry central cascade), ADR-399 (Levels/Floors SSoT)
- **Related**: ADR-396 (ETICS — assembly/ύψη τοίχου), ADR-358 (Stair↔Floor), ADR-366 (3D Viewer)
- **Impact**: 🟡 ADDITIVE σε τύπους· 🔴 αλλάζει το **πού** ορίζεται το κατακόρυφο ύψος τοίχου (από static scalar → resolved-from-context). Wipe & Reseed (ADR-369 Q10) — μηδέν data migration.

---

## 1. Context — Το πρόβλημα (από Giorgio)

Οι τοίχοι BIM είναι συνήθως τοίχοι **πλήρωσης**: μπαίνουν αφού στηθεί ο στατικός σκελετός. Ροή που θέλει ο Giorgio:

1. Φτιάχνω τοίχο BIM με προκαθορισμένο ύψος (π.χ. 2,85 μ).
2. Τοποθετώ **πάνω** του δοκάρι (π.χ. 0,50 μ).
3. Ο τοίχος **μικραίνει αυτόματα** ώστε να χωρά το δοκάρι — χωρίς χειροκίνητη επέμβαση.

**Αριθμητικό παράδειγμα** (ADR-369 datum):
```
Ύψος ορόφου (πάτωμα→πάτωμα)         = 3,00 μ   (FFL επόμενου ορόφου = 3,00)
Πλάκα οροφής (πάχος)                = 0,15 μ   → κάτω παρειά πλάκας = 2,85
Δοκάρι κάτω από πλάκα (ύψος)        = 0,50 μ   → κάτω παρειά δοκαριού = 2,50
─────────────────────────────────────────────
Τελικό ύψος τοίχου (κάτω από δοκάρι) = 2,50 μ   (αντί 2,85 χωρίς δοκάρι)
```

### 1.1 Γιατί ΟΧΙ «στατική αφαίρεση ενός αριθμού»

Το «αφαιρώ 0,50 μία φορά» είναι **εύθραυστο**: σπάει αν μετακινηθεί/σβηστεί το δοκάρι, αν αλλάξει το ύψος ορόφου, αν υπάρχουν 2 δοκάρια, αν το δοκάρι καλύπτει μέρος του τοίχου. Η σωστή λύση είναι **συσχετιστική** (associative), όπως το Revit «Attach Top/Base».

### 1.2 Industry research — Revit «Attach Top/Base»

- Μετά την τοποθέτηση, η κορυφή/βάση τοίχου **«κολλάει»** (attach) σε άλλο στοιχείο στο ίδιο κατακόρυφο επίπεδο: **πλάκα, στέγη, ταβάνι, δοκάρι** (πάνω/κάτω).
- Παραμετρική σχέση: το ύψος **μεγαλώνει/μικραίνει αυτόματα** ώστε να ακολουθεί το όριο του στοιχείου. Αλλαγή κλίσης/υψομέτρου του host → ο τοίχος ακολουθεί ζωντανά.
- Σε δοκάρι → ο τοίχος κολλάει στην **κάτω παρειά** του δοκαριού.
- Στο Revit το attach είναι **χειροκίνητο** (pick wall + pick element). Edit profile → **σπάει** το attach.
- 🟢 **Δική μας βελτίωση**: auto-attach κατά την τοποθέτηση του δοκαριού (εντοπισμός τοίχων από κάτω + attach με undo).

**Πηγές**: Autodesk «Attach Walls to Other Elements» (Revit 2020), Revit Structure «Attaching Structural Objects Together», Autodesk User's Guide «Attaching Walls».

### 1.3 Current State (ο κώδικας που τρέχει — code wins)

| Τι | Πού | Κατάσταση |
|----|-----|-----------|
| **Datum ορόφου** | ADR-369 (✅ IMPLEMENTED) | `Floor.elevation` = **πάνω επιφάνεια πλάκας** = FFL (πάτωμα→πάτωμα). Πλάκα/δοκάρι κρέμονται προς τα κάτω. **ΑΠΟΦΑΣΙΣΜΕΝΟ.** |
| **Wall vertical binding** | `bim/types/bim-binding.ts`, `wall-types.ts` | Υπάρχουν `baseBinding` (`storey-floor`\|`absolute`), `topBinding` (`storey-ceiling`\|`absolute`\|`unconnected`), `baseOffset`/`topOffset`/`unconnectedHeight`. |
| **Πραγματικό ύψος γεωμετρίας** | `bim/geometry/wall-geometry.ts:117`, `bim-3d/converters/wall-opening-extrude.ts:64` | ⚠️ Χρησιμοποιούν **απευθείας `params.height`**. Τα bindings είναι **σχεδόν διακοσμητικά** — δεν παράγουν resolved height. |
| **Vertical-extent resolver (μερικός)** | `bim-3d/2d-section/section-intersect.ts:96` `toWallPlan()` | Μόνο εδώ resolved-από-binding (baseY/topY). Κοιτάζει `unconnected`/`absolute`, αλλιώς `baseY + height`. **De-facto SSoT υποψήφιος προς γενίκευση.** |
| **Floor-height cascade** | `src/app/api/floors/floor-height-cascade.service.ts` | Όταν αλλάζει `floor.height` → recompute `params.height` για `topBinding='storey-ceiling'` τοίχους/κολώνες. Τύπος: `floor.height·1000 + topOffset − baseOffset`. ⚠️ **Αγνοεί πλάκα/δοκάρι** (δίνει 3000, όχι 2850). Server batch + EntityAudit. |
| **Hosted-opening cascade** | ADR-363 §5.4 `cascadeHostedOpeningsForWalls` | Pattern «το παιδί ακολουθεί τον γονιό σε ΟΛΑ τα transform paths». **Mirror για attach.** |
| **Plan-overlap utils** | `bim/geometry/shared/polygon-utils.ts` (`polygonIntersectionAreaMm2`, `clipPolygonBySH`) | Reuse για «ποιοι τοίχοι είναι κάτω από το δοκάρι/πλάκα». |
| **Beam→slab deduction** | `bim/geometry/slab-geometry.ts` + test | Πρότυπο plan-intersection + depth clamp — ίδια μαθηματικά με coverage detection. |

**Συμπέρασμα Phase 1 (Recognition)**: η υποδομή υπάρχει αλλά **ημιτελής** — τα top/base bindings ΔΕΝ καταναλώνονται από τη γεωμετρία, και δεν υπάρχει καθόλου «attach σε συγκεκριμένο structural element». Το ADR-369 §9 Q5 το είχε προβλέψει ως «auto-stretch cascade» αλλά υλοποιήθηκε μόνο floor-driven (storey-ceiling), όχι element-driven.

---

## 2. Decision

**Συσχετιστικά (associative) Top/Base Constraints για τοίχους BIM, με δυνατότητα «Attach to Structural» σε δοκάρι/πλάκα, ευθυγραμμισμένα με Revit + το datum του ADR-369.**

### 2.1 Δύο επίπεδα δέσμευσης (constraint)

1. **Storey-level constraints** (ήδη υπάρχουν, ενεργοποιούνται σωστά):
   - `baseBinding`/`topBinding` με σημασία ADR-369. Το `topBinding='storey-ceiling'` διορθώνεται ώστε να **αφαιρεί την πλάκα οροφής** (top = επόμενο FFL − πάχος πλάκας), όχι σκέτο floor-to-floor.
2. **Element-level attach** (νέο — η καρδιά του ADR):
   - Νέα τιμή `topBinding = 'attached'` + νέο πεδίο `attachTopToId?: string` (FK → beam ή slab entity).
   - Το πραγματικό ύψος **υπολογίζεται ζωντανά** = κάτω παρειά του host − βάση τοίχου. **Δεν αποθηκεύεται** ως `height`.
   - Mirror για βάση: `baseBinding='attached'` + `attachBaseToId?` (π.χ. πάνω σε δοκό θεμελίωσης) — Phase 2.

### 2.2 SSoT — `resolveWallTopProfile(wall, ctx)` (νέο, centralized) — FULL ENTERPRISE

ΕΝΑΣ pure resolver, **μοναδική** πηγή για το κατακόρυφο εύρος τοίχου. Επειδή επιλέξαμε FULL (όχι single-scalar height), ο resolver επιστρέφει **προφίλ κορυφής** κατά μήκος του άξονα του τοίχου — υποστηρίζει **σκαλωτή** (πολλαπλά δοκάρια/μερική κάλυψη) και **κεκλιμένη** (κεκλιμένο δοκάρι/στέγη) κορυφή. Καταναλώνεται από **ΟΛΑ** τα paths (3D extrude, section, BOQ, grips, dimensions, 2D annotation):

```ts
interface WallVerticalContext {
  readonly floorElevationMm: number;            // FFL του ορόφου του τοίχου (ADR-369)
  readonly nextFloorElevationMm?: number;       // FFL επόμενου ορόφου (storey-ceiling)
  readonly ceilingSlabThicknessMm?: number;     // πάχος πλάκας οροφής (storey-ceiling − slab)
  /** Επιστρέφει την κάτω-παρειά ενός host ως συνάρτηση κατά μήκος άξονα (mm)
   *  + plan-overlap span [t0,t1] (0..1) πάνω στον τοίχο. null = δεν βρέθηκε. */
  readonly resolveHost?: (id: string) => HostUndersidePlan | null;
  /** Όλοι οι structural hosts του ορόφου — για auto-detect κάλυψης κατά μήκος. */
  readonly candidateHosts?: readonly HostUndersidePlan[];
}
/** Γραμμικό προφίλ κάτω-παρειάς host προβαλλόμενο στον άξονα τοίχου. */
interface HostUndersidePlan {
  readonly hostId: string;
  readonly hostType: 'beam' | 'slab' | 'roof' | 'wall';
  readonly t0: number; readonly t1: number;     // span κάλυψης (0..1) πάνω στον άξονα
  readonly z0mm: number; readonly z1mm: number;  // underside στα t0, t1 (γραμμικό → κεκλιμένο)
}
/** Ένα τμήμα κορυφής: από t0 έως t1, top πηγαίνει γραμμικά z0→z1. */
interface WallTopSegment {
  readonly t0: number; readonly t1: number;
  readonly z0mm: number; readonly z1mm: number;
  readonly source: 'attached' | 'storey-ceiling' | 'absolute' | 'unconnected' | 'fallback';
  readonly hostId?: string;
}
interface WallTopProfile {
  readonly baseZmm: number;
  readonly segments: readonly WallTopSegment[];  // ordered, καλύπτουν [0,1] χωρίς κενά
  readonly maxTopZmm: number;                    // για bbox
  readonly hasAttach: boolean;
  readonly missingHostIds: readonly string[];    // hosts που λείπουν → fallback + warning
}
```

**Κανόνας σύνθεσης (lower-envelope)**: για κάθε σημείο `t` του άξονα, η κορυφή = το **χαμηλότερο** όριο μεταξύ όλων των hosts που καλύπτουν το `t` + του storey-ceiling. Όπου δεν καλύπτει κανείς host → storey-ceiling (ή nominal fallback). Έτσι βγαίνει αυτόματα και η σκαλωτή (διαφορετικά δοκάρια) και η μερική κάλυψη (το ακάλυπτο μέρος μένει ψηλά).

- `params.height` υποβιβάζεται σε **nominal/unattached fallback** (όπως το Revit «Unconnected Height»): ισχύει μόνο όπου δεν υπάρχει host ούτε storey-ceiling. Host λείπει (σβήστηκε) → segment πέφτει σε fallback + `missingHostIds`.
- Το υπάρχον `toWallPlan()` (`section-intersect.ts`) γίνεται **consumer** του resolver (παράγει το single-segment ή stepped προφίλ), όχι παράλληλη λογική. Single host οριζόντιος → ένα segment με z0=z1 (back-compat με ίσιο τοίχο).

### 2.3 Host underside formula (ADR-369 datum)

```
beam.underside(t)  = beam.topElevation(t) − beam.depth      (κρέμεται κάτω· κεκλιμένο → z0≠z1)
slab.underside     = slab.levelElevation + heightOffset − slab.thickness
roof.underside(t)  = γραμμικό κατά την κλίση (Phase E2)
wall.top(t)        = min{ host.underside(t) : host καλύπτει t } ⊓ storeyCeiling   (lower envelope)
```

### 2.4 Γεωμετρία στερεού (stepped/sloped prism) — 3D + section

Το στερεό του τοίχου παύει να είναι απλό box-extrude. Γίνεται **prism με επίπεδη βάση και πολυγραμμική/κεκλιμένη κορυφή** που ακολουθεί το `WallTopProfile`: ανά segment, η κορυφή είναι quad/τραπέζιο (z0→z1). 3D: build top faces per segment (mirror `wall-opening-extrude` piece-wise). Section/2D height annotation: ίδιο προφίλ. BOQ volume: Σ (segment area × thickness), όχι `length×height`.

### 2.5 Attach UX — auto + manual (FULL Revit parity + βελτίωση)

**Auto-attach** κατά το **commit τοποθέτησης δοκαριού/πλάκας**:
1. Plan-overlap detection (reuse `polygonIntersectionAreaMm2`) → ποιοι τοίχοι του ίδιου ορόφου περνούν από κάτω (+ span t0..t1).
2. Για κάθε τέτοιον τοίχο **με `topBinding='storey-ceiling'`** (default «ελεύθερη» κορυφή): καταχωρείται attach στον host. Τοίχοι ήδη `absolute`/`unconnected`/manual → **δεν** πειράζονται.
3. **Undoable** ενιαία command (`AttachWallsTopCommand`) — ένα undo αναιρεί όλο το auto-attach.

**Manual attach/detach** (Revit parity, Phase D): ribbon «Κόλλησε κορυφή σε…» (pick host) + «Αποκόλληση». Πολλαπλά attach σε διαφορετικά spans → σκαλωτό προφίλ (§2.2). FULL: ο τοίχος κρατά **λίστα** `attachTopToIds: string[]` (όχι μόνο ένα) ώστε να δένει σε πολλά δοκάρια ταυτόχρονα.

### 2.6 Associative cascade (mirror ADR-363 §5.4) — FULL SSoT

ΕΝΑ SSoT `cascadeStructuralAttachForHosts(hostIds, scene)` καλείται σε **ΟΛΑ** τα transform paths του host (move/rotate/scale/grip/depth-edit/delete) **και** του τοίχου (ώστε να ξαναϋπολογιστεί η κάλυψη/προφίλ αν μετακινηθεί ο τοίχος). Επιστρέφει τους τοίχους με αλλαγμένο προφίλ για re-render/persist. Client (live command) + server batch (mirror `floor-height-cascade.service.ts`) με EntityAudit. Idempotent· belt-and-suspenders no-op όταν μηδέν επηρεαζόμενοι.

---

## 3. Datum Convention (ΑΠΟΦΑΣΙΣΜΕΝΟ — ADR-369, εδώ μόνο επανάληψη)

`Floor.elevation` = **πάνω επιφάνεια τελειωμένης πλάκας (FFL)** = το πάτωμα που πατάς. Ύψος ορόφου = πάτωμα→πάτωμα. Πλάκα & δοκάρι κρέμονται προς τα κάτω. Top-of-structural = `FFL − finishThickness` (default 80mm). **Επιλογή Α — δεν ξανανοίγει.**

---

## 4. SSoT & επαναχρησιμοποίηση (no duplicates)

| Ανάγκη | Υπάρχον SSoT προς reuse |
|--------|-------------------------|
| Datum/elevation | `bim/utils/bim-floor-utils.ts` `getEntityAbsoluteElevation`, ADR-369 |
| Vertical-extent | επέκταση `section-intersect.ts toWallPlan` → νέο `resolveWallTopProfile` (stepped/sloped) |
| Coverage detection | `shared/polygon-utils.ts` `polygonIntersectionAreaMm2`, `clipPolygonBySH` |
| Cascade pattern | ADR-363 §5.4 `cascadeHostedOpeningsForWalls` (client) + `floor-height-cascade.service.ts` (server) |
| Floors SSoT | `useFloorsByBuilding` (FLOORS doc), ADR-399 |
| Audit | `EntityAuditService.recordChange` (ADR-195) |

---

## 5. Φάσεις υλοποίησης (FULL — όλες εντός scope)

> **Re-scope 2026-05-30 (υλοποίηση):** Το Phase A περιοριστηκε στον **πυρήνα**
> (resolver + τύποι + Zod + section consumer + tests) ώστε να είναι αυτοτελές,
> testable και low-risk (κανόνας «phase per session»). Η ενσωμάτωση στο **3D
> extrude / bbox / BOQ** μετακινήθηκε στο Phase B (απαιτεί το stepped-solid),
> γιατί χρειάζονται variable-height geometry, όχι μόνο τον resolver.

- **Phase A — Resolver SSoT ✅ DONE (2026-05-30)**: NEW `bim/geometry/wall-top-profile.ts` — `resolveWallTopProfile` (stepped/sloped lower-envelope) + `resolveWallBaseZmm` + `resolveWallNominalTopZmm` (shared nominal scalar) + types (`HostUndersidePlan`/`WallVerticalContext`/`WallTopSegment`/`WallTopProfile`). `topBinding='attached'` + `attachTopToIds: string[]` στους τύπους (`bim-binding.ts`, `wall-types.ts`) + Zod (`wall.schemas.ts`, attach refinement). `section-intersect.toWallPlan` → consumer του shared nominal resolver (μηδέν behavior change· `storey-ceiling` αφαίρεση πλάκας ενεργοποιείται όταν δοθεί `nextFloorElevationMm`/`ceilingSlabThicknessMm` context). Tests: `wall-top-profile.test.ts` (παράδειγμα 3.00→2.50, σκαλωτή, μερική κάλυψη, κεκλιμένη + τομή baseline, missing-host).
- **Phase B — Stepped/sloped solid + downstream** (σπασμένο σε B1/B2/B3, «phase per session»):
  - **B1 — Host-plan builder + 2D section ✅ DONE (2026-05-31)**: NEW `bim/geometry/wall-host-plan-builder.ts` (SSoT) — `buildHostUndersidePlans` / `makeResolveHost` / `makeWallTopContext` (plan-overlap = **segment ∩ polygon** t-intervals, robust convex+concave μέσω midpoint-inside ray-cast reuse `isPointInPolygon`) + `beamHostInput`/`slabHostInput` adapters (§2.3 underside formulas σε mm). NEW `evaluateWallTopAt(profile,t)` SSoT helper στο `wall-top-profile.ts`. **2D section full-profile**: `section-intersect.toWallPlan` δέχεται `resolveHost` + carry-άρει `WallTopProfile`· `wallSection` αποτιμά το προφίλ στο σημείο της εγκάρσιας τομής (single-point top, σκαλωτή κορυφή)· `section-scene-sync` χτίζει per-wall `resolveHost` από beams+slabs. Beam/slab = οριζόντια (z0=z1)· concave multi-span host → largest-span (Phase E refinement). 37/37 tests (18 builder + 14 resolver + 5 wallSection). tsc clean.
  - **B2 — Stepped/sloped 3D solid ✅ DONE (2026-05-31)**: host-plan wiring στο `BimSceneLayer.syncWalls` (beams+slabs → `makeWallTopContext`/`resolveWallTopProfile`, μόνο όταν υπάρχει attached τοίχος) + piece-wise prism σε **3 converter paths**. NEW `wall-piece-geometry.ts` (`buildSlopedWallPieceGeometry` — custom 8-vertex wedge για κεκλιμένη κορυφή). `WallOpeningPiece.zTopM` → `zTopAM`/`zTopBM` (per-boundary top → flat ⇒ ίσα, sloped ⇒ διαφορετικά). `computeWallOpeningPieces(wall, openings, wallTop?)` — jambs/πρέκια ακολουθούν το προφίλ + **split στα profile breakpoints** (interior-biased eval για σκαλωτό/ασυνεχές προφίλ)· ποδιά=επίπεδη. `BimToThreeConverter.wallToMesh(..., profile?)` + `makeWallTopLocalFn` (mm→local m) + flat=`ExtrudeGeometry`/sloped=`buildSlopedWallPieceGeometry` routing· straight piece-path ενεργό ΚΑΙ χωρίς ανοίγματα όταν `hasAttach`. `wall-opening-extrude` (curved/polyline): top ακμή front-face = polyline προφίλ (stepped+sloped ενιαία). **Flat τοίχος = αμετάβλητο fast path (μηδέν regression).** 61/61 tests (16 stepped-solid + back-compat). bbox → B3 (ο `computeWallGeometry` δεν δέχεται resolver context).
  - **B3 — BOQ + ETICS + 2D plan** (εκκρεμεί): `computeWallGeometry` profile-aware area/volume (Σ segment area × thickness) + `envelope-boq-sync.maxWallHeightM` + ETICS Z1 3D band (`BimSceneLayer:350`) + `WallRenderer` cut-state.
- **Phase C — Associative cascade**: `cascadeStructuralAttachForHosts` σε όλα τα host & wall transform paths (client commands mirror ADR-363 §5.4 `cascadeHostedOpeningsForWalls` + server batch mirror `floor-height-cascade.service.ts` + EntityAudit). Detach-on-host-delete → fallback nominal + warning (EventBus → `notifications.warning`).
- **Phase D — Auto-attach UX**: εντοπισμός τοίχων (`polygonIntersectionAreaMm2`) κατά το `onBeamCreated`/slab commit + `AttachWallsTopCommand` (undoable, batch). Μόνο `topBinding='storey-ceiling'` τοίχοι attach-άρουν.
- **Phase E — Manual attach/detach ribbon** (Revit parity: «Κόλλησε κορυφή σε…» / «Αποκόλληση», multi-host) + wall-top vertical grip + manual-height-edit-breaks-attach **+ E2 κεκλιμένη στέγη/δοκάρι** + base-attach (δοκός θεμελίωσης).
- **Phase F — Column mirror** (ίδιος resolver + cascade, generalized· `attachTopToIds` ήδη στο shared `WallTopBinding`/column alias).

### 5.1 Consumer map (σημεία που διαβάζουν scalar `wall.params.height` — Phase B/C targets)
| Site | Αρχείο | Φάση |
|------|--------|------|
| Geometry SSoT (area/volume/bbox) | `bim/geometry/wall-geometry.ts:112,117,123` | B3 |
| 2D section topY | `bim-3d/2d-section/section-intersect.ts` (✅ B1: full-profile via `resolveHost` + `wallSection` profile-at-cut) | A✅/B1✅ |
| 3D extrude (solid) | `bim-3d/converters/BimToThreeConverter.ts` (✅ B2: `wallToMesh(profile?)` + `makeWallTopLocalFn` + flat/sloped routing) | B2✅ |
| 3D extrude (openings, curved) | `wall-opening-extrude.ts` (✅ B2: front-face top polyline), `wall-opening-pieces.ts` (✅ B2: `zTopAM`/`zTopBM` + `wallTop?` split) | B2✅ |
| 3D wedge (κεκλιμένη κορυφή) | `bim-3d/converters/wall-piece-geometry.ts` (NEW B2: `buildSlopedWallPieceGeometry`) | B2✅ |
| 3D scene wiring | `bim-3d/scene/BimSceneLayer.ts` `syncWalls` (✅ B2: hostInputs + `resolveWallTopProfile`) | B2✅ |
| ETICS Z1 BOQ area | `bim/services/envelope-boq-sync.ts:80` (`maxWallHeightM`) | B3 |
| ETICS Z1 3D band | `bim-3d/scene/BimSceneLayer.ts:350` | B3 |
| 2D plan cut-state | `bim/renderers/WallRenderer.ts:190,344` | B3 |

---

## 6. Edge cases — ΑΠΟΦΑΣΙΣΜΕΝΑ (FULL ENTERPRISE + FULL SSOT, Giorgio 2026-05-30)

| Θέμα | Απόφαση |
|------|---------|
| **Πολλαπλά δοκάρια / μερική κάλυψη** | **Σκαλωτή κορυφή** — ο τοίχος ακολουθεί το **χαμηλότερο όριο** ανά τμήμα (lower-envelope, §2.2). Ακάλυπτο μέρος → storey-ceiling. Όχι single-scalar height. |
| **Trigger** | **Auto + manual** — auto-attach (undoable) κατά την τοποθέτηση host + χειροκίνητο attach/detach ribbon (Revit parity). |
| **Ποια στοιχεία «κολλάνε»** | **Όλα τα valid**: δοκάρι, πλάκα οροφής, στέγη (κεκλιμένη), τοίχος από πάνω. `attachTopToIds` λίστα. |
| **Σβήσιμο host** | Ο τοίχος επιστρέφει αυτόματα στο nominal/storey-ceiling + `missingHostIds` warning flag (associative cascade). |
| **Χειροκίνητη αλλαγή ύψους attached τοίχου** | **Σπάει το attach** → γίνεται `unconnected` με το νέο ύψος (Revit parity). |
| **Κεκλιμένο δοκάρι/στέγη** | **Εντός scope** — γραμμικό underside z0→z1 ανά segment (Phase B/E2). |

---

## 7. Tests (προβλεπόμενα)

- `resolve-wall-top-profile.test.ts` — attached/storey-ceiling(−slab)/absolute/unconnected/fallback· **lower-envelope** σκαλωτό (2 δοκάρια)· μερική κάλυψη· κεκλιμένο (z0≠z1)· παράδειγμα 3,00→2,85→2,50.
- `structural-attach-cascade.test.ts` — host move/scale/depth-edit/delete → wall προφίλ· πολλαπλά δοκάρια· idempotent· detach-on-delete + warning.
- `auto-attach-detection.test.ts` — plan-overlap, μερική κάλυψη (span t0..t1), μόνο storey-ceiling τοίχοι attach.
- `wall-stepped-solid.test.ts` — piece-wise prism: 3D top faces per segment + BOQ volume integration.
- Regression: `wall-geometry`, `wall-opening-extrude`, `section-intersect` με νέο resolver.

---

## 8. Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-05-30 | Giorgio + Claude (Opus 4.8) | Initial PROPOSED — έρευνα (ADR-369 datum ήδη αποφασισμένο = Επιλογή Α· current code: bindings μη-καταναλωμένα από geometry· floor-height-cascade υπάρχει· hosted-opening cascade pattern). Industry Revit Attach Top/Base. Decision: associative resolver + element attach + auto-attach UX. Q&A §6 ανοιχτό. |
| 2026-05-30 | Giorgio + Claude (Opus 4.8) | **Giorgio: «ΘΕΛΩ ΛΟΓΙΚΗ ΚΑΙ ΥΛΟΠΟΙΗΣΗ FULL ENTERPRISE + FULL SSOT».** Όλα τα §6 ανοιχτά → ΑΠΟΦΑΣΙΣΜΕΝΑ στην πλήρη μορφή: σκαλωτή/κεκλιμένη κορυφή (lower-envelope `resolveWallTopProfile` αντί single-scalar), `attachTopToIds[]` multi-host (δοκάρι/πλάκα/στέγη/τοίχος), auto+manual attach, detach-on-delete+warning, manual-edit-breaks-attach. §2.2 resolver → top-profile· §2.4 stepped/sloped solid· §5 φάσεις A-F (όλες in-scope). |
| 2026-05-30 | Claude (Opus 4.8) | **Phase A IMPLEMENTED** (pending commit). NEW `bim/geometry/wall-top-profile.ts`: `resolveWallTopProfile` (exact piecewise-linear lower-envelope με pairwise-intersection splitting → σκαλωτή + κεκλιμένη + τομή baseline) + `resolveWallBaseZmm` + `resolveWallNominalTopZmm` (shared nominal scalar SSoT) + 5 types. `WallTopBinding` += `'attached'` (+ values + Zod), `WallParams.attachTopToIds?: readonly string[]`, Zod attach refinement (attached⇔≥1 id). `section-intersect.toWallPlan` → consumer (μηδέν behavior change· `storey-ceiling` slab-subtraction ενεργό με context). NEW `__tests__/wall-top-profile.test.ts` (15 cases incl. ADR §1 3.00→2.50). §5 re-scope: 3D/bbox/BOQ → Phase B. |
| 2026-05-31 | Claude (Opus 4.8) | **Phase B2 IMPLEMENTED** (pending commit). Stepped/sloped 3D wall solid σε **3 converter paths** + scene wiring. NEW `wall-piece-geometry.ts` `buildSlopedWallPieceGeometry` (8-vertex wedge, κεκλιμένη κορυφή). `WallOpeningPiece.zTopM` → `zTopAM`/`zTopBM` (per-boundary, §2.4)· `computeWallOpeningPieces(wall, openings, wallTop?)` (jambs/πρέκια ακολουθούν προφίλ + split στα breakpoints, interior-biased eval για σκαλωτό ασυνεχές)· `BimToThreeConverter.wallToMesh(..., profile?)` + `makeWallTopLocalFn` (mm→local m) + flat=ExtrudeGeometry/sloped=wedge routing (piece-path ενεργό ΚΑΙ χωρίς ανοίγματα όταν `hasAttach`)· `wall-opening-extrude` front-face top = polyline προφίλ (curved/polyline). `BimSceneLayer.syncWalls` χτίζει hostInputs (beams+slabs) + `resolveWallTopProfile` ανά attached τοίχο (guarded — μηδέν κόστος όταν κανένας attached). Flat τοίχος = αμετάβλητο fast path. Tests: NEW `wall-stepped-solid.test.ts` (16: flat back-compat, οριζόντιο σκαλωτό, breakpoint split, sloped wedge, ADR §1 3.00→2.50, opening+stepped) → 61/61 + BimSceneLayer 32/32. tsc clean. bbox → B3. |
| 2026-05-31 | Claude (Opus 4.8) | **Phase B1 IMPLEMENTED** (pending commit). NEW `bim/geometry/wall-host-plan-builder.ts` (SSoT): `buildHostUndersidePlans`/`makeResolveHost`/`makeWallTopContext` — plan-overlap = **segment ∩ polygon** t-intervals (robust convex+concave, midpoint-inside via `isPointInPolygon` SSoT) + `beamHostInput`/`slabHostInput` (§2.3 underside, reuse `computeBeamGeometry.outline`). NEW `evaluateWallTopAt(profile,t)` SSoT στο `wall-top-profile.ts`. **2D section full-profile**: `WallPlan.topProfile?`, `toWallPlan(wall, floorElevationM, resolveHost?)`, `wallSection` profile-at-cut (single-point top στην εγκάρσια τομή), `section-scene-sync` per-wall `resolveHost` από beams+slabs. Beam/slab οριζόντια (z0=z1)· concave multi-span→largest. Tests: `wall-host-plan-builder.test.ts` (18) + `section-intersect-wall-profile.test.ts` (5) + resolver 14 = **37 PASS**. tsc clean. Phase B split → B1✅/B2(3D solid)/B3(BOQ+ETICS). |
