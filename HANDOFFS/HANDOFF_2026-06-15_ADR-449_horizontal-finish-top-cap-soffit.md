# HANDOFF — ADR-449 Οριζόντιες όψεις σοβά: καπάκι κολόνας (top) + πάνω/κάτω όψεις δοκαριού (soffit)

**Ημερομηνία:** 2026-06-15 · συνέχεια του `HANDOFF_2026-06-14_ADR-401-449_column-attach-slope-render-divergence.md`
**Quality bar:** FULL ENTERPRISE + FULL SSOT, **Revit-grade** (big-player). **Firestore-first. Confirm repro πριν re-implement.**
**Κανόνες:** Commit/push **ΜΟΝΟ ο Giorgio** (N.(-1)). **Working tree SHARED με άλλον agent → `git add` ΜΟΝΟ δικά σου αρχεία, ΠΟΤΕ `-A`/`--no-verify`.** tsc: **ο Giorgio** (`! npx tsc --noEmit`, N.17). **Ελληνικά πάντα.** N.15: ΕΚΚΡΕΜΟΤΗΤΕΣ + ADR + adr-index + MEMORY ίδιο commit με τον κώδικα.

---

## 0. Η ΑΠΟΣΤΟΛΗ (Giorgio, verbatim πρόθεση)

Ο σοβάς (structural finish skin, ADR-449) σήμερα μπαίνει **ΜΟΝΟ περιμετρικά** (κατακόρυφες πλευρικές όψεις). Πρέπει να καλύπτει **ΚΑΙ τις οριζόντιες εκτεθειμένες όψεις**, adjacency-driven (Revit «exposed faces get finish»):

### Κολόνα — καπάκι (top cap, Z+ όψη)
- **Μεμονωμένη κολόνα χωρίς πλάκα/δοκάρι από πάνω** → το **πάνω καπάκι** σοβατίζεται.
- **Αν αργότερα μπει πλάκα (ή δοκάρι) πάνω στην κολόνα** → ο σοβάς του καπακιού **αφαιρείται** σε εκείνη την όψη (καλυμμένη).
- (Βάση/κάτω όψη κολόνας: κάθεται στη στάθμη/θεμελίωση → κανονικά ΟΧΙ σοβάς· επιβεβαίωσε με Giorgio αν θέλει edge-case.)

### Δοκάρι — πάνω όψη + κάτω όψη (soffit)
- Από τη στιγμή που το δοκάρι «κόλλησε» πάνω/δίπλα στην κολόνα:
  - **Κάτω όψη (soffit)**: αν **ΔΕΝ υπάρχει τοίχος από κάτω** → σοβατίζεται.
  - **Πάνω όψη**: αν **ΔΕΝ υπάρχει πλάκα από πάνω** → σοβατίζεται.
- Δηλαδή: κάθε εκτεθειμένη οριζόντια όψη δοκαριού (που δεν συναντά τοίχο κάτω / πλάκα πάνω) παίρνει σοβά.

**Revit truth:** ο σοβάς ακολουθεί τις **εκτεθειμένες** όψεις. Ό,τι καλύπτεται από γειτονικό δομικό (τοίχος/πλάκα/άλλο) ΔΕΝ σοβατίζεται. Ίδια φιλοσοφία με το υπάρχον περιμετρικό adjacency — απλώς επεκτείνεται στις **οριζόντιες** όψεις (Z άξονας).

---

## 1. ΤΟ ΥΠΑΡΧΟΝ ΣΥΣΤΗΜΑ ΣΟΒΑ (ADR-449) — SSoT touchpoints (διάβασε ΠΡΩΤΑ)

Το σημερινό finish είναι **περιμετρικό** (κατακόρυφες όψεις, σε plan space 2D footprint edges), με adjacency που αφαιρεί τα καλυμμένα κομμάτια. **ΔΕΝ** χειρίζεται top/bottom (οριζόντιες) όψεις.

| Αρχείο | Ρόλος |
|---|---|
| `bim/finishes/structural-finish-types.ts` | `StructuralFinishSpec` (stored: υλικό+πάχος) + `StructuralFinishFaces` (**DERIVED**, resolver output — per-face εκτεθειμένες υπο-ακμές). **ΕΔΩ προσθέτεις** top/bottom face data στο derived output. |
| `bim/finishes/structural-finish-resolver.ts` | `resolveStructuralFinishFaces(input)` (γρ. 205) — **SSoT adjacency** (περιμετρικό). **ΕΔΩ προσθέτεις** «top cap exposed;» / «soffit exposed;» λογική. |
| `bim/finishes/structural-finish-outline-geometry.ts` | 2Δ outline του σοβά. |
| `bim/finishes/structural-finish-scene.ts` / `structural-finish-silhouette.ts` | scene wiring + ενιαία silhouette (Slice X1). |
| `bim-3d/converters/structural-finish-3d.ts` | `buildColumnFinishSkin`, `buildBeamFinishSkin` — **3Δ geometry** του σοβά. **ΕΔΩ προσθέτεις** top-cap slab / soffit-slab geometry. |
| `bim-3d/converters/bim-three-structural-converters.ts` | `composeColumnWithFinish` (γρ. 130) + `buildBeamFinishSkin` call (γρ. 262). |
| `bim/renderers/structural-finish-outline-2d.ts` | 2Δ render του σοβά. |

