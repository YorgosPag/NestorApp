# HANDOFF — ADR-667 Φ2: Pattern Core (η φάση που σκοτώνει το γκρι)

**Ημερομηνία:** 2026-07-17
**Κατάσταση:** Φ1 **ΟΛΟΚΛΗΡΩΘΗΚΕ** (uncommitted, 98/98 GREEN). Φ2 **ΔΕΝ ΞΕΚΙΝΗΣΕ.**
**ADR:** `docs/centralized-systems/reference/adrs/ADR-667-pdf-native-tiling-patterns.md` (PROPOSED)
**⚠️ ΟΧΙ ADR-666** — δεσμεύτηκε 2026-07-17 από άλλον agent (Pseudo Locale). Το σωστό είναι **667**.

> **ΔΙΑΒΑΣΕ ΠΡΩΤΑ ΤΟ ADR-667.** Είναι το design v2 — 14 κλειδωμένες Αποφάσεις. Αυτό το αρχείο
> είναι ο **οδηγός εκτέλεσης** της Φ2, όχι υποκατάστατο του ADR.

---

## 1. ΤΟ ΠΡΟΒΛΗΜΑ (μία παράγραφος)

Γραμμοσκίαση «Ρίγες» (**Διαδικαστικά**) σε μεγάλη **κεκλιμένη** τοπογραφική επιφάνεια: στον καμβά
σωστή, στο **PDF συμπαγές γκρι**. Ρίζα: το vector PDF **δεν ζωγραφίζει μοτίβο** — στρώνει **N raster
tiles** (`addImage`) και πάνω από cap υποβαθμίζει **σιωπηλά** σε μέσο χρώμα
(`scene-image-resolver.ts:137-142`).

**Η Φ1 σταμάτησε τη σιωπή** (ο χρήστης πλέον ειδοποιείται + ξέρει τη διαφυγή: raster έξοδος).
**Η Φ2 σκοτώνει το ίδιο το γκρι:** ένα **native PDF Tiling Pattern** αντί για N πλακάκια ⇒ κόστος
**σταθερό ως προς το εμβαδόν**.

---

## 2. ΤΙ ΕΓΙΝΕ ΗΔΗ (μην το ξανακάνεις)

### Φ1 — υλοποιημένη, uncommitted, 13 αρχεία

| Αρχείο | Τι |
|---|---|
| `print/print-fidelity.ts` **(ΝΕΟ)** | SSoT: `PrintFidelityCode/Note` + `summarizePrintFidelity` + `mergePrintFidelity` |
| `print/capture/capture-types.ts` | `CaptureBase.fidelity?: readonly PrintFidelityNote[]` |
| `print/capture/capture-2d-vector.ts` | `fidelity: summarizePrintFidelity(images.warnings)` — τα warnings δεν πετιούνται πια |
| `print/print-service.ts` | `reportFidelity()` → `runPrint` + `runPrintSet` (σετ → **merge**, ένα toast) |
| `systems/events/drawing-event-map.ts` | `'dxf:print-fidelity-degraded'` |
| `hooks/notifications/print-fidelity-notifications.ts` **(ΝΕΟ)** | Registrar (υπάρχον EventBus+sonner μοτίβο) |
| `hooks/useDxfViewerNotifications.ts` | Wiring |
| `src/i18n/locales/{el,en}/dxf-viewer-shell.json` | `print.fidelity.*` (ICU plurals) — **6 γρ./locale, χειρουργικά** |
| `print/__tests__/print-fidelity.test.ts` **(ΝΕΟ)** | 10 tests |
| `docs/.../ADR-667-*.md` **(ΝΕΟ)** + `adr-index.md` + `ADR-608` | ADR + index + pointer |

**Tests:** 98/98 GREEN σε όλο το `print/`. **`jscpd:diff` καθαρό.**

### SSoT audit — ΕΓΙΝΕ με grep (Φ2: **επαλήθευσε ξανά** πριν γράψεις, μην εμπιστευτείς τυφλά)

