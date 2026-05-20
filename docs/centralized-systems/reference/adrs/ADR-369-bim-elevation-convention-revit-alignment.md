# ADR-369 — BIM Elevation Convention: Revit/Industry-Standard Alignment

- **Status**: 📝 PROPOSED
- **Date**: 2026-05-20
- **Author**: Giorgio Pagonis + Claude (Opus 4.7)
- **Supersedes**: Partial elevation semantics in ADR-363 (BIM Drawing Mode), ADR-366 (3D BIM Viewer)
- **Related**: ADR-358 (Stair ↔ Floor linking), ADR-362 (Dimension System), ADR-366 (3D Viewer)
- **Scope**: All 5 BIM structural entity types — `slab`, `beam`, `wall`, `column`, `opening` (window/door)
- **Impact**: 🔴 Breaking change σε `SlabParams.elevation` semantic (data migration required)

---

## 1. Context

Ο χρήστης (Giorgio) ζήτησε **industry-standard Revit-compatible** συμπεριφορά για τα υψόμετρα εκκίνησης των δομικών στοιχείων. Διεξήχθη έρευνα (α) στο πώς χειρίζονται Revit + AutoCAD Architecture τα υψόμετρα, και (β) στο current state του δικού μας κώδικα. Βρέθηκε **inconsistency** μεταξύ entity types και **μη-ευθυγραμμισμένο semantic** σε σχέση με Revit για slabs.

### 1.1 Industry Research (Revit / AutoCAD Architecture)

#### **Floor / Ceiling / Roof Slab** (Revit)
- **Reference**: το Level ευθυγραμμίζεται με την **πάνω επιφάνεια** (top face) της πλάκας.
- **Default behavior**: η πλάκα *"hangs DOWN"* από το Level — extrudes **προς τα κάτω** κατά `thickness`.
- **Semantic**: Level = **Finish Floor Level (FFL)** — η επιφάνεια που πατάς.
- **Override parameter**: `Height Offset From Level` (Instance Property, default 0).
- **Industry debate**: structural εργολάβοι θεωρούν Level = Top-of-Structural-Slab· architectural Revit default = FFL. Revit παραμένει consistent: top face = Level.
- **Παράδειγμα**: Floor slab @ L1 (0.00), thickness 200mm → top=0.00, bottom=-0.20

#### **Wall** (Revit)
- **Reference**: `Base Constraint` (Level) ορίζει το **κάτω** άκρο, `Top Constraint` το **πάνω**.
- **Default behavior**: ο τοίχος *"grows UP"* από το Base Level.
- **Override parameters**: `Base Offset` (mm, για raise/drop, π.χ. +200mm για να καθίσει πάνω σε structural slab), `Top Offset`.
- **Constraint**: top constraint ≠ base constraint (validation error).
- **Unconnected mode**: αν δεν υπάρχει top level, ο τοίχος μεγαλώνει κατά `Unconnected Height`.

#### **Beam / Structural Framing** (Revit)
- **Reference**: το Level ευθυγραμμίζεται με το **Top-of-Beam (top face)**.
- **Default behavior**: το δοκάρι *"hangs DOWN"* από το Level — extrudes προς τα κάτω κατά `depth`.
- **Override parameter**: `Z-Offset Value` (mm). Reporting params: `Elevation at Top`, `Elevation at Bottom`.
- **Note**: γνωστά bugs Revit όταν χρησιμοποιείται Z-Offset + Beam Annotation ταυτόχρονα.

#### **Window / Opening** (Revit)
- **Reference**: `Sill Height` μετριέται από το **host wall's Level** (όχι από project zero).
- **Default behavior**: το παράθυρο φύεται από το `Sill Height` του host wall και επεκτείνεται κατά `Window Height` προς τα πάνω.
- **Derived**: `Head Height = Sill Height + Window Height`.
- **Family origin**: το `Defines Origin` reference plane του sill (κάτω άκρο γυαλιού, ΟΧΙ brick sill) ορίζει το reference point.
- **Default windows**: sill ≈ 900mm. **Doors**: sill = 0.

#### **AutoCAD Architecture** (παράλληλη επιβεβαίωση)
- Levels με floor elevation. Walls baseline στο Level (grows up). Slabs με Floor Line offset.
- **Wall Style Editor**: components με `Wall Top`, `Base Height`, `BaseLine`, `Wall Bottom` references.
- Foundation components: negative Floor Line offset κάτω από Baseline.

### 1.2 Current State (Δικός μας Κώδικας)

Έρευνα στα παρακάτω files:

| Entity | File | Elevation Field | Reference | Direction | Revit Match? |
|--------|------|-----------------|-----------|-----------|---------------|
| **Slab** | `bim/types/slab-types.ts:54` | `elevation` | **Bottom face** | GROWS UP | ❌ **ΑΝΤΙΣΤΡΟΦΟ** |
| **Beam** | `bim/types/beam-types.ts:82` | `elevation` | **Top face** | HANGS DOWN | ✅ Match |
| **Wall** | `bim/types/wall-types.ts:65` | *(none — only `height`)* | **z=0 hardcoded** | GROWS UP | ⚠️ Partial (no offset support) |
| **Column** | similar to wall | *(none)* | **z=0 hardcoded** | GROWS UP | ⚠️ Partial |
| **Opening** | `bim/types/opening-types.ts:76` | `sillHeight` | **Host wall floor** | UP from sill | ✅ Match |

#### **Slab semantic** (κρίσιμη ασυμφωνία):
```ts
// slab-types.ts:54
readonly elevation: number;
// mm. Bottom surface z from project origin. floor:0, ceiling:2800, roof:3000.
// 3D extrudes upward.
```
Defaults `SLAB_KIND_DEFAULT_ELEVATION_MM`:
- `floor: 0` → top=200mm
- `ceiling: 2800` → top=3000mm
- `roof: 3000` → top=3200mm
- `foundation: -500` → top=-300mm

**Πρόβλημα**: Στο Revit `ceiling Level = 3000` ΣΗΜΑΙΝΕΙ "top of ceiling slab at 3000". Στον δικό μας κώδικα `elevation=2800` ΣΗΜΑΙΝΕΙ "bottom of ceiling slab at 2800" (που γεωμετρικά είναι ίδιο, αλλά **semantically αντίστροφο**).

Όταν ένας Revit power-user διαβάζει `slab.elevation = 2800` θα το ερμηνεύσει ως Level = top face = 2800 → λάθος ύψος ορόφου.

