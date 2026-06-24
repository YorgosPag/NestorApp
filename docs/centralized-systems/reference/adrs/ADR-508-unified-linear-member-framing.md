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
- **2026-06-21 (§dim — listening dimensions στο wall ghost)** — Revit-style temporary/listening
  dimensions καθώς το φάντασμα τοίχου γλιστράει 🟢 πάνω σε παρειά υφιστάμενου μέλους. Giorgio:
  «πάντα 3 νούμερα ταυτόχρονα» → gap αριστερό άκρο→αριστερή base γωνία φαντάσματος, gap δεξιά base
  γωνία→δεξί άκρο, και κέντρο-παρειάς→άξονα φαντάσματος. **FULL SSoT reuse, μηδέν διπλότυπο**:
  (1) `resolveLinearMemberFaceSnap` **εκθέτει** το ήδη-υπολογισμένο `faceFrame` (alongMin/Max +
  centerAlong + half + axis/perp· μηδέν νέο projection)· (2) NEW pure `bim/framing/ghost-face-dim-references.ts`
  (αδελφό του `bim/walls/opening-dim-references.ts` — «offsets κατά μήκος άξονα προς πλησιέστερη
  αναφορά»· υπολογίζει τις 3 αποστάσεις + witness points + zoom-adaptive perpendicular offsets,
  drops flush/zero)· (3) NEW thin `canvas-v2/preview-canvas/ghost-face-dim-paint.ts` που χτίζει
  transient `aligned` DimensionEntity ([p1,p2,dimLineRef]) και ΖΩΓΡΑΦΙΖΕΙ μέσω του **ADR-362
  `renderPreviewDimension` SSoT** (ο μόνος 2D dim renderer — μηδέν 2ος path) με στυλ `ISO_129_TEMPLATE`·
  (4) metadata `faceDimensions` κρεμασμένο στο ghost entity (`toWysiwygPreviewEntity`, mirror
  `ghostStatusColor`)· (5) `wall-preview-helpers.makeWallGhostBeforeClick` υπολογίζει+attach (μόνο 🟢,
  ΟΧΙ 🔴 overlap)· (6) thin `PreviewRenderer.drawGhostFaceDimensions` + `PreviewCanvas` handle (mirror
  `drawTrackingAlignment`)· (7) `drawing-hover-handler` διαβάζει το metadata + ζωγραφίζει overlay μετά
  το `drawPreview`. **ΜΑΘΗΜΑ/fix (browser, Giorgio): οι γραμμές φαίνονταν, τα νούμερα ΟΧΙ** — ο
  ADR-362 renderer σκόπιμα ΔΕΝ auto-scale-άρει το κείμενο (text=dimtxt·dimscale·scale ≈ sub-pixel σε
  τυπικό zoom). NEW opt `textScreenScaled` στο `renderPreviewDimension` (το `4/scale` ζει ΜΟΝΟ μέσα
  στον renderer — μηδέν duplication στο call site) → text ~10px σε κάθε zoom για ephemeral dims.
  21 jest (ghost-face-dim-references 6 + paint smoke 2 + linear-member-face-snap/member-ghost regression).
  tsc clean. ⚠️ CHECK 6B/6D (PreviewRenderer/PreviewCanvas/drawing-hover-handler) → stage ADR-040 + ADR-362.
  Μόνο WALLS (το beam alias παίρνει faceFrame αλλά δεν attach-άρει dims — trivial extension αν χρειαστεί).
  🔴 browser-verify (numbers readable σε zoom· flush drops) + commit.