| SSoT | Πού | Χρήση στη Φ2 |
|---|---|---|
| `computeImageTileMatrix` / `resolveImageFillOrigin` | `rendering/entities/shared/hatch-image-paint.ts:38-70` | **Ο ορισμός** tile matrix + anchor. **ΜΗΝ κλωνοποιήσεις τα μαθηματικά** |
| `imageFillVariantKey` | `rendering/entities/shared/hatch-image-variant-key.ts:43` | Cell identity (dedup) |
| `renderProceduralTile` | `rendering/entities/shared/procedural-tile-render.ts:65` | Procedural cell (ήδη 3 call sites) |
| `prepareExportSource` / `averageImageColorHex` / `asImageHatch` | `export/core/image-fill-export.ts` | Ανάλυση πηγής + fallback χρώμα |
| `isSolidHatch` | `bim/hatch/hatch-properties.ts` | Dispatch #2 |
| `estimateHatchFillLines` + `MAX_TEK_FILL_LINES_*` | `export/core/tek/tek-hatch-explode.ts:41-68` | **Φ3** (budget guard) |

**Νέο & επαληθευμένα ανύπαρκτο:** `print/vector/pdf-tiling-pattern.ts`.

---

## 3. 🔑 ΤΟ RECIPE — ΕΠΑΛΗΘΕΥΜΕΝΟ, ΥΠΕΡΙΣΧΥΕΙ ΚΑΘΕ ΘΕΩΡΙΑΣ

Το jsPDF **3.0.4 που ήδη έχουμε** υποστηρίζει πραγματικά tiling patterns. Επαληθεύτηκε με raw PDF
operators + pdfjs + pixel probe (`/Matrix` == αναλυτική πρόβλεψη **σε 10 σημαντικά ψηφία**).

```js
const K     = pdf.internal.scaleFactor;             // 72/25.4 για mm
const H_MM  = pdf.internal.pageSize.getHeight();    // 210.0015555... — ΠΟΤΕ hardcode 210
const Matrix = pdf.Matrix;  const TilingPattern = pdf.TilingPattern;

// 1. ΟΡΙΣΜΟΣ — ΜΟΝΟ σε advancedAPI(). matrix = null στον constructor!
const cell = new TilingPattern([0, 0, cellWmm, cellHmm], cellWmm, cellHmm, null, null);
pdf.advancedAPI(() => {
  pdf.beginTilingPattern(cell);
  // ΜΕΣΑ: apiMode = ADVANCED ⇒ RAW συντεταγμένες (no scaleFactor, no Y-flip).
  pdf.addImage(dataUrl, 'PNG', 0, 0, cellWmm, cellHmm, ALIAS, 'NONE'); // ALIAS ΣΤΑΘΕΡΟ!
  pdf.endTilingPattern(key, cell);
});

// 2. ΤΟ MATRIX — ΟΛΟ ΤΟ ΚΟΛΠΟ (Απόφαση 2 του ADR)
// jsPDF row-vector: A.multiply(B) === B·A (πρώτα B, μετά A)
// fillWithPattern κάνει: final = F.multiply(patternData.matrix), F = Matrix(1,0,0,-1,0,getPageHeight())
// ⚠️ Το F είναι mm-VALUED ενώ το spec θέλει points → unit-BUGGY. Σώζει ΜΟΝΟ ότι F·F = I.
const F = () => new Matrix(1, 0, 0, -1, 0, H_MM);
const T = () => new Matrix(K, 0, 0, -K, 0, H_MM * K);   // mm(Y-down,TL) → user space(pt,Y-up,BL)
function patternMatrixFor(ax, ay, deg) {                 // deg = VISUAL CLOCKWISE (σύμβαση οθόνης)
  const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
  const A = new Matrix(c, s, -s, c, ax, ay);             // cell(u,v) → page-mm, Y-down
  return F().multiply(T().multiply(A));                  // jsPDF ξανα-εφαρμόζει F → M_final
}
// 🔴 ΑΝ ΞΕΧΑΣΕΙΣ ΤΗΝ ΑΚΥΡΩΣΗ ΤΟΥ F → το pattern πέφτει ~74mm ΕΚΤΟΣ ΘΕΣΗΣ, ΧΩΡΙΣ ΣΦΑΛΜΑ.
// ⇒ ΕΝΑΣ helper. ΠΟΤΕ open-coded ανά call site.

// 3. FILL — από ΚΑΝΟΝΙΚΟ compat mode (mm, Y-down). Το fill ΔΕΝ έχει apiMode gate.
pdf.lines(segs, x0, y0, [1, 1], null, true);  // style === null ΥΠΟΧΡΕΩΤΙΚΟ (αλλιώς κάνει stroke)
pdf.fillEvenOdd({ key, matrix: patternMatrixFor(ax, ay, deg),
                  boundingBox: [0,0,cellWmm,cellHmm], xStep: cellWmm, yStep: cellHmm });
```

