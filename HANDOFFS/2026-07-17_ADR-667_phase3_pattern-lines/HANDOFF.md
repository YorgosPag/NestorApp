# HANDOFF — ADR-667 Φ3: Γραμμές μοτίβου + screen-space + backgroundColor

**Ημερομηνία:** 2026-07-17
**Κατάσταση:** Φ1 ✅ · **Φ2 ✅ ΕΠΑΛΗΘΕΥΜΕΝΗ ΣΕ ΠΡΑΓΜΑΤΙΚΟ PDF** («ΤΩΡΑ ΛΕΙΤΟΥΡΓΕΙ», Giorgio). Φ3 **ΔΕΝ ΞΕΚΙΝΗΣΕ.**
**ADR:** `docs/centralized-systems/reference/adrs/ADR-667-pdf-native-tiling-patterns.md` (**ACCEPTED**)

> **ΔΙΑΒΑΣΕ ΠΡΩΤΑ ΤΟ ADR-667.** Οι **Αποφάσεις 6, 7, 8** ΕΙΝΑΙ το design της Φ3 — είναι
> **κλειδωμένες και εγκεκριμένες**. Αυτό το αρχείο είναι ο **οδηγός εκτέλεσης**, όχι υποκατάστατο.

---

## 1. ΤΟ ΠΡΟΒΛΗΜΑ (μία παράγραφος)

Η **Φ2 σκότωσε το γκρι της εικόνας** — τα `fillType:'image'` (+ procedural) βγαίνουν πλέον native
tiling patterns. **Δεν άγγιξε όμως τον default τύπο κάθε νέου hatch:** τα `user-defined` (45°/100mm)
και `predefined` εξακολουθούν να βγαίνουν **μόνο ως περίγραμμα** — άδειο σχήμα. Μαζί τους λείπουν
το `backgroundColor` (φόντο πίσω από τις γραμμές) και το `patternSpace:'screen'` (το **πιο κοινό**
hatch του συστήματος: ο Τέκτων το βάζει σε **ΚΑΘΕ** imported `.tek` hatch). Η Φ3 τα γεμίζει.

---

## 2. ΤΙ ΕΓΙΝΕ ΗΔΗ (ΜΗΝ ΤΟ ΞΑΝΑΚΑΝΕΙΣ)

### Φ2 — υλοποιημένη, **committed** (`fadc8a75` → `0e741162`), επαληθευμένη σε πραγματικό PDF

| Αρχείο | Τι |
|---|---|
| `print/vector/pdf-tiling-pattern.ts` **(ΝΕΟ SSoT)** | `patternMatrixFor` (**ο μόνος** κάτοχος της ακύρωσης του `F`) · `createPdfPatternRegistry` (ανά `draw`, clone-key memoise) · `MAX_PDF_PATTERNS_PER_PAGE = 800` |
| `print/vector/scene-image-resolver.ts` | **ΕΝΑ** `ResolvedPatternCell` αντί για N tiles· cap **στο pre-pass** |
| `print/vector/scene-vector-emitter.ts` | `emitHatch` = **κλειδωμένη σειρά dispatch** + `definePatterns()` στην αρχή του `draw` |
| `print/print-fidelity.ts` | κωδικοί `image-fill:pattern-cap` / `:degenerate-cell` |
| **Νεκρός κώδικας ΕΦΥΓΕ** | `emitClippedImage`, `clipToBoundary`, `buildImageTileFullGrid`, `PDF_TILE_CAP`, `TILE_KEEP_ALL`, `buildTiles` + **τα tests τους** |

**Tests: 127/127 GREEN** (`print/` + `image-fill-export`), εκ των οποίων **11 με ΑΛΗΘΙΝΟ jsPDF**.

### 🔑 Το μάθημα της Φ2 που ισχύει ΑΚΕΡΑΙΟ στη Φ3

