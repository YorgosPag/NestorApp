# ADR-436 — BIM Foundation Discipline (Θεμελίωση: Πέδιλα, Πεδιλοδοκοί, Συνδετήριες Δοκοί, Γενική Κοιτόστρωση)

- **Status**: IN PROGRESS (v2 — Slice 0 data model DONE· Slice 1 `pad` full 2Δ+3Δ DONE· Slice 1b selection + parametric grips DONE· **Slice 1c pad 7 grips (4 corners+2 edges+rotation) via shared `rect-grip-engine` SSoT DONE** (95/95 jest)· Slice 1-persist Firestore persistence DONE· Slice 2 strip/tie-beam line tools + «Πεδιλοδοκός από τοίχο» DONE — pending browser-verify + commit + deploy rules/indexes· **NEXT: rect-grip-engine → κολώνα (Slice C) + τοίχος (Slice D)**· DEFER: 3Δ from-wall pick/ghost, Slice 3 slab polish, Slice 4 BOQ/IFC, rotation-handle unify)
- **Date**: 2026-06-10
- **Authors**: Opus (research + architecture), Giorgio (product owner)
- **Discipline**: Structural (`structural`)
- **Επόμενο ελεύθερο ADR μετά**: ADR-437
- **Σχετικά ADR**: ADR-369 (elevation convention), ADR-401 (structural attach), ADR-412 (auto family-types), ADR-294 (SSoT ratchet), ADR-017/210 (enterprise IDs)

---

## 1. Context — Γιατί

Η υποεφαρμογή DXF/BIM Viewer (`/dxf/viewer`) έχει ήδη πλήρες **ανωδομικό** (superstructure) στατικό μοντέλο:

| Στοιχείο | Entity type | Geometry base | IFC |
|----------|-------------|---------------|-----|
| Τοίχος | `WallEntity` | line-based | `IfcWall` |
| Κολώνα / Τοιχίο | `ColumnEntity` (9 kinds) | point-based | `IfcColumn` |
| Δοκάρι | `BeamEntity` | line-based | `IfcBeam` |
| Πλάκα | `SlabEntity` | region-based | `IfcSlab` |

**Λείπει εντελώς η ΘΕΜΕΛΙΩΣΗ** (foundation / substructure). Δεν υπάρχει κώδικας για πέδιλα, πεδιλοδοκούς, συνδετήριες δοκούς, γενική κοιτόστρωση, κεφαλόδεσμους ή πασσάλους — ούτε σε 2Δ ούτε σε 3Δ. Επιβεβαιώθηκε με grep (`footing|foundation|πέδιλο|κοιτόστρωση`): μηδέν σχετικός κώδικας (τα hits αφορούν άσχετο context όπως `duct-network-foundation`).

Στόχος: **νέο structural discipline «foundation»** ισοδύναμης ποιότητας με Revit / IFC, με κώδικα 2Δ + 3Δ, Full Enterprise + Full SSoT, ακολουθώντας **ακριβώς** τα υπάρχοντα patterns (column/beam/slab) ώστε να κληρονομεί δωρεάν: persistence, BOQ, undo/redo, multi-floor, visibility filtering, IFC export.

---

## 2. Research — Πώς το κάνουν οι μεγάλοι παίκτες

### 2.1 Revit (Autodesk) — «Structural Foundation» category

Το Revit ομαδοποιεί ΟΛΗ τη θεμελίωση σε **μία** category «Structural Foundation» με **τρία** εργαλεία:

1. **Isolated** (Structural Foundation: Isolated) → family-based πέδιλο **κάτω από κολώνα**. Point-based τοποθέτηση.
2. **Wall** (Structural Foundation: Wall) → συνεχές πέδιλο **κάτω από τοίχο** (bearing ή retaining). Line-based, ακολουθεί τον τοίχο. (= «continuous footing» / strip footing.)
3. **Slab / Mat** (Structural Foundation: Slab) → γενική κοιτόστρωση / raft / combined mat. Region-based (sketch boundary).

Wall & Slab foundations = **system families** (scheduláρονται με thickness). Isolated = **loadable family** (component).

### 2.2 IFC (buildingSMART) — `IfcFooting` / `IfcPile`

Το IFC schema (`IfcStructuralElementsDomain`) ορίζει το `IfcFooting` με `IfcFootingTypeEnum`:

| PredefinedType | Σημασία | Ελληνικός όρος |
|----------------|---------|----------------|
| `PAD_FOOTING` | Μεταφέρει το φορτίο **μίας** κολώνας στο έδαφος | Μεμονωμένο πέδιλο |
| `STRIP_FOOTING` | Γραμμικό, μεταφέρει φορτίο από **συνεχές** στοιχείο (τοίχο) ή σειρά κολωνών | Πεδιλοδοκός / Συνεχές πέδιλο |
| `PILE_CAP` | Μεταφέρει φορτίο κολώνας/ομάδας σε πάσσαλο/ομάδα πασσάλων | Κεφαλόδεσμος |
| `FOOTING_BEAM` | Σε κάμψη, **clear of the ground**, εδράζεται σε πασσάλους/κεφαλόδεσμους | Συνδετήρια / πεδιλοδοκός εναέρια |
| `CAPS`, `USERDEFINED`, `NOTDEFINED` | λοιπά | — |

Βαθιά θεμελίωση (πάσσαλοι) = ξεχωριστό `IfcPile` (όχι `IfcFooting`). Γενική κοιτόστρωση = `IfcSlab` με PredefinedType `BASESLAB`.

### 2.3 Στατική ορολογία — δοκοί θεμελίωσης (αποσαφήνιση ελληνικών όρων)

