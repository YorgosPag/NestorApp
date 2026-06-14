# HANDOFF — ADR-449 σοβάς: ένωση τοίχου↔κολόνας (Δρόμος Β) — #2/#3 DONE, #A/#C OPEN

**Ημερομηνία:** 2026-06-14 (συνέχεια του `HANDOFF_2026-06-14_ADR-449_wall-column-finish-junction.md`)
**ADR:** ADR-449 (σοβάς κολόνας additive-outward) ↔ ADR-413/447 (σοβάς τοίχου multi-layer DNA) · 2Δ render → ADR-040
**Quality bar:** FULL ENTERPRISE + FULL SSOT, Revit-grade. **Firestore-first. Confirm repro πριν re-implement.**
**Μοντέλο:** Opus. **Commit/push: ΜΟΝΟ ο Giorgio** (N.(-1)). **Working tree SHARED → `git add` ΜΟΝΟ δικά σου, ΠΟΤΕ `-A`/`--no-verify`.** **Ελληνικά πάντα.**

---

## 0. Η ΑΠΟΦΑΣΗ-ΚΛΕΙΔΙ (εγκεκριμένη από Giorgio μετά από εκτενή συζήτηση)

Ο σοβάς τοίχου ζει **ΜΕΣΑ στο nominal** (DNA layers: εξωτ.σοβάς 25 | τούβλο 210 | εσωτ.σοβάς 15). Ο σοβάς κολόνας είναι **additive-OUTWARD** δέρμα 15mm. Δύο αντίθετες συμβάσεις → στη flush συμβολή γεννιέται **15mm σκαλοπατάκι** στην collinear κοινή όψη.

**Giorgio διάλεξε ΔΡΟΜΟ Β** (από 3 επιλογές που του εξήγησα με απλά λόγια):
- ✅ **Κράτα ΚΑΙ τα δύο συστήματα** (τοίχος=layered DNA, κολόνα=additive skin). ΟΧΙ unify-σε-auto-skin (θα έχανε per-side πάχη 25/15 + μόνωση/θερμικά).
- ✅ **Ο τοίχος ΜΕΝΕΙ εκεί που τον έβαλε ο χρήστης** (δεν τον μετακινούμε). Το **15mm σκαλοπατάκι μένει «έντιμο»** (η κολόνα όντως προεξέχει· coplanarity = ευθύνη διαστάσεων αρχιτέκτονα — όπως Slice 7 big-player).
- ✅ Καθαρίζουμε **μόνο** τα υπόλοιπα στη συμβολή.
- 🔮 Future (αν θελήσει τέλειο flush): finish-face placement (το «Location Line / Finish Face» ADR-040 υπάρχει ήδη) — **deliberate τοποθέτηση, ΟΧΙ auto-move**.

**Οι 3 διορθώσεις του Δρόμου Β:** #1 αφαίρεση σοβά κολόνας στο contact (ΗΔΗ δούλευε)· #2 κόψιμο κρυμμένου σοβά στη στενή άκρη τοίχου· #3 η 2Δ κάτοψη να δείχνει σοβά **και** στον τοίχο.

---

## 1. ΤΙ ΕΓΙΝΕ ΑΥΤΗ ΤΗ ΣΥΝΕΔΡΙΑ (UNCOMMITTED — ο Giorgio θα κάνει commit)

### ✅ #3 — 2Δ κάτοψη δείχνει σοβά τοίχου (5/5 jest)
**Αιτία:** ο `WallRenderer.drawMaterialHatch` παρακάμπτει DNA τοίχους (`if (wall.params.dna) return`) → ο τοίχος ζωγραφιζόταν ως ΕΝΑ σκέτο ορθογώνιο (καμία γραμμή στρώσης), σε αντίθεση με την κολόνα που δείχνει finish περίγραμμα.
**Fix (Revit compound-structure σε plan):**
- NEW pure `src/subapps/dxf-viewer/bim/walls/wall-layer-lines-2d.ts` — `wallLayerBoundaryPolylines(outer, inner, dna)`: εσωτερικές γραμμές διαχωρισμού στρώσεων (interp outer→inner ανά boundary fraction). **REUSE `buildupBoundaryFractions` SSoT** (`bim/types/layered-buildup.ts`, το ίδιο που τρέφει το 3Δ split) — μηδέν νέα μαθηματικά.
- `WallRenderer.ts`: import + NEW `drawDnaLayerLines(wall)` (HATCH_STROKE_RGBA, THIN, εντός tilt-translate scope, skip σε extreme zoom-out) + κλήση μετά το `drawMaterialHatch`.
- NEW test `bim/walls/__tests__/wall-layer-lines-2d.test.ts` (5/5).
- ⚠️ Άγγιξε `WallRenderer` (2Δ entity renderer) → **CHECK 6B/6D: ΠΡΕΠΕΙ stage ADR-040** στο commit (αλλιώς block).

