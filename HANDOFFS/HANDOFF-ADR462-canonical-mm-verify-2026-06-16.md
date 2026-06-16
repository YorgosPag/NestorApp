# HANDOFF — ADR-462 Canonical-mm Units: browser-verify + σταδιακοί έλεγχοι

**Ημερομηνία:** 2026-06-16
**Συντάκτης:** Opus 4.8 (συνεδρία canonical-mm — μόλις ολοκληρώθηκε Phase 1 core)
**Θέμα:** Browser-verify του canonical-mm (ADR-462) σε **καθαρή βάση**, μετά σταδιακοί έλεγχοι. **FULL ENTERPRISE + FULL SSoT + Revit-grade.**

> ⚠️ **ΓΛΩΣΣΑ:** Απαντάς ΠΑΝΤΑ Ελληνικά (CLAUDE.md LANGUAGE RULE).
> ⚠️ **COMMIT/PUSH:** Ο Giorgio τα κάνει, ΟΧΙ εσύ (N.(-1)). ΠΟΤΕ `git add -A`.
> ⚠️ **SHARED WORKING TREE:** Δουλεύει κι άλλος agent (cursor-lag / snap). `git add` ΜΟΝΟ τα δικά σου αρχεία (λίστα στο ΜΕΡΟΣ 4).
> ⚠️ **TSC (N.17):** Πριν τρέξεις `tsc` έλεγξε ότι δεν τρέχει ήδη άλλος. Ένα tsc τη φορά.
> ⚠️ **MODEL (N.14):** δήλωσε μοντέλο & περίμενε «ok». Για verify/μικρά → Sonnet· για νέο subsystem → Opus.
> ⚠️ **i18n (N.11):** κάθε νέο `t('key')` → el ΚΑΙ en ΠΡΩΤΑ.

---

## ΜΕΡΟΣ 0 — ΚΑΤΑΣΤΑΣΗ

**ΟΛΟΚΛΗΡΩΜΕΝΑ & COMMITTED** (προηγούμενη συνεδρία):
- **ADR-461 Special Levels Phase A+B+C+D** — browser-verified (Βήματα 1-7 πέρασαν: badges/count, R2 ύψη, R6 numbering, satellite κάτω+πάνω, R3 delete, C3 DXF levels, C4 ribbon gating). Commits `b3c239f3`/`4418d623`/`5ab8033d`. ⚠️ Ανοιχτό DEFER: ονόματα ειδικών σταθμών δείχνουν **F/SP** αντί Ελληνικά long-name στον πίνακα ορόφων (Phase B `createFloor`).
- **ADR-399 Viewport auto-fit SSoT** — ΕΝΑ `useViewportAutoFit`+`viewport-autofit-policy` αντικατέστησε 3 σκόρπιους triggers. Commits `92d756b9`/`77a51c18`.

**UNCOMMITTED (αυτή η συνεδρία — δικό σου scope):**
- **ADR-462 Canonical-mm Phase 1 core** — 10 jest GREEN, tsc clean. 🔴 **pending browser-verify + commit**.

**UNCOMMITTED (ΑΛΛΟΥ agent — ΜΗΝ τα αγγίξεις):** `ADR-040`, `canvas-v2/layer-canvas/LayerCanvas.tsx`, `systems/cursor/snap-scheduler.ts`, `HANDOFFS/HANDOFF_2026-06-16_cursor-lag-phase3-snap-decouple-revit-grade.md`.

---

## ΜΕΡΟΣ 1 — BASELINE ΒΑΣΗΣ (μετά τη διαγραφή από Giorgio)

Καθαρή βάση. Επέζησαν:
- **companies (1):** `comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757` = «ΠΑΓΩΝΗΣ Ενεργειακή Κατασκευαστική Α.Ε.» (ξαναφτιαγμένη). User: `WKBWEg3DSfcdSbLNJfzGEW3vkct1` (Georgios Pagonis).
- **dxf_viewer_levels (1):** `lvl_d19b84b0-43f6-4482-9941-5e3ca8d6e87e` «Επίπεδο 1» default, `floorId:null`, `sceneFileId:null` (κενό).
- config/settings/system/accounting_*/users/user_* (system data).
- **entity_audit_trail (1)** (residual).
- **ΣΒΗΣΤΗΚΑΝ:** projects, buildings, floors, files, floorplan_columns, floorplan_grid_guides, boq_items, contacts, notifications, search_documents + Storage (πλην system).

→ Δηλαδή: **κανένα κτήριο/όροφος/κάτοψη/BIM**. Καθαρό slate για το canonical-mm verify (ο Giorgio θα ξαναφτιάξει project→building→floors→import).

---

## ΜΕΡΟΣ 2 — ΤΙ ΕΙΝΑΙ ΤΟ ADR-462 (canonical-mm)

**Πρόβλημα που έλυσε:** οι μονάδες λύνονταν ΑΝΑ ΟΡΟΦΟ (`resolveSceneUnits` μάντευε από bounds). Ισόγειο με meter-DXF → BIM κολώνες `sceneUnits:'m'` → 1000× mismatch (μικροσκοπική κολώνα). **Απόφαση Giorgio: full canonical-mm — ΟΛΗ η γεωμετρία πάντα σε χιλιοστά (mm)**, DXF κλιμακώνεται σε mm στο import (όπως Revit σταθερή εσωτερική μονάδα).

