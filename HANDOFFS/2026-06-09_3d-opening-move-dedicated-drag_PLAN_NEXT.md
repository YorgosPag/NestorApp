# 🧠 HANDOFF — 3Δ «μετακίνηση κουφώματος» enterprise (ειδικός drag + live ghost + re-host) — ADR-363 Φ1G.5 Slice 2d

> **Σύνταξη:** Opus 4.8, 2026-06-09 (context ~90%). **Στόχος νέας συνεδρίας:** Plan Mode → υλοποίηση. Καθαρό context.

---

## ⚠️ ΚΑΝΟΝΕΣ (πάγιοι)
- **Ελληνικά** όλες οι απαντήσεις.
- **FULL ENTERPRISE + FULL SSOT, «όπως Revit»** — μηδέν `any`/`as any`/`@ts-ignore`, αρχεία ≤500 γρ., functions ≤40 γρ.
- **Πάρε ΕΣΥ τις Revit αποφάσεις** + ζήτα μόνο έγκριση plan ([[feedback_make_revit_grade_decisions_yourself]]).
- **SHARED tree** με ΠΟΛΛΟΥΣ concurrent agents (κάνουν commits μόνοι τους). `git add` **ΜΟΝΟ** τα δικά σου αρχεία (λίστα §1)· **ΠΟΤΕ** `git add -A`. Έλεγχε `git log`/`git status` συχνά.
- **COMMIT/PUSH μόνο ο Giorgio** — N.(-1). **ΜΗΝ** adr-index.
- **N.17:** ΕΝΑΣ tsc τη φορά (έλεγξε process πρώτα — συχνά τρέχουν 2 από άλλους agents· ΠΕΡΙΜΕΝΕ, μην σκοτώνεις).
- **«Confirm repro before re-implementing»** ([[feedback_confirm_repro_before_reimplementing]]).

---

## 0) ΤΟ ΑΙΤΗΜΑ (Giorgio, με στιγμιότυπο 2026-06-09 151631)

Στο **3Δ**, όταν επιλέγεις κούφωμα (πόρτα/παράθυρο) και σέρνεις βελάκι του gizmo:
1. **Εμφανίζεται περίγραμμα κύβου σε εντελώς διαφορετικό σημείο** — δεν ταυτίζεται ούτε με το gizmo ούτε με το κούφωμα (σύγχυση).
2. **Δεν βλέπεις live** το κούφωμα να μετακινείται· εμφανίζεται στη νέα θέση μόνο στο release.

Ο Giorgio ρώτησε ρητά «είναι enterprise/Revit;» → **ΟΧΙ** το τωρινό· είναι bug. Διάλεξε την **enterprise λύση**.

## 0.1) ΑΙΤΙΑ (ριζική, αρχιτεκτονική)

Το 3Δ gizmo + live-preview (`ctx.preview`) φτιάχτηκε για **συμπαγή** αντικείμενα: «πιάσε το mesh, σύρ' το άκαμπτα» (`applyMove(t)` = rigid translate του captured mesh). Το κούφωμα είναι **hosted «τρύπα»** που παράγεται από τον τοίχο:
- Ο **μετακινημένος κλώνος** του βοηθητικού mesh (door box) πέφτει σε λάθος θέση → ο «κύβος».
- Η **πραγματική** εμφάνιση (η τρύπα στον τοίχο) ξαναϋπολογίζεται **μόνο στο commit** → καμία live κίνηση.

**Revit (το πρότυπο):** hosted element → host-aware χειρισμός, **ζωντανή** κίνηση πάνω/μεταξύ τοίχων, **Pick New Host** (αυτόματη στροφή/πάχος), χειριστήρια **πάνω** στο στοιχείο, ποτέ φάντασμα-κύβος.

---

## 1) ΠΟΥ ΕΙΜΑΣΤΕ — τι ΕΓΙΝΕ ήδη (μην το ξαναφτιάξεις)

**COMMITTED** (Giorgio, commits `1a22fc70`/`ea1df989`/`6b70febf` «Slice 2 …»):
- Slice 2: αφαίρεση κεντρικού move marker (centred-box + wall/column/beam/mep-segment-horizontal/stair· mep-fixture circular)· εξαιρέσεις openings/riser/slab/roof.
- Opening **Alt-slide** 2Δ (slide κατά μήκος τοίχου) + **opening-move grip αφαιρέθηκε**.
- **re-host 2Δ** (`resolveOpeningAltMove` SSoT) + **full-symbol ghost** 2Δ (swing arc + leaf via `drawOpeningPlanOverlay`).
- **3Δ commit-level re-host** (`buildOpeningRehostMoveCommand` στο `bim3d-edit-command-builders`).
- **crash-fix** `grip-computation` opening case (domain vs wrapper).
- ADR-363 §12 changelog: entries «Slice 2» + «Slice 2b» (committed).

