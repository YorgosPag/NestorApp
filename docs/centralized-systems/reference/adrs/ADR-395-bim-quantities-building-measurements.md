# ADR-395 — Ενσωμάτωση BIM οντοτήτων στην καρτέλα «Επιμετρήσεις» Κτιρίου

**Status**: 🟢 PHASE 2 + G6 + G2 IMPLEMENTED 2026-05-29 (pending commit) — G1 (σκάλες → 3 BOQ rows) DONE· **G6 (καθαρό m² τοίχου = gross − ανοίγματα) DONE**· **G2 (καθαρό m³ πλάκας = gross − slab-openings) DONE**. Phase 1 (G3 buildingId resolution + G7 per-floor) shipped commit `ecea20e1`. Research + 7/7 decisions κλεισμένα (§1.2, §6). Εκκρεμή: G4 backfill (deferred), G5 (`qto` cleanup follow-up), waist param promotion.
**Date**: 2026-05-29
**Category**: BIM / Quantity Take-Off ↔ Buildings — Measurements (BOQ)
**Author**: Giorgio Pagonis + Claude (Opus 4.7)
**Related ADRs**: ADR-175 (Quantity Surveying / BOQ), ADR-363 §6 + §6.1 (BIM Drawing Mode + BIM→BOQ auto-feed), ADR-376 §B.2 (Opening Tags — BOQ signature-group), ADR-358 (Stair ↔ Floor/Building linking), ADR-380 (Stair audit coverage), ADR-201 (companyId resolution building→user)

---

## 1. Context

Ο Giorgio ζήτησε: στα **Κτίρια** (Buildings) → επιλογή κτιρίου → καρτέλα **«Επιμετρήσεις»**, να **αρχίσουμε να ενσωματώνουμε** τις BIM οντότητες που τοποθετεί ο χρήστης στην υπο-εφαρμογή **DXF viewer**, ώστε οι επιμετρήσεις του κτιρίου να τροφοδοτούνται αυτόματα από τα BIM στοιχεία (τοίχοι σε m², κολώνες/δοκοί/πλάκες σε m³, κουφώματα σε τεμάχια κ.λπ.).

### 1.1. ΚΡΙΣΙΜΟ εύρημα Phase 1 (code = source of truth)

**Η αλυσίδα BIM → BOQ → Επιμετρήσεις ΥΠΑΡΧΕΙ ΗΔΗ end-to-end** και είναι ενεργή. Δεν ξεκινάμε από το μηδέν — χτίστηκε στο **ADR-363 Phase 6** (BIM→BOQ auto-feed) + **ADR-376 Phase B.2** (openings) και διαβάζεται από το **ADR-175** Measurements tab.

Αυτό το ADR **δεν** ξαναχτίζει την αλυσίδα (SSOT, N.0). Τεκμηριώνει την **τρέχουσα κατάσταση** και ορίζει τα **κενά** που μένουν για να είναι η ενσωμάτωση πλήρης.

### 1.2. ΕΠΙΒΕΒΑΙΩΜΕΝΗ ρίζα (test Giorgio 2026-05-29)

Ο Giorgio: εισήγαγε κάτοψη **ολόκληρου ορόφου** μέσω του wizard (Floating panel → Επίπεδα → «Εισαγωγή κάτοψης»), πρόσθεσε **2 BIM τοίχους + 1 άνοιγμα**, πήγε στην καρτέλα Επιμετρήσεις του κτιρίου → **τίποτα**.

Root cause (επαληθευμένο στον κώδικα):

