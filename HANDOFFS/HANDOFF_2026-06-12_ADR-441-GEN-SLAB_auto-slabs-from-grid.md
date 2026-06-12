# HANDOFF — ADR-441 GEN-SLAB: «Αυτόματη δημιουργία πλακών από κάναβο» (εδαφόπλακα + δάπεδα + οροφές)

**Date:** 2026-06-12 · **Branch:** main · **Μοντέλο: Opus** · **Shared working tree** (άλλοι agents δουλεύουν ταυτόχρονα — ειδικά **icon-agent** στο `ui/ribbon/data/structural-tab.ts`+`.test.ts`· **git add ΜΟΝΟ δικά σου hunks, ΠΟΤΕ `git add -A`**)

> 🎯 **ΕΝΤΟΛΗ GIORGIO (διαρκής):** «όπως οι μεγάλοι, όπως η Revit. FULL ENTERPRISE + FULL SSoT.» Απάντα **ΕΛΛΗΝΙΚΑ**.
>
> ⚠️ **ΚΑΝΟΝΕΣ:** Ο Giorgio κάνει commit/push — **ΠΟΤΕ εσύ** (N.(-1)). N.8 (5+ files/2+ domains→ρώτα mode — **αυτό είναι σίγουρα orchestrator-scale, ρώτα ΠΡΩΤΑ**). N.14 (δήλωσε μοντέλο πριν κώδικα). N.17 (ΕΝΑ tsc τη φορά — έλεγξε process πρώτα). function ≤40γρ, file ≤500γρ, no `any`, i18n ICU single-brace `{var}`. N.0.1 ADR-driven (Phase 1 recognition ΠΡΩΤΑ — code=SoT).

---

## 0. ΣΤΟΧΟΣ

Νέο feature: **«Πλάκες από κάναβο»** — αυτόματη δημιουργία πλακών από τον construction grid, mirror των ήδη υπαρχόντων GEN-BEAM / GEN-WALL / GEN-COL (ADR-441). Τρία υπο-εργαλεία, με **διαφορετική γεωμετρική συμπεριφορά** το καθένα (αποφάσεις Revit-grade ΗΔΗ παρμένες — βλ. §1):

1. **GEN-SLAB-MAT (εδαφόπλακα / κοιτόστρωση)** → **ΕΝΙΑΙΑ** πλάκα σε όλο το αποτύπωμα.
2. **GEN-SLAB-FLOOR (δάπεδο)** → **ΠΟΛΛΕΣ** πλάκες, μία ανά φάτνωμα (μάτι) μεταξύ δοκαριών, clipped στις παρειές δοκαριών + notched γύρω από προεξοχές κολωνών/τοιχίων.
3. **GEN-SLAB-ROOF (οροφή/στέγη επίπεδη)** → ίδιο με FLOOR αλλά `kind='roof'` στην κορυφή.

---

## 1. 🎯 ΑΠΟΦΑΣΕΙΣ REVIT-GRADE (κλειδωμένες — Giorgio τις ενέκρινε εννοιολογικά, ΜΗΝ ξανα-ρωτάς το «τι»)

### Q1 — Εδαφόπλακα: ΕΝΙΑΙΑ; → **ΝΑΙ, ΕΝΙΑΙΑ.**
**Revit:** Structural Foundation Slab / Floor: Slab-on-grade = **ΕΝΑ** element, μία κλειστή περίμετρος (sketch), καλύπτει όλο το αποτύπωμα — **ΔΕΝ** υποδιαιρείται από τον κάναβο.
**Εμείς:** `SlabEntity` με `kind='foundation'` (ΟΧΙ `FoundationEntity` — βλ. `bim/types/foundation-types.ts` §3.6 / ADR-436). Outline = **ένα** ενιαίο πολύγωνο = `computeBuildingFootprint(walls, columns, beams).outerRings[0]` (το merged outer ring του κτιρίου, με holes αν υπάρχουν εσωτερικά κενά). Ενιαίο πάχος.

