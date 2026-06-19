# ADR-398 — Column placement snap (corner projection + beam-axis snap + ghost coloring)

**Status:** 🟢 Column→Beam axis snap + ghost coloring DONE · 🟢 bugfix snap-indicator εξαφάνιση στο εργαλείο «Κολώνα» (grid corner-projection έκρυβε χαρακτηριστικό) — browser-verified ✅ · UNCOMMITTED 2026-06-20 · 🔴 commit (Giorgio)
**Date:** 2026-06-19 (bugfix 2026-06-20) · **Γλώσσα:** Ελληνικά
**Σχετικά:** ADR-363 (column drawing tool / FSM + anchor ghosts), ADR-370/371/378 (BIM corner-snap system), ADR-040 (preview-canvas perf — cursor-lag Φ11 decoupled snap-scheduler), ADR-441 (column-on-grid host-on-snap)

> ⚠️ **Architecture-critical (CHECK 6D):** αγγίζει `systems/cursor/*` (snap-scheduler, mouse handlers) + ghost preview. Κάθε αλλαγή εδώ απαιτεί staged ADR/doc.

---

## 1. Πλαίσιο

Το column tool (ADR-363, freehand single-click) ζωγραφίζει ghost κάτω από το σταυρόνημα και τοποθετεί κολώνα στο κλικ. Το snap κατά την τοποθέτηση τρέχει σε **2 σημεία** (mirror): τον decoupled `snap-scheduler` (move → ghost/indicator, ADR-040 Φ11) και τον `mouse-handler-up` (click → commit point). Προϋπήρχε το **Column Body Corner Projection Snap** (η would-be κολώνα προβάλλει τις γωνίες της σε στόχους· `findColumnDrawCornerSnap`).

## 2. Πρόβλημα (Giorgio 2026-06-19)

Όταν ο χρήστης τρέχει «Κολώνα» και περνά το σταυρόνημα **πάνω από δοκάρι**, θέλει:
1. Οπτική ένδειξη ότι κλικ εκεί θα τοποθετήσει την κολώνα **πάνω στο δοκάρι**.
2. Η κολώνα να τοποθετείται **στον άξονα** του δοκαριού — **κέντρο κολώνας ≡ κέντρο άξονα δοκαριού**.

## 3. Απόφαση

### 3.1 Beam-axis projection SSoT (γέμισμα κενού)
Η οικογένεια per-member axis projection που καταναλώνει ο `NearestSnapEngine` είχε `projectPointOnWallAxis` / `projectPointOnSlabEdge` / `projectPointOnOpeningOutline` — **όχι** δοκάρι. NEW SSoT `bim/beams/beam-axis-projection.ts` (**ακριβές mirror** του `projectPointOnWallAxis`): `projectPointOnBeamAxis(beam, cursor)` (clamped nearest foot· διαβάζει cached `geometry.axisPolyline.points` → straight/curved uniform· ίδιες shared utils `getNearestPointOnLine`+`calculateDistance`) + `projectPointOnBeamAxisDetailed` (foot + distance + `atEndpoint`). Wired **`isBeamEntity` branch στο `NearestSnapEngine`** + description key `bim-beam` (`snapModes.labels.bim.beamAxis`, el+en) ⇒ **τα δοκάρια αποκτούν nearest-snap parity** με walls/slabs σε **ΟΛΑ** τα drawing tools. _(PerpendicularSnapEngine beam-feet = DEFER — εύκολη μελλοντική parity.)_

