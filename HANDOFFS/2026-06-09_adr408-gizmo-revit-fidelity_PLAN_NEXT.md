# 🧠 HANDOFF — ADR-408 «3D Gizmo: ΠΛΗΡΗΣ αντιγραφή Revit για μετακίνηση/διαστάσεις (είδη υγιεινής + δομικά)»: PLAN MODE

> **Σύνταξη:** Opus 4.8, 2026-06-09. **Στόχος νέας συνεδρίας: PLAN MODE → υλοποίηση ΟΛΩΝ των φάσεων.** Ο Giorgio θέλει **πιστή αντιγραφή της Revit** για το πώς μετακινείς/αλλάζεις διαστάσεις στο 3D — **όχι** τα δικά του «θέλω», αλλά **ό,τι κάνει η Revit** (ο «βασιλιάς»). Είπε ρητά: «ξεκινάς όλα τώρα, όλες τις φάσεις».

---

## ⚠️ ΚΑΝΟΝΕΣ (αμετάβλητοι — πάγια εντολή Giorgio)
- **Ελληνικά** όλες οι απαντήσεις (LANGUAGE RULE CLAUDE.md).
- **FULL ENTERPRISE + FULL SSOT, «όπως η Revit»** — μηδέν `any`/`as any`/`@ts-ignore`, αρχεία ≤500 γρ., functions ≤40 γρ.
- **SHARED working tree** με άλλον agent (codex). `git add` **ΜΟΝΟ δικά σου** αρχεία, **ΠΟΤΕ** `git add -A`.
- **COMMIT/PUSH τον κάνει ΜΟΝΟ ο Giorgio** (N.(-1)). **ΜΗΝ αγγίξεις adr-index** (shared tree).
- **Plan Mode πρώτα** (8-12 αρχεία, 2 domains) → σχεδίασε & ζήτα έγκριση **ΠΡΙΝ** κώδικα. Πάρε εσύ τις Revit αποφάσεις.
- **N.17:** ΕΝΑΣ tsc τη φορά — έλεγξε ότι δεν τρέχει ήδη άλλος (`Get-CimInstance Win32_Process … *tsc*`).
- **N.15:** μετά → ADR-408 changelog + μνήμη + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`.
- **ADR-040:** τα gizmo/animation αρχεία είναι **ΕΚΤΟΣ** της canvas micro-leaf λίστας (CHECK 6B/6D) — δεν χρειάζεται staging ADR-040 (επιβεβαίωσέ το vs CLAUDE.md).

---

## 0) ΚΑΤΑΣΤΑΣΗ — τι ΗΔΗ δουλεύει (ΜΗΝ το ξαναγγίξεις)

🟢 **Ολοκληρωμένα (Opus, 2026-06-09· ο Giorgio θα κάνει commit):**
- **Φ-C** Connectivity-preserving move + 3D rotate/vertical persistence + connected-pipe live follow.
- **Φ-D** Per-endpoint shape handles για **σωλήνες** (`mep-segment`): νέο constraint `endpoint` = camera-facing projection (κάτοψη+υψόμετρο σε ένα drag)· `bim3d-endpoint-move.ts` `computeMepSegmentEndpointMove` (z μέσω `resolveSegmentEndpointElevationsMm`, legacy-safe)· `segmentAxisEndpointsWorld` (κοινή SSoT converter↔gizmo)· endpoint handle = **μικρό teal camera-facing δαχτυλίδι (torus)** (`buildEndpointHandle` + `billboardEndpointRings`).
- **Φ-E** Entity-aware DOF: **planar 2-άξονες** (δομικά+μη-MEP: `axis-x`/`axis-z`+`plane-xz`+`rotate-y`) vs **free-3D** (MEP: +`axis-y`+`plane-xy`+`plane-yz`)· combined H+V move (`buildMepCombinedMoveCommand`)· κάθετος άξονας Y σκούρο πράσινο (`GIZMO_COLOR_Y=0x1f8a1f`)· κεντρική πυραμίδα κρυμμένη.
- **Φ-D/Φ-E** LIVE FITTING FOLLOW: η τάπα/μούφα/ταυ (`mep-fitting`) ακολουθεί real-time (reconciler σε transient list → `mepFittingToMesh`)· `incidentFittingIds`+`buildFittingFollowPreviewObjects` (`bim3d-pipe-follow-preview-rebuild.ts`) + `captureFittings`/`applyFittings` (`bim3d-edit-live-preview.ts`).
- ⚠️ **Άλλος agent έκανε refactor:** εξήγαγε το `applyLivePreview`/`sceneEntitiesForEdit`/`resolveEntityLevelId` σε **NEW `bim3d-edit-live-preview-apply.ts`** (διατήρησε τα fitting-follow blocks). Το `bim3d-edit-interaction-handlers.ts` τα κάνει import. **Επιβεβαίωσε το τρέχον state ΠΡΙΝ αγγίξεις τα αρχεία.**

tsc 0 νέα (μόνο pre-existing `mesh-to-object3d.ts:124`)· jest πράσινα.

🔴 **ΤΟ ΝΕΟ TASK:** πιστή αντιγραφή Revit για **μετακίνηση + διαστάσεις** σε 3D.

---

## 1) ΤΙ ΚΑΝΕΙ Η REVIT (η αλήθεια — στόχος)

Η Revit **δεν** έχει gizmo SketchUp. Χειρισμός: drag, Move/Rotate (base point), **shape handles** (μπλε λαβές), temporary dimensions, Type/Properties. **Με λαβή αλλάζεις ΜΟΝΟ «τεντώματα» (μήκος/ύψος)· πάχος/διατομή ΠΟΤΕ με σύρσιμο — μόνο από Τύπο.**

| Στοιχείο | Μετακίνηση | Γεωμετρική με ΛΑΒΗ (3D) | Διατομή/Πάχος |
|---|---|---|---|
| **Είδος υγιεινής** (loadable family) | drag ολόκληρο / Move base-point | **ΚΑΜΙΑ** | **Μόνο Τύπος** |
| **Τοίχος** | drag κάτοψη | **μήκος** (άκρα) + **ύψος** (κορυφή) | **Μόνο Τύπος** |
| **Κολώνα** | drag κάτοψη | **ύψος** (top/base) | **Μόνο Τύπος** |
| **Δοκός** | drag | **μήκος** (άκρα) | **Μόνο Τύπος** |
| **Πλάκα** | drag | **Edit Boundary** (sketch) — όχι drag | **Μόνο Τύπος** |

---

## 2) GAP ANALYSIS (vs τρέχον)

- **Είδη υγιεινής:** ✅ ΗΔΗ Revit-correct (gizmo move+rotate, καμία resize-λαβή, μέγεθος από per-kind 3D model picker / contextual tab). ΜΟΝΟ προαιρετικό: **flip control** (Revit «flip facing/hand»). **Επιβεβαίωσε ότι ΔΕΝ υπάρχουν resize handles για `mep-fixture`** (σωστό).
- **Δομικά — αποκλίσεις προς διόρθωση:**
  - ❌ Υπάρχουν `resize-x`/`resize-z` (πάχος τοίχου / διατομή κολώνας-δοκού) → **Revit ΔΕΝ το κάνει** → **ΑΦΑΙΡΕΣΗ** (μόνο Τύπος).
  - ❌ `resize-y` πάχους **πλάκας** → Revit=Τύπος → **ΑΦΑΙΡΕΣΗ**.
  - ❌ **Λείπουν** 3D **λαβές μήκους** τοίχου/δοκού (σήμερα μόνο 2D grips· σχόλιο κώδικα «length stays an endpoint-grip edit») → **ΠΡΟΣΘΗΚΗ**.
  - ✅ **ύψος** (`resize-y` top + `resize-m-y` base) τοίχου/κολώνας = Revit «drag top/base» → **ΚΡΑΤΑ**.

---

## 3) ΤΟ ΣΧΕΔΙΟ (πρότεινε στο Plan Mode — όλες οι φάσεις)

**Φάση 1 — Γενίκευση endpoint shape-handles σε τοίχο/δοκό (μήκος 3D):**
- Το `endpoint` constraint + το teal δαχτυλίδι υπάρχουν ήδη (Φ-D, για σωλήνες). **Γενίκευσέ τα** ώστε `ENDPOINT_HANDLES_BY_TYPE += { wall, beam }` (ο `bim-gizmo-overlay.activeHandlesFor` ήδη έχει το pattern).
- NEW per-type endpoint-world: μirror του `segmentAxisEndpointsWorld` για wall (`params.start`/`end`) + beam (`params.start`/`end`). Πιθανώς γενικό `linearEntityEndpointsWorld(entity)` (registry-driven).
- NEW per-type endpoint-move math (mirror `computeMepSegmentEndpointMove`): wall/beam μετακίνηση ΕΝΟΣ άκρου → νέο μήκος/γωνία, το άλλο άκρο μένει. (Reuse 2D grip SSoT αν υπάρχει: `wall-grips`/`beam-grips` `moveStart`/`moveEnd`.)
- NEW preview rebuild για wall/beam endpoint (mirror `buildEndpointMovePreviewObject` → `wallToMesh`/`beamToMesh`).
- Command builder: `buildEndpointMoveCommand` γενίκευση → `UpdateWallParamsCommand`/`UpdateBeamParamsCommand`.
- **ΠΡΟΣΟΧΗ:** τοίχος/δοκός είναι **planar (2-άξ.)** — το endpoint handle τους πρέπει να είναι **οριζόντιο** (projectOntoPlane ground, ΟΧΙ camera-facing· το μήκος είναι plan dimension). Διαφορετικό από τους σωλήνες (3D). Σκέψου `endpoint` constraint variant: `horizontal` (wall/beam) vs `free-3D` (pipe).

**Φάση 2 — Αφαίρεση thickness/section resize → Type-only (αγγίζει το resize σύστημα του άλλου agent· κάνε ΑΦΟΥ settle-άρει):**
- `RESIZE_HANDLES_BY_TYPE` (`bim-gizmo-overlay.ts`): wall/column/beam → **βγάλε** `resize-x`/`resize-z` (κράτα `resize-y`/`resize-m-y` ύψος)· slab → **βγάλε** `resize-y`.
- Επιβεβαίωσε ότι πάχος/διατομή είναι **πλήρως editable από το contextual tab** (Τύπος/Properties) — αν λείπει πεδίο, πρόσθεσε (Revit Type parameter).
- Καθάρισε τυχόν dead resize-bridge code (`bim3d-resize-bridge.ts` compute*ResizeParams για X/Z) ΜΟΝΟ αν δεν χρησιμοποιείται αλλού (boy-scout, προσοχή στα tests).

**Φάση 3 — Είδη υγιεινής:** επιβεβαίωση Revit-correct + (προαιρετικό) flip control· διαστάσεις από Τύπο/contextual tab.

**Αποφάσεις Revit (πάρ' τες εσύ· ο Giorgio ενέκρινε «πλήρη αντιγραφή»):** πάχος/διατομή = ΜΟΝΟ Τύπος (αφαίρεση drag)· μήκος/ύψος = shape-handles· fixtures = μέγεθος μόνο από Τύπο.

---

## 4) REUSE SURFACE (κλειδιά)
- `bim-3d/gizmo/bim-gizmo-overlay.ts` — `activeHandlesFor`, `ENDPOINT_HANDLES_BY_TYPE`, `RESIZE_HANDLES_BY_TYPE`, `FREE_3D_MOVE_TYPES`, `setEndpointHandles`/`refreshEndpointOffsets`/`billboardEndpointRings`.
- `bim-3d/gizmo/bim3d-endpoint-move.ts` — `computeMepSegmentEndpointMove` (πρότυπο για wall/beam).
- `bim-3d/converters/mep-segment-to-mesh.ts` — `segmentAxisEndpointsWorld` (πρότυπο endpoint-world).
- `bim-3d/gizmo/gizmo-projection.ts` — `endpoint` branch (camera-plane)· πρόσθεσε horizontal variant για wall/beam.
- `bim-3d/gizmo/bim-gizmo-drag-bridge.ts` / `bim-gizmo-controller.ts` — `endpoint-move` outcome/live preview.
- `bim-3d/animation/bim3d-edit-command-builders.ts` — `buildEndpointMoveCommand` (γενίκευση wall/beam)· `RESIZE_HANDLES` consumers.
- `bim-3d/animation/bim3d-preview-rebuild.ts` — `buildEndpointMovePreviewObject` (γενίκευση)· `bim3d-resize-bridge.ts` (Φάση 2 cleanup).
- `bim/walls/wall-grips.ts`, `bim/beams/beam-grips.ts` — 2D moveStart/moveEnd SSoT (reuse για το plan μήκος).
- 2D grips ΗΔΗ κάνουν length editing — **reuse, μηδέν νέα math** όπου γίνεται.

## 5) ΤΕΣΤ
- Pure: wall/beam endpoint-move (μήκος, fixed-other-end)· `activeHandlesFor` (wall/beam έχουν endpoint, ΟΧΙ resize-x/z· slab ΟΧΙ resize-y· fixtures ΟΧΙ resize).
- Ενημέρωσε το `bim-gizmo-overlay.test.ts` (resize tests αλλάζουν μετά τη Φάση 2).
- tsc background (N.17). Browser-verify με Giorgio (3D).

## 6) ΤΙ ΝΑ ΜΗΝ ΚΑΝΕΙΣ
- ΜΗ γράψεις κώδικα πριν την έγκριση plan.
- ΜΗΝ ξεκινήσεις Φάση 2 αν ο άλλος agent πειράζει ακόμη το resize/gizmo σύστημα — έλεγξε `git status` + τα αρχεία πρώτα.
- ΜΗΝ commit/push/adr-index. ΜΗΝ `git add -A`. ΜΗΝ 2ο tsc (N.17).
- ΜΗΝ σπάσεις τα Φ-C/Φ-D/Φ-E (σωλήνες endpoint, fitting-follow, DOF).

## 7) ΠΡΩΤΗ ΕΝΕΡΓΕΙΑ
1. Διάβασε αυτό + επιβεβαίωσε τρέχον state (`git status`, τα gizmo/animation αρχεία — ο άλλος agent μπορεί να άλλαξε κι άλλα).
2. Επιβεβαίωσε ότι Φ-D/Φ-E/fitting-follow είναι ακέραια.
3. **Plan Mode** → file-level σχέδιο 3 φάσεων + ζήτα έγκριση.
4. Μετά έγκριση → υλοποίηση + tests + ADR-408 changelog + N.15.

## 8) ΜΝΗΜΕΣ
`project_adr408_3d_endpoint_drag`, `project_adr408_gizmo_dof`, `project_adr408_connectivity_preserving_move`.
