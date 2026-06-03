# HANDOFF — Πρόσθεση ΜΟΝΤΕΡΝΩΝ ΚΡΕΒΑΤΙΩΝ στη βιβλιοθήκη επίπλων (ADR-410/411)

**Ημερομηνία:** 2026-06-03
**Τύπος:** Επέκταση καταλόγου — ΑΜΙΓΩΣ ΔΕΔΟΜΕΝΑ (asset pipeline + catalog + i18n) + 1 type-union + 1 ΑΤΟΕ entry. ΟΧΙ νέα αρχιτεκτονική.
**Μοντέλο:** Sonnet 4.6 αρκεί (asset pipeline + 6 αρχεία δεδομένων/τύπων + uploads). Opus μόνο αν προκύψει κάτι cross-cutting.
**Σχετικά ADR:** **ADR-411** (BIM Mesh Library — entity-agnostic, δουλεύει) · **ADR-410** (furniture entity, v1.8) · ADR-409 §D.1 (CC0 legality).

---

## 🎯 ΤΙ ΘΑ ΚΑΝΕΙΣ

Πρόσθεσε **μοντέρνα κρεβάτια** (CC0 meshes Poly Haven) στη βιβλιοθήκη **επίπλων** (το ίδιο tool «Έπιπλο» / furniture).
Σήμερα ο κατάλογος έχει **καρέκλες** (`kind: 'chair'`) και **τραπέζια** (`kind: 'table'`). Θέλουμε νέο kind `'bed'`
με 2-4 **μοντέρνα/contemporary** κρεβάτια (ΟΧΙ ρούστικ/vintage — ο Giorgio το τόνισε ρητά και για τα τραπέζια).

> Το mesh-library subsystem (ADR-411) είναι ΗΔΗ entity-agnostic & δουλεύει (browser-verified από τον Giorgio).
> Η πρόσθεση kind/asset είναι **ΑΜΙΓΩΣ δεδομένα** — ΜΗΝ ξαναχτίσεις pipeline. Το πρότυπο «τραπέζια» δούλεψε τέλεια.

---

## ✅ ΤΟ ΠΡΟΤΥΠΟ ΠΟΥ ΔΟΥΛΕΨΕ ΓΙΑ ΤΑ ΤΡΑΠΕΖΙΑ (επανάλαβέ το ακριβώς)

**Ο κώδικας ήταν ΜΟΝΟ 6 αρχεία δεδομένων/τύπων** — όλα τα υπόλοιπα (picker, 2D σιλουέτα, 3D mesh, persistence, BOQ) προκύπτουν ΑΥΤΟΜΑΤΑ από το SSoT array:

1. `src/subapps/dxf-viewer/bim/types/furniture-types.ts` — `FurnitureKind = 'chair' | 'table'` → πρόσθεσε `| 'bed'`.
2. `src/subapps/dxf-viewer/bim/types/furniture.schemas.ts` — `FurnitureKindSchema = z.enum(['chair','table'])` → `['chair','table','bed']`. **(ΜΗΝ το ξεχάσεις — Zod enum πρέπει να καθρεφτίζει το union.)**
3. `src/subapps/dxf-viewer/bim/config/bim-to-atoe-mapping.ts` — `FURNITURE_MAPPING` είναι **exhaustive** `Record<FurnitureKind, AtoeMappingEntry>` → πρόσθεσε γραμμή `bed: { categoryCode: 'OIK-12.50', unit: 'pcs', titleEL: 'Έπιπλο — κρεβάτι (BIM)' }`. **(Αυτό το πιάνει ο tsc αν το ξεχάσεις — είναι Record, όχι switch.)**
4. `src/subapps/dxf-viewer/bim/furniture/furniture-catalog.ts` — `FURNITURE_CATALOG` array (SSoT). Νέο entry ανά κρεβάτι:
   `{ id, kind:'bed', labelKey:'furniture.catalog.<camelId>', widthMm, depthMm, heightMm, atoeCode:'ΟΙΚ-12', source:'Poly Haven (CC0)' }`.
5+6. `src/i18n/locales/el/dxf-viewer-shell.json` **ΚΑΙ** `en/…` — namespace `furniture.catalog` (~γρ.2356) → +1 label ανά κρεβάτι (N.11, ΠΡΩΤΑ).

