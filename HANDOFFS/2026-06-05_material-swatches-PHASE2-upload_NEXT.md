# HANDOFF — Μικρογραφίες Υλικών Phase 2 (User Upload, Revit material-browser appearance)

**Ημερομηνία:** 2026-06-05 · **Μοντέλο:** Opus 4.8 · **Mode:** Plan Mode προτεινόμενο

> **ΓΛΩΣΣΑ:** Ο Giorgio γράφει & διαβάζει Ελληνικά. ΑΠΑΝΤΑΣ ΠΑΝΤΑ ΣΤΑ ΕΛΛΗΝΙΚΑ.
> **ΠΟΙΟΤΗΤΑ:** FULL ENTERPRISE + FULL SSOT, σαν Revit. Μηδέν `any`/`as any`/`@ts-ignore`, μηδέν hardcoded strings (i18n SSoT), μηδέν duplicate, αρχεία ≤500 / συναρτήσεις ≤40 γραμμές.
> **COMMIT:** Τα commit τα κάνει **ΜΟΝΟ ο Giorgio** (N.(-1)). Ο agent ΔΕΝ κάνει commit/push.
> **⚠️ SHARED WORKING TREE** με τον ADR-408 MEP agent — δες κανόνες στο τέλος.
> **N.6 ENTERPRISE IDs:** κάθε Storage upload + Firestore write με enterprise id (υπάρχει `generateBimMaterialId`).

---

## 🎯 ΤΙ ΘΑ ΚΑΝΕΙΣ — ΕΠΟΜΕΝΟ TASK (Phase 2)

Το **Phase 1 ΟΛΟΚΛΗΡΩΘΗΚΕ** (μικρογραφίες υλικού στα material dropdowns από τα PBR `albedo.jpg` — swatch == 3D render). Το **Phase 2** προσθέτει **user-facing upload μικρογραφίας** ανά υλικό, αποθηκευμένη σε **ΕΝΑ κεντρικό σημείο κλειδωμένο με `materialId`** (SSoT — όχι per-BIM-type), ώστε ο χρήστης να μπορεί να ανεβάζει δική του εικόνα υλικού (όπως το Revit material browser «Appearance asset → image»).

Όταν ένα `BimMaterial` έχει ανεβασμένη μικρογραφία → αυτή **υπερισχύει** του albedo fallback παντού (dropdowns + κάρτα υλικού). Αν δεν έχει → μένει το Phase-1 albedo/χρώμα.

**ΞΕΚΙΝΑ ΜΕ RECOGNITION (N.0.1):** διάβασε τα αρχεία στον «ΤΕΧΝΙΚΟ ΧΑΡΤΗ» → πρότεινε execution-mode (N.8) + μοντέλο (N.14) → **ρώτησε τον Giorgio με AskUserQuestion τις OPEN DECISIONS** ΠΡΙΝ γράψεις κώδικα.

---

## 🗺️ ΤΕΧΝΙΚΟΣ ΧΑΡΤΗΣ (verified 2026-06-05)

### Α) Phase-1 SSoT που ΗΔΗ υπάρχει (το extension point)
- **Resolver:** `bim/materials/material-thumbnail-resolver.ts` — `slugForMaterialId` / `slugForMaterialCategory` + reactive `materialThumbnailStore` (albedo-URL-by-slug μέσω `resolveTextureUrl`) + hook `useMaterialThumbnailUrl(slug)`. **Σχεδιασμένο Phase-2-ready:** εδώ μπαίνει ο user-upload override ΠΡΙΝ το albedo fallback.
- **Component:** `ui/components/shared/MaterialSwatch.tsx` — props `{ materialId?, category?, className? }`. **Συνιστώμενη επέκταση:** πρόσθεσε optional `thumbnailUrl?: string | null` prop που, όταν υπάρχει, render-άρεται ΑΠΕΥΘΕΙΑΣ (wins over slug). Έτσι ο resolver μένει καθαρός — ο override ρέει από τον consumer που έχει το `BimMaterial` doc.
- **Pure defs:** `bim/materials/material-catalog-defs.ts` (`getMaterialFlatColorHex` fallback χρώμα). Μην το αγγίξεις.
- **Consumers Phase-1:** `SlabDnaEditor.tsx` (πλάκα/στέγη), `MaterialsLibraryPanel.tsx` (MaterialCard), `WallDnaEditor.tsx` (Radix + library/preset/custom).

