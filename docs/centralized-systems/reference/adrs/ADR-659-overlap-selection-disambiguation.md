# ADR-659 — Ασφαλής επιλογή οντοτήτων σε αλληλοεπικάλυψη (Overlap Selection Disambiguation)

- **Status:** ✅ IMPLEMENTED (M1–M4 — αποφάσεις D1–D5)
- **Ημερομηνία:** 2026-07-15
- **Κατηγορία:** DXF Viewer / Selection
- **Συντάκτης:** Claude (Opus 4.8) κατόπιν εντολής Giorgio
- **Επεκτείνει ρητά:** **ADR-357 Φ15 / G13 (Selection Cycling)** — ΔΕΝ αντικαθιστά, χτίζει πάνω
- **Σχετικά:** ADR-040 (canvas perf / micro-leaf), ADR-364 (Escape Command Bus), ADR-105 (hit-test tolerance), ADR-261 (execution mode)

---

## 1. Πλαίσιο (Context)

Στον 2D καμβά, όταν πολλές οντότητες πέφτουν η μία **πάνω στην άλλη** (π.χ. γραμμές κάτω από
γραμμοσκιάσεις, κείμενα, blocks), ο χρήστης πρέπει να μπορεί να **επιλέγει με ασφάλεια ΑΥΤΟ που
θέλει** — όχι «ό,τι έτυχε να είναι από πάνω». Ζητούμενη ποιότητα: **Revit / ArchiCAD / CINEMA 4D
(MAXON) / Figma-level**, **FULL ENTERPRISE + FULL SSOT**.

### 1.1 Κρίσιμο εύρημα (SSoT audit 2026-07-15) — ΤΟ ΣΥΣΤΗΜΑ ΥΠΑΡΧΕΙ ΗΔΗ

Υπάρχει **ολοκληρωμένο** selection-cycling stack (ADR-357 Φ15 / G13), **mounted & ζωντανό**, με
trigger **Shift+Space**. Αυτό το ADR **ΔΕΝ ξαναχτίζει** μηχανισμό hit-test — **ανεβάζει το UX σε
big-player level** (discoverability + ασφάλεια).

**Τι έκανε ήδη το stack (πριν το ADR-659):**
- `HitTestingService.hitTestAll()` — ΟΛΟΙ οι candidates κάτω από σημείο (sorted priority→distance).
- `SelectionCyclingStore` — active flag + candidates + currentIndex + anchor.
- `SelectionCyclingPopover` — portal λίστα (type+layer+id), κλικ→επιλογή, currentIndex highlight.
- `use-selection-cycling` — Shift+Space → cycle· Enter→confirm· Esc→cancel (Escape Bus).

**Τι ΕΛΕΙΠΕ (τα κενά που κλείνει το ADR-659):**
1. **Canvas pre-highlight** — ο χρήστης κύκλωνε «στα τυφλά»· η λίστα έδειχνε type/layer αλλά ΟΧΙ
   ποια οντότητα φωτίζεται στον καμβά.
2. **Repeated-click** — ένα απλό κλικ δεν άνοιγε ποτέ τη λίστα· μόνο το Shift+Space.
3. **Badge** ένδειξης overlap κοντά στον κέρσορα (discoverability).

### 1.2 Πρακτική μεγάλων παικτών (research)

| Εργαλείο | Μηχανισμός overlap-selection |
|---|---|
| **AutoCAD** | *Selection Cycling* (`SELECTIONCYCLING`): ≥2 κάτω από κέρσορα → **badge** δίπλα στον κέρσορα· κλικ → **list box** (icon+type+layer)· **hover γραμμή → pre-highlight στον καμβά**· κλικ→επιλογή. Legacy Shift+Space κύκλος. |
| **Revit** | **Tab** κύκλος με **pre-highlight** + όνομα στο status bar· κλικ επιβεβαιώνει. |
| **ArchiCAD** | **Επαναλαμβανόμενο κλικ στο ΙΔΙΟ σημείο** → κύκλος στα επικαλυπτόμενα (Quick Selection). |
| **Figma** | δεξί κλικ → «Select layer» (λίστα stacked layers, hover→highlight). Cmd/Ctrl+click = deep. |
| **CINEMA 4D** | Viewport = topmost· disambiguation μέσω Object Manager (ιεραρχική λίστα). |