### ✅ #2 — Embed άκρης τοίχου→κολόνα, 3Δ-only (5/5 jest)
**Αιτία (επιβεβαιωμένη):** το `ExtrudeGeometry` παράγει end-cap του τοίχου **ακριβώς coincident** (ίδιο float) με την παρειά κολόνας → z-fighting → «φαίνεται σοβάς στη στενή όψη».
**Fix (Revit wall-join):** βυθίζω την άκρη **20mm μέσα στο μπετόν** → end-cap κρύβεται → μηδέν z-fight. **Render-only** (2Δ/BOQ/finish-obstacle διαβάζουν το ΑΡΧΙΚΟ wall → αμετάβλητα).
- NEW pure `src/subapps/dxf-viewer/bim-3d/converters/wall-column-embed-3d.ts` — `embedStraightWallEndsIntoColumns(geometry, start, end, columns, embedCanvas, buttTol)` (surgical: μετατοπίζει ΜΟΝΟ τις κορυφές του butting άκρου κατά −/+axis· διατηρεί miters άλλων άκρων). Consts `WALL_COLUMN_EMBED_MM=20`, `WALL_COLUMN_BUTT_TOL_MM=5`. **REUSE canonical `pointInPolygon` (polygon-utils) + `pointToSegmentDistance` (systems/guides/guide-types)** — μηδέν duplicate.
- `BimToThreeConverter.ts` `wallToMesh`: +param `columns: readonly (readonly Point3D[])[] = []` (10ος, default `[]` → **no-op για ΟΛΟΥΣ τους υπάρχοντες callers**)· restructure `renderWall` (geometry+start/end patched όταν embed)· solid path → `renderWall.geometry`. Imports: embed helper + `mmToSceneUnits`.
- `bim-scene-attach-syncs.ts` `syncWalls`: collect `columnFootprints` από `entities.columns` → πέρασέ τα στο `wallToMesh`. +import `Point3D`.
- NEW test `bim-3d/converters/__tests__/wall-column-embed-3d.test.ts` (5/5).

### 🔴 UNCOMMITTED αρχεία μου (git add ΜΟΝΟ αυτά)
- NEW: `bim/walls/wall-layer-lines-2d.ts` + `bim/walls/__tests__/wall-layer-lines-2d.test.ts`
- NEW: `bim-3d/converters/wall-column-embed-3d.ts` + `bim-3d/converters/__tests__/wall-column-embed-3d.test.ts`
- MOD: `bim/renderers/WallRenderer.ts`
- MOD (MIXED με άλλους agents — ΜΟΝΟ δικές μου γραμμές): `bim-3d/converters/BimToThreeConverter.ts`, `bim-3d/scene/bim-scene-attach-syncs.ts`

