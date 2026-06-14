# HANDOFF — ADR-449 σοβάς: έλεγχος ΕΝΩΣΗΣ τοίχου↔κολόνας (αφαίρεση σοβά στη συμβολή + overlap/gap)

**Ημερομηνία:** 2026-06-14
**ADR:** ADR-449 (structural finish skin / σοβάς κολόνας) + αλληλεπίδραση με wall finish (ADR-413/447 multi-layer DNA)
**Quality bar:** **FULL ENTERPRISE + FULL SSOT**, **Revit-grade** («όπως οι μεγάλοι παίκτες»). Firestore-first. **Confirm repro πριν re-implement.**
**Μοντέλο:** Opus.
**Commit:** **ΜΟΝΟ ο Giorgio** (N.(-1)). **Working tree SHARED με άλλον agent → `git add` ΜΟΝΟ δικά σου αρχεία, ΠΟΤΕ `-A`/`--no-verify`.**
**Γλώσσα:** Ελληνικά πάντα.

---

## 0. Η ΝΕΑ ΔΟΥΛΕΙΑ (τι ζητάει ο Giorgio)

Τώρα στον καμβά υπάρχει **ΜΟΝΟ μία κολόνα** (με σοβά). Ο Giorgio θα **προσθέσει έναν τοίχο κολλημένο πάνω στην κολόνα** και θέλει να **ελέγξουμε δύο πράγματα στη συμβολή τοίχου↔κολόνας:**

1. **Αφαιρείται ο σοβάς της κολόνας στο σημείο ένωσης;** (εκεί που ο τοίχος καλύπτει την παρειά της κολόνας → ΔΕΝ πρέπει να υπάρχει σοβάς κολόνας — ο τοίχος είναι μπροστά).
2. **Στα σημεία που ενώνεται ο σοβάς του τοίχου με τον σοβά της κολόνας υπάρχουν ΕΠΙΚΑΛΥΨΕΙΣ (overlap) ή ΚΕΝΑ (gap);** Στόχος Revit-grade: **ΕΝΑ συνεχές δέρμα, μηδέν αλληλοδιείσδυση/διπλή γραμμή, μηδέν κενό**, 2Δ **και** 3Δ.

⚠️ **ΚΡΙΣΙΜΗ ΑΡΧΙΤΕΚΤΟΝΙΚΗ ΔΙΑΦΟΡΑ (να την έχεις στο μυαλό):** ο **σοβάς τοίχου** ζει σε **multi-layer DNA** (ADR-413/447 — side core/exterior/interior, **ΜΕΣΑ** στο nominal πάχος του τοίχου). Ο **σοβάς κολόνας** (ADR-449) είναι **additive-OUTWARD** δέρμα (ΕΞΩ από τη στατική διατομή). **Δύο διαφορετικά συστήματα με αντίθετες συμβάσεις** → εδώ γεννιούνται τα overlap/gap. Big-player απόφαση (Slice 7, MEMORY): immutable διατομή + additive-outward· η ομοεπιπεδότητα = ευθύνη διαστάσεων αρχιτέκτονα, **ΠΟΤΕ** auto-recess της διατομής.

### ΠΡΩΤΟ ΒΗΜΑ: Firestore-first — διάβασε τα records ΑΦΟΥ ο Giorgio βάλει τον τοίχο
ΜΗΝ μαντέψεις. Διάβασε `floorplan_walls` (νέος τοίχος) + την κολόνα, δες **alignment/justification/πάχος/άξονα/`topBinding`** του τοίχου σε σχέση με την παρειά κολόνας. Repro-first ξεκλείδωσε ΟΛΑ τα προηγούμενα finish bugs (Slice 8b/9/10/X1).

---

