# HANDOFF — Μέγεθος λαβών (grips) «άλλοτε μεγάλο, άλλοτε μικρό»

**Ημερομηνία:** 2026-06-20
**Κατάσταση:** SSOT AUDIT ΟΛΟΚΛΗΡΩΘΗΚΕ — ΚΑΜΙΑ αλλαγή κώδικα ακόμη.
**Εντολή Giorgio:** Revit-grade, FULL ENTERPRISE + FULL SSOT. Commit τον κάνει ο Giorgio.
**⚠️ Working tree μοιράζεται με άλλον agent** → ΜΗΝ αγγίξεις `bim/structural/*`, `codes/*` (ADR-499/άλλα). Μένεις στο grip-rendering scope.

---

## 0. ΤΟ ΠΑΡΑΠΟΝΟ
Οι τετράγωνες μπλε λαβές μιας επιλεγμένης οντότητας (στο screenshot: κολώνα) εμφανίζονται **άλλοτε μεγάλες, άλλοτε μικρές** μεταξύ διαφορετικών στιγμών. Ερώτημα Giorgio: **πού** βρίσκεται και **ποιος είναι ο μηχανισμός**.

---

## 1. SSOT AUDIT — ΤΙ ΒΡΕΘΗΚΕ (grep, πραγματικός κώδικας)

### 1.1 Ο πυρήνας μεγέθους είναι ΗΔΗ ΕΝΑΣ (SSoT) ✅
- **`rendering/grips/GripSizeCalculator.ts`** → `calculateSize(baseSize, temperature, dpiScale, customMultiplier?)`
  - `size = baseSize × tempMult × (customMult) × dpiScale`, μετά `clamp(size, 3, 30)`, `Math.round`.
- **`rendering/grips/constants.ts`**:
  - `GRIP_SIZE_MULTIPLIERS`: COLD 1.0 · WARM 1.25 · HOT 1.5 · ARMED 1.25 · (snappable→COLD)
  - `EDGE_GRIP_SIZE_MULTIPLIERS`: COLD 1.0 · WARM 1.4 · HOT 1.6 · ARMED 1.4
  - `MIDPOINT_SIZE_FACTOR = 0.75` · `MIN_GRIP_SIZE = 3` · `MAX_GRIP_SIZE = 30`
- Όλα τα render paths περνούν από τον **ίδιο** `UnifiedGripRenderer` (facade) → καλεί τον ΕΝΑ `GripSizeCalculator`:
  - `systems/phase-manager/renderers/GripPhaseRenderer.ts` (selection grips — ΑΥΤΟ τραβάει η κολώνα)
  - `bim/renderers/MepWireRenderer.ts` (MEP)
  - `canvas-v2/layer-canvas/layer-polygon-renderer.ts`, `utils/overlay-drawing.ts`, `canvas-v2/preview-canvas/*`

**ΣΥΜΠΕΡΑΣΜΑ A:** Το μέγεθος υπολογίζεται σε **screen pixels** (zoom-independent). **ΔΕΝ** υπάρχει path που σχεδιάζει λαβές σε world units / πολλαπλασιασμένες με `transform.scale`. (Το `scale` εμπλέκεται ΜΟΝΟ σε hit-testing px→world, όχι στο render μέγεθος.)

### 1.2 Το base size (14) — δύο πηγές, προς το παρόν ΙΣΕΣ ⚠️
- `stores/GripStyleStore.ts` → default `gripSize: 14`
- `config/text-rendering-config.ts` → `UI_SIZE_DEFAULTS.GRIP_SIZE = 14` (fallback)
- Είναι ίσες ΤΩΡΑ → δεν αποκλίνουν σήμερα, αλλά είναι **δύο πηγές αλήθειας** για το ίδιο νούμερο (latent SSoT smell).

### 1.3 Ο πιθανός ΠΡΑΓΜΑΤΙΚΟΣ μηχανισμός μεταβλητότητας 🔴
Το live base `gripSize` δεν διαβάζεται απευθείας — περνά από:
`GripPhaseRenderer.renderStandardGrips` → `getGripPreviewStyleWithOverride()` (στο `hooks/useGripPreviewStyle.ts`).

Αυτή η συνάρτηση διαβάζει ένα **module-level mutable global**:
```
let draftGripSettingsStore: { overrideGlobalSettings: boolean; settings: Partial<GripPreviewStyle> } | null
```
- Αν `overrideGlobalSettings === true` → επιστρέφει `settings.gripSize ?? UI_SIZE_DEFAULTS.GRIP_SIZE` (η **override** τιμή).
- Αλλιώς → `getGripPreviewStyle()` = `gripStyleStore.gripSize` (η **γενική** τιμή 14).

➡️ Όποιο panel ρυθμίσεων grips γράφτηκε τελευταίο μέσω `updateDraftGripSettingsStore(...)` **διαρρέει το μέγεθός του σε ΟΛΕΣ τις λαβές** του viewer, μέχρι να καθαριστεί/ξανα-γραφτεί το global. Αυτό είναι ο **#1 ύποπτος** για «άλλοτε μεγάλο/άλλοτε μικρό» χωρίς ο χρήστης να το συνδέει με ενέργειά του.

