# ADR-632 — Αυτόματο άνοιγμα κλιμακοστασίου σε πλάκα (Stairwell Auto-Opening)

- **Status**: In progress (Phase 0–4.1 DONE· Φ5: deterministic-id + edge-touching + 3D/UX + lock/override DONE· stair-create→command pending)
- **Date**: 2026-07-10 (Φ4.1: 2026-07-11)
- **Related**: ADR-358 (Stair tool) §9.2 Q29 · ADR-363 (BIM drawing mode, slab-opening) · ADR-401 (attach-to-structural) · ADR-396 (safe polygon boolean) · ADR-594 (BIM persistence factory)

---

## 1. Context — το πρόβλημα

Σε κτίριο πολλών ορόφων, η σκάλα ανεβαίνει από όροφο σε όροφο μέσα στο
κλιμακοστάσιο. Όταν ο χρήστης τοποθετεί την **πλάκα οροφής** (slab) του επόμενου
ορόφου, αυτή «καπακώνει» τη σκάλα: χωρίς τρύπα, ο άνθρωπος δεν μπορεί να περάσει
από τον έναν όροφο στον άλλο — χτυπάει το κεφάλι.

Απαιτείται **αυτόματος** μηχανισμός: όταν μια πλάκα βρίσκεται πάνω από σκάλα, να
ανοίγει τρύπα (stairwell opening) στην πλάκα, στο σημείο όπου το **ελεύθερο ύψος
(headroom)** από τη μύτη του σκαλοπατιού μέχρι την κάτω παρειά της πλάκας πέφτει
κάτω από το νόμιμο ελάχιστο. Έτσι εξασφαλίζεται πάντα διέλευση χωρίς χτύπημα.

## 2. Νομικό ελάχιστο ελεύθερο ύψος (headroom)

Μετριέται κατακόρυφα από τη **nosing line** (γραμμή που ενώνει τις μύτες των
σκαλοπατιών) προς την κάτω παρειά του υπερκείμενου στοιχείου, συνεχώς πάνω από
όλη τη σκάλα:

| Κανονισμός | Ελάχιστο | Πηγή |
|---|---|---|
| **NOK / Ελλάδα** | **2200 mm** | Κτιριοδομικός Κανονισμός, Άρθρο 13 (Κλίμακες) |
| IBC 2018 | 2032 mm (80″) | §1011.3 Headroom |
| ADA / ICC A117.1 | 2032 mm | — |
| Eurocode / NBC / NFPA / AS1657 / DIN | 2030 mm | industry baseline |

**Απόφαση Giorgio:** default **2200 mm** (NOK). Διορθώθηκε το προϋπάρχον
`MIN_HEADROOM_MM.nok` (ήταν 2030) → **2200**. Παραμετρικό ανά code profile.

## 3. Αποφάσεις (Giorgio, 2026-07-10)

1. **Headroom default** = 2200 mm (NOK), παραμετρικό ανά profile.
2. **Πυροδότηση** = πλήρως αυτόματη (reactive): η τρύπα εμφανίζεται / ενημερώνεται
   / σβήνει μόνη της μόλις μια πλάκα καλύψει σκάλα ή αλλάξει στάθμη/θέση.
3. **Σχήμα τρύπας** = ακριβής προβολή των παραβατικών σκαλοπατιών (union), όχι
   απλό bbox.

## 4. Αλγόριθμος

Για πλάκα με top-face στα `Zt` και πάχος `T` → κάτω παρειά `Zu = Zt − T`.
Ελάχιστο `Hmin` (π.χ. 2200 mm). Για κάθε σκαλοπάτι `i` με ύψος μύτης `z_nosing(i)`:

```
clearance(i) = Zu − z_nosing(i)
παραβατικό  ⇔  clearance(i) < Hmin
```

- Άνοιγμα = `safeIntersection( safeUnion(προβολές παραβατικών treads + 1 tread
  περιθώριο), slab.outline )`.
- Όλα τα z σε mm (conversion scene-units → mm μία φορά στον engine, ADR-358 §9.2 Q22).
- x/y στις μονάδες της σκηνής (σκάλα & πλάκα μοιράζονται τη σκηνή).

## 5. Αρχιτεκτονική — reuse-first (SSoT)

Το 80% υπάρχει ήδη:

| Concern | SSoT (reused) |
|---|---|
| Οντότητα τρύπας | `SlabOpeningEntity` kind `'well'` (`slab-opening-types.ts`) |
| Visual «κόψιμο» πλάκας | `SlabRenderer.punchHostedSlabOpenings()` (destination-out) — αυτόματο |
| Geometry/undo/persistence | `computeSlabOpeningGeometry`, `buildSlabOpeningEntity`, `UpdateSlabOpeningParamsCommand`, `useSlabOpeningPersistence` (ADR-594) |
| Στάθμες σκάλας | `resolveStairVerticalProfile` + `host-footprint-eval` |
| Polygon boolean | `safe-polygon-boolean.ts` (`safeUnion`/`safeIntersection`, ADR-396) |
| Headroom threshold | **NEW SSoT** `stair-headroom-constants.ts` (κοινό validator + engine) |