**Κοινός παρονομαστής:** *ποτέ σιωπηλή αυθαίρετη επιλογή*. Ο χρήστης βλέπει **ΤΙ** είναι κάτω από
τον κέρσορα και **διαλέγει ρητά**, με «έξυπνη» αρχική σειρά (μικρό/annotation/σημείο νικά μεγάλο
fill/hatch).

---

## 2. Αποφάσεις (Decisions — εγκεκριμένες από Giorgio 2026-07-15)

| # | Θέμα | Απόφαση | Πρότυπο μεγάλου παίκτη |
|---|---|---|---|
| D1 | **Μηχανισμός** | **Repeated-click στο ίδιο σημείο** (κύκλος z-order). **ΟΧΙ** Tab, **ΟΧΙ** δεξί-κλικ (αυτόν τον κύκλο) | ArchiCAD Quick Selection |
| D2 | **Auto-popover** | **Μόνο στο 2ο κλικ** ίδιου σημείου. 1ο κλικ = top-priority (fast path **ανέγγιχτο**) | AutoCAD (2ος πάτος → λίστα) |
| D3 | **Pre-highlight** | **Ναι — στον καμβά + label**. Row hover ΚΑΙ cycle step → φωτίζεται η οντότητα (μέσω `HoverStore`) | Revit Tab / AutoCAD list hover |
| D4 | **Badge** | **Ναι** — διακριτικό «⧉ N» δίπλα στον κέρσορα όταν ≥2 από κάτω | AutoCAD Selection Cycling badge |
| D5 | **Legacy** | **Κρατάμε Shift+Space** ως έχει (δίπλα στο repeated-click). Δεν αφαιρείται δουλεύον feature | — |

> **Απόκλιση από το handoff (τεκμηριωμένη):** Το handoff πρότεινε νέα i18n labels **μόνο** στο
> `dxf-viewer-shell.json`. **Διόρθωση:** το υπάρχον `selectionCycling` block ζει στο
> `dxf-viewer.json` και το popover το διαβάζει με `useTranslation('dxf-viewer')`. Η shell-remap
> gotcha (`reference_i18n_tools_root_remaps_to_shell`) αφορά **μόνο** `tools.*`/`ribbon.*` root
> keys. Άρα τα νέα labels μπαίνουν **co-located** στο `dxf-viewer.json` (reachability + SSoT), ΟΧΙ
> shell.json.

---

## 3. Αρχιτεκτονική (SSOT — τι ΞΑΝΑΧΡΗΣΙΜΟΠΟΙΕΙΤΑΙ, τι ΧΤΙΖΕΤΑΙ)

### 3.1 Επαναχρήση (SSoT — ΜΗΝ κλωνοποιηθεί)

