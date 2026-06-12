# HANDOFF — ADR-441 GRID-GEN φάση 2: «Πλάκες / Δοκάρια / Συνδετήριες από κάναβο»

**Date:** 2026-06-12 · **Branch:** main · **Μοντέλο: Opus** · **Shared working tree** (άλλοι agents δουλεύουν ταυτόχρονα — ειδικά ένας **icon-agent** στο `structural-tab.ts` + `structural-tab.test.ts`· **ΜΗΝ τα αγγίξεις χωρίς λόγο· git add ΜΟΝΟ δικά σου hunks, ΠΟΤΕ `git add -A`**)

> 🎯 **ΕΝΤΟΛΗ GIORGIO (διαρκής):** «όπως οι μεγάλοι, όπως η Revit. FULL ENTERPRISE + FULL SSoT.» Απάντα **ΕΛΛΗΝΙΚΑ**.
>
> ⚠️ **ΚΑΝΟΝΕΣ:** Ο Giorgio κάνει commit/push — **ΠΟΤΕ εσύ** (N.(-1)). N.8 (5+ files/2+ domains→ρώτα mode). N.14 (δήλωσε μοντέλο πριν κώδικα). N.17 (ΕΝΑ tsc τη φορά — έλεγξε process πρώτα). function ≤40γρ, file ≤500γρ, no `any`, i18n ICU single-brace `{var}` (όχι hardcoded strings, όχι `{{var}}`). N.0.1 ADR-driven (Phase 1 recognition ΠΡΩΤΑ).

---

## 0. ΣΤΟΧΟΣ (Giorgio επέλεξε αυτό ως επόμενο βήμα)

Έχουμε ήδη γενέτειρα «από κάναβο» για **πεδιλοδοκούς/εσχάρα** (strips), **κολώνες** (στις τομές) και **τοίχους** (στα segments). **ΛΕΙΠΟΥΝ 3 οικογένειες:**

1. **ΣΥΝΔΕΤΗΡΙΕΣ ΔΟΚΟΙ από κάναβο** (foundation `kind='tie-beam'`) — γραμμικές, στα segments αξόνων, born-bound. **Ευκολότερο** (≈ reuse εσχάρας με kind override).
2. **ΔΟΚΑΡΙΑ από κάναβο** (structural `beam`) — γραμμικά, στα segments, born-bound. **ΠΡΟΣΟΧΗ: το beam hosting (follow-move) ΔΕΝ υπάρχει ακόμη** — πρέπει να φτιαχτεί πρώτα (`beam-hosting-strategy`).
3. **ΠΛΑΚΕΣ από κάναβο** (`slab` kinds: εδαφόπλακα/δάπεδο/οροφή) — **region/polygon** (ΟΧΙ γραμμικές) → **διαφορετική φύση**, χρειάζεται σχεδιαστική απόφαση (το slot model start/end/center ΔΕΝ ταιριάζει σε πολύγωνο).

**Γιατί τώρα:** το pattern «από κάναβο» είναι πλέον δοκιμασμένο & SSoT (3 οικογένειες live). Αυτές οι 3 ολοκληρώνουν τη GRID-FIRST ανέγερση (§8 όραμα ADR-441).

---

## 1. ΤΟ PATTERN «ΑΠΟ ΚΑΝΑΒΟ» ΠΟΥ ΗΔΗ ΧΤΙΣΤΗΚΕ (REUSE — μην το ξαναβρείς)

Κάθε νέα οικογένεια ακολουθεί **ΑΚΡΙΒΩΣ** αυτό το recipe (δες τα committed/staged αρχεία ως ζωντανό πρότυπο):

### 1A. Pure builder `bim/<family>/<family>-from-grid.ts`
- **Γραμμικά** (tie-beam, beam): REUSE **αυτούσιο** `enumerateGridStrips(axes, cb, mode?)` από `bim/foundations/foundation-from-grid.ts` — τα strip bindings (`start-x/end-x/start-y/end-y`) είναι ΑΚΡΙΒΩΣ τα slots των γραμμικών. Δες `bim/walls/wall-from-grid.ts` (πρότυπο, committed/staged αυτή τη συνεδρία).
- **Σημειακά** (κολώνες): `enumerateGridIntersections` (`bim/columns/column-from-grid.ts`).
- `gridAxesFromReader(reader, minPerAxis)` — minPerAxis=2 για segments (γραμμικά), =1 για τομές (σημειακά).
- Born-bound: `{ ...entity, guideBindings: bindings }` (ίδιο με host-on-snap του draw tool).