### Νέα modules (Phase 0–1)
- `bim/stairs/stair-headroom-constants.ts` — `MIN_HEADROOM_MM` (nok=2200) + `resolveMinHeadroomMm`. Ο `stair-validator.ts` το εισάγει (αφαιρέθηκε το τοπικό duplicate).
- `bim/geometry/stairs/stairwell-opening-config.ts` — `STAIRWELL_OPENING_MARGIN_TREADS`, `STAIRWELL_AUTO_OPENING_KIND`.
- `bim/geometry/stairs/stair-nosing-line.ts` — `computeStairNosings` (leading-edge midpoint ανά σκαλοπάτι).
- `bim/geometry/stairs/stairwell-headroom.ts` — `evaluateStairHeadroom`, `expandViolatingRange`.
- `bim/geometry/stairs/stairwell-opening-outline.ts` — `computeStairwellOpeningOutline` (union ∩ slab).
- `SlabOpeningParams.autoStairId?` — marker: derived/managed opening (ο engine το κατέχει, δεν το πειράζει ο χρήστης).

### Νέα modules (Phase 2)
- `bim/geometry/stairs/stair-slab-overlap.ts` — pure ανιχνευτής ζεύγους «σκάλα↔πλάκα-από-πάνω»:
  - `footprintOverlapArea(a, b)` — οριζόντια επικάλυψη (reuse `safeIntersection` + `multiPolygonArea`).
  - `isSlabAboveStairBase(slab, stair)` — κατακόρυφο φίλτρο `undersideZmm > baseZmm + eps` (αποκλείει πλάκα στήριξης + κάτω ορόφους).
  - `findSlabsAboveStair(stair, slabs, opts?)` — επικάλυψη + κατακόρυφο· ταξινομημένες κατά κάτω-παρειά αύξουσα (πλησιέστερη οροφή πρώτη). Options `minOverlapArea` / `verticalEps`.
  - `findStairSlabOverlaps(stairs, slabs, opts?)` — cross-product convenience (ένα ζεύγος ανά επικάλυψη).
  - Types: `StairFootprintInput` (footprint + baseZmm/topZmm από `resolveStairVerticalProfile`), `StairwellSlabCandidate` (outline + top/underside Zmm), `StairSlabOverlap`.
- `bim/geometry/shared/polygon-utils.ts` — **NEW SSoT** `polygon3dToClipPolygon` (`Polygon3D` → clip `Polygon`). Αφαιρέθηκε το private duplicate από `stairwell-opening-outline.ts` (N.0.2/N.18 dedup)· το χρησιμοποιούν και outline (Φ1) και overlap (Φ2).

### Νέα modules (Phase 3 — `StairwellOpeningEngine`)

**Audit (N.0.1/N.0.2):** ο derived-cascade υπάρχει ήδη για walls/slabs, αλλά ΜΟΝΟ ως
**geometry-recompute** υπαρχόντων openings (`wall-opening-coordinator.recomputeHostedOpeningGeometry`,
`cascade-transformed-slab-openings`, `associative-geometry-reconcile`). **Κανένα** engine δεν έκανε
**lifecycle** (create/delete) derived openings. Άρα φτιάχτηκε νέο, με **ακριβώς** το σχήμα του
`wall-opening-coordinator` (pure core + thin apply που διαβάζει την τρέχουσα σκηνή).

- `bim/geometry/stairs/stairwell-opening-plan.ts` — **pure planner (engine core)**. `planStairwellOpenings(stairs, slabs, existing, opts)` → `StairwellOpeningPlan { creates, updates, deletes }`. Ενώνει Φ1–Φ2 (`findSlabsAboveStair` → `evaluateStairHeadroom` → `expandViolatingRange` → `computeStairwellOpeningOutline`) και κάνει diff έναντι των υπαρχόντων managed openings. **Idempotent**: key = `autoStairId + slabId`· αμετάβλητο outline (ανοχή) → κανένα churn· duplicate managed → κρατά ένα, σβήνει τα υπόλοιπα. Μηδέν scene/entities/React — όλα τα z σε mm (in).
- `bim/stairs/stairwell-opening-inputs.ts` — **pure input builders**: `buildStairwellSlabCandidates` (top/underside σε mm από `levelElevation`), `buildStairwellPlanStairs` (profile από `resolveStairVerticalProfile` + nosings από `computeStairNosings`, **μία** scene→mm μετατροπή του nosing z μέσω `dxfUnitToMm`, footprint από `geometry.bbox`), `collectManagedStairwellOpenings` (φίλτρο `params.autoStairId`).
- `bim/stairs/stairwell-opening-coordinator.ts` — **thin coordinator** (mirror `wall-opening-coordinator`): `cascadeStairwellOpenings(sceneManager, opts)` = read scene → inputs → `planStairwellOpenings` → `applyStairwellOpeningPlan` (add/update/remove μέσω `ISceneManager`, enterprise-id via `buildSlabOpeningEntity`, geometry via `computeSlabOpeningGeometry`). Idempotent· no-op χωρίς `getEntities`.
- `bim/stairs/stair-headroom-constants.ts` — **+** `effectiveMinHeadroomMm(profile)`: ίδιο με `resolveMinHeadroomMm` ΕΚΤΟΣ `'none'` → `DEFAULT_MIN_HEADROOM_MM` (η φυσική ανάγκη διέλευσης υπάρχει ανεξάρτητα κανονισμού· ο validator κρατά `resolveMinHeadroomMm`).
- `bim/geometry/stairs/stairwell-opening-outline.ts` — **fix**: αφαίρεση closing-duplicate vertex (`stripClosingDuplicate`) από το ring που επιστρέφει το `polygon-clipping` (first===last), ώστε το auto outline να ακολουθεί την ίδια σύμβαση open-ring/CCW με τα χειροκίνητα openings — αλλιώς ο `validateSlabOpeningParams` το βλέπει self-intersecting.