**Mesh library (entity-agnostic, ADR-411) — δεν το αγγίζεις, μόνο το τροφοδοτείς με assets:**
- Storage tree: `bim-mesh-library/furniture/<assetId>.glb` + `…/thumbnails/<assetId>.png` (η κατηγορία επίπλων = `furniture`).
- 3D converter `furniture-to-three.ts` → delegate `mesh-to-object3d.ts` με anchor **`base`** (το κρεβάτι κάθεται στο πάτωμα — σωστό· μηδέν αλλαγή).
- storage.rules `match /bim-mesh-library/{path=**}` ΗΔΗ deployed (auth-read).
- Enterprise IDs / persistence / BOQ / IFC: όλα κοινά — μηδέν αλλαγή (kind = label/discriminator μόνο).

---

## 🏗️ ASSET PIPELINE (δοκιμασμένο 2026-06-03 — δούλεψε άψογα για 4 τραπέζια)

Project = **`pagonis-87766`** (ΔΕΝ υπάρχει `.firebaserc` → ΠΑΝΤΑ `--project pagonis-87766`).
Bucket = `gs://pagonis-87766.firebasestorage.app`. gcloud authed ως georgios.pagonis@gmail.com.

1. **Βρες κρεβάτια (μοντέρνα):**
   `node -e "fetch('https://api.polyhaven.com/assets?type=models&categories=furniture').then(r=>r.json()).then(d=>{for(const [id,a] of Object.entries(d)){const n=(a.name||'').toLowerCase(); const t=(a.tags||[]).join(' '); if(/bed/.test(n)||/\bbed\b/.test(t)) console.log(id,'|',a.name,'|',(a.tags||[]).join(','));}})"`
   → Διάλεξε αυτά με tags `modern/contemporary/minimalist`, ΑΠΕΦΥΓΕ `vintage/antique/rustic/old/worn`.
   ⚠️ Πρόσεξε: μερικά "bed" μπορεί να είναι flowerbed/riverbed — δες το name/tags. Αν δεν βρεις αρκετά μόνο με `categories=furniture`, ψάξε και χωρίς category filter ή με `q=bed` στο asset name.
2. **Files (1k gltf):** `node -e "fetch('https://api.polyhaven.com/files/<assetId>').then(r=>r.json()).then(f=>{const g=f.gltf['1k'].gltf; console.log(g.url, Object.keys(g.include||{}).length);})"`
3. **Κατέβασμα** σε temp folder με node `fetch`+`fs` (mkdir recursive, διατήρησε τη `textures/` δομή των `include`). Πρότυπο = το `.tbl-lib/download.js` που έφτιαξα (δες παρακάτω «temp»).
4. **Pack σε .glb:** `npx --yes @gltf-transform/cli@latest copy <in>.gltf <id>.glb` (MIT, καμία αλλαγή package.json).
5. **Dims από bbox:** `JSON.parse(fs.readFileSync('<in>.gltf'))` → meshes→primitives→accessors[POSITION].min/max → `widthMm=dx*1000, heightMm=dy*1000 (Y-up!), depthMm=dz*1000`. (ΟΧΙ `require` σε .gltf.) **ΣΗΜΑΝΤΙΚΟ: τα κρεβάτια είναι μεγάλα — περίμενε widthMm ~900-1800, depthMm ~2000-2100, heightMm ~400-1200 (με/χωρίς κεφαλάρι). Βάλε τις ΠΡΑΓΜΑΤΙΚΕΣ τιμές, μην μαντέψεις.**
6. **Upload glb:** `gcloud storage cp <id>.glb "gs://pagonis-87766.firebasestorage.app/bim-mesh-library/furniture/<id>.glb" --content-type="model/gltf-binary" --custom-metadata="firebaseStorageDownloadTokens=$(node -e "console.log(require('crypto').randomUUID())")" --project pagonis-87766 -q`
   → ο **download token** είναι ΑΠΑΡΑΙΤΗΤΟΣ για getDownloadURL. Επιβεβαίωση: `gcloud storage objects describe … --project pagonis-87766 --format="value(custom_fields.firebaseStorageDownloadTokens)"` (πεδίο = **`custom_fields`**, ΟΧΙ `metadata`).
7. **Thumbnail:** `curl -sL "https://cdn.polyhaven.com/asset_img/thumbs/<assetId>.png?width=256&height=256" -o <id>.png` → upload `bim-mesh-library/furniture/thumbnails/<id>.png` (content-type `image/png` + δικό του token). (Το `<AssetName>` στο thumbnail URL = το asset id key.)
8. **Catalog entries + i18n + union + schema + ΑΤΟΕ** (βήματα 1-3 πιο πάνω στην ενότητα «ΠΡΟΤΥΠΟ»).

