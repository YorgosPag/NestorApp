# HANDOFF — ADR-411 Ρεαλιστική ντουζιέρα (καμπίνα): 2D-symbol polish

**Ημερομηνία:** 2026-06-08
**Μοντέλο:** Opus 4.8 (Plan Mode — 2D rendering + geometry, ~3-5 αρχεία)
**Σχετικά ADR:** ADR-411 (mesh library), ADR-409 §B-θετικό.2 (credits), ADR-408 Φ14 (sanitary fixtures)

---

## ✅ ΤΙ ΔΟΥΛΕΥΕΙ ΗΔΗ (μην το ξαναφτιάξεις)

Η ρεαλιστική ντουζιέρα είναι **end-to-end λειτουργική**, browser-verified από Giorgio:
- **3D:** πραγματική καμπίνα ντουζιέρας (γυάλινη πόρτα/τοιχώματα/βρύση/σιφόνι), σωστή κλίμακα ~1.30×1.05×2.26m. ✅ «σωστή».
- **Asset:** `bim-mesh-library/sanitary/shower_realistic_01.glb` (5.3MB) στο Storage `pagonis-87766.firebasestorage.app`. **«Shower Cabin» by Heliona, CC-BY**, sketchfab.com/3d-models/shower-cabin-e2c6a8dd490e4e4398378e1f6c9121a8. Ήδη σε real-world meters → **μηδέν scale normalization**.
- **Credits:** Settings → «Άδειες & Αναφορές» δείχνει τη Heliona CC-BY. ✅
- **Picker:** «3Δ Όψη» (Παραμετρικό ↔ Ρεαλιστική) δουλεύει· kind-guard OK.
- **2D silhouette:** εμφανίζεται το αυτόματο top-view περίγραμμα του mesh (διορθώθηκε bug: ο renderer ψάχνει πλέον category `'sanitary'` μέσω κοινού SSoT `resolveFixtureMeshCategory`).
- **Tests:** 84/84 mep-fixture + 10/10 νέα (asset-credits, sanitary-mesh-catalog). tsc 0 δικά μου.

**🔴 PENDING COMMIT** (Giorgio) — όλα τα παρακάτω αρχεία είναι uncommitted στο κοινό tree.

---

## 🎯 ΤΙ ΜΕΝΕΙ — 3 ΖΗΤΗΜΑΤΑ 2D POLISH (απόφαση Giorgio: ξεχωριστό session)

Από browser screenshot (2026-06-08 121534), σε top-view 2D:

### 1. Footprint size mismatch (selection/hover box ≠ mesh)
Το selection/grip/hit-test box χρησιμοποιεί `params.width/length` = **900×900** (από `SANITARY_SPEC.shower`), ενώ το mesh είναι **~1300×1050**. → το κίτρινο box δεν ταιριάζει με το πορτοκαλί mesh.
- **Πιθανή λύση:** όταν διαλέγεται mesh asset, ο picker (`useRibbonMepFixtureBridge` onComboboxChange assetId) να θέτει ΚΑΙ `width/length` από τις διαστάσεις του `SANITARY_MESH_CATALOG` preset (widthMm/depthMm). Ή νέο πεδίο «mesh footprint» που υπερισχύει στο geometry/grips. Προσοχή: αλλάζει footprint→connector position (αποχέτευση) + grips.

### 2. Mesh origin offset (silhouette μετατοπισμένο από το insertion point)
Η αρχή του glTF δεν είναι κεντραρισμένη στο footprint (artist off-center· bbox Y span ήταν −0.48→1.78, X/Z επίσης off-center). Το silhouette ζωγραφίζεται στο `params.position + mesh-local points` → offset.
- **Πιθανή λύση:** recenter X/Z του mesh στο footprint κέντρο — **ΣΥΓΧΡΟΝΑ σε 3D (`mesh-to-object3d.ts` placement) ΚΑΙ 2D (silhouette transform)** ώστε να μη ξεσυγχρονιστούν. Υπολόγισε bbox center (Box3) και αφαίρεσέ το, όπως ήδη γίνεται για το Y anchor. Δες `bim-3d/converters/mesh-to-object3d.ts` (anchorY logic ~γρ.96) + `bim/mesh-library/mesh-silhouette.ts` (computeTopSilhouette/computeTopEdges).

