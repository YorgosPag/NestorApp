# HANDOFF — ADR-411 Realistic Sanitary Mesh Library (Revit-grade content library)

**Ημερομηνία:** 2026-06-08
**Μοντέλο:** Opus 4.8 (Plan Mode — content library + per-kind picker, ~5-8 αρχεία)
**Σχετικά ADR:** ADR-411 (mesh library), ADR-409 §B-θετικό.2 / §D.1 (licensing/credits), ADR-408 Φ14 (sanitary fixtures)
**Στόχος Giorgio:** «Όπως οι μεγάλοι παίκτες, όπως η Revit. FULL ENTERPRISE + FULL SSOT.»

---

## ⚠️ ΚΡΙΣΙΜΟ ΠΛΑΙΣΙΟ (διάβασέ το ΠΡΩΤΟ)
- 🌐 **Γλώσσα: ΕΛΛΗΝΙΚΑ πάντα.**
- 🚫 **COMMIT/PUSH μόνο ο Giorgio** (N.-1). Ο agent ΔΕΝ κάνει commit/push.
- 🌳 **SHARED working tree με άλλον agent** → `git add` **ΜΟΝΟ τα δικά σου αρχεία**, **ΠΟΤΕ `git add -A`**.
- **ΕΚΤΟΣ ADR-040** (ο `MepFixtureRenderer` είναι ήδη ADR-040-safe getState-at-draw· κανένα canvas micro-leaf).
- **N.17:** ΕΝΑ `tsc` τη φορά (έλεγξε `wmic process where "name='node.exe'" get commandline | grep tsc` πριν).
- **N.15:** μετά από υλοποίηση → ενημέρωσε `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + ADR-411 changelog + memory.

---

## ✅ ΤΙ ΕΓΙΝΕ ΑΥΤΟ ΤΟ SESSION (uncommitted — ο Giorgio θα κάνει commit)

### A) ADR-411 2D-symbol polish ντουζιέρας (3 ζητήματα, browser-iterated με Giorgio)
- **#1 footprint mismatch:** ο picker (`useRibbonMepFixtureBridge` assetId branch) υιοθετεί το authored footprint του preset (`width=widthMm`, `length=depthMm`, `shape='rectangular'`) → selection box/grips/hit-test/σιφόνι ευθυγραμμίζονται με το mesh. Clear=κρατά footprint (χωρίς revert).
- **#2 mesh origin offset:** NEW pure `bim-3d/library/bim-mesh-library/mesh-footprint-recentre.ts` (`recentreMeshFootprint`): wrapper Group με X/Z bbox-center στο local origin (Y ανέπαφο=anchor). Το `bim-mesh-cache.preload` recenter ΠΡΙΝ το cache → **ίδιο template** σε 3D (`getInstance`) ΚΑΙ 2D (`computeTopSilhouette/Edges`) → αδύνατο desync.
- **#3 top-view:** ο `MepFixtureRenderer` δείχνει **πλήρη πραγματική mesh κάτοψη** (εξωτ. περίγραμμα **ΣΥΝ** interior feature edges) για όλα τα mesh fixtures. **+proactive preload-on-miss** (αν assetId χωρίς cached silhouette → `bimMeshCache.preload` fire-and-forget→repaint· εμφανίζεται ΠΑΝΤΑ στο 2D ακόμη χωρίς 3D viewport).
  - ⚠️ **2 ΜΑΘΗΜΑΤΑ Giorgio:** (a) 1η προσπάθεια αντικατέστησε silhouette με σχηματικό authored σύμβολο → «δεν φαίνεται το top-view» → ρεαλιστική κάτοψη. (b) 2η έδειχνε μόνο περίγραμμα (`edges:null`) → «θέλω και τις λεπτομέρειες» → πλήρες silhouette+edges. **ΟΤΑΝ Ο ΧΡΗΣΤΗΣ ΖΗΤΑ ΡΕΑΛΙΣΜΟ, ΔΕΙΞΕ ΟΛΗ ΤΗ ΡΕΑΛΙΣΤΙΚΗ ΓΕΩΜΕΤΡΙΑ — μην «καθαρίζεις» σε σχηματικό χωρίς έγκριση.**

### B) Shower mesh library επέκταση (+2 CC-BY μοντέλα)
- Catalog `bim/mep-fixtures/sanitary-fixture-mesh-catalog.ts`:
  - `shower_realistic_01` (Heliona cabin) → **ακριβείς μετρημένες dims** 1304×1049×2263 (μετρήθηκαν με three/node από το glb· local origin off-centre X +347mm).
  - **NEW** `shower_tray_01` (Ivan.Ivanov, CC-BY) 1254×1254×300.
  - **NEW** `shower_tray_02` (marcin_malcherek FREE, CC-BY) 900×900×45 slim (origin στη γωνία +450mm X).
- i18n el/en `mepFixture.catalog.showerTray01/02` + relabel `showerRealistic01`→«Καμπίνα».
- **Credits ΑΥΤΟΜΑΤΟ** (το `asset-credits.ts` παράγει από `SANITARY_MESH_CATALOG[].source` — μηδέν χειροκίνητο· format string: `"<Title> by <Author> (CC-BY) — <url>"` με em-dash —).
- **Storage uploads** (gcloud, με άδεια Giorgio): `bim-mesh-library/sanitary/shower_tray_01.glb` + `shower_tray_02.glb`.

### Tests / tsc
- **33/33** (mesh-footprint-recentre 6 + bridge 3 + symbol + silhouette) + **9/9** (catalog + asset-credits). **tsc 0** (μόνο pre-existing `mesh-to-object3d.ts:124`, ΟΧΙ δικό μου).

### 📁 Αρχεία που άλλαξαν (git add ΜΟΝΟ αυτά)
```
NEW  src/subapps/dxf-viewer/bim-3d/library/bim-mesh-library/mesh-footprint-recentre.ts
NEW  src/subapps/dxf-viewer/bim-3d/library/bim-mesh-library/__tests__/mesh-footprint-recentre.test.ts
MOD  src/subapps/dxf-viewer/bim-3d/library/bim-mesh-library/bim-mesh-cache.ts
MOD  src/subapps/dxf-viewer/bim/renderers/MepFixtureRenderer.ts
MOD  src/subapps/dxf-viewer/ui/ribbon/hooks/useRibbonMepFixtureBridge.ts
MOD  src/subapps/dxf-viewer/ui/ribbon/hooks/__tests__/useRibbonMepFixtureBridge.test.tsx
MOD  src/subapps/dxf-viewer/bim/mep-fixtures/sanitary-fixture-mesh-catalog.ts
MOD  src/i18n/locales/el/dxf-viewer-shell.json
MOD  src/i18n/locales/en/dxf-viewer-shell.json
DOC  docs/centralized-systems/reference/adrs/ADR-411-bim-mesh-library.md (v1.3 + v1.4)
DOC  local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt
```

---

## 🔴 ΕΚΚΡΕΜΟΤΗΤΑ ΑΜΕΣΗ (verify πρώτα)
**Τα 2 νέα shower trays ΔΕΝ φαίνονταν στο dropdown «3Δ Όψη»** — ο dev server σέρβιρε **stale build** (`THREE_D_VIEW_OPTIONS` υπολογίζεται at module-init στο `contextual-mep-sanitary-fixture-tab.ts`· το Fast Refresh δεν πρόλαβε το dependent module όταν άλλαξε ο catalog).
👉 **Ο Giorgio κάνει restart τον dev server (`npm run dev`).** Μετά το restart, το dropdown πρέπει να δείχνει **4 επιλογές**: Παραμετρικό · Ρεαλιστική Καμπίνα · Ντουζιέρα Τετράγωνη 125×125 · Ντουζιέρα Slim 90×90.
- **VERIFY μετά το restart.** Αν λείπουν ακόμη → `rm -rf .next` + restart.

---

## 🎯 ΤΙ ΜΕΝΕΙ — ΚΥΡΙΟ TASK ΕΠΟΜΕΝΟΥ SESSION

**Επέκταση της ρεαλιστικής mesh βιβλιοθήκης σε ΟΛΑ τα είδη υγιεινής (WC / νιπτήρας / μπανιέρα / μπιντές) — Revit-grade content library. FULL ENTERPRISE + FULL SSOT.**

### 1) 🏗️ ENTERPRISE/SSOT ΑΡΧΙΤΕΚΤΟΝΙΚΟ FIX (κάνε το ΠΡΩΤΟ — προαπαιτούμενο)
**Per-kind φιλτράρισμα του picker (Revit-correct).** Σήμερα το `THREE_D_VIEW_OPTIONS` είναι **στατική λίστα ΟΛΩΝ** των catalog entries, που εμφανίζεται για **κάθε** sanitary fixture. Όταν μπουν WC models, μια **λεκάνη WC θα δείχνει και επιλογές ντουζιέρας** (λάθος· Revit δείχνει μόνο τύπους της ίδιας family). Ο bridge ήδη κάνει kind-guard στο select (no-op), αλλά το **dropdown πρέπει να φιλτράρει** με το υπάρχον SSoT `sanitaryMeshPresetsForKind(kind)`.
- **Πρόκληση:** τα ribbon tabs είναι **στατικό config** → οι per-selection επιλογές πρέπει να ρέουν μέσω του **bridge `getComboboxState`** (που τώρα επιστρέφει `options: []` για το assetId). 
- **Πρόταση (έλεγξε πρώτα τον κώδικα = source of truth):** ο `getComboboxState(assetId)` να επιστρέφει `{ value, options: [Παραμετρικό, ...sanitaryMeshPresetsForKind(fixture.kind).map(...)] }`· και ο ribbon combobox renderer να **προτιμά** τα bridge-provided options όταν υπάρχουν (αλλιώς στατικά). Δες πώς άλλα bridges δίνουν δυναμικά options (π.χ. shape/family-type pickers) — μίμησε το ΥΠΑΡΧΟΝ pattern, μηδέν fork.
- **i18n:** οι option labels resolved με `t()` (non-literal labelKey), όχι hardcoded (N.11).
- Αποτέλεσμα: WC fixture → μόνο WC models· ντουζιέρα → μόνο shower models. Καθαρό Revit.

### 2) 📦 ΠΡΟΣΘΗΚΗ ΜΟΝΤΕΛΩΝ ΑΝΑ ΕΙΔΟΣ (CC0 / CC-BY μόνο)
Για κάθε νέο model (ίδιο pipeline με αυτό το session):
1. **License check ΠΡΙΝ:** `curl -s https://api.sketchfab.com/v3/models/<uid>` → `license.slug`. **Δεκτά ΜΟΝΟ `by` (CC-BY) ή `cc0`.** ❌ `st` (Standard), `null`, `nc*`/`nd*`/`sa*`. Έλεγξε `faceCount` (απόφυγε >~50k· π.χ. απορρίφθηκε Radaway 2.3M).
2. **Download:** `curl -H "Authorization: Token <TOKEN>" https://api.sketchfab.com/v3/models/<uid>/download` → `glb.url` (signed, expires 300s) → `curl -o file.glb "<url>"`.
3. **Measure (three/node):** bbox X/Y/Z + center· verify **real-world meters**· σημείωσε origin offset (το recenter διορθώνει X/Z).
4. **Upload:** `gcloud storage cp file.glb gs://pagonis-87766.firebasestorage.app/bim-mesh-library/sanitary/<id>.glb` (με άδεια Giorgio).
5. **Catalog entry** (`sanitary-fixture-mesh-catalog.ts`): id (kebab, =Storage name), **σωστό `kind`** (wc/washbasin/bathtub/bidet), labelKey, **ακριβείς μετρημένες dims**, mountingElevationMm:0, `source` (CC-BY format).
6. **i18n** label el+en (`mepFixture.catalog.<id>`). **Credits αυτόματο** (μηδέν χειροκίνητο).

