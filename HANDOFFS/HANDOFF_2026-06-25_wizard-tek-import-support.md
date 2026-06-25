# HANDOFF — Υποστήριξη αρχείων Τέκτονα (`.tek`) στο «Εισαγωγή Κάτοψης (Wizard)»

**Ημερομηνία:** 2026-06-25
**ADR:** ADR-526 (Tekton .TEK import/export) — νέα υπο-φάση **Φ4 (Wizard import wiring)**
**Ποιότητα:** Revit-grade, **FULL ENTERPRISE + FULL SSOT**. ΠΡΙΝ γράψεις κώδικα → **πραγματικό SSoT audit (grep)**.

---

## 0. ΑΠΑΡΑΒΑΤΟΙ ΚΑΝΟΝΕΣ (διάβασέ τους ΠΡΩΤΑ)
- **Απαντάς ΕΛΛΗΝΙΚΑ** πάντα.
- **ΟΧΙ commit / ΟΧΙ push** — ο Giorgio κάνει commit, όχι εσύ (N.(-1)). Ετοίμασε, μην committάρεις.
- **Το working tree ΜΟΙΡΑΖΕΤΑΙ με άλλον agent.** Άγγιξε ΜΟΝΟ τα αρχεία του wizard-tek. Μην πειράξεις άσχετες uncommitted αλλαγές (columns/ADR-524 κ.λπ.).
- **N.17 — ΕΝΑ tsc τη φορά** (έλεγξε `Get-CimInstance Win32_Process … *tsc*` πριν τρέξεις· background, μη μπλοκάρεις).
- **ADR-driven (N.0.1):** grep ΚΩΔΙΚΑ πρώτα → implement → ενημέρωσε ADR-526 changelog (νέα Φ4).
- **SSoT πρώτα:** ΜΗΝ ξαναγράψεις λογική import/detection — επαναχρησιμοποίησε τα υπάρχοντα (βλ. §3).

---

## 1. ΤΟ ΖΗΤΟΥΜΕΝΟ
Στο DXF viewer, αριστερό floating panel (αγκυρωμένο) → καρτέλα **«Επίπεδα»** → πλήκτρο **«Εισαγωγή Κάτοψης (Wizard)»**. Αυτό το pipeline **ΔΕΝ δέχεται αρχεία Τέκτονα (`.tek`)** — μόνο DXF/PDF/εικόνες. Ο Giorgio θέλει να μπορεί να φορτώνει `.tek` κι από εδώ (όπως ήδη γίνεται από το ribbon «Εισαγωγή Τέκτονα» της ADR-526 Φ2).

---

## 2. ΤΙ ΕΓΙΝΕ ΗΔΗ ΣΤΗΝ ΑΠΟΘΗΚΗ (context — όλα UNCOMMITTED)
- **ADR-526 Φ1 (IMPORT engine):** `src/subapps/dxf-viewer/io/tek/` — parse `.tek` → `StairEntity` (committed/working).
- **ADR-526 Φ2 (ribbon import):** κουμπί «Εισαγωγή Τέκτονα» → `handleFileImport` (useSceneState) **έχει ΗΔΗ branch `isTekFileName` → `importTekFile`** (γρ. 157-174 `useSceneState.ts`). **Δουλεύει.**
- **ADR-526 Φ3 (EXPORT + preserve-and-replay) — ΑΥΤΗ Η ΣΥΝΕΔΡΙΑ, UNCOMMITTED:** export σκαλών `<stair>` type 21 + preserve-and-replay (import αποθηκεύει αυθεντικό record στο `StairEntity.sourceTekRecord`/`StairDoc.sourceTekRecord`, export το εκπέμπει αυτούσιο). 118 tek+stair jest GREEN, tsc clean. **Μην το χαλάσεις.**

⚠️ Όλα UNCOMMITTED. Ο Giorgio θα κάνει τα commits.

---

## 3. SSoT AUDIT (έγινε σε αυτή τη συνεδρία — ΕΠΑΛΗΘΕΥΣΕ ΤΟ ΜΕ GREP ΠΡΙΝ ΓΡΑΨΕΙΣ)