> **Η Φ2 βρήκε λάθος στο ίδιο της το ADR επειδή ΜΕΤΡΗΣΕ πριν γράψει κώδικα** (ο ισχυρισμός
> «16 fills → **1** image XObject» ήταν κακομετρημένος: είναι **2** = εικόνα + `/SMask` του άλφα·
> το ουσιώδες —«σταθερό, ανεξάρτητο των fills»— ίσχυε). **Κάνε το ίδιο.** Spike στο scratchpad με
> σκέτο `node` + `jspdf.node.js`, **πριν** γράψεις production κώδικα.

---

## 3. 🔴 ΔΥΟ ΕΥΡΗΜΑΤΑ ΠΟΥ ΘΑ ΣΕ ΜΠΛΟΚΑΡΟΥΝ ΑΜΕΣΩΣ (επαληθευμένα με grep, 2026-07-17)

### Εύρημα Α — τα screen-space constants είναι **module-private**
`rendering/entities/HatchRenderer.ts` — **κανένα δεν εξάγεται**:
```
:55  const HATCH_MIN_LINE_SPACING_PX = 3;
:69  const SCREEN_HATCH_SPACING_PX = 3;
:70  const SCREEN_HATCH_LINE_PX = 1;
:71  const SCREEN_HATCH_TILE_W = 8;
:72  const SCREEN_HATCH_DEFAULT_ANGLE_DEG = 45;
```
⇒ Αν τα χρειαστείς, **ΜΗΝ γράψεις `45` / `3` ξανά** (N.18 sibling clone — το jscpd ΔΕΝ πιάνει ένα
σκέτο literal, θα περάσει και θα είναι **λάθος**). **EXTRACT πρώτα** σε shared SSoT (π.χ.
`rendering/entities/shared/screen-hatch-constants.ts`), import και στα δύο. Το `HatchRenderer`
είναι canvas-critical (ADR-040) — **μόνο** μετακίνηση σταθερών, μηδέν αλλαγή λογικής.

### Εύρημα Β — το `buildHatchEntitySegments` **ΔΕΝ γνωρίζει καν** το `patternSpace`
`bim/geometry/shared/hatch-pattern-geometry.ts:338-345` — το `Pick<>` περιέχει:
`boundaryPaths | fillType | patternType | patternName | patternScale | patternAngle |
patternOrigin | lineAngle | lineSpacing | doubleCrossHatch | islandStyle | inlinePattern`
**Το `patternSpace` ΛΕΙΠΕΙ.**
⇒ Επιβεβαιώνει την **Απόφαση 6**: το `patternSpace` είναι **ΟΡΘΟΓΩΝΙΑ διάσταση**, όχι κλάδος του
`fillType`. Αν το αγνοήσεις, βγάζεις **world-space γραμμές που ΠΟΤΕ δεν εμφανίστηκαν στην οθόνη**.
Ο `HatchRenderer.ts:227-231` το πιάνει **ΠΡΙΝ** τους world-space κλάδους — καθρέφτισέ το.

### ⚠️ Εύρημα Γ — το `pdf-tiling-pattern.ts` υποθέτει **RASTER** κελί (δικό μου, της Φ2)
Το `defineCell()` κάνει **σκέτο `pdf.addImage(cell.dataUrl, …)`**. Το `PdfPatternCell` έχει
`dataUrl: string`. **Το vector stripe cell της Απόφασης 6 ΔΕΝ χωράει έτσι.**
⇒ Θα χρειαστεί **επέκταση** (π.χ. discriminated union `{kind:'raster', dataUrl}` |
`{kind:'vector', drawCell:(pdf)=>void}`). **Επέκτεινε, ΜΗΝ κλωνοποιήσεις** το module — η ακύρωση
του `F` + το registry + το memoise πρέπει να μείνουν **ΕΝΑ**.
🔬 **ΑΝΕΠΑΛΗΘΕΥΤΟ — spike το ΠΡΩΤΟ:** μέσα στο `beginTilingPattern` το `apiMode = ADVANCED` ⇒
**RAW συντεταγμένες** (μηδέν `scaleFactor`, μηδέν Y-flip). Πώς ακριβώς συμπεριφέρονται τα
`pdf.lines`/`setLineWidth` **εκεί μέσα** **δεν το έχω μετρήσει**. Μη το υποθέσεις — μέτρησέ το.

