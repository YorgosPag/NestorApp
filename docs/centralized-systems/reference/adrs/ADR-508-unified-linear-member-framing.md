# ADR-508 — Unified Linear-Member Framing SSoT (δοκάρι + τοίχος, ένα ghost)

**Status:** Accepted (uncommitted) — 2026-06-20
**Owners:** DXF Viewer / BIM drawing tools
**Related:** ADR-398 (smart beam ghost — η πηγή), ADR-363 (BIM drawing mode / wall+beam FSM)

---

## Context

Το εργαλείο **Δοκάρι** (ADR-398 §3.3–§3.6) έχει «έξυπνο φάντασμα»: πριν το 1ο κλικ εμφανίζεται
φάντασμα στο σταυρόνημα· κοντά σε υφιστάμενο δοκάρι/κολώνα κουμπώνει κάθετα (T-framing), γλιστράει
στην παρειά με 3 αγκυρώσεις (γωνία/κέντρο/γωνία), γίνεται 🔴 σε ομοαξονικό (duplication), commit με
2 κλικ + auto-flush. Το εργαλείο **Τοίχος** δημιουργούνταν τελείως διαφορετικά: μόνο τελεία-marker
πριν το κλικ, 3-κλικ flow (αρχή→τέλος→πλευρά ευθυγράμμισης), καμία έξυπνη έλξη.

Ο Giorgio ζήτησε **ο τοίχος να δημιουργείται με τον ίδιο ακριβώς τρόπο** όπως το δοκάρι, με
ταυτόσημο φάντασμα, και οι δύο κώδικες **ενοποιημένοι σε μία και μοναδική πηγή αλήθειας**
(full enterprise, full SSoT).

**Αποφάσεις Giorgio (2026-06-20):** (1) ο τοίχος κουμπώνει σε **τοίχους + κολώνες + δοκάρια**·
(2) **κατάργηση 3ου κλικ** — ο ευθύς τοίχος γίνεται 2-κλικ σαν δοκάρι (auto-flush αντί χειροκίνητης
πλευράς)· οι ειδικές λειτουργίες (περιοχή/περίμετρος/καμπύλος/πολυγραμμή) διατηρούνται.

## Κεντρική παρατήρηση

Ο πυρήνας του framing του δοκαριού ήταν **ήδη pure & entity-agnostic** στα μαθηματικά — δούλευε
πάνω σε `{ axis, outline }` targets + column footprints και επέστρεφε centerline `{ start, end,
status }`. Η μόνη «beam» σύνδεση ήταν τα **ονόματα**. Άρα η ενοποίηση = **εξαγωγή generic
«linear-member framing» SSoT** που καταναλώνουν **και το δοκάρι και ο τοίχος**.

## Decision

Νέος ουδέτερος φάκελος **`bim/framing/`** (SSoT):

| Module | Ρόλος |
|--------|-------|
| `member-face-third.ts` | `pickThird` — 3-ζωνική αγκύρωση (zero-import leaf, cycle-proof) |
| `linear-member-face-snap.ts` | `resolveLinearMemberFaceSnap` (T-framing 🟢 / κοντή άκρη 🔴) + `isMemberCollinearOverlap` |
| `member-column-face-snap.ts` | `resolveMemberColumnFaceSnap` (12-θέσεων face snap) + `MEMBER_GHOST_LEN_MM/CAPTURE_MM` |
| `member-ghost-snap.ts` | `resolveMemberGhostSnapFromStore` — column-priority dispatcher |
| `member-snap-targets.ts` | `collectMemberSnapTargets(entities, { memberKinds })` — generic scene collector |
| `member-column-flush.ts` | `resolveMemberColumnFlushJustification` — geometric side-face flush (free placement) |

**Τα beam αρχεία έγιναν thin adapters** (διατηρούν την ιστορική ταυτότητα + προσαρμογή πεδίου
`beamWidthScene` → `memberWidthScene`) ώστε οι browser-verified beam consumers/tests να μένουν
**byte-for-byte** αμετάβλητοι: `beam-beam-face-snap.ts`, `beam-column-face-snap.ts`,
`beam-face-third.ts`, `beam-column-flush.ts`. Ο `collectBeamSnapTargets` → delegate στον generic
collector με `memberKinds: ['beam']` (συμπεριφορά δοκαριού αμετάβλητη — ΟΧΙ τοίχοι στους στόχους).

**Τοίχος (mirror δοκαριού):**
- `wall-preview-store` → `startAnchored` + `columnFootprints` + `memberTargets` + `setColumns`/`setMembers`.
- `wall-preview-helpers` → `makeWallGhostBeforeClick` (smart ghost στο σταυρόνημα) + `makeWallWysiwygGhost`
  (awaitingEnd, με `ghostStatusColor` overlap). Wall outline για snap = `outerEdge` + αντεστραμμένο
  `innerEdge` (κλειστός δακτύλιος).
