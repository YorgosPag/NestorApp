# 🧠 HANDOFF — ADR-363 Φ1G.5 Slice 2i: Revit-grade ΕΛΞΗ (face/edge magnetism) + ορατό σημάδι + dashed alignment lines (μετακίνηση τοίχου 3Δ)

> **Σύνταξη:** Opus 4.8, 2026-06-10. **Στόχος:** Recognition → Plan Mode → έγκριση Giorgio → υλοποίηση **FULL ENTERPRISE + FULL SSOT, «όπως η Revit»** (ρητή, επαναλαμβανόμενη απαίτηση Giorgio). Καθαρό context (το προηγούμενο γέμισε — Slice 2h + 2h-fix).
> **Supersedes:** `2026-06-09_wall-move-snap-alignment-lines_PLAN_NEXT.md` (αυτό είναι το πλήρες/ενημερωμένο).

---

## ⚠️ ΚΑΝΟΝΕΣ (ΠΡΩΤΑ)
- **Ελληνικά** πάντα στον Giorgio.
- **FULL SSOT** — reuse τη μηχανή έλξης (`ProSnapEngineV2` / `getGlobalSnapEngine`). **ΜΗΝ γράψεις νέα snap/intersection μηχανή.** Αρχεία ≤500 γρ., functions ≤40, μηδέν `any`/`as any`.
- **SHARED working tree** με άλλους agents (γράφουν ΣΥΧΝΑ — ιδίως `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`, `ADR-363`, `mesh-to-object3d.ts`). `git add` **ΜΟΝΟ τα δικά σου**. **ΠΟΤΕ `-A`.** Read-before-Edit (αλλάζουν κάτω από τα πόδια σου).
- **COMMIT/PUSH = ΜΟΝΟ ο Giorgio** (N.(-1)). **ΜΗΝ** adr-index.
- **N.17:** ΕΝΑΣ tsc τη φορά — process-check ΠΡΩΤΑ (`Get-CimInstance Win32_Process | ? CommandLine -like '*tsc*'`). Έτρεχαν 2 tsc άλλων agents. ΠΕΡΙΜΕΝΕ, μην ξεκινήσεις 2ο.
- **ADR-040:** overlays = scene-leaves· gizmo overlay = shared → stage `ADR-363` για CHECK 6B/6D.
- **Πάρε ΕΣΥ τις Revit αποφάσεις** + ζήτα έγκριση plan ([[feedback_make_revit_grade_decisions_yourself]]· [[feedback_confirm_repro_before_reimplementing]]).

---

## 0) ΤΟ ΑΙΤΗΜΑ (Giorgio, locked)
«Όταν η **ακμή/παρειά/πλευρά** του τοίχου που μετακινώ φτάνει κοντά σε άλλον τοίχο, πρέπει να **ΒΛΕΠΩ** σημάδι έλξης, να **ΑΙΣΘΑΝΟΜΑΙ** την έλξη, και να **ΚΟΛΛΑΕΙ** — όπως η Revit. FULL ENTERPRISE + FULL SSOT.»
- Locked: **dashed alignment lines** + ορατό μικρό glyph + magnetism. Snap targets = **όπως η Revit** (άκρα/μέσα/τομές/γωνίες/**παρειές-ακμές**/grids).

**Το θεμελιώδες πρόβλημα σήμερα (διάγνωση):** «ούτε βλέπω, ούτε αισθάνομαι, ούτε κολλάει». Γιατί:
1. **Δεν κολλάει σε παρειές/ακμές:** η τωρινή έλξη (`makeMoveSnapFn`) κουμπώνει μόνο τα **grips-σημεία** του τοίχου (άκρα/γωνίες/μέσα) σε snap targets — ΟΧΙ τις **παρειές/ακμές** πάνω σε άλλους τοίχους (edge/face magnetism). Αυτό λείπει.
2. **Δεν βλέπω:** ο μόνος δείκτης ήταν ο σιελ κύβος (snap marker) που **κρύφτηκε** στο Slice 2h-fix (Giorgio τον βρήκε ενοχλητικό). Δεν υπάρχει σωστός δείκτης.
3. **Δεν αισθάνομαι:** χωρίς magnetism + χωρίς dashed lines δεν υπάρχει αίσθηση.

→ Το Slice 2i είναι **πραγματικό feature**, όχι tweak.

---

