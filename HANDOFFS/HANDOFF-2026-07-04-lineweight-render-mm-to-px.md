# HANDOFF — Σύνδεση «Πάχος γραμμής σε mm» στο πραγματικό render (DXF Viewer)

**Ημερομηνία:** 2026-07-04
**Προηγούμενο:** ADR-570 Φ1 (Named Line-Style SSoT) **υλοποιήθηκε** — βλ. §1.
**Επόμενο βήμα (ΑΥΤΟ ΤΟ TASK):** Το `lineweightMm` (χιλιοστά) **δεν ζωγραφίζεται ποτέ** — να συνδεθεί
το resolved mm-πάχος στο πραγματικό stroke (px), big-player-grade + full SSoT.

---

## 0. ΚΑΝΟΝΕΣ — ΜΗΝ ΤΟΥΣ ΞΕΧΑΣΕΙΣ

- 🗣️ Απαντάς **στα Ελληνικά** πάντα (ο Giorgio γράφει Ελληνικά).
- 🚫 **ΟΧΙ commit / ΟΧΙ push** — τα κάνει **ο Giorgio**. Ετοίμασε δουλειά, σταμάτα.
- 🤝 **Κοινό working tree με άλλον agent.** ΠΟΤΕ bulk `git restore .` / `reset --hard` / checkout
  αρχείων άλλου. Μόνο `git add <specific>` + verify `git diff --cached`. Ο άλλος agent φτιάχνει
  αυτή τη στιγμή combobox αρχεία (`statusbar/StatusBarEditableCombobox.tsx`, `linetype-ribbon-options.ts`).
- 🚫 **ΟΧΙ `tsc` / typecheck** από agent (N.17) — γράψε κώδικα και σταμάτα· **jest επιτρέπεται**.
- 🧩 **Big-player fidelity:** υλοποίηση όπως **AutoCAD / Revit / Maxon (C4D) / Figma-level**, full
  enterprise + full SSoT. Αν οι μεγάλοι δεν το προτείνουν → ακολούθησε την πρακτική τους.
- 🔎 **ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT (grep) ΠΡΙΝ γράψεις κώδικα** — εντολή Giorgio. Ψάξε αν υπάρχει ήδη
  αντίστοιχος κώδικας (mm→px lineweight) ώστε να τον **επαναχρησιμοποιήσεις**, ΟΧΙ διπλότυπα.
- 🎯 Πρότεινε **μοντέλο (N.14)** στην αρχή και περίμενε «ok».

---

## 1. Τι ΕΓΙΝΕ ΗΔΗ — ADR-570 Φ1 (Named Line-Style SSoT) — μην το ξαναφτιάξεις

**Κατάσταση:** υλοποιήθηκε, wired, 18/18 jest ✅, **ΔΕΝ έχει γίνει commit** (ο Giorgio θα κάνει).
Λειτουργεί σωστά (επιβεβαιώθηκε: το dropdown «Στυλ Γραμμής ▾» εμφανίζεται με τα 8 ελληνικά ονόματα).

**Νέα αρχεία (`src/subapps/dxf-viewer/systems/line-styles/`):**
- `line-style-types.ts` — `LineStyle {id,name,penColor,lineweight,pattern,category,isBuiltIn}` + sentinels
  (`LINE_STYLE_BYLAYER_PEN='ByLayer'`, `LINE_STYLE_BYLAYER_LWT=-2`, `LINE_STYLE_DEFAULT_PATTERN='Continuous'`).
  `LinePatternKey` = catalog linetype name (reuse ADR-358 `linetype-iso-catalog`).
- `line-style-templates.ts` — 8 built-ins (Λεπτή/Μεσαία/Χοντρή/Κρυφή/Κεντρική/Τομής/Όψης/Πρόχειρη),
  ονόματα ως **i18n keys** (`ribbon.commands.lineStyleNames.*`, N.11). `DEFAULT_ACTIVE=MEDIUM`.
- `line-style-registry.ts` — mirror `dim-style-registry.ts` (seed+CRUD+duplicate+subscribe+cachedSnapshot
  +singleton `getLineStyleRegistry()` + module `getLineStyleSnapshot`/`subscribeLineStyles` + test setter).
- `line-style-resolver.ts` — pure `resolveLineStyle(lineStyleId, overrides, registry)` → **override → ByStyle → ByLayer**.
- `ui/ribbon/data/line-style-ribbon-options.ts` — `buildLineStyleRibbonOptions(styles)`.
- `__tests__/line-style-registry.test.ts` — 18 tests.