#### **Wall limitation**:
Δεν υπάρχει `baseElevation` / `baseOffset` field. Ο τοίχος είναι hardcoded από z=0. **Δεν υποστηρίζει**:
- Multi-level buildings (κάθε όροφος με δικό του wall set σε διαφορετικό z)
- Wall πάνω σε structural slab (base offset = slab thickness)
- ADR-358 (Stair ↔ Floor linking) future requirement: stairs που ανεβαίνουν μεταξύ levels

---

## 2. Decision

**Ευθυγράμμιση με Revit/AutoCAD industry standard για ΟΛΕΣ τις 5 οντότητες.**

### 2.1 Canonical Convention (Post-ADR-369)

| Entity | `levelElevation` semantic | Direction | Override field |
|--------|---------------------------|-----------|-----------------|
| **Slab** (floor/ceiling/roof) | **Top face** (FFL) | hangs DOWN by `thickness` | `heightOffsetFromLevel` (mm, default 0) |
| **Beam** | **Top face** (top-of-beam) | hangs DOWN by `depth` | `zOffset` (mm, default 0) |
| **Wall** | **Base** (bottom) | grows UP by `height` | `baseOffset` (mm, default 0), `topOffset` |
| **Column** | **Base** (bottom) | grows UP by `height` | `baseOffset` (mm, default 0) |
| **Opening** | **Sill** above host wall Level | grows UP by `height` | (unchanged — already Revit-compatible) |

### 2.2 Key Semantic Changes

#### **SLAB** (🔴 BREAKING)
```ts
// BEFORE (current):
readonly elevation: number;  // Bottom face z

// AFTER (ADR-369):
readonly levelElevation: number;  // Top face z (FFL) — Revit-compatible
readonly heightOffsetFromLevel?: number;  // mm, default 0
// Geometry: top = levelElevation + heightOffsetFromLevel
//           bottom = top - thickness
```

**Updated defaults** (`SLAB_KIND_DEFAULT_LEVEL_ELEVATION_MM`):
- `floor: 0` → top=0, bottom=-200 (FFL @ 0)
- `ceiling: 3000` → top=3000, bottom=2800 (storey 3.00m, slab 200mm)
- `roof: 3000` → top=3000, bottom=2800
- `foundation: 0` → top=0, bottom=-500 (foundation 500mm thick under FFL)

#### **WALL** (🟡 ADDITIVE — non-breaking)
```ts
// ADD:
readonly baseElevation?: number;  // mm, default 0 — Base Level z
readonly baseOffset?: number;     // mm, default 0 — raise/drop από Base Level
// Geometry: bottom = baseElevation + baseOffset
//           top = bottom + height
```
Existing walls χωρίς `baseElevation` → fallback 0 (current behavior preserved).

#### **BEAM** (🟢 RENAME — semantic-preserving)
```ts
// RENAME for clarity (no semantic change — already Revit-compatible):
elevation → topElevation
// ADD:
readonly zOffset?: number;  // mm, default 0
```

#### **COLUMN** (🟡 ADDITIVE)
Mirror Wall — `baseElevation`, `baseOffset`, `height`.

#### **OPENING** (✅ NO CHANGE)
`sillHeight` already Revit-compatible (από host wall Level).

### 2.3 Derived Reporting Properties (computed geometry)

Όλες οι entities expose computed reporting params (read-only, ίδιο pattern με Revit):
- **Slab**: `topElevation`, `bottomElevation`
- **Beam**: `topElevation` (= levelElevation), `bottomElevation` (= top - depth)
- **Wall**: `baseElevationActual`, `topElevationActual`
- **Column**: ίδιο με Wall
- **Opening**: `sillElevation` (= hostWall.baseElevation + sillHeight), `headElevation` (= sill + height)

---

## 3. Migration Plan

### Phase A — Type Layer (no runtime impact)
1. Add new fields ως optional (`baseElevation?`, `baseOffset?`, `heightOffsetFromLevel?`, etc).
2. Add `levelElevation` to `SlabParams` ως optional δίπλα στο legacy `elevation`.
3. Update interfaces, defaults constants, JSDoc.

### Phase B — Geometry Layer
4. Update `compute*Geometry()` functions να χρησιμοποιούν νέα fields (με fallback στα legacy).
5. Update bbox computation: slab `bbox.max.z = top`, `bbox.min.z = top - thickness`.
6. Add unit tests για κάθε combination (legacy data + new data).

### Phase C — Data Migration (Firestore)
7. **One-shot migration script** (`scripts/migrate-bim-elevation-adr369.ts`):
   - Slab: `levelElevation = elevation + thickness` (convert bottom→top semantic)
   - Wall/Column: `baseElevation = 0` (set explicitly)
   - Beam: `topElevation = elevation` (rename)
8. Run στο dev → staging → production με backup.
9. Maintain `elevation` field για 1 release ως read-only deprecated alias.

### Phase D — UI Layer
10. Properties panel: rename labels ("Bottom Elevation" → "Top Elevation (FFL)" για slabs).
11. Add "Base Offset" / "Height Offset From Level" inputs.
12. Ribbon Levels tab (ADR-345 context): show derived `topElevation` / `bottomElevation` per entity.

### Phase E — 3D Viewer (ADR-366) Integration
13. 3D extrusion code: update slab extrusion direction (downward από top instead of upward από bottom).
14. Validate με existing test models — ensure visual output ίδιο post-migration.

### Phase F — Documentation
15. Update ADR-363 §5 (entity schemas) με cross-link σε ADR-369.
16. Update ADR-366 §3D rendering με elevation convention reference.
17. Update Properties panel i18n keys (Greek labels).

### Phase G — Cleanup
18. Remove legacy `elevation` field από Slab (after 1 release deprecation window).
19. Remove backward-compat fallbacks σε `compute*Geometry()`.

---

## 4. Consequences

### Positive ✅
- **Industry-standard compliance**: εργαζόμενοι σε Revit/ArchiCAD/AutoCAD Architecture θα κατανοούν τα fields immediately.
- **Multi-level support enabled**: walls/columns με `baseElevation` → multi-storey buildings possible.
- **ADR-358 unblocked**: stair ↔ floor linking μπορεί να βασίζεται σε `levelElevation` ως canonical reference.
- **3D Viewer (ADR-366) consistency**: elevation semantics ίδιες με reference BIM tools.
- **BOQ accuracy**: σαφέστερη απεικόνιση structural slab vs FFL για quantity takeoff.
- **Future Revit/IFC interop**: αν ποτέ προστεθεί IFC import/export, mapping straightforward.