**Scope Φ3:** engine + apply στη **σκηνή** (in-memory). Το βαθύ persistence/audit/BOQ, το undo-command
wrapping, ο orphan-cleanup σε delete σκάλας, και η **κλήση** του coordinator από τα geometry commands
(mirror `reconcileAssociativeGeometry` call-site) → **Φ4**.

## 6. Phase plan

| Φ | Τι | Status |
|---|---|---|
| **0** | Θεμέλια: headroom SSoT (nok→2200), config, `autoStairId` marker | ✅ DONE |
| **1** | Καθαρή γεωμετρία (nosing / headroom / outline) + jest (15 tests) | ✅ DONE |
| **2** | Ανίχνευση ζεύγους σκάλα↔πλάκα-από-πάνω (`stair-slab-overlap.ts`) | ✅ DONE |
| **3** | `StairwellOpeningEngine` — derived cascade, lifecycle wiring (engine + apply στη σκηνή) | ✅ DONE |
| **4** | Reactive call-site (`reconcileAssociativeGeometry`) + persistence/BOQ/audit (lifecycle events) + orphan-cleanup σε delete σκάλας | ✅ DONE¹ |
| **4.1** | Trigger σε **δημιουργία** πλάκας/σκάλας (draw ceiling → τρύπα εμφανίζεται αμέσως) — `reconcileAssociativeGeometryOnCreate` στα δύο creation SSoTs | ✅ DONE |
| **5** | deterministic-stable id ✅ · edge-touching opening ✅ · **3D punch (inherited free) ✅ · UX warnings panel ✅ · lock/override (managed detach) ✅** · stair-create→command ⏳ · ADR finalize | 🔶 PARTIAL |

¹ Καλύπτει: μετακίνηση/περιστροφή/κλίμακα (`SnapshotTransformCommand`) + params-edit (`MergeableUpdateCommand`, π.χ. ύψος σκάλας / στάθμη-πάχος πλάκας) σκάλας ή πλάκας, + delete σκάλας. **ΔΕΝ** καλύπτει ακόμη το πρώτο-σχεδίασμα πλάκας πάνω από υπάρχουσα σκάλα (Φ4.1).

## 7. Google-level

- **Proactive** (Q1): η τρύπα δημιουργείται στο σωστό lifecycle moment (slab/stair change), όχι side-effect.
- **Idempotent** (Q3): ο engine ξαναϋπολογίζει· `autoStairId` εγγυάται ένα managed opening ανά σκάλα/πλάκα.
- **SSoT** (Q5): ένα headroom map, ένα boolean lib, ένα opening entity type.
- Phase 0–1: καθαρές pure συναρτήσεις, μηδέν side-effects, 15/15 jest.

## 8. Αρχιτεκτονική Φ4 + γνωστά κενά

**Reactive wiring (SSoT reuse):** ο `cascadeStairwellOpenings` καλείται inline μέσα στο
`reconcileAssociativeGeometry` (bim/cascade), δίπλα στο `cascadeHostedOpeningsForWalls` —
άρα τρέχει αυτόματα από τα **δύο** command bases που το καλούν (`MergeableUpdateCommand`
execute/undo/redo + `SnapshotTransformCommand` executeInPlace/undoInPlace/redoInPlace),
χωρίς να αγγιχτεί κάθε command ξεχωριστά. `changedIds` gate: skip όταν το command δεν
άγγιξε σκάλα/πλάκα (μηδέν κόστος σε άσχετα edits).

**Undo/redo (χωρίς snapshots):** ο planner είναι **idempotent full-lifecycle diff** — στο
undo ξανα-τρέχει πάνω στον επαναφερμένο host και παράγει το σωστό σύνολο (create/delete),
mirror του `cascadeHostedOpeningsForWalls` (ADR-540). Καμία ξεχωριστή command/undo-stack
εγγραφή.

**Persistence + BOQ + audit (μηδέν παράκαμψη):** ο coordinator εκπέμπει τα ΙΔΙΑ lifecycle
events με το χειροκίνητο opening — `drawing:entity-created` (tool `'slab-opening'`, μέσω
`emitBimEntityCreated`) σε create/update, `bim:slab-opening-delete-requested` (μέσω
`emitBimEntityDeleteRequested`) σε delete — deferred σε `queueMicrotask`. Το
`useSlabOpeningPersistence` (ADR-594) κάνει Firestore setDoc/deleteDoc + audit
(`recordSlabOpeningChange`) + BOQ re-feed (`bim:slab-opening-persisted` → host slab
net-volume) **αυτόματα**. `neverUpdate:true` → setDoc idempotent στο ίδιο id.

