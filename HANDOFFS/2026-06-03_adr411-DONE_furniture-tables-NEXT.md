# HANDOFF — Πρόσθεση ΤΡΑΠΕΖΙΩΝ στη βιβλιοθήκη επίπλων (ADR-410/411)

**Ημερομηνία:** 2026-06-03
**Τύπος:** Επέκταση καταλόγου — κυρίως ΔΕΔΟΜΕΝΑ (asset pipeline + catalog + i18n) + 1 type-union αλλαγή. ΟΧΙ νέα αρχιτεκτονική.
**Μοντέλο:** Sonnet 4.6 αρκεί (asset pipeline + 1-2 αρχεία κώδικα + uploads). Opus μόνο αν προκύψει κάτι cross-cutting.
**Σχετικά ADR:** **ADR-411** (BIM Mesh Library — entity-agnostic, ΜΟΛΙΣ ΟΛΟΚΛΗΡΩΘΗΚΕ & δουλεύει) · **ADR-410** (furniture entity) · ADR-409 §D.1 (CC0 legality).

---

## 🎯 ΤΙ ΘΑ ΚΑΝΕΙΣ

Πρόσθεσε **τραπέζια** (CC0 meshes) στη βιβλιοθήκη **επίπλων** (το ίδιο tool «Έπιπλο» / furniture).
Σήμερα ο κατάλογος έχει μόνο **καρέκλες** (`FurnitureKind = 'chair'`). Θέλουμε νέο kind `'table'`
με 2-4 CC0 τραπέζια από Poly Haven (π.χ. dining table, coffee table, desk).

> Το mesh-library subsystem (ADR-411) είναι ΗΔΗ entity-agnostic & δουλεύει (browser-verified από τον Giorgio).
> Η πρόσθεση kind/asset είναι **σχεδόν αμιγώς δεδομένα** — ΜΗΝ ξαναχτίσεις pipeline.

---

## ✅ ΤΟ ΠΡΟΤΥΠΟ ΠΟΥ ΔΟΥΛΕΥΕΙ (μην το ξαναψάξεις)

**Furniture entity & catalog:**
- `src/subapps/dxf-viewer/bim/types/furniture-types.ts` — `FurnitureKind = 'chair'` (**εδώ προσθέτεις `| 'table'`**).
- `src/subapps/dxf-viewer/bim/furniture/furniture-catalog.ts` — `FURNITURE_CATALOG` array (SSoT). Κάθε entry:
  `{ id, kind, labelKey, widthMm, depthMm, heightMm, atoeCode, source }`. **Νέο τραπέζι = νέο entry εδώ.**
  Ο picker + οι σιλουέτες + το 3D + το BOQ προκύπτουν ΑΥΤΟΜΑΤΑ από το array (options GENERATED).
- Picker: tool-active tab (`contextual-furniture-tab.ts`) + `useRibbonFurnitureBridge` — δείχνει thumbnails αυτόματα.

**Mesh library (entity-agnostic, ADR-411) — δεν το αγγίζεις, μόνο το τροφοδοτείς με assets:**
- Storage tree: `bim-mesh-library/<bimCategory>/<assetId>.glb` + `…/thumbnails/<assetId>.png`.
  Η κατηγορία των επίπλων = **`furniture`** → assets πάνε στο `bim-mesh-library/furniture/`.
- Cache: `bim-3d/library/bim-mesh-library/bim-mesh-cache.ts` (key `category/assetId`, async load, bbox placeholder σε miss).
- 3D converter: `bim-3d/converters/furniture-to-three.ts` → delegate στο `mesh-to-object3d.ts` (anchor **`base`** — τραπέζι κάθεται στο πάτωμα, σωστό· μηδέν αλλαγή).
- 2D: `FurnitureRenderer` → auto σιλουέτα + top-edges από το mesh (shared `mesh-silhouette-draw`).
- storage.rules `match /bim-mesh-library/{path=**}` ΗΔΗ deployed (auth-read).

**Enterprise IDs / persistence / BOQ / IFC:** όλα κοινά με τις καρέκλες — μηδέν αλλαγή (kind είναι μόνο label/discriminator).

---

## 🏗️ ASSET PIPELINE (επανάλαβέ το ανά τραπέζι — δοκιμασμένο 2026-06-03)

Project = **`pagonis-87766`** (δεν υπάρχει `.firebaserc` → πάντα `--project pagonis-87766`).
Bucket = `gs://pagonis-87766.firebasestorage.app`. gcloud authed ως georgios.pagonis@gmail.com.

