# ADR-568 — Γεφύρωση Τοίχων με Αυτόματο Κούφωμα (Wall Gap → Bridge + Opening)

**Status:** ✅ 🟢 IMPLEMENTED (UNCOMMITTED) — 2026-07-03
**Domain:** DXF Viewer · BIM · Wall Editing · Openings
**Related:** ADR-566 (Ένωση Τοίχων — ο αδελφός/mirror) · ADR-363 (BIM drawing / Openings §5.4) · ADR-390 (symmetric create/undo — `CreateBimEntityCommand`) · ADR-040 (canvas perf / wiring) · ADR-527 (SceneManager adapter)

---

## 1. Context / Πρόβλημα

Δύο **ομοαξονικοί** τοίχοι που **απέχουν** μεταξύ τους (κενό ανάμεσα — «1» & «2» από
screenshot 2026-07-03 171856). Ο χρήστης θέλει **ΜΙΑ εντολή** που:
- γεφυρώνει τους δύο σε **ΕΝΑΝ ενιαίο συνεχόμενο τοίχο**, και
- τοποθετεί **αυτόματα ένα πραγματικό BIM κούφωμα** (`OpeningEntity`) μέσα στο κενό:
  **πλάτος = η απόσταση (κενό)** των δύο τοίχων, **ύψος = ΝΟΚ**, ενώ **από πάνω μένει
  τοίχος = υπέρθυρο/lintel** (ο ενιαίος τοίχος καλύπτει το άνω μέρος του πρώην κενού).

Δηλαδή Revit «Wall + hosted door/window» — ΟΧΙ δύο κομμάτια. Ξεχωριστή εντολή από την
«Ένωση Τοίχων» (ADR-566), με δικό της κουμπί δίπλα της.

## 2. Big-player research (100% ειλικρίνεια)

- **Revit:** ένα Wall φιλοξενεί door/window ως hosted opening (cutout)· ο τοίχος πάνω από
  το κούφωμα είναι το lintel. Δεν υπάρχει one-click «merge 2 walls + door», αλλά η δομή
  «single wall + hosted opening» είναι ακριβώς το ζητούμενο μοντέλο.
- **AutoCAD:** `JOIN` γεφυρώνει συγγραμμικά με κενό (η βάση του ADR-566). Δεν έχει BIM opening.
- **Απόφαση:** συνδυασμός = **AutoCAD JOIN (ADR-566) + Revit hosted opening (ADR-363)**. Η
  εντολή είναι **λεπτή επέκταση** του merge· μηδέν νέα γεωμετρία/command/persistence πέρα από
  τον υπολογισμό του κενού.

## 3. Απόφαση — αρχιτεκτονική (FULL SSoT, 100% reuse)

**Κρίσιμο εύρημα recognition (κώδικας = αλήθεια):** ο merge (ADR-566) **ήδη γεφυρώνει κενό**
— `buildMergedWallParams` απλώνει outer-to-outer «covers touch + overlap + gap alike». Άρα η
νέα εντολή = ίδιο gate + ίδιο merge + ίδιο command/persistence, **συν** ένα κούφωμα στο κενό.

| Layer | NEW / REUSE |
|-------|-------------|
| Gap geometry | **NEW** `computeWallGap(a,b)` στο `bim/walls/wall-merge.ts` (reuse private `wallAxis`/`scalarAlong`) |
| Opening params | **NEW** `bim/walls/wall-gap-opening.ts` → `buildGapOpeningParams(mergedId, gap)` |
| Opening entity | **REUSE** `buildOpeningEntity` (`hooks/drawing/opening-completion.ts`) → validate + `computeOpeningGeometry` + `createOpening` (id/ifcType/ifcGuid) + `resolveAutoOpeningTypeId` |
| ΝΟΚ ύψος/στηθαίο | **REUSE** `OPENING_KIND_DEFAULTS['door']` (2100/0) — **κανένα νέο config** |
| Tool (FSM) | **NEW** `hooks/tools/useWallGapOpeningTool.ts` (mirror `useWallMergeTool`) |
| Merge command | **REUSE** `WallMergeCommand` (undoable) — γεφύρωση τοίχων |
| Opening finalization | **REUSE** `buildOpeningResolvers(levelManager).onOpeningCreated(entity)` (`useSpecialTools-opening.ts`) — **το ίδιο SSoT path με το opening tool + ADR-533 detector**: host re-cut (2Δ ΚΑΙ 3Δ) + full geometry με hinge arc + sync `drawing:entity-created` |
| Persistence τοίχου | **REUSE** event `bim:wall-merge-committed` → `useWallMergePersistence` |
| Persistence κουφώματος | **REUSE** `drawing:entity-created` (εκπέμπει το `onOpeningCreated`) → `OpeningPersistenceHost` + 3Δ sync |