- `wall-completion` → `buildAnchoredWallParams` (free auto-flush σε κολόνα μέσω `resolveMemberColumnFlushJustification`).
- `useWallTool` → `syncSceneTargetsToStore` (walls+beams+columns) on activate + on `drawing:entity-created`
  (rAF defer)· `resolveWallStartAnchor` στο 1ο κλικ· **straight 2-κλικ** (`awaitingStart → awaitingEnd → commit`).
- `use-wall-commit` → `commitStraightFromState`: overlap block (`isMemberCollinearOverlap`) + anchored/centerline/auto-flush params.

**Rendering:** ο `PreviewRenderer` ΔΕΝ άλλαξε — το `ghostStatusColor` branch είναι entity-agnostic
(διαβάζει `geometry.outline.vertices`). **Κανένα νέο store** — το status ζει inline στο preview entity.

## Wall 2nd-click: relative-polar-to-face (Revit «angle relative to face», 2026-06-21)

**Πρόβλημα (Giorgio + screenshot):** όταν το 1ο κλικ κουμπώνει στην **παρειά υφιστάμενου τοίχου**
(face-anchored start), κατά την περιστροφή του ghost στο 2ο κλικ δεν υπήρχε καμία γωνιακή έλξη
**σχετική ως προς εκείνη την παρειά** — η μία γωνία της βάσης χωνόταν μέσα στον υφιστάμενο τοίχο, η
άλλη άνοιγε κενό. Ζητούμενο: μαγνήτες στις **90° (κάθετα)** + πολλαπλά **15°/30°/45°** ως προς την
παρειά. Στις 90° οι 2 γωνίες της βάσης κάθονται **flush** στην παρειά (όπως Revit).

**Λύση (full SSoT, μηδέν διπλότυπο):**

1. **`applyPolar` (`systems/constraints/polar-utils.ts`) — επέκταση με optional `config.baseAngle = 0`.**
   Το snap γίνεται σε `baseAngle + k·increment` (και `baseAngle + additional`). `baseAngle = 0` ⇒
   **ταυτόσημο** με το world polar (backward-compat, κλειδωμένο με test). ΕΝΑ function καλύπτει
   world ΚΑΙ relative — όχι νέο `applyPolarRelative`.
2. **Capture της κάθετης-στην-παρειά κατεύθυνσης στο 1ο κλικ.** Το `resolveWallStartAnchor`
   (`useWallTool`) υπολογίζει `faceAngle = atan2(snap.end − snap.start)` (το `end − start` του ghost
   = outward face normal, από `linear-member-face-snap`). Αποθηκεύεται ως `startFaceAngle` στο
   `WallToolState` + `wallPreviewStore` (mirror του `startAnchored`). `null` σε free / 🔴 collinear-overlap.
3. **SSoT helper (preview ≡ commit) στο `bim-ortho-reference.ts`:** `getWallFaceRelativeBaseAngle`
   (επιστρέφει το captured angle όταν wall + awaitingEnd + anchored) + `resolveWallFaceRelativePolar`
   (καλεί `applyPolar` με `baseAngle = startFaceAngle`). `baseAngle` = **κάθετο στην παρειά** ⇒ `0°`
   relative = κάθετο (το flush case· οι 2 γωνίες πέφτουν στην παρειά αυτόματα αφού το start είναι ήδη
   flush), `±90°` = παράλληλο. **Auto magnet** — δεν χρειάζεται F10 (το anchoring σε παρειά ΕΙΝΑΙ η
   πρόθεση)· **F8 ortho υπερισχύει** (ρητό world H/V lock). Υπερισχύει του world polar.
4. **Wire σε αμφότερα τα paths:** preview (`drawing-hover-handler`, μετά το ortho/πριν το world polar)
   και commit (`applyBimDrawingConstraint`, που ήδη καλεί ο `useCanvasClickHandler`) διαβάζουν τον
   ΙΔΙΟ helper → ghost === τελικός τοίχος. Το overlay (`drawPolarTrackingLine`) δείχνει την absolute
   γωνία αυτόματα (ο `PolarSnapResult.snappedAngle` είναι world).

**Consequences:** ✅ Revit-grade «angle relative to face»· ✅ `applyPolar` baseAngle = γενικό SSoT
(διαθέσιμο σε κάθε μελλοντικό relative-polar consumer)· ✅ 48 tests (polar-utils baseAngle +
bim-ortho-reference face-relative)· ✅ μηδέν regression στο world polar (baseAngle=0 lock).