## 1) ΤΙ ΗΔΗ ΕΓΙΝΕ (Slice 2h + 2h-fix — ΜΗ το ξαναφτιάξεις· όλα 🔴 pending commit Giorgio)
- **Temp dimensions μετακίνησης τοίχου** (παρειά→παρειά clear gap): NEW `bim/walls/wall-move-dim-references.ts` (pure· κάθετη απόσταση→πλησιέστερος παράλληλος reference ανά πλευρά· face-to-face = centreline − halfₘ − halfᵣ· `MovingWallAxis.thicknessMm`) + NEW `bim-3d/placement/TempWallMoveDimOverlay.ts` (scene-leaf, reuse `createDimension3DRenderer`). ✅
- **Gizmo καθαρό στο move:** `BimGizmoOverlay.collapseToMoveHandles()`/`restoreConfiguredHandles()` (+`configuredHandles`, `suppressSnapMarker` fields) + export `isPlanarMoveType()`· wiring `bim3d-edit-interaction-handlers.ts` (collapse onDown move/rotate αν planar· restore onUp/cancel). Κρύβει resize/endpoint/tilt + τον snap marker. ✅
- **Έλξη grips→targets ΗΔΗ wired:** `buildDragSnapFn` → `makeMoveSnapFn(getGlobalSnapEngine(), grips, id)`. (Αλλά μόνο σημεία — βλ. §0.)
- 70 νέα PASS + 195 γειτονικά gizmo/edit. tsc 0 δικά μου.

**ΤΑ ΑΡΧΕΙΑ ΜΟΥ (Slice 2h/2h-fix) — μόνο αυτά git add όταν committάρει ο Giorgio:**
NEW: `bim/walls/wall-move-dim-references.ts` (+test), `bim-3d/placement/TempWallMoveDimOverlay.ts` (+test).
MOD: `bim-3d/gizmo/bim-gizmo-overlay.ts`, `bim-3d/animation/bim3d-edit-interaction-handlers.ts`, `bim-3d/animation/bim3d-edit-live-preview-apply.ts`, `bim-3d/animation/use-bim3d-edit-interaction.ts`, + tests `bim-gizmo-overlay.test.ts`. Docs: ADR-363 §12, ΕΚΚΡΕΜΟΤΗΤΕΣ.

---

## 2) 🧩 SSOT ΧΑΡΤΗΣ (reuse — μηδέν νέα μηχανή)
| Τι | Αρχείο |
|----|--------|
| Μηχανή έλξης (ΕΝΑ SSoT) | `snapping/ProSnapEngineV2.ts` (+ `SnapEngineCore`, `orchestrator/SnapOrchestrator.ts`) |
| **Wall corner targets** | `snapping/engines/WallCornerSnapEngine.ts` (γωνίες ✅) — υπάρχουν & `OpeningCorner`/`Column`/`Beam`/`Slab` corner engines |
| Edge/nearest/perp targets | `snapping/engines/NearSnapEngine.ts`, `NearestSnapEngine`, `PerpendicularSnapEngine.ts` |
| targets registration | `snapping/hooks/useGlobalSnapSceneSync.ts` |
| snap result φέρει **`type`** | `snapping/shared/BaseSnapEngine.ts` (γρ.65 `type: this.snapType`) → το `findSnapPoint` snapPoint έχει `type` (surface-able για alignment) |
| 3Δ bridge (narrowing!) | `bim-3d/gizmo/bim3d-snap-bridge.ts` — `makeMoveSnapFn`· **`SnapResolution` κρατά ΜΟΝΟ `{snappedMm, markerMm}`** → χάνει το `type`/reference |
| controller snap call | `bim-3d/gizmo/bim-gizmo-controller.ts` (~γρ.131 `showSnapMarker(snapWorld)`) |
| snap marker glyph | `bim-3d/gizmo/bim-gizmo-overlay-markers.ts` `createSnapMarker` (= ο σιελ κύβος, `0x00e5ff`) + overlay `showSnapMarker` (τώρα suppressed στο planar move) |
| 3Δ line renderer (πρότυπο dashed) | `bim-3d/dimensions/Dimension3DRenderer.ts` / `dim3d-line-geometry.ts` |
| plan↔world | `bim-3d/viewport/coordinate-transforms.ts` |

---

## 3) 🔴 ΤΟ NEXT — Recognition (ΠΡΙΝ κώδικα)
1. **OSNAP state:** το κουμπί OSNAP (UI κάτω, «OSNAP F11») είναι ανοιχτό; `engine.getSettings().enabled`. Αν off → καμία έλξη (πες το στον Giorgio).
2. **Τι κάνει ΠΡΑΓΜΑΤΙΚΑ το `ProSnapEngineV2.findSnapPoint`** — full return (όχι το narrowed `SnapQueryEngine`): φέρει `type` + reference geometry (line/direction); Ποιοι types δίνουν alignment direction (EXTENSION/PARALLEL/PERPENDICULAR/NEAREST-edge);
3. **Edge/face targets για τοίχους:** το `useGlobalSnapSceneSync` registers wall **edges/faces** (όχι μόνο corners); Αν ΟΧΙ → εδώ είναι το «δεν κολλάει σε παρειές».
4. **Επιβεβαίωσε repro με Giorgio** (ζήτα screenshot/gesture): ποια ακριβώς «πλευρά/παρειά» θέλει να κολλάει σε τι.