### 1.4 By-design διαφορές μεγέθους (ΟΧΙ bug — AutoCAD/Revit standard)
- **Temperature**: cold 14px → warm(hover) ~18px → hot(active/drag) ~21px → armed ~18px. Άρα κατά το hover/click οι λαβές ΜΕΓΑΛΩΝΟΥΝ 25–50%.
- **Τύπος λαβής**: vertex (×1.0) vs midpoint (×0.75) vs edge (EDGE mults) vs BIM move/rotation glyph (`arm = max(5, size)`).
- **Screen-constant vs zoom (perception)**: επειδή οι λαβές είναι σταθερά pixels, σε zoom-out φαίνονται **μεγάλες σε σχέση** με τη μικρή κολώνα, σε zoom-in **μικρές σε σχέση**. Αυτή είναι η **σωστή** Revit/AutoCAD συμπεριφορά — πιθανότατα ΑΥΤΟ που βλέπει ο Giorgio οπτικά.

---

## 2. ΑΝΟΙΧΤΗ ΑΠΟΦΑΣΗ (χρειάζεται από Giorgio ΠΡΙΝ τον κώδικα)
Η υλοποίηση διαφέρει ριζικά ανάλογα με το ΠΟΙΑ από τις 3 μεταβλητότητες θεωρεί «πρόβλημα»:

| # | Μεταβλητότητα | Είναι bug; | Fix |
|---|---|---|---|
| A | **Override-leak** (§1.3) — global `draftGripSettingsStore` αλλάζει το base σε όλους | ΝΑΙ (SSoT violation) | Κατάργηση mutable global → ΕΝΑ reactive store· scope το override στο entity/context που του ανήκει |
| B | **Zoom-perception** (§1.4) — σταθερά px ⇒ σχετικά μεγάλες/μικρές | ΟΧΙ (Revit standard) | Καμία — ή προαιρετικό «min/max world clamp» αν τις θέλει να μην κυριαρχούν σε zoom-out |
| C | **Temperature** (§1.4) — hover/active μεγαλώνει | ΟΧΙ (AutoCAD standard) | Καμία |
| D | **Δύο base defaults** (§1.2) — 14 σε 2 σημεία | latent | Ενοποίηση: `GripStyleStore` διαβάζει `UI_SIZE_DEFAULTS.GRIP_SIZE` (μία πηγή) |

**Πιο πιθανό target = A + D** (πραγματικά SSoT/enterprise προβλήματα). B/C είναι σωστά «by design».

---

## 3. ΠΡΟΤΕΙΝΟΜΕΝΗ ΥΛΟΠΟΙΗΣΗ (Revit-grade, FULL SSoT) — για επιβεβαίωση
1. **D (μηδέν ρίσκο):** `GripStyleStore.gripSize` default → `UI_SIZE_DEFAULTS.GRIP_SIZE` (drop το hardcoded 14).
2. **A (η ουσία):** Αντικατάσταση του `draftGripSettingsStore` module-global με κανονικό subscribable store (mirror `gripStyleStore`), με ΣΑΦΕΣ scope (per-tool/per-entity override) — ώστε άνοιγμα ενός settings panel να ΜΗΝ διαρρέει μέγεθος στις υπόλοιπες λαβές. Καθαρισμός override on tool-exit.
3. **(προαιρετικό B):** μόνο αν το ζητήσει — world-aware min/max clamp για zoom-out.
4. Tests: `GripSizeCalculator` ήδη έχει· πρόσθεσε override-isolation test.

---

## 4. ΑΡΧΕΙΑ-ΚΛΕΙΔΙΑ (scope grip-rendering μόνο)
- `src/subapps/dxf-viewer/rendering/grips/GripSizeCalculator.ts` — υπολογισμός (SSoT, μην αλλάξεις τη μαθηματική)
- `src/subapps/dxf-viewer/rendering/grips/constants.ts` — multipliers + MIN/MAX
- `src/subapps/dxf-viewer/stores/GripStyleStore.ts` — base/dpiScale store (§1.2 / fix D)
- `src/subapps/dxf-viewer/hooks/useGripPreviewStyle.ts` — **`draftGripSettingsStore` global (§1.3 / fix A)**
- `src/subapps/dxf-viewer/systems/phase-manager/renderers/GripPhaseRenderer.ts` — selection grip path (dpiScale hardcoded 1.0)
- `src/subapps/dxf-viewer/config/text-rendering-config.ts` — `UI_SIZE_DEFAULTS.GRIP_SIZE = 14`
- ADRs: **ADR-048** (unified grip rendering), **ADR-183** (unified grip system), **ADR-075/106/107** (size multipliers/defaults), **ADR-501** (armed)

## 5. ΤΙ ΝΑ ΜΗΝ ΚΑΝΕΙΣ
- ΜΗΝ μετατρέψεις το grip render σε world-units (θα σπάσει το AutoCAD/Revit screen-constant standard).
- ΜΗΝ αγγίξεις τη μαθηματική του `GripSizeCalculator` / τους multipliers χωρίς εντολή.
- ΜΗΝ αγγίξεις `bim/structural/*`, `codes/*` — δουλεύει άλλος agent (shared tree).
- ΜΗΝ κάνεις commit — ο Giorgio το κάνει.
- Πρώτα ΕΠΙΒΕΒΑΙΩΣΕ με Giorgio ποιο από A/B/C/D είναι το «πρόβλημα» — μετά κώδικας.
