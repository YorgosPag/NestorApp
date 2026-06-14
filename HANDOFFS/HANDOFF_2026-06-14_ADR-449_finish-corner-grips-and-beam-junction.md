# HANDOFF — ADR-449 σοβάς: per-corner χειριστήρια (grips) + συνέχεια σταδιακού ελέγχου (δοκάρι→κολόνα)

**Ημερομηνία:** 2026-06-14
**ADR:** ADR-449 (structural finish skin / σοβάς)
**Quality bar:** **FULL ENTERPRISE + FULL SSOT**, **Revit-grade** («όπως οι μεγάλοι παίκτες»). Firestore-first. **Plan Mode + έγκριση plan ΠΡΙΝ κώδικα.**
**Μοντέλο:** Opus.
**Commit:** **ΜΟΝΟ ο Giorgio** (N.(-1)). **Working tree SHARED με άλλον agent → `git add` ΜΟΝΟ δικά σου αρχεία, ΠΟΤΕ `-A`/`--no-verify`.**
**Γλώσσα:** Ελληνικά πάντα.

---

## 0. Η ΝΕΑ ΔΟΥΛΕΙΑ (τι ζητάει ο Giorgio)

Σταδιακός έλεγχος, ένα πρόβλημα τη φορά. **Πριν** κολλήσουμε δοκάρι στην κολόνα, ο Giorgio θέλει:

1. **🎯 ΚΥΡΙΟ: per-corner χειριστήρια (grips) στον ΣΟΒΑ της κολόνας** — ένα χειριστήριο σε **κάθε γωνία** του σοβά (στο screenshot `Στιγμιότυπο 2026-06-14 152135.jpg` κύκλωσε με κόκκινο και τις 4 γωνίες) ώστε να έχει **ελευθερία να κάνει όποια αλλαγή θέλει** στη γωνία του σοβά.
2. Μετά → **χειριστήρια σε ΑΛΛΟΥΣ τύπους κολόνας** (circular/L/T/polygon/I-shape/shear-wall).
3. Μετά → **δοκάρι κολλημένο σε κολόνα**: έλεγχος ότι **αφαιρείται πλήρως ο σοβάς στο σημείο ένωσης** + σωστές ενώσεις σοβάδων κολόνας↔δοκαριού (ΕΝΑ συνεχές δέρμα, μηδέν αλληλοδιείσδυση/διπλή γραμμή).

### ⚠️ ΠΡΩΤΟ ΒΗΜΑ ΝΕΑΣ ΣΥΝΕΔΡΙΑΣ — ΑΠΟΣΑΦΗΝΙΣΗ ΠΡΟΘΕΣΗΣ (το «όποια αλλαγή» είναι ασαφές)
Το «χειριστήρια σε κάθε γωνία να κάνω όποια αλλαγή θέλω» χρειάζεται **Revit-grade ερμηνεία + έγκριση** πριν κώδικα. Πιθανές σημασίες (πρότεινε εσύ την enterprise + ρώτα μόνο έγκριση — κανόνας `feedback_make_revit_grade_decisions_yourself`):
- **(α) per-corner γεωμετρία σοβά:** σύρσιμο γωνίας → αλλαγή του corner treatment (miter ↔ chamfer ↔ extend/corner-fill) ή του «πόσο προεξέχει» η γωνία του σοβά. (Πιο πιθανό — ταιριάζει με «γωνία».)
- **(β) per-face πάχος/υλικό:** η γωνιακή λαβή ρυθμίζει το πάχος της παρακείμενης όψης.
- **(γ) per-face enable/disable:** λαβή που σβήνει/ανάβει τον σοβά μιας όψης (συμπλήρωμα του master Ναι/Όχι που μόλις διορθώθηκε).

**Σύσταση:** ξεκίνα με Firestore-first (διάβασε την κολόνα `col_fb3215e9…`), δες το screenshot, πρότεινε ερμηνεία (α) ως Revit-grade default + Plan, ζήτα έγκριση. **ΜΗΝ γράψεις κώδικα πριν την έγκριση.**

---

## 1. ΚΑΤΑΣΤΑΣΗ — τι έγινε ΑΥΤΗ τη συνεδρία (ΟΛΑ UNCOMMITTED, ο Giorgio θα κάνει commit)