### 3.1b Column→Beam axis snap (κέντρο κολώνας ≡ άξονας δοκαριού)
NEW `bim/columns/column-placement-snap-context.ts` (column-tool orchestration **πάνω στο SSoT**, μηδέν inline geometry):
- `findColumnBeamAxisSnap(worldPos, beams)` — **reuse `projectPointOnBeamAxisDetailed`**· υποψήφιο όταν `atEndpoint===false` (πάνω στο σώμα, όχι πέρα από τα άκρα) ΚΑΙ `distance ≤ halfWidth · 1.5` (width-based ⇒ **transform-independent**)· νικά το μικρότερο.
- `resolveColumnPlacementContext(worldPos, entities)` → **precedence `overlap` > `beam` > `neutral`**: αν ο cursor είναι μέσα σε footprint **υπάρχουσας κολώνας** → `overlap` (🔴 — μην βάλεις διπλή· ισχύει **ΑΚΟΜΗ κι όταν από κάτω περνά δοκάρι**, π.χ. ενδιάμεση κολώνα στη μέση δοκαριού)· αλλιώς πάνω σε **κενό** σώμα δοκαριού → `beam` (🟢)· αλλιώς `neutral`. _(Το «δοκάρι νικά» αφορά τα snap **targets** grid/corner — όχι το collision warning έναντι υπάρχουσας κολώνας.)_

Wiring (mirror του corner-snap, ΕΝΑ SSoT σε 2 paths):
- **Move** (`snap-scheduler.runSnapDetection`): column active → `resolveColumnPlacementContext`· `beam` ⇒ `setImmediateSnap` στο σημείο του άξονα (+ beamId) και short-circuit του corner/center snap. `mouse-handler-move` τροφοδοτεί `getEntities`.
- **Commit** (`mouse-handler-up`): column active → beam-axis νικά → `worldPoint = beam point`.
- **Center enforcement** (`useColumnTool.commitColumnFromState`): όταν ghost status = `beam` → anchor **`'center'`** ανεξάρτητα από τον επιλεγμένο anchor ⇒ κέντρο κολώνας ≡ άξονας δοκού.

### 3.2 Ghost coloring (σημασιολογικό feedback στο ghost, ΟΧΙ στην υποκείμενη οντότητα)
Ο χρωματισμός γίνεται στο **ghost** (η προσοχή είναι εκεί· Revit/AutoCAD pattern· δεν αγγίζει τον select-gated entity-hover renderer):
- 🟢 **πράσινο** = πάνω σε δοκάρι (έγκυρος snap στόχος)
- 🔴 **κόκκινο** = πάνω σε υπάρχουσα κολώνα (σύγκρουση/επικάλυψη — τοποθετείται ακόμη, προειδοποίηση)
- ⚪ **default (χρώμα τύπου)** = ελεύθερη τοποθέτηση

NEW zero-React store `systems/cursor/ColumnPlacementGhostStatusStore.ts` (mirror `ImmediateSnapStore`): ο scheduler γράφει το status· το `useColumnGhostPreview` το διαβάζει **imperatively μέσα στο RAF** (zero subscription, ADR-040) και περνά `statusColor` στον `ColumnAnchorGhostRenderer` (νέο optional override, `resolveGhostStatusColor`).

### 3.3 Smart beam ghost — φάντασμα δοκαριού στις παρειές κολόνας (mirror, 2026-06-20)
Καθρέφτης του column ghost για το εργαλείο «Δοκάρι»: μόλις ενεργοποιηθεί, **πριν το 1ο κλικ** εμφανίζεται μικρό έξυπνο φάντασμα δοκαριού. Κοντά σε **ορθογώνια κολόνα** κουμπώνει σε μία από **12 διακριτές θέσεις** (4 παρειές × 3 αγκυρώσεις, το φάντασμα ΠΗΔΑΕΙ — όχι συνεχές γλίστρημα)· μακριά → ακολουθεί ελεύθερα τον κέρσορα.

**Κρίσιμη αρχιτεκτονική διαφορά από το column ghost:** η orientation/anchor είναι **καθαρά γεωμετρική** (από τα column footprints), ΟΧΙ από snap-result → **μηδέν επαφή με snap-scheduler / cursor stores / renderer core** (κανένα ADR-040 critical file, CHECK 6B/6C/6D). Όλη η λογική ζει στο **pure preview path** + στο click handler του tool.

