# 🧠 HANDOFF — ADR-363 Φ1G.5 Slice 2f: 3Δ Temporary Dimensions κουφωμάτων
## Phase 1 DONE → NEXT: Junction-aware references (μέτρηση από ΠΑΡΕΙΑ εγκάρσιου τοίχου)

> **Σύνταξη:** Opus 4.8, 2026-06-09. **Στόχος νέας συνεδρίας:** Recognition → Plan Mode → έγκριση → υλοποίηση. **FULL ENTERPRISE + FULL SSOT, «όπως η Revit».** Καθαρό context.

---

## ⚠️ ΚΑΝΟΝΕΣ (πάγιοι — διάβασέ τους ΠΡΩΤΑ)
- **Ελληνικά** όλες οι απαντήσεις στον Giorgio.
- **FULL ENTERPRISE + FULL SSOT** — μηδέν `any`/`as any`/`@ts-ignore`· αρχεία ≤500 γρ.· functions ≤40 γρ.· καμία διπλή υλοποίηση (reuse τα SSoT της §4).
- **Πάρε ΕΣΥ τις Revit αποφάσεις** + ζήτα ΜΟΝΟ έγκριση plan ([[feedback_make_revit_grade_decisions_yourself]]).
- **SHARED working tree** με ΑΛΛΟΝ agent (κάνει commits μόνος του). `git add` **ΜΟΝΟ** τα δικά σου αρχεία (§3 λίστα)· **ΠΟΤΕ** `git add -A`. Έλεγχε `git log`/`git status` συχνά.
- **COMMIT/PUSH = ΜΟΝΟ ο Giorgio** (N.(-1)). Ο agent ΔΕΝ κάνει commit. **ΜΗΝ** adr-index.
- **N.17:** ΕΝΑΣ tsc τη φορά — έλεγξε process πρώτα (`Get-CimInstance Win32_Process … *tsc*`), συχνά τρέχουν άλλων agents· ΠΕΡΙΜΕΝΕ, μην σκοτώνεις. (Pattern: guarded background loop που περιμένει το slot.)
- **«Confirm repro before re-implementing»** ([[feedback_confirm_repro_before_reimplementing]]).
- **ADR-040:** το overlay είναι scene-leaf (μπαίνει στο `scene`, ΟΧΙ στο `bimLayer.group`) → ΕΚΤΟΣ micro-leaf. ΑΛΛΑ αγγίζεις canvas-drawing αρχεία (`use-bim3d-opening-move`, `Dimension3DRenderer`) → CHECK 6B/6D θέλουν staged ADR (ADR-363).

---

## 0) ΤΟ ΑΙΤΗΜΑ ΤΗΣ ΝΕΑΣ ΣΥΝΕΔΡΙΑΣ (Giorgio)

Σενάριο: **2 τοίχοι σε σχήμα «L»**. Στη **βάση** του «L» = ο τοίχος με το κούφωμα (host). Ο κάθετος (αριστερός) τοίχος είναι ο **εγκάρσιος**.

Όταν μετακινείς το κούφωμα, η temporary dimension προς εκείνο το άκρο **ξεκινά από το ΚΕΝΤΡΟ-ΑΞΟΝΑ του εγκάρσιου τοίχου** (= ο κόμβος του L), **ΟΧΙ από την παρειά (face)** του εγκάρσιου τοίχου.

**Giorgio: «Αυτό είναι σωστό;» → ΟΧΙ (η κρίση μου, Revit-grounded):** μετρά μέχρι τον άξονα → **περιλαμβάνει το μισό πάχος** του εγκάρσιου τοίχου = άχρηστη απόσταση. Το **σωστό/χρήσιμο (Revit default για κουφώματα)** = μέτρηση μέχρι την **κοντινή ΠΑΡΕΙΑ** του εγκάρσιου τοίχου (ο πραγματικός ελεύθερος χώρος).

**ΖΗΤΟΥΜΕΝΟ:** **Junction-aware references** — όταν η αναφορά είναι «άκρο τοίχου» σε L/T junction, μέτρα από την παρειά του εγκάρσιου τοίχου. Αν το άκρο είναι ΕΛΕΥΘΕΡΟ (κανένας εγκάρσιος) → μένει στο άκρο του τοίχου (τρέχουσα συμπεριφορά, σωστή).

---

## 1) ΠΟΥ ΕΙΜΑΣΤΕ — Slice 2f Phase 1 ✅ DONE (μη το ξαναφτιάξεις)