```
FloorplanImportWizard (destination = όροφος)
  → buildDxfImportSaveContext (dxf-import-save-context.ts:23-24)
       entityType==='floor'    → { floorId }        ✅
       entityType==='building' → { buildingId }     (ΔΕΝ έτρεξε)
  → saveContext.buildingId = undefined
  → DxfViewerTopBar.tsx:78  buildingId={saveContext?.buildingId ?? undefined}  → undefined
  → WallPersistenceHost → useWallPersistence
  → persist(): if (companyId && projectId && buildingId)   ← buildingId falsy
       bimToBoqBridge.upsertBoqItemForBim(...)  ΔΕΝ καλείται ποτέ
  → 0 γραμμές στο boq_items
  → MeasurementsTab.getByBuilding(companyId, buildingId) → κενό
```

**Οι τοίχοι/άνοιγμα ΣΩΘΗΚΑΝ κανονικά** (`floorplan_walls` / `floorplan_openings`) — απλώς δεν τροφοδότησαν επιμέτρηση γιατί ο προορισμός «όροφος» δεν περνά `buildingId`. Όταν ο προορισμός είναι «κτίριο», η αλυσίδα δουλεύει. **Αυτό είναι το κενό G3 — επιβεβαιωμένο, όχι θεωρητικό.**

---

## 2. Τρέχουσα αρχιτεκτονική (ΥΠΑΡΧΕΙ — επαληθευμένο στον κώδικα)

### 2.1. Auto-feed bridge (γράψιμο)

`src/subapps/dxf-viewer/bim/services/BimToBoqBridge.ts` (singleton `bimToBoqBridge`):

- **Trigger**: fire-and-forget σε κάθε save/update/delete BIM entity, μέσα στα persistence hooks (`useWallPersistence.ts:302-309, 376, 411-418`, αντίστοιχα slab/column/beam).
- **Output**: γράφει doc στο collection `boq_items` με deterministic id `boq_bim_<entityId>` (idempotent upsert).
- **Πεδία**: `source: 'bim-auto'`, `sourceType: 'bim-auto'`, `measurementMethod: 'bim'`, `sourceEntityId`, `sourceEntityType`, `estimatedQuantity` (από geometry), `unit`, `categoryCode` (ΑΤΟΕ), `scope: 'building'`, `linkedFloorId: null`.
- **Ποσότητα**: `deriveQuantity()` — `pcs`→1, `m2`→`geometry.area`, `m3`→`geometry.volume`.
- **Καθαρό m² τοίχου (G6, ADR-395)**: ο bridge διαβάζει `geometry.area`· το `useWallPersistence` περνά **net** geometry — `computeWallGeometry(params, kind, openings)` αφαιρεί `Σ(opening width × height)` (clamp ≥ 0) από το gross. Openings μαζεύονται από το in-memory scene (`collectWallOpenings`, host `params.wallId`), όχι Firestore query (mirror slab `collectBeamFootprints`). Η scene/Firestore wall geometry **μένει gross** (display/3D άθικτα)· μόνο το BOQ payload είναι net. Net ρέει αυτόματα ΚΑΙ στο parent ΚΑΙ στα multi-layer children (όλα `geometry.area`). Live refresh όταν προστίθεται/σβήνεται άνοιγμα μέσω `bim:opening-persisted` event → wall hook re-BOQ host wall (mirror `bim:beam-persisted`).
- **Multi-layer τοίχοι** (ADR-363 §6.1): 1 parent summary row + N child rows ανά WallDna layer (Revit Material Takeoff pattern).
- **Detach guard**: rows με `detached: true` ΔΕΝ overwriteάρονται (ο χρήστης πήρε χειροκίνητο control).
- **Delete cascade**: `deleteBoqItemForBim()` σβήνει parent + όλα τα child layer rows (skip detached).

### 2.2. ΑΤΟΕ mapping (κατηγοριοποίηση)

`src/subapps/dxf-viewer/bim/config/bim-to-atoe-mapping.ts` — SSoT πίνακας:

| Entity | Keyed by | ΑΤΟΕ codes | Unit |
|--------|----------|-----------|------|
| wall | `params.category` (exterior/interior/partition/parapet/fence) | OIK-3.05 / 3.06 | m² |
| opening | kind (door/window/sliding/french/fixed) | OIK-5.01 / 5.02 | pcs |
| slab | kind (floor/ceiling/roof/ground/foundation) | OIK-2.01 / 2.02 | m³ |
| column | kind (rectangular/circular/L/T/polygon/shear-wall/I-shape) | OIK-2.03 / OIK-12.10 | m³ / kg |
| beam | kind (straight/curved/cantilever) | OIK-2.04 | m³ |
| **stair** (Phase 2 / G1) | **fixed component** (concrete/cladding/handrail) | OIK-2.05 / OIK-5.05 / OIK-12.01 | m³ / m² / m |

`BimEntityType = 'wall' | 'opening' | 'slab' | 'column' | 'beam' | 'stair'` — **6 τύποι**.

**Stair = 3 rows, ΟΧΙ single-entry** (Phase 2 / G1): η σκάλα παράγει **3 ανεξάρτητες** γραμμές BOQ (Revit Material Takeoff pattern) — όχι μία. Δεν περνά από `resolveAtoeMapping`/`BIM_TO_ATOE_MAPPING` (keyed by kind)· χρησιμοποιεί ξεχωριστό `STAIR_COMPONENT_MAPPING` + `resolveStairComponentMapping(component)`. I/O στο `bim/services/stair-boq-sync.ts` (mirror `opening-boq-sync.ts`):
- deterministic ids `boq_bim_<stairId>_concrete` / `_cladding` / `_handrail` → per-row detach guard.
- **Geometry-derived ποσότητες** (`bim/stairs/stair-boq-quantities.ts`), ΟΧΙ από `qto`: το `StairEntity.qto` **δεν γεμίζει ποτέ** στον κώδικα (μόνο type) — επιβεβαιωμένο 2026-05-29· ο bridge είναι ο SSoT (§4.6 / G5). Formulas (από `StairParams` mm):
  - cladding (m²) = `stepCount · tread · width`
  - handrail (m) = `(inner+outer) · stepCount · √(tread²+rise²)`
  - concrete (m³) = waist slab (`κεκλιμένο μήκος · width · 150mm`) + σφήνες σκαλιών· **πάχος πλάκας 150mm σταθερά** (δεν υπάρχει param)· **0 για `steel-grating`/`glass-tread`**.
- Component με ποσότητα 0 → **delete-instead-of-write** (mirror opening delete-when-empty).
- Boy Scout (ίδιο αρχείο): column I-shape `MET-1.01` → `OIK-12.10` (RED test `bim-to-atoe-mapping.test.ts` ζητούσε `/^OIK-/`).

### 2.3. Openings — signature-group (ADR-376 §B.2)

Τα openings **δεν** περνούν από `upsertBoqItemForBim` (warn + skip). Πάνε από `opening-boq-sync.ts` / `opening-boq-grouper.ts` → μία aggregated γραμμή ανά signature (Revit Schedule pattern).

### 2.4. Ανάγνωση — Measurements tab (ADR-175)

- UI: `src/components/building-management/tabs/MeasurementsTabContent.tsx` (+ sub-components `MeasurementsTabContent/BOQ*`).
- Tab registry: `src/config/unified-tabs-factory.ts:489-497` (`id:'measurements'`, icon `ruler`, order 10, component `MeasurementsTabContent`).
- Data: `useBOQItems(building.id, projectId, companyId, uid)` → `boqService.getByBuilding(companyId, buildingId)` (`src/services/measurements/boq-repository.ts`), collection `BOQ_ITEMS`.
- UI features ΗΔΗ: ATOE accordion ανά κατηγορία, `bimAuto` badge, `bimDetached` badge + Detach button, BOQ summary cards (κόστη), floor-gap coverage indicator, φίλτρα, `createRfqFromBoq` → `/procurement/rfqs/new`.
- BIM-feed πεδία στο `BOQItem` (`src/types/boq/boq.ts:181-207`): `sourceType`, `sourceEntityId`, `sourceEntityType`, `detached`, `parentBoqItemId`, `isGroupParent`, `layerIndex`, `materialId`.