### Β) `bim_materials` Firestore SSoT (εδώ ζει το `thumbnailUrl`)
- **Types:** `bim/types/bim-material-types.ts` — `BimMaterial` (**ΧΩΡΙΣ `thumbnailUrl` σήμερα**), `SaveBimMaterialInput`, `UpdateBimMaterialPatch`. Firestore απορρίπτει `undefined` → optional = `null` ή conditional spread (mirror υπαρχόντων πεδίων brand/notes).
- **Service:** `bim/services/MaterialLibraryService.ts` — `saveMaterial` (setDoc + `generateBimMaterialId`), `updateMaterial` (setDoc merge). Root collection `COLLECTIONS.BIM_MATERIALS` = `bim_materials`. **system scope = builtin read-only** (δεν δέχεται user thumbnail — μόνο company/project).
- **Hook:** `ui/panels/materials/hooks/useMaterialLibrary.ts` (materials/loading/save/update/remove).
- **Editor UI:** `ui/panels/materials/MaterialEditorDialog.tsx` — Radix Dialog, `FormState` + `buildSaveInput`/`buildUpdatePatch`. **Εδώ μπαίνει το upload field** (preview + κουμπί «Μεταφόρτωση» + «Αφαίρεση»). `fieldset disabled={isBuiltin}` ήδη κλειδώνει τα system.
- **i18n namespace:** `bim-materials` (locale files `src/i18n/locales/el|en/bim-materials.json`).

### Γ) Upload pattern (ΤΟ ΠΡΟΤΥΠΟ — mirror, μη fork)
- **`bim-3d/lighting/hdri-upload.service.ts`** = το ΜΟΝΑΔΙΚΟ user-upload παράδειγμα. Δομή: `validate*File` (ext + max bytes) → `generate*Id` → `build*Path` → `uploadBytes(ref, file, {contentType})` → `getDownloadURL` → result. Typed `*UploadError` με error codes. **Αντίγραψέ το** ως `bim-material-thumbnail-upload.service.ts` (image: png/jpg/webp).
- **Storage path SSoT:** `src/services/upload/utils/storage-path.ts` — υπάρχει `buildBimEnvironmentHdriPath({companyId, envId, ext})` (company-scoped `companies/<companyId>/bim-environments/<id>.<ext>`). **Πρόσθεσε** `buildBimMaterialThumbnailPath({companyId, materialId, ext})`.
- **enterprise-id:** `generateBimMaterialId` υπάρχει ήδη (prefix `bmat`). Το materialId υπάρχει ήδη στο doc — το upload path κλειδώνει με αυτό (single point).

### Δ) Storage rules (πρέπει να προστεθεί path)
- `storage.rules` έχει: `bim-mesh-library/{=**}` (read auth / write super-admin), `bim-texture-library/{=**}` (ίδιο). Αυτά είναι **read-only shared catalogs** — ΟΧΙ για user upload.
- **Χρειάζεται νέο rule** για το user-upload path. Αν company-scoped → mirror το υπάρχον `companies/<companyId>/bim-environments/...` rule (write = company member). **Βρες & αντίγραψε** το hdri/environment rule στο `storage.rules` (CHECK: storage-rules test coverage αν αγγίξεις rules).