**UNCOMMITTED — ΔΙΚΑ ΣΟΥ (Slice 2c, η νέα συνεδρία τα κληρονομεί· verify+keep):**
- `bim/walls/opening-grips.ts` — `resolveOpeningAltMove` + optional **`forcedHost`** (3Δ cursor-picked wall override).
- `bim/walls/__tests__/opening-grips.test.ts` — +3 tests `resolveOpeningAltMove` (slide/re-host-nearest/forcedHost).
- `bim-3d/animation/bim3d-edit-interaction-handlers.ts` — `resolveWallUnderCursor` (raycast κέρσορα→τοίχο στο pointer-up) + threading `pickedWall`→`dispatchOutcome`.
- `bim-3d/animation/bim3d-edit-command-builders.ts` — `CommandBuildCtx.pickedWall` → `forcedHost`.
- (tsc: τρέχει στο τέλος της προηγ. συνεδρίας· 43 opening tests PASS.) **🔴 Slice 2c changelog entry εκκρεμεί** (ΟΧΙ committed).

**⚠️ ΑΛΛΟΙ AGENTS:** στο `git status` υπάρχουν ΠΟΛΛΑ uncommitted αρχεία (mep-boilers, thermal/heat-load, water-supply, ADR-408/422/423/426/429, i18n) — **ΔΕΝ είναι δικά σου, ΜΗΝ τα αγγίξεις/commit-άρεις**.

---

## 2) ΤΟ TASK — enterprise δρόμος (#2): ειδικός 3Δ χειρισμός κουφώματος, ΟΧΙ gizmo

**Στόχος:** Όταν επιλεγεί κούφωμα στο 3Δ:
1. **ΜΗΝ εμφανίζεται το γενικό gizmo** (ούτε ο μπερδεμένος κύβος preview) — το gizmo «grab-mesh-slide» δεν ταιριάζει σε hosted τρύπα.
2. **Ειδικός drag (Revit-style):** press στο κούφωμα → drag → **raycast τον κέρσορα στους τοίχους** → **ζωντανό ghost της πόρτας ΠΑΝΩ στον τοίχο** κάτω από τον κέρσορα (σωστή στροφή/πάχος, ξαναϋπολογισμένο ανά frame) → **release = re-host** εκεί.
3. Ίδιος τοίχος → slide· άλλος → re-host (Pick New Host).

---

## 3) ΣΧΕΔΙΟ ΥΛΟΠΟΙΗΣΗΣ (Plan Mode → επιβεβαίωσε)

### 3α) Απενεργοποίηση gizmo για κουφώματα
- Στο `bim-3d/animation/use-bim3d-edit-interaction.ts` (γύρω από `computeEditAnchor`/`overlay.setVisible`) **gate**: αν `editBimType === 'opening'` → `overlay.setVisible(false)` (κανένα gizmo/κύβος). Επιβεβαίωσε `st.editBimType` (πώς γεμίζει· από selection `bimType`).
- ΕΝΑΛΛΑΚΤΙΚΑ/επιπλέον: στο `applyLivePreview` (`bim3d-edit-live-preview-apply.ts`) skip το move preview για openings (καθαρίζει τον κύβο ακόμα κι αν μείνει gizmo path). Πάρε ΕΣΥ την καθαρή Revit απόφαση: **κανένα gizmo για openings**.

### 3β) Ειδικός drag handler (mirror υπαρχόντων 3Δ patterns)
**Πρότυπο:** `bim-3d/viewport/use-bim3d-beam-from-wall-pick.ts` (AbortController-gated DOM listeners, raycast τοίχου, ghost, ADR-040-clean) + `bim-3d/placement/BeamFromWallGhost.ts` (translucent ghost).
- **NEW** `use-bim3d-opening-move.ts` (ή παρόμοιο): armed όταν `selectIs3D` ΚΑΙ επιλεγμένο entity = opening.
  - `pointerdown` πάνω στο κούφωμα → start drag (όχι gizmo). Κράτα `originalOpening`.
  - `pointermove`: `manager.raycastBimEntities` → wall· compute `resolveOpeningAltMove({forcedHost: wall, currentPos: cursorWorldPoint…})` → `computeOpeningGeometry(resolved.params, wall)` → **ghost mesh** (reuse `opening-mesh.ts` builder) translucent στη νέα θέση· κρύψε/χαμήλωσε το original.
  - `pointerup`: dispatch `UpdateOpeningParamsCommand(opening.id, resolved.params, …)` (ίδιο με 2Δ). Re-sync ξαναχτίζει 2 τοίχους.
- **NEW** `OpeningMoveGhost.ts` (mirror `BeamFromWallGhost`): δέχεται opening params + host wall → χτίζει translucent opening mesh (reuse `buildOpeningMesh` από `opening-mesh.ts`) + dispose.
- **Cursor world point:** χρειάζεσαι το world σημείο στον τοίχο για σωστό `offsetFromStart`. Υπάρχει `raycastBimGroupPoint` στο `bim-3d/systems/raycaster/BimEntityRaycaster.ts` (επιστρέφει `THREE.Vector3`)· έκθεσέ το μέσω **NEW method** `ThreeJsSceneManager.raycastBimPoint(x,y)` (mirror `raycastBimEntities`). Πέρασε το world point ως `currentPos` (DXF-plan· χρησιμοποίησε `worldToDxfPlan`).