### Negative ⚠️
- **Breaking change** στο Slab semantic → data migration required (mitigated via Phase C script).
- **UI cognitive shift**: existing users που έμαθαν "elevation = bottom" χρειάζονται relearn (mitigated με tooltips + Greek labels).
- **Temporary code complexity**: backward-compat fallbacks κατά τη διάρκεια deprecation window.
- **3D viewer re-validation**: extrusion direction change χρειάζεται regression testing σε ADR-366 test models.

### Neutral 🟦
- Beam: μόνο rename — zero functional change.
- Opening: zero change.
- Existing 2D plan view rendering: μη επηρεαζόμενο (only z-axis semantic affected).

---

## 5. Alternatives Considered

### Alt A — Keep current convention + add aliases
Add computed `topElevation` property χωρίς να αλλάξει το underlying `elevation` field semantic.
- ✅ Pro: no breaking change, no migration
- ❌ Con: keeps inconsistency with industry. Future devs reading code/Firestore docs get confused. Doesn't unblock multi-level.
- **REJECTED** by user request: "ΘΕΛΩ INDUSTRY STANDARD".

### Alt B — Hybrid (slab inverted, others unchanged)
Only invert slab semantic, leave wall/column hardcoded at z=0.
- ✅ Pro: smaller migration
- ❌ Con: still no multi-level support. Half-baked.
- **REJECTED**: completeness over MVP (memory rule `feedback_completeness_over_mvp`).

### Alt C — Full migration (THIS ADR)
- ✅ Pro: Industry-standard, multi-level ready, ADR-358 unblock, clean semantic.
- ❌ Con: largest migration scope, requires Phase C data migration.
- **SELECTED** ✅

---

## 6. Validation Checklist (Phase H — Pre-Commit)

- [ ] All 5 entity types follow canonical convention (§2.1 table)
- [ ] Migration script tested on staging Firestore with backup
- [ ] Unit tests cover: legacy data load, new data load, mixed scene render
- [ ] 3D Viewer (ADR-366) regression: 5 reference scenes render identical pre/post
- [ ] Properties panel labels updated in Greek (i18n keys)
- [ ] ADR-363 §5 cross-references this ADR
- [ ] ADR-366 §3D extrusion section updated
- [ ] Pre-commit checks pass (SSoT ratchet, i18n, file size)
- [ ] User Giorgio explicit approval before Phase C (production migration)

---

## 7. References