### ✅ Slice X2 μέρος Α — κεντρικοποίηση γωνιακής γεωμετρίας 2Δ↔3Δ
NEW pure `bim/finishes/structural-finish-outline-geometry.ts` = extract του `computeMiteredOuter` (+`closeOpenOuterEnds`/`segOffsetVec`/`lineIntersect`/`MITER_LIMIT_FACTOR`/`Vec2`) από το `bim-3d/converters/structural-finish-3d.ts` (που εισάγει THREE). Re-export ώστε μηδέν break. **Corner-math = ΕΝΑ SSoT** για 2Δ+3Δ. (Έλεγξα: `getLineIntersection`=segment-clamped, `offsetPolyline`/`dilatePolygonOutward`=full-ring → κανένα drop-in, ΟΧΙ διπλότυπο.)

### ✅ Slice X2 μέρος Β — ΜΙΑ γεωμετρική πηγή (FULL SSoT)
Το **2Δ** τρέφεται από την **ΙΔΙΑ** `computeStructuralFinishSilhouette` με το 3Δ:
- `structural-finish-scene-silhouette.ts`: NEW minimal-source interfaces `SilhouetteColumnSource`/`SilhouetteBeamSource` (Pick) → ColumnEntity+DxfColumn το ικανοποιούν, μηδέν cast.
- `dxf-renderer-frame-builders.ts`: NEW `buildStructuralFinishSilhouette2D(entities)` → `{bands, sceneUnits}|null`. **Αφαιρέθηκαν** οι παλιοί `buildFinishFacesByColumn/Beam`.
- `DxfRenderer.ts`: NEW scene-level `drawStructuralFinishSkin2D` (mirror του 3Δ `syncStructuralFinishSkin`), μέσα στο cached normal-state bitmap, μετά το entity loop.
- **Αφαιρέθηκε ΟΛΟ το per-element 2Δ:** `EntityRendererComposite.set{Column,Beam}FinishFaces`, `ColumnRenderer.setColumnFinishFaces`, `drawColumnFinishOutline` (column-renderer-overlays), `BeamRenderer.setBeamFinishFaces`, types `FinishFacesBy{Column,Beam}`.
- **BOQ + 3Δ silhouette + ghosts ΑΜΕΤΑΒΛΗΤΑ.**

### ✅ Slice 5 FIX — finish keys δεν δρομολογούνταν στον composer (το «Σοβάς Ναι/Όχι» δεν δούλευε ΠΟΤΕ)
**Αιτία:** το `useRibbonCommands.ts` routing (`onComboboxChange` γρ.~160/164 + `getComboboxState` γρ.~253/254) έλεγχε μόνο `isColumnRibbonKey || isColumnRibbonStringKey` — **όχι `isColumnFinishKey`** → τα `column.params.finish.*` έπεφταν στο fallback `textEditorBridge` → `getComboboxState` null («-») + `onComboboxChange` no-op. **Fix:** προστέθηκε `|| isColumnFinishKey(key)` / `|| isBeamFinishKey(key)` + imports. **BROWSER-VERIFIED:** το combobox δείχνει πλέον «Σοβάς: Ναι» (screenshot 152135). Μένει verify ότι «Όχι» σβήνει τον σοβά 2Δ+3Δ.

### Tests
- **84/84** ADR-449 jest (NEW `canvas-v2/dxf-canvas/__tests__/structural-finish-silhouette-2d.test.ts`· αφαιρέθηκαν τα 2 παλιά renderer-finish per-element tests).
- **168/168** `bim/renderers` + `rendering/core` + `canvas-v2/dxf-canvas` (φορτώνουν DxfRenderer/composite/Column/BeamRenderer → ts-jest type-check OK).
- Εντολή: `npx jest src/subapps/dxf-viewer/bim/finishes src/subapps/dxf-viewer/bim-3d/converters/__tests__/structural-finish src/subapps/dxf-viewer/canvas-v2/dxf-canvas/__tests__/structural-finish-silhouette-2d`

### 🔴 ΕΚΚΡΕΜΕΙ verify (πριν commit)
- **tsc:** δεν μπόρεσα (N.17 — ο έλεγχος running-tsc θέλει PowerShell, denied). **Ζήτα από Giorgio: `! npx tsc --noEmit`** (ΕΝΑ tsc τη φορά).
- **browser:** (1) 2Δ γωνίες κολόνας κλείνουν ίδια με 3Δ· (2) «Σοβάς → Όχι» σβήνει τον σοβά 2Δ+3Δ.