**3Δ σύρσιμο κουφώματος → ≤2 μπλε temporary dimensions** (αριστερή/δεξιά παρειά → πλησιέστερη αναφορά) με ζωντανό αριθμό· transient read-model (μηδέν persistence)· εξαφανίζονται στο release. **22/22 tests PASS, tsc καθαρό.**

**Πυρήνας (Phase 1):**
- `getSiblingOpeningsOnWall` (pure filter+sort), `resolveOpeningDimReferences` (pure mm references), `wallAxisPointAtOffsetMm` (reuse private walk), `TempOpeningDimOverlay` (scene-leaf, reuse `createDimension3DRenderer`), hook-in στο `use-bim3d-opening-move`.

**Visual tweaks (όλα δοκιμασμένα + εγκεκριμένα από Giorgio στον browser):**
- Μέγεθος label **48px screen-constant** (σταθερό σε κάθε zoom· `getPixelWorldSize` × `TEMP_DIM_TEXT_PX=48`, aspect 4:1).
- **Non-bold** font (`64px sans-serif`).
- **Συμπαγή** γράμματα (overdraw `fillText` ×2 + `opacity:1` → μηδέν AA-διαφάνεια).
- **Μαύρο περίγραμμα/halo** στα γράμματα (`strokeText`, `TEXT_OUTLINE_WIDTH=8`, `lineJoin:'round'`). ← Giorgio «τώρα είναι καλύτερο».
- **Always-on-top ΟΛΗ η διάσταση** (κείμενο + γραμμές + βέλη): `depthTest:false`+`depthWrite:false`· renderOrder κείμενο **999**, γραμμές/βέλη **998** → πάντα ορατά ακόμα κι όταν είναι μέσα στον τοίχο.
- **Διάσταση στον ΑΞΟΝΑ του τοίχου** (όχι offset στο πλάι): `createDimension3DRenderer` πήρε optional `layoutOverride`· το overlay περνά `AXIS_LAYOUT={dimLineOffset:0,textOffset:0}` → ορατό κι από τις δύο πλευρές. ← Giorgio «τώρα είναι στο κέντρο».

**⛔ ΔΟΚΙΜΗ ΠΟΥ ΑΦΑΙΡΕΘΗΚΕ (μην την ξαναβάλεις):** μαύρο περίγραμμα στις **πράσινες γραμμές + βέλη** (fat-line halo + backing cones) → Giorgio «πολύ παχύ, άσχημο» → **αφαιρέθηκε εντελώς**. (Το μαύρο περίγραμμα στα **κείμενα** ΠΑΡΑΜΕΝΕΙ — αυτό του άρεσε.)

**Ιστορικό (context):** Slice 2e (cursor snap glyph) είχε αφαιρεθεί ως λάθος μοντέλο για hosted element· το Slice 2f είναι ο σωστός Revit δρόμος (temporary dimensions). Βλ. [[project_adr363_2d_move_from_point]].

---

## 2) ⚠️ DOCS ΠΟΥ ΕΚΚΡΕΜΟΥΝ (N.15 — finalize ΠΡΙΝ ή ΜΑΖΙ με το commit)

Στο ADR-363 §12 Slice 2f entry έχουν τεκμηριωθεί: core Phase 1, **48px screen-constant, non-bold, no-occlusion(text), solid(overdraw/opacity)**.

**ΔΕΝ έχουν τεκμηριωθεί ακόμα** (ήταν «δοκιμές» που εγκρίθηκαν — πρόσθεσέ τα στο ADR-363 §12 + ΕΚΚΡΕΜΟΤΗΤΕΣ + memory):
1. **Μαύρο text outline** (halo) — `TEXT_OUTLINE_WIDTH=8`.
2. **Axis-centred layout** (`layoutOverride` + export `LayoutOptions`· `dimLineOffset/textOffset=0`).
3. **Always-on-top γραμμές+βέλη** (`depthTest:false`, renderOrder 998).
(Η αφαιρεθείσα δοκιμή line-outline = net-zero, δεν χρειάζεται doc.)

---

## 3) 📁 ΤΑ ΑΡΧΕΙΑ ΜΟΥ (committed-ready· `git add` ΜΟΝΟ αυτά — shared tree)