### Ε) Firestore rules + allowlist για το `thumbnailUrl`
- `bim_materials` collection rule στο `firestore.rules` — πρόσθεσε `thumbnailUrl` (string|null) στο field allowlist του update/create (mirror brand/notes/atoeArticle).
- Έλεγξε `src/config/audit-tracked-fields.ts` αν τα material fields audit-άρονται (CHECK 3.17 entity-audit) — αν ναι, πρόσθεσε το πεδίο.
- ⚠️ CHECK 3.15 (index) / 3.16 (rules test) ZERO-TOL on touch — αν αγγίξεις firestore.rules πρόσθεσε/τρέξε τα αντίστοιχα tests.

---

## 🧭 ΠΡΟΤΕΙΝΟΜΕΝΗ ΑΡΧΙΤΕΚΤΟΝΙΚΗ (επικύρωσε με Giorgio)

1. **`BimMaterial.thumbnailUrl?: string | null`** (types + SaveBimMaterialInput optional + UpdateBimMaterialPatch + service conditional-spread/merge).
2. **Storage (single point, keyed by materialId):** συνιστώ **company-scoped** `companies/<companyId>/bim-material-thumbnails/<materialId>.<ext>` (mirror hdri — tenant isolation· τα company/project υλικά ΕΙΝΑΙ ήδη company-scoped· system=read-only οπότε δεν χρειάζεται global write). Εναλλακτικά global `bim-material-library/thumbnails/<materialId>.<ext>` (κοινό σε όλες τις εταιρείες, όπως furniture) → **OPEN DECISION**.
3. **Upload service** `bim/services/bim-material-thumbnail-upload.service.ts` (mirror hdri): validate (png/jpg/webp, ~2MB), upload, return `{storagePath, downloadUrl}`. Optional διαγραφή παλιάς εικόνας σε replace.
4. **Editor UI** στο `MaterialEditorDialog`: νέα ενότητα «Μικρογραφία» — preview (`MaterialSwatch thumbnailUrl=...` ή `<img>`) + input file + κουμπιά Upload/Remove· στο save → `thumbnailUrl` στο payload (optimistic).
5. **Override propagation (SSoT):** `MaterialSwatch` παίρνει `thumbnailUrl?` prop (wins). Consumers που έχουν `BimMaterial` (MaterialsLibraryPanel MaterialCard + WallDnaEditor library options) περνούν `material.thumbnailUrl`. Οι DNA preset ids (mat-concrete-c25) ΔΕΝ έχουν doc → μένουν albedo (σωστό).
6. **i18n** `bim-materials`: keys για upload/remove/errors (el+en parity).
7. **Tests:** upload-service validation (format/size/missing-company) + MaterialSwatch override precedence.

---

## ❓ OPEN DESIGN DECISIONS (ρώτησε Giorgio με AskUserQuestion ΠΡΙΝ κώδικα)
1. **Storage scope:** company-scoped `companies/<companyId>/bim-material-thumbnails/` (tenant isolation, mirror hdri) **ή** global `bim-material-library/thumbnails/` (κοινό, όπως furniture);
2. **Override εμβέλεια:** μόνο `MaterialsLibraryPanel` (κάρτα) **ή** ΚΑΙ στα layer-editor library materials (WallDnaEditor bmat_ options) **ή** παντού;
3. **Image specs:** αποδεκτοί τύποι (png/jpg/webp;) + max size (~2MB;) + auto-resize/crop τώρα ή όχι (συνιστώ ΟΧΙ resize Phase 2 — απλό upload);
4. **Replace behaviour:** σε νέο upload, διαγραφή παλιού αρχείου από Storage (cleanup) **ή** overwrite same path;
5. **DNA preset υλικά (mat-concrete κ.λπ.):** να αποκτήσουν κι αυτά upload (θα χρειαζόταν να γίνουν `BimMaterial` docs — linkage) **ή** μόνο τα `bim_materials` library docs έχουν upload (preset μένουν albedo);

---

## ✅ ΤΙ ΟΛΟΚΛΗΡΩΘΗΚΕ — Phase 1 (ΟΛΑ UNCOMMITTED· commit ο Giorgio)