**🟢 ΕΤΟΙΜΟΣ ΥΠΟΨΗΦΙΟΣ WC (license-checked):** «Curved Modern WC CC Open» by **attilakozma** — **CC-BY** ✅, downloadable, **2360 faces**, uid `de07cccdb657428cadc06f6bb96a551d`. Πρότεινε id `wc_realistic_01`.
- Ο Giorgio θα στείλει κι άλλα links (νιπτήρας/μπανιέρα/μπιντές) — license-check το καθένα ΠΡΙΝ.

### 3) Σημειώσεις
- Κάθε kind έχει ήδη connector/drain DN (SANITARY_SPEC)· το mesh ΜΟΝΟ ενισχύει 3D + 2D top-view (assetId opt-in· χωρίς mesh = παραμετρικό κουτί, full back-compat).
- Η κάθε family κρατά το δικό της 'kind' → V/G category 'sanitary', IfcSanitaryTerminal (ήδη).

---

## 🔧 TOOLING (επιβεβαιωμένο αυτό το session)
- **Sketchfab API token:** `4f345c0954ac49178a955ed13acdd300` (αν έληξε → Giorgio: Sketchfab → Settings → Password & API → API Token → regenerate).
- **Measure script (three σε node):** χρειάζεται `globalThis.self = globalThis;` ΠΡΙΝ + dynamic `import('three')` + `import('three/examples/jsm/loaders/GLTFLoader.js')` + `.parse(arrayBuffer, '', onLoad, onErr)`. Τρέξε από το project root (resolve node_modules). Αγνόησε τα «Couldn't load texture blob» warnings.
- **gcloud:** project `pagonis-87766`· bucket `pagonis-87766.firebasestorage.app`· path `bim-mesh-library/sanitary/`. (MCP storage tool = ΑΛΛΟ bucket μόνο `companies/` — μη το χρησιμοποιείς.)
- **PowerShell μέσω Bash:** ΟΧΙ `-ExecutionPolicy Bypass` (blocked). Για process-check χρησιμοποίησε `wmic process where "name='node.exe'" get commandline`.