- **2026-06-21 (§dim browser fixes, Giorgio)** — **(1)** νούμερα σε **ΜΕΤΡΑ**: το text format άρεται
  μέσω του υπάρχοντος SSoT `formatLengthForDisplay(mm, {unit:'m'})` (config/display-length-format)
  ως dim `userText` override — αρχιτεκτονική σύμβαση, ανεξάρτητα από status-bar unit. **(2)** «η γραμμή
  περνά μέσα από το κείμενο» → `dimtfill:'backgroundColor'` (DIMTFILL μάσκα) με χρώμα = live canvas bg
  (`resolveDxfCanvasBackgroundHex` SSoT)· NEW προαιρετικό `canvasBackground` στο `renderPreviewDimension`
  (threaded στο `renderDimensionText` που ήδη υποστηρίζει τη μάσκα). **(3) Boy-Scout κεντρικοποίηση**
  (Giorgio «πλήρη κεντρικοποίηση»): το tracking tooltip (`drawing-hover-handler`) έφτιαχνε χειροκίνητα
  `formatDisplayValue(mm,unit) + DISPLAY_UNIT_LABELS[unit]` → αντικαταστάθηκε με `formatLengthForDisplay`
  (−3 imports). Τα υπόλοιπα `DISPLAY_UNIT_LABELS[]` (CadStatusBar selector, PropertiesPalette/QuickProperties
  input-suffix) είναι legit standalone labels, ΟΧΙ duplicates. 22 jest GREEN, tsc clean.
- **2026-06-22 (§opening-conflict — wall ghost 🔴 ΜΠΛΟΚΑΡΕΙ μπροστά από άνοιγμα, 3D)** — όταν ο
  κάθετος τοίχος-φάντασμα (T-framing στην παρειά host) θα **έκοβε** πόρτα/παράθυρο του host, γίνεται
  **🔴 + block commit** (ίδιο μονοπάτι με το short-end overlap). 3D έλεγχος: κατακόρυφη τομή
  `[baseOffset, +height] ∩ [sillHeight, +height]` **ΚΑΙ** οριζόντια `[abut−t/2, abut+t/2] ∩
  [offsetFromStart, +width]` κατά τον host άξονα. **ΕΝΑΣ κανόνας πόρτα/παράθυρο** (sillHeight). **FULL
  SSoT reuse, μηδέν νέος μηχανισμός (Giorgio audit):** (1) NEW pure `bim/walls/wall-opening-conflict.ts`
  (`wallGhostBlocksOpening` + `resolveWallOpeningConflictForHost`) — **reuse `getEntityZExtents` (ADR-452)**
  για το κατακόρυφο εύρος ΚΑΙ τοίχου ΚΑΙ ανοίγματος, **`projectPointToWallOffsetMm`** (opening-geometry)
  για το `abut`, **`getSiblingOpeningsOnWall`** (opening-siblings) για φιλτράρισμα ανά `wallId`·
  (2) **Revit-grade host = snapped reference (Giorgio «τι θα έκανε η Revit;»):** ο host ΔΕΝ ξανα-βρίσκεται
  γεωμετρικά — `MemberGhostSnapResult` **εκθέτει `targetId`** (το `best` target που ΗΔΗ επέλεξε ο
  `resolveLinearMemberFaceSnap`)· διαδίδεται live στο preview ΚΑΙ ως locked `WallToolState.anchoredHostId`
  (+ `wall-preview-store`) στο awaitingEnd/commit → ΜΙΑ πηγή αλήθειας για τον host (μηδέν re-derive)·
  (3) `scene-snap-targets` += `wallEntities`+`openings` (1 pass στον ίδιο collector → preview≡commit)·
  (4) gate στον SSoT `buildWallGhostEntity` (wall-preview-helpers) — conflict ⇒ 🔴 + κρύβει listening
  dims + `openingConflict` meta· (5) commit block στο `use-wall-commit.commitStraightFromState` (ίδιο
  `resolveWallOpeningConflictForHost`, host = `anchoredHostId`)· (6) tooltip: `openingConflict.bandMm`
  meta → `drawing-hover-handler` το μεταφράζει (`i18n.t('tools.wall.openingCutConflict', {range})`, el+en·
  reuse `formatLengthForDisplay`) → thin `PreviewRenderer.drawGhostConflictTooltip` (reuse `drawOverlayLabel`,
  overlap red). 13 jest (πόρτα/παράθυρο/μερική/άγγιγμα/host-by-reference). **Κλειδωμένο (Giorgio):** οριζόντιο
  εύρος = πάχος ghost· tooltip = κείμενο + εύρος ύψους· host = snapped reference (ΟΧΙ perpendicular re-derive).
  ⚠️ CHECK 6B/6D (PreviewRenderer/PreviewCanvas/drawing-hover-handler) → stage ADR-040. 🔴 browser-verify + commit.