Μικρογραφίες υλικού στα dropdowns από PBR albedo (swatch == 3D render), FULL SSOT.
- tsc **0 δικά μου** (1 pre-existing ξένο: `mesh-to-object3d.ts:124` ADR-411). **35/35 tests PASS** (2 νέα suites + regression MaterialCatalog3D-system-tint + wall-material-catalog).
- ADR-413 **v1.2** changelog + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (ομάδα ADR-413) + memory `project_adr413_material_swatches.md` ενημερωμένα.

### 📁 ΤΑ ΑΡΧΕΙΑ ΤΟΥ PHASE 1 (commit ΜΟΝΟ αυτά, επιλεκτικά)
```
# NEW (5)
src/subapps/dxf-viewer/bim/materials/material-catalog-defs.ts
src/subapps/dxf-viewer/bim/materials/material-thumbnail-resolver.ts
src/subapps/dxf-viewer/bim/materials/__tests__/material-catalog-defs.test.ts
src/subapps/dxf-viewer/bim/materials/__tests__/material-thumbnail-resolver.test.ts
src/subapps/dxf-viewer/ui/components/shared/MaterialSwatch.tsx
# MODIFIED (4 code + 2 docs)
src/subapps/dxf-viewer/bim-3d/materials/MaterialCatalog3D.ts   (extraction — import από pure defs)
src/subapps/dxf-viewer/ui/ribbon/components/SlabDnaEditor.tsx
src/subapps/dxf-viewer/ui/panels/materials/MaterialsLibraryPanel.tsx
src/subapps/dxf-viewer/ui/wall-advanced-panel/sections/WallDnaEditor.tsx   (native→Radix)
docs/centralized-systems/reference/adrs/ADR-413-pbr-textures-parametric-bim.md
local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt
```

---

## ⚠️⚠️ SHARED WORKING TREE — ΚΑΝΟΝΕΣ
- **ΠΟΤΕ `git add -A`.** `git add` ΜΟΝΟ τα δικά σου αρχεία, επιλεκτικά.
- **ΜΗΝ αγγίξεις** `docs/.../adr-index.md` (άλλος agent).
- **ΜΗΝ committ-άρεις MEP αρχεία** (`mep-boiler-*`, `mep-radiator-*`, `grip-parametric-copy.ts`, `enterprise-id-*` αν τα αγγίζει ο MEP agent = ADR-408). ⚠️ Το Phase 2 ΘΑ αγγίξει `enterprise-id` (αν χρειαστεί νέο prefix) + `firestore.rules` + `storage.rules` + `firestore-collections` → **co-edited με MEP/άλλους· συντονισμός Giorgio, git add ΜΟΝΟ specific γραμμές/αρχεία**.
- **Commit: ο Giorgio** (N.(-1)). Μετά την υλοποίηση: update ADR-413 (v1.3) + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + memory (N.15).

## 🧪 TESTS / TSC
- `npx jest "bim/materials/__tests__"` → Phase-1 35 PASS (μετά τα Phase-2 tests: πρόσθεσε upload-service + swatch override).
- `npx tsc --noEmit` (60-90s, background). **Pre-existing (ΑΓΝΟΗΣΕ):** `mesh-to-object3d.ts:124` (ADR-411)· τυχόν MEP WIP errors.

## 📚 ΑΝΑΦΟΡΕΣ
- ADR-413 §2D: `docs/.../ADR-413-pbr-textures-parametric-bim.md` (v1.2 changelog)
- Upload πρότυπο: `bim-3d/lighting/hdri-upload.service.ts` · storage-path: `src/services/upload/utils/storage-path.ts`
- ADR-001 (Radix) · ADR-363 (materials library) · N.6 (enterprise IDs) · N.11 (i18n) · N.15 (tracker)
- Memory: `project_adr413_material_swatches.md` · `project_adr413_pbr_textures.md`