### Πλήρης ιχνηλάτηση του Wizard pipeline (event → render)
1. `ui/components/LevelPanel.tsx:235` — κουμπί `t('toolbar.importFloorplanWizard')` → `setShowImportWizard(true)` → `<FloorplanImportWizard mode="import" onComplete={handleImportComplete}>` (γρ. 422-428).
2. `handleImportComplete` = **`useFloorplanImportComplete`** (`ui/components/level-panel-hooks.ts:93`).
3. Wizard step 6 = **`StepUpload`** (`features/floorplan-import/components/StepUpload.tsx`) → `<FileUploadZone accept={FLOORPLAN_ACCEPT}>` (γρ. 356-358) → `handleUpload` → `performUpload` → **`smart.uploadSmart(file)`**.
4. **`useFloorplanSmartUpload.uploadSmart`** (`features/floorplan-import/hooks/useFloorplanSmartUpload.ts:210`):
   - `detectFloorplanFormat(file)` (γρ. 109) → **`.tek` ⇒ `'unknown'` ⇒ ΑΠΟΡΡΙΠΤΕΤΑΙ** («Unsupported file format», γρ. 215-219). **← ΕΔΩ ΚΟΒΕΤΑΙ.**
   - dxf → `legacy.uploadFloorplan` (cad/DXF processor)· pdf/image → backgrounds API.
5. Επιτυχία → `onComplete(file, fileId, format, units)` → `handleUploadComplete` (Wizard) χτίζει `WizardCompleteMeta{format}` → `onComplete(file, meta)`.
6. `useFloorplanImportComplete` (level-panel-hooks.ts:150): **gate `if (meta.format && meta.format !== 'dxf') return;`** → μπλοκάρει non-dxf ΠΡΙΝ το render → αλλιώς **`onSceneImported(file, undefined, saveContext, targetLevelId)`**.
7. `onSceneImported` = **`handleFileImport`** (`hooks/scene/useSceneState.ts:157`) → **`isTekFileName(file.name)` → `importTekFile` → render + first-save σκαλών** (StairPersistenceHost). **ΗΔΗ ΥΠΑΡΧΕΙ, ΔΟΥΛΕΥΕΙ.**

### ΣΥΜΠΕΡΑΣΜΑ SSoT (κρίσιμο)
**Η λογική import/render/persist ΥΠΑΡΧΕΙ ΗΔΗ** (Φ1+Φ2). Το μόνο που λείπει είναι ο Wizard να **αφήσει το `.tek` να φτάσει** στο υπάρχον `handleFileImport`. **ΜΗΔΕΝ νέα import λογική.** Reuse:
- **`isTekFileName`** (`io/tek/tek-import.ts:27`, regex `\.tek(\.txt)?$`) → χρησιμοποίησέ το ΚΑΙ στο `detectFloorplanFormat` (ΜΗΝ γράψεις νέο ext check).
- **`importTekFile` / `handleFileImport`** → αμετάβλητα, καλούνται μέσω `onSceneImported` (ήδη wired).
- **`detectFloorplanFormat`** → επέκτεινε (νέο `'tek'`), μην διπλασιάσεις.

---

## 4. ΕΛΑΧΙΣΤΕΣ ΑΛΛΑΓΕΣ (πρόταση — επικύρωσε με grep)

| # | Αρχείο | Αλλαγή |
|---|--------|--------|
| 1 | `src/config/file-upload-config.ts:198` | `FLOORPLAN_ACCEPT` += `.tek` (ώστε ο picker να επιτρέπει επιλογή `.tek`). |
| 2 | `src/features/floorplan-import/hooks/useFloorplanSmartUpload.ts` | (α) `FloorplanFormat` (γρ.52) += `'tek'`· (β) `detectFloorplanFormat` (γρ.109): `if (isTekFileName(file.name)) return 'tek';` **(reuse SSoT)**· (γ) `uploadSmart` (γρ.210): νέο branch `'tek'` ΜΕΤΑ το wipe pre-flight, ΠΡΙΝ το dxf branch → `return { success: true, format: 'tek' }` (ΧΩΡΙΣ DXF/cad processor — το render γίνεται client-side μέσω `onSceneImported`). |
| 3 | `src/subapps/dxf-viewer/ui/components/level-panel-hooks.ts:150` | gate → `if (meta.format && meta.format !== 'dxf' && meta.format !== 'tek') return;` (άσε το `'tek'` να φτάσει στο `onSceneImported`). |
| 4 | i18n (προαιρετικό) | `floorplanImport.acceptedTypes` (locale `files.json`, el+en) → ανάφερε «Τέκτων (.tek)». N.11. |

