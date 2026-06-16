# HANDOFF — 2026-06-16 — Feature: «Αντιγραφή κάτοψης σε άλλον όροφο» (cross-floor floorplan duplicate, Revit-grade)

> **Γλώσσα:** απάντα στον Giorgio **στα Ελληνικά** (CLAUDE.md LANGUAGE RULE).
> **Commit:** ΜΟΝΟ ο Giorgio κάνει commit/push (N.(-1)). Εσύ ΔΕΝ committάρεις.
> **⚠️ SHARED WORKING TREE:** μοιράζεται με ΑΛΛΟΝ agent. `git add` **ΜΟΝΟ τα δικά σου αρχεία** — ΠΟΤΕ `git add -A`.
> **Ποιότητα:** FULL ENTERPRISE + FULL SSOT, Revit-grade. **ΠΡΙΝ γράψεις κώδικα → Grep για υπάρχοντα, μην φτιάξεις διπλότυπα** (N.0.2).

---

## 0) ΣΤΟΧΟΣ

Ο χρήστης θέλει να **αντιγράψει μια υπάρχουσα κάτοψη DXF από έναν όροφο σε άλλον** (π.χ. από «Θεμελίωση»
στο «Ισόγειο») χωρίς να ξανανεβάσει χειροκίνητα το αρχείο. Σήμερα ο **μόνος** τρόπος είναι ο οδηγός
(Floorplan Import Wizard). Δεν υπάρχει «Duplicate to floor».

### Γιατί ΔΕΝ δουλεύει το Ctrl+A → Ctrl+C → αλλαγή ορόφου → Ctrl+V (επιβεβαιωμένο από κώδικα)
1. **Δεν υπάρχει Ctrl+V / Paste** — `config/keyboard-shortcuts.ts`: μόνο `Ctrl+C` (copy) + `Ctrl+A` (select-all), κανένα paste/clipboard buffer.
2. **Το Ctrl+C δεν είναι clipboard copy** — `hooks/useDxfViewerState.ts:411` `case 'copy-selected'` → ενεργοποιεί το εργαλείο **`bim-copy`** (AutoCAD COPY: base point → target point, translate **μέσα στον ίδιο όροφο**). Δεν αποθηκεύει τίποτα.
3. **Το `bim-copy` αντιγράφει ΜΟΝΟ BIM entities** (`hooks/tools/useBimCopyTool.ts:30` whitelist: wall/opening/slab/slab-opening/column/beam/stair) — **όχι** raw DXF γεωμετρία (lines/arcs/polylines κάτοψης).
4. Αλλαγή ορόφου → αλλάζει `currentLevelId`/scene → το tool κάνει reset (`useEffect` deactivation καθαρίζει `bimIdsRef`). Καμία cross-floor μεταφορά πουθενά.

➡️ Συμπέρασμα: χρειάζεται **νέα ενέργεια** που να επαναχρησιμοποιεί το ΥΠΑΡΧΟΝ import pipeline targeting τον destination όροφο.

---

## 1) RECOGNITION — ΤΙ ΥΠΑΡΧΕΙ ΗΔΗ (SSoT — ΧΡΗΣΙΜΟΠΟΙΗΣΕ ΤΑ, ΜΗΝ ΞΑΝΑΓΡΑΨΕΙΣ)

### 1.1 Wizard (UI + orchestration) — `src/features/floorplan-import/`
| Αρχείο | Ρόλος |
|---|---|
| `FloorplanImportWizard.tsx` | Το modal wizard (steps: upload → entity → property → storage → units) |
| `hooks/useFloorplanImportState.ts` | State machine του wizard |
| `hooks/useFloorplanSmartUpload.ts` | **★ ΚΕΝΤΡΙΚΟ ENTRY POINT** — `uploadSmart(file, opts)` |
| `hooks/floorplan-import-types.ts` | Types |
| `components/Step*.tsx`, `DxfUnitsSelector.tsx` | Wizard steps |
| `index.ts` | Public API του feature |

