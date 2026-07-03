# HANDOFF — «Δοκάρι από τοίχο» (beam-from-wall) δεν λειτουργεί → επιλογή τοίχου ανάμεσα σε 2 στηρίγματα → δοκάρι πάνω από τον τοίχο

**Ημ/νία:** 2026-07-03
**Στόχος (λόγια Giorgio):** «Θέλω να επιλέγω έναν τοίχο που βρίσκεται **ανάμεσα σε δύο κολώνες ή δύο τείχια ή κολόνα+τείχο**, και όταν τον επιλέγω να **δημιουργείται δοκάρι πάνω από τον τοίχο**. Υπάρχει ήδη εντολή "Δοκάρι από τοίχο" αλλά **δεν λειτουργεί**.»
**Σχετικά ADR:** **ADR-363** (BIM drawing mode / «Δοκάρι από τοίχο») + **ADR-401 D** (structural auto-attach: κορυφή τοίχου ↔ κάτω δοκαριού) + **ADR-398** (smart beam ghost / face-snap σε κολόνα) + **ADR-436 Slice 2** (αδελφό «Πεδιλοδοκός από τοίχο», δουλεύει — πρότυπο).

---

## 0. Κανόνες συνεδρίας (ΑΠΑΡΑΒΑΤΟΙ)
- 🌐 **Απάντα ΠΑΝΤΑ στα Ελληνικά.**
- 🏢 **«Όπως οι μεγάλοι» (Revit / Maxon Cinema 4D / Figma-level) + FULL ENTERPRISE + FULL SSoT.** Αν οι μεγάλοι δεν προτείνουν κάτι → ακολουθούμε **την πρακτική τους**, δεν εφευρίσκουμε δικό μας.
- 🔎 **ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT (grep) ΠΡΙΝ γράψεις ΟΠΟΙΟΝΔΗΠΟΤΕ κώδικα** — το σύστημα beam-from-wall **ΥΠΑΡΧΕΙ ΗΔΗ** (βλ. §2). Χρησιμοποίησέ το/διόρθωσέ το, **ΜΗΔΕΝ διπλότυπα**, μηδέν νέο builder/geometry.
- 🧭 **Ίχνευσε ΟΛΟ το pipeline** (ribbon button → activeTool → useSpecialTools activate/placementMode → 2D click dispatch → useBeamTool FSM → commitFromWall → pickWallEntityAt/buildBeamFromWall → append + auto-attach), όχι απομονωμένα hooks.
- 📐 **Plan Mode** για την υλοποίηση. Στο clarify ξεκίνα με **συγκεκριμένο αριθμητικό/οπτικό παράδειγμα** (ASCII/νούμερα), όχι αφηρημένη ερώτηση.
- ❌ **ΜΗΝ τρέξεις `tsc`** (N.17). ✅ **jest επιτρέπεται** (γρήγορα, στοχευμένα).
- ❌ **ΜΗΝ commit / push** (N.(-1)). **Ο Giorgio κάνει τα commit.**
- ⚠️ **Το working tree ΜΟΙΡΑΖΕΤΑΙ με άλλον agent.** Additive, μηδέν regression, commit με explicit pathspec.

---

## 1. ΤΟ ΣΥΜΠΤΩΜΑ → τι σημαίνει
Η εντολή «Δοκάρι από τοίχο» (tool id `beam-from-wall`, κουμπί ribbon «Δομικά») είναι υλοποιημένη 1-click (κλικ πάνω σε τοίχο → ΕΝΑ δοκάρι στον άξονά του, πλάτος = πάχος τοίχου, κάθεται στην κορυφή του 3m τοίχου, ο τοίχος auto-κονταίνει). **Ο χρήστης λέει ότι δεν παράγει δοκάρι.** Πρέπει: (α) reproduce στον browser, (β) root-cause γιατί ΔΕΝ πυροδοτείται/δεν φαίνεται το δοκάρι, (γ) διόρθωση «όπως οι μεγάλοι» + η σημασιολογία «ανάμεσα σε 2 στηρίγματα».

