# HANDOFF — ADR-401 · Wall-top γωνιακή διασταύρωση: καθαρά κομμάτια (face-crossing breakpoints + clip)

- **Ημερομηνία**: 2026-06-01
- **Συντάκτης**: Claude (Opus 4.8)
- **Για**: ΝΕΑ συνεδρία (καθαρό context) — **geometry bugfix** στο 3D wall-top clip. ΟΧΙ νέα feature.
- **🎯 Μοντέλο (N.14)**: **Opus** — geometry, ~3 αρχεία, cross-cutting στο wall-solid pipeline.
- **⚠️ COMMIT/PUSH**: **ΤΑ ΚΑΝΕΙ Ο GIORGIO**, ΟΧΙ ο agent. Stage μόνο τα δικά σου hunks.
- **🚨 Multi-agent**: το working tree **μοιράζεται με άλλον agent (ADR-363 «from-perimeter walls»)**. ΜΗΝ αγγίξεις τα δικά του (πολλά uncommitted: `ribbon-contextual-config.ts`, `wall-from-entity.ts`, `dxf-canvas-renderer.ts`, `useCanvasClickHandler.ts`, `use-wall-commit.ts`, `useWallTool.ts`, `wall-tool-types.ts`, `useSpecialTools.ts`, `useDxfViewerNotifications.ts`, `mouse-handler-move/up.ts`, `useCentralizedMouseHandlers.ts`, `EventBus.ts`, `tool-definitions.ts`, `home-tab-draw.ts`, `toolbar/types.ts`, `adr-index.md`, `ADR-363*.md`, i18n `dxf-viewer-shell.json`, νέα `bim/walls/perimeter-from-faces.ts` + tests + handoffs). Stage **μόνο** τα δικά σου.

---

## 0. ΠΡΩΤΟ ΒΗΜΑ
`"C:\Program Files\Git\cmd\git.exe" log --oneline -5` και `git status`. Τα ADR-401 αρχεία είναι **uncommitted** (ο Giorgio θα κάνει commit). ΜΗΝ υποθέσεις τι έγινε push.

---

## 1. ΤΟ ΠΡΟΒΛΗΜΑ (Giorgio live, 2026-06-01)

**Σενάριο που ΠΡΕΠΕΙ να δουλεύει:** τοίχος ύψους **3.00m** κάτω από δοκάρι βάθους **0.50m** → ο τοίχος γίνεται **2.50m** (κάτω-παρειά δοκαριού). Μετά **περιστρέφουμε** τον τοίχο ώστε μόνο **μέρος** του να είναι κάτω από το δοκάρι (το δοκάρι τον διασχίζει **υπό γωνία**).

**Αναμενόμενη γεωμετρία — 5 κομμάτια (κάτοψη):**
1. **Δύο ακριανά κομμάτια** (αριστερά/δεξιά, μακριά από το δοκάρι): **ΟΡΘΟΓΩΝΙΑ** σε κάτοψη (ορθογώνιο παραλληλόγραμμο / τετράγωνο), **ύψος 3.00m**.
2. **Δύο τρίγωνα** (καθαρά τρίγωνα) πηγαίνοντας προς το σημείο επαφής με το δοκάρι, **ύψος 3.00m**.
3. **Ένα κεντρικό ρομβοειδές** (κάτω από το δοκάρι), **ύψος 2.50m**.

Δηλαδή σε κάτοψη: `[ορθογώνιο 3m][τρίγωνο 3m]<ρομβοειδές 2.5m>[τρίγωνο 3m][ορθογώνιο 3m]`.

**Σύμπτωμα (ΤΩΡΑ):** τα **δύο ακριανά** κομμάτια **ΔΕΝ είναι ορθογώνια** — βγαίνουν με «διαφορετική διατομή, τραπέζιο ή κάποιο πολύγωνο» (στην πράξη **πεντάγωνα**). Λάθος.

---