### 1B. Orchestrator `bim/<family>/<family>-grid-commit.ts`
- Idempotent skip ανά key (segment/intersection): δες `wall-grid-commit.ts` (`gridWallKey` direction-agnostic) και `column-grid-commit.ts` (`gridColumnKey` = `cx|cy`).
- Διάβασε existing scene entities → skip όσα έχουν ήδη grid bindings → create μόνο missing → `executeCommand(new CreateXsCommand(...))`.

### 1C. Batch command `core/commands/entity-commands/Create<Xs>Command.ts`
- **ΑΚΡΙΒΕΣ mirror** `CreateFoundationsCommand`/`CreateColumnsCommand`/`CreateWallsCommand` (όλα staged αυτή τη συνεδρία).
- **ΚΡΙΣΙΜΟ:** deferred-microtask `EventBus.emit('drawing:entity-created', { entity, tool })` (ΟΧΙ `CompoundCommand<CreateEntityCommand>` — δεν persist-άρει). undo → `bim:<family>-delete-requested`.
- tool tags: beam→`'beam'` (δες `add-beam-to-scene.ts`)· slab→`'slab'`· tie-beam→`'foundation'` (foundation entity).
- delete events: grep `bim:beam-delete-requested` / `bim:slab-delete-requested` / `bim:foundation-delete-requested` στα `hooks/data/use<X>Persistence.ts`.

### 1D. Ribbon wiring (FULL SSoT)
- `<family>-command-keys.ts`: +action key (π.χ. `beam.actions.fromGrid`) + ενημέρωσε το `isXActionKey` (ΠΡΟΣΟΧΗ: foundation/column χρησιμοποιούν explicit list ή Object.values — δες ποιο).
- `useRibbon<X>Bridge.ts`: `handleFromGrid` (set store αν χρειάζεται mode· run commit· toast emitter module-level) + `onAction` routing.
- `structural-tab.ts`: κουμπί στο σωστό panel (`structural-beams` για δοκούς, `structural-floors` για πλάκες, `structural-foundation` για συνδετήριες). Helpers: `toolBtn`/`actionBtn`/`splitActionBtn` (το τελευταίο για modes).
- `systems/events/drawing-event-map.ts`: `bim:<family>s-from-grid` + `-failed`.
- `hooks/useDxfViewerNotifications.ts`: toast handlers (ICU πληθυντικός).
- i18n `src/i18n/locales/{el,en}/dxf-viewer-shell.json`: `<family>Grid.*` + ribbon labels.

### 1E. Tests
- `<family>-from-grid.test.ts` (builder: πλήθος, born-bound bindings, edge) + `<family>-grid-commit.test.ts` (idempotent: all-create/up-to-date/partial/insufficient). Πρότυπα: `wall-from-grid.test.ts`, `column-grid-commit.test.ts`.
- Αν αγγίξεις `structural-tab.ts` → ενημέρωσε `structural-tab.test.ts` (EXPECTED_COMMAND_KEYS set + split-button assertions). **Shared με icon-agent.**

### 1F. Extras που ίσως χρειαστούν (δες αν ισχύουν)
- **Perimeter mode** (split-button Κεντρικά/Εσωτερικά/Εξωτερικά): υπάρχει SSoT για strips = `gridStripJustification(mode)` + `foundation-grid-settings-store.ts`. Οι **συνδετήριες** ίσως το θέλουν κι αυτές (reuse).
- **Face-trim σε κολώνες** (Revit face-to-face): `bim/walls/wall-column-trim.ts` (via `GuideBinding.extend` = support distance του column footprint). Οι **δοκοί** ίσως θέλουν trim στις κολώνες/τοίχους — reuse την ίδια ιδέα.

---

## 2. ΑΝΑ ΟΙΚΟΓΕΝΕΙΑ — ΤΙ ΥΠΑΡΧΕΙ / ΤΙ ΛΕΙΠΕΙ (Phase 1 recognition pointers)