**ΣΗΜΑΝΤΙΚΟ semantic clarify με Giorgio (concrete example ΠΡΩΤΑ):** το υπάρχον χτίζει δοκάρι στον **άξονα του τοίχου (start→end του ΤΟΙΧΟΥ)**. Ο Giorgio περιγράφει «τοίχο ανάμεσα σε 2 στηρίγματα». Ρώτησέ τον με ASCII αν θέλει:
- (Α) δοκάρι **ακριβώς στα start→end του τοίχου** (τρέχουσα συμπεριφορά), ή
- (Β) δοκάρι που **εκτείνεται/trim-άρεται ώς τα κέντρα/παρειές των 2 στηριγμάτων** (κολόνα/τοίχος) που ακουμπά ο τοίχος (Revit: beam spans support-to-support).
```
   [ΚΟΛΟΝΑ]════════ τοίχος ════════[ΚΟΛΟΝΑ]
   (Α) δοκάρι:      |<--- start→end τοίχου --->|
   (Β) δοκάρι:  |<------ κέντρο→κέντρο κολόνας ------>|
```
Μεγάλοι (Revit): δοκάρι που δημιουργείται «κατά μήκος τοίχου» ακολουθεί τον άξονα του τοίχου· η έδραση/επέκταση ώς τα στηρίγματα είναι **ξεχωριστό structural βήμα** (`derive-beam-support.ts` υπάρχει ήδη). Πιθανό σωστό: (Α) ως βάση + προαιρετικό support-trim (Β) αν το ζητήσει.

---

## 2. ΤΟ ΥΠΑΡΧΟΝ ΣΥΣΤΗΜΑ — SSoT INVENTORY (reuse, ΜΗΝ ξαναγράψεις)
**Πυρήνας (2D geometry bridge):**
- `bim/beams/beam-from-wall.ts` — **`pickWallEntityAt(point, entities, tolerance)`** (nearest wall by axis `pointToLineDistance`) + **`buildBeamFromWall(wall, overrides, levelId, sceneUnits)`** (start→end τοίχου, width=thickness, μέσω `completeBeamFromTwoClicks`). ΚΑΜΙΑ builder math εδώ — bridge only. (+ `__tests__/beam-from-wall.test.ts`)
- `hooks/drawing/use-beam-commit.ts` — **`commitFromWall(state, point)`** (ο commit core· καλείται από 2D & 3D).
- `hooks/drawing/beam-completion.ts` — **`completeBeamFromTwoClicks`** (beam builder SSoT).

**Tool / FSM / wiring:**
- `systems/tools/tool-definitions.ts:190` — tool `beam-from-wall` (category 'drawing', allowsContinuous).
- `ui/ribbon/data/structural-tab.ts:137` — κουμπί `struct-beam-on-entity` → tool `beam-from-wall` (`toolBtn('structuralTab.beamFromWall', …, 'beam-from-wall')`).
- `hooks/tools/useSpecialTools.ts:404-409` — `isBeamTool = activeTool==='beam' || 'beam-from-wall'` → `useToolLifecycle(isBeamTool, beamTool.activate, beamTool.deactivate)`· `useEffect`: `activeTool==='beam-from-wall'` → `beamTool.setPlacementMode('from-wall')`. (getSceneEntities getter γρ.392-397)
- `hooks/drawing/useBeamTool.ts` — FSM: `activate()` (γρ.135) θέτει `phase:'awaitingStart'`· `onCanvasClick` (γρ.200): `if (phase==='idle') return false;` **μετά** `if (placementMode==='from-wall') return commitFromWall(s, point);` (γρ.203-208).
- `hooks/canvas/canvas-click-bim-dispatch.ts:180` — 2D dispatch: `if (activeTool==='beam-from-wall' && beamTool?.isActive) { beamTool.onCanvasClick(worldPoint); return true; }` (RAW worldPoint — ORTHO/POLAR ΔΕΝ πρέπει να μετακινούν το pick).

**3D path (parity, μην το σπάσεις):**
- `bim-3d/viewport/use-bim3d-beam-from-wall-pick.ts` (+test) — raycast wall mesh → emit `bim:beam-from-wall-picked-3d {wallId}`.
- `bim-3d/placement/BeamFromWallGhost.ts` (+test) — 3D ghost.
- Στο `useBeamTool.ts` (~γρ.281) ο bridge `EventBus.on('bim:beam-from-wall-picked-3d')` → resolve WallEntity → **ΙΔΙΟΣ** `commitForWall` core.

