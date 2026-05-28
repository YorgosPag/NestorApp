# ADR-395 — Ενσωμάτωση BIM οντοτήτων στην καρτέλα «Επιμετρήσεις» Κτιρίου

**Status**: 🟢 PHASE 1 IMPLEMENTED 2026-05-29 (pending commit) — G3 (buildingId resolution) + G7 (per-floor) DONE. Phase 2 (G1 σκάλες) εκκρεμεί. Research + 6/7 decisions κλεισμένα (§1.2, §6).
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
| column | kind (rectangular/circular/L/T/polygon/shear-wall/I-shape) | OIK-2.03 / MET-1.01 | m³ / kg |
| beam | kind (straight/curved/cantilever) | OIK-2.04 | m³ |

`BimEntityType = 'wall' | 'opening' | 'slab' | 'column' | 'beam'` — **5 τύποι μόνο**.

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
| **G1** | **Stair** δεν έχει ΑΤΟΕ mapping, ούτε bridge wiring, ούτε κλήση στο persistence hook | Σκάλες αόρατες στις Επιμετρήσεις | `bim-to-atoe-mapping.ts`, stair persistence |
| **G2** | **Slab-opening** δεν έχει mapping/bridge (είναι αφαιρετικό κενό — μειώνει `slab.netArea`) | Design ερώτημα: γραμμή έκπτωσης ή τίποτα; | `slab-geometry.ts`, bridge |
| **G3** ✅ DONE (Phase 1) | **Import σε όροφο δεν περνά buildingId**: `floorId` ✅ αλλά `buildingId=undefined` → bridge σιωπηρό skip. Fixed: 3-tier resolution (`saveContext` → `Level` → `FLOORS` doc μέσω `useFloorMetadata`) στο `DxfViewerTopBar`. | Η ΑΙΤΙΑ του «δεν εμφανίζεται τίποτα» — ΕΚΛΕΙΣΕ | `DxfViewerTopBar.tsx`, `useFloorMetadata.ts` |
| **G4** | **Καμία backfill / re-sync**: οντότητες σχεδιασμένες πριν υπάρξει bridge/building-link δεν έχουν `boq_items` | Παλιά κτίρια κενά | δεν υπάρχει (μνεία «Phase 6.2+ recovery») |
| **G5** | **Πεδίο `qto`** στο entity σχεδόν αχρησιμοποίητο (μόνο stair το γεμίζει)· το bridge παράγει ποσότητα απευθείας από geometry | Διπλό μονοπάτι αλήθειας | `bim-base.ts`, bridge |
| **G6** | **Ακρίβεια m² τοίχου**: η `wall-geometry` δεν αφαιρεί ακόμη τα ανοίγματα (gross αντί net) | BOQ m² ελαφρώς πάνω | `wall-geometry.ts` |
| **G7** ✅ DONE (Phase 1) | **Per-floor attribution**: BIM rows τώρα `scope:'floor'` + `linkedFloorId` όταν floorId γνωστό. Measurements tab ομαδοποιεί ανά όροφο. | Floor-gap indicator βλέπει BIM ανά όροφο | `BimToBoqBridge.ts`, `boq-multi-layer-builder.ts`, `opening-boq-grouper.ts`, `BOQCategoryAccordion.tsx`, `BOQFloorGroup.tsx` |

---

## 4. Πρόταση (Completeness over MVP — προς έγκριση Giorgio)

> Η ενότητα αυτή θα οριστικοποιηθεί **μετά** τις διευκρινίσεις του §6. Παρακάτω η πλήρης (όχι MVP) κατεύθυνση.

1. **G1 Stair feed** ✅ (Giorgio 2026-05-29 → **πλήρες, 3 γραμμές**): επέκταση `BimEntityType` με `'stair'` + νέο `STAIR_MAPPING`. **3 BOQ rows ανά σκάλα** από το υπάρχον `StairQTO`:
   - όγκος σκυροδέματος `netVolume` → m³ (π.χ. OIK-2.0x)
   - επιφάνεια επένδυσης πατημάτων `treadCladdingArea` → m² (επένδυση)
   - μήκος κουπαστής `handrailLinearMeters` → m (μεταλλικά/ξύλινα)

   Deterministic ids `boq_bim_<stairId>_concrete` / `_cladding` / `_handrail` (όπως το multi-layer wall pattern, ώστε ο detach guard να δουλεύει ανά γραμμή). Wiring στο stair persistence (mirror walls).