**NEW:**
- `src/subapps/dxf-viewer/bim/walls/opening-siblings.ts`
- `src/subapps/dxf-viewer/bim/walls/opening-dim-references.ts`
- `src/subapps/dxf-viewer/bim-3d/placement/TempOpeningDimOverlay.ts`
- `src/subapps/dxf-viewer/bim/walls/__tests__/opening-siblings.test.ts`
- `src/subapps/dxf-viewer/bim/walls/__tests__/opening-dim-references.test.ts`
- `src/subapps/dxf-viewer/bim-3d/placement/__tests__/TempOpeningDimOverlay.test.ts`

**MOD:**
- `src/subapps/dxf-viewer/bim/geometry/opening-geometry.ts` (+export `wallAxisPointAtOffsetMm`)
- `src/subapps/dxf-viewer/bim-3d/viewport/use-bim3d-opening-move.ts` (hook-in overlay)
- `src/subapps/dxf-viewer/bim-3d/viewport/__tests__/use-bim3d-opening-move.test.ts`
- `src/subapps/dxf-viewer/bim-3d/dimensions/Dimension3DRenderer.ts` ⚠️ SHARED (ADR-366) — font/outline/overdraw/opacity/always-on-top + `layoutOverride` param
- `src/subapps/dxf-viewer/bim-3d/dimensions/dim3d-line-geometry.ts` (export `LayoutOptions`)
- `docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md` (§12 changelog)
- `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`

⚠️ **`Dimension3DRenderer.ts` / `dim3d-line-geometry.ts` είναι SHARED (ADR-366)** → οι αλλαγές επηρεάζουν ΚΑΙ τις manual 3Δ dims (σκόπιμο — Revit annotation behavior). Το `layoutOverride` είναι optional → manual dims **αμετάβλητες** (default offset 0.3m).

---

## 4) 🧩 SSOT ΧΑΡΤΗΣ — ΤΙ ΝΑ REUSE για το NEXT (junction-aware refs)

| Τι | Αρχείο | Σημείωση |
|----|--------|----------|
| **pure references (mm)** `resolveOpeningDimReferences(resolvedParams, host, siblings)` | `bim/walls/opening-dim-references.ts` | **ΕΔΩ μπαίνει το junction logic** — επέκτεινε signature με `candidateWalls` |
| **wall axis** `host.params.start/end`, `getWallAxisVertices` | `bim/geometry/wall-geometry.ts` / wall params | scene-units plan points |
| **wall πάχος** `wall.params.thickness` | wall entity | mm? (έλεγξε units — `mmToSceneUnits`) |
| **offset→axis world point** `wallAxisPointAtOffsetMm(host, mm)` | `bim/geometry/opening-geometry.ts` | ήδη το χρησιμοποιεί το overlay |
| **ΥΠΑΡΧΟΥΣΑ wall-junction SSoT** `wall-trims.ts`, `wall-region-autojoin`, `resolveTwoWayCorner` | `bim/walls/` | **ΨΑΞΕ ΠΡΩΤΑ** — μπορεί να υπάρχει ήδη wall-intersection/junction helper· ΜΗΝ γράψεις νέα intersection math αν υπάρχει SSoT |
| **candidateWalls στο drag** `drag.walls` | `use-bim3d-opening-move.ts` | ήδη captured· πέρασέ τα στο overlay.update→resolveOpeningDimReferences |
| **overlay** `TempOpeningDimOverlay.update(...)` | `bim-3d/placement/TempOpeningDimOverlay.ts` | πρόσθεσε `candidateWalls` param, πέρασέ τα στο references |

---

## 5) 🔴 ΤΟ NEXT — Junction-aware face references (Plan Mode)

**Αλγόριθμος (Revit «μέτρηση από παρειά εγκάρσιου τοίχου»):**
1. Στο `resolveOpeningDimReferences`, όταν `prevIsWallEnd` (offset 0) ή `nextIsWallEnd` (offset = wallLength): κάλεσε νέο pure helper **`resolveJunctionFaceOffsetMm(host, endpoint:'start'|'end', candidateWalls): number | null`**.
2. Ο helper: βρες **εγκάρσιο τοίχο** του οποίου ο άξονας περνά κοντά στο `host.params.start`/`.end` (tolerance), **μη-collinear** με τον host. Αν δεν υπάρχει → `null` (ελεύθερο άκρο, μένει στο άκρο).
3. Αν υπάρχει: υπολόγισε την **εσωτερική μετατόπιση** (mm) κατά τον άξονα του host μέχρι την **κοντινή παρειά** του εγκάρσιου: `d = (thickness_T / 2) / |sin(θ)|`, θ = γωνία host↔εγκάρσιου (κάθετος → `d = t/2`· λοξός → μεγαλύτερο). Πρόσεξε units (scene vs mm) — reuse `mmToSceneUnits`.
4. `prevRefOffsetMm = +d`· `nextRefOffsetMm = wallLength − d`. Distances ενημερώνονται αυτόματα.