**ΣΗΜΕΙΩΣΗ tsc τύπων:** η επέκταση του `FloorplanFormat` με `'tek'` ίσως απαιτεί minor handling σε switch/exhaustive σημεία — grep `FloorplanFormat` + `detectFloorplanFormat` consumers πριν.

---

## 5. ΑΝΟΙΧΤΑ ΣΗΜΕΙΑ ΑΠΟΦΑΣΗΣ (ρώτα τον Giorgio αν χρειαστεί)
1. **Αποθήκευση `.tek` ως FileRecord (storage)** για «load mode» (StepStoragePicker) re-load αργότερα; Το ribbon (Φ2) ΔΕΝ αποθηκεύει (client-side render· οι σκάλες persist-άρουν μόνες τους μέσω StairPersistenceHost). **Πρόταση Φ4a:** ίδιο με Φ2 (μηδέν storage), DEFER το storage. Ο DXF/cad processor ΔΕΝ διαβάζει `.tek` → αν χρειαστεί storage, θέλει generic file-upload path (μεγαλύτερο).
2. **Wipe pre-flight για `.tek`:** κράτα το (consistent με dxf — αντικατάσταση περιεχομένου ορόφου). Το `importTekFile` θέτει τη σκηνή· το wipe καθαρίζει το παλιό.
3. **DxfUnitsSelector (μονάδες):** είναι DXF-specific· για `.tek` οι μονάδες είναι **μέτρα** (το `importTekContent` κάνει meters→scene). Άσχετο για `.tek` → ιδανικά κρύψε τον selector όταν το αρχείο είναι `.tek` (minor, optional).
4. **Scope import:** το `importTekFile` είναι **stair-first** (Φ1) — από `.tek` εισάγονται ΜΟΝΟ σκάλες (αρκεί για τα τρέχοντα δείγματα).

---

## 6. TEST PLAN
- **Unit:** `detectFloorplanFormat` → `'tek'` για `.tek`/`.tek.txt`· `uploadSmart` 'tek' branch → `{success, format:'tek'}` χωρίς να καλεί legacy DXF uploader (mock). gate `useFloorplanImportComplete` με `meta.format='tek'` → καλεί `onSceneImported`.
- **Browser (Giorgio):** DXF viewer → Επίπεδα → «Εισαγωγή Κάτοψης (Wizard)» → επίλεξε `.tek` → ολοκλήρωσε wizard → η σκάλα φορτώνεται + αποδίδεται + level wiring.
- tsc (N.17, background).

---

## 7. ΓΡΗΓΟΡΕΣ ΕΝΤΟΛΕΣ
- Wizard tests: `npx jest src/features/floorplan-import --silent`
- tek import tests: `npx jest src/subapps/dxf-viewer/io/tek --silent`
- tek export tests (μην τα σπάσεις): `npx jest src/subapps/dxf-viewer/export/core/tek --silent`
- Δείγματα `.tek` του Giorgio: `C:\Users\user\Downloads\ΜΟΝΟΝ_ΟΡΙΣΜΟΣ_ΣΚΑΛΑΣ_ΟΧΙ_3Δ-2.tek.txt`, `ΣΚΑΛΑ.tek.txt`

---

## 8. ΚΑΤΑΣΤΑΣΗ EXPORT (από αυτή τη συνεδρία — μην το πειράξεις, μόνο context)
Το export σκαλών (Φ3) + preserve-and-replay είναι **code-complete, 118 jest GREEN, tsc clean, UNCOMMITTED**. Round-trip Τέκτων→Νέστωρ→Τέκτων = byte-faithful για εισαγμένες σκάλες. Εκκρεμεί browser round-trip verify + commit (Giorgio).