## 2. ROOT CAUSE (επιβεβαιωμένο σχεδιαστικά — διάβασε ΚΑΙ τον κώδικα)

Η τρέχουσα υλοποίηση κόβει (clip) το αποτύπωμα του τοίχου με το αποτύπωμα του δοκαριού (σωστή ιδέα), **ΑΛΛΑ** σπάει πρώτα τον τοίχο σε κομμάτια στα σημεία που ο **ΑΞΟΝΑΣ** (κεντρική γραμμή) τέμνει το δοκάρι.

- Το `BimSceneLayer.syncWalls` υπολογίζει `profile = resolveWallTopProfile(makeWallTopContext(start, end, ...))` με **start/end = ο ΑΞΟΝΑΣ** → τα breakpoints είναι οι τομές **του άξονα** με το δοκάρι (π.χ. `{0.35, 0.75}`).
- Το `wallToMesh` → `makeWallTopLocalFn(profile)` → `wallTop.breakpoints = {0.35, 0.75}`.
- Το `buildStraightWallWithOpenings` → `computeWallOpeningPieces(wall, openings, wallTop, wallBase)` σπάει τον τοίχο σε **`[0,0.35], [0.35,0.75], [0.75,1]`**.
- Μετά κάθε κομμάτι περνά στο `clipWallBandTopRegions` (clip με το δοκάρι).

**Γιατί βγαίνει πεντάγωνο:** οι παρειές του τοίχου τέμνουν το δοκάρι σε **διαφορετικά** σημεία από τον άξονα — π.χ. εξωτερική παρειά `[0.3, 0.7]`, εσωτερική `[0.4, 0.8]` (λόγω πάχους + γωνίας). Το ακριανό κομμάτι `[0, 0.35]` περιέχει λοιπόν μια **τριγωνική μύτη** του δοκαριού (η εξωτερική παρειά είναι κάτω από το δοκάρι στο `[0.3, 0.35]`). Όταν κόβεται με το δοκάρι, το `outside` γίνεται **πεντάγωνο** (ορθογώνιο με τριγωνική εγκοπή στην έξω-δεξιά γωνία), αντί για καθαρό ορθογώνιο.

---

## 3. Η ΛΥΣΗ (σπάσιμο στα FACE crossings, μετά clip)

Σπάσε τον τοίχο στα σημεία που τον τέμνουν **οι ΠΑΡΕΙΕΣ** (όχι ο άξονας) = **union** των τομών εξωτερικής + εσωτερικής ακμής με το δοκάρι (π.χ. `{0.3, 0.4, 0.7, 0.8}`). Μετά κόψε κάθε κομμάτι με το δοκάρι. Τότε:

- `[0, 0.3]`: καμία επικάλυψη δοκαριού → **ορθογώνιο** @3.0 ✓
- `[0.3, 0.4]`: η διαγώνιος ακμή του δοκαριού περνά από `(έξω, 0.3)` σε `(μέσα, 0.4)` → clip → **τρίγωνο @3.0** (καθαρό) + **τρίγωνο @2.5** ✓
- `[0.4, 0.7]`: πλήρως κάτω από δοκάρι → **ορθογώνιο @2.5** (μέρος του ρομβοειδούς) ✓
- `[0.7, 0.8]`: → τρίγωνο @3.0 + τρίγωνο @2.5 ✓
- `[0.8, 1]`: → **ορθογώνιο** @3.0 ✓

Τα `@2.5` κομμάτια (2 τρίγωνα + κεντρικό ορθογώνιο) είναι γειτονικά/συνεπίπεδα → σχηματίζουν το **ρομβοειδές** που περιγράφει ο Giorgio. Τα ακριανά είναι **καθαρά ορθογώνια**, τα ενδιάμεσα **καθαρά τρίγωνα**. Μηδέν πεντάγωνα.