### 2.1 ΣΥΝΔΕΤΗΡΙΕΣ (foundation `tie-beam`) — ΕΥΚΟΛΟΤΕΡΟ
- **Υπάρχει:** ο foundation builder `completeFoundationFromTwoClicks(start, end, levelId, kind, ...)` δέχεται `kind='tie-beam'` (ADR-436 Slice 2)· foundation hosting strategy live· persistence με guideBindings live.
- **Λείπει:** generator που χτίζει tie-beams στα segments. **ΠΡΟΤΑΣΗ:** `buildStripGridFromGuides` καλεί `completeFoundationFromTwoClicks(..., 'strip', ...)` hardcoded → παραμετροποίησε με `kind` (default 'strip') ή φτιάξε thin wrapper `buildTieBeamGridFromGuides` που περνά `kind='tie-beam'` + ίσως διαφορετικό default πλάτος/βάθος. Idempotent skip: ο reconciler ήδη ξεχωρίζει tie-beam (kind στο `rehostOrphanStrips` το χειρίζεται). **ΠΡΟΣΟΧΗ:** μην μπερδέψεις strips ↔ tie-beams στο idempotent key (πρόσθεσε kind στο key αν χρειάζεται).
- **UI:** κουμπί «Συνδετήριες από κάναβο» στο `structural-foundation` panel (δίπλα στο «Εσχάρα»).
- Reference: `bim/foundations/foundation-from-grid.ts`, `foundation-grid-commit.ts`, ADR-436 Slice 2.

### 2.2 ΔΟΚΑΡΙΑ (structural `beam`)
- **Υπάρχει:** `hooks/drawing/beam-completion.ts` (builders: grep `buildDefaultBeamParams`/`buildBeamEntity`)· `bim/beams/add-beam-to-scene.ts` (emit `drawing:entity-created` tool='beam')· `beam-from-wall.ts` (mirror foundation-from-wall)· `beam-firestore-service.ts`· grips/geometry όλα live.
- **ΛΕΙΠΕΙ (ΚΡΙΣΙΜΟ): `beam-hosting-strategy.ts` ΔΕΝ υπάρχει** — ο registry `bim/hosting/hosting-strategy.ts` έχει ΜΟΝΟ foundation/column/wall. Για να ακολουθούν οι δοκοί τον άξονα (follow-move) ΠΡΕΠΕΙ:
  1. NEW `bim/hosting/beam-hosting-strategy.ts` = **ακριβές mirror `wall-hosting-strategy.ts`** (line slots → start/end via `deriveLineSlots`· `computeBeamGeometry`· `validateBeamParams`· outline από beam footprint).
  2. Πρόσθεσε `beam: beamHostingStrategy` στο `STRATEGIES` (`hosting-strategy.ts`).
  3. Βεβαιώσου ότι το beam persistence κάνει round-trip το `guideBindings` (mirror wall: `beam-firestore-service` save/load + `useBeamPersistence` docToEntity· δες πώς το έκανε ο wall/column στο `f992df62`).
  4. host-on-snap στο beam draw tool (mirror `resolveWallGridBindings` στο `use-wall-commit`) — προαιρετικό αλλά συνεπές.
- **Μετά:** `beam-from-grid.ts` (reuse `enumerateGridStrips`) + `beam-grid-commit.ts` + `CreateBeamsCommand.ts` + ribbon στο `structural-beams` panel.
- **Face-to-face:** οι δοκοί συνήθως πατούν σε κολώνες/τοίχους → reuse την ιδέα του `wall-column-trim.ts` (extend στην παρειά). Σκέψου το (Revit beam joins).
- Reference: `bim/walls/wall-hosting-strategy.ts` (ΤΟ ΠΡΟΤΥΠΟ), `bim/beams/*`, `hooks/drawing/beam-completion.ts`.