**ΚΡΙΣΙΜΟ — Recognition ΠΡΙΝ κώδικα:** ψάξε στο `bim/walls/` (wall-trims, wall-region-autojoin, corner resolvers) αν **υπάρχει ήδη SSoT** για wall-junction detection / intersection / near-face. Αν ναι → reuse. Αν όχι → νέο pure helper.

**Slicing πρόταση:** μόνο αυτό το ένα feature (junction-aware refs) + tests (κάθετος/λοξός/T-junction/ελεύθερο άκρο/collinear). Tests pure → εύκολα.

**🔵 FUTURE (μην τα κάνεις τώρα):** Phase 2 numeric input/listening (`CanvasNumericInputStore` → ακριβές typed offset)· Phase 3 2Δ parity (PreviewCanvas)· Phase 4 alignment snap· Revit Tab toggle centerline↔face.

---

## 6) RECOGNITION (ΠΡΙΝ κώδικα — επιβεβαίωσε)
1. `bim/walls/opening-dim-references.ts` (η τρέχουσα pure references — εδώ επεκτείνεις).
2. `bim/walls/wall-trims.ts` + wall-region-autojoin + corner resolvers → **υπάρχει wall-junction/intersection SSoT;**
3. `bim-3d/placement/TempOpeningDimOverlay.ts` (πώς καλεί references· πρόσθεσε candidateWalls).
4. `use-bim3d-opening-move.ts` `onMove` (από πού περνάς `drag.walls` στο overlay.update).
5. Units: `wall.params.thickness` / `start` / `end` — scene-units ή mm; (`mmToSceneUnits`).

---

## 7) TESTS / TSC / DOCS
- **Tests:** pure `resolveJunctionFaceOffsetMm` (κάθετος→t/2· λοξός→t/2/sinθ· T-junction· collinear→null· ελεύθερο→null) + ενημέρωση `opening-dim-references.test.ts` (junction → face offset). Mirror υπαρχόντων.
- **tsc:** background, **N.17 process-check πρώτα**. Γνωστά **προϋπάρχοντα** errors άλλων agents (ΑΓΝΟΗΣΕ): `mesh-to-object3d.ts(124)`, `mep-fixture-types.ts(151)`.
- **N.15 docs:** ADR-363 §12 (junction-aware + τα 3 εκκρεμή της §2)· memory [[project_adr363_2d_move_from_point]]· `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`. **ΜΗΝ** adr-index.

## 8) ΤΙ ΝΑ ΜΗΝ ΚΑΝΕΙΣ
- ΜΗΝ ξαναβάλεις μαύρο περίγραμμα στις πράσινες ΓΡΑΜΜΕΣ/ΒΕΛΗ (αφαιρέθηκε σκόπιμα· το κειμένου ΜΕΝΕΙ).
- ΜΗΝ ξαναφτιάξεις τον πυρήνα του Phase 1 (siblings/references/overlay) — υπάρχει.
- ΜΗΝ φτιάξεις νέα wall-intersection math αν υπάρχει SSoT (Recognition §6.2).
- ΜΗΝ αλλάξεις το offset των manual dims (κράτα το `layoutOverride` optional).
- ΜΗΝ commit/push/adr-index. ΜΗΝ `git add -A`. ΜΗΝ 2ο tsc.

## 9) ΠΡΩΤΗ ΕΝΕΡΓΕΙΑ ΝΕΑΣ ΣΥΝΕΔΡΙΑΣ
1. Διάβασε αυτό + `git log -5` + `git status`.
2. Recognition §6 (1-5).
3. Plan Mode → file-level σχέδιο (junction-aware refs §5) + εκτίμηση → έγκριση Giorgio.
4. Υλοποίηση + tests + tsc + docs (junction + τα 3 εκκρεμή §2).

## 10) ΜΝΗΜΕΣ
[[project_adr363_2d_move_from_point]] (πλήρες ιστορικό Slice 2d/2e/2f)· [[feedback_make_revit_grade_decisions_yourself]]· [[feedback_confirm_repro_before_reimplementing]].