### 2.5. Ροή buildingId (ο ακρογωνιαίος λίθος)

```
WallPersistenceHost (props: projectId, floorplanId, buildingId)
  └─ useWallPersistence(...)
       persist() → ... → if (companyId && projectId && buildingId)
                              bimToBoqBridge.upsertBoqItemForBim(...)
```

**`useWallPersistence.ts:302`**: το bridge τρέχει **ΜΟΝΟ αν υπάρχει `buildingId`**. Floorplan χωρίς building link → **καμία** BOQ γραμμή, **σιωπηρά** (χωρίς feedback).

---

## 3. Κενά (τι ΔΕΝ είναι έτοιμο)

| # | Κενό | Επίπτωση | Αρχείο-κλειδί |
|---|------|----------|---------------|
| **G1** ✅ DONE (Phase 2) | **Stair** → 3 BOQ rows (concrete/cladding/handrail). `STAIR_COMPONENT_MAPPING` + `stair-boq-sync.ts` (geometry-derived) + wiring στο `use-stair-persistence` (persist/persistRestore/delete) + `buildingId`/`floorId` props στο `StairPersistenceHost`/`DxfViewerTopBar`. | Σκάλες ΟΡΑΤΕΣ στις Επιμετρήσεις | `bim-to-atoe-mapping.ts`, `stair-boq-quantities.ts`, `stair-boq-sync.ts`, `use-stair-persistence.ts`, `StairPersistenceHost.tsx`, `DxfViewerTopBar.tsx` |
| **G2** ✅ DONE | **Slab-opening = αφαιρετικό κενό, καμία ξεχωριστή γραμμή** (Revit/ArchiCAD). Η geometry-layer logic (`sumSlabOpeningAreasM2` → net `area`/`volume`) υπήρχε ήδη, αλλά το `useSlabPersistence` περνούσε `undefined` σε ΟΛΑ τα `computeSlabGeometry` BOQ paths → τα cutouts ΔΕΝ αφαιρούνταν. Fix: `collectSlabOpenings` + `slabBoqGeometry()` περνά net geometry στο bridge (persist/persistRestore/beam-refeed)· νέο `bim:slab-opening-persisted` live re-feed. Scene/3D μένει gross. | BOQ m³ καθαρό (net volume) | `useSlabPersistence.ts`, `useSlabOpeningPersistence.ts`, `EventBus.ts` |
| **G3** ✅ DONE (Phase 1) | **Import σε όροφο δεν περνά buildingId**: `floorId` ✅ αλλά `buildingId=undefined` → bridge σιωπηρό skip. Fixed: 3-tier resolution (`saveContext` → `Level` → `FLOORS` doc μέσω `useFloorMetadata`) στο `DxfViewerTopBar`. | Η ΑΙΤΙΑ του «δεν εμφανίζεται τίποτα» — ΕΚΛΕΙΣΕ | `DxfViewerTopBar.tsx`, `useFloorMetadata.ts` |
| **G4** | **Καμία backfill / re-sync**: οντότητες σχεδιασμένες πριν υπάρξει bridge/building-link δεν έχουν `boq_items` | Παλιά κτίρια κενά | δεν υπάρχει (μνεία «Phase 6.2+ recovery») |
| **G5** | **Πεδίο `qto`** στο entity σχεδόν αχρησιμοποίητο (μόνο stair το γεμίζει)· το bridge παράγει ποσότητα απευθείας από geometry | Διπλό μονοπάτι αλήθειας | `bim-base.ts`, bridge |
| **G6** ✅ DONE | **Ακρίβεια m² τοίχου**: `computeWallGeometry(params, kind, openings?)` → `area = gross − Σ(w×h)` clamp ≥0, volume follows net. `useWallPersistence` περνά net geometry στο bridge (single + multi-layer)· `bim:opening-persisted` event → live re-BOQ host wall. Scene/3D geometry μένει gross. | BOQ m² καθαρά (Revit/ArchiCAD) | `wall-geometry.ts`, `useWallPersistence.ts`, `useOpeningPersistence.ts`, `EventBus.ts` |
| **G7** ✅ DONE (Phase 1) | **Per-floor attribution**: BIM rows τώρα `scope:'floor'` + `linkedFloorId` όταν floorId γνωστό. Measurements tab ομαδοποιεί ανά όροφο. | Floor-gap indicator βλέπει BIM ανά όροφο | `BimToBoqBridge.ts`, `boq-multi-layer-builder.ts`, `opening-boq-grouper.ts`, `BOQCategoryAccordion.tsx`, `BOQFloorGroup.tsx` |