**⚠️ Γιατί ΟΧΙ `CreateBimEntityCommand` για το κούφωμα (διορθώθηκε 2026-07-03):** το bare
`CreateBimEntityCommand` (α) ψήνει το `hostedOpeningIds` στη δημιουργία → **κανένα re-cut** του
host, (β) εκπέμπει **deferred** (microtask). Αποτέλεσμα: μερικό geometry (outline/cutout/label
ναι, αλλά **χωρίς hingeArc → χωρίς τεταρτημόριο φοράς** — `drawSwing` bail-out) + **κανένα 3Δ**
(`Bim3DEntitiesStore.openings` δεν το έπαιρνε ποτέ). Το `onOpeningCreated` δημιουργεί **νέο wall
object** (spread) → re-cut cascade που ξαναϋπολογίζει πλήρες geometry (arc) 2Δ+3Δ + σύγχρονη
εκπομπή. Γι' αυτό το proven path είναι **υποχρεωτικό** εδώ.

### `computeWallGap(a, b): WallGap | null`
Προβάλλει τα δύο άκρα κάθε τοίχου στον άξονα του πρωτεύοντος (`a`) → διαστήματα `[aLo,aHi]` /
`[bLo,bHi]`. **Κενό υπάρχει ΜΟΝΟ όταν τα διαστήματα είναι ξένα** (disjoint)· επαφή / επικάλυψη /
εμπεριοχή → `null`. Επιστρέφει `{ gapMm, openingOffsetFromMergedStart }` όπου το offset είναι από
την αρχή του ενιαίου τοίχου (`buildMergedWallParams` ξεκινά στο `min(aLo,bLo)`).

### Κανόνες
- **Πύλη:** `canMergeWalls` (collinear-only + ίδιο πάχος)· μη-ομοαξονικοί → typed block hint
  (reuse `wallMerge.blocked.*`). (ΔΕΝ χρησιμοποιεί `classifyWallJoin` — η γωνία L δεν έχει νόημα εδώ.)
- **`MIN_GAP_FOR_OPENING_MM = 400`:** κενό ≥ 400 → merge **+ κούφωμα** (πλάτος = κενό)· κενό < 400 ή
  επαφή/επικάλυψη → **απλή γεφύρωση** (σκέτο merge, χωρίς κούφωμα). Σκληρό πάτωμα: `MIN_OPENING_WIDTH_MM` (200).
- **Τύπος:** default **πόρτα** (doorway = η αρχιτεκτονική σημασία κενού σε σειρά τοίχου). Το «auto
  βάσει ύψους» είναι εκφυλισμένο (το ύψος το ορίζουμε εμείς). Παραμετρικό `kind` για μελλοντικό παράθυρο.
- **Lintel:** αυτόματο — κούφωμα 2100 σε τοίχο 3000 → 900mm τοίχος από πάνω (η `computeOpeningGeometry`
  κόβει μόνο [sill, sill+height]).

### Dual-flow (Revit/AutoCAD parity, mirror ADR-566)
- **(Α) command-first:** πάτα «Γεφύρωση με Κούφωμα» → κλικ τοίχο 1 → κλικ τοίχο 2 → γεφύρωση (loop).
- **(Β) selection-first:** επίλεξε 2 → πάτα το κουμπί → γεφύρωση αμέσως. ESC → 'select'.

## 4. Files