---

## 2. UNCOMMITTED αρχεία (git add ΜΟΝΟ αυτά· MIXED → μόνο δικές σου γραμμές)
**Slice X2 (Α+Β) + Slice 5 fix (αυτή η συνεδρία):**
- `src/subapps/dxf-viewer/bim/finishes/structural-finish-outline-geometry.ts` **(NEW)**
- `src/subapps/dxf-viewer/bim/finishes/structural-finish-scene-silhouette.ts`
- `src/subapps/dxf-viewer/bim-3d/converters/structural-finish-3d.ts`
- `src/subapps/dxf-viewer/bim/renderers/structural-finish-outline-2d.ts`
- `src/subapps/dxf-viewer/canvas-v2/dxf-canvas/dxf-renderer-frame-builders.ts`
- `src/subapps/dxf-viewer/canvas-v2/dxf-canvas/DxfRenderer.ts`
- `src/subapps/dxf-viewer/canvas-v2/dxf-canvas/__tests__/structural-finish-silhouette-2d.test.ts` **(NEW)**
- `src/subapps/dxf-viewer/rendering/core/EntityRendererComposite.ts`
- `src/subapps/dxf-viewer/bim/renderers/ColumnRenderer.ts`
- `src/subapps/dxf-viewer/bim/renderers/BeamRenderer.ts`
- `src/subapps/dxf-viewer/bim/renderers/column-renderer-overlays.ts`
- `src/subapps/dxf-viewer/ui/ribbon/hooks/useRibbonCommands.ts`  ← Slice 5 fix
- ΔΙΑΓΡΑΦΗΚΑΝ: `bim/renderers/__tests__/ColumnRenderer-finish.test.ts`, `BeamRenderer-finish.test.ts`
- docs: `docs/centralized-systems/reference/adrs/ADR-449-structural-finish-skin.md`, `ADR-040-preview-canvas-performance.md`, `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`, MEMORY topic
> Επίσης UNCOMMITTED από προηγούμενες συνεδρίες: Slice X1 (3Δ silhouette: structural-finish-silhouette.ts+.test, bim-scene-structural-finish-sync.ts, bim-scene-attach-syncs.ts[MIXED], BimSceneLayer.ts[MIXED]) + Slices 9/10.

---

## 3. SSoT touchpoints για τη ΝΕΑ δουλειά (PHASE 1 RECOGNITION — διάβασέ τα ΠΡΩΤΑ)

### Grip system (ΜΗΝ φτιάξεις νέο grip core — REUSE)
| Αρχείο/SSoT | Ρόλος |
|---|---|
| `bim/grips/rect-grip-engine.ts` | κοινός πυρήνας box grips. |
| `bim/grips/axis-box-grips.ts` | γραμμικά (start/end+width: τοίχος/δοκός). |
| `bim/grips/centred-box-grips.ts` | centre-anchored (8 entities). |
| `bim/grips/grip-glyph-registry.ts` | σχήματα glyph λαβών. |
| `hooks/canvas/grip-mouse-handlers.ts` | commit του grip-drag. |
| `hooks/grips/grip-projections.ts` (preview ghost) | preview κατά το drag. |
| `…/computeDxfEntityGrips` / `getColumnGrips` | πού βγαίνουν οι λαβές μιας κολόνας. |
> MEMORY: `reference_axis_box_grips_ssot`, `reference_rotation_handle_policy_ssot`, `reference_bim_characteristic_point_snap_ssot`, `reference_2d_dxf_pipeline_bim_entity` (6 render + 3 selection σημεία ανά BIM entity).

### Finish geometry SSoT (η γωνία του σοβά ζει εδώ)
| Αρχείο | Ρόλος |
|---|---|
| `bim/finishes/structural-finish-outline-geometry.ts` | **NEW** corner-math SSoT (`computeMiteredOuter` — miter/chamfer/extend ανά άκρο). **Εδώ πιθανότατα παρεμβαίνει το per-corner grip.** |
| `bim/finishes/structural-finish-resolver.ts` | exposed faces + junction flags (`aJunction/bJunction`). |
| `bim/finishes/structural-finish-silhouette.ts` + `-scene-silhouette.ts` | ενεργό 3Δ+2Δ merged silhouette. |
| `bim/finishes/structural-finish-scene.ts` (@499 γρ — ΟΡΙΑΚΟ N.7.1) | per-element adapter + obstacles. |
| `bim/finishes/structural-finish-types.ts` | `StructuralFinishSpec` (enabled/υλικά/πάχος) + `FinishParamField`. **Αν το grip αλλάζει per-corner δεδομένα → ίσως χρειαστεί νέο πεδίο spec (per-corner overrides).** |