### Q2 — 1ο δάπεδο: πολλές πλάκες ανά μάτι + λαμβάνει υπόψη προεξοχές κολωνών/τοιχίων; → **ΝΑΙ & ΝΑΙ.**
**Revit:** Στη βασική Revit ΔΕΝ υπάρχει εντολή «γέμισε όλα τα φατνώματα»· σχεδιάζεις κάθε Floor (Pick Lines / **Pick Supports** → boundary αυτόματα στις παρειές των δοκαριών). Όταν κολώνα/τοίχος τέμνει το floor → join/cut geometry το κόβει γύρω τους. **Εμείς αυτοματοποιούμε αυτό για ΟΛΑ τα φατνώματα μαζί** (πιο προχωρημένο από vanilla Revit, αλλά γεωμετρικά **ακριβώς** ό,τι θα έδινε το Pick Supports + auto-cut — Revit-grade).
**Εμείς:** μία `SlabEntity kind='floor'` ανά φάτνωμα. Boundary = το ορθογώνιο του φατνώματος **clipped στις ΕΣΩΤΕΡΙΚΕΣ παρειές** των περιβαλλόντων δοκαριών (όχι centerline — inner face, ώστε η πλάκα να πατά πάνω στο δοκάρι, να μην επικαλύπτει), **ΚΑΙ notched** (αφαίρεση `safeDifference`) από τις προεξοχές κολωνών/τοιχίων που μπαίνουν στο μάτι.

### Q3 — Διαφορετικά πάχη ανά μάτι (ο στατικός τα πρόβλεψε); → **ΞΕΧΩΡΙΣΤΗ ΟΝΤΟΤΗΤΑ ΑΝΑ ΜΑΤΙ.**
**Revit:** ξεχωριστό Floor element ανά panel, καθένα με δικό του Floor Type (= δικό του πάχος).
**Εμείς:** ακριβώς γι' αυτό το δάπεδο/οροφή = **ΠΟΛΛΕΣ ξεχωριστές** slab entities (όχι ένα merged) — κάθε μία κουβαλά **δικό της `thickness`** (param ή `typeId`). Default ενιαίο πάχος σε όλο τον όροφο, αλλά **per-bay override** (από UI ή properties μετά τη δημιουργία). Η idempotent reconcile (signature-set diff) χειρίζεται per-bay αλλαγές χωρίς διπλά.

**Συνέπεια (γιατί στέκει):** Εδαφόπλακα = ΕΝΑ ενιαίο (δεν θες per-bay πάχος εκεί)· δάπεδο/οροφή = ΠΟΛΛΑ ανά φάτνωμα (γιατί ακριβώς θες per-panel πάχος + clipping στα δοκάρια). Οι τρεις απαντήσεις είναι εσωτερικά συνεπείς.

---

## 2. ΣΥΣΤΑΣΗ ΥΛΟΠΟΙΗΣΗΣ (FULL SSoT, mirror GEN-BEAM ADR-441)

**Πρότυπο 1:1:** `bim/beams/beam-from-grid.ts` + `beam-grid-commit.ts` + `CreateBeamsCommand.ts` + `useRibbonBeamBridge.ts` + `beam-command-keys.ts`. Διάβασέ τα ΠΡΩΤΑ — η GEN-SLAB είναι ο ίδιος σκελετός με γεωμετρία πλάκας.

### 2A. Η ΜΟΝΗ αρχιτεκτονική διαφορά από τα δοκάρια
Τα δοκάρια/τοίχοι δένουν σε **ακμές** του κανάβου (1D segments → `enumerateGridStrips`, `nX·(nY-1)+nY·(nX-1)` segments). Οι πλάκες (floor/roof) δένουν στο **φάτνωμα** (2D cell). **ΛΕΙΠΕΙ** enumerator κελιών → φτιάξε **NEW `enumerateGridBays(axes, cb)`** στο ίδιο SSoT module (`foundation-from-grid.ts` ή νέο `grid-bays.ts`): για κάθε `(xi,yi)→(xi+1,yi+1)` εκπέμπει το ορθογώνιο `[xs[xi],ys[yi]]→[xs[xi+1],ys[yi]]→[xs[xi+1],ys[yi+1]]→[xs[xi],ys[yi+1]]` + τα 4 axis-ids ως bindings. Σύνολο `(nX-1)·(nY-1)` φατνώματα.

