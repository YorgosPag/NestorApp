# HANDOFF — ADR-363: ΝΕΑ εντολή «Κολώνα από περίγραμμα» (discrete + lw/bw guard)

**Ημερομηνία:** 2026-06-01
**Συντάκτης:** Opus 4.8 (μετά browser-verify του «Τοιχίο από περίγραμμα» + του loose-line fix)
**ADR:** ADR-363 §6 (Δομικά από περίγραμμα) — νέα Φάση 3c.
**Γλώσσα:** Ελληνικά πάντα. **Commit/push:** ΜΟΝΟ Giorgio (N.(-1)). **Stage:** `git add <specific>`, ΠΟΤΕ `-A`.
**Model/mode:** Opus + **Plan Mode** (orchestrator: ~10-12 αρχεία, 2 domains — N.8). Ξεκίνα με RECOGNITION.

---

## 🎯 ΤΙ ΖΗΤΑΕΙ Ο GIORGIO

Νέα εντολή στο dropdown «Δομικά Στοιχεία» → **«Κολώνα από περίγραμμα»**, δίπλα στο υπάρχον «Τοιχίο από περίγραμμα». Δημιουργεί **κολώνες** από box-select περιγραμμάτων, με τον ίδιο τρόπο που το «Τοιχίο» δημιουργεί τοιχία, αλλά με σεβασμό στο κριτήριο `lw/bw` (κολώνα vs τοιχίο).

## ✅ ΑΠΟΦΑΣΕΙΣ (κλειδωμένες με Giorgio 2026-06-01)

1. **NO union** (`unionTouching:false`). Κάθε κλειστό ορθογώνιο/περίγραμμα = **ΞΕΧΩΡΙΣΤΗ** κολώνα. Σε αντίθεση με το «Τοιχίο» (που ενώνει εφαπτόμενα σε σύνθετο Γ/Π).
   - **Γιατί (στατικό, industry):** οι κολώνες είναι διακριτά σημειακά μέλη. Σιωπηλή ένωση 2 κολωνών που ακουμπούν → ψευδο-τοιχίο με **λάθος όπλιση** (κολώνα = διαμήκης + συνδετήρες περίσφιγξης· τοιχίο = πλέγμα κορμού + boundary elements/κρυφοκολώνες). ETABS/Revit/Tekla: column vs wall = ΡΗΤΗ απόφαση μηχανικού, ΠΟΤΕ auto-merge· lw/bw≥4 (EC8 §5.1.2) = κανονιστικό guideline, το λογισμικό προειδοποιεί.
2. **lw/bw guard (confirm dialog):** όταν ένα περίγραμμα έχει `lw/bw ≥ 4` (= γεωμετρικά τοιχίο), ΜΗΝ το φτιάχνεις σιωπηλά κολώνα. Εμφάνισε dialog με **ακριβές μήνυμα Giorgio**:
   > «Οι αναλογίες του περιγράμματος αντιστοιχούν σε τοιχίο και όχι σε κολώνα. Θέλετε να δημιουργήσετε τοιχίο;»
   - Κουμπιά: **[Τοιχίο]** (→ δημιούργησέ το ως τοιχίο, shear-wall/composite) / **[Κολώνα παρόλα αυτά]** / **[Άκυρο]**.
   - Non-rectangular περιγράμματα (L/T/U/composite) είναι εξ ορισμού σύνθετα/τοιχία → πέφτουν κι αυτά στο guard (δεν είναι «κολώνες»).

**Σύσταση υλοποίησης guard (καθαρότερη από per-perimeter dialog):** μετά το box-select, διαχώρισε τα perimeters σε `column-like` (rectangle με `lw/bw < 4`) και `wall-like` (rectangle ≥4 Ή non-rectangular). Δημιούργησε αμέσως τις κολώνες· αν υπάρχουν wall-like, **ΕΝΑ** confirm dialog («N περιγράμματα αντιστοιχούν σε τοιχία…») → αν [Τοιχίο] δημιούργησέ τα ως τοιχία (reuse `unionTouching` column path), αν [Κολώνα] φτιάξ' τα rectangular/composite κολώνες.

## 🔍 RECOGNITION — ΥΠΑΡΧΟΥΣΑ ΑΡΧΙΤΕΚΤΟΝΙΚΗ (code = source of truth)

**Το υπάρχον «Τοιχίο από περίγραμμα» ΗΔΗ παράγει `ColumnEntity` ΚΑΙ ΗΔΗ εφαρμόζει lw/bw:**
- `bim/columns/column-from-faces.ts` → `rectColumnPlacement`: `aspect ≥ SHEAR_WALL_MIN_ASPECT_RATIO (=4) ? 'shear-wall' : 'rectangular'`. `perimeterFacesToColumns` καλεί `perimeterFacesToRects(entities, tol, { unionTouching: true })`.
- Άρα η ΜΟΝΗ ουσιαστική διαφορά της νέας εντολής = **`unionTouching:false` + lw/bw guard/dialog**. Μέγιστο reuse.