- **2026-06-22 (§wall-hud — ζωντανή ταυτότητα τοίχου κατά τη σχεδίαση)** — όταν ο χρήστης τραβά τοίχο
  (awaitingEnd) μακριά από άλλα αντικείμενα, ο τοίχος-φάντασμα φαίνεται σαν **έτοιμο διαστασιολογημένο
  αρχιτεκτονικό σχέδιο**: (1) **aligned διάσταση μήκους** κάτω από τον τοίχο (μεγαλώνει live), (2)
  **γωνία** `∠ θ` στην αρχή, (3) ετικέτα **πάχος · ύψος** στη μέση (η BIM ταυτότητα — όχι μόνο
  γεωμετρία). Διαφοροποίηση από big players: AutoCAD/Revit dynamic input δείχνουν μόνο μικρό πεδίο
  μήκος/γωνία· εμείς δείχνουμε **ζωντανά τα BIM μεγέθη**. **FULL SSoT, μηδέν bespoke draw:** εξήχθη
  `paintAlignedOverlayDimension` από το `ghost-face-dim-paint` (κοινό aligned-dim SSoT: `renderPreviewDimension`
  ADR-362 + overlay-line-style) → το μοιράζονται listening-dims ΚΑΙ HUD· NEW `wall-hud-paint.ts`
  (`paintWallHud` + `WallHudMeta`) συνθέτει dim + `drawOverlayLabel` (×2) + `formatLengthForDisplay`/
  `formatAngleLocale`· `wall-preview-helpers.buildWallHudMeta` εξάγει αριθμητικό `wallHud` meta από τον
  χτισμένο τοίχο (gated σε ευθύ awaitingEnd/footprint· `wantHud`)· `drawing-hover-handler` μεταφράζει το
  spec (`i18n.t('tools.wall.hudSpec', {thickness,height})`, el+en) + καλεί `PreviewRenderer.drawWallHud`·
  thin `PreviewCanvas` facade. Χρώμα HUD = ουδέτερο γκρι (διακριτό από cyan listening dims). **Κλειδωμένο
  (Giorgio):** στυλ «Αρχιτεκτονικό» (διαστάσεις πάνω στον τοίχο). ⚠️ CHECK 6B/6D (PreviewRenderer/
  PreviewCanvas/drawing-hover-handler) → stage ADR-040. 🔴 tsc + browser-verify + commit.
- **2026-06-23 (§center/flush μαγνήτες — Giorgio bug «δεν κεντράρει σε κοντή γραμμή»)** — όταν ο τοίχος
  κούμπωνε την παρειά του σε **κοντή γραμμή** (π.χ. 25cm), δεν καθόταν στο **μέσο** της: άφηνε 1,5/2,5cm
  (5mm offset). **ΡΙΖΑ:** στο T-framing (`resolveLinearMemberFaceSnap`) το `centerAlong` ακολουθούσε τον
  cursor κουμπωμένο σε **regular grid** (`quantizeMagnitude(cAlong, slideStepScene)`, anchored στην αρχή
  της γραμμής) → **έχανε** το μέσο/flush. Λείπαν οι «μαγνήτες» χαρακτηριστικών θέσεων που έχει ήδη η
  **κολόνα** (`resolveMemberColumnFaceSnap`: lo→flush, mid→κέντρο, hi→flush). **FIX:** NEW pure
  `magnetizeGhostCenterAlong` — το centerline κουμπώνει στο **κέντρο** της παρειάς ή **flush** σε κάθε
  κοντή άκρη όταν ο raw cursor είναι εντός `radius=slideStepScene`, αλλιώς συνεχής/grid ολίσθηση (ΜΕΤΑΞΥ
  μαγνητών αμετάβλητη). Gated σε `slideStepScene` (τοίχος)· **δοκάρι αμετάβλητο**. Υλοποιεί το documented
  intent του `lineTarget`/`edgeBandTarget` («flush εκατέρωθεν + center»). 5 jest (center/flush/free-slide·
  26 σύνολο). 🔴 browser-verify + commit. (Pre-existing άσχετο fail `beam-grips.test` rotation-grip
  standoff = grip-domain, uncommitted άλλου agent — ΟΧΙ δικό μου.)