- **Grade beam / Ground beam** (πεδιλοδοκός εδραζόμενη): δοκός πάνω στο έδαφος, κάτω από τοίχους, κατανέμει φορτίο σε πέδιλα/πασσάλους.
- **Tie beam / Συνδετήρια δοκός**: οριζόντια δοκός που **συνδέει** κολώνες/μεμονωμένα πέδιλα ώστε να μειώσει λυγισμό & διαφορικές καθιζήσεις (Eurocode 8 — υποχρεωτικές σε σεισμικές ζώνες).
- **Strap beam (δοκός πρόβολος)**: συνδέει δύο πέδιλα, **δεν** εδράζεται στο έδαφος, ανακατανέμει φορτίο εκκεντρικής κολώνας (π.χ. σε όριο οικοπέδου).

Στην ελληνική πρακτική: **πεδιλοδοκός** = συχνά συνεχές πέδιλο που δρα και ως δοκός σύνδεσης πεδίλων· **συνδετήρια δοκός** = tie beam. Θα τα μοντελοποιήσουμε ως δύο kinds (`strip` εδραζόμενη + `tie-beam` εναέρια/συνδετήρια) για να καλύψουμε και τις δύο σημασίες με σωστή IFC αντιστοίχιση.

### 2.4 2Δ σύμβαση σχεδίασης κάτοψης θεμελίωσης

Διεθνής σύμβαση (ISO/DIN/ANSI foundation plan):

- Πέδιλα & στοιχεία **κάτω από τη στάθμη** → **διακεκομμένη (hidden) γραμμή** περιγράμματος (είναι κρυμμένα κάτω από το έδαφος).
- Συνδετήριες/πεδιλοδοκοί → διακεκομμένο περίγραμμα **+ centerline (άξονας)**.
- Πατούρα πεδίλου σχεδιάζεται γύρω από το ίχνος της κολώνας· η κολώνα φαίνεται με συνεχή γραμμή μέσα στο πέδιλο.
- Concrete hatch στο cut του πεδίλου, dimension labels (πλάτος × μήκος × βάθος).

---

## 3. Decision — Αρχιτεκτονική (LOCKED)

### 3.1 Ένα entity type, discriminated union by kind (Full SSoT)

**Απόφαση**: ΕΝΑ νέο `BimElementType = 'foundation'` (discipline `structural`), με **ΕΝΑ** `FoundationEntity` που φέρει `FoundationParams` ως **discriminated union** πάνω στο πεδίο `kind` — ακριβώς όπως το `ColumnEntity` φέρει 9 `ColumnKind` σε ένα entity.

Αιτιολογία: αντιστοιχεί 1:1 με τη Revit «Structural Foundation» ενιαία category, αποφεύγει 4× διπλασιασμό persistence/ribbon/BOQ, και είναι το πιο SSoT-πιστό μοντέλο. ΕΝΑΣ renderer (dispatch by kind), ΕΝΑΣ 3D converter (dispatch by kind), ΕΝΑ ribbon tab (kind selector), ΕΝΑ persistence host.

### 3.2 Taxonomy — `FoundationKind`

Το νέο foundation discipline καλύπτει **ΜΟΝΟ** point/line elements που **δεν** χωράνε στο region-based slab (βλ. §3.6 για τις region-based πλάκες θεμελίωσης = slab reuse):

| `kind` | Ελληνικά | Geometry base | Tool pattern (mirror) | IFC | Phase |
|--------|----------|---------------|----------------------|-----|-------|
| `pad` | Μεμονωμένο πέδιλο | **point** | `useColumnTool` | `IfcFooting/PAD_FOOTING` | **1** |
| `strip` | Πεδιλοδοκός (συνεχές πέδιλο) | **line** | `useBeamTool` | `IfcFooting/STRIP_FOOTING` | **1** |
| `tie-beam` | Συνδετήρια δοκός | **line** | `useBeamTool` | `IfcFooting/FOOTING_BEAM` | **1** |
| `pile-cap` | Κεφαλόδεσμος | point | `useColumnTool` | `IfcFooting/PILE_CAP` | 2 (defer) |
| `pile` | Πάσσαλος | point (vertical) | `useColumnTool` | `IfcPile` | 2 (defer) |

`FoundationEntity.ifcType` = **πάντα** `'IfcFooting'`· το `predefinedType` (`PAD_FOOTING`/`STRIP_FOOTING`/`FOOTING_BEAM`) διαφοροποιεί ανά kind.

**Phase 1** υλοποιεί: `pad`, `strip`, `tie-beam`. Phase 2 (μελλοντικά): `pile-cap`, `pile` (βαθιά θεμελίωση).

### 3.3 Pad footing sub-shapes (`PadFootingProfile`)

- `flat` — απλό ορθογώνιο/πολυγωνικό πρίσμα σταθερού βάθους. **Phase 1**.
- `stepped` — 2-βάθμιο (πλατιά βάση + στενότερο άνω βήμα). **Phase 1**.
- `sloped` — κωνική/πυραμιδική απόληξη (frustum). **Phase 1b** (reuse `buildColumnPrismGeometry` με μεταβλητό top per-corner).

### 3.4 Elevation convention (ADR-369 alignment)

Η θεμελίωση είναι **κάτω από τη στάθμη** (αρνητικό Z). Σύμβαση ίδια με slab/beam (κρέμονται ΚΑΤΩ από την άνω παρειά):

- Αποθηκεύεται `topElevationMm` = στάθμη **άνω παρειάς** του πεδίλου (τυπικά αρνητικό, π.χ. `-1000`).
- 3Δ: `mesh.position.y = (topElevationMm − thicknessMm) * MM_TO_M + buildingBaseElevationM` → το στερεό μεγαλώνει ΚΑΤΩ.
- Default foundation level: κάτω από το χαμηλότερο `floorElevation` (datum `resolveBuildingDatumElevationM`). Αρνητικό Z υποστηρίζεται ήδη πλήρως (ADR-369 §negative Z).
- `tie-beam`: `topElevationMm` + `depthMm` (mirror beam), εναέρια πάνω από πέδιλα/κεφαλόδεσμους.

