# HANDOFF — ADR-441 GRID-GEN-BEAM: «Δοκάρια από κάναβο» (beams on grid)

**Date:** 2026-06-12 · **Branch:** main · **Μοντέλο: Opus** · **Shared working tree** (άλλοι agents δουλεύουν ταυτόχρονα — ειδικά ένας **icon-agent** στο `ui/ribbon/data/structural-tab.ts` + `structural-tab.test.ts`· **ΜΗΝ τα αγγίξεις πέρα από το δικό σου ένα κουμπί· git add ΜΟΝΟ δικά σου hunks, ΠΟΤΕ `git add -A`**)

> 🎯 **ΕΝΤΟΛΗ GIORGIO (διαρκής):** «όπως οι μεγάλοι, όπως η Revit. FULL ENTERPRISE + FULL SSoT.» Απάντα **ΕΛΛΗΝΙΚΑ**.
>
> ⚠️ **ΚΑΝΟΝΕΣ:** Ο Giorgio κάνει commit/push — **ΠΟΤΕ εσύ** (N.(-1)). N.8 (5+ files/2+ domains→ρώτα mode). N.14 (δήλωσε μοντέλο πριν κώδικα). N.17 (ΕΝΑ tsc τη φορά — έλεγξε process πρώτα). function ≤40γρ, file ≤500γρ, no `any`, i18n ICU single-brace `{var}` (όχι hardcoded, όχι `{{var}}`). N.0.1 ADR-driven (Phase 1 recognition ΠΡΩΤΑ).

---

## 0. ΣΤΟΧΟΣ

Ολοκληρώνουμε τη GRID-FIRST ανέγερση (§8 ADR-441). Έχουμε ήδη «από κάναβο» γένεση για:
**πεδιλοδοκούς** (εσχάρα), **κολώνες** (τομές), **τοίχους** (segments), **συνδετήριες** (segments, GEN-TIE).
**ΕΠΟΜΕΝΟ = ΔΟΚΑΡΙΑ (structural `beam`) από κάναβο** — γραμμικά, ένα δοκάρι ανά segment άξονα, born-bound, idempotent.

**Μετά (DEFER, χωριστό round):** GEN-SLAB (πλάκες — πολύγωνο, σχεδιαστική απόφαση start/end/center δεν ταιριάζει).

---

## 1. ⚠️ ΤΙ ΛΕΙΠΕΙ ΕΙΔΙΚΑ ΓΙΑ ΤΑ ΔΟΚΑΡΙΑ (το κρίσιμο που τα ξεχωρίζει)

Σε αντίθεση με τις συνδετήριες (που ήταν `FoundationEntity` με έτοιμο hosting+persistence+junction), **το beam hosting ΔΕΝ υπάρχει**:

- **ΛΕΙΠΕΙ NEW `bim/hosting/beam-hosting-strategy.ts`** — ο registry `bim/hosting/hosting-strategy.ts` έχει ΜΟΝΟ `foundation`/`column`/`wall`. Χωρίς beam strategy, τα δοκάρια **ΔΕΝ ακολουθούν** τον άξονα στο follow-move.
  1. NEW `beam-hosting-strategy.ts` = **ακριβές mirror `wall-hosting-strategy.ts`** (line slots → start/end via `deriveLineSlots`· `computeBeamGeometry`· `validateBeamParams`· outline από beam footprint).
  2. Πρόσθεσε `beam: beamHostingStrategy` στο `STRATEGIES` (`hosting-strategy.ts`).
  3. **Persistence guideBindings round-trip** (mirror wall/column στο commit `f992df62`): `beam-firestore-service` save/load (`BeamUpdateInput`+`updateBeam` αν χρειάζεται +`guideBindings`) + `useBeamPersistence` docToEntity restore. **ΠΡΟΣΟΧΗ:** χωρίς αυτό, ο born-bound δοκός χάνει τα bindings μετά reload → δεν ακολουθεί.
  4. (προαιρετικό, συνεπές) host-on-snap στο beam draw tool (mirror `resolveWallGridBindings` στο `use-wall-commit`).