---

## 4. ΤΙ ΠΡΕΠΕΙ ΝΑ ΚΑΝΕΙΣ (Φ3)

### ΒΗΜΑ 0 — SSoT AUDIT ΜΕ GREP (ΥΠΟΧΡΕΩΤΙΚΟ, ρητή εντολή Giorgio)
Πραγματικό grep, όχι υπόθεση. Ο πίνακας §6 λέει πού — **επιβεβαίωσέ τον**. Στόχος:
**χρησιμοποίησε** τον υπάρχοντα κώδικα, **μη φτιάξεις διπλότυπα**.

### ΒΗΜΑ 1 — Budget guard **στο async pre-pass** (Απόφαση 7)
🔴 **ΧΩΡΙΣ GUARD ΤΟ EXPLODE ΠΑΓΩΝΕΙ ΤΟΝ BROWSER — ΕΙΝΑΙ ΗΔΗ ΜΕΤΡΗΜΕΝΟ:**
- `export/core/tek/tek-hatch-explode.ts:50-57` → 400×400 boundary με βήμα 0.127 = **164s**
- `bim/geometry/shared/hatch-pattern-geometry.ts:398-406` → απουσία guard = **OOM 4GB**
- `clipSegmentToRegion` = **O(lines × boundary_edges)**

⇒ **Θα αντικαθιστούσες ένα ορατό λάθος (κενό σχήμα) με ένα αόρατο πάγωμα. Απαράδεκτο.**

**Κανόνας — μηδέν νέα budget logic, ΟΛΑ υπάρχουν (επαληθευμένα):**
- `estimateHatchFillLines()` — `tek-hatch-explode.ts:59` — τρέχει **ΠΡΙΝ** το `buildHatchEntitySegments`
- `MAX_TEK_FILL_LINES_PER_HATCH = 40_000` (`:41`) · `MAX_TEK_FILL_LINES_TOTAL = 120_000` (`:47`)
- Πρότυπο χρήσης **έτοιμο**: `tek-hatch-explode.ts:111-126` (budget accumulator) — **μίμησέ το**

