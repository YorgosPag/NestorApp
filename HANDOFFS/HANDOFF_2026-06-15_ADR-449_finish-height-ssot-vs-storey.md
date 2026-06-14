# HANDOFF — ADR-449: Ο σοβάς πρέπει να παίρνει το ΥΨΟΣ από την ΙΔΙΑ SSoT με τον δομικό πυρήνα (storey-aware), ΟΧΙ από raw `params.height`

**Ημερομηνία:** 2026-06-15 · συνέχεια του Slice 11 (οριζόντιες όψεις σοβά — DONE+verified)
**Quality bar:** FULL ENTERPRISE + FULL SSOT, **Revit-grade** (big-player). **Firestore-first. Confirm repro πριν re-implement.**
**Κανόνες:** Commit/push **ΜΟΝΟ ο Giorgio** (N.(-1)). **Working tree SHARED με άλλον agent → `git add` ΜΟΝΟ δικά σου αρχεία, ΠΟΤΕ `-A`/`--no-verify`.** tsc: **ο Giorgio** (`! npx tsc --noEmit`, N.17). **Ελληνικά πάντα.** N.15: ΕΚΚΡΕΜΟΤΗΤΕΣ + ADR + adr-index + MEMORY ίδιο commit με τον κώδικα.

---

## 0. ΤΟ ΝΕΟ BUG (Giorgio, verbatim πρόθεση)

Ο Giorgio άλλαξε **ύψος κολόνας → 2700** (από το ribbon, πεδίο «Ύψος»). Αποτέλεσμα: **κατέβηκε ΜΟΝΟ ο σοβάς** (το finish skin πήγε στα 2700) ενώ ο **δομικός πυρήνας ΕΜΕΙΝΕ** ψηλά (στο storey ceiling, ~3000). → **ασυμφωνία ύψους σοβά ↔ πυρήνα.**

**Η υπόθεση του Giorgio (ΣΩΣΤΗ, επιβεβαιωμένη από κώδικα):** το ύψος της κολόνας **ΔΕΝ ορίζεται από το `params.height` του ribbon** — ορίζεται **storey-aware** (από τη σελίδα **Κτίρια → καρτέλα Όροφοι**, δηλ. το `floor.height`/storey ceiling). Ο πυρήνας renders στο storey ceiling· ο σοβάς (λάθος) διαβάζει `params.height`. Όταν `params.height ≠ storey ceiling` → χωρίζουν.

---

## 1. Η ΑΠΟΣΤΟΛΗ (Revit-grade, FULL SSOT)

**Ο σοβάς (vertical silhouette + horizontal caps/soffit) πρέπει να παίρνει το κατακόρυφο εύρος [zBot, zTop] ΚΑΘΕ στοιχείου από την ΙΔΙΑ SSoT με τον RENDERED πυρήνα — ΠΟΤΕ από raw `params.height`/`params.topElevation`.**

- **Κολόνα** (η κύρια αιτία): ο πυρήνας renders με `resolveColumnTopProfile`/`resolveColumnNominalTopZmm` (storey-ceiling → `nextFloorElevationMm − ceilingSlabThicknessMm + topOffset`· attached → per-corner lower-envelope) και `resolveColumnBaseZmm`. **Ο σοβάς πρέπει να καλεί τους ΙΔΙΟΥΣ resolvers.**
- **Δοκάρι**: ο πυρήνας χρησιμοποιεί `topElevation + zOffset` (resolved από το storey cascade ADR-448 Φ4b) και `depth`. Έλεγξε αν το δοκάρι έχει το ίδιο πρόβλημα (πιθανόν OK — χρησιμοποιεί ήδη topElevation, ΟΧΙ raw height· **confirm με repro**).

**Big-player αρχή:** ΕΝΑ resolved vertical extent ανά στοιχείο, υπολογισμένο ΜΙΑ φορά στο scene-level, τροφοδοτεί ΚΑΙ τον πυρήνα ΚΑΙ τον σοβά (vertical + horizontal). Ο σοβάς είναι παράγωγο — ακολουθεί πάντα τον πυρήνα.

---

## 2. ΠΟΥ ΕΙΝΑΙ ΤΟ ΛΑΘΟΣ (SSoT touchpoints — διάβασε ΠΡΩΤΑ)

| Αρχείο | Τρέχον (ΛΑΘΟΣ) | Πρέπει |
|---|---|---|
| `bim/finishes/structural-finish-scene-silhouette.ts` → `columnZExtent` (γρ. ~48) | `zBot=floorElev+baseOffset`, `zTop=zBot+params.height` | resolved: `resolveColumnBaseZmm` / `resolveColumnTopProfile` (ή `resolveColumnNominalTopZmm`) |
| `bim/finishes/structural-finish-scene-horizontal.ts` → `columnZExtent` (γρ. ~248) | ίδιο raw `params.height` | ίδιο resolved |
| (beam) `beamZExtent` και στα δύο | `topElevation+zOffset`, `−depth` | confirm: αν ο πυρήνας χρησιμοποιεί το ίδιο → OK· αλλιώς resolved |