### 2B. NEW files (mirror beam)
- **`bim/slabs/slab-from-grid.ts`** — pure builder. **Δύο modes:**
  - `buildFoundationMatFromGuides(...)` (MAT): outline = `computeBuildingFootprint().outerRings[0]` → ΕΝΑ `SlabEntity kind='foundation'`. (Δεν χρειάζεται bays — ενιαίο.)
  - `buildSlabBaysFromGuides(...)` (FLOOR/ROOF): `enumerateGridBays` → ανά bay: rect → `safeIntersection` με buildable area → `safeDifference` με column/wall protrusions → outline → `buildSlabEntity(kind='floor'|'roof')` born-bound (guideBindings 4 axis-ids). Clip στις inner-faces δοκαριών (βλ. §3 reuse).
- **`bim/slabs/slab-grid-commit.ts`** — idempotent orchestrator `commitSlabGridFromGuides(deps)` (mirror `beam-grid-commit.ts`): `existingKeys` μέσω **NEW `bayKeyFromBindings`** (4 axis-ids) → filter `toCreate` → `new CreateSlabsCommand(toCreate, adapter)` (1 undo). Returns `up-to-date` όταν κενό.
- **`bim/hosting/slab-hosting-strategy.ts`** — `slabHostingStrategy: HostingStrategy` (area-hosting): `reconcile` ξαναχτίζει το ορθογώνιο outline από τα 4 axis bindings (NEW `deriveRectBaySlots` ή inline — `deriveLineSlots`/`derivePointSlots` ΔΕΝ ταιριάζουν, η πλάκα κινείται ως **επιφάνεια**)· `outline` = `nextGeometry.polygon.vertices`→Vec2. **+1 γραμμή** στο `STRATEGIES` του `hosting-strategy.ts` (`slab: slabHostingStrategy`).
- **`core/commands/entity-commands/CreateSlabsCommand.ts`** — batch create (mirror `CreateBeamsCommand`): `execute/redo`→apply+`deferFirestore('apply')` (`queueMicrotask`→`drawing:entity-created` με **`tool:'slab'`**, που το ακούει το `useSlabPersistence` γρ.399)· `undo`→revert+`bim:slab-delete-requested`.

### 2C. MOD files (surgical — shared tree, git add ΜΟΝΟ δικά σου hunks)
- `bim/hosting/hosting-strategy.ts` — +`slab: slabHostingStrategy`.
- `ui/ribbon/hooks/bridge/slab-command-keys.ts` — +`fromGridMat`/`fromGridFloor`/`fromGridRoof` (ή ένα `fromGrid` + kind στο context) στο `SLAB_RIBBON_KEYS_ACTIONS`.
- `ui/ribbon/data/structural-tab.ts` — +`actionBtn(...)` στο panel `structural-floors` (μετά γρ.141). ⚠️ **icon-agent shared** — μόνο τα δικά σου hunks.
- `ui/ribbon/hooks/useRibbonSlabBridge.ts` — +`handleSlabsFromGrid` (mirror `handleBeamsFromGrid` γρ.349-362) + wire στο `onAction`.
- `systems/events/drawing-event-map.ts` — +`bim:slabs-from-grid`/`bim:slabs-from-grid-failed`.
- `hooks/useDxfViewerNotifications.ts` — +listeners (mirror beamGrid γρ.123-135).
- `i18n el+en/dxf-viewer-shell.json` — `ribbon.commands.bim.slabsFromGrid*` + `slabGrid.*` (ICU plural single-brace `{count, plural, one {...} other {...}}`).

### 2D. Tests (mirror beam-from-grid.test.ts / beam-grid-commit.test.ts)
- `slab-from-grid.test.ts`: MAT (footprint→1 ενιαία)· FLOOR bays (3×3→4 φατνώματα· clip σε beam inner-face· notch κολώνας→τρύπα)· per-bay thickness override.
- `slab-grid-commit.test.ts`: idempotent (ξανα-commit→up-to-date)· νέο φάτνωμα→μόνο αυτό.
- `slab-hosting-strategy` reconcile (άξονας κινείται→outline ακολουθεί).

---

## 3. REUSE (μηδέν duplication — όλα υπάρχουν, μην ξαναγράψεις)