## Consequences

- ✅ Μία πηγή αλήθειας για το linear-member framing· δοκάρι + τοίχος μοιράζονται τον ίδιο πυρήνα.
- ✅ Beam tests byte-for-byte πράσινα (aliases)· νέα generic suite `bim/framing/__tests__` (ανεξάρτητη κάλυψη).
- ⚠️ Ο ευθύς τοίχος είναι πλέον 2-κλικ — το χειροκίνητο 3ο κλικ ευθυγράμμισης καταργήθηκε (το auto-flush
  το αντικαθιστά). Το `awaitingAlignment` παραμένει μόνο για το dynamic-input precision path.
- Beam targets παραμένουν beams+columns (ΟΧΙ τοίχοι) — εσκεμμένο, αποφυγή scope creep/regression στο
  browser-verified δοκάρι.

## Changelog

- **2026-06-20** — Δημιουργία. Εξαγωγή `bim/framing/` SSoT· beam files → aliases· wall ghost + 2-κλικ FSM.
- **2026-06-21** — Wall 2nd-click **relative-polar-to-face** (Revit «angle relative to face»):
  `applyPolar` +optional `baseAngle` (SSoT, backward-compat)· capture `startFaceAngle` στο 1ο κλικ
  (`WallToolState` + `wallPreviewStore`)· `getWallFaceRelativeBaseAngle` + `resolveWallFaceRelativePolar`
  (`bim-ortho-reference`, preview≡commit)· wire σε `drawing-hover-handler` (preview) + `applyBimDrawingConstraint`
  (commit). 90° relative ⇒ κάθετο + 2 base γωνίες flush. 48 jest GREEN. **Uncommitted.**
- **2026-06-21 (fix)** — η πράσινη ένδειξη έδειχνε την **απόλυτη** γωνία κόσμου (π.χ. «41.9°») ενώ ο
  τοίχος ήταν ορατά κάθετος. NEW `faceRelativeDisplayAngle` (polar-utils SSoT) → το tooltip δείχνει τη
  γωνία **σχετικά ως προς την παρειά** (κάθετο ⇒ 90°, παράλληλο ⇒ 0°, διαγώνιες 15/30/45/60/75)· η
  γραμμή ίχνους μένει στην απόλυτη κατεύθυνση. Wire στο `drawing-hover-handler`. +5 jest (53 σύνολο).
- **2026-06-21 (zoom-adaptive βήμα)** — **(α)** το ΜΗΚΟΣ του τοίχου στο 2ο κλικ κουμπώνει σε σταθερά
  zoom-adaptive βήματα· **(β)** το ΓΛΙΣΤΡΗΜΑ του φαντάσματος κατά μήκος παρειάς υφιστάμενου τοίχου
  κουμπώνει στο ίδιο βήμα. **ΙΔΙΟ SSoT με τα ίχνη ευθυγράμμισης** (`adaptive-distance-snap`): NEW
  `quantizeMagnitude` (scalar core που μοιράζονται `quantizeAlongPath` + face-snap). (α) μέσα στο
  `resolveWallFaceRelativePolar(point, worldPerPixel)` → preview (`drawing-hover-handler`) + commit
  (`applyBimDrawingConstraint`, worldPerPixel από `useCanvasClickHandler`). (β) optional
  `slideStepScene` στο `resolveLinearMemberFaceSnap`· ο dispatcher `resolveMemberGhostSnapFromStore`
  παίρνει `worldPerPixel` και υπολογίζει το step μία φορά· wall callers (`useWallTool` click +
  `wall-preview-helpers` ghost) το περνούν, **το δοκάρι (alias) ΟΧΙ → byte-for-byte αμετάβλητο**. 76 jest.
- **2026-06-21 (SSoT cleanup)** — κεντρικοποίηση του επαναλαμβανόμενου idiom `1/Math.max(scale,0.001)` /
  `px/Math.max(scale,0.001)` (9 σημεία) σε NEW zero-import leaf `rendering/utils/viewport-scale.ts`
  (`worldPerPixel` + `pixelsToWorld` + `MIN_VIEW_SCALE`). Υιοθετήθηκε σε όλα τα drawing/tracking/rulers
  call sites (drawing-hover-handler, useCanvasClickHandler, useWallTool, wall-preview-helpers,
  useDrawingHandlers, RulersGridSystem). Εξάλειψη scattered magic `0.001`. +8 jest (93 σύνολο).
  99 jest πράσινα (framing core + beam aliases + wall-preview-store + wall-completion). 🔴 browser-verify + commit.