### 🔴 ΔΥΟ «ΘΕΜΕΛΙΩΔΗ ΕΥΡΗΜΑΤΑ» ΤΟΥ ΠΑΛΙΟΥ SPIKE ΕΙΝΑΙ **ΛΑΘΟΣ** (μετρήθηκαν στη Φάση Β)

| Παλιός ισχυρισμός | Μέτρηση | |
|---|---|---|
| «dedup **XOR** placement — αμοιβαία αποκλειόμενα» | 16 fills → **1 clone**, σωστό ψημένο `/Matrix` | ❌ **ΛΑΘΟΣ** |
| «κάθε fill **διπλασιάζει το raster** — size bomb» | 16 fills → **1** image XObject, **πάντα** | ❌ **ΛΑΘΟΣ** |

**Γιατί:** ο παλιός spike δοκίμασε μόνο «παράλειψε matrix → ξαναχρησιμοποίησε το **αρχικό**» (χάνει
θέση). **Δεν** δοκίμασε να ξαναχρησιμοποιήσει το **clone** — που έχει το matrix του **ήδη ψημένο**.
Και τα bytes της εικόνας ζουν στο **XObject** (alias-keyed, ένα embed), **όχι** στο cell stream.

**Το memoise (Απόφαση 3):**
```js
const before = cell.cloneIndex;                  // το instance είναι ΔΙΚΟ μας → το διαβάζουμε
pdf.fillEvenOdd({ key, matrix, boundingBox, xStep, yStep });   // μιντάρει clone
const cloneKey = `${key}$$${before}$$`;          // ντετερμινιστικό (jspdf.node.js:5131)
// …κάθε επόμενο fill ΙΔΙΟΥ υλικού+τοποθέτησης:
pdf.fillEvenOdd({ key: cloneKey });              // ΧΩΡΙΣ matrix → μηδέν νέο clone
```

**Volume (μετρημένο, worst case = κάθε fill ξεχωριστό anchor):** 100→0.14MB/48ms · 400→1.31MB/285ms ·
800→**4.78MB/762ms** ⇒ `MAX_PDF_PATTERNS_PER_PAGE = 800`. Στην πράξη η πραγματική περίπτωση είναι
**1 pattern**. O(n²) στα resource dicts, όχι στα raster bytes.

---

## 4. ΤΙ ΠΡΕΠΕΙ ΝΑ ΚΑΝΕΙΣ (Φ2)

### ΒΗΜΑ 0 — SSoT AUDIT ΜΕ GREP (ΥΠΟΧΡΕΩΤΙΚΟ, ρητή εντολή Giorgio)
Πραγματικό grep, όχι υπόθεση. Ο πίνακας §2 λέει πού να κοιτάξεις — **επιβεβαίωσέ τον**. Στόχος:
**χρησιμοποίησε** τον υπάρχοντα κώδικα, **μη φτιάξεις διπλότυπα**.