- **ΥΠΑΡΧΕΙ ήδη:** `hooks/drawing/beam-completion.ts` (`buildDefaultBeamParams`/`buildBeamEntity`)· `bim/beams/add-beam-to-scene.ts` (emit `drawing:entity-created` tool=`'beam'`)· `beam-from-wall.ts` (mirror foundation-from-wall)· `beam-firestore-service.ts`· grips/geometry/3Δ όλα live.

---

## 2. ΤΟ PATTERN «ΑΠΟ ΚΑΝΑΒΟ» (REUSE — ζωντανό πρότυπο = GEN-TIE που μόλις έγινε)

Ακολούθησε **ΑΚΡΙΒΩΣ** το recipe των GEN-TIE/GEN-WALL (committed/staged):

### 2A. Pure builder `bim/beams/beam-from-grid.ts`
- **REUSE ΑΥΤΟΥΣΙΟ** `enumerateGridStrips(axes, cb, mode)` + `gridAxesFromReader(reader, minPerAxis=2)` από `bim/foundations/foundation-from-grid.ts` — τα strip bindings (`start/end-x/y`) είναι ΑΚΡΙΒΩΣ τα slots των γραμμικών (το έκαναν ήδη τοίχοι & συνδετήριες).
- Πρότυπο: `bim/walls/wall-from-grid.ts` (το πιο κοντινό — γραμμικό, μη-foundation). Born-bound: `{ ...entity, guideBindings }`.
- Centerline δοκαριού ΠΑΝΩ στον άξονα (Revit beam-on-grid).

### 2B. Orchestrator `bim/beams/beam-grid-commit.ts`
- **Create-only idempotent** (mirror `wall-grid-commit.ts` / `tie-beam-grid-commit.ts`): skip ανά segment key. Για το key χρησιμοποίησε είτε `gridWallKey` style (sorted node-pair) είτε — αν θες SSoT — δες αν το `segmentKeyFromBindings` (foundation-grid-segments) ταιριάζει (είναι γενικό για bindings· δούλεψε για τις συνδετήριες).
- Reuse `CreateBeamsCommand` (βλ. 2C).

### 2C. Batch command `core/commands/entity-commands/CreateBeamsCommand.ts`
- **ΑΚΡΙΒΕΣ mirror** `CreateWallsCommand`/`CreateFoundationsCommand` (staged). **ΚΡΙΣΙΜΟ:** deferred-microtask `EventBus.emit('drawing:entity-created', { entity, tool: 'beam' })` (ΟΧΙ `CompoundCommand<CreateEntityCommand>` — δεν persist-άρει). undo → `bim:beam-delete-requested` (grep το ακριβές event στο `useBeamPersistence`).

### 2D. Ribbon wiring (FULL SSoT)
- `beam-command-keys.ts` (αν υπάρχει· αλλιώς grep πώς το κάνει το beam bridge): +`beam.actions.fromGrid` + ενημέρωσε `isBeamActionKey`.
- `useRibbonBeamBridge.ts`: `handleFromGrid` (run commit· module-level toast emitter) + `onAction` routing.
- `ui/ribbon/data/structural-tab.ts`: **+1 `actionBtn`** στο panel **`structural-beams`** (icon `struct-beam-from-grid` unique· δες πώς μπήκε το tie-beam κουμπί στο `structural-foundation`). **Shared με icon-agent → git add ΜΟΝΟ το δικό σου hunk· ενημέρωσε `structural-tab.test.ts` EXPECTED_COMMAND_KEYS + composed-icon list + «από κάναβο» list.**
- `systems/events/drawing-event-map.ts`: `bim:beams-from-grid` + `-failed`.
- `hooks/useDxfViewerNotifications.ts`: toast handlers (ICU).
- i18n `el/en/dxf-viewer-shell.json`: `beamGrid.*` + ribbon label `beamsFromGrid`.