## 1. Firestore baseline (η σκηνή ΤΩΡΑ — πριν τον τοίχο)
- project `proj_1d45b55b-e5ea-41fb-9466-bda795361e65` · floorplan `file_f6b1782f-9e78-4ef6-a461-11ae41724d45` · level `lvl_aec46939-c091-4eb9-955a-2b3be650e71a` · floor `flr_4e7868ba-32b3-4327-9a24-b2de5320adb5`.
- **1 κολόνα** `col_fb3215e9-cabc-4c35-bc79-61669775d5a1`: **`kind:'rectangular'`**, width **501.68mm** × depth **1001.25mm** (επιμήκης ~2:1), center `(11.516, 4.281)`m, rotation 0, anchor center, height 3000, `finish{enabled:true, plaster-int/ext, thickness:15}`, sceneUnits **'m'**.
  - ⚠️ Κουβαλά **leftover params** από προηγούμενα reshapes: `composite.polygon` (6-κορυφο Γ), `ushape`, `tshape`. **ΑΓΝΟΟΥΝΤΑΙ** όσο `kind:'rectangular'` (το geometry.footprint είναι 4-κορυφο ορθογώνιο). Μην μπερδευτείς — η ενεργή διατομή = ορθογώνιο 502×1001.
- `floorplan_walls` = **0** · `floorplan_beams` = **0**.
- firestore MCP: `mcp__firestore__firestore_query`/`_get_document`/`_count` (collections `floorplan_columns`/`_beams`/`_walls`, filter `floorplanId == file_f6b1782f…`).

---

## 2. ΚΑΤΑΣΤΑΣΗ — τι έγινε ΑΥΤΗ τη συνεδρία (ΟΛΑ UNCOMMITTED — ο Giorgio θα κάνει commit)

### Free reshape ΣΤΑΤΙΚΗΣ ΔΙΑΤΟΜΗΣ κολόνας (ADR-363/449 PHASE 1) — 594/594 jest
- **Λαβές σε ΚΑΘΕ γωνία** → ελεύθερη αναμόρφωση της **στατικής διατομής** (πυρήνα)· ο σοβάς ακολουθεί. Ελεύθερη μετακίνηση γωνίας → η διατομή γίνεται **`composite`** (custom profile· materialize-on-drag, REUSE composite pipeline, μηδέν νέα γεωμετρία).
- **Λαβές στο ΜΕΣΟ κάθε πλευράς** (`column-poly-edge-${i}`) → σύρσιμο μετακινεί **όλη την πλευρά** (`moveColumnEdgeFree`).
- **Λαβή περιστροφής σε ΕΣΩΤΕΡΙΚΟ σημείο** της διατομής — NEW SSoT `interiorAnchorPoint` (`bim/geometry/shared/polygon-interior-point.ts`, pole-of-inaccessibility· REUSE `pointInPolygon`/`polygonCentroid`/`pointToSegmentDistance`). Κρίσιμο: σε κοίλο Γ το bbox-κέντρο πέφτει στην εγκοπή (κενό). Consistency emission↔drag via `freeReshapeRotationWorld(params)`.
- **Στατικό guard:** acute-sliver code violation (`MIN_SECTION_CORNER_ANGLE_DEG=20°` + NEW SSoT `minPolygonInteriorAngleDeg` στο `polygon-utils.ts`, REUSE `angleBetweenVectors`/`radToDeg`).
- Unification: κάθε polygon-backed (composite/U-poly + το composite μετά από drag) δρομολογείται μέσω `freeCornerReshapeGrips`. DRY: `commitPolygonReshape`+`ensurePolygonBacked`. **ΕΚΤΟΣ ADR-040** (μηδέν canvas-drawing touch).

### 🔴 UNCOMMITTED αρχεία (git add ΜΟΝΟ αυτά· MIXED → μόνο δικές σου γραμμές)
- `src/subapps/dxf-viewer/bim/columns/column-grips.ts`
- `src/subapps/dxf-viewer/bim/columns/column-poly-vertex-grips.ts`
- `src/subapps/dxf-viewer/bim/geometry/column-geometry.ts`
- `src/subapps/dxf-viewer/bim/geometry/shared/polygon-utils.ts`
- `src/subapps/dxf-viewer/bim/geometry/shared/polygon-interior-point.ts` **(NEW)**
- `src/subapps/dxf-viewer/bim/validators/column-validator.ts` **(MIXED με ADR-456 reinforcement agent — μόνο δικές σου γραμμές: import minPolygonInteriorAngleDeg + validateCompositeParams codeViolations + sectionAngleTooAcute)**
- `src/subapps/dxf-viewer/bim/types/column-types.ts` **(MIXED — μόνο `MIN_SECTION_CORNER_ANGLE_DEG`)**
- `src/subapps/dxf-viewer/hooks/grip-kinds.ts` (μόνο `column-poly-edge-${number}`)
- tests: `bim/columns/__tests__/column-grips.test.ts`, `column-grips-free-corner.test.ts` **(NEW)**, `column-grips-phase2b.test.ts`, `bim/validators/__tests__/column-validator.test.ts`, `bim/geometry/shared/__tests__/polygon-utils-angle.test.ts` **(NEW)**, `polygon-interior-point.test.ts` **(NEW)**
- i18n: `src/i18n/locales/el/dxf-viewer-shell.json` + `en/dxf-viewer-shell.json` (key `sectionAngleTooAcute`)
- docs: `ADR-363-bim-drawing-mode.md`, `ADR-449-structural-finish-skin.md`, `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`, `.claude-rules/pending-ratchet-work.md` (flag pointToSegmentDistance proliferation), MEMORY topic.
> ΕΠΙΣΗΣ UNCOMMITTED από προηγούμενες συνεδρίες (ADR-449 Slices 9/10/X1/X2 + Slice 5 fix) — βλ. `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`.