**NEW:** `bim/walls/wall-gap-opening.ts` · `hooks/tools/useWallGapOpeningTool.ts` ·
`bim/walls/__tests__/wall-gap-opening.test.ts` (13 tests).
**MODIFIED:** `bim/walls/wall-merge.ts` (+`computeWallGap`/`WallGap`/`MIN_GAP_FOR_OPENING_MM`) ·
`ui/toolbar/types.ts` · `systems/tools/tool-definitions.ts` · `ui/ribbon/data/contextual-wall-tab.ts` ·
`ui/ribbon/components/buttons/RibbonButtonIcon.tsx` · `hooks/tools/useModifyTools.ts` ·
`components/dxf-layout/CanvasSection.tsx` (⚠️ CHECK 6B → ADR-040 staged) ·
`hooks/canvas/useCanvasClickHandler.ts` (+`canvas-click-types.ts`) ·
`hooks/canvas/useCanvasEscapeRegistrations.ts` (+`useCanvasKeyboardShortcuts.types.ts`) ·
`i18n/locales/{el,en}/dxf-viewer-shell.json` (`wallGapOpening.*` + `ribbon.commands.wallEditor.gapOpening`).

## 5. Γνωστό χρέος
- **Scene-helpers duplication:** τα scene-helpers (findWallAtPoint/collectSelectedWalls/getScene…)
  είναι ήδη 2× διπλότυπα μεταξύ `useWallMergeTool` + `useWallSplitTool`· ο νέος hook τα κάνει 3×.
  Follow-up (pending-ratchet): εξαγωγή `useWallPickScaffold` κοινό και για τους 3. Δεν έγινε τώρα
  (scope + shared just-committed tree).
- **Undo tradeoff (γνωστό, αποδεκτό):** η γεφύρωση είναι undoable `WallMergeCommand`, αλλά το
  `onOpeningCreated` **δεν** είναι undoable command (όπως ΟΛΑ τα κουφώματα της εφαρμογής — opening
  tool + ADR-533 detector). Άρα Ctrl+Z της γεφύρωσης επαναφέρει τους 2 τοίχους αλλά **αφήνει
  ορφανό το κούφωμα**. Follow-up: wrap του `onOpeningCreated` σε undoable command (κοινό για όλα τα
  opening paths, όχι μόνο εδώ).

## 6. Verification
- jest: `wall-gap-opening.test.ts` (13/13) — gap/overlap/touch/containment/reversed/vertical +
  buildGapOpeningParams (width=gap, offset, door ΝΟΚ defaults).
- Browser (Giorgio): 2 ομοαξονικοί με κενό ~90cm → κουμπί → ΕΝΑΣ τοίχος + πόρτα 900×2100 στο κενό,
  υπέρθυρο πάνω, **2D με τεταρτημόριο φοράς (swing arc) + ορατή στο 3D (cutout + door mesh)**· κενό
  <40cm → σκέτη ένωση· μη-ομοαξονικοί → block hint. Δοκίμασε ΚΑΙ σε **γεωαναφερμένη κάτοψη (~17M)**.
  **Ctrl+Z:** επιστρέφουν οι 2 τοίχοι αλλά το κούφωμα μένει ορφανό (γνωστό όριο §5).

## 7. Render fix — openings culled σε γεωαναφερμένα DXF (DB-verified)
Στο browser test (γεωαναφερμένη κάτοψη ~1.71e7): ο τοίχος έδειχνε την **τρύπα** αλλά το **κούφωμα ήταν αόρατο**. **Τα δεδομένα ήταν σωστά** (DB: `opening_acc2892d` width 699.999 στον merged τοίχο στο 17.137.018 / ~4.190.467) — καθαρά **cull bug**: το `getEntityBBox` δεν είχε `case 'opening'`, οπότε το φωλιασμένο `openingEntity.geometry.bbox` δεν διαβαζόταν → `FULL_PLANE_BBOX [±1e6]` → cull στο 1.71e7. Fix στο `canvas-v2/dxf-canvas/dxf-viewport-culling.ts` (NEW `case 'opening'` → nested bbox, mirror `case 'stair'`) + 3 jest. Πλήρες σκεπτικό: **ADR-040 changelog 2026-07-03**. Το tool coordinate/creation logic ήταν **εξαρχής σωστό** (επαληθεύτηκε από τη ΒΔ).