2. **G3 buildingId**: όταν λείπει building link σε floorplan με BIM στοιχεία → ορατό warning/CTA («σύνδεσε το σχέδιο με κτίριο για να μετρηθεί»), αντί σιωπηρού skip.
3. **G4 Backfill** ⏬ (Giorgio 2026-05-29 → χαμηλή προτεραιότητα): τα τρέχοντα δεδομένα είναι **δοκιμαστικά/πρόχειρα**, ο Giorgio μπορεί να ξανα-εισάγει κατόψεις ή να ξανα-σχεδιάσει BIM. Άρα η διόρθωση χρειάζεται να δουλεύει για **νέα saves** (G3). Το κουμπί «Re-sync BOQ από BIM» (idempotent, ανά κτίριο, σέβεται detach) παραμένει επιθυμητό αλλά **όχι blocking** — προαιρετικό vNext.
4. **G7 Per-floor** ✅ (Giorgio 2026-05-29 → **ανά όροφο, ξεχωριστά, με σύνολο στο τέλος**): stamp `linkedFloorId` σε ΚΑΘΕ BIM row + Measurements tab ομαδοποίηση ανά όροφο (accordion ισόγειο/Α'/Β'...) + γραμμή «Σύνολο» ανά κατηγορία. Resolve `buildingId` από `floorId` ώστε να αθροίζεται σωστά στο κτίριο.
5. **G2 Slab-opening** (προτεινόμενο default — προς επιβεβαίωση): **καμία ξεχωριστή γραμμή**. Το άνοιγμα ήδη μειώνει το `slab.netArea`/`netVolume`, άρα η πλάκα μετριέται καθαρή (industry: Revit/ArchiCAD δεν βγάζουν θετική γραμμή για void). Προϋπόθεση: το slab BOQ row να χρησιμοποιεί `netVolume`, όχι gross.
6. **G5 / G6**: G5 (`qto` field) → καθάρισμα SSoT, ο bridge παραμένει η πηγή ποσότητας (geometry-derived). G6 (wall area − openings) → ακρίβεια, ξεχωριστό follow-up στο `wall-geometry.ts`.

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
3. 🟡 **ΠΡΟΤΕΙΝΟΜΕΝΟ default** (προς επιβεβαίωση): κενό πλάκας = **καμία ξεχωριστή γραμμή** (μειώνει ήδη το net της πλάκας). Βλ. §4.5.
4. ✅ **ΛΥΘΗΚΕ μέσω §1.2**: αντί προειδοποίησης, η λύση είναι **auto-resolve `buildingId` από `floorId`** ώστε το import-σε-όροφο να δουλεύει αυτόματα. Προαιρετικό warning αν λείπει και floorId.
5. ✅ **ΑΠΑΝΤΗΘΗΚΕ** (2026-05-29): δεδομένα δοκιμαστικά, μπορεί να ξανα-εισάγει/ξανα-σχεδιάσει → backfill **όχι** προτεραιότητα. Αρκεί να δουλεύουν τα νέα saves. Re-sync = προαιρετικό vNext.
6. ✅ **ΑΠΑΝΤΗΘΗΚΕ** (2026-05-29): **ανά όροφο, ξεχωριστά** (accordion ισόγειο/Α'/Β'...), με γραμμή «Σύνολο» ανά κατηγορία στο τέλος. → G7 = πλήρως μέσα στο scope.

---

## 7. Changelog

| Date | Change |
|------|--------|
| 2026-05-29 | ADR δημιουργήθηκε — Phase 1 Recognition. Τεκμηρίωση υπάρχουσας αλυσίδας BIM→BOQ→Επιμετρήσεις (ADR-363 §6 + ADR-376 §B.2 + ADR-175), εντοπισμός 7 κενών (G1-G7). Καμία υλοποίηση. |
| 2026-05-29 | Root cause επιβεβαιωμένο από test Giorgio (§1.2): import-σε-όροφο δεν περνά `buildingId` → bridge skip → κενή καρτέλα. 4 clarifications με Giorgio: G7=ανά όροφο ✅, G4 backfill=deferred ✅, G1 σκάλες=3 γραμμές πλήρες ✅, G3=auto-resolve buildingId από floorId ✅. G2 slab-opening=προτεινόμενο «καμία γραμμή» (προς επιβεβαίωση). RESEARCH COMPLETE. |
| 2026-05-29 | **PHASE 1 IMPLEMENTED** (pending commit). **G3:** 3-tier buildingId+floorId resolution στο `DxfViewerTopBar` (reuse `useFloorMetadata` → `FLOORS/{id}.buildingId`). **G7:** `floorId` threaded σε `BimBoqContext`/`MultiLayerBuildContext`/`OpeningBoqContext`· payloads stamp `linkedFloorId` + `scope:'floor'` (back-compat `'building'`/null όταν λείπει)· hooks (wall/slab/column/beam/opening + wall-split) περνούν floorId· hosts +`floorId` prop. **Display:** `BOQCategoryAccordion` floor-first (reuse `useFloorsByBuilding`) + νέο `BOQFloorGroup.tsx` + bucket «Γενικά κτιρίου» + per-category totals + i18n `floorGroup.*`. Tests: +3 bridge, +2 opening-grouper (35/35 + grouper PASS)· 2 stale opening tests fixed (logger.warn mock + ADR-376 skip). tsc clean. |