**Orphan-cleanup σε delete σκάλας:** νέο `findHostedStairwellOpenings(stairIds, entities)`
(bim-cascade-resolver, mirror `findHostedSlabOpenings` αλλά keyed στο `autoStairId`)· το
`delete-entities-core.ts` προσθέτει τα auto openings της σκάλας στο **ίδιο** delete command
(σιωπηλά, auto-derived) → atomic undo (snapshot restore) + Firestore deleteDoc μέσω του
υπάρχοντος `emitBimDeleteEvents`. (Delete **πλάκας** καλύπτεται ήδη από το προϋπάρχον
slab→slab-opening orphan cascade.)

### Αρχιτεκτονική Φ4.1 — create trigger (RESOLVED 2026-07-11)

**SSoT audit (N.0.1) — το εύρημα που καθόρισε τη λύση:** ΔΕΝ υπάρχει **ένα** κοινό command-time
σημείο για κάθε create. Τα δύο creation paths είναι **ασύμμετρα**:
- **Πλάκα** (και beam/roof/column/…): `appendEntityToScene`/`appendEntitiesToScene` →
  **`CreateBimEntityCommand`** (undoable command, ADR-390).
- **Σκάλα**: `bim/stairs/add-stair-to-scene.ts` → **raw `setLevelScene` + `emitBimEntityCreated`**
  (ιστορικό path, ADR-619· **μη-undoable** — γνωστό SSoT gap).

Και τα δύο, όμως, είναι σαφή **creation-time chokepoints**. Το codebase προτιμά **command/
creation-time** cascade (ADR-540) έναντι reactive effect (ADR-492 §4 — reactive geometry effect
που ξανα-εκπέμπει event → storm/freeze). Άρα **απορρίφθηκε** η αρχική πρόταση (reactive listener
στο `drawing:entity-created`): θα εισήγαγε το πρώτο-ποτέ reactive geometry cascade **και** θα άφηνε
**orphan opening στο undo** της πλάκας (το undo εκπέμπει `bim:slab-delete-requested`, ΟΧΙ
`drawing:entity-created` → ο listener δεν θα ξανα-έτρεχε).

**Λύση (SSoT):** νέα universal `reconcileAssociativeGeometryOnCreate(createdEntity, sceneManager)`
(bim/cascade/associative-geometry-reconcile) — **type-gated** (μόνο σκάλα/πλάκα → `cascadeStairwellOpenings`·
κάθε άλλο create no-op στην πρώτη γραμμή), **full recompute** (χωρίς `changedIds` gate: ο gate έγινε
με τον τύπο, ώστε να συγκλίνει ΚΑΙ στο undo όπου το entity μόλις αφαιρέθηκε). Καλείται από **αμφότερα**
τα creation SSoTs (mirror των δύο edit/transform command bases):
- `CreateBimEntityCommand` **execute/redo/undo** → πλάκα πάνω από σκάλα ανοίγει το opening· undo το
  σβήνει (idempotent re-run πάνω στην επαναφερμένη σκηνή → orphan delete)· redo το ξαναφτιάχνει.
- `addStairToScene` (μετά το `setLevelScene`+emit) → σκάλα κάτω από πλάκα ανοίγει το opening
  (μη-undoable, συνεπές με τη μη-undoable σκάλα).

**Zero-loop (ADR-492 §4):** ο cascade προσθέτει το «well» με raw `addEntity` (ΟΧΙ νέα command) και
τα lifecycle emits του είναι deferred → κανένα re-entrant create· ο planner επιστρέφει άδειο diff
στο 2ο run. +9 jest (`bim/cascade/__tests__/stairwell-create-trigger.test.ts`), jscpd diff clean.

### Αρχιτεκτονική Φ5 — 3D + UX + lock/override (RESOLVED 2026-07-11)

**SSoT audit (N.8 — 3 παράλληλα Explore agents) πριν από κώδικα. Ευρήματα:**

1. **3D punch — inherited FREE (μηδέν κώδικας).** Το 3D slab τρυπάει ήδη πραγματική τρύπα για
   **κάθε** `SlabOpeningEntity` **kind-agnostic** (`bim-three-slab-converter.slabToMesh` →
   `pushHoles` → `THREE.Shape.holes` + `ExtrudeGeometry`· single-layer ΚΑΙ multi-layer
   `slab-multilayer-solid-3d.addSlabLayerBand`), keyed μόνο σε `params.slabId` +
   `filterHostedSlabOpenings` (visibility). Ο `slabOpeningPickMesh` κάνει το κενό selectable.
   **Καμία** διάκριση `kind`/`autoStairId` πουθενά στο `bim-3d/`. Το auto «well» opening (κανονικό
   persisted `SlabOpeningEntity` με `slabId`) ρέει στο 3D store μέσω της **ίδιας** subscription με τα
   χειροκίνητα → τρυπάει σε 3D αυτόματα. Mirror του wall-opening 3D punch (`wall-opening-extrude`),
   ήδη υπάρχον.