## 8. 3D fix — σώμα κουφώματος αόρατο σε mm-scenes (runtime-verified με console diagnostics)
Live diagnostics (Giorgio, γεωαναφερμένη κάτοψη): το κούφωμα ήταν **σωστό scene entity**
(`openingInScene=true`, `sceneUnits=mm`, `hingeArcPts=13`), **έφτανε** στο 3Δ store
(`setOpenings count=1`) και **περνούσε** το visibility filter (`afterVisibilityFilter=1`, `hasPos=true`)
— άρα έφτανε μέχρι το `wallToMesh`. Το κόψιμο (void) του τοίχου φαινόταν· το **σώμα** (κάσα+φύλλο) όχι.

**Ρίζα:** το `bim-3d/converters/opening-mesh.ts` (`buildOpeningMesh`, ADR-421 §A6) υπέθετε **«scene-units == meters»**:
- οριζόντιες διαστάσεις: `value(mm) × mmToSceneUnits(units)` — για `units='mm'` δίνει `×1` → **700 αντί 0.7 m**.
- τοποθέτηση: `group.position.set(pos.x, …)` **ακλιμάκωτο** — `pos` σε scene-units (mm) → **17.137.018 αντί 17.137 m**.

Το φύλλο έβγαινε **1000× μεγαλύτερο ΚΑΙ ~1000× πιο μακριά** από τον τοίχο → εκτός κάδρου (αόρατο). Δούλευε
μόνο σε **m-scenes** (όπου `mmToSceneUnits('m')=0.001=MM_TO_M` και `pos` ήδη σε meters).

**Fix (ADR-462 parity με το wall path):** τα `params` είναι ΠΑΝΤΑ mm → οριζόντιες διαστάσεις με σταθερό
`× MM_TO_M`· η τοποθέτηση με `× sceneToM = sceneUnitsToMeters(units)` (όπως `scalePoints(quad, sceneToM)`
του τοίχου). Μηδέν regression σε m-scenes (ταυτόσημες τιμές). +1 jest (`mm-scene scaling`, θέση 17M→17137 m
+ σώμα ~0.9 m). Ένα αρχείο (`opening-mesh.ts`)· επηρεάζει **ΟΛΑ** τα 3Δ κουφώματα σε mm/γεωαναφερμένες κατόψεις.

**Σημ.:** το «λείπει swing arc σε 2Δ» ΔΕΝ ήταν bug — ήταν το **cut-plane slider** (view range) του χρήστη
στα 3000mm, πάνω από την πόρτα (0–2100) → `cutState='projection'`. Κατέβασμα < 2100 → εμφανίζεται το τόξο.

## Changelog
- **2026-07-03** — Αρχική υλοποίηση (UNCOMMITTED). Big-player + FULL SSoT reuse του merge pipeline.
- **2026-07-03** — Render fix: openings culled σε γεωαναφερμένα DXF (`getEntityBBox` missing `case 'opening'`). Βλ. §7 + ADR-040.
- **2026-07-03** — **Opening finalization fix:** το gap-opening δημιουργούνταν με `CreateBimEntityCommand` (bake host + deferred emit) → **χωρίς swing arc σε 2Δ + καθόλου 3Δ**. Αντικαταστάθηκε με το proven SSoT path `buildOpeningResolvers(levelManager).onOpeningCreated(entity)` (host re-cut + full geometry με hingeArc + sync `drawing:entity-created`). `LevelManagerLike` → full `LevelsHookReturn`. DROP `CreateBimEntityCommand`/`CompositeCommand`. Undo tradeoff τεκμηριωμένο (§5). Βλ. §3 πίνακα.
- **2026-07-03** — **3D body fix (§8):** `opening-mesh.ts buildOpeningMesh` υπέθετε scene-units==meters → σε mm/γεωαναφερμένες κατόψεις το σώμα κουφώματος 1000× μεγάλο & ~1000× μακριά (αόρατο). Fix: οριζόντιες διαστάσεις `× MM_TO_M`, τοποθέτηση `× sceneToM` (ADR-462 parity). +1 jest. Επηρεάζει ΟΛΑ τα 3Δ κουφώματα (ADR-421 §A6), όχι μόνο gap-openings. Το «λείπει 2Δ τόξο» = cut-plane slider χρήστη (όχι bug).