### 2E. Tests
- `beam-from-grid.test.ts` (πλήθος, born-bound bindings) + `beam-grid-commit.test.ts` (idempotent: all-create/up-to-date/partial/insufficient). Πρότυπα: `wall-from-grid.test.ts`, `tie-beam-grid-commit.test.ts`.
- `beam-hosting-strategy` test (mirror `wall-hosting-strategy` test στο `bim/hosting/__tests__/hosting-strategy.test.ts`).

---

## 3. ΣΧΕΔΙΑΣΤΙΚΕΣ ΑΠΟΦΑΣΕΙΣ (πάρ' τες μόνος, Revit-grade· ζήτα μόνο έγκριση plan — N.14)

1. **Junction-miter στις γωνίες/Τ;** Το `computeGridJunctionExtends` (foundation-grid-junctions) είναι **foundation-only** (δουλεύει σε `FoundationEntity`, kind strip/tie-beam). Τα δοκάρια ΔΕΝ είναι foundations.
   - **ΣΥΣΤΑΣΗ v1 = create-only ΧΩΡΙΣ auto-miter** (parity με GEN-WALL· follow-move δωρεάν μέσω hosting strategy). Τα structural beams στη Revit κάνουν **frame-into** σε στηρίξεις (join/disjoin at columns), ΟΧΙ monolithic corner-fill σαν θεμελίωση → το miter εδώ είναι διαφορετικό πρόβλημα. **DEFER beam-join** (χωριστό slice, με beam↔column trim ιδέα `wall-column-trim.ts`).
   - Αν ο Giorgio θέλει «κλειστές γωνίες» και στα δοκάρια → ξεχωριστή συζήτηση (beam framing vs monolithic).
2. **Elevation:** τα δοκάρια ζουν σε στάθμη ορόφου/πλάκας (ΟΧΙ −1000 σαν θεμελίωση). **Ελεγξε** τα beam defaults (`beam-completion.ts`) — μάλλον σωστά ήδη, μην τα πειράξεις χωρίς λόγο. (Μάθημα GEN-TIE: είχαμε bug όπου η συνδετήρια είχε ίδιο υψόμετρο με την πεδιλοδοκό → fix `defaultFoundationTopElevationMm`. Τα δοκάρια ΔΕΝ έχουν αυτό το θέμα — διαφορετικό entity/elevation model.)
3. **Beam→column face-trim:** όπως οι τοίχοι (`wall-column-trim.ts`), τα δοκάρια συνήθως πατούν σε κολώνες. Reuse την ιδέα (extend στην παρειά) — **DEFER αν δεν το ζητήσει**, v1 = centerline στον άξονα.

---

## 4. ΠΑΓΙΔΕΣ / ΜΑΘΗΜΑΤΑ (από GEN-TIE/GEN-WALL/εσχάρα)

- **Persistence trigger:** batch command ΠΡΕΠΕΙ deferred `drawing:entity-created` (όχι `CreateEntityCommand` — δεν persist-άρει). Μάθημα εσχάρας.
- **Hosting persistence gap:** ο born-bound χάνει bindings μετά reload αν το beam-firestore-service **update** path δεν κάνει round-trip το `guideBindings` (μάθημα wall/foundation Slice 6b). Verify με DB read μετά.
- **Idempotent key = binding guide-ids** (coordinate-free) → ξανα-πάτημα no-op.
- **Shared tree icon-agent:** `structural-tab.ts/.test.ts` αλλάζει παράλληλα· πρόσθεσε `struct-*` unique icon· `git add` ΜΟΝΟ δικά σου hunks.
- **N.17 tsc:** ΠΡΙΝ tsc έλεγξε process (`Get-CimInstance Win32_Process | where CommandLine -like '*tsc*'`). Filtered + background.

---