### ΒΗΜΑ 1 — `print/vector/pdf-tiling-pattern.ts` (ΝΕΟ SSoT)
- `patternMatrixFor()` — **ο μόνος** κάτοχος της ακύρωσης του F (Απόφαση 2)
- `PdfPatternRegistry` — **ανά `draw(pdf, area)` κλήση**, ΟΧΙ ανά document (Απόφαση 4)
- Key = `cellKey + M_final.toString() + bbox + steps` ⇒ **συνάρτηση κάθε input του matrix**
- Memoise clone-key (§3) ⇒ dedup **ΚΑΙ** placement
- `defineAll()` σε **ΕΝΑ** `advancedAPI()` block στην **ΑΡΧΗ** του `draw()`, με `try/finally`.
  Διάβασε το `pageHeight` **ΠΡΙΝ** μπεις σε advanced (μέσα επιστρέφει το **μέγεθος κελιού**!)
- `ensure()` επιστρέφει **`{key, boundingBox, xStep, yStep}`**, ΟΧΙ σκέτο string
- Assert ότι το key είναι registered — `fillWithPattern` σε άγνωστο key κάνει **σιωπηλό no-op**
- `MAX_PDF_PATTERNS_PER_PAGE = 800` → υπέρβαση = solid + **fidelity note** (η Φ1 το εμφανίζει ήδη)

### ΒΗΜΑ 2 — `scene-image-resolver.ts`: cell spec αντί για N tiles
Σταμάτα το `buildImageTileFullGrid`/`PDF_TILE_CAP`. Νέο output ανά image-fill hatch: **ένα** data URL +
`{tileWWorld, tileHWorld, angleDeg, anchorWorld}` (anchor από `resolveImageFillOrigin` — **ίδιο SSoT
με την οθόνη**).
- ⚠️ **Μη-τετράγωνα κελιά** (Απόφαση 9): το `tileHeight` είναι **required** και η οθόνη χρησιμοποιεί
  **ανεξάρτητα sx/sy**. Η αναλογία ζει **στο κελί** (`[0,0,tileW,tileH]`), το `/Matrix` μένει
  **ομοιόμορφο**. Ένα scalar `cellPaperMm` = τούβλο/σανίδα με **λάθος αναλογία**.
- ⚠️ **Units** (`tileWidth` = «μονάδες σχεδίου»): το `cellPaper = tileWidth * worldToPaperScale` ισχύει
  **μόνο** αν 1 world unit == 1 mm. **Η οθόνη έχει την ΙΔΙΑ παραδοχή** (`hatch-image-paint.ts:63`)
  ⇒ **όχι regression**, preview===commit. Αλλά **ονόμασέ το `tileWWorld`** και δήλωσε τον περιορισμό —
  μην ψήσεις ανεπαλήθευτο αξίωμα.

### ΒΗΜΑ 3 — `scene-vector-emitter.ts` `emitHatch`: **σειρά dispatch = ΝΟΜΟΣ** (Απόφαση 5)
1. `dxfFaces` υπάρχει → `fillPolygon` ανά face — **ΚΕΡΔΙΖΕΙ ΤΑ ΠΑΝΤΑ** (σημερινή συμπεριφορά @199-203, load-bearing)
2. `isSolidHatch(hatch)` → solid
3. **μετά** `fillType`

🔴 **ΓΙΑΤΙ:** το `fillType` είναι **optional** και **οι δύο πραγματικοί παραγωγοί `dxfFaces` ΔΕΝ το
θέτουν** (`neutral-primitive-factory.ts:101-118`, `overlay-dxf-collector.ts:157-169` → μόνο
`patternType:'solid'`). Ένα `switch(fillType)` ⇒ **κάθε structural/poché solid fill γίνεται άδειο
περίγραμμα**.

**Το outline είναι ΔΑΠΕΔΟ, όχι κλάδος** (Απόφαση 8): καμία διαδρομή δεν καταλήγει σε «τίποτα».

### ΒΗΜΑ 4 — Νεκρός κώδικας: **ΜΕ ΤΟ ΧΕΡΙ, ΙΔΙΟ COMMIT**
> ⚠️ **Το `knip.json` `ignore` περιέχει `src/subapps/dxf-viewer/**`. ΤΟ KNIP ΔΕΝ ΒΛΕΠΕΙ ΤΙΠΟΤΑ ΕΔΩ.**

