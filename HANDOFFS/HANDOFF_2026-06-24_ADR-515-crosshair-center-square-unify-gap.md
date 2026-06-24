# HANDOFF — Crosshair κεντρικό τετράγωνο: unify (κράτα ΛΕΥΚΟ) + «τρύπα» στις παρειές

- **Ημερομηνία**: 2026-06-24
- **ADR**: ADR-515 (Snap Marker Visual SSoT) — επεκτείνεται με ενότητα crosshair-center-square
- **Status προηγούμενης δουλειάς**: UNCOMMITTED (ο Giorgio θα κάνει commit, ΟΧΙ εσύ)

---

## 🚨 ΚΑΝΟΝΕΣ ΣΥΝΕΔΡΙΑΣ (απαράβατοι)

1. **COMMIT/PUSH = ΜΟΝΟ ο Giorgio.** Μην κάνεις commit/push (N.-1). Ετοίμασε, σταμάτα, ανέφερε.
2. **Working tree μοιράζεται με ΑΛΛΟΝ agent.** → ΜΗΝ κάνεις `git add -A`. Άγγιξε ΜΟΝΟ τα δικά σου αρχεία. Πρόσεχε μη-δικές σου αλλαγές.
3. **N.17 — ΕΝΑ tsc τη φορά.** Πριν τρέξεις `tsc`, έλεγξε ότι δεν τρέχει άλλος (codex agents τρέχουν παράλληλα). Πάντα `run_in_background`, ΠΟΤΕ blocking wait.
4. **FULL ENTERPRISE + FULL SSOT** (όπως Revit). **ΠΡΙΝ γράψεις ΟΠΟΙΟΝΔΗΠΟΤΕ κώδικα → πραγματικό SSoT audit με grep** για να βρεις υπάρχοντα κώδικα και να ΜΗΝ δημιουργήσεις διπλότυπα. Αν βρεις προϋπάρχοντα διπλότυπα → κεντρικοποίησέ τα (εντολή Giorgio).
5. **Γλώσσα: Ελληνικά πάντα.**
6. **ADR-040 (micro-leaf):** το `CrosshairOverlay.tsx` είναι compositor leaf — ΜΗΝ προσθέσεις re-renders· γράφε στο DOM via refs. CHECK 6B/6D: στο commit χρειάζεται staging ADR-040 + ADR-515.

---

## 🎯 ΤΙ ΘΑ ΚΑΝΕΙΣ (2 tasks)