### 2.3 ΠΛΑΚΕΣ (`slab`: εδαφόπλακα / δάπεδο / οροφή) — ΔΙΑΦΟΡΕΤΙΚΗ ΦΥΣΗ
- **Υπάρχει:** `hooks/drawing/slab-completion.ts` (`buildDefaultSlabParams(vertices, overrides)` + `buildSlabEntity`· kinds μέσω `SlabKind`· `levelElevation` per-kind)· `bim/slabs/*` (geometry/grips/corner-anchors/region)· `slab-firestore-service.ts`. Region detection ήδη χρησιμοποιείται (slab από περίγραμμα).
- **ΚΥΡΙΑ ΣΧΕΔΙΑΣΤΙΚΗ ΑΠΟΦΑΣΗ (ρώτα Giorgio στο Plan):** η πλάκα είναι **πολύγωνο**, ΟΧΙ start/end/center → το `GuideBinding` slot model δεν την φιλοξενεί άμεσα. Επιλογές:
  - **(A) Slab από την ΕΞΩΤΕΡΙΚΗ περίμετρο του κανάβου** (ένα ορθογώνιο min/max X×Y) — απλό, ένα slab για όλο το κτίριο. Hosting: born-bound στις **4 γωνίες** (νέα έννοια corner-binding) ή **non-hosted** (regenerate κουμπί). Revit «Floor» ≈ αυτό.
  - **(B) Per-bay slabs** (ένα slab ανά φάτνωμα N×M) — πιο granular, mirror της εσχάρας ανά bay.
  - **Hosting πλάκας:** ίσως νέο binding kind (π.χ. polygon vertices each bound σε ζεύγος αξόνων) — **μεγαλύτερη δουλειά**. Για v1 πρότεινε **non-hosted slab από grid extent + regenerate** (idempotent), και DEFER το slab-follow-move.
  - **3 kinds:** εδαφόπλακα (`kind` mat/foundation slab, χαμηλό elevation), δάπεδο (`floor`), οροφή (`roof`/top elevation). Διαφέρουν σε `kind`+`levelElevation` — ίδια geometry generation.
- **UI:** split-button «Πλάκα από κάναβο» (ή 3 κουμπιά/variants εδαφόπλακα/δάπεδο/οροφή) στο `structural-floors` panel.
- Reference: `hooks/drawing/slab-completion.ts`, `bim/slabs/slab-corner-anchors.ts`, region detection (`perimeter-from-faces.ts`/`wall-in-region.ts`).

---

## 3. SCOPE / ΠΡΟΤΕΙΝΟΜΕΝΗ ΣΕΙΡΑ (επιβεβαίωσε plan με Giorgio — N.8)

| Σειρά | Sub-slice | Δυσκολία | Πιθανά αρχεία |
|---|---|---|---|
| **1** | **GEN-TIE** Συνδετήριες από κάναβο | Εύκολο (reuse εσχάρας + kind) | foundation-from-grid kind-param ή wrapper · grid-commit kind-aware key · ribbon · i18n · tests |
| **2** | **GEN-BEAM** Δοκάρια από κάναβο | Μεσαίο (+beam hosting πρώτα) | NEW beam-hosting-strategy +registry · beam persistence guideBindings · beam-from-grid · beam-grid-commit · CreateBeamsCommand · ribbon · tests |
| **3** | **GEN-SLAB** Πλάκες από κάναβο | Δύσκολο (σχεδιαστικό) | slab-from-grid (extent/per-bay) · slab-grid-commit · CreateSlabsCommand · ribbon (3 kinds) · i18n · tests · (DEFER slab hosting) |

- **Πιθανά 3 ξεχωριστά Plan-Mode rounds** (διαφορετική φύση το καθένα). Πρότεινε στον Giorgio να ξεκινήσετε από **GEN-TIE** (γρήγορη νίκη, ίδιο pattern) → **GEN-BEAM** → **GEN-SLAB** (χρειάζεται απόφαση).
- **ADR-040:** οι pure builders/commands/ribbon είναι ΕΚΤΟΣ ADR-040. ΑΝ αγγίξεις `GuideFollowGhostOverlay`/outline/ghost (π.χ. beam ghost στο follow-move) → stage ADR-040 (CHECK 6B/6D) + draw-time getter (ΟΧΙ `useSyncExternalStore` σε orchestrators).
- **Default-off generation:** explicit κουμπί, ΟΧΙ auto-generate στο draw (όπως όλα τα «από κάναβο»).

---

## 4. ΠΑΓΙΔΕΣ / ΜΑΘΗΜΑΤΑ (από τις προηγούμενες GRID-GEN συνεδρίες)