| Ρόλος | SSoT αρχείο |
|---|---|
| ALL candidates κάτω από σημείο (sorted) | `services/HitTestingService.ts` → `hitTestAll()` |
| «Έξυπνη σειρά» (priority) | `rendering/hitTesting/hit-tester-utils.ts` → `calculatePriority()` |
| Cycling store (candidates/index/anchor) | `systems/selection/SelectionCyclingStore.ts` |
| Popover UI (portal λίστα) | `systems/selection/SelectionCyclingPopover.tsx` |
| Cycling hook (Shift+Space/Enter/Esc) | `systems/selection/use-selection-cycling.ts` |
| Canvas pre-highlight SSoT (zero-React) | `systems/hover/HoverStore.ts` → `setHoveredEntity()` |
| Click→select seam (single-point pick) | `systems/cursor/mouse-handler-up.ts` (γρ. ~449–465) |
| «2ου κλικ» gate precedent | `bim/stairs/stair-click-into-2d.ts` → `handleStairClickInto2D()` |
| Hover seam (top-1 + throttle) | `systems/cursor/mouse-handler-move.ts` (γρ. ~276–294) |
| Overlays mount (portal siblings) | `components/dxf-layout/CanvasSectionOverlays.tsx` |
| Escape priority slot | `systems/escape-bus` → `ESC_PRIORITY.SELECTION_CYCLING` |
| Generic entity-type fallback label (2026-07-17) | `bim-3d/accessibility/status-bar-text-generator.ts` → `entityTypeLabel()` (namespace `bim3d`) |
| Canonical-mm → display-unit number (2026-07-17) | `config/display-length-format.ts` → `formatLengthForDisplay()` / `formatCoordinateForDisplay()` |
| Wall/column ΑΠΟΛΥΤΗ base z (baseBinding-aware) (2026-07-17) | `bim/geometry/wall-top-profile.ts` → `resolveWallBaseZmm(params, {floorElevationMm})` — ο ΙΔΙΟΣ resolver του 3D converter |
| Ενεργό storey FFL (datum-relative absolute) (2026-07-17) | `systems/levels/active-storey-store.ts` → `useActiveStoreyStore.getState().context?.floorElevationMm` (ADR-448) |

### 3.2 Νέο (πρέπει να χτιστεί)

| Ρόλος | Νέο αρχείο |
|---|---|
| Repeated-click arm/cycle **brain** (SSoT, keeps handler thin) | `systems/selection/resolve-repeated-click-cycle.ts` |
| Overlap-count store (low-freq, zero-React) | `systems/selection/OverlapBadgeStore.ts` |
| Badge overlay leaf «⧉ N» (portal, ADR-040 micro-leaf) | `systems/selection/OverlapCountBadge.tsx` |
| Popover row semantic label — slab role/thickness/elevation + generic fallback (2026-07-17) | `systems/selection/candidate-label.ts` |

### 3.3 Ροή (data flow)

```
1ο κλικ (≥2 candidates)
  → hitTestAll → dedup → SelectionCyclingStore.armFromClick(candidates, screenPt)
  → κανονική επιλογή top-1 (candidates[0])            [fast path ανέγγιχτο]

2ο κλικ ΙΔΙΟ σημείο (< SAME_POINT_PX)
  → matchesArmed() ✓ → armedIndex++ (wrap)
  → select candidates[armedIndex]
  → startCycling(candidates, index) → popover ανοίγει
  → HoverStore.setHoveredEntity(current) → canvas pre-highlight

popover row hover → HoverStore.setHoveredEntity(row.id)   [pre-highlight]
popover row click → onSelectEntity(id) + cancel
Esc → cancel + HoverStore.setHoveredEntity(null)

hover (select tool, top-1 hit) → hitTestAll → uniqueCount
  → OverlapBadgeStore.set(count≥2 ? count : 0, clientX, clientY)
  → OverlapCountBadge leaf renders «⧉ N»
```

### 3.4 Συμμόρφωση ADR-040 (perf)

- Το cycling hook παραμένει **side-effect-only** (κανένα `useSyncExternalStore` σε CanvasSection).
- Pre-highlight μέσω `HoverStore` (zero-React-state) — **ΟΧΙ** νέα high-freq subscription σε orchestrator.
- Badge = ξεχωριστό **micro-leaf** (`OverlapCountBadge`) που subscribe-άρει **μόνο** στο low-freq
  `OverlapBadgeStore`. Το store γράφεται **μόνο** στο hover seam, **μόνο όταν** το top-1 hit-test
  βρήκε οντότητα (μηδέν επιπλέον query σε κενό χώρο), πίσω από το υπάρχον `HOVER_THROTTLE_MS` +
  skip-if-unchanged.

