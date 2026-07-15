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

### 3.2 Νέο (πρέπει να χτιστεί)

| Ρόλος | Νέο αρχείο |
|---|---|
| Repeated-click arm/cycle **brain** (SSoT, keeps handler thin) | `systems/selection/resolve-repeated-click-cycle.ts` |
| Overlap-count store (low-freq, zero-React) | `systems/selection/OverlapBadgeStore.ts` |
| Badge overlay leaf «⧉ N» (portal, ADR-040 micro-leaf) | `systems/selection/OverlapCountBadge.tsx` |

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