---

## 📌 SSOT POINTERS (πού ζει τι)
- Catalog (μοντέλα): `src/subapps/dxf-viewer/bim/mep-fixtures/sanitary-fixture-mesh-catalog.ts` (+ `sanitaryMeshPresetsForKind`, `resolveSanitaryFixtureAsset`).
- Picker tab: `ui/ribbon/data/contextual-mep-sanitary-fixture-tab.ts` (`THREE_D_VIEW_OPTIONS`).
- Bridge: `ui/ribbon/hooks/useRibbonMepFixtureBridge.ts` (`getComboboxState`/`onComboboxChange` assetId branch).
- Contextual trigger: `app/ribbon-contextual-config.ts` (sanitary kind → `MEP_SANITARY_FIXTURE_CONTEXTUAL_TRIGGER` → tab «Ιδιότητες Είδους Υγιεινής»· εμφανίζεται ΜΟΝΟ όσο επιλεγμένο).
- Cache + recenter: `bim-3d/library/bim-mesh-library/{bim-mesh-cache,mesh-footprint-recentre}.ts`.
- 2D render: `bim/renderers/MepFixtureRenderer.ts` + `mesh-silhouette-draw.ts` + `bim/mesh-library/mesh-silhouette.ts`.
- Sanitary SSoT (dims/drain/2D drawers): `bim/sanitary/sanitary-symbol-spec.ts`.
- Credits: `bim/licensing/asset-credits.ts` (auto από catalog `source`).
- Kind→category/IFC: `bim/types/mep-fixture-types.ts` (`resolveFixtureBimCategory`, `resolveFixtureMeshCategory`).

---

## ✅ DEFINITION OF DONE (επόμενο session)
1. Per-kind picker filtering (WC fixture → μόνο WC models). tests.
2. ≥1 model ανά νέο kind (WC έτοιμος· νιπτήρας/μπανιέρα/μπιντές από Giorgio links) — measured + uploaded + catalog + i18n + credits auto.
3. tsc 0 (δικά μου) + tests πράσινα.
4. N.15: ΕΚΚΡΕΜΟΤΗΤΕΣ + ADR-411 changelog + memory.
5. 🔴 browser-verify (Giorgio) + commit (Giorgio). **ΟΧΙ commit/push από agent.**