---

## 4. Πρόταση (Completeness over MVP — προς έγκριση Giorgio)

> Η ενότητα αυτή θα οριστικοποιηθεί **μετά** τις διευκρινίσεις του §6. Παρακάτω η πλήρης (όχι MVP) κατεύθυνση.

1. **G1 Stair feed** ✅ **IMPLEMENTED 2026-05-29** (Giorgio → **πλήρες, 3 γραμμές**): `BimEntityType += 'stair'` + `STAIR_COMPONENT_MAPPING`. **3 BOQ rows ανά σκάλα**:
   - όγκος σκυροδέματος → m³ (**OIK-2.05**)
   - επιφάνεια επένδυσης πατημάτων → m² (**OIK-5.05**)
   - μήκος κουπαστής → m (**OIK-12.01**, μεταλλική)

   Deterministic ids `boq_bim_<stairId>_concrete` / `_cladding` / `_handrail` (per-row detach guard, mirror multi-layer wall). Wiring στο `use-stair-persistence` (mirror walls).

   ⚠️ **Premise correction (code = source of truth, N.0.1)**: το αρχικό plan έλεγε «ο bridge διαβάζει `StairQTO` (netVolume/treadCladdingArea/handrailLinearMeters)». Στον κώδικα όμως το `StairQTO` **ορίζεται μόνο ως type· δεν υπολογίζεται/persist-άρεται ΠΟΥΘΕΝΑ** (`buildStairEntity` & `stairDocToEntity` αφήνουν `qto` undefined). Άρα ακολουθήθηκε το ίδιο το ADR §4.6 (G5): **geometry/params-derived** ποσότητες (όπως wall/slab). ΑΤΟΕ codes = decision Claude (Giorgio: «αποφάσισε εσύ») βασισμένο στον master catalog (`src/config/boq-categories.ts`): OIK-2 Σκυροδέματα, OIK-5 Δάπεδα/Μάρμαρα, OIK-12 Μεταλλικά «κάγκελα/σκάλες». Πάχος πλάκας σκυροδέματος = **150mm σταθερά** (δεν υπάρχει waist param· εύκολη promotion σε `StairParams` follow-up).