- **2026-06-24 (ΠΛΗΡΗΣ ΕΝΟΠΟΙΗΣΗ τοίχου↔κολώνας — Giorgio «FULL ENOPOIHSH, FULL SSoT»)** — ο τοίχος
  τώρα ολισθαίνει «ρευστά» γύρω από **κάθε** μέλος, σε **αμφότερα** τα άκρα, όπως η κολώνα. Δύο διαφορές
  λύθηκαν: **#1 — συνεχής ολίσθηση στις κολώνες (wall START):** το `resolveMemberColumnFaceSnap` έπαψε
  να ΠΗΔΑΕΙ σε 12 διακριτές θέσεις· έγινε **ΣΥΝΕΧΕΣ** (mirror του `resolveLinearMemberFaceSnap` + του
  column-tool `resolveForTarget`): `clamp` διαμήκης θέσης + reuse του ΙΔΙΟΥ `magnetizeGhostCenterAlong`
  (3 anchors: κέντρο + flush άκρα) + **έκθεση `GhostFaceFrame`** → listening dimensions ΚΑΙ στις κολόνες.
  NEW pure helpers `slideAlongFace`/`resolveContinuousColumnFace` (N.7.1 ≤40γρ.)· νέο optional
  `slideStepScene` στο `MemberColumnFaceSnapOptions`· ο dispatcher υπολογίζει το step **μία φορά** και το
  περνά ΚΑΙ στο column branch + επιστρέφει `faceFrame`. **#2 — face-snap στο ENDPOINT (wall awaitingEnd):**
  NEW pure `bim/walls/wall-endpoint-snap.ts` (`resolveWallEndpointSnap`) = **point snap** που κάνει reuse
  τον ΙΔΙΟ dispatcher και κρατά το `snap.start` (flush σημείο). Wire σε preview (`wall-preview-helpers`,
  πριν το `clampPreviewMinLength`, + endpoint listening dims) ΚΑΙ commit (`useWallTool` awaitingEnd) →
  **preview ≡ commit**. **Precedence (Giorgio):** face-snap > ORTHO (CAD-standard osnap>ortho)·
  **length/angle lock (Δαχτυλίδι) νικά** το face-snap → NEW `isLengthAngleLockActive` (SSoT στο
  `length-angle-lock`, reuse `DynamicInputLockStore`). **Layering:** `buildColumnBboxFaceFrame`
  μετακινήθηκε `bim/columns/column-face-snap-helpers` → `bim/framing/linear-member-face-snap` (SSoT home
  του `GhostFaceFrame`· αποφυγή κύκλου `framing→columns`) + re-export alias για τους column consumers·
  `magnetizeGhostCenterAlong` έγινε `export`. **ΠΑΡΕΝΕΡΓΕΙΑ ΔΟΚΑΡΙΟΥ (διαφανώς):** το δοκάρι μοιράζεται
  τον ίδιο resolver → το δοκάρι-σε-κολώνα έγινε **κι αυτό συνεχές** (χωρίς magnet, αφού το δοκάρι δεν
  περνά `slideStepScene`) — **εσωτερικά συνεπές** με τη συμπεριφορά του δοκαριού στα μέλη (που ήταν ήδη
  συνεχής). beam-column-face-snap tests ενημερωμένα σε συνεχή. **Αμετάβλητα:** column-priority (`neutral`),
  🟢/🔴 overlap, opening-conflict (host = start `anchoredHostId`), curved/polyline. 109 jest GREEN
  (member-ghost-snap + wall-endpoint-snap + beam-column-face-snap + column-face-snap)· framing/walls/beams/
  columns sweep 1196/1197 (το 1 fail = pre-existing `beam-grips` rotation-grip, άλλου agent). ⚠️ CHECK
  6B/6D (wall-preview-helpers/useWallTool drawing path) → stage ADR-040. 🔴 browser-verify + commit.