**`useFloorplanSmartUpload(config)` → `uploadSmart(file)` κάνει ΟΛΟ το pipeline:**
1. `detectFloorplanFormat(file)` → dxf/pdf/image
2. **pre-flight wipe** του target floor: `POST /api/floorplans/wipe-floor { floorId, wipeBim }`
3. **DXF branch** → `legacy.uploadFloorplan(file)` (`@/hooks/useFloorplanUpload`) → cadFiles processor → `POST /api/floorplans/process`
4. PDF/Image branch → `floorplan-backgrounds` API (άσχετο εδώ)

`config: FloorplanUploadConfig` περιέχει `entityType` ('floor'), `entityId` (=floorId), `projectId`, `levelFloorId`.
`resolveFloorId()` → για floor επιστρέφει `config.entityId`.

### 1.2 Server pipeline
| Αρχείο | Ρόλος |
|---|---|
| `src/app/api/floorplans/process/floorplan-process.service.ts` | **DXF download από storage → parse → scene build → upload `.processed.json`/scene** (στα logs: `FloorplanProcessService`) |
| `src/app/api/floorplans/process/route.ts` + `.types.ts` | Route + types |
| `src/app/api/floorplans/wipe-floor/route.ts` | Καθαρισμός ορόφου πριν re-import (`FloorplanFloorWipeService` + `FloorplanCascadeDeleteService`) |
| `src/app/api/cad-files/dual-write-to-files.ts` | **★ File doc upsert SSoT** (write-once `createdAt`/`displayName`, real `layerCount` — μόλις διορθώθηκε FIX#1 ADR-420). ΜΗΝ γράψεις απευθείας στο `files` collection. |
| `src/app/api/cad-files/cad-files.handlers.ts` + `.schemas.ts` | Upsert handler + zod |
| `src/app/api/dxf-levels/` | dxfLevel create/update (στα logs: `DxfLevelsRoute`) |

### 1.3 Services / SSoT helpers
| Αρχείο | Ρόλος |
|---|---|
| `src/services/floorplans/FloorplanProcessor.ts`, `FloorFloorplanService.ts`, `floorplan-save-orchestrator.ts` | Floorplan domain services |
| `src/services/upload/utils/file-display-name-builders.ts` | **`buildFloorplanDisplayName(buildingName, ext, floorLabel, revision)`** → «Κατόψεις Ορόφου - {floorLabel}». ΧΡΗΣΙΜΟΠΟΙΗΣΕ ΑΥΤΟ (όχι hardcoded string — N.11). |
| `src/services/enterprise-id.service.ts` | **`generateFileId()`** (SSoT για `file_xxx` IDs — N.6). ΜΗΝ `crypto.randomUUID()`/`addDoc()`. |
| `src/config/domain-constants.ts` | `ENTITY_TYPES`/`FILE_DOMAINS`/`FILE_CATEGORIES` (floor/construction/floorplans) |
| `src/hooks/useFloorplanUpload.ts` | Το DXF upload pipeline που καλεί ο smart-upload |
| storage path builder | Δες πώς χτίζεται το `companies/{c}/projects/{p}/entities/floor/{floorId}/domains/construction/categories/floorplans/files/{fileId}.dxf` — υπάρχει SSoT path builder (grep `entities/floor` / `categories/floorplans`). **Επαναχρησιμοποίησέ το.** |

### 1.4 Wizard launch (UI)
Από την «καρτέλα επίπεδα» (LevelPanel): `src/subapps/dxf-viewer/ui/components/LevelPanel.tsx` +
`level-panel-hooks.ts`. Εκεί ανοίγει ο wizard. **Το νέο κουμπί/ενέργεια «Αντιγραφή σε όροφο…» πάει εδώ** (ή σε context-menu του level).

---

## 2) ΠΡΟΤΕΙΝΟΜΕΝΗ ΑΡΧΙΤΕΚΤΟΝΙΚΗ (Revit-grade, μέγιστο reuse — ΕΠΙΒΕΒΑΙΩΣΕ ΣΤΟ PLAN)

### Βασική ιδέα: ΜΗΝ φτιάξεις νέο import path — τάισε το ΥΠΑΡΧΟΝ pipeline με τον source DXF, targeting τον destination floor.

Ο `uploadSmart(file)` δέχεται ένα `File`. Άρα η feature χρειάζεται μόνο:
1. **Ανάκτηση του source DXF** ως `File`/`Blob` — download από το source `storagePath` (`files` doc του source floor → `downloadUrl`/`storagePath`).
2. **Κλήση `uploadSmart(sourceFile)`** με `config` του **destination** floor (`entityType:'floor'`, `entityId: destFloorId`, `projectId`).
3. Το pipeline κάνει αυτόματα: wipe destination (αν έχει περιεχόμενο) → `generateFileId()` → νέο `storagePath` → `dual-write-to-files` (σωστό `displayName` για τον dest floor) → process/scene.json → thumbnail → dxfLevel. **Μηδέν νέος κώδικας στον πυρήνα.**

➡️ Η feature γίνεται κυρίως **UI + orchestration glue** (επιλογή source floorplan + dest floor + κλήση uploadSmart). Αυτό είναι το enterprise/SSoT-σωστό: ένα import pipeline, μία SSoT για file docs.

### ⚠️ DESIGN DECISION που ΠΡΕΠΕΙ να πάρεις (πάρ' την μόνος σου, Revit-grade, ζήτα μόνο έγκριση plan — feedback_make_revit_grade_decisions_yourself):
**Τι αντιγράφεται;**
- **(A) Το αρχικό DXF** (source `.dxf` storage object) → ο dest ξανακάνει parse καθαρή αρχική κάτοψη. **Απλό, ντετερμινιστικό. ΣΥΝΙΣΤΩΜΕΝΟ για v1** (ο χρήστης ζήτησε «πανομοιότυπα για δοκιμή»).
- (B) Η **τρέχουσα κατάσταση** (edited `scene.json` + BIM entities) → πιο «Revit duplicate» αλλά απαιτεί αντιγραφή scene.json + re-id όλων των BIM docs (column/beam/wall…) στον dest floor + BOQ. Πολύ μεγαλύτερο scope.
- **Σύσταση:** v1 = (A) αρχικό DXF (καθαρό, μηδενικό ρίσκο). (B) → DEFER ως «Duplicate with BIM» σε επόμενο slice.

### Anti-duplicate guardrails (N.0.2 — ΜΗΝ τα παραβιάσεις)
- ❌ ΜΗΝ γράψεις νέο DXF parse / scene build — υπάρχει στο `floorplan-process.service.ts`.
- ❌ ΜΗΝ γράψεις απευθείας στο `files` collection — χρήσε `cad-files` upsert (`dual-write-to-files`).
- ❌ ΜΗΝ φτιάξεις δικό σου file ID — `generateFileId()`.
- ❌ ΜΗΝ hardcode displayName — `buildFloorplanDisplayName()`.
- ❌ ΜΗΝ φτιάξεις δικό σου storage path string — reuse τον path builder SSoT.
- ✅ Storage→storage copy (αν προτιμηθεί έναντι download+re-upload) → ψάξε υπάρχον storage copy helper πρώτα.

---

## 3) ΒΗΜΑΤΑ (ADR-DRIVEN — N.0.1)

### PHASE 1 — Recognition (ΕΓΙΝΕ ΜΕΡΙΚΩΣ ΕΔΩ· ολοκλήρωσέ το)
1. Διάβασε: `useFloorplanSmartUpload.ts`, `useFloorplanUpload.ts`, `floorplan-process.service.ts`, `dual-write-to-files.ts`, `LevelPanel.tsx`/`level-panel-hooks.ts`.
2. Βρες τον **storage path builder SSoT** (grep `categories/floorplans/files`) + τυχόν **storage copy helper**.
3. Βρες πώς ο wizard περνά `FloorplanUploadConfig` (entityType/entityId/projectId) ώστε να το χτίσεις για τον dest floor.
4. Επιβεβαίωσε αν υπάρχει ήδη «download file as Blob» helper (apiClient/storage signed-url) — μην ξαναγράψεις fetch.

### PHASE 2 — Νέο ADR
- Πάρε τον **επόμενο ελεύθερο ADR αριθμό** (έλεγξε `docs/centralized-systems/reference/adr-index.md` για τον υψηλότερο — ΟΧΙ τον «ADR-370» του CLAUDE.md, είναι παλιός· υπάρχουν ADR-464+).
- Τίτλος π.χ. `ADR-XXX Cross-Floor Floorplan Duplicate`.
- Κατέγραψε: στόχο, reuse pipeline, design decision (A vs B), guardrails.

### PHASE 3 — Implementation (v1 = option A)
- **Orchestration hook** π.χ. `useFloorplanDuplicateToFloor` (ή επέκτεινε υπάρχον level hook) που:
  1. δέχεται `sourceFileId` (ή source floorId) + `destFloorId`
  2. κατεβάζει το source `.dxf` ως `File`
  3. καλεί `uploadSmart(file)` με dest config
- **UI**: κουμπί/ενέργεια «Αντιγραφή κάτοψης σε όροφο…» στο LevelPanel ή context-menu του level → picker dest floor → confirm (δείξε wipe preview αν ο dest έχει περιεχόμενο, reuse `fetchPreview`).
- i18n keys σε `el` + `en` ΠΡΩΤΑ (N.11). Semantic HTML (N.4). No `any` (N.2). ≤500 γρ./αρχείο, ≤40 γρ./function (N.7.1).

### PHASE 4 — Verify (DB + Storage, όπως οι προηγούμενες sessions)
- Firestore MCP: μετά το duplicate → νέο `files` doc στον dest floor με σωστό `entityId`/`displayName`/`storagePath`, `createdAt` write-once, `layerCount>0`.
- Storage: dest floor path έχει `.dxf` + `.processed.json`/scene + `.thumbnail.png`.
- Browser: ο dest floor ανοίγει με την κάτοψη ορατή.

---

## 4) ΠΛΑΙΣΙΟ ΔΟΚΙΜΩΝ (από προηγούμενη session — χρήσιμα IDs)
- Project **ΕΡΓΟ Α**: `proj_12788b6a-ea19-41cd-90a0-a340e6bacaab`, company `comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757`, building `bldg_58f47bf1-4d41-4276-9929-bed8f1aa1a9d`.
- Floors: **Θεμελίωση/F** `flr_c25e29a6-…` (file `file_2bf08dc9-…`), **Ισόγειο** `flr_215e39f3-…` (file `file_80efad96-…`).
- Source DXF δοκιμής: «Ισόγειο 1.dxf» (insunits=4 Millimeters, 1169 raw entities, 7 layers).
- Firestore MCP + Storage MCP δούλεψαν άψογα για baseline/verify.

## 5) ΟΛΟΚΛΗΡΩΜΕΝΑ ΑΥΤΗ ΤΗ SESSION (context — ΜΗΝ τα ξανακάνεις)
- ✅ **FIX#1 ADR-420** auto-save files-doc write-once `createdAt`/`displayName` + real `layerCount` + `countSceneLayers` SSoT — COMMITTED `b947bfaf`, verified.
- ✅ **FIX#2 ADR-186** perf: gate join-preview (`JOIN_PREVIEW_MAX_SELECTION=64` σε `useCanvasEditActions.ts`) → έλυσε FPS-1 + 60s save-timeout σε μαζική διαγραφή — COMMITTED `ef63af7c`, verified (`POST /api/cad-files 408→200 in 1059ms`).
- ✅ **FIX#3** displayName Firestore correction του `file_2bf08dc9-…` → «Κατόψεις Ορόφου - F» (data-only).

---

## ΚΑΝΟΝΕΣ ΠΟΥ ΙΣΧΥΟΥΝ
- Ελληνικά. Commit/push ΜΟΝΟ ο Giorgio. **Shared tree → git add ΜΟΝΟ δικά σου.**
- N.0.2 anti-duplicate· N.6 enterprise IDs· N.11 no hardcoded strings· N.2 no `any`· N.7.1 file/function sizes.
- N.0.1 ADR-driven (recognition → ADR → impl → ADR update). N.15 ενημέρωσε `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + ADR + memory.
- N.17: ΕΝΑ tsc τη φορά (έλεγξε με Get-CimInstance πριν).
- **ΠΡΩΤΑ Grep, μετά κώδικας. Μέγιστο reuse του υπάρχοντος import pipeline.**
