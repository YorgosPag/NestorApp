# ADR-462 — Canonical-mm Units (ΕΝΑ unit system, πάντα χιλιοστά)

**Status:** 🟢 Phase 1 (core) Implemented + **BROWSER-VERIFIED** 2026-06-16 (Opus 4.8) — import scaling + resolveSceneUnits trust + tests, tsc clean — **pending commit**
**Επεκτείνει/υπερισχύει:** ADR-368 (per-file drawing-units override) ως προς τη ΣΗΜΑΣΙΑ των μονάδων (render-label → import-scale).
**Σχετικά:** ADR-358 §8 (propagate $INSUNITS), ADR-369 (elevation/units convention).

## 1. Πρόβλημα
Οι μονάδες λύνονταν **ανά σκηνή/όροφο**: `dxfScene.units = userDrawingUnits ?? resolveSceneUnits(scene)`, και το `resolveSceneUnits` **μάντευε** από τη διαγώνιο των bounds (`detectSceneUnits`). Αποτέλεσμα: ίδιο BIM στοιχείο (πάντα σε mm) renderαρόταν σε διαφορετική κλίμακα ανά όροφο.

**Incident (2026-06-16, Giorgio):** Ισόγειο με εισαγμένη κάτοψη θεμελίωσης (bounds ~35 → ανιχνεύθηκε ως **μέτρα**) → οι κολώνες αποθηκεύτηκαν με `sceneUnits:'m'` → μια 40×40 κολώνα φαινόταν **μικροσκοπική** σε σχέση με τους mm-όρόφους (1000× mismatch). Επιβεβαιώθηκε από Firestore (file `…ΘΕΜΕΛΙΩΣΗΣ…`, `processedData.bounds ~35×28`).

## 2. Απόφαση (Giorgio: «full canonical-mm»)
**ΟΛΗ η γεωμετρία αποθηκεύεται σε ΧΙΛΙΟΣΤΑ (mm), πάντα** (όπως το Revit έχει σταθερή εσωτερική μονάδα). Ένα εισαγόμενο DXF **κλιμακώνεται σε mm κατά το import**· δεν επιβάλλει τις δικές του μονάδες. Display unit (cm/m) = ξεχωριστή ρύθμιση (μελλοντικά). Καθαρή βάση (ο χρήστης τη διέγραψε) → μηδέν data migration.

## 3. Υλοποίηση (Phase 1 core)
- **Import scaling SSoT** — `utils/dxf-scene-builder.ts` `buildScene(content, unitsOverride?)`: μετά το parse, βρίσκει τη **source unit** και πολλαπλασιάζει ΟΛΑ τα coordinates σε mm μέσω του **ADR-348 `scaleEntity`** (reuse· χειρίζεται ΟΛΑ τα entity types — μηδέν νέα per-type math). Σφραγίζει `units: 'mm'`, recompute bounds. mm-source → identity (no-op).
- **Robust source detection** — NEW `utils/scene-units.ts` `resolveImportSourceUnits(insunits, bounds)`: εμπιστεύεται το `$INSUNITS` ΕΚΤΟΣ αν δηλώνει `'mm'` ενώ το coordinate-magnitude είναι metre-scale (Greek-DXF lie) → τότε νικά το bounds-heuristic. Priority στο call site: `unitsOverride ?? resolveImportSourceUnits(...)`.
- **resolveSceneUnits trust** — `resolveSceneUnits` επιστρέφει πλέον τη **δηλωμένη** μονάδα (incl. 'mm') ΧΩΡΙΣ heuristic re-guess· heuristic μόνο για legacy/unitless χωρίς δήλωση. (Αυτό ήταν η ρίζα του «μικροσκοπική κολώνα».)
- **Override threading** — `unitsOverride` ρέει client (`importDxfFile`→`directParseFileWithEncoding`→`buildScene`) + worker (`dxf-parser.worker` message). Server path (`floorplan-process.service` → `buildScene`) παίρνει **αυτόματα** το robust auto-detect (κοινή συνάρτηση).
- **Consumers αμετάβλητοι** — οι ~30 `resolveSceneUnits` consumers + ~25 BIM entity types παίρνουν 'mm' αυτόματα → ΟΛΟΙ οι όροφοι ίδια κλίμακα, by construction.
- **Tests:** `utils/__tests__/canonical-mm-units.test.ts` (10): scale m→mm/cm→mm/identity, lying-mm override, resolveSceneUnits trust, buildScene end-to-end. tsc clean.

## 4. Συνέπειες
- ✅ BIM entities συνεπή σε όλους τους ορόφους ενός κτηρίου.
- ✅ Εισαγμένη κάτοψη ευθυγραμμίζεται (κλιμακώνεται σε mm στο import).
- ✅ Καμία ανά-όροφο μαντεψιά μονάδων downstream.
- ⚠️ Edge: μικρό mm detail-drawing (bounds 500–50k) με $INSUNITS=mm → heuristic θα έλεγε 'cm' → ο χρήστης το διορθώνει με wizard override (DxfUnitsSelector, ADR-368). Σπάνιο για floorplans.
- 🔜 DEFER: (α) display-unit preference (cm/m UI), (β) server-route explicit units param (τώρα auto-detect αρκεί), (γ) απλοποίηση παλιών ADR-368 R12/R13 dim-rescues (γίνονται no-op σε mm).

## 5. Changelog
- **2026-06-16 (Opus 4.8):** Phase 1 core implemented (import scaling στο `DxfSceneBuilder.buildScene` via `scaleEntity` SSoT + `resolveImportSourceUnits` + `resolveSceneUnits` trust + override threading client/worker). 10 jest, tsc clean. Pending browser-verify (φρέσκο import → κολώνα σταθερό μέγεθος σε όλους τους ορόφους) + commit.
- **2026-06-16 (Opus 4.8) — BROWSER-VERIFIED (καθαρή βάση, Firestore-first):** 3/3 σταδιακοί έλεγχοι πέρασαν.
  - (1) Setup project→building→όροφοι OK.
  - (2) Import ξυλότυπου θεμελίωσης (`Σ-1_ΞΥΛΟΤΥΠΟΣ_ΘΕΜΕΛΙΩΣΗΣ`, Windows-1253, meter-DXF): bounds **35401×28609 mm = 35.4×28.6 m** (`units:'mm'`)· χαρακτηριστικό μήκος μετρήθηκε **9750 mm = 9.75 m ακριβές** (με snap σε άκρα). Καμία 1000× απόκλιση.
  - (3) Κολώνα 40×40 σε Ισόγειο-με-κάτοψη (`_AfrPolGD`, meter-DXF 21×15m→mm) + σε άδειο όροφο: `col_30b6a07d` → **`sceneUnits:'mm'`** (ΟΧΙ `'m'` — η ρίζα του bug), `width/depth=400`, footprint span **ακριβώς 400 mm**, ίδιο μέγεθος σε όλους τους ορόφους, κουμπώνει με την κάτοψη. Οπτικά + data confirmed.
  - **Συμπέρασμα:** το «κολώνα μικροσκοπική στο Ισόγειο» (1000× mismatch) λύθηκε στη ρίζα — η μονάδα έρχεται από τη σκηνή που είναι πάντα mm, ανεξαρτήτως ορόφου.