### 3.5 Hosting / attach (ADR-401 alignment)

- `pad` **φιλοξενεί** κολώνα: η κολώνα μπορεί να εδραστεί (base-attach) στην άνω παρειά του πεδίλου (`baseProfile.cornerBaseZmm` → top face του pad). Reuse `column-structural-attach-coordinator` + `buildWallHostInputs` (γενικό host-input array → προσθήκη foundation solids).
- `strip` ακολουθεί άξονα τοίχου (auto-place κάτω από επιλεγμένο τοίχο, mirror `beam-from-wall`).
- `tie-beam` συνδέει δύο pad footings (endpoints snap σε pad centroids).
- Phase 1: hosting **read-side** (foundations εμφανίζονται ως πιθανοί hosts). Auto-place tools = Phase 1b.

### 3.6 Region-based foundation = slab reuse (ΟΧΙ νέο entity)

**Εύρημα research (code = source of truth):** Ο υπάρχων κώδικας `SlabEntity` έχει ήδη 5 `SlabKind` — `floor | ceiling | roof | ground | foundation` (`bim/types/slab-types.ts:46`). Τα `ground` (εδαφόπλακα / slab-on-grade) και `foundation` (γενική κοιτόστρωση / raft) είναι **ήδη πλήρως επιλέξιμα** από το ribbon (`ui/ribbon/data/contextual-slab-tab.ts:35-36`) με πλήρες pipeline (geometry `computeSlabGeometry` / 2Δ `SlabRenderer` / 3Δ `slabToMesh` / persistence) — απλώς «μισοτελειωμένα» (μόνο fill colour + label + default elevation 0).

**Απόφαση (Giorgio, 2026-06-10 — «όπως η Revit, Full SSOT»):** οι region-based πλάκες θεμελίωσης **REUSE** τον slab μηχανισμό — **μηδέν** διπλασιασμός. Ευθυγραμμίζεται με Revit (Structural Foundation Slab = system family πάνω στον ίδιο Floor/sketch μηχανισμό· δεν είναι ξεχωριστή γεωμετρική οντότητα). Άρα:

| Στοιχείο | Πού ζει | IFC |
|----------|---------|-----|
| Εδαφόπλακα (slab-on-grade) | `SlabEntity` kind=`ground` | `IfcSlab` |
| Γενική κοιτόστρωση (raft/mat) | `SlabEntity` kind=`foundation` | `IfcSlab/BASESLAB` |

**Slab foundation polish (ξεχωριστό slice — βλ. §7 Slice 3), ΟΧΙ νέο entity:**
1. Below-grade default elevation: τα `ground`/`foundation` kinds να ξεκινούν με **αρνητικό** top-face (κάτω από στάθμη) αντί 0 — ενημέρωση `SLAB_KIND_DEFAULT_LEVEL_ELEVATION_MM` (`slab-types.ts:224`).
2. Foundation-plan 2Δ σύμβαση: **διακεκομμένη (hidden)** περίγραμμα όταν kind ∈ {`ground`,`foundation`} (below grade) — wiring στον `SlabRenderer` + slab `hidden-lines` subcategory.
3. IFC predefinedType `BASESLAB` για kind=`foundation` (IFC export, Slice 4).
4. (Προαιρετικά) slab-on-grade build-up (υπόβαση γαρμπίλι / μόνωση / στεγανωτικό) μέσω του υπάρχοντος `SlabDna` layered μηχανισμού.

Αυτό σημαίνει: **καμία** mat γεωμετρία στο foundation entity — το `FoundationKind` μένει `pad | strip | tie-beam`.

---

## 4. 2Δ Design (plan view)

### 4.1 Renderer — `FoundationRenderer` (extends `BaseEntityRenderer`)

Dispatch by `kind`:

- **`pad`**: κλειστό περίγραμμα footprint με **διακεκομμένη** γραμμή (hidden — below grade), concrete hatch, ημιδιάφανο fill, dimension labels (W×L), κεντρικός σταυρός (column footprint indicator). `stepped` → δεύτερο εσωτερικό διακεκομμένο περίγραμμα για το άνω βήμα.
- **`strip`**: διακεκομμένο band (2 παράλληλες γραμμές) + **centerline** (dash-dot) στον άξονα + concrete hatch.
- **`tie-beam`**: διακεκομμένο στενότερο band + centerline (ίδιο με strip, μικρότερο πλάτος, διαφορετικό subcategory color).

(Οι region-based πλάκες θεμελίωσης — εδαφόπλακα/κοιτόστρωση — σχεδιάζονται από τον υπάρχοντα `SlabRenderer`, βλ. §3.6.)

Hover halo + grips (SSoT `BaseEntityRenderer.finalizeRender`, ADR-040 boy-scout).

### 4.2 Palette & subcategories

- `bim/foundations/foundation-render-palette.ts` — `FOUNDATION_KIND_FILL` ανά kind.
- `config/bim-subcategories.ts` — foundation subcats: `pad`, `strip`, `tie-beam`, `mat`, `hidden-lines`, `cut-pattern`, `centerline`.
- `config/bim-object-styles.ts` — `BimCategory += 'foundation'`, edge color (γαιώδες γκρι-μπλε π.χ. `0x6b7a8f`).

### 4.3 Grips

- `pad` (**Slice 1c** — 7 grips, wall/column parity): rotation + 2 edge-midpoints
  (width/length) + **4 corners** (`foundation-corner-{ne,nw,sw,se}`). Corner & edge
  resize math = shared **`bim/grips/rect-grip-engine`** SSoT (RectFrame); ο pad
  adapter (`padToRectFrame`/`rectFrameToPadParams` σε `foundation-grips.ts`)
  μεταφράζει params ↔ frame + preserves anchor. **Semantics**: opposite element
  fixed (AutoCAD/Revit shape-handle) — corner κρατά την απέναντι γωνία σταθερή,
  edge την απέναντι ακμή. (Αντικατέστησε το προηγούμενο anchor-symmetric
  width/depth resize του Slice 1b.) Central MOVE = Alt+drag (declutter).