**Πυρήνας (η SSoT αναφοράς):**
- `bim/geometry/column-vertical-profile.ts` → `resolveColumnTopProfile` / `resolveColumnBaseProfile` / `resolveColumnNominalTopZmm` / `resolveColumnBaseZmm` (ADR-401 Phase F). Χρειάζονται `ColumnVerticalContext` = `{ floorElevationMm, nextFloorElevationMm?, ceilingSlabThicknessMm?, resolveHostInput? }`.
- `bim-3d/converters/bim-three-structural-converters.ts` → `columnToMesh` (δες πώς δέχεται `nominalHeightMm`/`topProfile`/`baseProfile` και τι περνά ο caller).
- `bim-3d/scene/BimSceneLayer.ts` + `bim-scene-context.ts` (`SyncContext`) → εδώ υπολογίζεται το storey context (`floorElevationMm`, πιθανόν `nextFloorElevationMm`, ceiling slab thickness). **Εδώ είναι η πηγή που πρέπει να τροφοδοτήσει ΚΑΙ τον σοβά.**
- Η σελίδα Κτίρια→Όροφοι: `floor.height`/`floor.elevation` → storey cascade (ADR-450/451). Το storey ceiling = `floor.elevation_next` ή `floor.elevation + floor.height`.

**Wiring σήμερα:** `bim-3d/scene/bim-scene-structural-finish-sync.ts` → `syncStructuralFinishSkin(group, entities, ctx, resolve)` → καλεί `computeStructuralFinishSilhouette(g.columns, g.beams, entities.walls, ctx.floorElevationMm)` + `computeStructuralHorizontalFinishFaces({...})`. **Περνά ΜΟΝΟ `ctx.floorElevationMm`** — γι' αυτό ο σοβάς δεν ξέρει το storey ceiling. Πρέπει να περάσει το πλήρες vertical context (ή προ-resolved zExtents).

---

## 3. ΚΑΤΕΥΘΥΝΣΗ (Revit-grade, FULL SSOT — αφού κάνεις recognition)

**Προτεινόμενο (SSoT, big-player):** το scene-level `syncStructuralFinishSkin` (ή ο BimSceneLayer) να υπολογίζει **per-column resolved `{zBotMm, zTopMm}`** μέσω των `resolveColumnBaseZmm`/`resolveColumnTopProfile` (ΙΔΙΟ context με τον πυρήνα), και να το περνά στα `computeStructuralFinishSilhouette` + `computeStructuralHorizontalFinishFaces` αντί να ξανα-υπολογίζουν από `params.height`. Έτσι:
- ΕΝΑ σημείο resolution (column-vertical-profile), ΟΧΙ duplication.
- Σοβάς = πυρήνας πάντα (height-edit από ribbon Ή από Κτίρια→Όροφοι → και τα δύο ακολουθούν).
- Attached/κεκλιμένες κορυφές: το `topProfile.cornerTopZmm` δίνει per-corner· για το finish v1 αρκεί `minTopZmm`/`maxTopZmm` (flat approx — δες τι κάνει ο πυρήνας στο attached path).

**Προσοχή:** μην σπάσεις το ήδη-verified Slice 11 (οριζόντιες όψεις) ούτε το silhouette. Άλλαξε ΜΟΝΟ την **πηγή του zExtent**, όχι τη γεωμετρία faces.

**Confirm repro ΠΡΩΤΑ (Firestore-first):** η baseline κολόνα `col_fb3215e9…` είχε `params.height:3000`, `topBinding:'storey-ceiling'`. Άλλαξε ύψος→2700 (ribbon) και δες: ο πυρήνας μένει 3000 (storey), ο σοβάς πάει 2700. Επιβεβαίωσε ΠΟΥ ορίζεται το 3000 (storey ceiling = `floor.height`/`floor.elevation_next`). **Πιθανό:** το ribbon «Ύψος» γράφει `params.height` αλλά ο storey-ceiling πυρήνας το αγνοεί → ίσως το ribbon-height να μην έχει νόημα για storey-ceiling κολόνα (read-only/derived) — **πάρε Revit-grade απόφαση** (ή το ribbon-height οδηγεί `unconnectedHeight`, ή είναι derived). Ρώτησε Giorgio ΜΟΝΟ αν είναι product-choice· αλλιώς αποφάσισε εσύ + ζήτα έγκριση plan.

---