**Tool wiring του υπάρχοντος `column-from-perimeter` (mirror ΑΚΡΙΒΩΣ αυτά για το νέο tool):**
| Αρχείο | Σημείο |
|---|---|
| `ui/toolbar/types.ts` | `ToolType` += νέο id (γρ. ~133, δίπλα στο `'column-from-perimeter'`) |
| `systems/tools/tool-definitions.ts` | νέο entry (γρ. ~169, αντίγραψε `column-from-perimeter`) |
| `ui/ribbon/data/home-tab-draw.ts` | dropdown entry (γρ. ~341-345· `commandKey`, `labelKey`, `tooltipKey`) |
| `app/ribbon-contextual-config.ts` | γρ. ~100 (contextual tab gate) |
| `hooks/tools/useSpecialTools.ts` | γρ. ~401-407 (`isColumnTool` + `setPlacementMode`) |
| `hooks/drawing/useColumnTool.ts` | `ColumnPlacementMode` (γρ. ~114), `onPerimeterClick` + box-select listener (γρ. ~287-314), `regionTol` |
| `hooks/canvas/useCanvasClickHandler.ts` | γρ. ~260-264 (click-inside gate) |
| `systems/cursor/useCentralizedMouseHandlers.ts` | γρ. ~196 (box-select gate) |
| `systems/cursor/mouse-handler-up.ts` | γρ. ~335 |
| `systems/cursor/mouse-handler-move.ts` | γρ. ~394 |
| `canvas-v2/dxf-canvas/dxf-canvas-renderer.ts` | γρ. ~191 (box-select visual gate) |
| `systems/events/EventBus.ts` | event `'bim:columns-from-perimeter' { built, ignored }` (reuse ή νέο) |
| `hooks/useDxfViewerNotifications.ts` | γρ. ~54-58 (`perimeterColumn.noneBuilt` / `builtWithIgnored` toasts) |
| `i18n/locales/{el,en}/dxf-viewer-shell.json` | `perimeterColumn.*`, `columnFromPerimeter.{label,tooltip}` |

**Confirm dialog SSoT:** χρησιμοποίησε `@/components/ui/dialog` (Radix, ADR-001) — mirror υπάρχοντος confirm pattern (π.χ. delete-confirm / AdminLayerManagerDialog store singleton). Async flow: box-select → compute → αν wall-like υπάρχουν → open dialog → on-confirm δημιούργησε.

**lw/bw helper:** για rectangle perimeter, `rect.longSide / rect.shortSide` (ήδη στο `DetectedRectangle`). `SHEAR_WALL_MIN_ASPECT_RATIO = 4` (`bim/types/column-types.ts`).

## 🏗️ ΣΧΕΔΙΟ ΥΛΟΠΟΙΗΣΗΣ (Plan Mode → επιβεβαίωση)

1. **Νέο tool id** (πρόταση: `'column-discrete-from-perimeter'`, label «Κολώνα από περίγραμμα»). Mirror όλο το wiring του πίνακα πάνω.
2. **`useColumnTool`:** νέο `placementMode` (π.χ. `'discrete-perimeter'`) ή param `unionTouching`. Το box-select listener καλεί νέα orchestrator `perimeterFacesToColumns(selected, tol, levelId, sceneUnits, { unionTouching: false })`.
3. **`column-from-faces.ts`:** `perimeterFacesToColumns` += optional `{ unionTouching?: boolean }` (default true για backward-compat του «Τοιχίο»). Νέα λογική διαχωρισμού column-like/wall-like + επιστροφή για guard.
4. **Confirm dialog** (νέο store + host, mirror υπαρχόντων) με το ακριβές μήνυμα Giorgio + 3 κουμπιά.
5. **i18n** el+en (label/tooltip/dialog/toasts) — ΠΟΤΕ hardcoded (N.11).
6. **Tests:** lw/bw split (rect 750×250 → κολώνα· 250×1000 → wall-like· non-rect → wall-like)· no-union (2 εφαπτόμενα → 2 κολώνες, ΟΧΙ 1 Γ)· dialog branch logic.

## 🧪 BROWSER VERIFY (μετά)
Box-select 2 ξεχωριστά ορθογώνια (lw/bw<4) → 2 κολώνες. Box-select επίμηκες (≥4) → dialog «αντιστοιχεί σε τοιχίο…». Σύγκριση: «Τοιχίο από περίγραμμα» στα ίδια → ενωμένο/σύνθετο.

## 📌 N.15 TRACKERS (μετά τη διόρθωση)
ADR-363 §6 changelog (Φ3c) · §12 · `adr-index.md` · `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (ΟΜΑΔΑ «από περίγραμμα») · memory `project_adr363_from_perimeter_walls.md`.

---

## ✅ ΚΑΤΑΣΤΑΣΗ ΠΡΙΝ ΤΟ HANDOFF (committed — μην τα ξαναφτιάξεις)
- **copy+mirror persistence fix** → committed `91c08dc5` (browser-verified ✅).
- **ADR-363/401/404 batch** (perimeter Φ2b/Φ3b + tilt) → committed `4d21ae6e` (Giorgio, με size-split).
- **loose-line touching-rects fix** (`detectTouchingRects` στο `perimeter-from-faces.ts` + 5 tests) → **pending commit** (23/23+27/27, tsc 0, browser-verified ✅ «τώρα λειτουργεί»). ADR-363 §12 + ΕΚΚΡΕΜΟΤΗΤΕΣ + memory ενημερωμένα. **Πρέπει να γίνει commit** (ρώτα Giorgio) — αρχεία: `bim/walls/perimeter-from-faces.ts` + `__tests__/perimeter-from-faces.test.ts` + `ADR-363-bim-drawing-mode.md`.

⚠️ Junk αρχείο στο root (`C：Nestor_Pagonis...__tmp_diag.test.ts`, κατεστραμμένο όνομα) — να σβηστεί χειροκίνητα, ΜΗΝ committαριστεί.