- `strip`/`tie-beam`: start/end + width handle (mirror `beam-grips`).
- `mat`: polygon vertex grips (reuse `bim/grips`).

> **SSoT note (Slice 1c):** το `rect-grip-engine` + `rect-frame` είναι entity-agnostic
> και προορίζονται να καταναλωθούν εξίσου από τον **τοίχο** (straight) και την
> **κολώνα** (rect/shear-wall) — βλ. ADR-363. Πέδιλο = 1ος καταναλωτής (pilot).

---

## 5. 3Δ Design

### 5.1 Mesh builder — `foundationToMesh(foundation, levelId, buildingBaseElevationM)`

Νέο `bim-3d/converters/foundation-to-three.ts` (ή επέκταση `bim-three-structural-converters.ts`), dispatch by `kind`:

- **`pad` flat**: `buildShape(footprint.vertices)` → `extrudeAndRotate(shape, thickness * MM_TO_M)` → `mesh.position.y = (topElevation − thickness) * MM_TO_M + buildingBaseElevationM`.
- **`pad` stepped**: δύο extrudes (βάση + βήμα) merged σε ένα group/geometry.
- **`pad` sloped**: `buildColumnPrismGeometry(footprint, cornerBase, cornerTop)` με μεταβλητό top → frustum.
- **`strip`/`tie-beam`**: ορθογώνιο box κατά μήκος άξονα (mirror `beamToMesh` rectangular path) — extrude του outline rectangle.

(Οι region-based πλάκες θεμελίωσης — εδαφόπλακα/κοιτόστρωση — χτίζονται από τον υπάρχοντα `slabToMesh`, βλ. §3.6.)

`tagMesh(mesh, id, 'foundation', matId, levelId)` + `attachEdgesProjection(mesh, 'foundation')`.

### 5.2 Materials

- `bim/materials/material-catalog-defs.ts` — νέο `'elem-foundation'`: `{ color: 0x9a9488, roughness: 0.88, metalness: 0.0 }` (σκληρό σκυρόδεμα/χώμα). Εναλλακτικά reuse `'mat-concrete'`.
- `bim-3d/materials/MaterialCatalog3D.ts` — επέκταση `getElementMaterial3D` union με `'foundation'`.

### 5.3 Registration (7 touch points από ADR-369 research)

1. `Bim3DEntitiesStore.ts` — `foundations: readonly FoundationEntity[]` slice + `setFoundations` + `EMPTY_BIM_ENTITIES`.
2. `bim3d-resync.ts` — προσθήκη foundations στο snapshot.
3. `BimSceneLayer.ts` — `private syncFoundations(entities, ctx)` + call στο `syncFloorEntities` (κληρονομεί visibility/building isolation/multi-floor δωρεάν μέσω `resolveEntity`).
4. `bim-object-styles.ts` — `BimCategory += 'foundation'`.
5. `bim-discipline.ts` — `DISCIPLINE_BY_CATEGORY.foundation = 'structural'`.
6. `material-catalog-defs.ts` + `MaterialCatalog3D.ts` — material.
7. `BimToThreeConverter.ts` — re-export `foundationToMesh`.

---

## 6. SSoT touch points — πλήρης λίστα αρχείων (mirror column/beam/slab)

### 6.1 NEW files

| Concern | Αρχείο |
|---------|--------|
| Types | `bim/types/foundation-types.ts` |
| Schemas (Zod) | `bim/types/foundation.schemas.ts` |
| Geometry kernel | `bim/geometry/foundation-geometry.ts` |
| 2Δ renderer | `bim/renderers/FoundationRenderer.ts` |
| 2Δ hatch | `bim/foundations/foundation-hatch-patterns.ts` |
| 2Δ palette | `bim/foundations/foundation-render-palette.ts` |
| 2Δ grips | `bim/foundations/foundation-grips.ts` |
| Scene insertion | `bim/foundations/add-foundation-to-scene.ts` |
| Preview store | `bim/foundations/foundation-preview-store.ts` |
| 3Δ converter | `bim-3d/converters/foundation-to-three.ts` |
| Tool hook | `hooks/drawing/useFoundationTool.ts` |
| Entity factory | `hooks/drawing/foundation-completion.ts` |
| Firestore | `bim/foundations/foundation-firestore-service.ts` |
| Persistence hook | `hooks/data/useFoundationPersistence.ts` |
| Persistence host | `app/FoundationPersistenceHost.tsx` |
| Update command | `core/commands/entity-commands/UpdateFoundationParamsCommand.ts` |
| Ribbon tab | `ui/ribbon/data/contextual-foundation-tab.ts` |
| Ribbon bridge | `ui/ribbon/hooks/useRibbonFoundationBridge.ts` |
| Ribbon keys | `ui/ribbon/hooks/bridge/foundation-command-keys.ts` |
| BOQ feed | `hooks/data/foundation-boq-feed.ts` |
| Catalog (SSoT) | `bim/foundations/foundation-catalog.ts` (τυπικά πέδιλα/concrete grades C16–C30) |

### 6.2 MODIFIED files (SSoT registries)