- `emitClippedImage` + `clipToBoundary` (`scene-image-emitter.ts`) — **ΕΝΑΣ** consumer: ο hatch κλάδος
  (`scene-vector-emitter.ts:194`). *(Το `ImageEntity` πάει από `emitResolvedImage:129` — **μην** πειράξεις)*
- `buildImageTileFullGrid` + `PDF_TILE_CAP`
- **Ζωντανά tests σε νεκρό κώδικα** (φεύγουν μαζί): `print/vector/__tests__/scene-image-emitter.test.ts:107,125,132`
  · `export/core/__tests__/image-fill-export.test.ts:25,97-135`

### ΒΗΜΑ 5 — Tests
- `patternMatrixFor`: **45° με ΑΣΥΜΜΕΤΡΟ tile** (τετράγωνο στις 45° είναι συμμετρικό ⇒ **δεν** πιάνει
  το mirror). Κλείδωσε τη σύμβαση: **θετική γωνία = visual clockwise** (σύμβαση **οθόνης** = η αλήθεια)
- Registry: ίδιο key → **1 clone**· διαφορετικό matrix → **2**
- Multi-sheet: δύο `draw()` κλήσεις → **μηδέν διαρροή** patterns (KILLER #2)

### ΒΗΜΑ 6 — ΠΡΙΝ πεις «done»
```
npm run jscpd:diff <τα δικά σου staged αρχεία>      # N.18 — ΥΠΟΧΡΕΩΤΙΚΟ
npx jest src/subapps/dxf-viewer/print                # 98/98 πρέπει να μείνουν GREEN
```
**Ενημέρωσε το changelog του ADR-667** (Phase 3, N.0.1 — υποχρεωτικό).

### ΒΗΜΑ 7 — 🔒 Η ΕΠΑΛΗΘΕΥΣΗ ΔΕΝ ΕΙΝΑΙ ΤΑ TESTS
Ο χρήστης βρήκε το bug **κοιτάζοντας PDF**. **Ζήτα από τον Giorgio να εξάγει το ίδιο σχέδιο και δες το.**

---

## 5. ❌ ΜΗΝ ΤΑ ΚΑΝΕΙΣ

- **ΜΗΝ** αγγίξεις το `export/core/image-fill-export.ts` **DXF path** (Απόφαση 13). Οι δύο caps
  (`IMAGE_GRID_SCAN_CAP=4000` scan / `IMAGE_TILE_CAP=400` placement) **ΔΕΝ είναι διπλοτυπία** — είναι
  **σκόπιμος διβάθμιος φρουρός**. Το v1 πρότεινε «ενοποίηση» → **DXF REGRESSION** (πιστό tiled export →
  σιωπηλό solid) που **τα υπάρχοντα tests ΔΕΝ πιάνουν**.
- **ΜΗΝ** κάνεις explode γραμμές μοτίβου στη Φ2 — είναι **Φ3**, και **χωρίς** τον υπάρχοντα budget guard
  παγώνει ο browser **164s / OOM 4GB** (ήδη μετρημένο: `tek-hatch-explode.ts:50-57`,
  `hatch-pattern-geometry.ts:398-406`).
- **ΜΗΝ** ορίσεις patterns **lazily μέσα στο draw** — unbalanced render-target stack ⇒ **λευκή σελίδα,
  κανένα σφάλμα** (Απόφαση 10).
- **ΜΗΝ** υλοποιήσεις το `artifacts/design-v1.json` / `ADR-666-DRAFT-v1-NEEDS-REVISION.md` του παλιού
  handoff — **απορρίφθηκε** (3/3 κριτικοί). Ζει στο `HANDOFFS/2026-07-17_ADR-666_pdf-tiling-patterns/`
  **ως ιστορικό**.
- **ΜΗΝ** βάλεις τίποτα από το `artifacts/` σε production paths.

---

## 6. ΚΑΝΟΝΕΣ (ΑΠΑΡΑΒΑΤΟΙ)

- 🚫 **ΠΟΤΕ `git commit` / `git push`** — **ο Giorgio τα κάνει** (N.-1). Ούτε «επειδή τελείωσε».
- ⚠️ **Το working tree ΜΟΙΡΑΖΕΤΑΙ με άλλον agent** → **ΠΟΤΕ** `git add -A`, **ΠΟΤΕ** bulk
  reset/checkout. Άγγιξε **ΜΟΝΟ** τα δικά σου αρχεία.
  **Αν βρεις `.git/index.lock`: ΜΗΝ το σβήσεις** — ο άλλος agent τρέχει git. Το `git show` είναι
  read-only και δουλεύει χωρίς lock (έτσι δούλεψα στη Φ1).
- 🚫 **ΠΟΤΕ `tsc` / `npx tsc` / `npm run typecheck`** (N.17). **Jest OK.**
- 🚫 Όχι `any` / `as any` / `@ts-ignore`. Όχι inline styles. Όχι div soup.
- 📏 Αρχεία <500 γρ., συναρτήσεις <40 (N.7.1). **EXTRACT, ποτέ trim.**
- 🌐 **i18n (N.11):** μηδέν hardcoded strings. Κλειδιά **ΠΡΩΤΑ** σε `el` **ΚΑΙ** `en`.
  ⚠️ Το `json.dump` της Python **αναδιαμορφώνει** τα locale JSON (171 γρ. θόρυβος) → **χειρουργικό
  text edit**, όχι re-serialize.
- 🇬🇷 **Απάντα ΠΑΝΤΑ στα Ελληνικά.**
- 🏛️ **Ποιότητα:** Revit / ArchiCAD / Maxon / Figma-level. **FULL ENTERPRISE + FULL SSOT.** Αν οι
  μεγάλοι παίχτες **δεν** το προτείνουν → **ακολουθούμε τη δική τους πρακτική**, όχι δική μας εφεύρεση.
  *(Εδώ: AutoCAD/Revit **δεν στρώνουν πλακάκια** στο PDF — χρησιμοποιούν native tiling patterns.)*

---

## 7. ΑΡΧΕΙΑ-ΚΛΕΙΔΙΑ

| Αρχείο | Ρόλος |
|---|---|
| `docs/.../adrs/ADR-667-pdf-native-tiling-patterns.md` | **ΤΟ DESIGN — διάβασέ το πρώτο** |
| `print/vector/scene-vector-emitter.ts` | Ο «ζωγράφος» — `emitHatch` @186-208 |
| `print/vector/scene-image-resolver.ts` | Async pre-pass — **εδώ το σιωπηλό solid** @137-149 |
| `print/vector/scene-image-emitter.ts` | `emitClippedImage` — **γίνεται νεκρός** |
| `print/capture/capture-2d-vector.ts` | `draw` closure + `fidelity` (Φ1) |
| `print/print-fidelity.ts` | **Φ1 SSoT** — πρόσθεσε κωδικό εδώ αν χρειαστείς νέο είδος απώλειας |
| `print/capture/capture-2d.ts` | Raster fallback — **δουλεύει σωστά, ΜΗΝ το πειράξεις** |
| `print/assemble/pdf-assembler.ts` | `new jsPDF({orientation, unit:'mm', format})` @~90 |
| `print/print-service.ts` | `runPrint` @167 · `runPrintSet` @217-238 (**multi-sheet, ΕΝΑ jsPDF**) |
| `rendering/entities/HatchRenderer.ts` | **Ο στόχος πιστότητας** — 7 κλάδοι @178-254 |
| `node_modules/jspdf/dist/jspdf.node.js` | `cloneTilingPattern`@5122 · `fillWithPattern`@5136 · `putTilingPattern`@3010 |
| `HANDOFFS/2026-07-17_ADR-666_pdf-tiling-patterns/artifacts/` | Παλιό spike (**τρέχει**) + recipe + critiques. **Το design-v1 ΑΠΟΡΡΙΦΘΗΚΕ** |