- **Pure resolver** `bim/beams/beam-column-face-snap.ts` (`resolveBeamColumnFaceSnap` + wrapper `resolveBeamGhostSnapFromStore`): cursor + column footprints → `{ face:'E'|'W'|'N'|'S', third:'lo'|'mid'|'hi', start, end }` (centerline) ή `null`. **Reuse `projectPolygonOnAxis`** (extents, N.0.2) + `mmToSceneUnits`. Σημασιολογία: E/W → οριζόντιο δοκάρι, N/S → κάθετο· κοντινό short-end flush στην παρειά· `lo`/`hi` → γωνία-flush (πλάγια παρειά δοκού ≡ γωνιακή παρειά κολόνας), `mid` → centerline ≡ κέντρο κολόνας.
- **Centerline vs location-line:** ο resolver επιστρέφει το ΤΕΛΙΚΟ centerline `start`. Το 1ο κλικ κλειδώνει εκεί + σημαία `beamPreviewStore.startAnchored=true`· τότε το awaitingEnd preview/commit χρησιμοποιεί `buildDefaultBeamParams` (**centerline mode**), ΟΧΙ το location-line auto-flush (`buildAnchoredBeamParams`) που θα ξανα-μετατόπιζε το start ±width/2 σε διαγώνιο τράβηγμα. Free placement → αμετάβλητη location-line συμπεριφορά (ADR-363 §5.7).
- **Wiring (μηδέν duplicate, preview === commit):** ΕΝΑ wrapper καλείται και από `beam-preview-helpers` (ghost-before-click) και από `useBeamTool.onCanvasClick` (1ο κλικ). `syncColumnsToStore()` τρέχει πλέον και στο `activate` (κολόνες διαθέσιμες πριν το κλικ). **2ο κλικ ΕΛΕΥΘΕΡΟ** (διαγώνιο/ORTHO) — ο άξονας ΔΕΝ κλειδώνει.

## 4. Συνέπειες
- ✅ Καθαρή «hover→place» εμπειρία· η κολώνα κουμπώνει στον άξονα του δοκαριού (κέντρο ≡ άξονας).
- ✅ ADR-040-safe: μηδέν νέο React subscription· stores zero-React· width-based tol (transform-independent).
- ✅ SSoT: ΕΝΑ context resolver καταναλώνεται και από move και από commit (μηδέν διπλή λογική, mirror corner-snap).
- ✅ Μηδέν regression: το beam-axis είναι additive· χωρίς δοκάρι κάτω από τον cursor όλα μένουν ως πριν.
- ⚠️ Το beam-axis snap τρέχει εντός του υπάρχοντος snap gate (`snapEnabled`)· με snap απενεργοποιημένο δεν εφαρμόζεται (consistent με τα άλλα snaps).

## 5. Tests
- `bim/beams/__tests__/beam-axis-projection.test.ts` — 6 GREEN: clamped nearest foot· distance· `atEndpoint`· curved tessellation· defensive null.
- `bim/columns/__tests__/column-placement-snap-context.test.ts` — 9 GREEN: snap στον άξονα (μέσω SSoT)· atEndpoint reject· capture width-based· nearest beam· precedence (beam > overlap > neutral).
- Snapping regression: 169 GREEN (incl. NearestSnapEngine `bim-beam` wiring + snap-description-keys).
- `bim/beams/__tests__/beam-column-face-snap.test.ts` — **20 GREEN** (§3.3 smart beam ghost): 4 παρειές × 3 thirds = 12 centerline θέσεις + capture gate (snap@600 / release@601) + degenerate footprint + nearest-of-many + cursor-inside + mm/metre wrapper scaling. Regression: `useBeamTool` 47 GREEN, `beam-preview-cutback-parity` GREEN (startAnchored=false → location-line αμετάβλητο).