1. **Βρες τραπέζια:** `node -e "fetch('https://api.polyhaven.com/assets?type=models&categories=furniture').then(r=>r.json()).then(d=>{for(const [id,a] of Object.entries(d)){const n=(a.name||'').toLowerCase(); if(/table|desk/.test(n)) console.log(id,'|',a.name);}})"`
2. **Files (1k gltf):** `https://api.polyhaven.com/files/<AssetName>` → `gltf['1k'].gltf.url` (main) + `.include` (bin+textures, διατήρησε `textures/` δομή).
3. **Κατέβασμα** σε temp folder (node `fetch` + `fs.writeFileSync`, mkdir recursive).
4. **Pack σε .glb:** `npx --yes @gltf-transform/cli@latest copy <in>.gltf <id>.glb` (MIT, καμία αλλαγή package.json).
5. **Dims από bbox:** `JSON.parse(fs.readFileSync('<in>.gltf'))` → accessors POSITION min/max → `widthMm=dx*1000, heightMm=dy*1000(Y-up), depthMm=dz*1000`. (ΟΧΙ `require` σε .gltf — δεν είναι JS).
6. **Upload glb:** `gcloud storage cp <id>.glb "gs://pagonis-87766.firebasestorage.app/bim-mesh-library/furniture/<id>.glb" --content-type="model/gltf-binary" --custom-metadata="firebaseStorageDownloadTokens=$(node -e "console.log(require('crypto').randomUUID())")"`
   → ο **download token** είναι ΑΠΑΡΑΙΤΗΤΟΣ για getDownloadURL. (Επιβεβαίωση: `gcloud storage objects describe … --format="value(custom_fields.firebaseStorageDownloadTokens)"` — προσοχή: το πεδίο λέγεται **`custom_fields`** στο gcloud, ΟΧΙ `metadata`.)
7. **Thumbnail:** `curl -sL "https://cdn.polyhaven.com/asset_img/thumbs/<AssetName>.png?width=256&height=256" -o <id>.png` → upload `bim-mesh-library/furniture/thumbnails/<id>.png` (content-type `image/png` + token).
8. **Catalog entry** στο `furniture-catalog.ts`: `{ id:'<id>', kind:'table', labelKey:'furniture.catalog.<id>', widthMm, depthMm, heightMm, atoeCode:'ΟΙΚ-12', source:'Poly Haven (CC0)' }`.
9. **i18n** (N.11, ΠΡΩΤΑ): `furniture.catalog.<id>` σε `src/i18n/locales/el/dxf-viewer-shell.json` **ΚΑΙ** `en/…` (το `furniture.catalog` namespace υπάρχει ήδη, ~γρ.2344 el).
10. **FurnitureKind union:** `furniture-types.ts` `FurnitureKind = 'chair' | 'table'`. Grep `FurnitureKind` για τυχόν exhaustive switch (μάλλον κανένα — kind=label).

---

## ⚠️ ΚΡΙΣΙΜΟ ΠΛΑΙΣΙΟ (ΜΗΝ το αγνοήσεις)
- 🌐 **Ελληνικά πάντα.**
- 🚫 **COMMIT/PUSH κάνει ΜΟΝΟ ο Giorgio.** Ποτέ εσύ. Ποτέ `--no-verify`. (N.(-1))
- 🌳 **SHARED working tree με άλλον agent.** `git add` **ΜΟΝΟ** συγκεκριμένα δικά σου αρχεία· **ΠΟΤΕ** `git add -A`.
  (WIP άλλου agent: MEP-wire `mep-wire-routing`, bim-subcategories, bim-render-settings, RibbonPanel, ADR-377/408 docs — ΜΗΝ τα πειράξεις.)
- 📦 **ΟΛΟ το ADR-410+ADR-411 (+ADR-406/405 κ.ά.) είναι UNCOMMITTED** (ο Giorgio θα κάνει commit). Τα assets είναι ΗΔΗ live.
- 🆔 N.6 enterprise IDs (furniture ΗΔΗ `furn_*`)· 🌍 N.11 i18n el+en ΠΡΩΤΑ.
- 🔬 Tests: `npx jest "furniture"` + `npx tsc --noEmit` 0. (Νέο kind → πιθανώς αρκεί catalog test update αν υπάρχει.)
- 🧹 untracked temp: αν φτιάξεις folder λήψης (π.χ. `.tbl-lib`), σβήσ' τον στο τέλος. (Υπάρχει ήδη ένα `.light-lib` από την προηγούμενη συνεδρία — προς διαγραφή.)
- 🪑 **ΜΑΘΗΜΑ ADR-411:** picker option «χωρίς μοντέλο»/clear ΠΟΤΕ `value=''` → Radix Select το απαγορεύει· χρησιμοποίησε `SELECT_CLEAR_VALUE` από `@/config/domain-constants`. (Τα τραπέζια πάντα έχουν assetId, οπότε άσχετο εδώ — αλλά να το ξέρεις.)

---

## 📎 ΠΡΩΤΑ ΒΗΜΑΤΑ (νέα συνεδρία)
1. (Προαιρετικό RECOGNITION) διάβασε `furniture-catalog.ts` + `furniture-types.ts` — είναι μικρά.
2. Βρες 2-4 CC0 τραπέζια (Poly Haven API), τρέξε το asset pipeline (βήματα 1-7).
3. Πρόσθεσε catalog entries + i18n + `FurnitureKind |= 'table'` (βήματα 8-10).
4. `npx tsc --noEmit` (0) + `npx jest "furniture"`. Πες στον Giorgio να κάνει browser verify + commit.
- Memory: `~/.claude/projects/C--Nestor-Pagonis/memory/project_adr411_bim_mesh_library.md` + `project_adr410_cc0_furniture_import.md` (πλήρες state).