### Task 1 — Ένα κεντρικό τετράγωνο (κράτα **ΛΕΥΚΟ aperture**, αφαίρεσε **ΠΡΑΣΙΝΟ pickbox**)
Σήμερα το σταυρόνημα έχει **δύο** ομόκεντρα τετράγωνα στο κέντρο (επιβεβαιωμένο):
- 🟢 **Πράσινο = PICKBOX** — `cursor.color` (`SUCCESS_BRIGHT` #00ff80), `pickboxRef`. → **ΑΦΑΙΡΕΣΕ ΤΟ.**
- ⬜ **Λευκό = APERTURE (APBOX)** — `crosshair.color` (`UI_COLORS.WHITE`), `apertureRef`, default `showAperture: true`, `apertureSize: 10`. → **ΚΡΑΤΑ ΤΟ** (απόφαση Giorgio 2026-06-24).

**Συνέπεια με ADR-515 (pickbox-hide-on-snap):** ΣΗΜΕΡΑ η snap-hide λογική («το τετράγωνο εξαφανίζεται όταν φωτίζεται έλξη») εφαρμόζεται στο **pickbox**. Αφού αφαιρείς το pickbox, **μετέφερε αυτή τη λογική στο aperture** (το λευκό κρύβεται όταν φωτίζεται έλξη). ΜΗΝ αφήσεις δύο μηχανισμούς — rename/repoint, μηδέν διπλότυπο.

### Task 2 — «Τρύπα» πάντα: οι γραμμές του σταυρού σταματούν στις παρειές του τετραγώνου
Ο Giorgio θέλει οι 4 γραμμές (αριστερά/δεξιά/πάνω/κάτω) να **μην** φτάνουν στο κέντρο, αλλά να σταματούν στις **εξωτερικές παρειές** του (λευκού) τετραγώνου → το τετράγωνο να έχει **πάντα τρύπα** στο εσωτερικό.

---

## 🔍 SSoT AUDIT — ΗΔΗ ΕΓΙΝΕ (μην ξαναψάχνεις από το μηδέν· επιβεβαίωσε & επέκτεινε)

**Όλα στο `src/subapps/dxf-viewer/canvas-v2/overlays/`:**

### Ο μηχανισμός «τρύπα/gap» ΥΠΑΡΧΕΙ ΗΔΗ — REUSE, μην φτιάξεις νέο
Αρχείο: `crosshair-compositor-layout.ts` (pure, unit-tested):
- `computeSegmentBoxes(armLength, lineWidth, gap)` — **ήδη** τοποθετεί τις 4 γραμμές με κενό `gap` από το κέντρο (left arm inner edge = `-gap`, right arm start = `+gap`, ομοίως top/bottom). **Αυτό ΕΙΝΑΙ η τρύπα.**
- `computeCenterGap({ useCursorGap, centerGapPx, pickBoxSize })` — υπολογίζει το half-gap. ⚠️ **2 προβλήματα προς διόρθωση:**
  1. Βασίζεται σε `pickBoxSize` (gripSettings, default 3) — ΟΧΙ στο μέγεθος του ορατού τετραγώνου. Αφού κρατάμε το **aperture**, το gap πρέπει να προέρχεται από το **`apertureSize`** (half = `apertureSize/2`) ώστε οι γραμμές να σταματούν ΑΚΡΙΒΩΣ στις παρειές του.
  2. `useCursorGap` (`cross.use_cursor_gap`) default **false** → σήμερα ΔΕΝ υπάρχει τρύπα. Ο Giorgio θέλει τρύπα **πάντα** → το κεντρικό τετράγωνο πρέπει ΠΑΝΤΑ να παράγει gap = half-size του (+ μικρό clearance ώστε η γραμμή να μην ακουμπά τη γραμμή του τετραγώνου).
- Tests: `__tests__/crosshair-compositor-layout.test.ts` — **ΕΝΗΜΕΡΩΣΕ** τα tests του gap.

### Πού ζωγραφίζεται το τετράγωνο + οι γραμμές
Αρχείο: `CrosshairOverlay.tsx`:
- `applyStaticStyles()` — εδώ ζωγραφίζονται segments (γραμμές), pickbox (🟢 αφαίρεση), aperture (⬜ κράτα), badge.
  - `aperture` block: `ap.style.border = 1px solid ${cross.color}` (λευκό), size = `apertureSize`.
  - `boxes = computeSegmentBoxes(arm, lineWidth, gap)` — το `gap` έρχεται από `computeCenterGap(...)`.
- JSX: υπάρχουν `<div ref={pickboxRef}>` (αφαίρεση) και `<div ref={apertureRef}>` (κράτα).
- **snap-hide λογική (ADR-515, ΣΗΜΕΡΙΝΗ):** `updatePickboxVisibility()` (rename → aperture), `snapActiveRef`, και το `useEffect` με `subscribeSnapResult` (γραμμές ~326). Διαβάζει `isSnapMarkerVisible(toSnapIndicatorView(getFullSnapResult()))` — **ΙΔΙΟ SSoT** με τον `SnapIndicatorSubscriber`. Κράτα αυτή την αλυσίδα, απλώς δείξε στο aperture.

### Settings SSoT (μην φτιάξεις νέα)
- `systems/cursor/config.ts` — `DEFAULT_CURSOR_SETTINGS`: `crosshair.color = WHITE`, `crosshair.use_cursor_gap`, `crosshair.center_gap_px`, `cursor.*` (pickbox), `cursor.enabled`.
- `types/gripSettings.ts` — `apertureSize: 10`, `showAperture: true`, `pickBoxSize: 3` (+ bounds/clamp).
- Το aperture οδηγείται από `useGripContext()` → `{ showAperture, apertureSize }` (γραμμή ~136 CrosshairOverlay).
- ⚠️ Σκέψου: αφού αφαιρείς το pickbox, αξιολόγησε αν το `cursor.*` (pickbox) setting block μένει νεκρό → flag/cleanup (SSoT). ΜΗΝ σπάσεις settings migration.

### Χρώμα (ADR-515 SSoT — ήδη στημένο)
- Snap marker χρώματα: `SNAP_MARKER_COLORS` (palette) στο `config/color-config.ts` + `SNAP_COLORS`/`resolveSnapColor` στο `rendering/ui/snap/snap-visual-config.ts`. Αν χρειαστείς χρώμα, από εκεί. Το crosshair/aperture χρώμα = `crosshair.color` (cursor config).

---

## 📦 ΚΑΤΑΣΤΑΣΗ — τι έγινε ΑΥΤΗ τη συνεδρία (UNCOMMITTED, tsc-clean)

ADR-515 πλήρες (audit + type-specific snap colors SSoT + cleanup νεκρών + pickbox-hide-on-snap). Αρχεία:
1. `docs/centralized-systems/reference/adrs/ADR-515-snap-marker-visual-ssot.md` (NEW)
2. `src/subapps/dxf-viewer/rendering/ui/snap/snap-visual-config.ts` (NEW)
3. `src/subapps/dxf-viewer/config/color-config.ts` (+`SNAP_MARKER_COLORS`)
4. `src/subapps/dxf-viewer/canvas-v2/overlays/SnapIndicatorOverlay.tsx` (type-specific + isSnapMarkerVisible)
5. `src/subapps/dxf-viewer/bim-3d/shared/snap-marker-core.ts` (derived color)
6. `src/subapps/dxf-viewer/rendering/ui/snap/SnapTypes.ts` (αφαίρεση νεκρών type-colors)
7. `src/subapps/dxf-viewer/rendering/canvas/core/CanvasSettings.ts` (αφαίρεση νεκρών type-colors)
8. `src/styles/design-tokens/modules/canvas-ui.ts` (αφαίρεση νεκρών snap tokens)
9. `src/subapps/dxf-viewer/snapping/extended-types.ts` (+`isSnapMarkerVisible` SSoT)
10. `src/subapps/dxf-viewer/canvas-v2/overlays/CrosshairOverlay.tsx` (pickbox-hide-on-snap)

> ⚠️ Το #10 (pickbox-hide) θα **μετατραπεί** από τη νέα δουλειά (κρατάμε aperture, όχι pickbox). Ενημέρωσε & το ADR-515 changelog ανάλογα.

---

## ⛔ ΜΗΝ ΚΑΝΕΙΣ
- Μην φτιάξεις νέο gap/segment μηχανισμό — REUSE `computeSegmentBoxes`/`computeCenterGap`.
- Μην αφήσεις δύο snap-hide μηχανισμούς (pickbox + aperture) — ΕΝΑΣ, στο aperture.
- Μην κάνεις `git add -A` / commit / push.
- Μην προσθέσεις `useSyncExternalStore` στο `CrosshairOverlay` (ADR-040) — γράφε via refs.
- Μην βάλεις hardcoded χρώματα — SSoT (`color-config` / cursor config).

---

## ✅ ΟΤΑΝ ΤΕΛΕΙΩΣΕΙΣ
- tsc (background, N.17) → 0 errors στα touched.
- Ενημέρωσε ADR-515 (ενότητα crosshair-center-square + changelog).
- browser-verify: ένα τετράγωνο (λευκό), τρύπα πάντα στο κέντρο, εξαφάνιση στο snap.
- Ανέφερε στον Giorgio για commit (μην committάρεις).