**Additive edits:** `generateLineStyleId()` (prefix `linestyle`, 4 σημεία enterprise-id) · `BaseEntity.lineStyleId?` ·
`LINE_TOOL_RIBBON_KEYS.lineStyle` · picker στο `contextual-line-tool-tab.ts` (panel `line-general`) ·
bridge cases στο `useRibbonLineToolBridge.ts` (`byStylePatch` εφαρμόζει linetype/lineweight/color + pointer,
undoable· draw-defaults → active style + QuickStyle seed) · locale keys el+en (`quickStyle.lineStyle` +
`lineStyleNames.*`) · ADR-570 changelog ενημερωμένο.

**⚠️ Εκκρεμεί από το Φ1 (πες στον Giorgio):** εγγραφή του `line-style-registry` module στο
`.ssot-registry.json` + `npm run ssot:baseline` (N.12) — αφέθηκε στον Giorgio (baseline-mutating, κοινό tree).

---

## 2. ΤΟ ΠΡΟΒΛΗΜΑ ΑΥΤΟΥ ΤΟΥ TASK — root cause (ΕΠΙΒΕΒΑΙΩΜΕΝΟ)

**Σύμπτωμα (Giorgio):** αλλάζεις το πεδίο «Πάχος» (ή διαλέγεις στυλ που αλλάζει πάχος) → **η γραμμή
δεν παχαίνει ποτέ** στην οθόνη. **ΔΕΝ είναι bug του Φ1** — προϋπάρχει, αφορά το πεδίο «Πάχος» γενικά.

**Ρίζα (χαρτογραφημένη):**
- Το πεδίο «Πάχος» + το style-apply γράφουν **`entity.lineweightMm`** (νέο σύστημα, mm — ADR-510/462).
- Ο resolver `systems/properties/resolve-entity-style.ts` → `resolveEntityStyle()` **διαβάζει σωστά** το
  `lineweightMm` και επιστρέφει `lineweight: ConcreteLineweightMm` (mm) με cascade entity→block→layer→default.
- **ΑΛΛΑ** το πραγματικό stroke ζωγραφίζεται με το **παλιό** `entity.lineWidth ?? entity.lineweight`
  (**pixels**), ΟΧΙ με το resolved mm. Απόδειξη: `rendering/cache/PathCache.ts:198` — το cache key είναι
  `lineWidth: entityWithLineWidth.lineWidth ?? entity.lineweight` (καθόλου `lineweightMm`). Άρα:
  1. Αλλαγή `lineweightMm` **δεν σπάει καν το cache** → stale render.
  2. Το resolved mm-πάχος **δεν φτάνει ποτέ** στο `ctx.lineWidth`.
- Το mm-linetype-dash **είναι** ήδη συνδεδεμένο (`rendering/entities/base-entity-style-helpers.ts` →
  `applyEntityLinetypeDash` → `dashMmToScreenPx`). Το lineweight-mm **δεν έχει το αντίστοιχο**.

**Συνέπεια για το Φ1:** τα στυλ που διαφέρουν σε **τύπο γραμμής** (Κρυφή→διακεκομμένη, Κεντρική) φαίνονται·
όσα διαφέρουν **μόνο σε πάχος** (Λεπτή/Μεσαία/Χοντρή/Τομής/Όψης/Πρόχειρη) δεν φαίνονται μέχρι να φτιαχτεί αυτό.

---

## 3. ΤΙ ΠΡΕΠΕΙ ΝΑ ΓΙΝΕΙ (το task)

**Στόχος:** το resolved `lineweight` (mm) του `resolveEntityStyle` να καταλήγει στο πραγματικό stroke width
(px) των committed entities, big-player-grade + full SSoT, μηδέν διπλότυπα.

### 3.1 ΠΡΩΤΑ — SSoT audit (grep, ΥΠΟΧΡΕΩΤΙΚΟ πριν κώδικα)
- Ψάξε **υπάρχον** mm→px lineweight helper πριν φτιάξεις νέο:
  `grep`: `lineweightToPx`, `lineweightMmToPx`, `mmToPx`, `LINEWEIGHT.*PX`, `lineWidthPx`, `WEIGHT_TO_PX`,
  `lineweightScreen`, `ISO_LINEWEIGHT` στο `src/subapps/dxf-viewer` (config/rendering/systems).