2. **G3 buildingId**: όταν λείπει building link σε floorplan με BIM στοιχεία → ορατό warning/CTA («σύνδεσε το σχέδιο με κτίριο για να μετρηθεί»), αντί σιωπηρού skip.
3. **G4 Backfill** ⏬ (Giorgio 2026-05-29 → χαμηλή προτεραιότητα): τα τρέχοντα δεδομένα είναι **δοκιμαστικά/πρόχειρα**, ο Giorgio μπορεί να ξανα-εισάγει κατόψεις ή να ξανα-σχεδιάσει BIM. Άρα η διόρθωση χρειάζεται να δουλεύει για **νέα saves** (G3). Το κουμπί «Re-sync BOQ από BIM» (idempotent, ανά κτίριο, σέβεται detach) παραμένει επιθυμητό αλλά **όχι blocking** — προαιρετικό vNext.
4. **G7 Per-floor** ✅ (Giorgio 2026-05-29 → **ανά όροφο, ξεχωριστά, με σύνολο στο τέλος**): stamp `linkedFloorId` σε ΚΑΘΕ BIM row + Measurements tab ομαδοποίηση ανά όροφο (accordion ισόγειο/Α'/Β'...) + γραμμή «Σύνολο» ανά κατηγορία. Resolve `buildingId` από `floorId` ώστε να αθροίζεται σωστά στο κτίριο.
5. **G2 Slab-opening** ✅ **IMPLEMENTED 2026-05-29**: **καμία ξεχωριστή γραμμή** (industry: Revit/ArchiCAD δεν βγάζουν θετική γραμμή για void). ⚠️ **Premise correction (code = source of truth, N.0.1)**: το αρχικό plan υπέθετε «το άνοιγμα ήδη μειώνει το `slab.netArea`/`netVolume`» — **ΨΕΥΔΕΣ στον κώδικα**. Το `computeSlabGeometry` ΔΕΧΟΤΑΝ `slabOpenings` (1ο optional arg, `sumSlabOpeningAreasM2`) αλλά το `useSlabPersistence` περνούσε `undefined` σε ΚΑΘΕ BOQ path (`persist`, `persistRestore`, `bim:beam-persisted` re-feed) + το `docToEntity` δεν είχε scene access → τα cutouts **δεν αφαιρούνταν** (μόνο beams). Fix (mirror G6 wall): `collectSlabOpenings(scene, slabId)` + `slabBoqGeometry(entity, scene)` → περνά τα cutouts στο `computeSlabGeometry`, net `volume` ρέει στο bridge· νέο `bim:slab-opening-persisted { slabId }` event (`useSlabOpeningPersistence` emit σε persist/delete/restore) → `useSlabPersistence` listener re-BOQ host slab. Scene/Firestore slab geometry μένει gross (display/3D άθικτα), μόνο BOQ payload net.
6. **G5 / G6**: G5 (`qto` field) → καθάρισμα SSoT, ο bridge παραμένει η πηγή ποσότητας (geometry-derived). **G6 ✅ DONE 2026-05-29**: `computeWallGeometry` δέχεται optional `openings` → net area (gross − Σ width×height, clamp ≥0)· `useWallPersistence` recompute net boqGeometry από in-memory scene openings (mirror slab) + `bim:opening-persisted` live re-feed. SSoT helper, και τα 2 bridge paths (single + multi-layer) auto-net. Geometry layer pattern ίδιο με `computeSlabGeometry`.

**Αρχιτεκτονικά invariants**: SSoT (ένα bridge, ένα mapping table), idempotent upserts, detach guard διατηρείται, audit coverage (ADR-379/380) για κάθε νέο writer.

---

## 5. Industry Reference

| Λογισμικό | BIM → Quantities | Pattern |
|-----------|------------------|---------|
| **Revit** | Schedules / Material Takeoff | live, per-element, group by type/material |
| **ArchiCAD** | Interactive Schedule | live, signature aggregation |
| **Vectorworks** | Worksheets | live record→row |
| **Σύγκλιση** | live auto-feed + per-row detach/override | ✅ ταυτίζεται με την υπάρχουσα `boq_items` + `detached` αρχιτεκτονική |

---

## 6. Open Questions (προς Giorgio — θα συμπληρωθούν με τις απαντήσεις)

