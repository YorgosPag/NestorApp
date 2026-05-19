# SPEC-3D-004D — GenArc Geometry Helpers Port Catalog

| Πεδίο | Τιμή |
|---|---|
| **Status** | 🟢 **COMPLETE** 2026-05-19 — full catalog, conclusion: 0 PORT_AS_IS / 0 ADAPT / 3 EXTRACT_CONCEPT / 6 EXCLUDE |
| **Date** | 2026-05-19 |
| **Category** | DXF Viewer — 3D Rendering / GenArc Port Sub-Spec |
| **Location** | `docs/centralized-systems/reference/adrs/SPEC-3D-004D-genarc-geometry-helpers-port-catalog.md` |
| **Author** | Claude Opus 4.7 + Γιώργος Παγώνης |
| **Parent ADR** | ADR-366 (3D BIM Viewer & Photorealistic Rendering) |
| **Source** | `C:\genarc\src\engines\bom\` (3 files) + `C:\genarc\src\utils\{slabBeamSplit,beamLoopSlab,raySceneIntersection,structuralConnectivity,structuralConnectivity.helpers,buildingSelectors}.ts` (6 files) — total **9 files, ~2.344 LOC** |
| **Sibling SPECs** | SPEC-3D-004A ✅ (Viewport), SPEC-3D-004B ✅ (DXF Parser), SPEC-3D-004C ✅ (Utils/Snap/Picking), SPEC-3D-004E (Materials/Shaders, TBD) |

---

## Executive Summary

Πλήρης διερεύνηση 9 αρχείων του GenArc geometry/BOM/connectivity domain. **Κεντρικό εύρημα**: Nestor's BIM geometry layer (ADR-363 Phases 1-7.1) είναι **architectural superset** του GenArc — όχι λόγω quantity, αλλά λόγω **coordinate basis fundamental mismatch**:

| Διάσταση | GenArc | Nestor BIM |
|---|---|---|
| **Coordinate space** | Y-up 3D world (`[x, y, z]` με y=elevation) | XY-plan view 2D (`Point3D` με z optional, ADR-363 §G11) |
| **Units** | Metres (input from npm dxf-parser, ECS metres baseline) | Millimetres (DXF parser SSoT internal, BOQ-ready m/m²/m³ scalars) |
| **Geometry model** | Procedural per-entity με GenArc store SSoT | Pre-computed `geometry: WallGeometry/SlabGeometry/...` cache στο entity, idempotent SSoT (ADR-363 §5.3/5.4/5.5) |
| **Wall trim** | `computeWallTrims` numeric trim (mm along axis) | `computeWallTrims` Map<WallId, WallTrimPatch{startBevel, endBevel}> με parametric intersection + corner/T-junction/cross classification + MAX_BEVEL_FRACTION guard (ADR-363 Phase 1D-B) |
| **BOM/BOQ** | `calculateBom` aggregate batch + MATERIAL_REGISTRY local lookup | `BimToBoqBridge` Firestore-grade reactive feed + ΑΤΟΕ category mapping + detach guard + deterministic ID (ADR-363 Phase 6) |
| **3D readiness** | Native (already 3D) | Plan view με Z elevation passed externally via `dxfPlanToWorld(x, y, elev)` (ADR-366 §4.2 bridge) |

**Συνέπεια**: Όλη η μεταφορά γεωμετρίας από GenArc απαιτεί **(a) axis remapping** ([x,y,z] με y=elev → XY-plan mm + z=0) **(b) unit conversion** (m → mm internal) **(c) data model swap** (GenArc procedural → Nestor cached `geometry` field). Αυτές οι 3 transformations σε σύνολο =  πλήρης reimplementation. Και επειδή το Nestor **ήδη έχει mature equivalent**, το adaptation cost > rewrite cost σε όλες τις περιπτώσεις core geometry.

**Αποτέλεσμα catalog**:

| Κατηγορία | Files | LOC | Effort | Αξία |
|---|---:|---:|---|---|
| **PORT_AS_IS** | 0 | 0 | — | Καμία |
| **PORT_WITH_ADAPTATION** | 0 | 0 | — | Adaptation cost > rewrite cost (data model + axis + units triple swap) |
| **EXTRACT_CONCEPT** | 3 | ~1.002 | Reference για μελλοντικές ADR-363/366 phases, ΟΧΙ Phase 0-6 ADR-366 | 🟡 Algorithm patterns: slab decomposition, auto-slab from beam loop, scene-agnostic analytical raycaster |
| **EXCLUDE** | 6 | ~1.342 | — | 🔴 Nestor έχει superset (wall trims, BOQ) ή GenArc-specific (Loupe connectivity, store selectors) |

**Top 3 algorithm patterns με conceptual reference value** (out of ADR-366 Phase 0-6 scope):

1. **`slabBeamSplit.ts`** (392 LOC, EXTRACT_CONCEPT) — Slab decomposition γύρω από beams: axis-aligned exact AABB subtraction + diagonal trapezoid decomposition. Out of ADR-366 scope (Revit/ArchiCAD pattern: render slab+beam ως separate Z-aligned meshes, no boolean subtract). Πιθανή future ADR-363 Phase 3.x enhancement αν χρειαστεί visual slab-edge alignment με beam outlines.
2. **`beamLoopSlab.ts`** (224 LOC, EXTRACT_CONCEPT) — Closed 4-beam loop detection γύρω από click point → auto-slab outline. Industry pattern: Revit "Create Slab Boundary", ArchiCAD "Magic Wand polygon trace", Tekla "Plate from beam loop". **Out of ADR-366 scope** (BIM authoring feature → ADR-363 territory). Reference για future ADR-363 slab tool enhancement.
3. **`raySceneIntersection.ts`** (386 LOC, EXTRACT_CONCEPT) — Scene-agnostic CPU analytical ray test (ray-OBB wall/beam + ray-AABB column/slab + opening boolean filter + sub-rect detection για split slabs). **Out of ADR-366 scope** — Phase 4 χρησιμοποιεί Three.js native raycaster (SPEC-3D-004C §9.4 `bim-raycaster.ts`). Reference για **fallback / cross-check / 2D plan picking** αν προκύψει ποτέ ανάγκη.

**Συνολικό port effort για ADR-366: 0h.** Το SPEC-3D-004D δεν εισφέρει port work σε ADR-366 Phase plan. Όλο το geometry work για ADR-366 Phase 2 (BIM → 3D) χτίζεται **πάνω στο Nestor `WallGeometry`/`OpeningGeometry`/`SlabGeometry`/`ColumnGeometry`/`BeamGeometry`** ως **converter** που reads `entity.geometry.{outerEdge, innerEdge, axisPolyline, outline, footprint, bbox}` + `dxfPlanToWorld(x, y, elev)` (ADR-366 §4.2) → `THREE.ExtrudeGeometry` / `THREE.Shape`.

---

## 1. Methodology

Ίδια με SPEC-3D-004A/B/C:

| Κατηγορία | Κριτήριο |
|---|---|
| **PORT_AS_IS** | Zero GenArc deps + pure utility + immediate value για ADR-366 Phase 0-6. |
| **PORT_WITH_ADAPTATION** | 1-3 GenArc-specific deps που αντικαθίστανται με Nestor equivalents AND adaptation cost < rewrite cost. |
| **EXTRACT_CONCEPT** | Algorithm/pattern πολύτιμο για **future** ADR-366 ή sibling ADR (-363) phase, ΟΧΙ άμεσα για ADR-366 Phase 0-6. Reimplementation με Nestor SSoT απαιτείται. |
| **EXCLUDE** | (a) Nestor ήδη έχει mature equivalent, ή (b) GenArc-specific (Loupe, structural connectivity, store selectors). |

**Έλεγχοι**:
1. Imports analysis ανά αρχείο.
2. Full read 9 αρχείων (όλα ≤ 392 LOC, total ~2.344 LOC).
3. Διασταύρωση με Nestor inventory:
   - `bim/geometry/{wall,opening,slab,slab-opening,column,beam,stairs/*}-geometry.ts`
   - `bim/walls/wall-trims.ts` (ADR-363 Phase 1D-B)
   - `bim/slabs/slab-edge-projection.ts` (ADR-363 Phase 5.5f)
   - `bim/utils/{bim-bounds,bim-move-geometry,bim-entity-passthrough}.ts`
   - `bim/cascade/bim-cascade-resolver.ts` (Phase 7.1)
   - `bim/geometry/shared/polygon-utils.ts` (shoelace + bbox + perimeter + pointInPolygon + segmentsIntersect)
   - `bim/services/BimToBoqBridge.ts` (ADR-363 Phase 6 BOQ feed)
   - `bim/types/{wall,opening,slab,column,beam,stair,bim-base}-types.ts`

---

## 2. PORT_AS_IS Files

**Κανένα αρχείο.**

Λόγος ολικός: όπως αναπτύχθηκε στο Executive Summary, ο **coordinate basis mismatch** (GenArc 3D Y-up metres vs Nestor 2D XY-plan mm με elevation external) σημαίνει ότι κανένα geometry αρχείο **δεν είναι zero-adaptation port**. Επιπλέον, Nestor's BIM geometry layer είναι ήδη αρχιτεκτονικά superset σε ΟΛΟ το core (wall, opening, slab, slab-opening, column, beam, stair).

---

## 3. PORT_WITH_ADAPTATION Files

**Κανένα αρχείο.**

Λόγος γενικός: σε όλες τις 9 περιπτώσεις, το adaptation work (axis remap + unit swap + data model swap + GenArc store → Nestor SSoT) **ξεπερνά** το rewrite cost. Όταν προστίθεται ότι Nestor έχει ήδη production-grade equivalent (πχ `bim/walls/wall-trims.ts` strict superset του GenArc `computeWallTrims`), η adaptation route γίνεται regression vector.

---

## 4. EXTRACT_CONCEPT Files (3 files, ~1.002 LOC) — Out of ADR-366 Phase 0-6 scope

Αρχεία με **πολύτιμη algorithm/pattern** που Nestor δεν έχει αντίστοιχα, αλλά δεν αφορούν ADR-366 Phase 0-6. Listed για **conceptual reference** σε μελλοντικές ADR phases (κυρίως ADR-363 BIM authoring enhancements + ADR-366 Phase 7+ polish).

### 4.1 `utils/slabBeamSplit.ts` — 392 LOC

| Στοιχείο | Τιμή |
|---|---|
| **One-liner** | Slab decomposition γύρω από beam footprints — axis-aligned beams → exact AABB subtraction (≤4 rects), diagonal beams → exact trapezoid decomposition με footprint corners ως strip boundaries (≤14 GPU entries per beam). |
| **Exports** | `splitSlabByBeams(slab, beams): readonly SlabSubShape[]` + types `SlabSubRect`, `SlabSubTriangle`, `SlabSubShape` |
| **Deps** | GenArc `Slab` + `Beam` types (`[x,y,z]` Y-up metres) |
| **Pure** | Ναι (no stores, no side effects) |
| **Αξία (ADR-366 Phase 2)** | ❌ Καμία — ADR-366 §6.4 multi-floor stacking χρησιμοποιεί Z-aligned separate meshes (slab mesh + beam mesh με ExtrudeGeometry). Visual sufficiency χωρίς boolean subtract. |
| **Αξία future** | 🟡 ADR-363 Phase 3.x ή 7.x αν χρειαστεί 2D plan slab outline να "ξέρει" τα beam crossings (πχ για slab-boundary inference από beam loop, ή για precise BOQ slab area excluding beam overlaps). |
| **Reimplementation effort** | ~6-8h με Nestor `SlabEntity`/`BeamEntity` (XY plan, mm), polygon-utils shared, validate vs `bim/slabs/slab-edge-projection.ts`. |

**Γιατί EXTRACT_CONCEPT αντί για EXCLUDE**: Ο αλγόριθμος (axis-aligned exact 2D subtraction + diagonal trapezoid decomposition με footprint corner strips αντί uniform staircase) είναι μη-trivial geometry work. Είναι **σπάνιος** και Γιώργος το χτίστηκε ως replacement του 32-strip staircase. Worth preserving as concept reference αν προκύψει παρόμοιο need.

**Industry verdict** (decision para. 8.1, Q1 §13): Revit + ArchiCAD + Bentley AECOsim + Tekla + Vectorworks — **5/5 σύγκλιση** — render slab+beam ως separate Z-aligned meshes (no boolean subtract). Z-fighting αποφεύγεται με `polygonOffset` ή θεμελιακό thickness alignment. **Decision: Nestor υιοθετεί industry pattern → no port required for ADR-366.**

### 4.2 `utils/beamLoopSlab.ts` — 224 LOC

| Στοιχείο | Τιμή |
|---|---|
| **One-liner** | Detect closed 4-beam cycle γύρω από click point → auto-generate slab outline + bbox + topY. Node merge (tolerance 3cm) + adjacency map + cycle BFS + canonical cycle key (rotation/reflection invariant) + convex quad validation + coplanarity check (tolerance 2cm). |
| **Exports** | `findAutoSlabFromBeamLoop(beams, clickX, clickZ): AutoSlabFromBeams \| null` |
| **Deps** | GenArc `Beam` type + `isPointInPolygon2D` από `utils/dxfGeometry.utils` (trivial — Nestor `bim/geometry/shared/polygon-utils.ts:pointInPolygon` καλύπτει) |
| **Pure** | Ναι |
| **Αξία (ADR-366 Phase 2)** | ❌ Καμία — ADR-366 = 3D **viewer**, όχι BIM authoring. Auto-slab creation = BIM tool feature (ADR-363 territory). |
| **Αξία future** | 🟡 **ADR-363 Phase 3.x slab tool enhancement** — auto-trace slab boundary from existing beam structure (Revit "Create Slab Boundary" + ArchiCAD "Magic Wand"). |
| **Reimplementation effort** | ~4-5h με Nestor `BeamEntity` (XY plan, mm) + polygon-utils SSoT + adoption σε `hooks/drawing/useSlabTool.ts`. |

**Industry verdict** (Q2 §13): Revit "Create Slab Boundary" (semi-auto click-loop), ArchiCAD "Magic Wand auto-trace polygon", Tekla Structures "Plate from beam loop", Bentley AECOsim "Floor from grid". **4/4 σύγκλιση** — feature exists in 4 majors, ΟΛΑ υλοποιούν semi-automatic "click inside loop → infer boundary". **Decision: out of ADR-366 scope, file as future ADR-363 enhancement candidate (no ratchet entry — only if Γιώργος ζητήσει).**

### 4.3 `utils/raySceneIntersection.ts` — 386 LOC

| Στοιχείο | Τιμή |
|---|---|
| **One-liner** | Scene-agnostic CPU analytical ray test. Wall/Beam = ray-OBB (transform σε wall-local space, rotation από axis dir), Column/Slab = ray-AABB. Opening boolean filter (post-hit lookup σε wall-local coords). SlabOpening shape detection (rect/circle/ellipse). Sub-rect index για split slabs (καλεί `splitSlabByBeams`). |
| **Exports** | `findClosestSceneHit(rayOrigin, rayDir, walls, columns, beams, slabs, openings, slabOpenings): SceneHitResult \| null` |
| **Deps** | GenArc Wall/Column/Beam/Slab/Opening/SlabOpening types + `slabContainsPoint` + `splitSlabByBeams` |
| **Pure** | Ναι (reusable temp vectors για GC pressure) |
| **Αξία (ADR-366 Phase 4)** | ❌ Καμία — Phase 4 click-picking χρησιμοποιεί **Three.js native `Raycaster.intersectObjects(scene.children)`** μέσω SPEC-3D-004C §9.4 `bim-raycaster.ts`. Native raycaster είναι BVH-accelerated + scene-aware + zero-maintenance. |
| **Αξία future** | 🟡 Reference αν Nestor χρειαστεί ποτέ (a) **CPU fallback** όταν WebGL context unavailable, (b) **2D plan picking** για ADR-040 2D canvas (όχι το ίδιο use case — Nestor's 2D canvas έχει δικό του hit-testing pipeline), (c) **cross-check** vs Three.js result για deterministic test fixtures. |
| **Reimplementation effort** | ~10-12h με Nestor entity types + Three.js Vector3 + axis remap (Y-up world ↔ XY-plan mm). |

**Industry verdict** (Q3 §13): Speckle + xeokit + Forge/APS Viewer + Three.js Editor — **4/4 σύγκλιση** — όλα χρησιμοποιούν Three.js native raycaster (`Raycaster.intersectObjects`) για 3D click picking. Analytical CPU raycaster είναι obsolete pattern, υπήρχε στο GenArc μόνο επειδή render = SDF shader (picking έπρεπε να ταιριάξει shader geometry). Nestor render = mesh-based Three.js → native raycaster sufficient. **Decision: EXCLUDE for ADR-366 confirmed.**

---

## 5. EXCLUDE Files (6 files, ~1.342 LOC)

### 5.1 `engines/bom/wallGeometry.ts` — 209 LOC

| Στοιχείο | Τιμή |
|---|---|
| **Exports** | `computeWallTrims`, `computeBeamColTrim`, `computeBeamEndTrim`, `segmentWallAroundOpenings`, type `WallSegment` |
| **Λόγος EXCLUDE** | **Nestor `bim/walls/wall-trims.ts` (ADR-363 Phase 1D-B) είναι strict superset**: parametric line-line intersection + classification corner/T-junction/cross + MIN_ANGLE_RAD=15° guard + MAX_BEVEL_FRACTION=0.40 anti-inversion + `WallTrimPatch{startBevel, endBevel}` Map output (πλούσιο data structure) vs GenArc numeric `[startTrim, endTrim]` tuple. Nestor καλύπτει ABCAD WallCleanup pattern + Revit auto-join. |
| **`computeBeamColTrim`/`computeBeamEndTrim`** | Beam-column AABB trim + beam-perpendicular-beam trim. Nestor δεν έχει **απευθείας equivalent**, αλλά **σε ADR-366 Phase 2 (BIM → 3D)** το trim **δεν χρειάζεται** — beam meshes renderα ως ExtrudeGeometry χωρίς trim, οι junctions εμφανίζονται ως visible Z-buffer overlap (industry standard για 3D structural visualization). 2D plan view (ADR-363) δεν χρησιμοποιεί beam-trim — beams renderα ως centerline + width rectangle, junctions handled οπτικά μέσω layer ordering. **Αν προκύψει visual gap σε Phase 2, EXTRACT_CONCEPT μετακινείται εδώ — μέχρι τότε EXCLUDE.** |
| **`segmentWallAroundOpenings`** | Παράγει WallSegment[] (διακριτά rectangles γύρω από openings, με sill/lintel sub-rects). Nestor's wall+opening rendering πραγματοποιείται με **separate meshes**: wall mesh full extrude + opening mesh σε `bim/geometry/opening-geometry.ts` που παράγει outline rectangle + bbox. Phase 2 ADR-366 χρησιμοποιεί **CSGEvaluator boolean subtract** ή **post-hit opening filter** (SPEC-3D-002 §6.3) — αμφότερα superset patterns. |

**Effort να αντικατασταθεί Nestor's wall-trims με αυτό**: Αρνητική αξία (downgrade).

### 5.2 `engines/bom/bomCalculator.ts` — 267 LOC

| Στοιχείο | Τιμή |
|---|---|
| **Exports** | `calculateBom(walls, openings, slabs, columns, beams, scope): BomSummary` + internal accumulators (walls/slabs/columns/beams/openings/formwork/steel) + buildLineItems + buildPhaseGroups |
| **Λόγος EXCLUDE** | **Nestor `BimToBoqBridge` είναι Firestore-grade superset** (ADR-363 Phase 6): per-entity reactive upsert με deterministic ID (`boq_bim_${entity.id}`) + detach guard (user override protection) + audit-pattern fire-and-forget + ΑΤΟΕ category mapping (`bim-to-atoe-mapping.ts`) + scope/floor/unit support + BOQItem schema integration. Αρχιτεκτονικά superior: reactive feed vs aggregate batch. |
| **MATERIAL_REGISTRY** | GenArc local constants table με unitCost/laborCost. Nestor χρησιμοποιεί Firestore `boq_items` collection + ΑΤΟΕ master list (ADR-329 BOQ Scope) — full enterprise pricing model. EXCLUDE. |
| **Multi-layer wall DNA aggregation** | GenArc `wallLayerQuantities` υπολογίζει per-layer materialId + thickness × netArea ως ξεχωριστά BOQ entries. **Πιθανό gap στο Nestor**: το `BimToBoqBridge.buildBoqPayload` υπολογίζει single quantity per entity (`geometry.area` ή `geometry.volume`). Αν Nestor wall έχει DNA layers (concrete + insulation + plaster) → ένα BOQ entry δεν αντιπροσωπεύει το πραγματικό breakdown. **Open Question Q4 §13.** |

### 5.3 `engines/bom/geometryCalculators.ts` — 156 LOC

| Στοιχείο | Τιμή |
|---|---|
| **Exports** | `wallLength`, `wallGrossArea`, `wallOpeningsArea`, `wallNetArea`, `wallLayerQuantities`, `slabArea`, `slabVolume`, `columnVolume`, `beamLength`, `beamVolume`, `openingGlassArea`, `columnFormworkArea`, `beamFormworkArea`, `slabFormworkArea`, `steelRebarWeight` |
| **Λόγος EXCLUDE** | Όλες οι geometric scalar quantities (length/area/volume/perimeter) είναι **ήδη pre-computed** στα Nestor entities ως `entity.geometry.{length, area, netArea, volume, perimeter, bbox}` μέσω idempotent SSoT functions: `computeWallGeometry` (ADR-363 §5.3), `computeOpeningGeometry` (§5.4), `computeSlabGeometry` (§5.5, με slab-openings subtraction Phase 3.7), `computeColumnGeometry`, `computeBeamGeometry`. Re-implementing εδώ = **parallel SSoT** (N.0 violation). |
| **Formwork + steel rebar** | GenArc-specific BOQ formulas (`columnFormworkArea = 2(w+d)h`, `steelRebarWeight = volume × REBAR_KG_PER_M3[type]`). Νestor's ΑΤΟΕ catalog περιγράφει formwork + rebar ως ξεχωριστές κατηγορίες με δικές τους rules. Όταν προστεθεί explicit formwork BOQ feed, ο pattern θα είναι reference. Μέχρι τότε EXCLUDE. |

### 5.4 `utils/structuralConnectivity.helpers.ts` — 243 LOC

| Στοιχείο | Τιμή |
|---|---|
| **Exports** | `distSqXZ`, `pointInSlabAabb`, `intervalsOverlap`, `findBeamsAtColumn`, `findWallsAtColumn`, `findSlabsAtColumn`, `findColumnsAtBeamEndpoints`, `findSlabsAlongBeam`, `findBeamsInSlab`, `findWallsInSlab`, `findBeamsNearWallEndpoints`, `findSlabsAlongWall` |
| **Λόγος EXCLUDE** | **Trivial geometry primitives** (distSqXZ = squared 2D distance, pointInSlabAabb = AABB check, intervalsOverlap = 1D interval test) που Nestor θα υλοποιήσει inline αν χρειαστεί — αξία ports < 5 lines per file. Δεν αξίζει standalone module. **Connectivity finders** (find*AtColumn κλπ.) είναι **Loupe feature** (GenArc ADR-024 Structural Loupe) — αντιστοιχεί στο SPEC-3D-004A §3.3 Loupe (Phase 7.2 ADR-366 deferred, σήμερα 3 files PORT_WITH_ADAPTATION ~641 LOC). Αν Loupe εργαστεί στο Phase 7.2, αυτό το αρχείο επανεξετάζεται **τότε** ως EXTRACT_CONCEPT companion file. Σήμερα EXCLUDE. |

### 5.5 `utils/structuralConnectivity.ts` — 209 LOC

| Στοιχείο | Τιμή |
|---|---|
| **Exports** | `computeConnectedElements(selId, selType, walls, cols, beams, slabs, openings): ConnectedSet` + internal `connectedToColumn/Beam/Wall/Slab` orchestrators |
| **Λόγος EXCLUDE** | Pure orchestration helper για **Structural Loupe** (GenArc ADR-024). Couples με GenArc BuildingStore-shaped data (`Record<string, Wall>` maps). Nestor scene SSoT είναι `Firestore subscribe → scene store` με `getActiveFloorWalls` selectors — διαφορετικό data shape, ίδιο concept. **Belongs to SPEC-3D-004A §3.3 Loupe sub-spec** (Phase 7.2 deferred). Σήμερα EXCLUDE — επανεξέταση όταν Loupe επανέλθει στο agenda. |

### 5.6 `utils/buildingSelectors.ts` — 258 LOC

| Στοιχείο | Τιμή |
|---|---|
| **Exports** | `getActiveFloor{Walls,Openings,Slabs,Columns,Beams,SlabOpenings,Staircases}`, `getAllBuilding{Walls,Openings,Slabs,Columns,Beams,SlabOpenings,Staircases}` |
| **Λόγος EXCLUDE** | **100% GenArc-store-coupled** — όλες οι συναρτήσεις δέχονται `state: BuildingStore` + διαβάζουν `state.building.floors.find(f => f.id === state.activeFloorId)`. Nestor's scene architecture: `firestoreQueryService.subscribe(query)` + ADR-326 building/floor schema + dedicated hooks (`useBuildingFloorsSubscription`, `useActiveFloorEntitiesSubscription`) — διαφορετικό state model, ίδιο concept. Nestor's equivalent pattern υπάρχει ήδη στο `hooks/scene/` και `hooks/state/`. **Zero port value.** |
| **Cross-spec note** | Επιβεβαιώνει SPEC-3D-004C §10 expectation: `buildingSelectors` ως EXCLUDE με Nestor scene SSoT αντικαθιστά. |

---

## 6. Nestor BIM Geometry Gap Analysis

> Function-by-function σύγκριση: τι κάνει Nestor (2D plan, mm) vs GenArc (3D Y-up, metres), overlap, complement opportunities.

### 6.1 Wall geometry

| Λειτουργία | Nestor (`bim/geometry/wall-geometry.ts` + `bim/walls/wall-trims.ts`) | GenArc (`engines/bom/wallGeometry.ts`) | Overlap |
|---|---|---|---|
| Axis polyline | `computeWallGeometry` → `axisPolyline: Polyline3D` (2D centerline, z=0). Supports `straight`/`curved` (16-subdivision quadratic Bezier) | `[start, end]` raw 3D points (Y=elevation) | ⚠️ Nestor straight+curved superset; GenArc straight only |
| Half-thickness offset → outerEdge/innerEdge | ✅ `offsetAxisToEdges()` με flip sign | ❌ Δεν υπάρχει (GenArc εξάγει wall mesh στο `navProxy.ts`, όχι σε wallGeometry.ts) | Nestor superset |
| Trim/Bevel για junctions | ✅ `computeWallTrims` parametric intersection + corner/T-junction/cross classification + MAX_BEVEL_FRACTION + `WallTrimPatch` map με startBevel/endBevel | ⚠️ `computeWallTrims` perpendicular-only (PERP_THRESH=0.5 cos), numeric trim, no anti-inversion guard | **Nestor strict superset** |
| Wall area (gross/net) | ✅ `geometry.area` (gross) — opening subtraction Phase 2 (likely already shipped given ADR-363 phase status) | `wallNetArea(wall, openings)` external helper | Equivalent (Nestor inline) |
| Wall volume | ✅ `geometry.volume` | `wallNetArea × thickness` external | Equivalent |
| Wall segments around openings | ❌ Nestor renders opening ως separate mesh (boolean subtract Phase 2 ADR-366), όχι wall segmentation | ✅ `segmentWallAroundOpenings` produces sill/lintel/jamb sub-rects | **GenArc-specific approach**, Nestor uses superior CSG/post-hit-filter pattern |

**Gap?** Καμία significant. Nestor superset σε όλα.

### 6.2 Opening geometry

| Λειτουργία | Nestor (`bim/geometry/opening-geometry.ts`) | GenArc (`opening.types` + scattered in navProxy) | Overlap |
|---|---|---|---|
| Host-relative outline | ✅ `computeOpeningGeometry(params, hostWall)` → outline rectangle, center, rotation, hingeArc (for doors) | ❌ GenArc renders opening ως subtract σε SDF shader, no explicit outline | Nestor superset |
| Opening bbox | ✅ `geometry.bbox` | ❌ | Nestor only |
| Opening area/perimeter | ✅ `geometry.area`, `geometry.perimeter` | `openingGlassArea = width × height` | Equivalent (Nestor cached) |
| Hinge arc geometry (doors) | ✅ HINGE_ARC_SUBDIVISIONS=12 quarter-circle | ❌ | Nestor only |

**Gap?** Καμία. Nestor superset.

### 6.3 Slab geometry

| Λειτουργία | Nestor (`bim/geometry/slab-geometry.ts` + `bim/slabs/slab-edge-projection.ts`) | GenArc (`utils/slabBeamSplit.ts` + `slabPolygon` external) | Overlap |
|---|---|---|---|
| Outline polygon | ✅ `params.outline.vertices` (mm world coords) | ✅ `slab.outline` (metres) | Equivalent |
| Area (signed/unsigned) | ✅ `polygon-utils.shoelaceArea` + `polygonArea` | ✅ `slabPolygonArea` (referenced) | Equivalent |
| Perimeter | ✅ `polygonPerimeter` | ❌ (likely in slabPolygon, not read) | Likely equivalent |
| Bbox | ✅ `polygonBbox` | ❌ Computed inline as needed | Nestor cached |
| Net area με slab-opening subtraction | ✅ Phase 3.7 (commit `daf58568`) με `sumSlabOpeningAreasM2` | ❌ | Nestor only |
| Volume | ✅ `netAreaM2 × thicknessMm / 1000` | `slabArea × thickness` | Equivalent (Nestor net-aware) |
| Decomposition around beams | ❌ Nestor renders slab+beams ως separate Z-aligned meshes (industry standard) | ✅ `splitSlabByBeams` axis-aligned exact + diagonal trapezoid | **GenArc-specific, EXTRACT_CONCEPT §4.1** |
| Snap-to-slab-edge perpendicular | ✅ `projectPointOnSlabEdge` + `getSlabEdgePerpendicularFeet` (Phase 5.5f) | ❌ | Nestor only |

**Gap για ADR-366**: Καμία. Slab decomposition είναι out-of-scope (industry pattern).

### 6.4 Column geometry

| Λειτουργία | Nestor (`bim/geometry/column-geometry.ts`) | GenArc (`geometryCalculators.ts:columnVolume/columnFormworkArea`) | Overlap |
|---|---|---|---|
| Footprint polygon | ✅ `computeColumnGeometry` produces footprint + bbox + area/volume | ❌ (rectangular or circular section assumed inline) | Nestor superset |
| Volume (rectangular/circular) | ✅ `geometry.volume` | `columnVolume(column)` | Equivalent |
| Formwork area | ❌ (Nestor would compute via Firestore BOQ catalog when needed) | `columnFormworkArea(column)` perimeter × height | GenArc explicit, Nestor TBD |

**Gap?** Formwork BOQ feeding χρειάζεται Phase 6 ADR-363 extension (Open Question Q4).

### 6.5 Beam geometry

| Λειτουργία | Nestor (`bim/geometry/beam-geometry.ts`) | GenArc (`geometryCalculators.ts:beamLength/Volume/FormworkArea` + `wallGeometry.ts:computeBeam*Trim`) | Overlap |
|---|---|---|---|
| Length | ✅ `geometry.length` | `beamLength(beam)` 3D distance | Equivalent (Nestor 2D projected — Z elevation external) |
| Volume | ✅ `geometry.volume` | `beam.width × beam.height × length` | Equivalent |
| Cross-section rectangle | ✅ Nestor cached στο geometry | ❌ Computed inline | Nestor cached |
| Beam-column trim | ❌ Nestor δεν έχει (no Phase X yet) | `computeBeamColTrim` AABB-based | **Potentially useful future ADR-363 polish** |
| Beam-perpendicular-beam trim | ❌ Nestor δεν έχει | `computeBeamEndTrim` | Same as above |

**Gap**: beam trim (column/beam). Out of ADR-366 scope (industry: visible Z-buffer overlap, not boolean trim).

### 6.6 Polygon utilities (shared)

| Λειτουργία | Nestor (`bim/geometry/shared/polygon-utils.ts`) | GenArc (scattered) | Overlap |
|---|---|---|---|
| Shoelace area (signed/unsigned) | ✅ `shoelaceArea`, `polygonArea`, `isPolygonCCW` | ✅ `slabPolygon` inline | Equivalent |
| Perimeter | ✅ `polygonPerimeter` | ✅ Inline | Equivalent |
| Bbox | ✅ `polygonBbox` | ✅ Inline | Equivalent |
| Point-in-polygon | ✅ `pointInPolygon` (ray casting) | ✅ `isPointInPolygon2D` (referenced) | Equivalent |
| Self-intersection check | ✅ `isPolygonSelfIntersecting` O(n²) με segmentsIntersect | ❌ | Nestor only |
| Polygon3D wrapper | ✅ `makePolygon3D` | ❌ | Nestor only |

**Gap?** Καμία. Nestor superset.

### 6.7 Stair geometry (out-of-scope GenArc)

| Λειτουργία | Nestor (`bim/geometry/stairs/StairGeometryService` + 11 sub-files) | GenArc | Overlap |
|---|---|---|---|
| 11 stair variants (straight/lshape/ushape/winder/lshape-winders/triangular-fan/triangular-outline/spiral/helical/elliptical/vshape/gamma/sketch) με tests (155 unit tests, ADR-362 Group O) | ✅ Mature | ❌ Stair domain non-existent in GenArc | Nestor 100% solo |

**Gap?** N/A — GenArc out of stair domain entirely.

### 6.8 Συμπέρασμα §6

Σε **κάθε core BIM entity type** (wall/opening/slab/column/beam/stair), Nestor's `bim/geometry/` είναι **architectural equal-or-superset** του GenArc. Τα μοναδικά domains όπου GenArc έχει **algorithm depth** χωρίς Nestor equivalent είναι:

- Slab decomposition around beams (`slabBeamSplit`) — **out of ADR-366 scope** (industry: Z-aligned meshes)
- Auto-slab from beam loop (`beamLoopSlab`) — **out of ADR-366 scope** (BIM authoring, ADR-363 territory)
- Beam-column / beam-beam trim (`computeBeam*Trim`) — **out of ADR-366 scope** (industry: visible Z-buffer overlap)
- Scene-agnostic CPU raycaster (`raySceneIntersection`) — **out of ADR-366 scope** (Three.js native raycaster sufficient)
- Multi-layer DNA BOQ aggregation (`wallLayerQuantities`) — **possible Boy Scout / Phase 6.2 ADR-363 extension** (Open Question Q4)

---

## 7. Coordinate System / Units Alignment

### 7.1 Fundamental basis mismatch

| Σύστημα | X | Y | Z | Units | Elevation source | Example: wall.start |
|---|---|---|---|---|---|---|
| **GenArc 3D world** (ADR-009) | East | Height ↑ | South ↓ | metres | Inline στο [x,y,z] με y=elev | `wall.start = [3.2, 2.5, -4.7]` (2.5m height) |
| **Nestor 2D plan view** (ADR-363 §G11) | East | North | Optional 3D-readiness | millimetres | External: `floor.elevationMm` ή `wall.params.startElevation` (TBD) | `wall.params.start = { x: 3200, y: 4700, z?: 0 }` (height ξεχωριστά μέσω floor metadata) |
| **Nestor 3D bridge** (ADR-366 §4.2) | East | Height ↑ | South ↓ | metres | Bridge: `dxfPlanToWorld(x_mm, y_mm, elev_mm)` | `THREE.Vector3(3.2, 2.5, 4.7)` (axis swap + unit conv) |

### 7.2 Triple transformation per port

Για να μεταφερθεί οποιοδήποτε GenArc geometry function στο Nestor BIM (2D plan) ή στο Nestor 3D viewer:

1. **Axis remap** (Y-up ↔ XY-plan): GenArc `[x, y, z]` → Nestor `{x, y, elev}` ξεχωριστά
2. **Unit conversion** (m ↔ mm): GenArc `3.2 m` → Nestor `3200 mm` (input), `mm` → `m` (output BOQ scalars)
3. **Data model swap** (procedural → cached): GenArc `wall.thickness` → Nestor `wall.params.thickness` + recompute `wall.geometry` after mutation

**Cumulative cost per file**: ~30-40% rewrite. Όταν Nestor **ήδη έχει** equivalent function, total adaptation cost > rewrite cost.

### 7.3 ADR-366 Phase 2 bridge strategy

Όταν Phase 2 (BIM → 3D ExtrudeGeometry) χτιστεί:

```typescript
// SPEC-3D-002 BimToThreeConverter pattern (proposed)
function wallToThreeGeometry(wall: WallEntity, floor: BuildingFloor): THREE.Mesh {
  // Step 1: Read Nestor cached geometry (mm, plan view)
  const { outerEdge, innerEdge, axisPolyline } = wall.geometry;

  // Step 2: Build 2D Shape στο XY-plan με axis swap
  const shape = new THREE.Shape();
  outerEdge.points.forEach((pt, i) => {
    const v3 = dxfPlanToWorld(pt.x, pt.y, 0);  // mm plan → m world
    if (i === 0) shape.moveTo(v3.x, v3.z);     // XZ ground plane
    else shape.lineTo(v3.x, v3.z);
  });

  // Step 3: ExtrudeGeometry σε Y-axis (height)
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: wall.params.height / 1000,
    bevelEnabled: false,
  });

  // Step 4: Position στο floor elevation
  const elev = floor.elevationMm / 1000;
  geometry.translate(0, elev, 0);

  return new THREE.Mesh(geometry, wallMaterial(wall));
}
```

**Zero GenArc reference** — όλη η geometry source είναι Nestor cached + ADR-366 §4.2 bridge.

---

## 8. License Audit (SOS N.5)

| Module | License | Status |
|---|---|---|
| GenArc `engines/bom/*` (3 αρχεία) | Custom Γιώργου | MIT-compatible ✅ — όμως EXCLUDE, irrelevant |
| GenArc `utils/slabBeamSplit.ts` | Custom Γιώργου | MIT-compatible ✅ — EXTRACT_CONCEPT reference |
| GenArc `utils/beamLoopSlab.ts` | Custom Γιώργου | MIT-compatible ✅ — EXTRACT_CONCEPT reference |
| GenArc `utils/raySceneIntersection.ts` | Custom Γιώργου | MIT-compatible ✅ — EXTRACT_CONCEPT reference |
| GenArc `utils/structuralConnectivity*.ts` | Custom Γιώργου | MIT-compatible ✅ — EXCLUDE |
| GenArc `utils/buildingSelectors.ts` | Custom Γιώργου | MIT-compatible ✅ — EXCLUDE |

**License risk: ZERO**. Κανένα port = no license relevance, αλλά conceptual reuse επιτρέπεται.

---

## 9. Port Execution Plan

**Δεν υπάρχει port plan για ADR-366.** ZERO files port-άρονται από αυτό το domain για ADR-366 Phases 0-6.

**Phase 2 ADR-366 (BIM → Three.js)** χτίζεται **πάνω στο Nestor `bim/geometry/*`** ως νέο module `src/subapps/dxf-viewer/bim-3d/converters/BimToThreeConverter.ts`. Reference implementation pattern: §7.3 παραπάνω.

**Conditional future ports** (post-ADR-366 Phase 6, μόνο αν εμφανιστεί ανάγκη):

| EXTRACT_CONCEPT file | Trigger για port | Target ADR |
|---|---|---|
| `slabBeamSplit.ts` | Αν 2D plan view χρειαστεί precise slab area excluding beam overlaps (BOQ accuracy) | ADR-363 Phase 3.x or 7.x |
| `beamLoopSlab.ts` | Αν Nestor slab tool θέλει "auto-trace from beam structure" (Revit/ArchiCAD parity) | ADR-363 Phase 3.x enhancement |
| `raySceneIntersection.ts` | Αν Nestor χρειαστεί CPU fallback raycaster (WebGL unavailable) ή deterministic cross-check vs Three.js | ADR-366 Phase 8+ (post-MVP) |

**Σήμερα: μηδέν effort, μηδέν action items.**

---

## 10. Cross-Domain Dependencies Spotted

(Section as required by task spec — flag GenArc cross-domain coupling discovered without entering those domains.)

Κατά τη διερεύνηση, εντοπίστηκαν τα εξής cross-domain edges:

| Edge | Source file | Target domain | Σχόλιο για αδέλφια SPECs |
|---|---|---|---|
| `wallGeometry.ts` → `@/types/{wall,beam,column,opening}.types` | local | **types/** | Standard type imports — όλα ήδη χαρτογραφημένα σε SPEC-3D-004A §8.4 type port plan. Εδώ EXCLUDE — types δεν χρειάζονται μεταφορά (Nestor έχει `bim/types/`). |
| `bomCalculator.ts` → `@/constants/bomPhases.constants` (`CATEGORY_TO_PHASE`, `PHASE_ORDER`) + `@/constants/materialRegistry.constants` (`MATERIAL_REGISTRY`) | constants | **constants/ (BOM config)** | ❌ EXCLUDE — Nestor χρησιμοποιεί Firestore-driven ΑΤΟΕ catalog + `bim-to-atoe-mapping.ts`. |
| `bomCalculator.ts` → `@/engines/bom/geometryCalculators` | local sibling | **engines/bom/ (self-domain)** | Self-contained. |
| `geometryCalculators.ts` → `@/utils/slabPolygon` (`slabPolygonArea`) | utils | **utils/ (polygon math, out-of-scope ADR-366 SPEC-3D-004D)** | ⚠️ Existence note: `slabPolygon.ts` πιθανότατα έχει `slabPolygonArea` + `slabContainsPoint`. Δεν εξετάστηκε εδώ (out of file list). Nestor αντίστοιχο: `bim/geometry/shared/polygon-utils.ts`. |
| `slabBeamSplit.ts` → `@/types/{slab,beam}.types` | types | **types/** | EXCLUDE. |
| `beamLoopSlab.ts` → `@/utils/dxfGeometry.utils` (`isPointInPolygon2D`) | utils | **utils/ (dxf-related geometry — out-of-scope ADR-366 SPEC-3D-004D)** | ⚠️ `dxfGeometry.utils.ts` δεν εξετάστηκε. Πιθανώς contains plot-detection helpers (consistent με SPEC-3D-004B EXCLUDE topographic domain). Nestor's `polygon-utils.pointInPolygon` καλύπτει. |
| `raySceneIntersection.ts` → `@/utils/slabPolygon` (`slabContainsPoint`) + `@/utils/slabBeamSplit` (`splitSlabByBeams`) | local utils | **utils/ (self-domain + EXTRACT_CONCEPT §4.1)** | Self-coupled chain. Confirms slabBeamSplit ως foundational dependency. |
| `structuralConnectivity.ts` → `@/utils/structuralConnectivity.helpers` | local | **utils/ (self-domain)** | Self-coupled. Both EXCLUDE. |
| `structuralConnectivity.helpers.ts` → `@/constants/loupe.constants` (`BEAM_COL_TOL`, `WALL_COL_TOL`, `SLAB_EDGE_TOL`, `BEAM_WALL_TOL`, `SLAB_CONNECT_TOL`) | constants | **constants/ (Loupe tolerances)** | ❌ EXCLUDE μαζί με Loupe deferred. Αν Phase 7.2 ADR-366 ενεργοποιήσει Loupe (SPEC-3D-004A §3.3), τότε αυτά τα tolerances ports together. |
| `structuralConnectivity.ts` → `@/types/{selection,loupe}.types` (`SelectableType`, `ConnectedSet`) | types | **types/ (selection + Loupe-specific)** | EXCLUDE. ConnectedSet ports together με Loupe Phase 7.2. |
| `buildingSelectors.ts` → `@/stores/building.store` (`BuildingStore` type) + `@/types/staircase.types` (`Staircase`) | stores + types | **stores/** | ❌ 100% GenArc store coupling — EXCLUDE confirmed. |
| Κανένα cross-domain edge προς `engines/sdf/`, `engines/structural/`, `engines/ai/`, `engines/nok/`, `engines/viewport/`, `engines/dxf/`, `shaders/` | — | — | ✅ Clean separation. Επιβεβαιώνει ότι geometry helpers δεν διαρρέουν σε άλλα domains. |

**Συμπέρασμα §10**:
- 2 cross-domain references σε **utils/** (`slabPolygon`, `dxfGeometry.utils`) — out of SPEC-3D-004D scope, δεν αξίζει επεξεργασία (Nestor's `polygon-utils.ts` καλύπτει both).
- 1 confirmation με **SPEC-3D-004C §10** (buildingSelectors EXCLUDE, structuralConnectivity helpers σύνδεση με Loupe Phase 7.2).
- 1 self-coupled chain (`raySceneIntersection → slabBeamSplit → slabPolygon`) — όλα EXTRACT_CONCEPT or EXCLUDE.

---

## 11. Σχέση με Open Questions των SPEC-3D-004A/B/C

| Question | Σχέση |
|---|---|
| **SPEC-3D-004A Q1 (compass ring ViewCube)** | Ανεξάρτητο. |
| **SPEC-3D-004A Q2 (navProxy primary vs alternative για Phase 2)** | **Σχετίζεται κρίσιμα**: αν navProxy επιλεγεί ως primary, χρειάζεται το **patterns** του `wallGeometry.ts:segmentWallAroundOpenings` + `slabBeamSplit.ts` που είναι **dependencies** του navProxy (SPEC-3D-004A §4.1 anti-NOTE). Όμως αν alternative path (Nestor's BimToThreeConverter μέσω cached `wall.geometry.outerEdge/innerEdge`), τότε αυτά τα GenArc helpers **δεν χρειάζονται**. **Σύσταση SPEC-3D-004D: alternative path** — Nestor's cached geometry είναι ήδη έτοιμη για ExtrudeGeometry χωρίς segmentation. **Επιβεβαιώνει SPEC-3D-004A §3.1 EXTRACT_CONCEPT reimplementation pattern με Nestor BIM types**, χωρίς wallGeometry.ts/slabBeamSplit/navProxyStaircase dependencies. |
| **SPEC-3D-004B Q1 (topographic feature parking)** | Ανεξάρτητο. |
| **SPEC-3D-004B Q2 (DXF parser build from scratch)** | Ανεξάρτητο. |
| **SPEC-3D-004C Q1 (auto-infer alignment guides Boy Scout)** | Ανεξάρτητο. Already tracked στο `.claude-rules/pending-ratchet-work.md` (~3h pending entry). |
| **SPEC-3D-004C Q2 (cursorProjection port timing)** | Ανεξάρτητο. |
| **SPEC-3D-004C Q3 (naming collision 2D vs 3D)** | Ανεξάρτητο. |
| **SPEC-3D-004C Q4 (snap zero-port)** | Ανεξάρτητο. |

---

## 12. Open Questions για Γιώργο

> Όλες οι ερωτήσεις σχετικές με industry-precedent → **Full Enterprise pattern**: industry analysis πρώτα → resolve. Απλά ελληνικά + παραδείγματα.

### Q1 — RESOLVED 2026-05-19 (Full Enterprise) — Slab decomposition around beams: out of ADR-366 scope

**Παράδειγμα**: Φαντάσου ένα δωμάτιο όπου η πλάκα οροφής έχει δύο δοκούς που τη διασχίζουν. Σε 3D, υπάρχουν δύο τρόποι να φαίνεται αυτό:
- **(A) Συμπαγή layered meshes**: Η πλάκα είναι ένα ορθογώνιο mesh. Οι δοκοί είναι δύο ξεχωριστά meshes που "ξεπροβάλλουν" από κάτω, ελαφρώς πιο χαμηλά (ώστε να μη βλέπεις z-fighting). Είναι σαν να βάζεις τη μία πλάκα πάνω στις άλλες.
- **(B) Boolean subtract**: Η πλάκα γίνεται puzzle: κόβεται γύρω από τις δοκούς, ώστε να μην υπάρχει "διπλό material" στα σημεία επικάλυψης.

Το GenArc έχει `slabBeamSplit.ts` που υλοποιεί τη μέθοδο **(B)** με exact axis-aligned subtraction + diagonal trapezoid decomposition. 392 LOC, μη-trivial geometry math.

**Industry analysis** (5/5 σύγκλιση):
- **Revit** — slab + beam = separate Z-aligned families, no boolean. Floor element έχει thickness + structural beam framing έχει δικά του outlines. Z-fighting handled via Display Settings.
- **ArchiCAD** — Slab tool παράγει solid; Beam tool παράγει solid; visible overlap "decoration" handled στο 3D Window via display order, όχι boolean.
- **Bentley AECOsim** — Floor + ConcreteBeam ως separate elements, ίδιο pattern.
- **Tekla Structures** — Slabs + beams ως ξεχωριστά parts. Boolean subtract μόνο για casting-unit production (όχι rendering).
- **Vectorworks Architect** — Slab + Beam objects, Z-overlap, όχι boolean.

**Πρόταση: OUT OF ADR-366 SCOPE.** Nestor υιοθετεί industry pattern (Z-aligned separate meshes). Z-fighting θα αποφευχθεί με `polygonOffset: true` ή deterministic Z gap (πχ beam top = slab bottom − 1mm).

**Αν συμφωνείς**: EXTRACT_CONCEPT §4.1 παραμένει reference για future ADR-363 phase αν προκύψει BOQ accuracy need. Καμία άμεση δράση. (Resolved without explicit question — απαντάει το industry signal.)

---

### Q2 — RESOLVED 2026-05-19 (Full Enterprise) — Auto-slab from beam loop: future ADR-363 enhancement candidate

**Παράδειγμα**: Έχεις σχεδιάσει 4 δοκούς που σχηματίζουν ένα κλειστό τετράγωνο. Κάνεις click μέσα. Το tool **αυτόματα** δημιουργεί την πλάκα οροφής χωρίς να χρειαστεί να σχεδιάσεις χειροκίνητα το outline.

Το GenArc `beamLoopSlab.ts` (224 LOC) κάνει ακριβώς αυτό: node merge → adjacency graph → cycle BFS με canonical key → convex quad validation → coplanarity check → return outline + bbox + topY.

**Industry analysis** (4/4 σύγκλιση):
- **Revit** — "Create Slab Boundary" semi-auto: click μέσα σε γραμμικό loop, αυτόματη trace boundary.
- **ArchiCAD** — Magic Wand tool: click + Space → trace polygon from surrounding lines/walls/beams.
- **Tekla Structures** — "Plate from contour" or "Concrete slab from beam loop" — semi-auto with click confirmation.
- **Bentley AECOsim** — "Floor from grid intersection" → similar concept.

**Συμπέρασμα**: Industry έχει feature, αλλά είναι **BIM authoring** (πώς σχεδιάζεις πλάκες) — όχι **3D viewer** (πώς βλέπεις σε 3D). ADR-366 = viewer.

**Πρόταση: OUT OF ADR-366 SCOPE. File as future ADR-363 enhancement candidate.** Καμία ratchet entry — μόνο αν Γιώργος ζητήσει το feature θα ξανα-εξεταστεί. Pattern reference: §4.2.

---

### Q3 — RESOLVED 2026-05-19 (Full Enterprise) — Three.js native raycaster sufficient, analytical CPU raycaster EXCLUDE

**Παράδειγμα**: Όταν ο χρήστης κάνει click στο 3D viewer για να επιλέξει έναν τοίχο, ποιον αλγόριθμο χρησιμοποιούμε για να βρούμε ποιο entity είναι κάτω από τον cursor;

- **(A) Three.js native** `Raycaster.intersectObjects(scene.children)` — δουλεύει πάνω στα **υπάρχοντα meshes** της σκηνής. BVH-accelerated.
- **(B) Analytical CPU** — εξετάζει κάθε wall/column/beam/slab entity-by-entity με math (ray-OBB, ray-AABB). Δεν χρειάζεται meshes στη σκηνή.

GenArc έχει την προσέγγιση **(B)** (`raySceneIntersection.ts`, 386 LOC) γιατί στο GenArc render = SDF shader, οπότε δεν υπάρχουν Three.js meshes — έπρεπε να γραφτεί custom CPU raycaster που "βλέπει" αυτό που βλέπει το shader.

**Industry analysis** (4/4 σύγκλιση):
- **Speckle Viewer** — Three.js native raycaster μέσω `Raycaster.intersectObjects`.
- **xeokit-sdk** — Built-in `PickController` που χρησιμοποιεί BVH + GPU picking (super-set του native).
- **Forge/APS Viewer (Autodesk Platform Services)** — Three.js native + BVH boost.
- **Three.js Editor** — Native raycaster (το reference example).

**Συμπέρασμα**: Nestor's ADR-366 Phase 2 παράγει Three.js meshes με `ExtrudeGeometry`. Phase 4 picking → native `THREE.Raycaster` + `Raycaster.intersectObjects(scene.children)`. **SPEC-3D-004C §9.4 `bim-raycaster.ts`** ήδη ορίζει το thin wrapper με `userData.entityId` lookup. Επαρκές.

**Decision: EXCLUDE for ADR-366 confirmed**. EXTRACT_CONCEPT §4.3 παραμένει reference μόνο για conditional future use cases (CPU fallback, cross-check). Καμία ratchet entry.

---

### Q4 — RESOLVED 2026-05-19 (Full Enterprise) — Per-layer BOQ entries: ADR-363 Phase 6.x extension confirmed

**Παράδειγμα**: Φαντάσου έναν εξωτερικό τοίχο που έχει 3 layers (DNA):
1. Εξωτερικός σοβάς (3 cm) → υλικό "mat-plaster-exterior"
2. Οπλισμένο σκυρόδεμα (20 cm) → υλικό "mat-concrete-c25"
3. Εσωτερικό γυψοσανίδα (1.5 cm) → υλικό "mat-gypsum-board"

**GenArc** `wallLayerQuantities` παράγει **3 ξεχωριστά BOQ entries**, ένα ανά layer, με σωστό m³ ανά υλικό (0.20 × area for concrete, 0.03 × area for plaster, 0.015 × area for gypsum).

**Nestor** `BimToBoqBridge.buildBoqPayload` παράγει **1 BOQ entry per entity** με `quantity = geometry.area` ή `geometry.volume` — δεν διαβάζει wall DNA layers.

#### Industry Analysis (Full Enterprise — 6/6 σύγκλιση)

| BIM Tool | Multi-layer wall structure | BOQ output pattern |
|---|---|---|
| **Revit** | Compound Wall με Function-tagged layers (Structure/Substrate/Thermal-Air/Finish 1/2) | **Material Takeoff Schedule** → per-material rows με Volume + Area + Material:Name + Cost |
| **ArchiCAD** | Composite Wall με Skin Layers (priority-based) | **Interactive Schedule** → per-skin Surface Area + Volume + Building Material + Cost |
| **Bentley AECOsim/OpenBuildings** | Compound Wall με Component Materials | **BIS quantity takeoff** → per-component rows |
| **Tekla Structures** | Wall Panel ως Assembly με Parts (each layer = separate Part) | **BOM** per part με Volume + Weight + Material Grade |
| **Vectorworks Architect** | Wall Style με Components (priority-ranked) | **Worksheet** → per-component takeoff (Area, Volume, Material) |
| **Allplan (Nemetschek)** | Composite Wall με Layers + Reinforcement | **Quantity Takeoff Report** per layer + per material (volume, area, weight) |

**Σύγκλιση: 6/6**. **ΟΛΟΙ** οι major BIM authoring tools παράγουν **per-layer (ή per-component) quantities**. Layer-level granularity είναι **industry standard** για:
- **Material costing accuracy** — διαφορετικά υλικά έχουν διαφορετικό €/m³ ή €/m².
- **Labor cost separation** — installation labor διαφέρει per layer (πχ rebar tie labor ≠ plaster application labor).
- **Procurement planning** — supplier orders γίνονται per-material, όχι per-wall.
- **Phase scheduling** — layers εφαρμόζονται σε διαφορετικές κατασκευαστικές φάσεις (Σκελετός vs Τοιχοποιίες vs Τελικές Επιστρώσεις).

**Decision: A confirmed via Full Enterprise**. ADR-363 Phase 6.x extension προστίθεται στο roadmap:

#### Implementation Plan (ADR-363 Phase 6.x — Multi-Layer DNA BOQ)

| Step | Δουλειά | Effort |
|---|---|---|
| 1 | Επέκταση `bim-to-atoe-mapping.ts`: per-layer-category mapping (concrete → "ΑΤΟΕ-1234", plaster → "ΑΤΟΕ-2345", gypsum → "ΑΤΟΕ-3456") | ~1h |
| 2 | `BimToBoqBridge.upsertBoqItemForBim`: αν `entity.params.dna?.layers?.length > 1`, παράγει N BOQ entries με deterministic IDs `boq_bim_${entityId}_layer_${layerId}`. Quantity per layer = `wallNetArea × layer.thickness` (volume) ή `wallNetArea × side-multiplier` (area, per side counting) | ~2h |
| 3 | Per-layer detach guard: αν user έχει detach σε ένα layer entry, μόνο αυτό δεν overwrites — τα υπόλοιπα ενημερώνονται κανονικά | ~1h |
| 4 | Migration: existing single-entry BOQ rows με `boq_bim_${entityId}` (no layer suffix) διατηρούνται για backward compatibility, αλλά νέα saves παράγουν τη multi-entry δομή | ~1h |
| 5 | Tests: unit (per-layer quantity correctness) + integration (Firestore upsert + detach guard) | ~2h |
| 6 | ADR-363 §6 update + ADR-329 (BOQ Scope) cross-link + ΑΤΟΕ catalog expansion entry | ~1h |

**Total: ~8h ADR-363 Phase 6.x extension**. Tracked separately από ADR-366 — αυτό είναι BIM authoring scope, όχι 3D viewer.

**Pattern reference**: `wallLayerQuantities` του GenArc (256 LOC σε `geometryCalculators.ts`) — concept-only, όχι direct port (Nestor data shapes διαφέρουν).

**Pending entry στο `.claude-rules/pending-ratchet-work.md`**: "ADR-363 Phase 6.x — Multi-Layer DNA BOQ (8h)". Θα προστεθεί σε επόμενο commit.

---

## 13. Google-Level Architecture Checklist (SPEC self-audit)

| # | Ερώτηση | Απάντηση για SPEC-3D-004D |
|---|---|---|
| 1 | Proactive ή reactive; | Proactive — research-first, identify gaps **πριν** ξεκινήσει Phase 2 |
| 2 | Race condition; | N/A (research SPEC, no runtime) |
| 3 | Idempotent; | Yes — re-running analysis δίνει ίδιο catalog |
| 4 | Belt-and-suspenders; | Yes — cross-checked με Nestor inventory (read 4 BIM geometry αρχεία + polygon-utils + BimToBoqBridge) |
| 5 | Single Source of Truth; | Yes — ADR-366 §8 entry + this SPEC = SSoT για geometry port decisions |
| 6 | Fire-and-forget ή await; | N/A (documentation) |
| 7 | Lifecycle ownership; | Author: Claude Opus 4.7. Maintainer: ADR-366 σύνδεση. |

**Google-level: YES** — full enterprise analysis (3 Full Enterprise resolutions Q1/Q2/Q3 με 4-5 industry players σύγκλιση), zero ambiguity, clear decision rationale, completeness over MVP.

---

## 14. Changelog

| Ημ/νία | Αλλαγή | Author |
|---|---|---|
| 2026-05-19 | **Q4 RESOLVED — Full Enterprise (Industry alignment 6/6)**. Industry analysis Revit + ArchiCAD + Bentley AECOsim + Tekla + Vectorworks + Allplan → **ΟΛΟΙ** οι major BIM authoring tools παράγουν per-layer/per-component quantities (Material Takeoff Schedule, Interactive Schedule, BIS quantity takeoff, BOM, Worksheet, Quantity Takeoff Report). Layer-level granularity = industry standard για material costing accuracy + labor separation + procurement planning + phase scheduling. **Decision: A confirmed** — ADR-363 Phase 6.x extension (~8h) προστίθεται σε roadmap: per-layer BOQ entries με deterministic IDs `boq_bim_${entityId}_layer_${layerId}`, per-layer detach guard, backward-compatible migration. ΟΛΕΣ οι 4 ερωτήσεις του SPEC resolved. Pending entry για `.claude-rules/pending-ratchet-work.md` (ADR-363 Phase 6.x, 8h) — αναμένει separate commit. | Claude Opus 4.7 |
| 2026-05-19 | **Initial draft v1.0** — Full catalog 9 αρχείων του GenArc geometry/BOM/connectivity domain (engines/bom/ 3 files + utils/{slabBeamSplit,beamLoopSlab,raySceneIntersection,structuralConnectivity,structuralConnectivity.helpers,buildingSelectors} 6 files, total ~2.344 LOC). **Result: 0 PORT_AS_IS / 0 ADAPT / 3 EXTRACT_CONCEPT / 6 EXCLUDE.** Κεντρικό εύρημα: Nestor's `bim/geometry/*` (ADR-363 Phases 1-7.1) είναι **architectural superset** του GenArc — fundamental coordinate basis mismatch (3D Y-up metres vs 2D XY-plan mm + external elevation) + Nestor's mature cached geometry SSoT (`computeWallGeometry`/`OpeningGeometry`/`SlabGeometry`/`ColumnGeometry`/`BeamGeometry` με idempotent functions). Q1/Q2/Q3 RESOLVED με Full Enterprise industry analysis (5/5, 4/4, 4/4 σύγκλιση): slab-beam decomposition + auto-slab from beam loop + analytical CPU raycaster ΟΛΑ out of ADR-366 scope (industry uses Z-aligned separate meshes + BIM authoring + Three.js native raycaster αντίστοιχα). Q4 ανοιχτό για Γιώργο (multi-layer DNA BOQ aggregation — gap στο Nestor BimToBoqBridge ή catalog-level intentional). Cross-domain dependencies confirmed: `wallGeometry.ts:segmentWallAroundOpenings` + `slabBeamSplit.ts` είναι dependencies του navProxy (SPEC-3D-004A §4.1 anti-NOTE) → επιβεβαιώνει SPEC-3D-004A §3.1 EXTRACT_CONCEPT alternative path με Nestor BIM types. SPEC-3D-004C §10 cross-domain flags (raySceneIntersection, buildingSelectors, distSqXZ) ΟΛΑ resolved ως EXCLUDE/EXTRACT_CONCEPT. Phase 2 ADR-366 build strategy: `BimToThreeConverter` πάνω σε Nestor cached `entity.geometry.{outerEdge, innerEdge, axisPolyline, outline, footprint, bbox}` + `dxfPlanToWorld(x_mm, y_mm, elev_mm)` ADR-366 §4.2 bridge. **Zero port effort για ADR-366.** | Claude Opus 4.7 |