**Υλοποίηση (κώδικας=αλήθεια, file:line):**
- `utils/dxf-scene-builder.ts` — `buildScene(content, unitsOverride?)`: μετά parse, `sourceUnits = unitsOverride ?? resolveImportSourceUnits(fromInsunits, bounds)`· `mmFactor = 1/mmToSceneUnits(sourceUnits)`· scale ΟΛΩΝ των coords μέσω **ADR-348 `scaleEntity`** (origin, mmFactor, mmFactor)· recompute bounds· `units:'mm'`. mm-source=identity.
- `utils/scene-units.ts` — NEW `resolveImportSourceUnits(insunits, bounds)`: trust $INSUNITS ΕΚΤΟΣ lying-mm (Greek: $INSUNITS=mm αλλά metre-scale coords → bounds heuristic wins). `resolveSceneUnits` → **trust declared** (incl 'mm'), μηδέν heuristic re-guess (ήταν η ρίζα).
- `io/dxf-import.ts` — `importDxfFile(file, encoding?, unitsOverride?)` → `directParseFileWithEncoding` → `buildScene(content, unitsOverride)` + worker postMessage `unitsOverride`.
- `workers/dxf-parser.worker.ts` — `WorkerMessage.unitsOverride` → `parseDxfContent` → `buildScene`.
- **Server path** `app/api/floorplans/process/floorplan-process.service.ts:86` καλεί `buildScene(content)` ΧΩΡΙΣ override → παίρνει **αυτόματα** το robust `resolveImportSourceUnits` auto-detect (κοινή συνάρτηση). Δηλαδή το lying-mm Greek DXF κλιμακώνεται σωστά **χωρίς** να χρειάζεται wizard override.
- **Consumers αμετάβλητοι:** ~30 `resolveSceneUnits` + ~25 BIM entity `sceneUnits` types παίρνουν 'mm' αυτόματα.
- **Tests:** `utils/__tests__/canonical-mm-units.test.ts` (10 GREEN).

---

## ΜΕΡΟΣ 3 — ΣΤΑΔΙΑΚΟΙ ΕΛΕΓΧΟΙ (browser-verify — ΜΙΑ ΟΔΗΓΙΑ ΤΗ ΦΟΡΑ)

Ο Giorgio θέλει **σταδιακό** verify (μία οδηγία, περιμένεις απάντηση, επόμενη). Σειρά:

1. **Setup:** ξαναφτιάξε project → building → όροφοι (Quick Setup). Επιβεβαίωσε ότι δουλεύει σε καθαρή βάση.
2. **Canonical-mm core:** εισήγαγε τον ξυλότυπο θεμελίωσης (Greek DXF, ~35m) σε έναν όροφο. Επιβεβαίωσε ότι **ΔΕΝ** φαίνεται μικροσκοπικός/σε λάθος κλίμακα (κλιμακώθηκε σε mm).
3. **Κολώνα consistency:** σχεδίασε 40×40 κολώνα στον όροφο-με-κάτοψη **και** σε άδειο όροφο → **ίδιο μέγεθος** + κουμπώνει με την κάτοψη.
4. **Wizard units override (edge):** αν υπάρχει DxfUnitsSelector βήμα, δοκίμασε explicit «μέτρα» → ίδιο σωστό αποτέλεσμα.
5. Μετά: ΑΝ χρειαστεί → display-unit UI (cm/m preference) ή/και απλοποίηση ADR-368 R12/R13 dim-rescues (γίνονται no-op σε mm).

Αν κάτι σπάσει → **Firestore-records-first diagnosis** (MCP· δες ΜΕΡΟΣ 1 για IDs). Μάθημα προηγούμενης: το coordinate-magnitude είναι η αλήθεια της κλίμακας· το $INSUNITS ψεύδεται.

---

## ΜΕΡΟΣ 4 — ΑΡΧΕΙΑ ΓΙΑ COMMIT (git add ΜΟΝΟ ΑΥΤΑ — shared tree)

**ADR-462 (δικά σου):**
- `src/subapps/dxf-viewer/utils/dxf-scene-builder.ts`
- `src/subapps/dxf-viewer/utils/scene-units.ts`
- `src/subapps/dxf-viewer/io/dxf-import.ts`
- `src/subapps/dxf-viewer/workers/dxf-parser.worker.ts`
- `src/subapps/dxf-viewer/utils/__tests__/canonical-mm-units.test.ts` (new)
- `docs/centralized-systems/reference/adrs/ADR-462-canonical-mm-units.md` (new)
- `docs/centralized-systems/reference/adr-index.md` ⚠️ **MIXED/SHARED** — stage ΜΟΝΟ τη γραμμή ADR-462 (όχι τις γραμμές άλλων agents).

**ΟΧΙ δικά σου (άλλος agent, ΜΗΝ stage):** `ADR-040`, `LayerCanvas.tsx`, `snap-scheduler.ts`, `HANDOFF_…cursor-lag…md`.

**Επίσης ενημερωμένα (εκτός git ή local):** `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`, MEMORY (`reference_dxf_units_and_viewport_ssot.md`).

---

## ΜΕΡΟΣ 5 — ΠΡΩΤΑ ΒΗΜΑΤΑ ΝΕΑΣ ΣΥΝΕΔΡΙΑΣ
1. Διάβασε αυτό + ADR-462 + (αν χρειαστεί) ADR-368/369 + `reference_dxf_units_and_viewport_ssot` (MEMORY).
2. Δήλωσε μοντέλο & περίμενε «ok».
3. **PHASE 1 (N.0.1):** re-read τα ΜΕΡΟΣ 2 αρχεία (file:line· κώδικας=αλήθεια — μπορεί ο άλλος agent να άλλαξε κάτι σχετικό με snap/canvas).
4. Ξεκίνα τους σταδιακούς ελέγχους (ΜΕΡΟΣ 3), μία οδηγία τη φορά.