| Αρχείο | Αλλαγή |
|--------|--------|
| `bim/types/bim-base.ts` | `BimElementType += 'foundation'` |
| `bim/discipline/bim-discipline.ts` | `DISCIPLINE_BY_CATEGORY.foundation = 'structural'` |
| `config/bim-object-styles.ts` | `BimCategory += 'foundation'` + colors |
| `config/bim-subcategories.ts` | foundation subcategories |
| `bim/materials/material-catalog-defs.ts` | `'elem-foundation'` |
| `bim-3d/materials/MaterialCatalog3D.ts` | `getElementMaterial3D` union |
| `bim-3d/stores/Bim3DEntitiesStore.ts` | foundations slice |
| `bim-3d/scene/BimSceneLayer.ts` | `syncFoundations` |
| `bim-3d/scene/bim3d-resync.ts` | snapshot |
| `bim-3d/converters/BimToThreeConverter.ts` | re-export |
| `systems/tools/tool-definitions.ts` | tool IDs: `foundation-pad`, `foundation-strip`, `foundation-mat`, `foundation-tie-beam` |
| `app/ribbon-contextual-config.ts` | register `CONTEXTUAL_FOUNDATION_TAB` + trigger |
| `bim/config/bim-to-atoe-mapping.ts` | ATOE BOQ code (σκυρόδεμα θεμελίωσης) |
| `src/i18n/locales/el/dxf-viewer-shell.json` | labels |
| `src/i18n/locales/en/dxf-viewer-shell.json` | labels |
| `src/i18n/locales/{el,en}/tool-hints.json` | tooltips |

### 6.3 Enterprise IDs (N.6)

Νέο prefix + generator στο `@/services/enterprise-id.service` (π.χ. `fnd-`) ΠΡΙΝ το πρώτο `setDoc`. Όλα τα foundation docs με `setDoc()` + enterprise ID (απαγόρευση `addDoc`).

---

## 7. Implementation phasing (proposed)

| Slice | Περιεχόμενο | Mode |
|-------|-------------|------|
| **0** | Types + schemas + discipline/category/material SSoT wiring + enterprise ID + tests | Orchestrator/Plan |
| **1** | `pad` (flat+stepped): geometry + 2Δ renderer + 3Δ converter + point tool + ribbon + persistence + tests | Orchestrator |
| **1b** | `pad` sloped + column base-attach σε pad | Plan |
| **2** | `strip` + `tie-beam` (line tools, mirror beam) + auto-place κάτω από τοίχο | Orchestrator |
| **3** | Slab foundation polish (§3.6): εδαφόπλακα/κοιτόστρωση below-grade elevation + 2Δ διακεκομμένη σύμβαση + `BASESLAB` — **reuse slab, μηδέν νέο entity** | Plan |
| **4** | BOQ/ATOE + IFC export (`IfcFooting` + `IfcSlab/BASESLAB`) + schedule columns | Plan |
| **2 (future)** | `pile-cap` + `pile` (βαθιά θεμελίωση) | — |