| Χρειάζεσαι | SSoT helper | Αρχείο |
|---|---|---|
| Grid axes (X/Y offsets+ids) | `gridAxesFromReader`, `GridAxes`, `GridStripSpec` | `bim/foundations/foundation-from-grid.ts` |
| Bay enumeration (2D) | **NEW `enumerateGridBays`** (mirror `enumerateGridStrips`) | ως άνω |
| Idempotent bay key | **NEW `bayKeyFromBindings`** (mirror `segmentKeyFromBindings`) | `bim/foundations/foundation-grid-segments.ts` |
| Εδαφόπλακα outline (ενιαίο) | `computeBuildingFootprint().outerRings[0]` | `bim/geometry/building-footprint.ts` |
| Union footprints | `safeUnion` | `bim/geometry/shared/safe-polygon-boolean.ts` |
| Clip bay σε buildable | `safeIntersection` | ως άνω |
| Notch κολώνες/τοίχους | `safeDifference` | ως άνω |
| Beam plan polygon / inner face | `computeBeamGeometry().outline` (±half offsetPolyline) · `beamHostInput(beam).footprint` | `bim/geometry/beam-geometry.ts` · `bim/geometry/wall-host-plan-builder.ts` |
| Column footprint (notch) | `computeColumnGeometry().footprint.vertices` · batch `prepareColumns()` | `bim/geometry/column-geometry.ts` · `bim/geometry/envelope-column-bridge.ts` |
| Wall band polygon (notch) | `[...outerEdge.points, ...innerEdge.points.reverse()]` | `bim/geometry/wall-geometry.ts` (pattern: `building-footprint.ts:113`) |
| Slab entity build | `buildDefaultSlabParams`→`buildSlabEntity`→`createSlab` | `hooks/drawing/slab-completion.ts` · `services/factories/slab.factory.ts` |
| Slab geometry/volume | `computeSlabGeometry` (net = beams/walls/openings deducted) | `bim/geometry/slab-geometry.ts` |
| Slab 3D / 2D | `slabToMesh` · `SlabRenderer` | `bim-3d/converters/bim-three-structural-converters.ts` · `bim/renderers/SlabRenderer.ts` |
| Persistence (tool='slab') | `useSlabPersistence` (collection `floorplan_slabs`, `generateSlabId` N.6) | `hooks/data/useSlabPersistence.ts` |
| Per-bay thickness pattern | extend bay-spec με `thicknessOverride?` (precedent: `justification` per-strip) | `foundation-from-grid.ts` GridStripSpec |

**Z/elevation σύμβαση (ADR-369 §2.1):** `top = levelElevation + heightOffsetFromLevel` (FFL top face)· `bottom = top − thickness` (κρέμεται κάτω). Εδαφόπλακα `kind='foundation'` default `levelElevation=0`· δάπεδο `kind='floor'` 0· οροφή `kind='roof'` ~3000 (`SLAB_KIND_DEFAULT_LEVEL_ELEVATION_MM`).

**Αλληλεπίδραση με ADR-401:** όταν φτιαχτεί η πλάκα-οροφής πάνω από τοίχους `storey-ceiling` → το ΗΔΗ-υπάρχον auto-attach (`useStructuralAutoAttach` host-path) θα κολλήσει τις κορυφές τοίχων από κάτω (η πλάκα είναι slab host). **Δωρεάν** — μόλις η πλάκα εκπέμψει `drawing:entity-created`. (Η αντίστροφη φορά τοίχος→host μόλις ολοκληρώθηκε σε αυτό το session.)

---

## 4. DB ANCHORS (project pagonis-87766, read-only MCP firestore — verify protocol)
- company `comp_9c7c1a50-…757` · project `proj_3a8e2b2c-…c57` · floorplan `file_32a7a4fb-a2df-4b82-a391-761241152478` · floor `flr_161aa890-…b9b9` · level/layer `lvl_b997c956-…bf97` · **sceneUnits `'m'`** (συντεταγμένες σε ΜΕΤΡΑ).
- Κάναβος 3×3: X `be38435f`(10.75)/`7baf5045`(15.89)/`b6d02652`(22.99)· Y `593441c0`(3.31)/`f79075c9`(9.36)/`6b277b97`(15.51) → **4 φατνώματα** (2×2 cells).
- Τρέχουσα DB (όλα UNCOMMITTED): `floorplan_columns`=9· `floorplan_beams`=12· `floorplan_walls`=12· `floorplan_foundations`=24· **`floorplan_slabs`=? (query το ΠΡΩΤΑ ως baseline).**
- **Verification protocol:** baseline (read-only `floorplan_slabs` query) → πάτα «Εδαφόπλακα από κάναβο» → re-query: **1** doc `kind:'foundation'` outline=building footprint. Μετά «Δάπεδα από κάναβο» → re-query: **4** docs `kind:'floor'`, καθένα με `guideBindings` 4 axis-ids + outline clipped (όχι ίδιο rect — κομμένο στις παρειές δοκαριών/notched κολώνες). 3Δ: πλάκες πατούν στα δοκάρια, τρύπες στις κολώνες.