- Δες: `config/lineweight-iso-catalog.ts` (τιμές mm + `LINEWEIGHT_SPECIAL`), `config/default-lineweight-resolver.ts`,
  `rendering/linetype-dash-resolver.ts` (`dashMmToScreenPx` — **πρότυπο** για mm→px, αλλά προσοχή: το dash είναι
  zoom-scaled, το lineweight πρέπει να είναι **zoom-INDEPENDENT** — βλ. 3.3).
- Βρες το **πραγματικό stroke site**: `grep` `ctx.lineWidth` + `lineWidth` σε `canvas-v2/dxf-canvas/DxfRenderer.ts`,
  `rendering/entities/*Renderer.ts`, `rendering/entities/base-entity-rendering-helpers.ts`. Το `PathCache.ts:198`
  είναι **μόνο cache key** — βρες πού μπαίνει το `ctx.lineWidth` στο committed stroke.

### 3.2 Big-player πρακτική (τεκμηρίωσέ την — δεν εφευρίσκεις)
- **AutoCAD:** τα lineweights εμφανίζονται σε **σταθερή κλίμακα pixel** (ΟΧΙ zoom-scaled), με διακόπτη
  **LWDISPLAY** («Show/Hide Lineweight» στο status bar). Model space = px approximation του mm.
- **Revit:** pen-based line weights, thin επί οθόνης, «Thin Lines» toggle.
- **Συμπέρασμα:** mm → **fixed px** μέσω device factor, `Math.max(1, …)` ελάχιστο, ΠΙΘΑΝΟΝ πίσω από
  global toggle «Εμφάνιση Πάχους». (Δεν βρέθηκε υπάρχον `LWDISPLAY`/`showLineweight` toggle — grep ξανά.)

### 3.3 Αποφάσεις που πρέπει να ρωτήσεις τον Giorgio (απλά ελληνικά + παράδειγμα)
1. **Zoom-independent;** (AutoCAD: το πάχος μένει ίδιο σε px όσο κι αν κάνεις zoom). Προτεινόμενο: **ΝΑΙ**.
2. **Global διακόπτης «Εμφάνιση Πάχους»** (default ON για να το βλέπει) ή πάντα-on;
3. mm→px factor + ελάχιστο 1px (π.χ. 0.25mm → πόσα px στο default zoom;).

### 3.4 SSoT + ADR + pre-commit (ΚΡΙΣΙΜΟ)
- Αν φτιάξεις νέο helper `lineweightMmToScreenPx()` → **ένα** SSoT module (mirror `dashMmToScreenPx`),
  reuse `lineweight-iso-catalog` + `LINEWEIGHT_SPECIAL`. Μηδέν διπλότυπα.
- **Πρόσθεσε το `lineweightMm` στο cache key** του `PathCache.calculateEntityHash` (αλλιώς stale render).
- **ADR-040 (perf-critical):** τα αρχεία render (DxfRenderer/entity renderers/PathCache) είναι BLOCKING στο
  pre-commit (CHECK 6B/6C/6D) — **πρέπει να stage-άρεις ADR** (ADR-510 §Φ2 lineweight ή ADR-040 changelog)
  στο ΙΔΙΟ commit, αλλιώς μπλοκάρει. Διάβασε ADR-040 πριν αγγίξεις αυτά τα αρχεία.
- **Δες τι SSoT υπάρχει:** `docs/centralized-systems/README.md` + `reference/adr-index.md`.
- **jest** για τον νέο mm→px helper (γρήγορα, στοχευμένα).

---

## 4. Δευτερεύον — CRASH (χαμηλή προτεραιότητα, μάλλον ΟΧΙ δικό μας)

Runtime `RangeError: Maximum call stack size exceeded` — ατέρμονος βρόχος **Radix Select FocusScope**
(`useFocusVisible.ts:146` ↔ `focus-scope.tsx` ↔ `FocusScope.tsx:373`), σκάει όταν ανοίγει κάποιο dropdown.
Ο κώδικας του Φ1 **δεν έχει λογική focus/Select** (μόνο δεδομένα). Πιθανή πηγή: το **νέο**
`statusbar/StatusBarEditableCombobox.tsx` του **άλλου agent**. Πριν επενδύσεις χρόνο, ρώτα τον Giorgio
**πότε ακριβώς** σκάει (άνοιγμα viewer / «Στυλ Γραμμής» / άλλο dropdown / status bar) για να το αποδώσεις σωστά.

---

## 5. Model
Render-pipeline change σε perf-critical αρχεία + ADR → μάλλον **Opus**. Πρότεινε (N.14), περίμενε «ok».
