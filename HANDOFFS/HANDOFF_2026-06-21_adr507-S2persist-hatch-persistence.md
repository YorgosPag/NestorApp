# HANDOFF — ADR-507 S2-persist: Hatch Persistence (floorplan_hatches)

> **Ημερομηνία:** 2026-06-21
> **ADR:** ADR-507 (hatch) + **ADR-420** (per-kind floorplan_* persistence)
> **Προηγούμενα:** S1 (core)·S2 (tool wiring)·S2-fix (render-pipeline 4 σημεία + FSM point-cap). Όλα UNCOMMITTED.
> **Bug που λύνει:** η γραμμοσκίαση **εξαφανίζεται μετά από refresh** (δεν persistάρει).

---

## 🔴 ΡΙΖΑ (επιβεβαιωμένη)

Η persistence του DXF viewer ΔΕΝ γίνεται στο `floorplan_overlays` (αυτό = παλιό ADR-340 overlay σύστημα, **dormant** — γι' αυτό δεν δημιουργείται καν η συλλογή· `persistToOverlays`/`useOverlayPersistence` **δεν καλούνται πουθενά** στο drawing flow).

Ο **πραγματικός** μηχανισμός = **ADR-420: per-kind `floorplan_*` collections**, μία ανά τύπο entity, keyed-by-floorId:
- `floorplan_walls`, `floorplan_columns`, `floorplan_slabs`, **`floorplan_floor_finishes`**, … (όλα στο `src/config/firestore-collections.ts`).
- Load: `bim/persistence/cross-floor-bim-loader.ts` `loadFloorBimEntities()` (per-kind loader registry).
- Save: per-type firestore-service + persistence hook (debounced auto-save).

**Το hatch δεν έχει collection/service/loader/hook → δεν σώζεται.**

## 🎯 ΑΠΟΦΑΣΗ ΑΡΧΙΤΕΚΤΟΝΙΚΗΣ (Revit-aligned)
Η γραμμοσκίαση = Revit **Filled Region** = persisted view annotation **element** (έχει id, σώζεται). Άρα → **δική της `floorplan_hatches` collection**, mirror του **floor-finish** (το πιο κοντινό analog: area/fill entity). **ΟΧΙ** `floorplan_overlays`.

⚠️ Σημείωση: το hatch υλοποιήθηκε ως **generic primitive (path A)** — flat `HatchEntity` με `boundaryPaths`, ΧΩΡΙΣ `kind/params/geometry/validation`. Το floor-finish είναι BIM-shape (kind/params/geometry). Ο loader/service θα χειριστεί το flat hatch shape (δες §doc type) — μη το ζορίσεις σε BIM shape.

---

## 📋 ΤΙ ΝΑ ΦΤΙΑΞΕΙΣ (mirror floor-finish, 6 σημεία)

Πρότυπο για ΟΛΑ → ψάξε με grep αυτά τα floor-finish αρχεία και καθρέφτισέ τα:

| # | Floor-finish πρότυπο | Hatch (NEW/edit) |
|---|---|---|
| 1 | `config/firestore-collections.ts` `FLOORPLAN_FLOOR_FINISHES` (:372) | +`FLOORPLAN_HATCHES = 'floorplan_hatches'` |
| 2 | `bim/floor-finishes/floor-finish-firestore-service.ts` (CRUD + `FloorFinishDoc` type· enterprise-id `setDoc`, N.6) | NEW `bim/hatch/hatch-firestore-service.ts` (+`HatchDoc`) |
| 3 | `hooks/data/useFloorFinishPersistence.ts` (500ms debounced auto-save + first-save on `drawing:entity-created`/`drawing:complete`) | NEW `hooks/data/useHatchPersistence.ts` |
| 4 | `bim/persistence/cross-floor-bim-loader.ts` (loader registry entry + `loadFloorBimEntities` include) | +hatch loader entry |
| 5 | `firestore.rules` (rules block για `floorplan_floor_finishes`: default-deny, companyId tenant isolation, validation) | +`floorplan_hatches` rules block |
| 6 | wiring: όπου καλείται το `useFloorFinishPersistence` (DxfViewerContent/effects) | wire `useHatchPersistence` δίπλα |

**ΠΡΟΣΟΧΗ enterprise-id (N.6):** `setDoc()` + id από `enterprise-id.service` — χρειάζεται prefix/generator για hatch (αν δεν υπάρχει, δημιούργησέ τον ΠΡΩΤΑ). Το hatch entity id είναι ήδη `entity_N` (transient) — για Firestore doc χρειάζεσαι enterprise id (δες πώς το κάνει το floor-finish service).

**Firestore indexes:** οι γενικοί `floorplan_*` δείκτες (companyId/floorId) αρκούν· πιθανώς να χρειαστεί 1 composite όμοιος με floor-finish — δες `firestore.indexes.json` για το `floorplan_floor_finishes` pattern και καθρέφτισε αν χρειάζεται.

## ⚠️ ΚΑΝΟΝΕΣ
- COMMIT = Giorgio. ΕΝΑ tsc (N.17). Jest από root. Shared tree (άλλος agent σε beam/structural — μη τα αγγίξεις· τα 10 tsc errors beam/foundation ΕΙΝΑΙ ΔΙΚΑ ΤΟΥ).
- Firestore rules = security domain → πρόσεξε tenant isolation (companyId) + default-deny (mirror floor-finish rules ακριβώς).
- Browser-verify: σχεδίασε hatch → refresh → πρέπει να ΠΑΡΑΜΕΝΕΙ· έλεγξε ότι δημιουργείται `floorplan_hatches` collection με σωστό companyId/floorId.

## Μετά (N.15): ADR-507 changelog «S2-persist» + ΕΚΚΡΕΜΟΤΗΤΕΣ + ADR-420 (αν αναφέρει τη λίστα persisted kinds).