**Πηγή vertical adjacency (REUSE — μην ξαναφτιάξεις):**
- `bim/geometry/column-vertical-profile.ts` → `resolveColumnTopProfile` (top `attached`/covered;) + `classifyTopHosts` (covering πλάκα vs framing δοκάρι). **Αυτό ήδη ξέρει αν το καπάκι της κολόνας είναι καλυμμένο.** `topBinding==='storey-ceiling'` + κανένα covering host = **καπάκι εκτεθειμένο → σοβάς**.
- Δοκάρι: το `buildBeamFinishSkin` ήδη παίρνει `walls`+`columns` ως obstacles (Slice 6/8). Για soffit: «υπάρχει τοίχος κάτω;» (height-aware `WallObstacle`, Slice 8b). Για πάνω όψη: «υπάρχει πλάκα/slab πάνω;» — χρειάζεται slab presence check (νέο input στο beam finish).

**MEMORY topic (διάβασε):** `project_adr449_structural_finish_skin` (πλήρες ιστορικό Slices 1-10 + X1 + junction) · `reference_structural_color_identity_ssot` · ADR-449 doc.

---

## 2. ΚΑΤΕΥΘΥΝΣΗ (Revit-grade, FULL SSOT — αφού κάνεις recognition)

1. **Ένα predicate «is horizontal face exposed»** κοινό σε detection + render (μην διπλασιάσεις):
   - Κολόνα top: εκτεθειμένο ⇔ `resolveColumnTopProfile` λέει «όχι covering host στο καπάκι» (`hasAttach` false ή framing-only). Slab/δοκάρι πάνω → covered.
   - Δοκάρι top: εκτεθειμένο ⇔ καμία πλάκα πάνω από την πάνω όψη (z = topElevation) στο plan footprint.
   - Δοκάρι bottom (soffit): εκτεθειμένο ⇔ κανένας τοίχος κάτω (REUSE υπάρχον `WallObstacle` height-aware).
2. **Geometry:** οριζόντια πλάκα σοβά (πάχος = `finish.thickness`) στην εκτεθειμένη όψη — top cap πάνω από το καπάκι (z = top + thickness), soffit κάτω από την κάτω όψη (z = bottom − thickness). Plan extent = το footprint/outline του στοιχείου **μείον** τα καλυμμένα κομμάτια (αν μερική κάλυψη — π.χ. μισή πλάκα).
3. **Associative / live:** όταν μπει πλάκα πάνω στην κολόνα ή τοίχος κάτω από το δοκάρι → ο σοβάς της όψης **εξαφανίζεται αυτόματα** (re-resolve, ίδιος μηχανισμός με το περιμετρικό adjacency — ΟΧΙ stored flag).
4. **BOQ:** οι νέες οριζόντιες επιφάνειες προστίθενται στο σοβά-schedule (m²) — REUSE το υπάρχον finish BOQ feed.
5. **2Δ + 3Δ συνέπεια:** κάτοψη (2Δ) ίσως δεν δείχνει top/bottom (είναι οριζόντιες) — δες αν χρειάζεται ένδειξη· 3Δ = το κύριο deliverable.
6. **FULL SSOT:** ένα resolver predicate, ένα geometry builder ανά όψη-τύπο, μηδέν duplicate· REUSE vertical-profile + obstacles. Στατικός πυρήνας immutable (ο σοβάς ΠΟΤΕ στο width/depth/height).

**Πιθανά slices:** (A) column top-cap exposed+geometry· (B) column top-cap adjacency (slab/beam πάνω → αφαίρεση)· (C) beam soffit (no wall below)· (D) beam top (no slab above)· (E) BOQ· (F) partial coverage (μερική πλάκα).

---

## 3. FIRESTORE BASELINE (αναπαράξιμη σκηνή — ίδια με προηγ. session)
- company `comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757` · project `proj_1d45b55b-e5ea-41fb-9466-bda795361e65`
- floorplan `file_f6b1782f-9e78-4ef6-a461-11ae41724d45` · floor `flr_4e7868ba-32b3-4327-9a24-b2de5320adb5` · level `lvl_aec46939-c091-4eb9-955a-2b3be650e71a`
- Κολόνα `col_fb3215e9-cabc-4c35-bc79-61669775d5a1` (rectangular, `topBinding:'storey-ceiling'` → καπάκι ΕΚΤΕΘΕΙΜΕΝΟ, ιδανικό test top-cap).
- Δοκάρι `beam_d9d8da55-4586-40b0-9f85-16424228dc31` (straight, flush στη νότια όψη κολόνας μετά το fix· soffit+top εκτεθειμένα → ιδανικό test).
- MCP: `mcp__firestore__firestore_get_document`/`_query` collections `floorplan_columns`/`_beams`/`_walls`/`_slabs`.