### Web Research Sources (Industry Standard)
- [Revit Floor Slab — Modelical](https://www.modelical.com/en/gdocs/floor-creation-in-revit/)
- [Revit Wall Constraints — VDCI](https://vdci.edu/learn/help-center/modifying-top-and-bottom-constraints-for-walls-in-revit)
- [Wall Instance Properties — Autodesk Help](https://help.autodesk.com/view/RVT/2025/ENU/?guid=GUID-ED2045E5-90BF-418F-AAD6-3BB1544F34F5)
- [Beam Elevation at Top/Bottom Z-Offset issue — Autodesk](https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/Revit-Incorrect-Elevation-at-Top-Elevation-at-Bottom-values-at-beams-if-z-offset-value-set.html)
- [Window Sill Height Location — AEC Tech Talk](https://aectechtalk.wordpress.com/2020/12/31/revit-window-sill-height-location/)
- [Custom Sill/Head Heights — VDCI](https://vdci.edu/learn/revit/how-to-create-windows-with-custom-sill-and-head-heights-in-revit)
- [AutoCAD Architecture Walls Tutorial](https://www.autocadforum.eu/index.php/en/autocad-architecture/tutorials-aca/123-walls)
- [AutoCAD Architecture About Levels](https://help.autodesk.com/view/ARCHDESK/2024/ENU/?guid=GUID-67BE542D-88D2-47B4-9C1E-3DF3A5D6BDF6)
- [Floor slab vs. finish — Autodesk Community](https://forums.autodesk.com/t5/revit-architecture-forum/floor-slab-vs-finish/td-p/5849696)

### Internal Code References
- `src/subapps/dxf-viewer/bim/types/slab-types.ts:50-133` — current Slab schema
- `src/subapps/dxf-viewer/bim/types/beam-types.ts:71-178` — current Beam schema
- `src/subapps/dxf-viewer/bim/types/wall-types.ts:58-142` — current Wall schema
- `src/subapps/dxf-viewer/bim/types/opening-types.ts:65-154` — current Opening schema
- `src/subapps/dxf-viewer/bim/geometry/beam-geometry.ts:227-252` — bbox computation
- `src/subapps/dxf-viewer/bim/geometry/wall-geometry.ts:286-315` — bbox computation

### Related ADRs
- ADR-358 (Stair ↔ Floor linking) — blocked on multi-level support
- ADR-362 (Dimension System) — Group O elevation dimensions reference this convention
- ADR-363 (BIM Drawing Mode) — base BIM entity schema
- ADR-366 (3D BIM Viewer) — consumes elevation for extrusion
- ADR-368 (DXF Import Drawing Units) — sceneUnits propagation pattern (mirror for elevation)

---

## 8. Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-05-20 | Giorgio + Claude | Initial ADR — PROPOSED status. Research-backed industry alignment decision. Migration plan Phase A-G. |
| 2026-05-20 | Giorgio + Claude | §9 added — Deep multi-platform research (ArchiCAD, Vectorworks, Allplan, BricsCAD, IFC standard, Revit advanced). Major scope expansion: **Storey System** + Project Base Point/Survey Point distinction + Parametric coupling. Q&A clarification phase initiated. |
| 2026-05-20 | Giorgio + Claude | Q1/Q4/Q6/Q5 answered (Floor entity already exists, FFL Hybrid, signed-number basements with `kind` field, Hybrid binding). Discovery: `floors` + `buildings` collections fully live, gaps in 3D rendering wiring only. |
| 2026-05-20 | Giorgio + Claude | **Q2 answered** — Full Multi-Building (Revit-style + Enterprise). Building.baseElevation + siteOrigin + rotation. Floor.elevation now relative to Building. Indirect BIM→Floor→Building FK chain. 3D viewer per-building visibility/isolation. BOQ group-by-building. |

---

## 9. Deep Industry Research — Multi-Platform Comparison

> **Διεξήχθη 2η, βαθύτερη έρευνα 2026-05-20** σε ArchiCAD, Vectorworks, Allplan, BricsCAD BIM, IFC open standard, και Revit advanced features. Αποτέλεσμα: η αρχική απόφαση (§2) ήταν **σωστή αλλά ΑΝΕΠΑΡΚΗΣ** — χρειάζεται καθολικό **Storey/Level System** ως SSoT, όχι μόνο per-entity fields.

### 9.0 🎉 KEY DISCOVERY — Floor Entity ΗΔΗ Υπάρχει στον Κώδικα

**Έρευνα στον δικό μας κώδικα (2026-05-20, post Q1 user request):**

Η οντότητα `Floor` (όροφος) **υπάρχει ήδη πλήρως υλοποιημένη** ως first-class entity, IFC-compliant (mirroring `IfcBuildingStorey`). Δεν χρειάζεται να την φτιάξουμε — χρειάζεται **wiring** στο BIM Drawing Mode.

#### **Existing Floor Entity** (Production-live)

| Aspect | File / Detail |
|--------|---------------|
| Firestore collection | `floors` (top-level, defined `src/config/firestore-collections.ts:26 FLOORS`) |
| Subcollection alias | `BUILDING_FLOORS` (line 389) |
| Route | `/buildings` → `/src/app/buildings/page.tsx` (lazy-loaded) |
| Detail view | `BuildingDetails.tsx` με `UniversalTabsRenderer` |
| Floors Tab UI | `src/components/building-management/tabs/FloorsTabContent.tsx` (inline CRUD) |
| Tab config | `src/config/building-tabs-config.ts` + `buildingMappings.ts:253-278` |
| Zod schemas | `src/app/api/floors/floors.schemas.ts` (`CreateFloorSchema`, `UpdateFloorSchema`) |
| TypeScript types | `src/app/api/floors/floors.types.ts` (`FloorDocument`, IFC-compliant comment) |
| Mutation gateway | `src/services/floor-mutation-gateway.ts` |
| API handlers | `src/app/api/floors/floors.handlers.ts` (list/create/update/delete) |
| State hook | `src/components/building-management/tabs/useFloorsTabState.ts` |

#### **Existing FloorRecord Fields**
```ts
interface FloorRecord {
  readonly id: string;
  readonly number: number;          // 0=ground, 1=1st, -1=basement
  readonly name: string;            // auto-suggested ("G", "1", "B1") + user-overridable
  readonly elevation: number | null; // **ABSOLUTE z in METRES** (e.g., 0, 3.0, 6.0)
  readonly height: number | null;    // **storey height in METRES** (default 3.0)
  readonly buildingId: string;       // FK to buildings
  readonly projectId?: string;
  readonly companyId: string;        // tenant scope
  readonly units: number;            // unit count (for residential)
  readonly hasFloorplan: boolean;    // has uploaded DXF?
}
```

#### **Existing Behaviors**
- `DEFAULT_STOREY_HEIGHT = 3.0` meters (line 99 `useFloorsTabState.ts`)
- Auto-elevation on floor number change: `elevation = number × 3.0`
- Cascade shift dialog: όταν αλλάζει elevation ενός intermediate floor, ρωτάει αν να shift-αρει και τους από πάνω
- Deletion guards για intermediate floors (warning αν θα δημιουργηθεί κενό)
- Inline create/edit forms (`FloorInlineCreateForm.tsx`)

#### **🔥 Critical: BIM Entities ΗΔΗ Έχουν `floorId` FK**

Τα BIM Firestore documents ΗΔΗ δηλώνουν foreign key προς floors:

| Entity | File | FK Field |
|--------|------|----------|
| Wall | `src/subapps/dxf-viewer/bim/walls/wall-firestore-service.ts:64-80` | `floorId?: string` |
| Slab | `src/subapps/dxf-viewer/bim/slabs/slab-firestore-service.ts:52-68` | `floorId?: string` |
| Opening | (similar pattern) | `floorId?: string` |
| Beam | (similar pattern) | `floorId?: string` |
| Column | (similar pattern) | `floorId?: string` |
| SlabOpening | (similar pattern) | `floorId?: string` |

**Συμπέρασμα**: Η Phase 0 του Migration Plan (§9.9) είναι **ΗΔΗ υλοποιημένη**. Χρειάζεται μόνο:

1. **Wiring** `Floor.elevation` → BIM 3D rendering pipeline (αντί hardcoded z=0)
2. **Semantic clarification**: τι ακριβώς σημαίνει `Floor.elevation`; (FFL ή Top of Structural Slab;) — **Q4 pending**
3. **`offsetFromStorey` field** στις BIM entities για overrides (slabs που "πέφτουν" 50mm για bathroom drain, walls με base offset για να καθίσουν πάνω σε structural slab, etc.)
4. **Unit harmonization**: Floor χρησιμοποιεί **METRES**, BIM entities χρησιμοποιούν **MILLIMETRES** — απαιτείται conversion layer
5. **Multi-building**: ήδη supported (Building → Floor → BIM entities chain). Απαιτείται μόνο verification στο DXF Viewer scene loading

#### **Revised Phase 0 — Wiring, Not Building**

Phase 0 (NEW): Skipped — entity exists. Validation tasks only:
- 0.1 Verify FloorRecord interface stable + complete για ADR-369 needs
- 0.2 Document semantic decision (Q4 pending — FFL vs ToS)
- 0.3 Add reverse-lookup hook: given BIM entity → derive absolute Z via floor lookup
- 0.4 Add `offsetFromStorey` (mm) optional field σε όλες τις BIM entities
- 0.5 Confirm cascade-shift logic στο `useFloorsTabState` works για connected BIM entities (not just elevation values)

### 9.1 Revit (advanced — beyond ADR-369 §1.1)

#### **Project Base Point (PBP) vs Survey Point (SP)**
- **Project Base Point**: origin κτιρίου — συνήθως L1=0. Όλα τα Levels μετριούνται από εδώ by default.
- **Survey Point**: origin τοποθεσίας (σύνδεση με γεωδαιτικό σύστημα, sea level). Χρησιμοποιείται για shared coordinates μεταξύ συνδεδεμένων μοντέλων (π.χ. αρχιτεκτονικό + δομικό + ΜΕP που μοιράζονται site).
- **Level `Elevation Base` parameter**: επιλέγει αν το `Elevation` value στο Level αναφέρεται σε PBP ή σε SP.
- **Site context**: Survey Point επιτρέπει multi-building projects με global coordinates.

#### **Phases, Worksets, Design Options**
- **Phases**: χρονική διαστρωμάτωση (existing → demolition → new construction). Επηρεάζει την ορατότητα entities ανά view (όχι elevation).
- **Worksets**: collaboration partitioning για multi-user. "Shared Levels and Grids" workset auto-created — Levels διαμοιράζονται.
- **Design Options**: εναλλακτικά σενάρια στο ίδιο model — μπορεί να έχουν διαφορετικά elevations για ίδιες entities.

#### **Sloped Floor + Variable Thickness**
- **Modify Sub Elements**: point-by-point height override σε floor → slope.
- **Variable Thickness Layer**: ένα layer του slab assembly γίνεται "variable" → αυτό αναπτύσσεται για να συμπληρώσει slope (π.χ. screed layer).
- **Limitation**: αν roof έχει slope applied → shape-editing disabled (mutually exclusive).
- **Slab Edges**: system families για overhangs / undercuts στις άκρες της πλάκας.

#### **Stair**
- **Base Level + Top Level + offsets** (αντί για explicit risers count — Revit υπολογίζει).
- **Multi-story stairs**: auto-replicate πάνω από Top Level (cycle).
- **Landings**: must be `landing_elevation > stair_base_elevation` (validation error otherwise).
- **Relative Top Height**: alternative manual override για landing positioning.

#### **Roof**
- **Base Level + Base Offset**: σαν τοίχος.
- **Plate Offset from Base**: ύψος όπου wall+roof συναντιούνται (eaves height).
- **Defines Slope edge attribute**: ποια άκρη του footprint είναι slope-defining.
- **Roof by Extrusion**: χρειάζεται Work Plane αναφοράς (όχι Level).

### 9.2 ArchiCAD (Graphisoft)

#### **Stories System**
- **Stories** = ranges of vertical height. Κάθε story έχει **Reference Level** (το οριζόντιο plane στο bottom του range).
- Διαφέρει από Revit Levels: στο Revit Level = γραμμή· στο ArchiCAD Story = εύρος + reference line.

#### **Home Story**
- Κάθε element έχει **Home Story** = το story στο οποίο "ανήκει". Διαφορετικό από elevation.
- **Auto-assignment**: όταν τοποθετείς element, παίρνει το current story του view ως home story.
- **"Relink Home Story"** (right-click): αλλάζει το assignment ΧΩΡΙΣ να αλλάξει το absolute elevation. Παράδειγμα: slab @ z=3000 με Home Story 1 → relink to Home Story 2 → παραμένει @ z=3000 αλλά τώρα μετριέται relative to story 2's reference.
- **"Change Home Story"** (default behavior): μετακινεί τα elements μαζί με το story shift.

#### **Bind to Story Levels**
- Walls/columns: top OR bottom μπορεί να γίνει **link** σε story (όχι absolute z). Όταν αλλάξει το story height, το element auto-stretch.
- **Interior wall convention**: top of structural slab → underside of ceiling slab core. Bases συνήθως @ 0 ή slight negative από story reference.

### 9.3 Vectorworks (Nemetschek)

#### **Stories + Story Levels (introduced 2015)**
- **Story**: container που έχει Layer(s) + Story Levels.
- **Story Levels**: horizontal planes ΑΝΕΞΑΡΤΗΤΑ από layers. Κάθε story έχει multiple levels.
- **Example**: Story "L1" → "Bottom of slab" (offset 0"), "Top of slab" (200mm), "Ceiling" (2800mm).
- **"Level aware" objects**: αντί absolute z, walls/slabs δένουν top/bottom σε story levels.
  - **Παράδειγμα**: wall.bottom = "Top of slab L1", wall.top = "Bottom of slab L2"
  - Αν αλλάξει floor-to-floor height → wall auto-stretches.

#### **Default Story Levels**
- Vectorworks έχει **default story levels** που μπορούν να αντιγραφούν σε νέα stories — pattern reuse για consistency.
- **IFC alignment**: stories είναι το recognized standard για IFC export.

### 9.4 Allplan (Nemetschek)

- **Building Structure**: hierarchical tree (Site → Building → Floor → Element).
- Παρόμοιο pattern με ArchiCAD — floor-based grouping.
- IFC + COBie support για interop.

### 9.5 BricsCAD BIM

#### **Spot Elevation Behavior**
- Spot Elevation tag σε plan view → δείχνει **lower level** του ply (component layer).
- Στο ceiling plan → δείχνει **upper level**.
- WCS (World Coordinate System) absolute reference.

#### **Parametric Coupling**
- Μετακίνηση floor slab → walls που έχουν top/bottom face σε επαφή με slab → **auto-follow**.
- Drag top face of slab UP → upper floor walls SHRINK, lower floor walls EXTEND.
- Παρόμοιο με ArchiCAD bind, αλλά geometry-based (όχι explicit link).

#### **BIMQUICKBUILDING**
- Auto-generation walls/slabs/roofs από block layout + height inputs.
- **Bimify**: auto-classify spaces, walls (external/internal), stories.

### 9.6 IFC Open Standard (buildingSMART)

#### **Spatial Hierarchy** (κρίσιμο για export/import)
```
IfcProject
  └─ IfcSite (γεωδαιτικό origin)
      └─ IfcBuilding
          └─ IfcBuildingStorey (Z elevation)
              └─ IfcWall / IfcSlab / IfcBeam / IfcColumn / IfcOpening
```

#### **IfcLocalPlacement + ObjectPlacement**
- **Every entity** έχει `ObjectPlacement` (συνήθως `IfcLocalPlacement`).
- `IfcLocalPlacement` ορίζει local coordinate system **σχετικά με parent** (μέσω `PlacementRelTo`).
- Αλυσίδα: entity placement → storey placement → building placement → site placement → world.
- **Absolute placement** = αν `PlacementRelTo = null` (rare — μόνο για top-level entities).

#### **IfcBuildingStorey.Elevation**
- Είχε attribute `Elevation` (informational only).
- **🔴 DEPRECATED σε IFC4.3.0.0** — placement είναι το SSOT.
- Σημαντικό για future migration: αν exportάρουμε σε IFC4.3, δεν πρέπει να βασιστούμε σε scalar `elevation` field.

#### **IfcWall / IfcSlab / IfcBeam ObjectPlacement**
- Local coordinate system relative to **storey**.
- Wall: axis along local X-axis (straight) ή tangent-at-start για curved.
- Slab: local XY plane = top face by convention.

#### **Implications for ADR-369**
- Αν θέλουμε **future IFC export/import** (Giorgio αναφέρει "full enterprise"), η αρχιτεκτονική πρέπει να αντικατοπτρίζει αυτό το pattern:
  - **Storey/Level entity** ως SSOT (πρώτης τάξεως, persisted στο Firestore)
  - Entity elevations = relative offsets από parent storey (όχι absolute world z)
  - Storey-level operations: shift, copy, delete cascade

### 9.7 Σύνοψη — Common Pattern Across Platforms

| Feature | Revit | ArchiCAD | Vectorworks | Allplan | BricsCAD | IFC |
|---------|-------|----------|-------------|---------|----------|-----|
| Storey/Level entity | ✅ Levels | ✅ Stories | ✅ Stories | ✅ Floors | ✅ Stories (auto) | ✅ IfcBuildingStorey |
| Per-entity offset from storey | ✅ | ✅ | ✅ | ✅ | partial | ✅ ObjectPlacement |
| Bind top/bottom to level (parametric) | ✅ Top/Base Constraint | ✅ Link to Story | ✅ Story Levels | ✅ | implicit | derived |
| Multi-building per project | ✅ Site + Survey Point | ✅ | ✅ | ✅ | ✅ | ✅ IfcSite+IfcBuilding |
| Slope/sub-elements (slab) | ✅ Modify Sub Elements | ✅ | ✅ | ✅ | ✅ | sub-elements |
| Auto-stretch when storey height changes | partial | ✅ | ✅ | partial | ✅ | derived |

**Universal pattern**: All major platforms use a **3-tier hierarchy**:
1. **Building / Site** (project root)
2. **Storey / Level** (horizontal plane with reference elevation)
3. **Element** (wall/slab/beam/etc) — elevation = `storey_reference + local_offset`

### 9.8 Revised Decision (Supersedes §2)

Το αρχικό §2 πρότεινε per-entity `levelElevation` ως scalar value. **Ανεπαρκές** για full-enterprise. Updated approach:

#### **Storey/Level System (NEW)** — πρωτεύουσα οντότητα
```ts
interface BuildingStorey {
  readonly id: string;
  readonly name: string;             // "L1", "Ισόγειο", "1ος όροφος"
  readonly elevation: number;        // mm από Project Base Point — Top of Structural Slab convention
  readonly floorToFloorHeight: number;  // mm
  readonly buildingId?: string;      // FK to Building (multi-building support)
  readonly index: number;            // ordering (0=ground, 1=1st, -1=basement)
}

interface Building {
  readonly id: string;
  readonly name: string;
  readonly storeyIds: readonly string[];
  readonly siteOrigin?: Point3D;     // optional: world offset για multi-building site
}
```

#### **Per-Entity Reference (REVISED)** — relative to storey
```ts
// All BIM entities (Wall, Slab, Beam, Column, Opening):
interface BimElevationRef {
  readonly storeyId: string;             // FK to BuildingStorey
  readonly offsetFromStorey: number;     // mm — semantic depends on entity type
  // Slab: offset = top face from storey reference (default 0 = at FFL)
  // Beam: offset = top face from storey reference (default 0 = at top of slab)
  // Wall: offset = base from storey reference (default 0 = on top of structural slab)
  // Column: same as Wall
  // Opening: sillHeight already relative to host wall — implicit storey reference
}
```

#### **Computed (read-only) Properties** — exposed στο UI + 3D viewer
- `absoluteTopElevation` (mm από world / PBP)
- `absoluteBottomElevation`
- For Slab: `topFaceZ`, `bottomFaceZ`
- For Wall: `baseZ`, `topZ`
- All derived from `storey.elevation + offsetFromStorey` chain

### 9.9 Updated Migration Plan (Supersedes §3 Phases)

#### **Phase 0 — NEW: Storey/Level Foundation** (additive, non-breaking)
- 0.1 Add `building_storeys` Firestore collection + types
- 0.2 Add `buildings` Firestore collection + types
- 0.3 Default storey auto-creation για existing projects (single storey @ z=0, height=3000mm)
- 0.4 Project Base Point + Survey Point (optional) fields στο Project entity
- 0.5 Service layer: `StoreyService` (CRUD + cascade rules)
- 0.6 UI: Storey manager panel (similar to Revit's Level lines view)

#### **Phase A — Type Layer** (now references storey)
- A.1 Add `storeyId` + `offsetFromStorey` σε όλες τις 5 entities (optional, with default storey fallback)
- A.2 Slab: convert legacy `elevation` → derived (storey + offset)
- A.3 Beam: rename `elevation` → `offsetFromStorey` (semantic: top face offset from storey)
- A.4 Wall/Column: add `offsetFromStorey` (base offset)
- A.5 Opening: unchanged

#### **Phase B-G** as before (geometry, data migration, UI, 3D, docs, cleanup)

#### **Phase H — NEW: Parametric Coupling** (post-MVP, optional Phase 2)
- H.1 Wall top/bottom binding to storey (auto-stretch on height change)
- H.2 BricsCAD-style: drag slab → connected walls follow
- H.3 ArchiCAD-style: "Relink Home Storey" UI action

#### **Phase I — NEW: IFC Export Readiness** (future-proofing)
- I.1 Map internal model → IFC schema (`IfcProject → IfcSite → IfcBuilding → IfcBuildingStorey → elements`)
- I.2 ObjectPlacement chains via storey references (matches IFC pattern out of the box)

### 9.10 Open Questions — Q&A Clarifications

Πριν την υλοποίηση, χρειάζονται διευκρινίσεις από Giorgio (Greek + απλά + παραδείγματα + ένα-ένα):

1. **Q1 — Storey ως οντότητα ή scalar?** ✅ **ANSWERED 2026-05-20**: Επιλογή Α (Revit-style — Floor οντότητα). **Discovery**: Floor entity υπάρχει ήδη πλήρως (§9.0). Δεν χρειάζεται νέα οντότητα — μόνο wiring στο BIM rendering layer.
2. **Q2 — Multi-building support;** ✅ **ANSWERED 2026-05-20**: **Πλήρες Multi-Building (Revit-style) + Full Enterprise**. Project = container πολλαπλών Buildings· κάθε Building έχει δικό του δέντρο ορόφων + δικό του `baseElevation` (για κτίρια σε πλαγιά / διαφορετικά επίπεδα εδάφους).

   **Discovery (2026-05-20)**: ✅ Collection `buildings` ΗΔΗ υπάρχει στο Firestore. ✅ `floor.buildingId` FK ΗΔΗ υπάρχει. ✅ UI tabs `/buildings` ΗΔΗ υποστηρίζει multiple buildings per project. Major gaps λείπουν στο geometry + 3D rendering layer.

   **Schema additions (Building)**:
   ```ts
   interface BuildingRecord {
     id: string;
     projectId: string;                        // FK to project
     name: string;                              // "Κτίριο Α", "Συγκρότημα Β"
     baseElevation: number;                     // METRES — site z offset (default 0)
     baseElevationReference?: 'site' | 'sea-level' | 'street'; // semantic
     siteOrigin?: Point3D;                      // XY offset within site (multi-building layout)
     rotation?: number;                         // degrees — building orientation on site
     phase?: 'planned' | 'permitted' | 'under_construction' | 'completed';
     status?: 'active' | 'archived';
     // existing fields preserved
   }
   ```

   **Geometry semantic**:
   - `Floor.elevation` παραμένει **METRES**, αλλά τώρα ορίζεται **σχετικά με `building.baseElevation`** (όχι absolute z).
   - Computed absolute z: `worldZ = building.baseElevation + floor.elevation`
   - BIM entity `worldZ` resolution chain: `building → floor → entity offset`
   - Έτσι, αν αλλάξει `building.baseElevation` (π.χ. survey correction), ΟΛΟ το κτίριο μετακινείται μαζί

   **BIM entity FK chain (CRITICAL gap to fix)**:
   ```
   Current: Wall.floorId → Floor (no Building link in entity)
   New:     Wall.floorId → Floor.buildingId → Building
            (έμμεση σύνδεση, no schema change on BIM entities)
   ```
   - Walls/Slabs/Beams/Columns/Openings ΔΕΝ χρειάζονται `buildingId` field
   - Resolution function: `getEntityBuilding(entity) = floors[entity.floorId].buildingId`
   - Building filter στο viewer = `entities.filter(e => floors[e.floorId].buildingId === activeBuildingId)`

   **3D Viewer (ADR-366) requirements**:
   - Building visibility toggle (show/hide per building)
   - Building isolation mode (show only one + ghost others)
   - Active building selector (UI dropdown)
   - Per-building section cuts
   - Per-building exploded view

   **BOQ / Cost split**:
   - Reports group by `buildingId` automatically
   - Filter "Κτίριο = Α" → only entities under that building's floors
   - Subcontractor packages per building (concrete crew → only Building Α)

   **Numbering collision handling**:
   - "1ος Όροφος Κτίριο Α" ≠ "1ος Όροφος Κτίριο Β" — αμφότερα valid
   - Display path: `Project → Building → Floor → Entity`
   - URL routing: `/buildings/[buildingId]/floors/[floorNumber]/...`

   **Migration impact**:
   - Existing floors με `elevation` = absolute z → migrate to relative (subtract building.baseElevation, default 0 — no-op)
   - Σε projects με ένα μόνο κτίριο, default `baseElevation=0` διατηρεί existing behavior
   - Zero-downtime: η ανάγνωση resolution chain δουλεύει με `baseElevation ?? 0`

   **Implementation Tasks**:
   - Add `baseElevation`, `baseElevationReference`, `siteOrigin`, `rotation` fields to Building schema + Zod
   - Add `BuildingService.update({ baseElevation })` με cascade refresh στο 3D viewer
   - Add `useEntityBuilding(entityId)` hook για indirect resolution
   - Update DxfToThreeConverter / 3D scene composer να εφαρμόζει `building.baseElevation` offset
   - UI: Buildings tab add "Υψόμετρο βάσης (m)" input + "Αναφορά" dropdown (Site/Sea-level/Street)
   - i18n keys: `building.baseElevation="Υψόμετρο βάσης"`, `building.reference.site="Επίπεδο εδάφους"`, etc.
   - 3D viewer: Building visibility panel + isolation mode
   - BOQ aggregator: group-by buildingId support

3. **Q3 — Project Base Point vs Survey Point;** Χρειάζεται geodetic / sea-level reference, ή αρκεί ένα local origin?
4. **Q4 — Storey reference: FFL ή Top of Structural Slab?** ✅ **ANSWERED 2026-05-20**: **Hybrid A — FFL primary + auto-derived ToS**. `Floor.elevation` = FFL (METRES). New field `Floor.finishThickness` (mm, default 80mm Greek typical). Derived: `topOfStructuralSlab = elevation - finishThickness/1000`. Construction drawings & BOQ auto-generate ToS dimensions. Change of finish (e.g. marble→wood) updates ToS without affecting walls/windows/doors. Rationale: serves full pipeline (design FFL → construction ToS → management FFL) with single user-facing number per storey.
5. **Q5 — Parametric coupling;** ✅ **ANSWERED 2026-05-20**: **Γ — Hybrid με opt-in binding** (Revit pattern). Walls/columns έχουν `baseBinding` + `topBinding` enums. Default = bound (auto-stretch όταν αλλάζει storey height). User μπορεί να uncheck για edge cases (διαχωριστικά μπαρ, πατάρι, εξωτερικός όγκος).

   **Schema additions**:
   ```ts
   // Wall (και Column mirror)
   interface WallParams {
     storeyId: string;                                          // FK to floors
     baseBinding: 'storey-floor' | 'absolute';                  // default 'storey-floor'
     topBinding: 'storey-ceiling' | 'absolute' | 'unconnected'; // default 'storey-ceiling'
     baseOffset: number;        // mm — όταν binding='storey-floor' = offset από FFL· όταν 'absolute' = absolute z
     topOffset: number;         // mm — same semantic
     unconnectedHeight?: number; // mm — μόνο όταν topBinding='unconnected'
   }
   ```

   **UI**:
   - Properties panel: 2 dropdowns ("Βάση", "Κορυφή") + offset inputs
   - Default state on creation = bound (no extra clicks for 95% case)
   - i18n keys: `wall.binding.storeyFloor="Πάνω σε δάπεδο ορόφου"`, `wall.binding.storeyCeiling="Κάτω από επόμενο όροφο"`, `wall.binding.absolute="Συγκεκριμένο ύψος"`, `wall.binding.unconnected="Ελεύθερο ύψος"`

   **Auto-stretch trigger**:
   - `FloorService.update({ height })` → cascade subscriber: όλα τα walls/columns με `topBinding='storey-ceiling'` σε αυτόν τον όροφο → recompute `topZ = floor.elevation + floor.height`
   - Optimistic UI update + Firestore batch write
   - Existing `useFloorsTabState.ts:230-282` cascade logic extends to BIM entities (not just floor elevations)

   **Slab handling**: Slabs έχουν δικό τους semantic (top face = FFL by Hybrid A). Δεν χρειάζονται binding — `storeyId` αρκεί. Sloped slabs (Phase H) θα έχουν sub-element overrides.

   **Beam handling**: Beams `topElevation` = floor.elevation by default. `zOffset` (mm) για drop-from-ceiling cases.

   **Opening (windows/doors)**: Already host-wall-relative (sillHeight από host wall base). No binding needed — implicit through host wall.
6. **Q6 — Negative storeys (basements);** ✅ **ANSWERED 2026-05-20**: Revit + Full Enterprise — όλα είναι Floor entities με signed number (foundation -3, Υ2 -2, Υ1 -1, Ground 0, 1, 2, ...). New `kind` field για semantic categorization (foundation/basement/ground/standard/roof/mezzanine).

   **Code Investigation Findings (2026-05-20)**:
   ✅ **Already supported**:
   - Negative `number` Zod-allowed (`floors.schemas.ts:4,17` — no min() constraint, elevation range -999 to +9999)
   - Auto-name generation Greek+English fully working (`src/lib/intl-domain.ts:20-35`): 0→"Ισόγειο", -1→"Υπόγειο", -2→"2ο Υπόγειο", 1→"1ος Όροφος"
   - Auto-elevation `number × 3.0` works for negatives (`useFloorsTabState.ts:99-104`): -1→-3.00m
   - Cascade-shift logic signed-delta-correct για basements (`useFloorsTabState.ts:230-282`)
   - i18n keys exist για "Ισόγειο", "Υπόγειο", "Υπόγειο 2" (`el/building-storage.json:99-111`)
   - UI input accepts negatives (placeholder "π.χ. -1, 0, 1" — `FloorInlineCreateForm.tsx:268-276`)
   - Client-side contiguity warning (`FloorInlineCreateForm.tsx:216-221`, non-blocking)

   ❌ **Gaps for ADR-369 implementation**:
   - **`kind` field missing** — cannot distinguish foundation/basement/ground/standard/roof/mezzanine
   - i18n keys missing: "Θεμέλια" (Foundation), "Δώμα" (Roof), "Μεσοπάτωμα" (Mezzanine)
   - Server-side contiguity enforcement missing (only client warns)
   - No "mandatory ground floor" rule
   - No special handling για roof (no FFL needed) ή mezzanine (partial coverage)

   **ADR-369 Implementation Tasks**:
   - Add `kind: 'foundation' | 'basement' | 'ground' | 'standard' | 'roof' | 'mezzanine'` to FloorRecord + Zod schema
   - Auto-infer `kind` from `number` (number<-1 + lowest = foundation; number<0 = basement; number=0 = ground; standard otherwise) με user override
   - Add i18n keys: floor.kind.foundation="Θεμέλια", floor.kind.roof="Δώμα", floor.kind.mezzanine="Μεσοπάτωμα"
   - Per-kind defaults:
     - `foundation`: `finishThickness = null` (raw concrete), no walls above, `height` auto from soil depth
     - `basement`: full finishThickness, mechanical equipment flag optional
     - `ground`: standard finishThickness, "patio access" flag optional
     - `standard`: residential default (`finishThickness: 80mm`)
     - `roof`: `finishThickness = null` (no FFL), drainage flags
     - `mezzanine`: partial outline (subset of parent floor footprint)
   - Auto-template on new Building: Foundation @ lowest + Ground @ 0 + Roof @ top (user can add intermediate)
7. **Q7 — Sloped slabs / variable thickness;** Στην MVP φάση τα υποστηρίζουμε, ή είναι post-MVP;
8. **Q8 — IFC export readiness;** Σχεδιάζουμε για future IFC export τώρα (επηρεάζει schema), ή το αφήνουμε για μετά;
9. **Q9 — Naming convention storeys;** Default ονόματα ("L1", "Ισόγειο", "1ος όροφος") + user override; Auto-renumber όταν προστίθεται basement;
10. **Q10 — Existing Firestore data;** Πόσα production projects έχουν ήδη BIM data; Migration script πρέπει να είναι zero-downtime;

---

## 10. References (Extended — Deep Research 2026-05-20)

### ArchiCAD
- [Stories in Archicad — Graphisoft Community](https://community.graphisoft.com/t5/Getting-started/Stories-in-Archicad/ta-p/303954)
- [How to change home story without changing elevation](https://community.graphisoft.com/t5/Modeling/How-to-change-home-story-without-changing-height-elevation/td-p/175987)
- [Adjusting Wall Reference Lines — ARCHICAD Training](https://archicadtraining.com/topic/adjusting-wall-reference-lines-and-settings-split-level-and-multi-story-options/)

### Vectorworks
- [Setting up the building structure with stories](https://app-help.vectorworks.net/2022/eng/VW2022_Guide/Structure/Setting_up_the_building_structure_with_stories.htm)
- [Levels, Layers & Stories Tutorial (PDF)](https://www.vectorworks.net/assets/files/design_summit/1437496508xVpClLn3s6.pdf)
- [Concept: Stories and story-aware objects](https://app-help.vectorworks.net/2023/eng/VW2023_Guide/Structure/Concept_Stories_and_story-aware_objects.htm)

### Revit Advanced
- [Project Base Point vs Survey Point — BIM Pure](https://www.bimpure.com/blog/13-tips-to-understand-revit-base-points-and-coordinate-system)
- [Coordinates in Revit — Modelical](https://www.modelical.com/en/coordinates-in-revit/)
- [Floor with Slope AND Variable Thickness — Autodesk](https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/Model-a-floor-with-multiple-slopes-and-a-variable-thickness-in-Revit.html)
- [Revit Stairs — Adjust Levels and Landings — MGFX](https://mgfx.co.za/blog/building-architectural-design/revit-stairs-adjust-levels-and-landings/)
- [Roof Instance Properties — Autodesk](https://knowledge.autodesk.com/support/revit-lt/learn-explore/caas/CloudHelp/cloudhelp/2017/ENU/RevitLT-Model/files/GUID-A5745932-897D-4F28-85B8-F5B70BB661DD-htm.html)

### IFC Open Standard
- [IfcBuildingStorey — IfcOpenShell](https://ifcopenshell.github.io/docs/rst_files/class_ifc4_1_1_ifc_building_storey.html)
- [IFC4.3 IfcBuildingStorey schema](https://github.com/buildingSMART/IFC4.3.x-development/blob/master//docs/schemas/core/IfcProductExtension/Entities/IfcBuildingStorey.md)
- [IfcLocalPlacement — IfcOpenShell](https://ifcopenshell.github.io/docs/rst_files/class_ifc4x1_1_1_ifc_local_placement.html)
- [IFC coordinate system — BibLus](https://biblus.accasoftware.com/en/ifc-coordinate-system/)
- [IfcWallStandardCase — IFC4.3](http://www.bim-times.com/ifc/IFC4_3/buildingsmart/IfcWallStandardCase.htm)

### BricsCAD BIM
- [Spot elevation level — Bricsys Help](https://help.bricsys.com/en-us/document/bricscad-bim/design-documentation/spot-elevation-level)
- [Slabs and levels — BricsCAD Forum](https://forum.bricsys.com/discussion/40144/slabs-and-levels)
- [BIMQUICKBUILDING — Bricsys](https://help.bricsys.com/document/CMD_bimquickbuilding/V23/EN_US)

### Allplan
- [Allplan by Nemetschek overview — Bimshares](https://bimshares.com/blog/allplan-by-nemetsche/)