---

## ⚠️ ΚΡΙΣΙΜΟ ΠΛΑΙΣΙΟ (ΜΗΝ το αγνοήσεις)
- 🌐 **Ελληνικά πάντα.**
- 🚫 **COMMIT/PUSH κάνει ΜΟΝΟ ο Giorgio.** Ποτέ εσύ. Ποτέ `--no-verify`. (N.(-1))
- 🌳 **SHARED working tree με άλλον agent.** `git add` **ΜΟΝΟ** τα 8 δικά σου αρχεία (6 κώδικα + ADR-410 + ΕΚΚΡΕΜΟΤΗΤΕΣ)· **ΠΟΤΕ** `git add -A`.
  (WIP άλλου agent στο tree: MEP-wire, bim-subcategories, bim-render-settings, RibbonPanel, ADR-377/408 docs — ΜΗΝ τα πειράξεις.)
- 🆔 N.6 enterprise IDs (furniture ΗΔΗ `furn_*`, μηδέν αλλαγή)· 🌍 N.11 i18n el+en ΠΡΩΤΑ.
- 🔬 Tests: `npx jest "furniture"` (περιμένε 23/23 PASS — το catalog test είναι generic, δέχεται νέα entries) + `npx tsc --noEmit` 0 ΣΤΑ ΔΙΚΑ ΣΟΥ.
- ⚠️ **ΓΝΩΣΤΟ pre-existing tsc error (ΟΧΙ δικό σου, ΜΗΝ το διορθώσεις):** `mesh-to-object3d.ts:124` — `matId: string` περνά σε `getElementMaterial3D` που θέλει narrow union. Είναι σε **committed** κώδικα (de57f9d5, άλλος agent). Φιλτράρισέ το από το tsc output· ΟΧΙ regression. Ανέφερέ το στον Giorgio αν θέλει χωριστό fix.
- 🧹 **temp folder:** το `rm -rf` είναι **μπλοκαρισμένο** σε αυτό το περιβάλλον (PowerShell deny + rm deny). Φτιάξε temp `.bed-lib/` με node `fs.mkdirSync` (ΟΧΙ mkdir cmd)· στο τέλος πες στον Giorgio να το σβήσει χειροκίνητα — είναι untracked, δεν μπαίνει σε commit. (Υπάρχουν ήδη `.tbl-lib` + `.light-lib` από προηγούμενες συνεδρίες προς διαγραφή.)
- 🪑 **ΜΑΘΗΜΑ ADR-411:** picker option «χωρίς μοντέλο» ΠΟΤΕ `value=''` (Radix το απαγορεύει) → `SELECT_CLEAR_VALUE`. (Τα κρεβάτια πάντα έχουν assetId → άσχετο, αλλά να το ξέρεις.)
- 🚧 **ΟΛΟ το ADR-410/411 + τα τραπέζια είναι UNCOMMITTED** (ο Giorgio θα κάνει commit). Τα asset των τραπεζιών είναι ΗΔΗ live στο Storage.

---

## 📎 ΠΡΩΤΑ ΒΗΜΑΤΑ (νέα συνεδρία)
1. (Προαιρετικό RECOGNITION) διάβασε `furniture-catalog.ts` + `furniture-types.ts` — μικρά. Δες πώς μπήκαν τα 4 τραπέζια (kind 'table') ως πρότυπο 1:1.
2. Βρες 2-4 ΜΟΝΤΕΡΝΑ CC0 κρεβάτια (Poly Haven API), τρέξε το asset pipeline (βήματα 1-7).
3. Πρόσθεσε catalog entries + i18n el+en + `FurnitureKind |= 'bed'` + `z.enum([...,'bed'])` + `FURNITURE_MAPPING.bed`.
4. `npx tsc --noEmit` (0 στα δικά σου) + `npx jest "furniture"` (23/23). Ενημέρωσε tracking (ADR-410 changelog v1.9 + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` ομάδα ADR-410 + memory). Πες στον Giorgio: browser verify + commit.
- Memory: `~/.claude/projects/C--Nestor-Pagonis/memory/project_adr410_cc0_furniture_import.md` + `project_adr411_bim_mesh_library.md` (πλήρες state· δες την προσθήκη «🛋️ ΤΡΑΠΕΖΙΑ»).