## 5. DB ANCHORS (project pagonis-87766, read-only MCP firestore — verify με baseline→generate→re-query)
- company `comp_9c7c1a50-…-757` · project `proj_3a8e2b2c-…-c57` · floorplan `file_32a7a4fb-a2df-4b82-a391-761241152478` · floor `flr_161aa890-…` · level `lvl_b997c956-…`.
- **Δοκάρια → `floorplan_beams`** (όχι foundations!). ID prefix beam (grep `generateBeamId`). Άξονες κανάβου (3×3 του test floorplan): X guideIds `be38435f`(10.75)/`7baf5045`(15.89)/`b6d02652`(22.99)· Y `593441c0`(3.31)/`f79075c9`(9.36)/`6b277b97`(15.51).
- **Verification protocol (Giorgio το θέλει):** baseline T0 (count) → generate → T1 → ανάλυσε άξονες/bindings/extend στα termini/«Τ»/«+» → σύγκρινε με Revit parity (miter μόνο termini, pass-through crossings).

---

## 6. ΚΑΤΑΣΤΑΣΗ REPO (αρχή νέας συνεδρίας) — 🔴 UNCOMMITTED, ΜΗΝ ΤΑ ΞΑΝΑΚΑΝΕΙΣ/REVERT

Η **GEN-TIE είναι DONE + tsc καθαρό + 152 jest + DB-verified (corners/T/+/parity OK)**, αλλά **UNCOMMITTED** (ο Giorgio committαρει). Αρχεία αυτής της συνεδρίας (ΜΗΝ τα πειράξεις χωρίς λόγο):
- NEW `bim/foundations/tie-beam-grid-commit.ts` (+test)
- `bim/foundations/foundation-from-grid.ts` (kind param), `foundation-grid-commit.ts` (kind-partition guard), `__tests__/foundation-from-grid.test.ts`
- `bim/foundations/foundation-grid-junctions.ts` — **ΔΕΝ άλλαξε** (reuse· kind='tie-beam' υποστηριζόταν ήδη)
- `bim/types/foundation-types.ts` (`DEFAULT_TIE_BEAM_TOP_ELEVATION_MM=-500` + `defaultFoundationTopElevationMm`) (+test), `hooks/drawing/foundation-completion.ts` (kind-aware elevation)
- `ui/ribbon/hooks/bridge/foundation-command-keys.ts`, `useRibbonFoundationBridge.ts`, `ui/ribbon/data/structural-tab.ts`(+test, **shared icon-agent**)
- `systems/events/drawing-event-map.ts`, `hooks/useDxfViewerNotifications.ts`, i18n el/en
- docs: `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`, `ADR-441` changelog, MEMORY `project_adr441_foundation_strip_grid.md`

**Πιθανά `[ORTHO-DBG]` / icon `struct-*` άλλων πρακτόρων — ΜΗΝ τα αγγίξεις.**

---

## 7. DOCS ΝΑ ΕΝΗΜΕΡΩΣΕΙΣ (N.15, ίδιο commit με κώδικα)
`local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (γραμμή GEN-BEAM — μόνο τι εκκρεμεί)· `ADR-441` changelog+§8· MEMORY `project_adr441_foundation_strip_grid.md`. **ΜΗΝ** `adr-index` (shared tree).

## 8. REF
- Πρότυπα: `bim/walls/wall-from-grid.ts` + `wall-grid-commit.ts` + `wall-hosting-strategy.ts` (ΤΟ ΠΡΟΤΥΠΟ hosting)· `bim/foundations/tie-beam-grid-commit.ts` (GEN-TIE create-only) · `core/commands/entity-commands/Create{Walls,Foundations}Command.ts` · `bim/hosting/hosting-strategy.ts` (registry) · `bim/hosting/derive-slots.ts` (`deriveLineSlots`).
- Beam-specific: `hooks/drawing/beam-completion.ts`, `bim/beams/add-beam-to-scene.ts`, `bim/beams/beam-from-wall.ts`, `beam-firestore-service.ts`, beam types.
- MEMORY: `project_adr441_foundation_strip_grid.md` (πλήρες ιστορικό + GEN-TIE) · `reference_grid_hosting_strategy_ssot.md` · `reference_2d_dxf_pipeline_bim_entity.md`.
- ADR-441 §8 (GRID-FIRST όραμα) · §10 (slice plan).