### 3γ) Mount
- `bim-3d/viewport/BimViewport3D.tsx` — mount το νέο hook (mirror `useBim3DBeamFromWallPick` / `useBim3DAttachPick`). CHECK 6D (BimViewport3D) → **stage ADR** (ADR-363 ή ADR-402).

### 3δ) SSoT που ΥΠΑΡΧΟΥΝ ήδη (reuse, μηδέν νέα math)
- `resolveOpeningAltMove` (+`forcedHost`, +`openingRehostToleranceWorld`) — `bim/walls/opening-grips.ts`. **Η μηχανή είναι έτοιμη.**
- `computeOpeningGeometry(params, hostWall, sceneUnits)` — `bim/geometry/opening-geometry.ts`.
- `buildOpeningMesh` / opening 3Δ mesh — `bim-3d/converters/opening-mesh.ts` (userData.bimId/bimType).
- `UpdateOpeningParamsCommand` (re-resolve `params.wallId` → auto στροφή/πάχος).
- `projectPointToWallOffsetMm` — `opening-geometry.ts`.
- raycast: `raycastBimEntities` (→wall id) + `raycastBimGroupPoint` (→world point).

---

## 4) RECOGNITION (ΠΡΙΝ κώδικα — επιβεβαίωσε)
1. **Πώς επιλέγεται opening στο 3Δ** + πώς γεμίζει `useBim3DEditStore.editBimType`/`editEntityIds` (`use-bim3d-pointer-handlers.ts` → `raycastBimEntities` → bimType='opening'· opening mesh = `opening-mesh.ts`).
2. **Πού στήνεται/εμφανίζεται το gizmo** (`use-bim3d-edit-interaction.ts` `computeEditAnchor` + `overlay.setVisible`) → πού να το gate-άρεις για openings.
3. **`ctx.preview` API** (`bim3d-edit-live-preview-apply.ts` + `bim3d-preview-rebuild.ts`) — πώς γίνεται hide/replace mesh (για το ghost ή για να κρύψεις το original κατά το drag).
4. **`opening-mesh.ts`** signature (τι θέλει για να χτίσει το mesh — params/geometry/host).
5. Επιβεβαίωσε ότι ο **2Δ + 3Δ commit re-host ΗΔΗ δουλεύει** (committed) — εσύ προσθέτεις ΜΟΝΟ τον ειδικό 3Δ drag + live ghost + απενεργοποίηση gizmo.

## 5) TESTS / TSC / DOCS
- Νέα: pick-hook (raycast→wall→resolve), `OpeningMoveGhost` (build/hide/dispose), commit re-host (ήδη tested via `resolveOpeningAltMove`).
- jest στα affected· tsc background (N.17 — έλεγξε process).
- **N.15 docs:** ADR-363 §12 changelog **Slice 2c** (forcedHost cursor-raycast — uncommitted, ΓΡΑΨΕ ΤΟ) **+ Slice 2d** (ειδικός 3Δ drag)· memory [[project_adr363_2d_move_from_point]]. **ΜΗΝ** adr-index. local_ΕΚΚΡΕΜΟΤΗΤΕΣ: δεν υπήρχε tracked item — ρώτα Giorgio.

## 6) ΤΙ ΝΑ ΜΗΝ ΚΑΝΕΙΣ
- ΜΗΝ ξαναφτιάξεις το 2Δ re-host / `resolveOpeningAltMove` (έτοιμα, committed/uncommitted).
- ΜΗΝ αγγίξεις αρχεία άλλων agents (mep-boilers/thermal/water/…).
- ΜΗΝ commit/push/adr-index. ΜΗΝ `git add -A`. ΜΗΝ 2ο tsc.
- ΜΗΝ προσπαθήσεις να «διορθώσεις» το gizmo για openings — η enterprise απόφαση είναι **να μην το χρησιμοποιείς** για hosted τρύπες.

## 7) ΜΝΗΜΕΣ
[[project_adr363_2d_move_from_point]] (Slice 1/2/2b/2c)· [[feedback_make_revit_grade_decisions_yourself]]· [[feedback_confirm_repro_before_reimplementing]].

## 8) ΠΡΩΤΗ ΕΝΕΡΓΕΙΑ ΝΕΑΣ ΣΥΝΕΔΡΙΑΣ
1. Διάβασε αυτό + `git log -5` + `git status` (επιβεβαίωσε committed vs uncommitted §1).
2. Recognition §4 (1-5).
3. Μικρό Plan Mode → file-level σχέδιο (§3) + έγκριση.
4. Υλοποίηση + tests + tsc + ADR-363 changelog (Slice 2c+2d) + memory.