## 6. Changelog
- **2026-06-20 (bugfix: «Maximum update depth exceeded» render-loop — UNCOMMITTED)** — Browser report μετά το §3.3: το `syncColumnsToStore()` που πρόσθεσα στο `useBeamTool.activate` έκανε το `activate` useCallback να εξαρτάται από το `syncColumnsToStore` (dep `[getSceneEntities]`)· το `options.getSceneEntities` είναι **inline arrow** (νέο identity κάθε render) → `syncColumnsToStore` νέο → `activate` νέο κάθε render → το `useToolLifecycle` (effect dep `[isActive, activate, deactivate]`) ξανατρέχει → `activate()` → setState → **infinite loop**. FIX: stable `getSceneEntitiesRef` (ref ορισμένο μία φορά κοντά στην κορυφή· `syncColumnsToStore` dep `[]`) → `activate` ξανα-σταθερό όπως πριν. **ΜΑΘΗΜΑ:** callback που πάει σε `useToolLifecycle`/effect-deps ΠΡΕΠΕΙ να μένει referentially stable — διάβασε τα unstable props (inline arrows) μέσω ref, ΟΧΙ μέσω useCallback dep. `useBeamTool` 10 jest GREEN.
- **2026-06-20 (NEW feature: Smart beam ghost — §3.3, UNCOMMITTED)** — Το εργαλείο «Δοκάρι» απέκτησε **φάντασμα πριν το 1ο κλικ** (mirror του column ghost): κοντά σε ορθογώνια κολόνα κουμπώνει σε 12 διακριτές θέσεις (4 παρειές × 3 αγκυρώσεις)· μακριά ακολουθεί ελεύθερα. **Καθαρά γεωμετρικό** (μηδέν επαφή με snap-scheduler/cursor/renderer core — αντίθετα με το column ghost που χρειάστηκε wiring). NEW pure `bim/beams/beam-column-face-snap.ts` (reuse `projectPolygonOnAxis`+`mmToSceneUnits`)· `beamPreviewStore.startAnchored` flag (centerline mode vs location-line auto-flush)· ΕΝΑ wrapper σε preview (`beam-preview-helpers`) + click (`useBeamTool`) → preview === commit· `syncColumnsToStore` και στο `activate`. **2ο κλικ ελεύθερο** (διαγώνιο/ORTHO). 20 jest νέα + regression GREEN, tsc clean. 🔴 browser-verify + commit (Giorgio).
- **2026-06-20 (bugfix: snap indicators εξαφανίζονται στο εργαλείο «Κολώνα» — browser-verified ✅, UNCOMMITTED)** — Giorgio report: με εργαλείο «Κολώνα» + snaps ON, hover κοντά σε **δοκάρι/κολώνα** ΔΕΝ έδειχνε γλυφές + ετικέτες (Γωνία/Μέσο/Κέντρο στήλης & δοκαριού), ενώ σε «Επιλογή»/«Τοίχος» έδειχναν κανονικά. **ΠΡΑΓΜΑΤΙΚΗ ΡΙΖΑ (αποδεδειγμένη με live debug log, ΟΧΙ ο short-circuit):** το **Column Body Corner Projection Snap** (`findColumnDrawCornerSnap`) — μοναδικό column-specific βήμα — προβάλλει τις γωνίες της would-be κολώνας στον snap engine· σε κάναβο-βαρύ μοντέλο μια γωνία πέφτει σε **γραμμή `grid`** σχεδόν κάθε frame → ο `SnapIndicatorOverlay` **κρύβει ρητά** `grid`/`guide` (silent, AutoCAD convention) → καμία γλυφή. Το `grid` corner-projection **υπερίσχυε** του ορατού BIM χαρακτηριστικού snap που υπήρχε στον cursor (`bim_corner`/`bim_center`/`bim-beam`). Ο Τοίχος δεν έχει corner-projection → έδειχνε. **Fix (Revit-grade προτεραιότητα, SSoT):** NEW pure `resolveColumnDrawSnap(cursorPos, drawCorner, findSnapPoint)` (`column-placement-snap-context.ts`) — προτεραιότητα **(1) ορατό corner-projection (διακριτός στόχος) > (2) ορατό cursor χαρακτηριστικό (η ρητή πρόθεση) > (3) σιωπηλό grid alignment (fallback, αμετάβλητη συμπεριφορά)**· `isVisibleIndicatorSnap` mirror του hide-rule του overlay (`grid`/`guide`). Ίδιος resolver σε **move** (`snap-scheduler`) ΚΑΙ **commit** (`mouse-handler-up`) → commit ≡ ghost. **Επιπλέον SSoT cleanup (ίδιο pass):** αφαίρεση του περιττού `setFullSnapResult(null)`/short-circuit (`applyColumnPlacementContext`/`writeBeamAxisSnap`) — το ενιαίο `findSnapPoint` τρέχει ΠΑΝΤΑ· ghost status πλέον **thin reader** μέσω NEW `resolveColumnGhostStatusFromSnap` (`snapResult.snapPoint.entityId` → δοκάρι 🟢 / κολώνα 🔴 + light `findColumnOverlap` fallback, precedence overlap>beam>neutral)· **DELETE διπλότυπα** `findColumnBeamAxisSnap`/`resolveColumnPlacementContext`/`ColumnBeamAxisSnap`/`ColumnPlacementContext` (η beam-axis projection ζει ΜΟΝΟ στο `NearestSnapEngine`). center-anchor (`getColumnGhostStatus()==='beam'`), `ColumnPlacementGhostStatusStore`, `useColumnGhostPreview` αμετάβλητα. Tests: `column-placement-snap-context.test.ts` rewrite → 15 jest (5 `resolveColumnDrawSnap` precedence + 10 ghost-status/overlap)· `beam-axis-projection` 6 GREEN· `snapping/` GREEN. **ΜΑΘΗΜΑ:** όταν ένα drawing tool έχει corner-projection, ένας σιωπηλός `grid` στόχος δεν πρέπει να υπερισχύει ορατού χαρακτηριστικού — αλλιώς ο indicator εξαφανίζεται «μυστηριωδώς». browser-verified ✅. 🔴 tsc(Giorgio) + commit.
- **2026-06-19 (bugfix precedence, UNCOMMITTED)** — Giorgio report: hover πάνω σε **ενδιάμεση** κολώνα (στη μέση δοκαριού) ΔΕΝ γινόταν 🔴 (έβγαινε 🟢), ενώ οι γωνιακές (στα άκρα) σωστά 🔴. Ρίζα: precedence ήταν `beam > overlap`· η mid-span κολώνα κάθεται στον άξονα → beam νικούσε. Οι γωνιακές είναι σε beam endpoints (`atEndpoint` → beam reject → overlap). Fix: **`overlap > beam > neutral`** (υπάρχουσα κολώνα νικά το δοκάρι για το collision warning· το «beam νικά» μένει για snap targets grid/corner). NEW `findColumnOverlap` helper. +2 jest (10 total).
- **2026-06-19 (SSoT refactor, UNCOMMITTED)** — Μετά από SSoT audit (Giorgio): η beam-axis projection ήταν inline στο column helper ενώ υπήρχε pattern `projectPointOn{Wall,Slab,Opening}` (το beam έλειπε). **Εξαγωγή** NEW `bim/beams/beam-axis-projection.ts` (`projectPointOnBeamAxis` + `...Detailed`, mirror wall) + wire `isBeamEntity` στο `NearestSnapEngine` (+ `bim-beam` description key, el+en) ⇒ τα δοκάρια αποκτούν nearest-snap parity παντού. `findColumnBeamAxisSnap` → reuse SSoT (μηδέν inline geometry). +6 jest, 169 snapping GREEN.
- **2026-06-19 (UNCOMMITTED)** — NEW `column-placement-snap-context.ts` (`findColumnBeamAxisSnap` + `resolveColumnPlacementContext`) + NEW `ColumnPlacementGhostStatusStore.ts` + ghost coloring (`ColumnAnchorGhostRenderer.statusColor` + `resolveGhostStatusColor`) + wiring move (`snap-scheduler` + `mouse-handler-move.getEntities`) + commit (`mouse-handler-up`) + center-anchor enforcement (`useColumnTool`). 9 jest GREEN. 🔴 tsc(Giorgio) + browser-verify + commit.
- _(retroactive)_ Column Body Corner Projection Snap (`findColumnDrawCornerSnap`, ADR-040 Φ11 scheduler + up-handler) — η would-be κολώνα προβάλλει τις γωνίες της σε στόχους· sibling του beam-axis snap, ίδιο 2-paths pattern.