**Auto-attach (κρίσιμο για τη σημασιολογία «πάνω από τον τοίχο»):**
- `hooks/useStructuralAutoAttach.ts` (ADR-401 D) — μετά `drawing:entity-created {tool:'beam'}` attach-άρει κορυφή τοίχου ↔ κάτω δοκαριού (ο τοίχος κονταίνει αυτόματα στα 2.5m). **ΜΗΝ** βάλεις ρητή μείωση ύψους — γίνεται εδώ.

**Στηρίγματα / support (για τη σημασιολογία «ανάμεσα σε 2»):**
- `bim/structural/organism/derive-beam-support.ts` — παραγωγή έδρασης δοκαριού.
- `bim/beams/beam-tool-bridge-store.ts` — bridge store.
- Αδελφό-πρότυπο που **δουλεύει**: `bim/foundations/foundation-from-wall.ts` + `foundation-strip-from-wall` (useSpecialTools:355 — `setKind('strip')` + `setPlacementMode('from-wall')`). Σύγκρινε 1-προς-1 γιατί το foundation δουλεύει και το beam όχι.

---

## 3. ROOT-CAUSE candidates (επιβεβαίωσε/διάψευσε — ΜΗΝ τα πάρεις έτοιμα)
Το wiring φαίνεται **άθικτο** end-to-end (ribbon→tool→activate→placementMode→dispatch→FSM→commitFromWall). Άρα το bug είναι πιθανότατα **μέσα στο commit** ή **περιβαλλοντικό**:
1. **`pickWallEntityAt` επιστρέφει null** → καμία δράση. Έλεγξε: (α) το `getSceneEntities()` επιστρέφει τους τοίχους ως **`DxfWall` wrapper** (`type:'wall'`, `params` top-level) — το `isWallEntity(e)` (=`e.type==='wall'`) + `w.params.start/end` δουλεύουν σε DxfWall; (β) **tolerance**: σε ποιες μονάδες; Σε **γεωαναφερμένο DXF** (~1.7e7 — βλ. πρόσφατο dimension work) μικρή/λάθος tolerance ή float precision μπορεί να αστοχεί.
2. **`commitFromWall` returns false** (π.χ. `buildBeamFromWall` hardErrors, ή phase guard). Δες `use-beam-commit.ts`.
3. **Το δοκάρι δημιουργείται αλλά είναι αόρατο/λάθος elevation** — beam defaults top 3000/depth 500· αν ο τοίχος είναι σε άλλη στάθμη ή το auto-attach αποτυγχάνει. (Beams έχουν `geometry.bbox` → culling ΟΚ, δεν είναι το πρόβλημα των διαστάσεων.)
4. **Ο τοίχος-target είναι DxfWall αλλά ο κώδικας περιμένει flat WallEntity** (ίδια κλάση wrapper-mismatch με το πρόσφατο dimension bug — τσέκαρε παντού όπου γίνεται `as WallEntity`).
5. **Activation edge**: αν το κουμπί δεν αλλάζει `activeTool` σε `beam-from-wall` (ή το χάνει λόγω contextual-tab), το `beamTool.isActive` μένει false → dispatch περνά χωρίς δράση. Reproduce με debug log στο dispatch:180.

**Reproduce ΠΡΩΤΑ στον browser** (Giorgio): ενεργοποίησε «Δοκάρι από τοίχο», κλικ πάνω σε τοίχο ανάμεσα σε 2 κολόνες → τι γίνεται (τίποτα; console error; δοκάρι αλλού;). Αυτό στενεύει άμεσα το candidate.

---