## 4) ΠΡΟΤΑΣΗ ΣΧΕΔΙΟΥ (οριστικοποίησε στο Plan)
1. **Face/edge magnetism:** βεβαιώσου ότι τα grips/offsets που τροφοδοτούν το `makeMoveSnapFn` περιλαμβάνουν τα **face-midpoints/edge points** του τοίχου (ή ότι ο engine έχει wall edge targets) → ο τοίχος «κολλάει» παρειά-σε-παρειά. Reuse `WallCornerSnapEngine` + edge engines· πρόσθεσε targets στο scene sync αν λείπουν.
2. **Εμπλούτισε `SnapResolution`** (bridge) additive optional: `snapType?`, `alignmentRef?: {a,b}` ή `direction` — back-compat (resize/υπάρχοντα αμετάβλητα).
3. **Ορατό μικρό glyph:** ξανα-ενεργοποίησε δείκτη στο planar move ΑΛΛΑ μικρό & σωστό (Revit-style· ΟΧΙ ο κύβος 13%). Το `suppressSnapMarker` αφαιρείται/αντικαθίσταται από proper glyph.
4. **NEW `bim-3d/placement/TempAlignmentLineOverlay.ts`** (scene-leaf, mirror `TempWallMoveDimOverlay`): dashed alignment line όταν παρειά/άξονας ευθυγραμμίζεται με άλλον τοίχο/grid (reuse line geometry· **ΟΧΙ μαύρο περίγραμμα**). Hide όταν δεν υπάρχει alignment.
5. **Wiring:** controller/handlers περνούν alignment ref + snap point στα overlays (mirror του `showSnapMarker`). Hide/restore στο up/cancel (όπως τα υπόλοιπα).

**Revit decisions (πάρ' τες ΕΣΥ):** ποιες αναφορές v1 (παρειές+άξονες τοίχων+grids)· χρώμα/στυλ dashed (Revit μπλε/πράσινο)· 1-2 ταυτόχρονες γραμμές· μέγεθος glyph· magnetism tolerance.

## 5) ΑΡΧΕΙΑ (πιθανά — git add ΜΟΝΟ δικά σου)
- NEW `bim-3d/placement/TempAlignmentLineOverlay.ts` + `__tests__`.
- MOD `bim3d-snap-bridge.ts` (εμπλουτισμός `SnapResolution` — additive).
- MOD `bim-gizmo-overlay.ts` / `bim-gizmo-controller.ts` / `bim3d-edit-interaction-handlers.ts` (glyph + alignment wiring — shared/hot, minimal).
- ΠΙΘΑΝΟΝ `snapping/hooks/useGlobalSnapSceneSync.ts` ή engines (wall edge/face targets — μόνο αν λείπουν).
- DOCS: ADR-363 §12 + ΕΚΚΡΕΜΟΤΗΤΕΣ + memory [[project_adr363_2d_move_from_point]]. ΜΗΝ adr-index.

## 6) ΤΙ ΝΑ ΜΗΝ ΚΑΝΕΙΣ
- ΜΗΝ νέα snap/intersection μηχανή (reuse engine). ΜΗΝ μαύρο περίγραμμα σε γραμμές/βέλη.
- ΜΗΝ ξαναφέρεις τον ΤΕΡΑΣΤΙΟ κύβο (snap marker 13%). ΜΗΝ commit/push/adr-index/`git add -A`/2ο tsc.
- ΜΗΝ αγγίξεις internals του `bim3d-edit-live-preview` swap-class (in-flight ADR) — μόνο apply-layer hooks.

## 7) ΜΝΗΜΕΣ
[[project_adr363_2d_move_from_point]] (πλήρες ιστορικό Slice 2d→2h-fix)· [[feedback_make_revit_grade_decisions_yourself]]· [[feedback_confirm_repro_before_reimplementing]].

## 8) ΠΡΩΤΗ ΕΝΕΡΓΕΙΑ ΝΕΑΣ ΣΥΝΕΔΡΙΑΣ
`git log -5` + `git status` → Recognition §3 (1-4) → Plan Mode (§4 + Revit decisions) → έγκριση Giorgio → υλοποίηση + tests + tsc(N.17) + docs(N.15).