## 4. FIRESTORE BASELINE (αναπαράξιμη σκηνή)
- company `comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757` · project `proj_1d45b55b-e5ea-41fb-9466-bda795361e65`
- floorplan `file_f6b1782f-9e78-4ef6-a461-11ae41724d45` · floor `flr_4e7868ba-32b3-4327-9a24-b2de5320adb5` · level `lvl_aec46939-c091-4eb9-955a-2b3be650e71a`
- Κολόνα `col_fb3215e9-cabc-4c35-bc79-61669775d5a1` (`topBinding:'storey-ceiling'`, `params.height` το άλλαξε ο Giorgio σε 2700 — **re-fetch** να δεις τι persisted). Δοκάρι `beam_d9d8da55-4586-40b0-9f85-16424228dc31`.
- MCP firestore: `firestore_get_document` collection `floorplan_columns`/`_beams`· `firestore_query` filters `[{field,operator,value}]` (ΠΡΟΣΟΧΗ: `operator` ΟΧΙ `op`). Building/floor: collections `navigation_companies`/`buildings`/`floors` (ψάξε το storey height SSoT).

---

## 5. ΠΡΟΗΓΟΥΜΕΝΗ SESSION (Slice 11 — DONE+BROWSER-VERIFIED 2026-06-15, **UNCOMMITTED**, 83/83 jest)

**ΟΡΙΖΟΝΤΙΕΣ εκτεθειμένες όψεις σοβά** (καπάκι κολόνας top + βάση pilotis + δοκάρι top+soffit), adjacency-driven, partial-aware, μη-pickable. Λύθηκε iterative: finished-outline (offset μόνο εκτεθειμένες ακμές, REUSE resolver+`computeMiteredOuter`) + **δομικοί γείτονες = plaster-envelope obstacles στον resolver** (interval-based → ΜΗΔΕΝ boolean sliver· το boolean `safeDifference` σε flush/coincident junctions έβγαζε διαγώνιες slivers). Caps στο z[top, top+thick] → **cut-plane slider τα κλιπάρει** (ΟΧΙ bug — σήκωσε την τομή).

**🔴 git add ΜΟΝΟ ΑΥΤΑ (UNCOMMITTED, δικά μου· το base των NEW το έκανε commit ΑΛΛΟΣ agent 415dd6f4/63bb30ef με git add -A — ΟΧΙ εγώ, N.(-1)):**
```
src/subapps/dxf-viewer/bim/finishes/structural-finish-horizontal.ts (+ __tests__/structural-finish-horizontal.test.ts)
src/subapps/dxf-viewer/bim/finishes/structural-finish-scene-horizontal.ts (+ __tests__/structural-finish-scene-horizontal.test.ts)
src/subapps/dxf-viewer/bim-3d/converters/structural-finish-horizontal-3d.ts (+ __tests__/structural-finish-horizontal-3d.test.ts)
src/subapps/dxf-viewer/bim-3d/scene/bim-scene-structural-finish-sync.ts   ← MIXED, μόνο δικές μου γραμμές (addHorizontalFinish + imports)
docs/centralized-systems/reference/adrs/ADR-449-structural-finish-skin.md
local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt
```
**⚠️ ΜΗΝ committάρεις bundles άλλων agents** (ADR-390 Φ4, ADR-401/441/448 cascade, ADR-456/457, free-reshape, wall-column Δρόμος Β).

**MEMORY topic (διάβασε):** `project_adr449_structural_finish_skin` (πλήρες ιστορικό Slices 1-11) · `reference_2d_dxf_pipeline_bim_entity` · ADR-449 doc.

---

## 6. ΠΡΩΤΟ ΒΗΜΑ ΝΕΑΣ ΣΥΝΕΔΡΙΑΣ
1. **Recognition (Plan Mode):** §2 αρχεία (column-vertical-profile + τα 2 finish scene adapters + BimSceneLayer/SyncContext + columnToMesh). Κατάλαβε πώς ο πυρήνας resolve-άρει το ύψος (storey-ceiling) vs πώς ο σοβάς το διαβάζει (params.height).
2. **Confirm repro (Firestore-first §4):** re-fetch κολόνα· επιβεβαίωσε ότι πυρήνας=storey, σοβάς=params.height· βρες το storey-height SSoT (Κτίρια→Όροφοι).
3. **Πάρε Revit-grade αποφάσεις μόνος σου** (memory `feedback_make_revit_grade_decisions_yourself`)· ζήτα έγκριση plan, ΟΧΙ micro-επιλογές.
4. Υλοποίηση: thread resolved `{zBot,zTop}` (ΙΔΙΑ SSoT με πυρήνα) στον σοβά. jest ανά αλλαγή. N.15 tracking. tsc+commit = Giorgio.