## 4. SSoT AUDIT — grep ΠΡΙΝ γράψεις (υποχρεωτικό)
```
grep -rn "beam-from-wall\|beamFromWall\|from-wall\|pickWallEntityAt\|buildBeamFromWall\|commitFromWall" src/subapps/dxf-viewer
grep -rn "placementMode\|setPlacementMode" src/subapps/dxf-viewer/hooks/drawing/useBeamTool.ts src/subapps/dxf-viewer/hooks/tools/useSpecialTools.ts
grep -rn "derive-beam-support\|beam-support\|beamSupport" src/subapps/dxf-viewer
grep -rn "foundation-strip-from-wall\|foundation-from-wall" src/subapps/dxf-viewer   # αδελφό που δουλεύει
grep -rn "isWallEntity\|as WallEntity\|DxfWall" src/subapps/dxf-viewer/bim/beams
```
Επιβεβαίωσε: ΕΝΑ `useBeamTool` instance (freehand + from-wall)· ΕΝΑ commit core (2D+3D)· κανένα διπλότυπο builder. Επέκτεινε, μη δημιουργήσεις παράλληλο.

---

## 5. «Ανάμεσα σε 2 στηρίγματα» — big-player + reuse levers
- **Στήριγμα** = κολόνα (`ColumnEntity`) ή τοίχος (`WallEntity`) που ακουμπά τα άκρα του επιλεγμένου τοίχου. Ανίχνευση: reuse geometry helpers (`pointToLineDistance`, column footprints, wall axis) — **ΜΗΝ** γράψεις νέα intersection math· δες `derive-beam-support.ts`, column footprint builders (`buildColumnFootprints` στο `dxf-renderer-frame-builders.ts`), face-snap (ADR-398).
- Αν Giorgio διαλέξει (Β) support-to-support: το δοκάρι = προβολή του άξονα τοίχου, trimmed/extended στα κέντρα (ή παρειές) των 2 στηριγμάτων. Reuse `completeBeamFromTwoClicks` με τα υπολογισμένα start/end — **όχι** νέο builder.
- Auto-attach κορυφής τοίχου: **ήδη** μέσω `useStructuralAutoAttach` (μην το αναπαράγεις).

---

## 6. Τι ΝΑ ΜΗΝ κάνεις
- ❌ Μη γράψεις νέο beam builder/geometry — υπάρχει `completeBeamFromTwoClicks` + `buildBeamFromWall`.
- ❌ Μη σπάσεις το 3D path (`bim:beam-from-wall-picked-3d` bridge) — 2D & 3D μοιράζονται τον ΙΔΙΟ commit core.
- ❌ Μην αναπαράγεις το wall-top auto-attach (ADR-401 D).
- ❌ Μην commit/push. ❌ Μην τρέξεις tsc. ⚠️ Working tree κοινό με άλλον agent (πρόσφατα: WallMergeCommand/WallSplitCommand από άλλον agent· uncommitted dimension fixes ADR-362/ADR-040 από εμένα).

---

## 7. Verification (όταν φτάσεις εκεί)
- **jest** στοχευμένα: `beam-from-wall`, `useBeamTool`, `use-bim3d-beam-from-wall-pick`, `derive-beam-support` (ό,τι αγγίξεις).
- **Browser (Giorgio):** ενεργοποίηση «Δοκάρι από τοίχο» → κλικ σε τοίχο ανάμεσα σε 2 κολόνες/τοίχους → δοκάρι πάνω από τον τοίχο (2D **και** 3D), ο τοίχος κονταίνει στην κορυφή, elevation σωστό.
- Update **ADR-363** §«Δοκάρι από τοίχο» (+ ADR-401 D αν αγγίξεις auto-attach, + ADR-398 αν support-snap) + changelog. Co-stage αν αγγίξεις canvas drawing files (CHECK 6B/6D).

---

## 8. Context (πρόσφατο, uncommitted, κοινό tree)
- **Δικές μου uncommitted αλλαγές (ADR-362/ADR-040, 2026-07-03):** διαστάσεις — culling (`dimension-cull-bounds.ts` + `getEntityBBox case 'dimension'`), marquee select (`selection-duplicate-utils.ts` unwrap), select-similar-by-color (dim DIMSTYLE color). **Άσχετες** με beam-from-wall — μην τις αγγίξεις.
- **Άλλος agent:** `WallMergeCommand.ts` / `WallSplitCommand.ts` (git status) — **μην τα αγγίξεις**.
- Μοτίβο-μάθημα από τις διαστάσεις: πρόσεχε **wrapper vs flat** (DxfWall.params top-level vs WallEntity) — ίδια κατηγορία bug μπορεί να κρύβεται στο pick.