---

## 5. ΚΑΤΑΣΤΑΣΗ REPO — 🔴 UNCOMMITTED (ΜΗΝ revert)
- **ADR-401 Phase D αντίστροφη φορά** (αυτό το session, DONE+BROWSER-VERIFIED): `bim/walls/wall-structural-attach-coordinator.ts`(+test), `hooks/useStructuralAutoAttach.ts`, ADR-401, `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`, MEMORY. 35/35 jest, tsc 0.
- **ADR-441 GEN-BEAM/WALL/COL** (προηγ. sessions, DONE+DB-verified): beam-from-grid/grid-commit, CreateBeamsCommand, column-face-trim, hosting registry, κ.λπ.
- Ο Giorgio committαρει. **git add ΜΟΝΟ δικά σου hunks** (shared tree, ΟΧΙ `-A`).

## 6. DOCS ΝΑ ΕΝΗΜΕΡΩΣΕΙΣ (N.15, ίδιο commit με κώδικα)
`local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (νέα γραμμή — μόνο τι εκκρεμεί)· **ADR-441** changelog + νέα slices GEN-SLAB-MAT/FLOOR/ROOF (cross-ref ADR-436 slab-reuse, ADR-369 elevation, ADR-401 auto-attach)· MEMORY (`project_adr441_foundation_strip_grid.md` ή νέο topic). **ΜΗΝ** `adr-index` (shared tree).

## 7. ΣΕΙΡΑ ΥΛΟΠΟΙΗΣΗΣ (πρόταση — αλλά N.8: ρώτα mode ΠΡΩΤΑ, είναι 12+ files/2+ domains = orchestrator-scale)
1. **Phase 1 recognition:** διάβασε beam-from-grid + beam-grid-commit + CreateBeamsCommand + slab-completion + slab-types + hosting-strategy + building-footprint (επιβεβαίωσε το map του handoff — code=SoT).
2. **Slice MAT** (ευκολότερο, ενιαία): builder + command + bridge button + DB-verify (1 ενιαία).
3. **Slice FLOOR** (per-bay + clip + notch): `enumerateGridBays` + `bayKeyFromBindings` + bay builder + hosting-strategy + commit + button + DB-verify (4 φατνώματα).
4. **Slice ROOF** (FLOOR με kind='roof', τετριμμένο μετά το FLOOR).
5. **Per-bay thickness** (extend bay-spec).
DEFER: μη-ορθογώνια/διαγώνια φατνώματα· tilted slabs από κάναβο· sloped roof.

## 8. REF
- Πρότυπα GEN-BEAM: `bim/beams/beam-from-grid.ts`, `beam-grid-commit.ts`, `core/commands/entity-commands/CreateBeamsCommand.ts`, `ui/ribbon/hooks/useRibbonBeamBridge.ts`, `ui/ribbon/hooks/bridge/beam-command-keys.ts`.
- Grid SSoT: `bim/foundations/foundation-from-grid.ts` (`gridAxesFromReader`/`enumerateGridStrips`/`GridStripSpec`), `foundation-grid-segments.ts` (`segmentKeyFromBindings`).
- Hosting: `bim/hosting/hosting-strategy.ts` + `-types.ts` + `derive-slots.ts` + `beam-hosting-strategy.ts`.
- Slab: `bim/types/slab-types.ts`, `hooks/drawing/slab-completion.ts`, `services/factories/slab.factory.ts`, `bim/geometry/slab-geometry.ts`, `hooks/data/useSlabPersistence.ts`.
- Geometry reuse: `bim/geometry/building-footprint.ts`, `shared/safe-polygon-boolean.ts`, `beam-geometry.ts`, `column-geometry.ts`, `wall-geometry.ts`.
- ADR: `ADR-441-foundation-strip-grid-auto-design.md` (GRID-FIRST, οι GEN-* slices)· cross-ref `ADR-436` (slab reuse εδαφόπλακα)· `ADR-369` (slab elevation)· `ADR-401` (wall auto-attach interplay).