### Πού ακριβώς αλλάζει ο κώδικας
**Το μόνο που λείπει: τα breakpoints να γίνουν FACE crossings αντί axis crossings.** Το clip + ο prism builder είναι ήδη σωστά — απλώς τους δίνεις σωστά σπασμένα κομμάτια.

1. **`bim-3d/scene/BimSceneLayer.ts` → `syncWalls`** (stage μόνο το δικό σου hunk):
   - Διάβασε `wall.geometry.outerEdge.points` / `innerEdge.points` (πρώτο+τελευταίο = `oS,oE,iS,iE`· ίδιο plan space με τα host footprints — επιβεβαιωμένο, το clip ήδη δουλεύει σε αυτό το space).
   - `attachHosts = hostInputs.filter(h => wall.params.attachTopToIds?.includes(h.hostId))`.
   - `breakpoints = union` των `t0/t1` από `buildHostUndersidePlans(oS, oE, attachHosts)` **και** `buildHostUndersidePlans(iS, iE, attachHosts)` (clamp σε `(0,1)`, εσωτερικά μόνο). `buildHostUndersidePlans` είναι ήδη εξαγμένο στο `wall-host-plan-builder.ts`.
   - Πρόσθεσε `breakpoints` στο `topClip` context (νέο πεδίο `readonly breakpoints: readonly number[]` στο `WallTopClipContext` του `wall-top-clip.ts`).

2. **`bim-3d/converters/BimToThreeConverter.ts` → `buildStraightWallWithOpenings`** (stage μόνο δικά σου hunks):
   - Όταν `topClip` υπάρχει, ΜΗΝ σπας στα axis breakpoints. Πέρνα στο `computeWallOpeningPieces` ένα `wallTop` με `breakpoints = topClip.breakpoints` και `at = () => nominalLocalM` (το top αγνοείται — το ξαναϋπολογίζει το clip):
     ```ts
     const clipWallTop = topClip
       ? { breakpoints: topClip.breakpoints, at: () => (topClip.nominalTopMm - floorElevationMm) * 0.001 }
       : wallTop;
     const pieces = computeWallOpeningPieces(wall, openings, clipWallTop, wallBase);
     ```
   - Το υπόλοιπο (clip ανά `topFollowsProfile` piece → `buildColumnPrismGeometry` ανά region) **μένει ως έχει**.

3. **Tests** (`bim-3d/converters/__tests__/wall-top-angled-crossing.test.ts`): πρόσθεσε case που επιβεβαιώνει ότι ένα ακριανό κομμάτι (καμία επικάλυψη) → **ορθογώνιο** (4 vertices, όλα @nominal), και ότι ένα transition κομμάτι → **2 τρίγωνα** (3 vertices το καθένα, ένα @2.5 ένα @3.0). Πιθανώς χρειάζεσαι integration test που να τρέχει το πλήρες `syncWalls`/`buildStraightWallWithOpenings` με rotated wall + beam, μετρώντας τα region polygons.

⚠️ **Fast path**: ίσιος/μη-attached/curved τοίχος = byte-for-byte (καμία αλλαγή· `topClip` undefined → παλιό μονοπάτι).

---

## 4. ΤΙ ΕΧΕΙ ΗΔΗ ΓΙΝΕΙ (μην το ξανακάνεις — pending commit, δικά μου hunks)

Iteration 1 (per-side wedge) **απορρίφθηκε** (έδινε κεκλιμένη κορυφή → τρύπες). Iteration 2 (footprint clip) είναι το τρέχον state:

- **NEW `bim-3d/converters/wall-top-clip.ts`** — `clipWallBandTopRegions(quad, hosts, nominalTopMm, floorElevationMm, baseLocalM)` → επίπεδες/planar περιοχές (inside=∩ @κάτω-παρειά, outside=− @nominal, lower-envelope per region μέσω κεντροειδούς, clamp ≤ nominal). **Σωστό — δεν το αγγίζεις** (μόνο +`breakpoints` στο `WallTopClipContext`).
- **`bim/geometry/shared/safe-polygon-boolean.ts`** — `+ safeDifference` (mirror union/intersection). Σωστό.
- **`bim-3d/converters/wall-opening-pieces.ts`** — `WallOpeningPiece += topFollowsProfile?` (true στα `pushTopPiece`, undefined στη ποδιά). Αφαιρέθηκε η iteration-1 per-side (`atInner`/`zTopAiM`/`zTopBiM`). Σωστό.
- **`bim-3d/converters/BimToThreeConverter.ts`** — `buildStraightWallWithOpenings(..., topClip?)` → clip→`buildColumnPrismGeometry` ανά region· `wallToMesh(..., topClip?)` 8ο όρισμα (ο forbidden `bim3d-preview-rebuild.ts` περνά 7 → ανέγγιχτος). **ΕΔΩ μπαίνει το fix §3.2.**
- **`bim-3d/scene/BimSceneLayer.ts` → `syncWalls`** — χτίζει `topClip = { hosts, nominalTopMm }`. **ΕΔΩ μπαίνει το fix §3.1 (breakpoints).**
- **reuse**: `buildColumnPrismGeometry` (`column-piece-geometry.ts`, per-vertex N-gon prism concave-safe), `hostUndersideAt` (`host-footprint-eval.ts`), `buildHostUndersidePlans` (`wall-host-plan-builder.ts`).
- Tests `wall-top-angled-crossing.test.ts` → **60/60** (7 suites) + tsc **0**. ⚠️ Αλλά **δεν έπιαναν** το πεντάγωνο bug (έλεγχαν το clip με χειροποίητο quad, όχι το end-to-end split). Πρόσθεσε regression για το split.
- **ADR-401 §2.4 + §8 changelog**, `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`, memory `project_adr401_wall_top_constraints.md` ενημερωμένα (περιγράφουν το clip· ενημέρωσέ τα με το breakpoints fix).

---

## 5. RECOGNITION (Phase 1 — διάβασε ΠΡΩΤΑ)
- `bim-3d/scene/BimSceneLayer.ts` `syncWalls` (~γρ.217-260) — πού χτίζεται `profile`/`topClip`.
- `bim-3d/converters/BimToThreeConverter.ts` `buildStraightWallWithOpenings` + `wallToMesh`.
- `bim-3d/converters/wall-top-clip.ts` (το SSoT clip· πρόσθεσε `breakpoints` στο context type).
- `bim/geometry/wall-host-plan-builder.ts` `buildHostUndersidePlans` (η πηγή των face crossings· είναι ΗΔΗ parameterized από arbitrary start/end).
- `bim-3d/converters/wall-opening-pieces.ts` `computeWallOpeningPieces` (πώς `wallTop.breakpoints` → `cutsBetween` → splits· επιβεβαίωσε ότι σπάει μόνο εκεί).

## 6. Refs
- ADR: `docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md` (§2.4 footprint-clip, §8 changelog top entry).
- Memory: `project_adr401_wall_top_constraints.md`.
- Προηγ. handoff: `HANDOFFS/2026-06-01_ADR-401_wall-top-angled-crossing-gap-fix_handoff.md`.

## 7. Verification (στόχος)
1. `npx jest wall-top-angled-crossing wall-opening-pieces wall-stepped-solid wall-base-attach-consumers safe-polygon-boolean column-piece-geometry` → πράσινα· νέο regression για ορθογώνια ακριανά + τρίγωνα.
2. `npx tsc --noEmit` → 0 νέα errors.
3. 🔴 Browser (Giorgio): τοίχος 3m + δοκάρι 0.5m από πάνω → γύρνα τον τοίχο υπό γωνία → «Σύνδεση Κορυφής» → **ακριανά ορθογώνια @3m**, **καθαρά τρίγωνα @3m**, **κεντρικό ρομβοειδές @2.5m**, μηδέν πεντάγωνα/τρύπες· ίσιος (0°) αμετάβλητος.