- **Persistence trigger:** batch command ΠΡΕΠΕΙ deferred `drawing:entity-created` (το `CreateEntityCommand`/`CompoundCommand<CreateEntityCommand>` ΔΕΝ persist-άρει). Μάθημα εσχάρας.
- **Idempotent key = binding guide-ids** (coordinate-free), ΟΧΙ coords → ξανα-πάτημα = no-op, μετακίνηση άξονα δεν διπλασιάζει.
- **TS weak-type:** `hasGuideBindings` είναι generic — αν προσθέσεις νέο hosted type, OK· αν φτιάξεις δικό σου type-guard πρόσεξε weak-type (όλα optional).
- **Shared mode store:** αν βάλεις perimeter-mode-style επιλογές, κράτα ΕΝΑ store που το διαβάζουν ΚΑΙ κουμπί ΚΑΙ auto-settle reconcile ΚΑΙ ghost (αλλιώς drag άξονα → reset σε default = bug). Πρότυπο: `foundation-grid-settings-store.ts`.
- **Split-button:** το infra υπάρχει (`RibbonSplitButton`/`RibbonSplitDropdown`· variant με `action` → `onAction(variant.action)`). Main button = last-used variant. Δες `structural-tab.ts splitActionBtn`.
- **Shared tree icon-agent:** το `structural-tab.ts/.test.ts` αλλάζει παράλληλα (icon tokens `struct-*` + uniqueness/family tests). Πρόσθεσε κουμπιά με `struct-*` unique icons· ΜΗΝ κάνεις revert τα δικά του· `git add` ΜΟΝΟ δικά σου hunks.
- **N.17 tsc:** ΠΡΙΝ τρέξεις tsc, `Get-CimInstance Win32_Process | where CommandLine -like '*tsc*'` → αν τρέχει, περίμενε. Τρέξε filtered+background.

---

## 5. DB ANCHORS (project pagonis-87766, read-only MCP)
- company `comp_9c7c1a50…757` · project `proj_3a8e2b2c…c57` · floorplan `file_32a7a4fb…` · floor `flr_161aa890…` · level `lvl_b997c956…` · grid doc `grd_26a67767-960b-4a06-8c39-dbd67e811f55`.
- Δοκάρια→`floorplan_beams`· Πλάκες→`floorplan_slabs`· Θεμελιώσεις (tie-beam)→`floorplan_foundations`.
- Verify: baseline read-only DB → χειρονομία/generation → re-query → σύγκριση.

## 6. ΚΑΤΑΣΤΑΣΗ REPO (αρχή νέας συνεδρίας)
- Όλη η GRID-GEN φάση 1 (κολώνες/τοίχοι/πεδιλοδοκοί από κάναβο + wall→column face-trim + perimeter mode) είναι **DONE + tsc καθαρό + jest πράσινα**, αλλά **🔴 UNCOMMITTED** (ο Giorgio committαρει). **ΜΗΝ committαρεις εσύ.**
- Άλλος agent (icon) στο `structural-tab.*`. Πιθανά `[ORTHO-DBG]` άλλου πράκτορα — **ΜΗΝ τα αγγίξεις**.

## 7. DOCS ΝΑ ΕΝΗΜΕΡΩΣΕΙΣ (N.15, ίδιο commit με κώδικα)
- `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (γραμμή ανά sub-slice — μόνο τι εκκρεμεί)· `ADR-441` changelog+§8· MEMORY `project_adr441_foundation_strip_grid.md`. **ΜΗΝ** adr-index (shared tree).

## 8. REF
- Πρότυπα αυτής της συνεδρίας: `bim/walls/wall-from-grid.ts`, `wall-grid-commit.ts`, `wall-column-trim.ts`, `bim/columns/column-from-grid.ts`, `column-grid-commit.ts`, `core/commands/entity-commands/Create{Walls,Columns,Foundations}Command.ts`, `bim/foundations/foundation-grid-justification.ts` (mode), `ui/ribbon/hooks/bridge/foundation-grid-settings-store.ts`, `structural-tab.ts splitActionBtn`.
- MEMORY: `project_adr441_foundation_strip_grid.md` (πλήρες ιστορικό Slices 0-10 + GEN/COL/WALL + GEN-COL/WALL + perimeter mode) · `reference_grid_hosting_strategy_ssot.md` · `reference_2d_dxf_pipeline_bim_entity.md`.
- ADR-441 §8 (GRID-FIRST όραμα) · §10 (slice plan) · ADR-436 (foundation, tie-beam kind).