**ΠΡΟΣΟΧΗ — αρχιτεκτονικό σημείο για το per-corner grip:** ο σοβάς 2Δ+3Δ είναι πλέον **merged silhouette** (μη-pickable skin, μοιράζεται synthetic bimId). Οι λαβές «σε κάθε γωνία» μπορεί να χρειαστούν per-**element** corner anchors (από το footprint της κολόνας) — όχι από τη merged silhouette. Σκέψου: οι λαβές κρέμονται στις γωνίες του **πυρήνα κολόνας** (footprint), και το drag γράφει σε per-corner override στο `finish` spec → ο resolver/silhouette το διαβάζει. Κράτα **immutable τη στατική διατομή** (big-player: ο σοβάς είναι additive-outward derived).

---

## 4. ΚΑΝΟΝΕΣ (ΑΠΑΡΑΒΑΤΟΙ)
- **Ελληνικά πάντα.** **FULL ENTERPRISE + FULL SSOT** — grep centralized ΠΡΙΝ γράψεις· REUSE grip-engine/finish SSoT· μηδέν duplicate (N.0/N.12). **ΜΗΝ φτιάξεις νέο grip core.**
- **Commit/push ΜΟΝΟ ο Giorgio** (N.(-1)). **`git add` ΜΟΝΟ δικά σου αρχεία** (shared tree). ΠΟΤΕ `-A`/`--no-verify`.
- N.7.1 (40γρ/func, 500γρ/file· `structural-finish-scene.ts` @499 — νέα logic σε νέο module). No `any`/`as any`/`@ts-ignore`. N.11 (i18n — keys ΠΡΩΤΑ σε el+en αν προσθέσεις UI string).
- **ΕΝΑ tsc τη φορά (N.17)** — running-tsc check θέλει PowerShell (denied) → **ζήτα από Giorgio `! npx tsc --noEmit`**.
- Αν αγγίξεις 2Δ canvas drawing (DxfRenderer/ColumnRenderer/grip overlays/composite) ή micro-leaf files → **CHECK 6B/6D: stage ADR-040** + changelog ADR-040.
- **N.15:** μετά από ΚΑΘΕ υλοποίηση → update `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (μόνο τι εκκρεμεί) + ADR-449 changelog + MEMORY, ίδιο commit.
- **Firestore-first + Plan Mode + έγκριση πριν κώδικα.** **Confirm repro πριν re-implement.**

---

## 5. Firestore baseline (η σκηνή τώρα)
- project `proj_1d45b55b-e5ea-41fb-9466-bda795361e65`· floorplan `file_f6b1782f-9e78-4ef6-a461-11ae41724d45`· level `lvl_aec46939-c091-4eb9-955a-2b3be650e71a`.
- **1 κολόνα** `col_fb3215e9-cabc-4c35-bc79-61669775d5a1`: rectangular 400×400, height 3000, center-anchored, `finish` {enabled:true, plaster-int/ext, thickness:15}, sceneUnits **'m'** (Firestore coords σε μέτρα· canvas units = mm μέσω `mmToSceneUnits`).
- `floorplan_beams` / `floorplan_walls` = **κενά** (0).
- firestore MCP: `mcp__firestore__firestore_query`/`_get_document`/`_count` (collections `floorplan_columns`/`_beams`/`_walls`).

---

## 6. ΠΡΩΤΟ ΒΗΜΑ ΝΕΑΣ ΣΥΝΕΔΡΙΑΣ
1. Recognition: διάβασε MEMORY topic `project_adr449_structural_finish_skin.md` + τα §3 αρχεία (grip SSoT + finish SSoT).
2. Firestore-first: διάβασε την κολόνα `col_fb3215e9…`.
3. **Αποσαφήνισε την πρόθεση** των per-corner grips (§0 ⚠) — πρότεινε Revit-grade ερμηνεία + Plan, **έγκριση ΠΡΙΝ κώδικα**.
4. Υλοποίηση (REUSE grip-engine + finish SSoT) → tsc (Giorgio) → browser-verify → ο Giorgio κάνει commit.