1. ✅ **ΑΠΑΝΤΗΘΗΚΕ** (2026-05-29): Ο Giorgio εισήγαγε κάτοψη **ορόφου**, πρόσθεσε 2 τοίχους + 1 άνοιγμα, δεν εμφανίστηκε τίποτα. → Root cause G3 επιβεβαιωμένο (βλ. §1.2): import σε όροφο δεν περνά `buildingId`. Άρα κύρια εργασία = floor→building resolution.
2. ✅ **ΑΠΑΝΤΗΘΗΚΕ** (2026-05-29): σκάλες = **πλήρες, 3 γραμμές** (σκυρόδεμα m³ + επένδυση πατημάτων m² + κουπαστή m). Βλ. §4.1.
3. ✅ **ΥΛΟΠΟΙΗΘΗΚΕ** (2026-05-29): κενό πλάκας = **καμία ξεχωριστή γραμμή**· το net volume αφαιρεί πλέον τα cutouts (η premise «μειώνει ήδη» ήταν ψευδής → χρειάστηκε threading). Βλ. §4.5.
4. ✅ **ΛΥΘΗΚΕ μέσω §1.2**: αντί προειδοποίησης, η λύση είναι **auto-resolve `buildingId` από `floorId`** ώστε το import-σε-όροφο να δουλεύει αυτόματα. Προαιρετικό warning αν λείπει και floorId.
5. ✅ **ΑΠΑΝΤΗΘΗΚΕ** (2026-05-29): δεδομένα δοκιμαστικά, μπορεί να ξανα-εισάγει/ξανα-σχεδιάσει → backfill **όχι** προτεραιότητα. Αρκεί να δουλεύουν τα νέα saves. Re-sync = προαιρετικό vNext.
6. ✅ **ΑΠΑΝΤΗΘΗΚΕ** (2026-05-29): **ανά όροφο, ξεχωριστά** (accordion ισόγειο/Α'/Β'...), με γραμμή «Σύνολο» ανά κατηγορία στο τέλος. → G7 = πλήρως μέσα στο scope.

---

## 7. Changelog