Κάθε slice: jest tests + N.15 update (`local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + ADR changelog + adr-index). ΟΧΙ ADR-040 staging (η θεμελίωση δεν αγγίζει micro-leaf canvas αρχιτεκτονική, πλην preview ghost αν προστεθεί).

---

## 8. Test plan (mirror existing __tests__)

- `bim/foundations/__tests__/` — add-foundation-to-scene, foundation-grips, foundation-hatch-patterns, foundation-catalog.
- `bim/geometry/__tests__/foundation-geometry.test.ts` — footprint/volume ανά kind.
- `bim/types/__tests__/foundation.schemas.test.ts` — Zod validation.
- `bim/renderers/__tests__/FoundationRenderer-*.test.ts` — dispatch by kind, hidden-line wiring.
- `bim-3d/converters/__tests__/foundation-to-three.test.ts` — elevation formula (hang-down), stepped/sloped geometry.
- `hooks/drawing/__tests__/useFoundationTool.test.tsx` — FSM ανά geometry base.
- `core/commands/entity-commands/__tests__/UpdateFoundationParamsCommand.test.ts`.

---

## 9. Consequences

**Θετικά**: Πλήρης substructure κάλυψη ευθυγραμμισμένη με Revit/IFC· κληρονομεί δωρεάν persistence/BOQ/undo/multi-floor/IFC export· ένα entity type = ελάχιστη επιφάνεια συντήρησης· σωστή 2Δ σύμβαση (hidden lines) + 3Δ below-grade.

**Αρνητικά / ρίσκα**: Πολλά αρχεία (~22 new + ~15 mod) → orchestrator-scale, πολλαπλά slices. Το `tie-beam` vs `strip` ελληνικό terminology απαιτεί προσεκτικά labels. Pile/pile-cap αναβάλλονται.

**Alternatives rejected**:
- *4 ξεχωριστά entity types* (pad/strip/mat/tie-beam): απορρίφθηκε — 4× διπλασιασμός persistence/ribbon/BOQ, αντίθετο στο Revit ενιαίο category μοντέλο.
- *Reuse `SlabEntity` με flag «isFoundation»*: απορρίφθηκε — μολύνει το slab domain, χάνει σωστή IFC αντιστοίχιση (`IfcFooting` ≠ `IfcSlab`), δεν καλύπτει point/line bases.

---

## 10. Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-06-10 | Opus | Αρχική σύνταξη: research (Revit/IFC/2Δ σύμβαση) + locked αρχιτεκτονική (ένα `FoundationEntity`, discriminated union 6 kinds, Phase 1 = pad/strip/mat/tie-beam), πλήρες SSoT file plan, phasing, test plan. Status PROPOSED.
| 2026-06-10 | Opus | **v2 (Giorgio — «όπως η Revit, Full SSOT»):** region-based πλάκες θεμελίωσης (εδαφόπλακα/κοιτόστρωση) → **REUSE** υπάρχοντος `SlabEntity` (kinds `ground`/`foundation`), ΟΧΙ νέο entity (νέα §3.6). `mat` αφαιρέθηκε από `FoundationKind` → `pad | strip | tie-beam` (όλα `IfcFooting`). Slab polish = ξεχωριστό Slice 3. Status → IN PROGRESS, Slice 0 (data model) υλοποιείται.
| 2026-06-10 | Opus | **Slice 0 DONE:** NEW `foundation-types.ts` (discriminated union 3 kinds + `FoundationGeometry`/`Entity` + `FOUNDATION_IFC_MAP` + defaults + `buildDefaultFoundationParams`), `foundation.schemas.ts` (Zod `discriminatedUnion` + superRefine pad profile), `foundation.factory.ts` (`createFoundation`). Enterprise ID prefix `fnd` (4 touch points). SSoT wiring: `BimElementType`, `BimCategory`(+colour/style/arrays), `DISCIPLINE_BY_CATEGORY`=structural, `SUBCATEGORY_TAXONOMY`, `elem-foundation` material, `getElementMaterial3D` union, `IfcEntityType` += `IfcFooting`. 50/50 jest (3 suites), tsc καθαρό στα 12 αρχεία (μόνο pre-existing errors σε άσχετα αρχεία άλλων agents). NEXT: Slice 1 (`pad` full 2Δ+3Δ).
| 2026-06-10 | Opus | **Slice 1 DONE (`pad` full 2Δ+3Δ — pending browser-verify + commit):** NEW `foundation-geometry.ts` (`computeFoundationGeometry`, total over 3 kinds — pad rect+anchor+rotation, strip/tie-beam band), `foundation-validator.ts`, `foundation-completion.ts` (`buildFoundationEntity`/`buildDefaultFoundationParams`), `FoundationRenderer.ts` (2Δ διακεκομμένο hidden-line περίγραμμα + concrete RC hatch + κεντρικός σταυρός), `foundation-render-palette.ts`, `foundation-hatch-patterns.ts` (reuse column RC hatch SSoT, N.0.2), `add-foundation-to-scene.ts`, `foundation-to-three.ts` (`foundationToMesh`, hang-down elevation `(topElev−thickness)·MM_TO_M+base`), `useFoundationTool.ts` (single-click pad + Tab anchor FSM) + `foundation-tool-bridge-store.ts`, `UpdateFoundationParamsCommand.ts`, `contextual-foundation-tab.ts` + `foundation-command-keys.ts` + `useRibbonFoundationBridge.ts`, `FoundationPersistenceHost.tsx` (Slice-1: 3D-store push only). MOD registration: `entities.ts` (guard+union), `Bim3DEntitiesStore` (foundations slice), `bim3d-resync`, `BimSceneLayer.syncFoundations`, `BimToThreeConverter` re-export, `EntityRendererComposite`, `tool-definitions` (`foundation-pad`), `ribbon-contextual-config` (tab+triggers), `ToolType` union, `useSpecialTools`/`useCanvasClickHandler` (tool wiring+dispatch), `home-tab-draw` (button), `useDxfBimBridges`/`useRibbonCommands`/`useRibbonCommands-types`/`useDxfViewerRibbon` (bridge composer), `useFloors3DAggregator` (multi-floor foundations filter), `bim-subcategories` (foundation subcats wired), i18n el+en (foundationEditor/panels/tabs/bim group/tools/validation). 84/84 jest (4 νέα suites: geometry/validator/completion/converter). ΕΚΤΟΣ ADR-040. **DEFER → Slice 1b:** canvas grip-drag (`useGripMovement` ColumnGripKind union), live placement ghost overlay, stepped/sloped profile, column base-attach σε pad. **DEFER → Slice 1-persist:** Firestore service/hook/audit/collection (`floorplan_foundations`) + rules/indexes deploy (CHECK 3.16). ΜΗΝ adr-index (shared tree).
| 2026-06-10 | Opus | **Slice 1-persist DONE (Firestore persistence — pending browser-verify + commit + deploy rules/indexes):** Καθαρός mirror της ΚΟΛΩΝΑΣ (structural, point/line-based, **ΧΩΡΙΣ BOQ/buildingId/connectors**). **3 NEW:** `bim/foundations/foundation-firestore-service.ts` (collection `FLOORPLAN_FOUNDATIONS`· `FoundationDoc {kind,params}`· subscribe via `buildBimScopeConstraints` ADR-420· `saveFoundation`/`updateFoundation`/`deleteFoundation` setDoc/updateDoc split ADR-397· `generateFoundationId` N.6· `entityToSaveInput` strips geometry), `hooks/data/useFoundationPersistence.ts` (subscribe+diff-merge+selective-skip+grace· 500ms auto-save· first-save `drawing:entity-created` tool='foundation'· delete `bim:foundation-delete-requested`· moved/restored persist effects· `recordFoundationChange`· `docToEntity` reuse `createFoundation` factory SSoT — re-derive geometry), `bim/foundations/foundation-audit-client.ts` (entityType:'foundation', `FOUNDATION_TRACKED_FIELDS`). **9 MODIFY:** `firestore-collections.ts` (FLOORPLAN_FOUNDATIONS + FLOOR_SCOPED_BIM_COLLECTIONS), `audit-tracked-fields.ts` (FOUNDATION_TRACKED_FIELDS + case), `firestore.rules` (νέο `match /floorplan_foundations` exact mirror columns), `firestore.indexes.json` (4 composite: companyId+projectId+floorplanId· floorplanId+projectId· companyId+projectId+floorId· projectId+floorId), `FoundationPersistenceHost.tsx` (3D-only → full host, ΚΡΑΤΑ setFoundations push), `DxfViewerTopBar.tsx` (full props, ΟΧΙ buildingId), `useBimEntityRestoredPersistEffect.ts` (+'foundation' union), `drawing-event-map.ts` (+`bim:foundation-delete-requested`), `useSmartDelete.ts` (foundation filter+emit), `coverage-manifest.ts` (`'floorplan_foundations'` στο FIRESTORE_RULES_PENDING). **ΜΑΘΗΜΑ (code=SoT):** ΟΛΑ τα 23 BIM collections είναι σε `FIRESTORE_RULES_PENDING` — **κανένα** δεν έχει individual rules-test → CHECK 3.16 mirror = PENDING entry (ΟΧΙ νέο rules-test suite όπως έλεγε το handoff). CHECK 3.17: `FLOORPLAN_FOUNDATIONS` εκτός `TRACKED_COLLECTION_KEYS` → ο service δεν φλαγκάρεται· audit-client μπαίνει ούτως ή άλλως για History tab. 114/114 foundation jest (+2 suites: audit-client/firestore-service)· tsc καθαρό σε όλα τα touched· CHECK 3.16 OK· index coverage foundation πλήρες. ΕΚΤΟΣ ADR-040. ΜΗΝ adr-index. **DEFER:** strip/tie-beam line tools (Slice 2)· BOQ/IFC (Slice 4). |
| 2026-06-10 | Opus | **Slice 2 DONE (strip / tie-beam line tools + «Πεδιλοδοκός από τοίχο» — pending browser-verify + commit):** Καθαρός mirror του BEAM pipeline· το βαρύ μέρος (geometry `buildBandFootprint` / `foundationToMesh` / validator / `moveFoundation`) ήταν ήδη total over 3 kinds — προστέθηκε ΜΟΝΟ το interaction layer. **Revit-grade (LOCKED):** το `kind` ορίζεται από το tool id (3 ξεχωριστά tools + 1 from-wall), ΟΧΙ switchable combobox (pad↔line geometrically invalid). **5 NEW:** `bim/foundations/foundation-preview-store.ts` (single-writer/multi-reader, mirror `beam-preview-store`), `hooks/drawing/foundation-preview-helpers.ts` (`generateFoundationPreview` rubber-band band μέσω `computeFoundationGeometry` SSoT), `bim/foundations/foundation-from-wall.ts` (`buildStripFromWall` + re-export ΚΟΙΝΟΥ `pickWallEntityAt` από beam — μηδέν διπλασιασμός), + 4 νέα jest suites (useFoundationTool FSM 8· foundation-from-wall 4· foundation-preview-helpers 3· foundation-completion two-click +4). **~16 MODIFY:** `useFoundationTool.ts` (line FSM `awaitingStart→awaitingEnd` + `placementMode` freehand/from-wall + preview-store writes ΠΡΙΝ setState· pad single-click αμετάβλητο· <500 LOC), `foundation-completion.ts` (`completeFoundationFromTwoClicks` via `axisEnd` override), `grip-kinds.ts` (`FoundationGripKind += foundation-start/end/line-width`), `foundation-grips.ts` (line emission start/end/perp-width + transforms `moveLineStart/End`+`resizeLineWidth` mirror beam· pad branch αμετάβλητο· τα 16 Slice-1b forwarding boundaries ρέουν αυτόματα μέσω `foundationGripKind` field + generic `commitFoundationGripDrag`), `FoundationRenderer.ts` (centerline dash-dot pass για line kinds, subcat `centerline`), `drawing-preview-generator.ts` + `drawing-preview-tool-points.ts` (router + tempPoints reconstruct, mirror beam), `tool-definitions.ts` + `ui/toolbar/types.ts` (3 tool ids), `useCanvasClickHandler.ts` (dispatch: strip/tie-beam bimPoint ortho· from-wall raw worldPoint), `useSpecialTools.ts` (ΕΝΑ instance + 4 ids· kind/placementMode ανά activeTool· getSceneEntities), `ribbon-contextual-config.ts` (trigger 4 ids), `home-tab-draw.ts` (3 κουμπιά: Πέδιλο/Πεδιλοδοκός/Συνδετήρια + από-τοίχο), `contextual-foundation-tab.ts` + `useRibbonFoundationBridge.ts` + `foundation-command-keys.ts` (kind-conditional panels padOnly/lineOnly· kind combobox = DISPLAY-ONLY· line width/thickness options), `snapping/shared/GeometricCalculations.ts` (`getEntityCenter` += foundation pad center → **tie-beam pad-center snap μέσω ΥΠΑΡΧΟΝΤΟΣ `CenterSnapEngine`, μηδέν νέο engine** — #19), i18n el+en (statusStart/statusEnd/statusPickWall/errorNoWall + 3 tool labels/tooltips + kind.strip/tieBeam). 142/142 foundation jest (πλήρες) + 581 grip/beam regression πράσινα (1 pre-existing fail σε `grip-commit-alt-bypass` mep-segment connectivity-move — ΟΧΙ δικό μου touch). ΕΚΤΟΣ ADR-040 (renderer/preview touch → CHECK 6B/6D καλύπτεται από αυτό το staged changelog). ΜΗΝ adr-index (shared tree). **DEFER:** 3Δ from-wall pick/ghost (2Δ Wall-Foundation πλήρες)· Slice 3 (slab foundation polish)· Slice 4 (BOQ/IFC).
| 2026-06-10 | Opus | **Slice 1c DONE — pad 7 grips (4 corners + 2 edges + rotation) via shared `rect-grip-engine` SSoT (pending browser-verify + commit):** Giorgio: «ίδιο πλήθος λαβών με τον τοίχο, παντού ίδιος κώδικας, SSoT». **2 NEW (entity-agnostic engine):** `bim/grips/rect-frame.ts` (`RectFrame {center,rotationDeg,halfWidth,halfLength}` + `rectCornerWorld`/`rectEdgeWorld`/`RECT_CORNERS`), `bim/grips/rect-grip-engine.ts` (`applyRectCornerDrag` keep-opposite-corner-fixed + `applyRectEdgeDrag` keep-opposite-edge-fixed, clamp-aware back-derived centre shift) + `rect-grip-engine.test.ts` (14). **Pad adapter (σε `foundation-grips.ts`):** `padToRectFrame`/`rectFrameToPadParams` (preserve anchor = inverse `computeCentroidWorld`) + `cornerHandleWorld` + `FOUNDATION_CORNER_MAP` + `padResizeLimits`. **MOD:** `grip-kinds.ts` (`FoundationGripKind += foundation-corner-{ne,nw,sw,se}`), `foundation-grips.ts` (7-grip emission· `applyFoundationGripDrag` corner/edge → engine· **αφαιρέθηκαν** `resizeWidth`/`resizeLength`/`projectDeltaToLocal` dead-code), `useGripDimAnnotation.ts` (corner label `w= l=`). **Semantics change (LOCKED, Revit/AutoCAD):** width/length edges τώρα κρατούν την **απέναντι ακμή** σταθερή (πρώην anchor-symmetric Slice 1b)· corners κρατούν την **απέναντι γωνία**. 95/95 foundation+grip jest (engine 14 + foundation-grips 27). ΕΚΤΟΣ ADR-040. ΜΗΝ adr-index (shared tree). **+ LIVE-GHOST FIX (browser-verify Giorgio):** `draw-ghost-entity.ts` είχε cases για 23 τύπους αλλά **ΚΑΝΕΝΑ `foundation`** → το πέδιλο δεν έδειχνε live ghost σε move/resize/rotate (προϋπήρχε από Slice 1b· ο μετασχηματισμός `apply-entity-preview` ήταν σωστός, μόνο το draw έλειπε). Προστέθηκε `case 'foundation'` (footprint polygon, mirror column) **+ `case 'floor-finish'`** (params.footprint, ήταν επίσης missing — ADR-419). **FLAGGED gap (ΟΧΙ fix εδώ):** `floorplan-symbol` + `space-separator` (ADR-437) ΔΕΝ έχουν preview field στο `entity-preview-types` → μηδέν live ghost (θέλει transform-handler, όχι μόνο draw case· space-separator=shared tree άλλου agent). **+ SSoT UNIFICATION (Giorgio audit — code review):** ανακαλύφθηκε ότι ΥΠΗΡΧΕ ΗΔΗ `bim/grips/centred-box-grips.ts` (ADR-397/408) — centre-anchored rotatable-box grip SSoT με 4 corners + opposite-corner-fixed resize, σε χρήση από **8 entities** (mep-fixture/electrical-panel/water-heater/manifold/boiler/radiator/furniture/floorplan-symbol). Το `rect-grip-engine` ήταν μερικό ΔΙΠΛΟΤΥΠΟ του γεωμετρικού core του. FIX: το `centred-box-grips` έγινε **consumer** του `rect-grip-engine` (`cornerWorld`→`rectCornerWorld`, `resizeCorner`→`applyRectCornerDrag` + νέο `ortho` param στο engine)· τα 8 entities **ΑΝΕΓΓΙΧΤΑ** (ίδιο API). Τώρα ΕΝΑΣ rotated-rect grip core για ~11 entities (8 centred-box + pad + column + wall). 996/996 jest (68 suites, μηδέν regression). **NEXT:** Slice D = τοίχος (straight adapter, +2 edge midpoints). **DEFER:** rotation-handle placement unify (τοίχος στο σώμα vs pad/column 200mm πάνω).
| 2026-06-10 | Opus | **Slice 1b DONE (selection + parametric grips — pending browser-verify + commit):** (A) **Selection root-cause fix** — το 2Δ click-selection περνά από το spatial-index hit-test (`rendering/hitTesting/`), ΟΧΙ από το `services/hit-test-entity-model.ts` του Slice 1· το `'foundation'` έλειπε από 2 switch → ο spatial index το πετούσε → το κλικ δεν το έβρισκε ΠΟΤΕ. Fix: `Bounds.ts` (`case 'foundation'` → `calculateBimEntityBounds`), `hit-test-entity-tests.ts` (`case 'foundation'` + `hitTestFoundation` footprint-polygon containment, mirror `hitTestColumn`), `entity-bounds.ts` (`BimEntityWithBounds` += `'foundation'`). (B) **Parametric grips (full column parity)** — NEW `bim/foundations/foundation-grips.ts` (`getFoundationGrips` rotation/width/length + `applyFoundationGripDrag`, pad = **width×length**, anchor-aware resize + rotation-about-position + 6-click pivot + Alt-move `foundation-center`· reuse shared `grip-math` SSoT). 16 forwarding boundaries (mirror `columnGripKind` 1:1, additive): `grip-kinds` (`FoundationGripKind`), `grip-types`/`useGripMovement`/`unified-grip-types` (GripInfo+UnifiedGripInfo field), `grip-registry` (wrapDxfGrip), `grip-glyph-registry` (rotation→curved-arrow), `wall-hot-grip-fsm` (HOT_GRIP_OP_REGISTRY + `hotGripKindOf`), `grip-computation` (`computeDxfEntityGrips` `case 'foundation'` → interactive grip registry, **root του «μόνο render glyph»**), `grip-computation-types`+`grip-projections` (DxfGripDragPreview + buildDxfDragPreview/buildRotateReferencePreview), `entity-preview-types`+`grip-drag-preview-transform`+`apply-entity-preview` (live ghost branch via `applyFoundationGripDrag`+`computeFoundationGeometry`), `grip-commit-adapters`+`grip-parametric-commits` (`commitFoundationGripDrag` mirror column + `UpdateFoundationParamsCommand`), `useGripDimAnnotation` (`buildFoundationLabel` w=/l=), `FoundationRenderer.getGrips` (glyph draw), `drawing-event-map` (`bim:foundation-params-updated`). (C) **Alt+drag whole-entity move** — `bim-move-geometry.ts` `case 'foundation'` + `moveFoundation` (pad shifts position· strip/tie-beam endpoints). 101/101 foundation jest (2 νέα suites: foundation-grips 14, apply-entity-preview-foundation 3) + 137 column/grip/move regression πράσινα. ΕΚΤΟΣ ADR-040 (renderer/ghost touch → CHECK 6B/6D καλύπτεται από αυτό το changelog staged). **DEFER → Slice 2:** strip/tie-beam line grips. ΜΗΝ adr-index (shared tree).