### 🔴 ΕΚΚΡΕΜΕΙ verify (από προηγούμενη δουλειά)
- **tsc:** `! npx tsc --noEmit` (N.17 — ένα tsc τη φορά· ο running-tsc check θέλει PowerShell που είναι denied στον agent → ζήτα από Giorgio).
- **browser** free reshape: Γ → 6 corners + 6 edge-midpoints· σύρε γωνία/πλευρά → πυρήνας+σοβάς 2Δ+3Δ· rotation εσωτερικό σημείο.

---

## 3. SSoT touchpoints για τη ΝΕΑ δουλειά (PHASE 1 RECOGNITION — διάβασέ τα ΠΡΩΤΑ)

### Σοβάς κολόνας (ADR-449) — πώς ο τοίχος αφαιρεί σοβά
| Αρχείο | Ρόλος |
|---|---|
| `bim/finishes/structural-finish-silhouette.ts` | **ΕΝΕΡΓΟ** merged silhouette (Slice X1, `STRUCTURAL_SILHOUETTE_ENABLED=true`)· `WallObstacle{footprint,zBotMm,zTopMm}` + per-band vertical-overlap filter `wallFootprintsInBand`. |
| `bim/finishes/structural-finish-scene-silhouette.ts` | scene adapter `computeStructuralFinishSilhouette(columns,beams,walls,floorElev)` — χτίζει wall obstacles (**un-dilated**, height-aware· attached-top resolved). Τροφοδοτεί **ΚΑΙ 2Δ ΚΑΙ 3Δ** (Slice X2). |
| `bim/finishes/structural-finish-resolver.ts` | `coveredIntervals` ανά παρειά → exposed complement· εκεί «αφαιρείται» ο σοβάς όπου καλύπτει ο τοίχος. `wallFootprintPolygon(w)` = finished outline τοίχου. |
| `bim/finishes/structural-finish-scene.ts` (@~499γρ ΟΡΙΑΚΟ N.7.1) | `wallFootprintPolygon`, `buildStructuralFinishClassifier`, `EXTERIOR_EDGE_TOL_MM`. |
| `canvas-v2/dxf-canvas/dxf-renderer-frame-builders.ts` `buildStructuralFinishSilhouette2D` + `DxfRenderer.drawStructuralFinishSkin2D` | 2Δ render (per-frame, εντός cached bitmap). **ΑΝ αγγίξεις → CHECK 6D: stage ADR-040.** |
| `bim-3d/.../bim-scene-structural-finish-sync.ts` `syncStructuralFinishSkin` | 3Δ scene-level pass. |

### Σοβάς ΤΟΙΧΟΥ (ΔΙΑΦΟΡΕΤΙΚΟ σύστημα — μην το μπερδέψεις με ADR-449)
- Multi-layer DNA τοίχου (ADR-413/447): plaster layers **ΜΕΣΑ** στο nominal. Grep: `boq-multi-layer-builder`, `wall` finish/layer, `envelopeLayer` (ETICS εξωτ.). Ο σοβάς τοίχου είναι side core/exterior/interior **εντός** του πάχους.
- ⚠️ Το ερώτημα #2 (overlap/gap) είναι **ακριβώς** η διεπαφή των δύο συστημάτων: additive-outward (κολόνα) vs inside-nominal (τοίχος). Πιθανές αιτίες overlap: ο σοβάς κολόνας προεξέχει 15mm έξω από την παρειά, ενώ ο τοίχος έχει το δικό του σοβά στην ίδια περιοχή.