---

## 4. Milestones

- **M1** — `SelectionCyclingStore` armed-state (arm/matches/cycleArmed) + `resolve-repeated-click-cycle.ts`
  + integration στο `mouse-handler-up.ts`. (repeated-click + auto-popover D1/D2)
- **M2** — Pre-highlight: `SelectionCyclingPopover` row hover + `use-selection-cycling` cycle step →
  `HoverStore`. (D3)
- **M3** — Badge: `OverlapBadgeStore` + `OverlapCountBadge` + hover-count στο `mouse-handler-move` +
  mount στο `CanvasSectionOverlays`. (D4)
- **M4** — i18n (dxf-viewer.json el+en) + jest (store armed-state + resolver) + jscpd:diff.

---

## 5. Changelog

| Ημ/νία | Milestone | Αλλαγή |
|---|---|---|
| 2026-07-15 | M0 | ADR-659 δημιουργήθηκε. SSoT audit επιβεβαίωσε ADR-357 Φ15 stack. Αποφάσεις D1–D5 εγκεκριμένες. |
| 2026-07-15 | M1 | `SelectionCyclingStore`: shared `buildCandidatesFromHits()` (dedup SSoT· κατάργησε το διπλό loop στο `use-selection-cycling`), armed repeated-click state (`armFromClick`/`matchesArmedPoint`/`advanceArmed`/`clearArmed`) + `startCycling(startIndex)`. Νέο `resolve-repeated-click-cycle.ts` (brain). Integration στο `mouse-handler-up.ts` (gate πριν το `onEntitySelect`, μετά το stair click-into· select-by-id μέσω `onEntitiesSelected([id])` = `replaceEntitySelection`). |
| 2026-07-15 | M2 | Canvas pre-highlight μέσω `HoverStore`: popover row `onMouseEnter`→highlight + `onMouseLeave`→current· keyboard `cycleNext`/`startCycling` sync· clear σε Enter/Esc/click-select. |
| 2026-07-15 | M3 | Badge: `OverlapBadgeStore` (zero-React, cached snapshot) + `OverlapCountBadge` (`<output>` leaf, portal, pointer-events-none) + hover-count στο `mouse-handler-move` (`hitTestAll` **μόνο όταν** top-1 hit· clear σε grip-drag) + mount στο `CanvasSectionOverlays`. |
| 2026-07-15 | M4 | i18n `selectionCycling.overlapBadge`/`overlapBadgeHint` (el+en, ICU plural). Jest: `SelectionCyclingStore.test.ts` + `resolve-repeated-click-cycle.test.ts` (16 tests ✅). jscpd:diff καθαρό (0 clones / 9 files). |
| 2026-07-15 | **FIX (root cause)** | **Zombie-singleton bug**: υπήρχαν **ΔΥΟ** `HitTestingService` instances — το registry factory έκανε `() => new HitTestingService()` (χωριστό από το exported singleton). Το render loop (`dxf-canvas-renderer.ts:169`) τάιζε `updateScene()` **ΜΟΝΟ** το registry instance· το exported singleton έμενε scene-less → `hitTestAll()` επέστρεφε **πάντα `[]`** → κανένα badge/repeated-click, **και το Shift+Space (ADR-357 Φ15) ποτέ δεν δούλεψε**. |
| 2026-07-15 | **CENTRALIZATION (SSoT — big-player DI)** | **Μία και μοναδική πηγή, ΕΝΑΣ τρόπος πρόσβασης**: **καταργήθηκε** το exported `hitTestingService` singleton. Ο `ServiceRegistry` (DI container) είναι πλέον ο **μοναδικός owner** — `registerFactory('hit-testing', () => new HitTestingService())` δημιουργεί & cache-άρει το ΕΝΑ instance. **ΟΛΟΙ** οι consumers (hover, cycling, badge, **`EntityRendererComposite`**) → `serviceRegistry.get('hit-testing')`. Re-export αφαιρέθηκε (`services/index.ts`), guard σχόλια σε `HitTestingService.ts`/`ServiceRegistry.ts`, mock επαναφορά. Enterprise DI practice (Angular/.NET/Spring/AutoCAD service-locator): ένας container, ένας τρόπος, μηδέν παράλληλα globals. Tests: 133/133 ✅ (16 suites). ⚠️ `ServiceRegistry.v2.ts` ΑΝΕΝΕΡΓΟ — ήδη `() => new HitTestingService()`, ΟΚ. |
| 2026-07-15 | **Boy Scout (N.18)** | Εξαγωγή κοινού πυρήνα `hitTest`/`hitTestAll` σε private `queryHitsAt()` + `toHitResult()` στο `HitTestingService.ts` (προϋπάρχον internal clone screenToWorld+tolerance+hitTestPoint). jscpd:diff καθαρό. |
| 2026-07-15 | **FIX (gate type)** | Το repeated-click gate στο `mouse-handler-up.ts` έλεγχε `hitResult?.entityId`, αλλά το `hitTestCallback` επιστρέφει το **entity id (string\|null)**, όχι object → `?.entityId` πάντα `undefined` → ο resolver ΠΟΤΕ δεν καλούνταν (η λίστα δεν άνοιγε στο 2ο κλικ). Διόρθωση: `if (hitResult && !additive && onEntitiesSelected)`. Επιβεβαιωμένο live από Giorgio (λίστα ανοίγει). |
| 2026-07-17 | **FIX (bug — άχρηστες γραμμές popover)** | Δύο στοιβαγμένες πλάκες (π.χ. δάπεδο + οροφή) έδειχναν **ΤΑΥΤΟΣΗΜΗ** γραμμή στο popover — `Slab  lvl_<levelId>  …<id-suffix>` — αφού `entityType`+`layer` ήταν ίδια και στις δύο (το `hit.layer` για BIM entities είναι το internal level id, ΟΧΙ DXF layer· ξεχωριστό bug, εκτός scope). Ο χρήστης δεν είχε τρόπο να διαλέξει. **Έγκριση Giorgio** — Revit-grade τριάδα `[ρόλος] [πάχος] [στάθμη]`, π.χ. `Πλάκα δαπέδου   150 mm   +3,00`. **Design (ADR-040 two-stage):** (1) `CyclingCandidate.semantics?` — προαιρετικό, γεμίζεται **ΜΙΑ φορά** στο `buildCandidatesFromHits(hits, resolveEntity?)` (νέο optional param, `EntityResolver = (id) => Entity \| undefined`) — το entity lookup γίνεται στο build-time seam (`mouse-handler-up.ts` repeated-click, `CanvasSection.tsx` Shift+Space μέσω `useSelectionCycling({ resolveEntity })`), ΠΟΤΕ per-render στο popover. (2) `buildCandidateLabel(candidate, t, tEntityType)` — pure formatting-only στο render, νέο SSoT αρχείο `systems/selection/candidate-label.ts`: slab → `entity.params.kind` (role i18n key `selectionCycling.slabKind.*`, νέο block dxf-viewer.json el+en) + `formatLengthForDisplay(thicknessMm, {unit:'mm'})` (SSoT, fixed mm — πάχος πλάκας πάντα mm, ανεξάρτητο από το global display-unit toggle) + `formatCoordinateForDisplay(topElevationMm, {unit:'m'})` + explicit `+` prefix (αρχιτεκτονική σύμβαση στάθμης, layer πάνω από το generic coordinate formatter). Fallback (μη-slab / άγνωστο) → υπάρχον SSoT `entityTypeLabel()` (`bim-3d/accessibility/status-bar-text-generator.ts`, namespace `bim3d`) + layer **ΜΟΝΟ όταν ΔΕΝ** ξεκινά με `lvl_` (ΠΟΤΕ πια raw internal level id). Το 5-char id-suffix αφαιρέθηκε εντελώς (αναξιόπιστος διαχωριστής). Αρχεία: νέο `candidate-label.ts` + `candidate-label.test.ts` (13 tests)· `SelectionCyclingStore.ts` (`CyclingCandidate.semantics`, `EntityResolver` type)· `SelectionCyclingPopover.tsx` (δεύτερο `useTranslation('bim3d')` για το fallback, mirror του πατέντου `AriaLiveRegion.tsx`)· `use-selection-cycling.ts` + `resolve-repeated-click-cycle.ts` (νέο `resolveEntity?` param, threaded από `CanvasSection.tsx`/`mouse-handler-up.ts` μέσω `scene.entities.find`)· i18n `selectionCycling.slabKind.*` (el+en). jscpd:diff καθαρό (0 clones / 7 files). |
| 2026-07-17 | **FIX (crash — TypeError στο ίδιο fix)** | Το παραπάνω έσκαγε live: `Cannot destructure property 'kind' of 'entity.params' as it is undefined` στο `buildCandidateSemantics`. **Root cause:** **δύο** σχήματα μοιράζονται τον discriminator `type:'slab'` — το BIM `SlabEntity` (params στο `.params`) **και** το render-wrapper `DxfSlab` (`canvas-v2/dxf-canvas/dxf-types.ts`, params στο **`.slabEntity.params`**). Το repeated-click path (`mouse-handler-up.ts`) περνά `scene.entities` που είναι render-shape `DxfEntityUnion` **cast** `as unknown as Entity[]` → τα slabs είναι **wrappers**. Το `isSlabEntity()` ελέγχει **μόνο** `type` → narrow-άρει **και τα δύο** σε `SlabEntity`, οπότε το blind `entity.params` destructure έσκαγε στο wrapper (το `as unknown as` cast έκρυβε το κενό από τον compiler). **Fix:** νέος tolerant reader `extractSlabParams(entity)` στο `candidate-label.ts` → `view.params ?? view.slabEntity?.params` (διαβάζει **και τα δύο** shapes· `undefined` για param-less/legacy → generic fallback, όχι crash). +2 regression tests (wrapper shape· param-less slab). candidate-label.test.ts 13→ πράσινα. jscpd:diff καθαρό. |
| 2026-07-17 | **EXTENSION (rich rows for ΟΛΑ τα δομικά)** | Giorgio ζήτησε το ίδιο Revit-grade treatment για wall/column/beam/foundation (πριν έδειχναν μόνο το γυμνό όνομα τύπου). `CandidateSemantics` + `buildCandidateSemantics` + `buildCandidateLabel` (`candidate-label.ts`) επεκτάθηκαν με νέο discriminator `structuralKind` + per-type extractors (πάντα μέσω `unwrapDxfSubEntity<T>()`, ADR-671 safety). **Τοίχος** (ρητή απόφαση Giorgio): πάχος `WallParams.thickness` + ύψος `WallParams.height` + βάση `WallParams.baseOffset` → `"Τοίχος  20 cm · ύψος 3,00  +0,00"`. **Κολόνα**: διατομή `width×depth` (`Ø` για `kind==='circular'`) + `height` + `baseOffset` → `"Στύλος  40×40 cm · ύψος 3,00  +0,00"`. **Δοκός**: διατομή `width×depth` + απόλυτη `topElevation` (ADR-369 §2.2, καμία storey-εξάρτηση) → `"Δοκός  20×40 cm  +3,00"`. **Θεμέλιο** (discriminated union ADR-436): `pad` → footprint `width×length`· `strip`/`tie-beam` → διατομή `width×thicknessMm`· πάντα απόλυτη `topElevationMm` → `"Θεμέλιο  150×150 cm  -1,00"`. `wallBaseOffsetMm`/`columnBaseOffsetMm` είναι η καλύτερη **αυτοδύναμη** τιμή χωρίς storey-chain resolution (offset από storey FFL, default 0) — τεκμηριωμένο caveat στο module doc-block. Νέο cm-section formatter (`formatSectionCm`) + i18n `selectionCycling.heightLabel` («ύψος {value}», el+en). Foundation primary καλύπτει pre-existing gap στο `normalizeEntityType()` (δεν αναγνωρίζει `'foundation'`) διαβάζοντας `entityTypes.foundation` απευθείας — bug flagged, ΟΧΙ fixed (εκτός του touch-scope αυτού του αρχείου). +19 νέα tests (candidate-label.test.ts 13→25, όλα πράσινα). jscpd:diff καθαρό (0 clones / 2 files). |
| 2026-07-17 | **FIX (στάθμη σχετική→ΑΠΟΛΥΤΗ, Revit-grade συνέπεια)** | Giorgio: η στάθμη τοίχου/κολόνας έδειχνε `+0,00` (offset ορόφου) αντί για το πραγματικό υψόμετρο σε άνω ορόφους → παραπλανητικό· «είτε απόλυτη παντού, είτε καθόλου». **SSoT audit (grep, ΠΡΙΝ κώδικα) — ο κώδικας είναι SSoT (N.0.1), το handoff §1 ΕΚΑΝΕ ΛΑΘΟΣ:** δεν είναι μόνο τοίχος/κολόνα σχετικά. Ο κώδικας δείχνει ότι **slab `levelElevation`, wall/column `baseOffset`, ΚΑΙ beam `topElevation` είναι ΟΛΑ FLOOR-RELATIVE** — το απόλυτο προκύπτει προσθέτοντας το storey FFL στο render (`bim-three-slab-converter.ts:178` «ADR-448 §4.1 levelElevation is FLOOR-RELATIVE»· `bim-three-structural-converters.ts:165` column· `:412` «top είναι FLOOR-RELATIVE»). **ΜΟΝΟ** το foundation `topElevationMm` είναι όντως απόλυτο (`foundation-to-three.ts:64` «_floorElevationMm αγνοείται σκόπιμα»). Στον ισόγειο (FFL=0) σχετικό==απόλυτο → γι' αυτό «φαινόταν» σωστό για slab/beam. **Fix (Δρόμος Α, ομοιόμορφα, in-scope):** το `buildCandidatesFromHits` διαβάζει **ΜΙΑ φορά** το ενεργό storey FFL από το SSoT singleton `useActiveStoreyStore.getState().context?.floorElevationMm` (ADR-448· zero-React, single-floor 2D canvas → ισχύει για ΟΛΑ τα candidates) και το περνά στο `buildCandidateSemantics(entity, storeyFloorElevationMm=0)`. Slab/beam: `FFL + σχετική τιμή`. Wall/column: **SSoT `resolveWallBaseZmm(params, {floorElevationMm})`** (`bim/geometry/wall-top-profile.ts` — ο ΙΔΙΟΣ resolver του 3D· τιμά `baseBinding:'absolute'` όπου το `baseOffset` είναι ήδη world z, χωρίς διπλομέτρηση). Foundation: αμετάβλητο. `?? 0` fallback (χωρίς linked storey / tests) → legacy floor-relative, **μηδέν regression στον ισόγειο**. Πεδία `wallBaseOffsetMm`/`columnBaseOffsetMm` → `wallBaseElevationMm`/`columnBaseElevationMm` (τώρα απόλυτα). Αρχεία: `candidate-label.ts` (reuse `resolveWallBaseZmm`· FFL threading)· `SelectionCyclingStore.ts` (single singleton read). Καμία αλλαγή σε orchestrator/call-sites (η purity του candidate-label μένει — δέχεται αριθμό, δεν διαβάζει store). +8 tests (2 files: candidate-label 25→31 absolute cases + baseBinding:absolute + foundation-immune· SelectionCyclingStore FFL-threading integration ×2). 45/45 πράσινα. |