---

## 4. ΠΡΟΗΓΟΥΜΕΝΗ SESSION — DONE+BROWSER-VERIFIED, **UNCOMMITTED** (ο Giorgio κάνει commit)

Δύο bugs λύθηκαν & επιβεβαιώθηκαν live (DB + screenshot):
- **Bug 1 (κολόνα κεκλιμένη κορυφή):** snapshot `.scene.json` (παράγωγο cache) κρατούσε stale `attached` κολόνα ενώ DB=`storey-ceiling`. FIX = **active-floor SSoT load**: NEW `systems/levels/scene-bim-load-policy.ts` (`reconcileLoadedSceneBim` — drop snapshot BIM/stair στο load, keep pure-DXF, preserve in-memory) wired στο `useLevelSceneLoader`. Save αμετάβλητο (multi-floor ADR-399 ασφαλές).
- **Bug 2 (δοκάρι «επιστρέφει» μισό-πλάτος στο reload):** ΑΛΗΘΙΝΗ ΑΙΤΙΑ (via live Firestore + console diagnostics) = `moveBeam` (`bim/utils/bim-move-geometry.ts`) έβαζε `curveControl: undefined` σε ευθύγραμμο δοκάρι → **Firestore `updateDoc` THROW** σε explicit `undefined` → silent `catch` → persist απέτυχε σε ΚΑΘΕ straight-beam move. FIX = destructure-omit του `curveControl`, re-add μόνο σε curved. DB verified (axis 3.7627, updatedAt>createdAt, μένει flush).
- **+ Robustness:** beam param-edit immediate-persist listeners (`bim:beam/column-params-updated`) + `persist-serializer` στο `useBeamPersistence` (mirror column).
- 26 jest GREEN.

**🔴 git add ΜΟΝΟ ΑΥΤΑ (UNCOMMITTED, δικά μου):**
```
src/subapps/dxf-viewer/bim/utils/bim-move-geometry.ts (+ __tests__/bim-move-geometry.test.ts)
src/subapps/dxf-viewer/systems/levels/scene-bim-load-policy.ts (NEW + __tests__/scene-bim-load-policy.test.ts)
src/subapps/dxf-viewer/systems/levels/hooks/useLevelSceneLoader.ts
src/subapps/dxf-viewer/hooks/data/useBeamPersistence.ts
src/subapps/dxf-viewer/hooks/data/useColumnPersistence.ts
docs/centralized-systems/reference/adrs/ADR-390-symmetric-bim-delete-undo.md
docs/centralized-systems/reference/adr-index.md
local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt
```
**⚠️ ΜΗΝ committάρεις τα bundles άλλου agent:** ADR-449 #A/#C (finishes), ADR-401/441 attach-coordinator — είναι του Giorgio/άλλου.

**ΜΑΘΗΜΑ που ισχύει ΚΑΙ για το νέο task:** ΠΟΤΕ explicit `undefined` σε Firestore params (`updateDoc` throws, δεν τα αγνοεί)· silent `catch` σε persist κρύβει bugs (το beam-persist `catch` να γίνει `logger.error` — DEFER στο ΕΚΚΡΕΜΟΤΗΤΕΣ).

---

## 5. ΠΡΩΤΟ ΒΗΜΑ ΝΕΑΣ ΣΥΝΕΔΡΙΑΣ
1. **Recognition (Plan Mode):** §1 αρχεία (resolver + structural-finish-3d + column-vertical-profile) + MEMORY `project_adr449_structural_finish_skin` + ADR-449. Κατάλαβε πώς το περιμετρικό adjacency βρίσκει «εκτεθειμένο» — επέκτεινε στις οριζόντιες όψεις με ΤΟ ΙΔΙΟ predicate-style.
2. **Confirm repro (Firestore-first §3):** φόρτωσε τη σκηνή, δες σε 3Δ ότι κολόνα+δοκάρι σοβατίζονται ΜΟΝΟ περιμετρικά (όχι top/soffit) → αυτό είναι το gap.
3. **Πάρε Revit-grade αποφάσεις μόνος σου** (memory `feedback_make_revit_grade_decisions_yourself`)· ζήτα έγκριση plan, ΟΧΙ micro-επιλογές.
4. Slices §2. Stage ADR-040 αν αγγίξεις 2Δ canvas/render files. N.15 tracking. tsc+commit = Giorgio.