### ΜΑΘΗΜΑΤΑ από προηγούμενα (MEMORY `project_adr449_structural_finish_skin` — διάβασέ το ΟΛΟ)
- Slice 7/X1: walls-as-obstacle **un-dilated** (collinear τοίχος→σοβάς εμφανίζεται· κάθετος→καλύπτεται). **ΜΗΝ dilate τους τοίχους** (το είχα κάνει→regression).
- Slice 8/8b: **height-aware** coverage· attached-top wall = στήριγμα (resolved top), εξαιρείται. Coincident faces + ray-casting → ασύμμετρη «μία όψη».
- Slice X1: «μία όψη» = naive wall coverage (όχι τοπολογικό). Firestore-records-first ξεκλείδωσε την αιτία.

---

## 4. ΚΑΝΟΝΕΣ (ΑΠΑΡΑΒΑΤΟΙ)
- **Ελληνικά πάντα.** **FULL ENTERPRISE + FULL SSOT** — **grep για υπάρχον SSoT ΠΡΙΝ γράψεις ΟΠΟΙΑΔΗΠΟΤΕ γεωμετρική πράξη** (μάθημα αυτής της συνεδρίας: 2 φορές έγραψα low-level duplicate — `RAD_TO_DEG`/acos & point-seg distance — που υπήρχαν ήδη· ο Giorgio τα έπιασε). Canonical geom SSoT: `pointToSegmentDistance` (`systems/guides`), `pointInPolygon`/`polygonCentroid`/`polygonArea` (`bim/geometry/shared/polygon-utils`), `angleBetweenVectors`/`radToDeg` (`rendering/entities/shared`), `safeUnion` (`safe-polygon-boolean`).
- **Commit/push ΜΟΝΟ ο Giorgio** (N.(-1)). **`git add` ΜΟΝΟ δικά σου αρχεία** (shared tree). ΠΟΤΕ `-A`/`--no-verify`.
- N.7.1 (40γρ/func, 500γρ/file· `structural-finish-scene.ts` @~499 — νέα logic σε νέο module). No `any`/`as any`/`@ts-ignore`. N.11 (i18n keys ΠΡΩΤΑ σε el+en).
- **ΕΝΑ tsc τη φορά (N.17)** — ζήτα από Giorgio `! npx tsc --noEmit`.
- Αν αγγίξεις 2Δ canvas drawing (DxfRenderer/frame-builders/renderers) ή micro-leaf → **CHECK 6B/6D: stage ADR-040** + changelog ADR-040.
- **N.15:** μετά από ΚΑΘΕ υλοποίηση → `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (μόνο τι εκκρεμεί) + ADR-449 changelog + adr-index + MEMORY, ίδιο commit.
- **Firestore-first + confirm repro ΠΡΙΝ re-implement.** Plan Mode + έγκριση αν αλλάζεις αρχιτεκτονική.

---

## 5. ΠΡΩΤΟ ΒΗΜΑ ΝΕΑΣ ΣΥΝΕΔΡΙΑΣ
1. Recognition: MEMORY `project_adr449_structural_finish_skin` + τα §3 αρχεία (silhouette + scene-silhouette + resolver + wall finish system).
2. **Περίμενε/ζήτα από Giorgio να βάλει τον τοίχο**, μετά **Firestore-first**: διάβασε `floorplan_walls` + την κολόνα → alignment/πάχος/άξονας/topBinding.
3. Browser-verify (2Δ+3Δ): (#1) στη συμβολή ΚΑΘΟΛΟΥ σοβάς κολόνας· (#2) σοβάς τοίχου↔κολόνας = μηδέν overlap/gap. Αν υπάρχει πρόβλημα → διάγνωση (code=SoT) → fix REUSE υπάρχουσα μηχανή (obstacle/coveredIntervals/silhouette· ΟΧΙ νέο σύστημα).
4. tsc (Giorgio) → ο Giorgio κάνει commit.