| Date | Change |
|------|--------|
| 2026-05-29 | ADR δημιουργήθηκε — Phase 1 Recognition. Τεκμηρίωση υπάρχουσας αλυσίδας BIM→BOQ→Επιμετρήσεις (ADR-363 §6 + ADR-376 §B.2 + ADR-175), εντοπισμός 7 κενών (G1-G7). Καμία υλοποίηση. |
| 2026-05-29 | Root cause επιβεβαιωμένο από test Giorgio (§1.2): import-σε-όροφο δεν περνά `buildingId` → bridge skip → κενή καρτέλα. 4 clarifications με Giorgio: G7=ανά όροφο ✅, G4 backfill=deferred ✅, G1 σκάλες=3 γραμμές πλήρες ✅, G3=auto-resolve buildingId από floorId ✅. G2 slab-opening=προτεινόμενο «καμία γραμμή» (προς επιβεβαίωση). RESEARCH COMPLETE. |
| 2026-05-29 | **G2 IMPLEMENTED** (καθαρό m³ πλάκας — αφαίρεση slab-openings, pending commit). ⚠️ **Premise correction**: το ADR §4.5 υπέθετε ότι το slab netVolume μειωνόταν ήδη — ΨΕΥΔΕΣ· το `useSlabPersistence` περνούσε `undefined` slabOpenings σε `persist`/`persistRestore`/`bim:beam-persisted` re-feed (μόνο beams αφαιρούνταν). Geometry layer (`computeSlabGeometry` + `sumSlabOpeningAreasM2`) υπήρχε ήδη. Fix (mirror G6 wall): νέο `collectSlabOpenings(scene, slabId)` + `slabBoqGeometry(entity, scene)` SSoT helper στο `useSlabPersistence` → περνά net geometry (cutouts + beams + walls) στο bridge σε ΟΛΑ τα paths· νέος `bim:slab-opening-persisted` listener → live re-BOQ host slab. `useSlabOpeningPersistence` emit `bim:slab-opening-persisted { slabId }` σε persist/delete/restore. `EventBus` +1 event type. Scene/Firestore/3D slab geometry μένει gross — μόνο BOQ payload net. MOD: `useSlabPersistence.ts`, `useSlabOpeningPersistence.ts`, `EventBus.ts`. Tests: +3 combined cutout+beam net-volume στο `slab-geometry-beam-deduction.test.ts` (26/27/28) → 95/95 PASS (slab-geometry + slab-opening suites). tsc clean. ΕΚΤΟΣ: 1 pre-existing FAIL `SlabRenderer-with-slab-openings.test.ts` (Firebase auth mock gap, άσχετο). |
| 2026-05-29 | **G6 IMPLEMENTED** (καθαρό m² τοίχου, pending commit). `computeWallGeometry(params, kind, openings?)` → `area = max(0, gross − Σ(w×h)/1e6)`, volume follows net· νέο `OpeningFootprintForDeduction` type + `sumOpeningAreasM2` helper (mirror `sumSlabOpeningAreasM2`). `useWallPersistence`: `collectWallOpenings(scene, wallId)` + `wallBoqEntity()` περνά net geometry στο bridge σε persist/persistRestore· νέος `bim:opening-persisted` listener → live re-BOQ host wall (mirror `bim:beam-persisted`). `useOpeningPersistence` emit `bim:opening-persisted` σε persist/delete/restore με host `wallId`. `EventBus` +1 event type. **Geometry layer pattern ίδιο με slab** — scene/Firestore wall geometry μένει gross (display/3D άθικτα), μόνο BOQ payload net· net ρέει σε parent + multi-layer children. MOD: `wall-geometry.ts`, `wall-types.ts` (area doc), `useWallPersistence.ts`, `useOpeningPersistence.ts`, `EventBus.ts`. Tests: +7 wall-geometry (net/zero/multi/clamp/volume/defensive) + 1 multi-layer net-consistency = 46/46 PASS. tsc clean. |
| 2026-05-29 | **PHASE 2 IMPLEMENTED** (G1 σκάλες, pending commit). 3 BOQ rows ανά σκάλα (concrete OIK-2.05 m³ / cladding OIK-5.05 m² / handrail OIK-12.01 m), deterministic ids `boq_bim_<id>_concrete/_cladding/_handrail`, per-row detach guard + delete-when-zero. **Premise correction**: `StairQTO` δεν υπολογίζεται ποτέ → geometry/params-derived (ADR §4.6/G5), πάχος πλάκας 150mm σταθερά. ΝΕΑ: `stair-boq-quantities.ts` (pure calc) + `stair-boq-sync.ts` (Firestore I/O). MOD: `bim-to-atoe-mapping.ts` (+stair component mapping, +Boy Scout column I-shape MET-1.01→OIK-12.10), `use-stair-persistence.ts` (+buildingId/floorId + bridge calls), `StairPersistenceHost.tsx` + `DxfViewerTopBar.tsx` (+props), `boq.ts` (`sourceEntityType += 'stair'`). Tests: +stair-boq-quantities (10) +stair-boq-sync (15) +stair mapping (4) → 43/43 PASS· RED `bim-to-atoe-mapping` prefix test τώρα GREEN. tsc clean. |
| 2026-05-29 | **PHASE 1 IMPLEMENTED** (pending commit). **G3:** 3-tier buildingId+floorId resolution στο `DxfViewerTopBar` (reuse `useFloorMetadata` → `FLOORS/{id}.buildingId`). **G7:** `floorId` threaded σε `BimBoqContext`/`MultiLayerBuildContext`/`OpeningBoqContext`· payloads stamp `linkedFloorId` + `scope:'floor'` (back-compat `'building'`/null όταν λείπει)· hooks (wall/slab/column/beam/opening + wall-split) περνούν floorId· hosts +`floorId` prop. **Display:** `BOQCategoryAccordion` floor-first (reuse `useFloorsByBuilding`) + νέο `BOQFloorGroup.tsx` + bucket «Γενικά κτιρίου» + per-category totals + i18n `floorGroup.*`. Tests: +3 bridge, +2 opening-grouper (35/35 + grouper PASS)· 2 stale opening tests fixed (logger.warn mock + ADR-376 skip). tsc clean. |