### ΒΗΜΑ 2 — 🔴 ΤΟ ΠΙΟ ΚΡΙΣΙΜΟ ΑΡΧΙΤΕΚΤΟΝΙΚΟ: **pre-pass, ΟΧΙ `draw`**
Το `capture.fidelity` το διαβάζει ο `runPrint` **ΑΦΟΥ** γυρίσει το capture και **ΠΡΙΝ** τρέξει το
`draw` (`print-service.ts:167`) ⇒ **ό,τι αποφασιστεί μέσα στο `draw` ΔΕΝ μπορεί ΠΟΤΕ να αναφερθεί.**
**Η Φ2 το επιβεβαίωσε στην πράξη** (γι' αυτό ο pattern cap μετακινήθηκε στο pre-pass).
Το `draw` είναι **σύγχρονο** (ADR-040) — ο κανόνας δεν κάμπτεται.

⇒ Χρειάζεσαι **sibling pre-pass** (π.χ. `print/vector/scene-hatch-line-resolver.ts`): hatch id →
segments **ή** υποβάθμιση+warning. Το `capture-2d-vector.ts:112` κάνει σήμερα
`summarizePrintFidelity(images.warnings)` ⇒ **πρέπει να ενώσει τα warnings ΚΑΙ των δύο pre-pass**
(το `mergePrintFidelity` **υπάρχει ήδη** στο `print-fidelity.ts` — χρησιμοποίησέ το).
Νέοι κωδικοί → **`print-fidelity.ts`** (exhaustive `Record` ⇒ κωδικός χωρίς μήνυμα **δεν κάνει
compile**) + i18n **el ΚΑΙ en**.

### ΒΗΜΑ 3 — Οι τρεις κλάδοι στο `emitHatch` (η σειρά ΕΙΝΑΙ ΝΟΜΟΣ — Απόφαση 5)
Η σημερινή σειρά (Φ2) στο `scene-vector-emitter.ts`:
`1. dxfFaces → 2. isSolidHatch → 3. pattern (image) → 4. solid fallback → ΔΑΠΕΔΟ outline`
Η Φ3 **παρεμβάλλει** (μη χαλάσεις τη σειρά — το `fillType` είναι optional!):
| # | Έλεγχος | Ενέργεια | Κάτοπτρο οθόνης |
|---|---|---|---|
| 3 | `backgroundColor` **αν όχι** solid/gradient/image | pre-fill **ΠΙΣΩ** από τις γραμμές | `HatchRenderer.ts:215-218` |
| 5 | `patternSpace === 'screen'` | **tiling pattern** (vector stripe cell) | `HatchRenderer.ts:227-231` |
| 7 | αλλιώς (`predefined`/`user-defined`) | **exploded segments**, budget-guarded | `HatchRenderer.ts:243-246` |
| 6 | `fillType === 'gradient'` | outline (⏳ **Φ4**, μην το πιάσεις) | — |

**Το outline παραμένει ΔΑΠΕΔΟ** (Απόφαση 8): `segments.length ? segments : outline`. Το
`buildHatchEntitySegments` γυρίζει `[]` σε catalog MISS (`:373-379`), gradient (`:349`), boundary
<3 σημεία (`:350`) ⇒ **καμία διαδρομή δεν καταλήγει σε «τίποτα»**.

### ΒΗΜΑ 4 — Η αντιστοιχία οθόνης↔χαρτιού (Απόφαση 6 — **ρητή, τεκμηριωμένη απόκλιση**)
| | Οθόνη | Χαρτί |
|---|---|---|
| Πυκνότητα | **3 px** σταθερά (zoom-independent) | **`SCREEN_HATCH_PAPER_SPACING_MM = 0.8`** |
| Απόδοση | raster `CanvasPattern` | **vector** stripe cell |
| Γωνία | 45° | ίδια, μέσω pattern `/Matrix` |

**Γιατί 0.8mm:** 3px @ 96dpi ≈ 0.79mm — **ίδια οπτική πυκνότητα** στο 100% zoom.
**Γιατί vector:** ένα 3-pixel bitmap στα 300+ dpi του χαρτιού είναι **θολή λάσπη**. Η οθόνη είναι
raster επειδή το zoom-independence το απαιτεί· **το χαρτί δεν έχει zoom**.
**Ο screen density-LOD (`isLineDensityTooHigh`) ΔΕΝ μεταφέρεται** — είναι συνάρτηση του zoom. Τη
θέση του παίρνει το budget guard.

### ΒΗΜΑ 5 — Γωνία: **η οθόνη είναι η αλήθεια** (Απόφαση 12)
Το `patternMatrixFor` δέχεται **visual-clockwise**. Η Φ2 το κλείδωσε με test **45° σε ΑΣΥΜΜΕΤΡΟ
κελί** (τετράγωνο στις 45° είναι συμμετρικό ⇒ **δεν** πιάνει το mirror). Κάνε το ίδιο.

### ΒΗΜΑ 6 — ΠΡΙΝ πεις «done»
```
npm run jscpd:diff <τα δικά σου αρχεία>          # N.18 — ΥΠΟΧΡΕΩΤΙΚΟ
npx jest src/subapps/dxf-viewer/print            # 127/127 πρέπει να ΜΕΙΝΟΥΝ GREEN
npx eslint <τα δικά σου αρχεία>
```
**Ενημέρωσε το changelog του ADR-667** (Phase 3, N.0.1 — υποχρεωτικό).

### ΒΗΜΑ 7 — 🔒 Η ΕΠΑΛΗΘΕΥΣΗ ΔΕΝ ΕΙΝΑΙ ΤΑ TESTS
Ο χρήστης βρήκε **και** επιβεβαίωσε το bug της Φ2 **κοιτάζοντας PDF**. **Ζήτα από τον Giorgio να
εξάγει σχέδιο με `user-defined` hatch (+ ένα imported `.tek`) και να το δει.**

---

## 5. ❌ ΜΗΝ ΤΑ ΚΑΝΕΙΣ

- **ΜΗΝ** κάνεις explode **χωρίς** τον υπάρχοντα budget guard → **164s / OOM 4GB** (§4 ΒΗΜΑ 1).
- **ΜΗΝ** βάλεις τον budget υπολογισμό **μέσα στο `draw`** → η υποβάθμιση **δεν αναφέρεται ποτέ**.
- **ΜΗΝ** γράψεις `switch (fillType)` → το `fillType` είναι **optional**· οι παραγωγοί `dxfFaces`
  **δεν το θέτουν** ⇒ **κάθε structural/poché solid γίνεται άδειο περίγραμμα**.
- **ΜΗΝ** αγγίξεις το `export/core/image-fill-export.ts` **DXF path** (Απόφαση 13). Οι δύο caps
  (`IMAGE_GRID_SCAN_CAP=4000` scan / `IMAGE_TILE_CAP=400` placement) **ΔΕΝ είναι διπλοτυπία** —
  είναι **σκόπιμος διβάθμιος φρουρός**. «Ενοποίηση» → **DXF regression** που τα tests **δεν** πιάνουν.
- **ΜΗΝ** ορίσεις patterns **lazily μέσα στο draw** → unbalanced render-target stack ⇒ **λευκή
  σελίδα, κανένα σφάλμα** (Απόφαση 10). Ο ορισμός ζει στο `definePatterns()`, στην **αρχή**.
- **ΜΗΝ** κλωνοποιήσεις το `pdf-tiling-pattern.ts` για vector κελιά — **επέκτεινέ** το (§3 Γ).
- **ΜΗΝ** πιάσεις το `gradient` — είναι **Φ4** (PDF shading patterns, Type 2/3).
- **ΜΗΝ** αγγίξεις το `entity-export-coverage` (αστοχεί για `leader`/`topo-surface`) — είναι **ξένη
  in-flight δουλειά** (ADR-662 πρόσθεσε renderable types χωρίς να ενημερώσει το coverage SSoT).
- **ΜΗΝ** πειράξεις το `print/capture/capture-2d.ts` (raster fallback) — **δουλεύει σωστά**.

---

## 6. SSoT — ΧΡΗΣΙΜΟΠΟΙΗΣΕ ΤΑ, ΜΗΝ ΤΑ ΞΑΝΑΓΡΑΨΕΙΣ (γραμμές επαληθευμένες 2026-07-17)

| SSoT | Πού | Χρήση στη Φ3 |
|---|---|---|
| `estimateHatchFillLines` | `export/core/tek/tek-hatch-explode.ts:59` | Budget guard **αυτούσιο** |
| `MAX_TEK_FILL_LINES_PER_HATCH/TOTAL` | `tek-hatch-explode.ts:41,47` | Budgets **mirror**, μηδέν νέα |
| budget accumulator pattern | `tek-hatch-explode.ts:111-126` | **Πρότυπο** — μίμησέ το |
| `buildHatchEntitySegments` | `bim/geometry/shared/hatch-pattern-geometry.ts:338` | Γραμμές μοτίβου (⚠️ **δεν ξέρει** `patternSpace`) |
| `isSolidHatch` | `bim/hatch/hatch-properties.ts:49` | Dispatch #2 (ήδη σε χρήση) |
| `patternMatrixFor` / `createPdfPatternRegistry` | `print/vector/pdf-tiling-pattern.ts` | **Επέκτεινε** για vector κελιά |
| `summarizePrintFidelity` / `mergePrintFidelity` | `print/print-fidelity.ts` | Ένωση warnings **δύο** pre-pass |
| `SCREEN_HATCH_*` (5 σταθερές) | `rendering/entities/HatchRenderer.ts:55,69-72` | ⚠️ **module-private → EXTRACT πρώτα** |
| `HatchRenderer.render()` | `rendering/entities/HatchRenderer.ts:178-254` | **Ο στόχος πιστότητας** — 7 κλάδοι |
| `tek-hatch-to-bim.ts:102` | `io/tek/` | Η **απόδειξη** ότι `patternSpace:'screen'` = το πιο κοινό hatch |
| EventBus + `hooks/notifications/*` | `hooks/useDxfViewerNotifications.ts` | Fidelity toasts — **μηδέν νέο κανάλι** |

---

## 7. ΚΑΝΟΝΕΣ (ΑΠΑΡΑΒΑΤΟΙ)

- 🚫 **ΠΟΤΕ `git commit` / `git push`** — **ο Giorgio τα κάνει** (N.-1). Ούτε «επειδή τελείωσε».
- ⚠️ **Το working tree ΜΟΙΡΑΖΕΤΑΙ με άλλον agent** → **ΠΟΤΕ** `git add -A`, **ΠΟΤΕ** bulk
  reset/checkout. Άγγιξε **ΜΟΝΟ** τα δικά σου αρχεία. Αν βρεις `.git/index.lock` **ΜΗΝ το σβήσεις**.
  ℹ️ Ο Giorgio κάνει commit **σε real-time όσο δουλεύεις** — κράτα το δέντρο **deployable σε κάθε βήμα**.
- 🚫 **ΠΟΤΕ `tsc` / `npx tsc` / `npm run typecheck`** (N.17). **Jest OK.**
- 🚫 Όχι `any` / `as any` / `@ts-ignore`. Όχι inline styles. Όχι div soup.
- 📏 Αρχεία <500 γρ., συναρτήσεις <40 (N.7.1). **EXTRACT, ποτέ trim.**
- 🌐 **i18n (N.11):** μηδέν hardcoded strings. Κλειδιά **ΠΡΩΤΑ** σε `el` **ΚΑΙ** `en`.
  ⚠️ Το `json.dump` της Python **αναδιαμορφώνει** τα locale JSON → **χειρουργικό text edit**.
- 🇬🇷 **Απάντα ΠΑΝΤΑ στα Ελληνικά.**
- 🏛️ **Ποιότητα:** Revit / ArchiCAD / Maxon / Figma-level. **FULL ENTERPRISE + FULL SSOT.** Αν οι
  μεγάλοι παίχτες **δεν** το προτείνουν → **ακολουθούμε τη δική τους πρακτική**, όχι δική μας
  εφεύρεση. *(Εδώ: το AutoCAD PDF export **κάνει explode** τις γραμμές μοτίβου σε πραγματικά
  διανύσματα — δεν τις ραστεροποιεί. Αυτό κάνουμε.)*

---

## 8. ΑΡΧΕΙΑ-ΚΛΕΙΔΙΑ

| Αρχείο | Ρόλος |
|---|---|
| `docs/.../adrs/ADR-667-pdf-native-tiling-patterns.md` | **ΤΟ DESIGN — διάβασέ το πρώτο** (Αποφάσεις 6/7/8) |
| `print/vector/pdf-tiling-pattern.ts` | **Φ2 SSoT** — επέκτεινε για vector κελιά (§3 Γ) |
| `print/vector/scene-vector-emitter.ts` | `emitHatch` — εδώ μπαίνουν οι κλάδοι 3/5/7 |
| `print/vector/scene-image-resolver.ts` | **Το πρότυπο pre-pass** — μίμησέ το για τις γραμμές |
| `print/capture/capture-2d-vector.ts` | `:112` `summarizePrintFidelity` — **ένωσε δύο pre-pass** |
| `print/print-fidelity.ts` | Πρόσθεσε κωδικούς **εδώ** (exhaustive Record) |
| `rendering/entities/HatchRenderer.ts` | **Ο στόχος πιστότητας** + οι 5 private σταθερές |
| `bim/geometry/shared/hatch-pattern-geometry.ts` | `buildHatchEntitySegments` + τα OOM σχόλια `:398-406` |
| `export/core/tek/tek-hatch-explode.ts` | **Ο budget guard SSoT** + το πρότυπο χρήσης |
| `print/vector/__tests__/pdf-tiling-pattern.test.ts` | **Πρότυπο test με ΑΛΗΘΙΝΟ jsPDF** — μίμησέ το |
| `node_modules/jspdf/dist/jspdf.node.js` | `beginTilingPattern`@2353 · `fillWithPattern`@5136 · `putTilingPattern`@3007 |