### 3. Silhouette γραμμές δεν κλείνουν (ανοιχτά τμήματα)
Το auto top-edges extraction βγάζει ασύνδετα segments σε σύνθετο mesh (γυάλινη πόρτα/βρύση).
- **Πιθανές λύσεις:** (α) βελτίωση του silhouette/edge extraction (merge coincident endpoints, κλείσιμο outer loop)· ή (β) **per-asset authored 2D σύμβολο** (Revit-grade: clean κάτοψη ντουζιέρας — τετράγωνο + διαγώνια πόρτα + σιφόνι) αντί για auto-silhouette, με flag στο catalog. Δες `bim/mesh-library/mesh-silhouette.ts` + `bim/renderers/mesh-silhouette-draw.ts`.

---

## 📁 ΑΡΧΕΙΑ ΠΟΥ ΑΛΛΑΞΑΝ ΑΥΤΟ ΤΟ SESSION (uncommitted, git add ΜΟΝΟ αυτά)

**Slice 2 (shower mesh):**
- `bim/mep-fixtures/sanitary-fixture-mesh-catalog.ts` (NEW· Heliona CC-BY, dims 1300×1050×2260)
- `bim/mep-fixtures/__tests__/sanitary-fixture-mesh-catalog.test.ts` (NEW)
- `bim-3d/converters/mep-fixture-to-mesh.ts` (MOD· kind-routing + κοινό helper)
- `bim/types/mep-fixture-types.ts` (MOD· NEW `resolveFixtureMeshCategory` SSoT)
- `bim/renderers/MepFixtureRenderer.ts` (MOD· silhouette category fix via helper)
- `ui/ribbon/hooks/bridge/mep-fixture-command-keys.ts` (MOD· stringParams.assetId)
- `ui/ribbon/hooks/useRibbonMepFixtureBridge.ts` (MOD· assetId handling + kind-guard + SELECT_CLEAR_VALUE)
- `ui/ribbon/data/contextual-mep-sanitary-fixture-tab.ts` (MOD· «3Δ Όψη» combobox)

**Slice 1 (credits):**
- `bim/licensing/asset-credits.ts` (NEW) + `__tests__/asset-credits.test.ts` (NEW)
- `ui/components/CreditsDialog.tsx` (NEW)
- `ui/ribbon/data/settings-tab-credits.ts` (NEW)
- `ui/ribbon/data/ribbon-default-tabs.ts` (MOD)
- `ui/ribbon/components/buttons/RibbonButtonIcon.tsx` (MOD· 'info' icon)
- `app/useDxfViewerUiState.ts`, `app/useDxfViewerCallbacks.ts`, `app/DxfViewerContent.tsx`, `app/DxfViewerDialogs.tsx`, `app/dxf-viewer-lazy-components.tsx` (MOD· dialog wiring)
- `i18n/locales/{el,en}/dxf-viewer-shell.json` (MOD)

**Docs/tracking:** ADR-411 v1.2, ADR-409 v1.6, local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt, memory.

---

## ⚠️ ΚΡΙΣΙΜΟ ΠΛΑΙΣΙΟ
- 🌐 **Γλώσσα: ΕΛΛΗΝΙΚΑ.** 🚫 **COMMIT/PUSH μόνο ο Giorgio** (N.-1). 🌳 **Shared tree** — `git add` ΜΟΝΟ δικά σου, ΠΟΤΕ `-A`.
- **ΕΚΤΟΣ ADR-040** (κανένα canvas micro-leaf· ο MepFixtureRenderer είναι ήδη ADR-040-safe getState-at-draw).
- **Storage upload:** ο agent ΜΠΟΡΕΙ μέσω `gcloud storage cp ... gs://pagonis-87766.firebasestorage.app/...` (με άδεια Giorgio· gsutil ΟΧΙ — Python 3.13). MCP storage tool = text-only + ΑΛΛΟ bucket (μόνο `companies/`).
- **Sketchfab download:** μέσω API token (`api.sketchfab.com/v3/models/<uid>/download` → `glb` key). Token ήταν `4f345...` (πες στον Giorgio να το κάνει regenerate αν δεν το έκανε).