2. **UX warnings — full properties panel («όπως οι μεγάλοι», απόφαση Giorgio).** Ο audit ανέτρεψε
   την υπόθεση «generic `EntityWarningsSection` θέλει μόνο wiring»: το `EntityWarningsSection`
   αφορά **άλλο** concern (cross-entity organism diagnostics, ADR-459/482), ΟΧΙ per-entity
   `validation.violationKeys`. Ο μηχανισμός violationKeys→text ήταν hand-rolled μόνο σε
   `WallWarningsSection` + `StairWarningsSection` (δίδυμα)· **δεν υπήρχε slab-opening properties panel
   καθόλου** (`BimPropertiesRouter` χωρίς `isSlabOpeningEntity` branch). **Λύση (big-player: Revit
   Properties palette / C4D Attribute manager / Figma inspector — κάθε στοιχείο έχει panel):**
   - **NEW SSoT** `ui/structural-warnings/ViolationKeyWarningsSection.tsx` — ένα presentational
     component «violationKeys → warning text list». Το `WallWarningsSection` **refactor-άρεται** να
     το delegate-άρει (boy-scout N.0.2/N.18 — αφαιρεί το υπάρχον twin, μηδέν νέο sibling clone).
   - **NEW** `ui/slab-opening-advanced-panel/` — `SlabOpeningPropertiesTab` (mirror
     `FoundationPropertiesTab`) + `SlabOpeningAdvancedPanel` (info readout: kind/εμβαδό/**status**
     managed·detached·manual) + `SlabOpeningWarningsSection` (delegate). Registered στο
     `BimPropertiesRouter` (`isSlabOpeningEntity` branch). Το soft warning
     (`codeViolations.outlineAtSlabEdge`) φαίνεται πλέον ως **κείμενο** (role="alert"), όχι μόνο badge.

3. **Lock / override — managed detach (Revit-strict, απόφαση Giorgio).** Ο audit βρήκε τα managed
   openings **100% απροστάτευτα** (grips/edit/delete ελεύθερα· το `autoStairId` ήταν σκέτο σχόλιο).
   Δεν υπήρχε generic lock· πλησιέστερο precedent = ADR-503 `member-section-lock` (marker flips
   engine↔user ownership). **Κρίσιμο εύρημα:** η υπόθεση «override = αφαίρεση `autoStairId`» είναι
   **λάθος** — ο planner (`computeDesiredOpenings` vs `collectManagedStairwellOpenings`) θα έβλεπε
   κενό existing-managed για ένα παραβατικό ζεύγος και θα **regenerate διπλό opening**. **Λύση —
   detach flag (νέο `SlabOpeningParams.autoStairDetached?`), κρατά το `autoStairId` (pair identity):**
   - **NEW SSoT** `bim/stairs/managed-slab-opening-lock.ts` — `isManagedOpeningParams`
     (`autoStairId && !detached`), `isManagedSlabOpening`, `isStairwellOverridePatch`,
     `buildStairwellOverridePatch`.
   - **Grips:** `getSlabOpeningGrips` → `[]` για managed (Revit locked/hosted — μηδέν handles).
   - **Param edit:** `UpdateSlabOpeningParamsCommand.validate` → block managed πλην της **μόνης**
     νόμιμης μετάβασης `autoStairDetached:true` (single chokepoint· grip commit + ribbon combobox +
     bulk). Το ribbon bridge δίνει immediate feedback (`window.confirm` — υπάρχον idiom) + εφαρμόζει
     override+edit σε ΕΝΑ command.
   - **Delete:** `deleteEntitiesById` προστατεύει directly-selected managed openings (filter + N.7.2
     log — hard-block, όχι σιωπηλή απώλεια)· το ribbon delete προσφέρει Override. Το delete **σκάλας**
     (cascade) δεν επηρεάζεται.
   - **Override («Ξεκλείδωμα»):** νέο ribbon action → `buildStairwellOverridePatch` → `autoStairDetached:true`.
   - **Planner freeze:** το detached μετρά ως «υπάρχον» (μηδέν διπλό regenerate) αλλά ο diff **δεν** το
     update-άρει/σβήνει (`stairwell-opening-plan.diffPlan`, `collectManagedStairwellOpenings.detached`).
     `findHostedStairwellOpenings` **εξαιρεί** detached (delete σκάλας δεν σαρώνει user-owned override).

**Persistence:** το `autoStairDetached` persist-άρει FREE (passthrough `base.params = input.params`,
όπως το `autoStairId`)· τίθεται μόνο σε `true` → μηδέν Firestore-undefined. **Big-player alignment:**
Revit managed element → locked για direct edit, ρητό "Edit"/"Reset", ΠΟΤΕ σιωπηλή απώλεια/αναδημιουργία.
**+18 jest** (lock predicates/grips/validate ×15, planner/coordinator/resolver detach ×6 → βλ. count στο
changelog) + panel render ×5, jscpd diff clean.

### Γνωστά κενά (honesty)
- **σκάλα create = μη-undoable:** το `addStairToScene` είναι raw `setLevelScene` (όχι command), οπότε
  το auto opening της νεο-σχεδιασμένης σκάλας δεν μπαίνει σε undo stack — **συνεπές** με τη μη-undoable
  σκάλα, αλλά ασύμμετρο με το slab path. Φ5: migrate stair create σε `CreateBimEntityCommand`.
- **managed = πλήρως κλειδωμένο (geometry + metadata):** ακόμη και αλλαγή fireRating/kind απαιτεί
  Override (deliberate — Revit-strict, απόφαση Giorgio). Αν χρειαστεί χαλάρωση (metadata-only edit
  χωρίς detach), γίνεται αργότερα: το `validate` guard είναι το ένα σημείο αλλαγής.
- ~~**id churn σε undo→redo**~~ **(RESOLVED Φ5, 2026-07-11):** ο coordinator `applyCreate` δίνει
  πλέον **deterministic-stable** id ανά (autoStairId, slabId) μέσω `generateDeterministicSlabOpeningId(seed)`
  (enterprise-id SSoT· seed = `stairwellOpeningPairKey` = το identity key του planner). Το idempotent
  re-run (undo→redo) ξαναφτιάχνει το **ίδιο** doc id → `setDoc` idempotent (`neverUpdate`), μηδέν
  Firestore churn. Deterministic UUID-shaped suffix (cyrb128, synchronous, μηδέν crypto). Χειροκίνητα
  openings κρατούν random id (backward compat — `idOverride?` optional· Φ5 edge-touching το
  μετακίνησε στο `BuildSlabOpeningEntityOptions` object μαζί με το `allowOutsideSlab?`).
- ~~**opening στην άκρη πλάκας:**~~ **(RESOLVED Φ5, 2026-07-11):** αν το outline ενός auto
  «well» opening ακουμπά/φτάνει ως το χείλος του slab (`safeIntersection` → shared edge →
  boundary-coincident κορυφές → `pointInPolygon` false), ο `buildSlabOpeningEntity` έκανε
  hard-reject → `applyCreate` skip → **καμία τρύπα, σιωπηλά**. Λύση (SSoT audit — προτιμήθηκε
  opt-in flag στον ΕΝΑ strict builder έναντι νέου builder ή relax του validator για ΟΛΑ):
  opt-in `allowOutsideSlab` option στο `buildSlabOpeningEntity` (default **strict** —
  χειροκίνητο commit αμετάβλητο). Όταν true (**μόνο** ο stairwell coordinator), το
  `outlineOutsideSlab` **υποβιβάζεται** από hard error σε **soft warning** (`bimValidation.
  violationKeys += slabOpening.validation.codeViolations.outlineAtSlabEdge`, `hasCodeViolations=true`)
  → commit + persist + BOQ κανονικά, με **red badge** μέσω του υπάρχοντος `useViolationBadgeState`
  path (μηδέν renderer/canvas αλλαγή). Big-player alignment: Revit/ArchiCAD floor openings που
  ακουμπούν χείλος → opening + warning, ΠΟΤΕ σιωπηλή εξαφάνιση ούτε σιωπηλό inset. Τα **πραγματικά**
  hard errors (self-intersecting / zero-area / missing host / tooFewVertices) **παραμένουν block**
  + πλέον **logged** (N.7.2 — όχι silent skip). Ο κοινός `partitionOutsideSlabTolerance` helper
  μοιράζεται με τον preview builder (N.18 — μηδέν sibling clone).

## 9. Changelog

- **2026-07-11** — Phase 5 (partial) — **3D punch + UX warnings panel + lock/override (managed detach)**.
  SSoT audit (N.8, 3 Explore agents) πριν από κώδικα. **(1) 3D punch = inherited FREE:** το 3D slab
  τρυπάει ήδη kind-agnostic κάθε `SlabOpeningEntity` (`pushHoles`→`THREE.Shape.holes`+`ExtrudeGeometry`,
  single+multi-layer), keyed σε `slabId`+visibility· το auto «well» opening το κληρονομεί → μηδέν κώδικας.
  **(2) UX warnings = full properties panel** («όπως οι μεγάλοι», απόφαση Giorgio): ο audit ανέτρεψε την
  υπόθεση «generic section» (`EntityWarningsSection` = άλλο concern· δεν υπήρχε slab-opening panel). Νέο
  shared SSoT `ViolationKeyWarningsSection` (Wall refactor-άρεται να το delegate-άρει — boy-scout dedup,
  αφαιρεί twin) + νέο `slab-opening-advanced-panel/` (`SlabOpeningPropertiesTab`+`SlabOpeningAdvancedPanel`
  info/status + `SlabOpeningWarningsSection`) + `isSlabOpeningEntity` branch στο `BimPropertiesRouter` →
  soft warning ως **κείμενο** (role=alert), όχι μόνο badge. **(3) Lock/override (Revit-strict, απόφαση
  Giorgio):** ο audit βρήκε managed openings 100% απροστάτευτα. **Κρίσιμο:** «override = αφαίρεση
  autoStairId» = **λάθος** (ο planner regenerate διπλό). Λύση = detach flag (`autoStairDetached?`, κρατά
  `autoStairId` για pair identity). Νέο SSoT `managed-slab-opening-lock.ts` (predicates + override patch)·
  grips→[] για managed· `UpdateSlabOpeningParamsCommand.validate` block managed πλην override transition·
  `deleteEntitiesById` hard-block+log directly-selected managed· ribbon «Ξεκλείδωμα» action· planner/
  inputs/resolver «παγώνουν» τα detached (μηδέν update/delete/regenerate, delete σκάλας δεν τα σαρώνει).
  Persistence FREE (params passthrough). N.18: αφαίρεση structural clone `findHostedSlabOpenings`↔
  `findHostedStairwellOpenings` (κοινό `collectSlabOpeningIdsWhere`). +2 i18n (el/en: override label +
  managedLockPrompt) + panel keys. **+23 jest** (lock predicates/grips/validate ×13, planner/coordinator/
  resolver detach ×5, panel render ×5), 141/141 σχετικά suites green, jscpd diff clean. **Big-player:**
  Revit managed element locked+explicit "Edit"/"Reset", ΠΟΤΕ σιωπηλή απώλεια ούτε αναδημιουργία διπλού.
  **Εκκρεμεί Φ5:** stair-create→command (μη-undoable σκάλα).
- **2026-07-11** — Phase 5 (partial) — **edge-touching opening (preview-tolerant commit)**.
  SSoT audit: ο tolerant μηχανισμός υπήρχε (`buildSlabOpeningPreviewEntity`, ADR-574 Σ2b) αλλά
  **PREVIEW-ONLY**· ο commit περνούσε strict `buildSlabOpeningEntity` → `outlineOutsideSlab`
  (boundary-coincident κορυφή από `safeIntersection`) hard-reject → `applyCreate` silent skip →
  καμία τρύπα σε auto «well» opening που ακουμπά χείλος. Λύση (προτιμήθηκε opt-in flag στον ΕΝΑ
  strict builder — μηδέν νέος builder, μηδέν validator relax για ΟΛΑ): νέο
  `BuildSlabOpeningEntityOptions { idOverride?, allowOutsideSlab? }` (το `idOverride` μετακινήθηκε
  σε options — backward compat, default strict). `allowOutsideSlab:true` (μόνο ο coordinator)
  υποβιβάζει `outlineOutsideSlab` → soft warning (`codeViolations.outlineAtSlabEdge` +
  `hasCodeViolations`) → red badge μέσω υπάρχοντος `useViolationBadgeState` (μηδέν renderer αλλαγή).
  Πραγματικά hard errors (self-intersecting / zero-area / missing host) παραμένουν block + **logged**
  (N.7.2). Κοινός `partitionOutsideSlabTolerance` helper με τον preview (N.18 dedup). +2 i18n keys
  (el/en). +7 jest (tolerant builder ×5: strict-reject / tolerant-commit-with-warning /
  genuine-hard-error-still-blocks / inside-no-warning / idOverride-via-options· coordinator ×2:
  edge-touching→commit+warning / inside→no-warning), 86/86 slab-opening+stairwell green, jscpd diff
  clean. **Big-player:** Revit/ArchiCAD floor opening στο χείλος → opening + warning (ΟΧΙ silent
  drop/inset). **Εκκρεμεί Φ5:** stair-create→command, 3D + UX badge/lock/override.
- **2026-07-11** — Phase 5 (partial) — **deterministic-stable opening id**. SSoT audit: το id
  παραγόταν πάντα random (`generateSlabOpeningId` στο shared `assembleSlabOpeningEntity`), οπότε undo→redo
  του auto opening άλλαζε doc id (deleteDoc X → setDoc Y). Λύση: νέος deterministic generator στο
  enterprise-id SSoT (`generateDeterministicSlabOpeningId(seed)` — cyrb128 → UUID-shaped, synchronous,
  `slbopn_` prefix) + optional `idOverride?` στο `buildSlabOpeningEntity`/`assembleSlabOpeningEntity`
  (χειροκίνητα κρατούν random — backward compat) + `applyCreate` περνά id από `stairwellOpeningPairKey`
  (το exported identity key του planner = seed). Undo→redo ξαναφτιάχνει το **ίδιο** id → setDoc idempotent
  (`neverUpdate`), μηδέν Firestore churn. +4 jest (deterministic generator ×3 + undo/redo-same-id ×1),
  130/130 slab-opening + enterprise-id regression green, jscpd diff clean. **Εκκρεμεί Φ5:** stair-create→command,
  edge-touching opening (preview-tolerant), 3D + UX badge/lock/override.
- **2026-07-11** — **Bugfix (tread-shape SSoT)**: το pipeline (`computeStairNosings`,
  `computeStairwellOpeningOutline`, `StairwellPlanStair.treads`) υπέθετε treads = `{ vertices }`
  (`bim-base.Polygon3D`), αλλά το `StairGeometry.treads` είναι **BARE `Point3D[]`** ανά tread
  (`stair-types.Polygon3D`, ADR-358). Κάθε σκάλα με πραγματική γεωμετρία έσκαγε στο
  `tread.vertices` (`undefined`) — αναδείχθηκε πρώτο από ADR-633 multi-flight turn commit (το cascade
  τρέχει `buildStairInput`). **Fix (ελάχιστος, στο translation boundary):** το `buildStairInput`
  (`stairwell-opening-inputs.ts`) wrap-άρει ΜΙΑ φορά κάθε bare tread σε `{ vertices }` για τον planner
  → και οι δύο consumers διαβάζουν `.vertices` με ασφάλεια, μηδέν αλλαγή στο planner design. Τα ADR-632
  test mocks διόρθωσαν (`GEOM_TREADS` bare για `geometry.treads`· `TREADS` `{vertices}` μένει για
  `StairwellPlanStair.treads`) + regression test με bare-array geometry. 76/76 stairwell+multiflight green.
- **2026-07-11** — Phase 4.1 DONE (create-trigger). SSoT audit: τα δύο creation paths ασύμμετρα —
  πλάκα → `CreateBimEntityCommand` (undoable), σκάλα → `add-stair-to-scene` raw `setLevelScene`
  (μη-undoable). Καμία κοινή command-time τρύπα → νέα universal `reconcileAssociativeGeometryOnCreate`
  (type-gated σκάλα/πλάκα → `cascadeStairwellOpenings`, full recompute → συγκλίνει και σε undo)
  καλείται από **αμφότερα** τα creation SSoTs: `CreateBimEntityCommand` execute/redo/undo (mirror
  `MergeableUpdateCommand`) + `addStairToScene` (μετά setLevelScene+emit). Απορρίφθηκε η reactive-listener
  πρόταση (πρώτο-ποτέ reactive geometry effect + orphan opening στο slab-undo). Zero-loop (raw addEntity +
  deferred emits, ADR-492 §4). +9 jest (create/undo/redo/idempotent/gate + integration), 281/281 stairs
  regression green, jscpd diff clean. **Gap:** σκάλα create παραμένει μη-undoable (Φ5: migrate σε command).
- **2026-07-10** — Phase 4 DONE (core). Reactive wiring: `cascadeStairwellOpenings` inline στο `reconcileAssociativeGeometry` (καλύπτει `MergeableUpdate`+`SnapshotTransform`, με `changedIds` perf-gate). Persistence/BOQ/audit: ο coordinator εκπέμπει `drawing:entity-created`(tool slab-opening)/`bim:slab-opening-delete-requested` (deferred microtask, mirror `CreateBimEntityCommand`) → `useSlabOpeningPersistence` κάνει Firestore + audit + BOQ αυτόματα (μηδέν παράκαμψη· `neverUpdate` setDoc idempotent). Orphan-cleanup: νέο `findHostedStairwellOpenings` (bim-cascade-resolver) + stair-branch στο `delete-entities-core.ts` → auto openings της σκάλας μπαίνουν στο ίδιο delete command (atomic undo). Undo/redo δωρεάν από idempotent re-run (mirror ADR-540). +7 jest (47/47 stairwell + 42/42 regression green: reconcile/resolver/wall-coordinator/delete-core), jscpd diff clean. **Gaps (§9):** Φ4.1 create-trigger, id churn undo/redo, edge-touching opening → Φ5.
- **2026-07-10** — Phase 3 DONE. `StairwellOpeningEngine`: pure planner (`stairwell-opening-plan.ts` — create/update/delete diff, idempotent key=`autoStairId+slabId`, dedup) + pure input builders (`stairwell-opening-inputs.ts` — slab candidates, plan stairs με μία scene→mm nosing μετατροπή, managed-opening φίλτρο) + thin coordinator (`stairwell-opening-coordinator.ts` — `cascadeStairwellOpenings` read→plan→apply, mirror `wall-opening-coordinator`). Audit: κανένα υπάρχον engine δεν έκανε lifecycle derived openings (μόνο geometry-recompute) → νέο με ίδιο σχήμα. +`effectiveMinHeadroomMm` ('none'→NOK default). Fix: `stripClosingDuplicate` στο Φ1 outline (polygon-clipping closed-ring → open-ring σαν τα manual, αλλιώς validator=self-intersecting). +13 jest (40/40 συνολικά green), jscpd diff clean. Reuse: Φ1–Φ2 pure functions, `resolveStairVerticalProfile`, `computeStairNosings`, `buildSlabOpeningEntity`, `computeSlabOpeningGeometry`, `dxfUnitToMm`. Persistence/audit/BOQ/undo/orphan-cleanup/call-site → Φ4.
- **2026-07-10** — Phase 2 DONE. Pure ανιχνευτής `stair-slab-overlap.ts` (footprint overlap + κατακόρυφο-πάνω-από-βάση φίλτρο, sorted nearest-ceiling-first, cross-product convenience). Εξήχθη κοινό `polygon3dToClipPolygon` στο `polygon-utils.ts` (SSoT· αφαιρέθηκε private duplicate από outline module, N.0.2/N.18). +12 jest (27/27 συνολικά green), jscpd diff clean. Reuse: `safeIntersection`/`multiPolygonArea` (ADR-396), `HOST_Z_EPS` (`host-footprint-eval`), inputs από `resolveStairVerticalProfile`.
- **2026-07-10** — Phase 0 + Phase 1 DONE. Headroom SSoT (`stair-headroom-constants.ts`, nok 2030→2200), feature config, `autoStairId` marker, τρία pure geometry modules (nosing / headroom / outline), 15 jest tests (all green), jscpd clean. ADR created.