### 🔴 ΕΚΚΡΕΜΕΙ ΠΡΙΝ COMMIT
- **tsc:** `! npx tsc --noEmit` (N.17 — ΔΕΝ επιβεβαιώθηκε ακόμα· ο agent δεν μπορεί να ελέγξει running-tsc [PowerShell denied] → ζήτα από Giorgio).
- **ADR docs (ΠΡΙΝ commit, αλλιώς CHECK 6B/6D μπλοκάρει):**
  - `ADR-040-preview-canvas-performance.md` changelog: «WallRenderer +drawDnaLayerLines (2Δ DNA layer lines, ADR-449 #3) — pure draw, μηδέν subscription».
  - `ADR-449-structural-finish-skin.md` changelog: #2 embed + #3 2Δ layer lines (Δρόμος Β).
  - `adr-index.md` (αν επιτρέπεται shared tree).
- **Pre-existing test failures (ΟΧΙ δικά μου, μην τα «διορθώσεις»):** `wall-tilt-pieces-3d` (tilt-z, ADR-448 agent) + `wall-column-base-offset-y › columnToMesh baseOffset=750` (Received 0 — ADR-449/456 column agent). ΟΛΑ τα **wall** tests εκεί περνούν → η αλλαγή μου είναι καθαρή (no-op όταν `columns=[]`).

---

## 2. 🔴 ΑΝΟΙΧΤΑ (νέα — προέκυψαν από browser-verify + Firestore baseline)

### #A — Column finish junction OVER-REACH σε τοίχο (2Δ + πιθανώς 3Δ)
**Σύμπτωμα (Giorgio):** «ο ανατολικός σοβάς της κολόνας κατεβαίνει νότια & μπαίνει στο σώμα του τοίχου».
**Αιτία (code=SoT):** το κάτω άκρο της εκτεθειμένης ανατολικής λωρίδας σοβά κολόνας (στο όριο όπου αρχίζει ο τοίχος) είναι **πάνω στη γωνία του τοίχου-obstacle** → `pointNearObstacle` (στο `structural-finish-resolver.ts`, `JUNCTION_TOL_MM=10`) το σημαδεύει **junction** → **Slice 10 square-EXTEND** (core+outer extend κατά τον άξονα, βλ. `structural-finish-outline-geometry.ts` `closeOpenOuterEnds`/`computeMiteredOuter`) → επεκτείνεται **μέσα στον τοίχο**.
**Διάγνωση:** το Slice 10 corner-fill σχεδιάστηκε για **κολόνα↔δοκάρι** flush framing. Σε **κολόνα↔ΤΟΙΧΟ** υπερ-εκτείνεται. **ΔΕΝ το άγγιξα** (column finish resolver) — προϋπήρχε, απλώς φάνηκε τώρα που ο τοίχος δείχνει σοβά (#3).
**Κατεύθυνση fix (να επιβεβαιωθεί repro πρώτα):** στον resolver, διάκριση **wall obstacle vs structural (beam/column) obstacle** για το junction flag — wall-adjacent άκρο → ΟΧΙ corner-fill extend (ο τοίχος έχει δικό του σοβά· καθαρό butt-end, ίσως μικρό miter). Πιθανό: ο `pointNearObstacle` / `aJunction`/`bJunction` να παίρνει «obstacle kind» ή χωριστή λίστα wall-obstacles. **SSoT touchpoints §3.**

### #C — Το embed (#2) διαρρέει στο cut-plane fast-path (3Δ κατά slider)
**Σύμπτωμα:** κατά τη μετακίνηση του slider οριζόντιας τομής (ADR-452) → «σοβάς δυτικής πλευράς τοίχου εισχωρεί στο σώμα κολόνας». Settled → σωστό.
**Αιτία:** το embed βάζει 20mm wall-geometry ΜΕΣΑ στην κολόνα· το ADR-452 cut-moving fast-path δείχνει απλοποιημένη σκηνή **χωρίς σωστή απόκρυψη από το μπετόν** → το βυθισμένο κομμάτι (με σοβά) φαίνεται.
**Κατεύθυνση fix (επιλογές):** (α) μικρότερο embed· (β) **pull-back αντί embed** (η άκρη υποχωρεί sub-mm → μηδέν geometry μέσα στην κολόνα → δεν διαρρέει· έλεγξε αν αφήνει ορατό sliver)· (γ) συντόνισε με ADR-452 fast-path culling. **Confirm στο browser ποια αρκεί.**

---

## 3. SSoT TOUCHPOINTS (διάβασέ τα ΠΡΩΤΑ — PHASE 1 RECOGNITION)

| Αρχείο | Ρόλος |
|---|---|
| `bim/finishes/structural-finish-resolver.ts` | **#A εδώ.** `pointNearObstacle`+`JUNCTION_TOL_MM`+`aJunction/bJunction` per segment· `coveredIntervals` (#1 αφαίρεση). |
| `bim/finishes/structural-finish-outline-geometry.ts` | `computeMiteredOuter`/`closeOpenOuterEnds` (junction square-extend = #A μηχανισμός)· ΚΟΙΝΟ 2Δ+3Δ (Slice X2). |
| `bim/finishes/structural-finish-silhouette.ts` + `-scene-silhouette.ts` | ΕΝΕΡΓΟ merged skin (2Δ+3Δ)· `WallObstacle` un-dilated height-aware· walls=obstacles. |
| `bim-3d/converters/wall-column-embed-3d.ts` (NEW) | **#C εδώ.** Το embed μου. |
| `bim-3d/converters/BimToThreeConverter.ts` `wallToMesh` | wall 3Δ· solid + multi-layer pieces path. |
| ADR-452 cut-plane (`project_adr452_cut_plane_slider` MEMORY) | #C fast-path context. |
| `bim/renderers/WallRenderer.ts` + `wall-layer-lines-2d.ts` (NEW) | #3 (DONE). |

**Canonical geom SSoT (grep ΠΡΙΝ γράψεις — μάθημα: μη διπλασιάζεις):** `pointToSegmentDistance` (`systems/guides/guide-types`), `pointInPolygon`/`polygonCentroid`/`polygonArea` (`bim/geometry/shared/polygon-utils`), `safeUnion` (`safe-polygon-boolean`), `buildupBoundaryFractions` (`bim/types/layered-buildup`).

---

## 4. FIRESTORE BASELINE (αναπαράξιμη σκηνή — Firestore-first ξεκλειδώνει τα finish bugs)
- project `proj_1d45b55b-e5ea-41fb-9466-bda795361e65` · floorplan `file_f6b1782f-9e78-4ef6-a461-11ae41724d45` · level `lvl_aec46939-c091-4eb9-955a-2b3be650e71a`.
- **Κολόνα** `col_fb3215e9-cabc-4c35-bc79-61669775d5a1`: `kind:'rectangular'`, footprint X∈[21.3855, 21.8851] · Y∈[3.6377, 4.6368] (width **499.56** × depth **999.13**), center (21.635, 4.137), finish 15mm enabled, height 3000, sceneUnits 'm'. (Leftover composite/ushape/tshape **αγνοούνται** όσο rectangular· +reinforcement/codeViolations από ADR-456 agent — άσχετο.)
- **Τοίχος** `wall_772f1b79-…`: `straight`, exterior, thickness 250, **storey-ceiling** (πλήρες ύψος, ΟΧΙ attached)· start **(21.8851, 3.7627)** = ΑΚΡΙΒΩΣ ανατολική παρειά κολόνας → end (23.3136, 3.7627)· κάτω παρειά y=3.6377 = ΑΚΡΙΒΩΣ νότια παρειά κολόνας (collinear). DNA 25|210|15. **Καλύπτει κάτω 250mm** ανατολικής όψης.
- firestore MCP: `mcp__firestore__firestore_query`/`_count` (collections `floorplan_columns`/`_walls`/`_beams`, filter `floorplanId == file_f6b1782f…`). **beams υποτίθεται 0** — επιβεβαίωσέ το.
- ΜΕΘΟΔΟΣ Giorgio που δουλεύει: διέγραψε τοίχο → baseline κολόνας → ξαναβάλε τοίχο → σύγκρινε.

---

## 5. ΚΑΝΟΝΕΣ + ΠΡΩΤΟ ΒΗΜΑ ΝΕΑΣ ΣΥΝΕΔΡΙΑΣ
1. Recognition: MEMORY `project_adr449_structural_finish_skin` + §3 αρχεία (resolver + outline-geometry + silhouette).
2. **tsc (Giorgio)** για τα #2/#3 → **commit** (#2/#3 + ADR-040/449 changelogs, git add ΜΟΝΟ δικά σου).
3. #A: confirm repro (Firestore §4) → fix στον resolver (wall-obstacle vs structural-obstacle junction). #C: pull-back vs embed (browser).
4. **Commit/push ΜΟΝΟ Giorgio.** ΕΝΑ tsc τη φορά (N.17). Stage ADR-040 αν αγγίξεις 2Δ canvas. N.11 i18n (καμία νέα string μέχρι τώρα). **N.15:** ΕΚΚΡΕΜΟΤΗΤΕΣ + ADR + MEMORY ίδιο commit.
