# ADR-667 — Native PDF Tiling Patterns για γεμίσματα γραμμοσκίασης (vector PDF)

## Status

🟢 **ACCEPTED — 2026-07-17** — **Φ1 + Φ2 υλοποιημένες** (Φ3/Φ4 εκκρεμούν). Το vector PDF export
έπαψε να «στρώνει πλακάκια» (N raster tiles ανά γραμμοσκίαση) και εκπέμπει **native PDF Tiling
Patterns** (PDF spec §8.7.3, Pattern Type 1) — ένα κελί, ορισμένο μία φορά, που ο viewer
επαναλαμβάνει επ' άπειρον. Παράλληλα έκλεισε το **σιωπηλό** μονοπάτι υποβάθμισης που παρήγαγε το
περιστατικό: μεγάλη κεκλιμένη τοπογραφική επιφάνεια → **συμπαγές γκρι** αντί για μοτίβο, **χωρίς
καμία ειδοποίηση**.

> ✅ **ΕΠΑΛΗΘΕΥΜΕΝΟ ΣΤΟ ΠΡΑΓΜΑΤΙΚΟ PDF (Giorgio, 2026-07-17): «ΤΩΡΑ ΛΕΙΤΟΥΡΓΕΙ».** Το περιστατικό
> έκλεισε **στο μέσο όπου γεννήθηκε** — ο χρήστης βρήκε το bug κοιτάζοντας PDF και το επιβεβαίωσε
> κοιτάζοντας PDF. Τα 127/127 πράσινα tests **δεν** ήταν ποτέ η απόδειξη· ήταν το δίχτυ.

**Owner:** DXF Viewer · Print/Export

**Related:**
- **ADR-608** (Vector-PDF backend) — **ο ιδιοκτήτης του emitter**. Το «hatch v1 = solid faces +
  boundary outline· pattern lines → raster fallback» ήταν ρητός `Known limitation (a)`. Εδώ αίρεται.
  Το συμβόλαιο του `CaptureResult` επεκτείνεται (`fidelity`) → pointer entry στο ADR-608.
- **ADR-643** (Hatch Image Fill) — ο ιδιοκτήτης του on-screen image fill. Τα `computeImageTileMatrix`
  / `resolveImageFillOrigin` / `imageFillVariantKey` επαναχρησιμοποιούνται **αυτούσια** ως ο ορισμός
  του «τι ζωγραφίζεται»· εδώ αλλάζει μόνο το **backend** (PDF pattern αντί για `CanvasPattern`).
- **ADR-647** (TEK hatch explode) — ο ιδιοκτήτης του `estimateHatchFillLines` + των budgets
  (`MAX_TEK_FILL_LINES_PER_HATCH/TOTAL`). Επαναχρησιμοποιούνται **αυτούσια** — μηδέν δεύτερη
  budget logic.
- **ADR-531 Φ5b.6** (screen-space hatch) — ο ιδιοκτήτης του `patternSpace:'screen'`. Εδώ ορίζεται
  ρητά η **αντιστοιχία οθόνης↔χαρτιού** που έλειπε.
- **ADR-040** (Canvas performance) — το `draw(pdf, area)` closure είναι **σύγχρονο**. Κάθε βαρύς
  υπολογισμός ζει στο async pre-pass. Ο κανόνας δεν κάμπτεται εδώ.
- **ADR-651 Φάση Ζ** (sheet sets) — πολλαπλά φύλλα σε ΕΝΑ jsPDF, **διαφορετικό `toPaper` ανά φύλλο**.
  Καθορίζει το lifetime του pattern registry (βλ. Απόφαση 4).
- **CLAUDE.md N.11 / N.18** — μηδέν hardcoded strings· `jscpd:diff` πριν το «done».

---

## Context

### Το περιστατικό (Giorgio, 2026-07-17)

Γραμμοσκίαση «Ρίγες» (κατηγορία **Διαδικαστικά**) σε μεγάλη **κεκλιμένη** τοπογραφική επιφάνεια:

| Πού | Τι βλέπει ο χρήστης |
|---|---|
| **Στον καμβά** | Σωστά — οι ρίγες του μοτίβου |
| **Στο PDF** | **Συμπαγές γκρι-μπλε.** Περίγραμμα σωστό, μοτίβο χαμένο |
| **Ειδοποίηση** | **Καμία.** |

### Ρίζα (επαληθευμένη στον κώδικα, όχι υποθετική)

Το vector PDF export **δεν ζωγραφίζει μοτίβο** — στρώνει **N raster tiles** μέσω `addImage`, ένα ανά
tile, κομμένα στο boundary (`scene-image-resolver.ts` → `scene-image-emitter.ts`). Όταν το tile grid
κάνει overflow, το `scene-image-resolver.ts:137-142` **υποβαθμίζει σιωπηλά** σε
`averageImageColorHex()` — αυτό ακριβώς είναι το γκρι.

Τρία ανεξάρτητα κενά, όχι ένα:

1. **Το ίδιο το μοντέλο «πλακάκια» είναι λάθος.** Μια τοπογραφική επιφάνεια χρειάζεται χιλιάδες
   tiles· κάθε cap που βάλεις είναι αυθαίρετος και η υπέρβασή του καταστρέφει το σχέδιο.
2. **Τα μη-image hatch δεν γεμίζουν καθόλου.** `solid` / `predefined` / `user-defined` / `gradient`
   βγαίνουν **μόνο ως περίγραμμα**. Ο **default** τύπος κάθε νέου hatch είναι `user-defined`
   (45°/100mm) ⇒ αφορά την πλειοψηφία, όχι μια γωνιακή περίπτωση.
3. **Σιωπή.** Τα `warnings` του resolver **πετιούνται** (`capture-2d-vector.ts:104` κρατά μόνο τις
   εικόνες). Ο χρήστης παίρνει **λάθος σχέδιο και καμία ένδειξη** — το χειρότερο δυνατό αποτέλεσμα
   για εργαλείο μηχανικού.

### Τι κάνουν οι μεγάλοι παίχτες

**AutoCAD / Revit δεν στρώνουν πλακάκια στο PDF.** Το PDF format έχει **native Tiling Patterns**:
ορίζεις το κελί μία φορά, δίνεις `XStep`/`YStep` + pattern `/Matrix`, ο viewer το επαναλαμβάνει.
Οι γραμμές μοτίβου (`predefined`/`user-defined`) εξάγονται ως **πραγματικά διανύσματα**, όχι raster.
Ακολουθούμε **τη δική τους πρακτική** — καμία δική μας εφεύρεση.

### Προηγούμενη δουλειά — τι ισχύει και τι ΔΕΝ ισχύει

Η Φάση Α (έρευνα + spike + design v1 + 3 αντίπαλοι κριτικοί) παρήγαγε
`HANDOFFS/2026-07-17_ADR-666_pdf-tiling-patterns/`. Από αυτήν:

- ✅ **Το spike απέδειξε ότι τα native tiling patterns δουλεύουν** με το **jsPDF 3.0.4 που ήδη
  έχουμε** — επαληθευμένο με raw PDF operators + pdfjs operator list + pixel probe. Ισχύει.
- ❌ **Το design v1 απορρίφθηκε** (3/3 κριτικοί `NEEDS_WORK`, 8 killer issues). **Δεν** υλοποιείται.
- ❌ **Δύο «θεμελιώδη ευρήματα» του spike αποδείχθηκαν ΛΑΘΟΣ** εδώ, με μέτρηση (βλ. Απόφαση 3).

> ⚠️ **Αρίθμηση:** η Φάση Α σχεδίαζε αυτό ως «ADR-666». Στο μεταξύ το **ADR-666 δεσμεύτηκε**
> (Pseudo Locale = Runtime Transform, 2026-07-17). Επόμενο ελεύθερο → **ADR-667**.

---

## Decision

### Απόφαση 1 — Το κελί, όχι το πλακάκι: native Tiling Patterns

Κάθε γέμισμα που είναι **επαναλαμβανόμενο μοτίβο** (image fill, procedural, screen-space) εκπέμπεται
ως **ένα** PDF Tiling Pattern. Το κόστος γίνεται **σταθερό ως προς το εμβαδόν**: μια τοπογραφική
επιφάνεια που σήμερα χρειάζεται 4.000 `addImage` γίνεται **1 pattern + 1 fill**.

Ο `PDF_TILE_CAP` και το σιωπηλό solid downgrade **παύουν να υπάρχουν** για αυτά τα γεμίσματα.

### Απόφαση 2 — Ο helper του matrix είναι ΥΠΟΧΡΕΩΤΙΚΟΣ (load-bearing, μη προφανής)

Το `fillWithPattern` του jsPDF (`jspdf.node.js:5154`) χτίζει
`F = Matrix(1, 0, 0, -1, 0, getPageHeight())` όπου το `getPageHeight()` επιστρέφει **mm**, ενώ το PDF
spec απαιτεί το pattern `/Matrix` να δείχνει σε **default user space = points**. **Το flip του jsPDF
είναι unit-buggy by construction.**

Επιβιώνει **μόνο** επειδή το `F` είναι involution (`F·F = I`) → ακυρώνεται **ακριβώς** με
`patternData.matrix = F.multiply(M_final)`.

> **Αν το ξεχάσεις, το pattern πέφτει ~74mm εκτός θέσης — χωρίς κανένα σφάλμα.**

⇒ **ΕΝΑΣ helper `patternMatrixFor()`. ΠΟΤΕ open-coded ανά call site.** Αυτός ο κανόνας είναι ο
λόγος ύπαρξης του `print/vector/pdf-tiling-pattern.ts`.

Επίσης: **μην hardcode-άρεις `210`** — το `getPageHeight()` για A4 landscape επιστρέφει
`210.0015555555555` (floating slop του pt↔mm round-trip). Η ακύρωση είναι ακριβής **μόνο** αν
χτίσιμο και ακύρωση χρησιμοποιούν την **ίδια** τιμή.

### Απόφαση 3 — Dedup ΚΑΙ placement μαζί (το spike 1 έλεγε «αμοιβαία αποκλειόμενα» — **λάθος**)

Το spike 1 συμπέρανε δύο πράγματα που **μετρήθηκαν και καταρρίφθηκαν** (spike 2/3, βλ. §Επαλήθευση):

| Ισχυρισμός spike 1 | Μέτρηση | Πραγματικότητα |
|---|---|---|
| «DEDUP και PLACEMENT είναι **αμοιβαία αποκλειόμενα**» | 16 fills → **1 clone** | ❌ **ΛΑΘΟΣ** |
| «Κάθε fill **διπλασιάζει το raster** — size bomb» | 1/16/64 fills → **σταθερό** πλήθος image XObjects | ❌ **ΛΑΘΟΣ** |

> 🔬 **Διόρθωση Φ2 (μετρημένη):** το «→ **1** image XObject» ήταν **κακομετρημένο**. Ένα RGBA PNG
> παράγει **2** αντικείμενα `/Subtype /Image` (η εικόνα **+** το `/SMask` του καναλιού άλφα). Το
> **ουσιώδες** ισχύει ακέραιο και επαληθεύτηκε ξανά: ο αριθμός είναι **σταθερός** σε 1, 16 και 64
> fills ⇒ **μηδέν εξάρτηση από το πλήθος των fills**, καμία size bomb. Ο ισχυρισμός καταγράφεται
> σωστά ως «σταθερό», όχι «1».

**Γιατί το spike 1 έπεσε έξω:** δοκίμασε μόνο «παράλειψε το matrix → ξαναχρησιμοποίησε το **αρχικό**
pattern» (που όντως χάνει κάθε έλεγχο θέσης: pattern space → points, Y-up). **Δεν** δοκίμασε το
προφανές επόμενο βήμα: να ξαναχρησιμοποιήσει το **clone**.

Ο μηχανισμός (`jspdf.node.js:5122-5134`):
```js
function cloneTilingPattern(patternKey, boundingBox, xStep, yStep, matrix) {
  var clone = new TilingPattern(/* … */, matrix || this.matrix);
  clone.stream = this.stream;                       // ΚΟΙΝΟ stream (by reference)
  var key = patternKey + "$$" + this.cloneIndex++ + "$$";
  addPattern(key, clone);                           // ΚΑΤΑΧΩΡΕΙΤΑΙ με προβλέψιμο key
  return clone;
}
```
Το `putTilingPattern:3028` γράφει το `/Matrix` **από το ίδιο το clone**. Άρα:

```ts
const before = basePattern.cloneIndex;        // το instance είναι ΔΙΚΟ μας → το διαβάζουμε
pdf.fillEvenOdd({ key, matrix, boundingBox, xStep, yStep });   // → μιντάρει clone
const cloneKey = `${key}$$${before}$$`;       // ντετερμινιστικό
// …κάθε επόμενο fill ΙΔΙΟΥ υλικού+τοποθέτησης:
pdf.fillEvenOdd({ key: cloneKey });           // ΧΩΡΙΣ matrix → μηδέν νέο clone, ψημένο /Matrix
```

**Το raster δεν διπλασιάζεται ποτέ:** το `addImage` με **σταθερό alias** ενσωματώνει τα bytes **μία**
φορά ως XObject· το cell stream το **αναφέρει** (`/I0 Do`), δεν το περιέχει. Τα clones αντιγράφουν
μόνο το μικροσκοπικό cell stream + ένα dict.

⇒ **Ο registry κάνει memoise μόνος του** και παίρνει **και** dedup **και** πλήρη έλεγχο θέσης.

### Απόφαση 4 — Το registry key είναι συνάρτηση ΚΑΘΕ input του matrix· lifetime = **ανά `draw()`**

Το design v1 έκανε key σε **world** συντεταγμένες, με το `/Matrix` ψημένο στον constructor από το
paper placement του **1ου φύλλου**. Το `runPrintSet` (`print-service.ts:217-238`) φτιάχνει N φύλλα,
**το καθένα με δικό του `toPaper`/`worldToPaperScale`**, και όλα πάνε σε **ΕΝΑ** jsPDF. Ίδιο υλικό +
ίδιο world anchor σε άλλο φύλλο → θα επέστρεφε το pattern του φύλλου 1 → **λάθος κλίμακα ΚΑΙ φάση,
σιωπηλά**.

**Κανόνας (κλειδωμένος):** *το key πρέπει να είναι συνάρτηση κάθε input του matrix.*

⇒ Το key είναι `cellKey + M_final.toString() + bbox + steps` — δηλαδή **resolved paper** μαθηματικά,
όχι world. **Και** το registry ζει **ανά `draw(pdf, area)` κλήση**, όχι ανά document: δύο φύλλα =
δύο registries, μηδέν διαρροή. Οι δύο άμυνες είναι σκόπιμα πλεοναστικές (N.7.2 #4 belt-and-suspenders).

### Απόφαση 5 — Σειρά dispatch: **κλειδωμένη και ρητή**

Το `fillType` είναι **optional** (`types/entities.ts:775`) και **οι δύο πραγματικοί παραγωγοί
`dxfFaces` ΔΕΝ το θέτουν** (`neutral-primitive-factory.ts:101-118`, `overlay-dxf-collector.ts:157-169`
— βάζουν μόνο `patternType:'solid'`). Ένα `switch (fillType)` θα τα έριχνε στο `default` ⇒ **κάθε
structural/poché solid fill γίνεται άδειο περίγραμμα**.

Η σειρά στο `emitHatch` είναι **νόμος**:

| # | Έλεγχος | Ενέργεια | Γιατί εδώ |
|---|---|---|---|
| 1 | `dxfFaces` υπάρχει | `fillPolygon` ανά face | **Κερδίζει τα πάντα.** Είναι η σημερινή συμπεριφορά (`scene-vector-emitter.ts:199-203`) και είναι load-bearing |
| 2 | `isSolidHatch(hatch)` | solid fill | Χειρίζεται `fillType === undefined` μέσω `patternType`/`patternName` |
| 3 | `backgroundColor` (αν όχι solid/gradient/image) | pre-fill **πίσω** από τις γραμμές | Κάτοπτρο `HatchRenderer.ts:215-218` |
| 4 | `fillType === 'image'` | **tiling pattern** (raster cell) | |
| 5 | `patternSpace === 'screen'` | **tiling pattern** (vector stripe cell) | **Ορθογώνιο** στο `fillType` (βλ. Απόφαση 6) |
| 6 | `fillType === 'gradient'` | outline (⏳ Φ4) | PDF shading = ξεχωριστός μηχανισμός |
| 7 | αλλιώς (`predefined`/`user-defined`) | **exploded segments**, budget-guarded | Απόφαση 7 |
| — | **πάντα** | boundary outline | Απόφαση 8 |

### Απόφαση 6 — Το `patternSpace` είναι ΟΡΘΟΓΩΝΙΑ διάσταση, όχι κλάδος του `fillType`

Το `tek-hatch-to-bim.ts:102` βάζει `patternSpace:'screen'` σε **ΚΑΘΕ** imported `.tek` hatch με
`fillType === 'user-defined'` — δηλαδή στο **πιο κοινό** hatch του συστήματος. Ο `HatchRenderer.ts:227-231`
το πιάνει **ΠΡΙΝ** τους world-space κλάδους. Το `buildHatchEntitySegments` **δεν γνωρίζει καν το
πεδίο** (δεν είναι στο `Pick<>`, `hatch-pattern-geometry.ts:338-344`) ⇒ αν το αγνοήσεις, βγάζεις
world-space γραμμές που **ποτέ δεν εμφανίστηκαν στην οθόνη**.

**Η αντιστοιχία οθόνης↔χαρτιού ορίζεται ΕΔΩ (έλειπε παντού):**

| | Οθόνη | Χαρτί |
|---|---|---|
| Πυκνότητα | **3 px** σταθερά (zoom-independent) | **`SCREEN_HATCH_PAPER_SPACING_MM = 0.8`** σταθερά |
| Απόδοση | raster `CanvasPattern` | **vector** stripe cell |
| Γωνία | 45° (`SCREEN_HATCH_DEFAULT_ANGLE_DEG`) | ίδια, μέσω pattern `/Matrix` |

**Γιατί 0.8mm:** 3 px @ 96 dpi ≈ 0.79 mm — η **ίδια οπτική πυκνότητα** που βλέπει ο χρήστης στο 100%
zoom. **Γιατί vector αντί για το 3px raster της οθόνης:** ένα 3-pixel bitmap στα 300+ dpi του χαρτιού
είναι θολή λάσπη. Η οθόνη είναι raster επειδή το zoom-independence το απαιτεί· το χαρτί δεν έχει zoom.
Αυτή είναι **ρητή, τεκμηριωμένη απόκλιση** — όχι παράλειψη.

### Απόφαση 7 — Γραμμές μοτίβου: explode με τον ΥΠΑΡΧΟΝΤΑ budget guard, στο **pre-pass**

Τα `predefined`/`user-defined` **δεν** γίνονται tiling patterns: το `buildHatchEntitySegments` είναι
ήδη ο **SSoT** που τροφοδοτεί **και** την οθόνη (`drawPatternSegments`) **και** τον DXF writer.
Pattern εδώ = **δεύτερα μαθηματικά** για το ίδιο ερώτημα. Explode = ίδιες γραμμές, τρία backends
(οθόνη / DXF / PDF) — η αρχή του ADR-608 («one flatten, N backends»). Είναι **και** ό,τι κάνει το
AutoCAD PDF export.

🔴 **ΑΛΛΑ — ΧΩΡΙΣ GUARD ΑΥΤΟ ΠΑΓΩΝΕΙ ΤΟΝ BROWSER.** Το design v1 πρότεινε ακριβώς αυτό μέσα στο sync
`draw` closure, **χωρίς cap**, και ρητά απέρριπτε cap. **Ο κώδικας έχει ΗΔΗ μετρήσει την αποτυχία:**

- `tek-hatch-explode.ts:50-57` → «ένα 400×400 boundary με βήμα 0.127 χρειάζεται **164s**· ο post-hoc
  έλεγχος είναι άχρηστος»
- `hatch-pattern-geometry.ts:398-406` → η απουσία guard έκανε τον TEK builder να σκάει με **OOM 4GB**
- `clipSegmentToRegion` (`hatch-pattern-geometry.ts:100-125`) είναι **O(lines × boundary_edges)**

⇒ **Θα αντικαθιστούσαμε ένα ορατό λάθος (γκρι) με ένα αόρατο πάγωμα.** Απαράδεκτο.

**Κανόνας:**
1. `estimateHatchFillLines()` (**υπάρχων SSoT**, `tek-hatch-explode.ts:59-68`) τρέχει **ΠΡΙΝ** το
   `buildHatchEntitySegments` — ακριβώς όπως ήδη κάνει ο TEK exporter.
2. Budgets **mirror**: `MAX_TEK_FILL_LINES_PER_HATCH` (40.000) / `MAX_TEK_FILL_LINES_TOTAL` (120.000).
   **Μηδέν νέα budget logic.**
3. Πάνω από budget → boundary outline + **fidelity note** (ορατό, όχι σιωπηλό).
4. Ο υπολογισμός ζει στο **async pre-pass**, **όχι** στο `draw`.

**Γιατί όχι στο `draw`:** το `draw` είναι σύγχρονο (ADR-040) **και** το `capture.fidelity` διαβάζεται
από το `runPrint` **ΑΦΟΥ** επιστρέψει το `captureSource` (`print-service.ts:167`) ⇒ ό,τι υπολογιστεί
μέσα στο `draw` **δεν μπορεί ποτέ να αναφερθεί**. Το pre-pass δεν είναι στυλιστική προτίμηση — είναι
η **μόνη** θέση όπου και τα δύο λειτουργούν.

**Ο screen density-LOD (`isLineDensityTooHigh`) ΔΕΝ μεταφέρεται.** Είναι συνάρτηση του zoom· το χαρτί
δεν έχει zoom. Τη θέση του παίρνει το budget guard.

### Απόφαση 8 — Το outline είναι **ΔΑΠΕΔΟ**, όχι κλάδος

Το `buildHatchEntitySegments` επιστρέφει `[]` σε: catalog MISS (`hatch-pattern-geometry.ts:373-379`),
`gradient` (349), boundary <3 σημεία (350). Το design v1 αφαιρούσε το outline fallback ⇒ hatch που
**σήμερα** τυπώνει τουλάχιστον περίγραμμα θα **εξαφανιζόταν**.

**Κανόνας:** `segments.length ? segments : boundary outline`. Καμία διαδρομή δεν καταλήγει σε «τίποτα».

### Απόφαση 9 — Μη-τετράγωνα κελιά: η αναλογία ζει στο **κελί**, όχι στο matrix

Το `HatchImageFill.tileHeight` είναι **required** (`types/entities.ts:692`) και το screen SSoT
`computeImageTileMatrix` χρησιμοποιεί **ανεξάρτητα `sx`/`sy`** (`hatch-image-paint.ts:63-64`). Ένα
scalar `cellPaperMm` (design v1) θα **έριχνε** το `tileHeight` ⇒ τούβλο/σανίδα/siding με **λάθος
αναλογία**.

⇒ Το κελί γράφεται σε mm στο `[0, 0, tileWpaperMm, tileHpaperMm]`, αυτά μπαίνουν στον constructor
(`boundingBox`/`xStep`/`yStep`), και το `/Matrix` μένει **καθαρά ομοιόμορφο** (`K·R(α)` + translate).

### Απόφαση 10 — Ένα `advancedAPI()` block στην **ΑΡΧΗ** του `draw()`, με `try/finally`

Το `beginTilingPattern` (`jspdf.node.js:2353-2363`) κάνει `beginNewRenderTarget` (`pages = []`)· **μόνο**
το `endTilingPattern` κάνει pop. Το design v1 όριζε patterns **lazily, μέσα στο draw** — σενάριο που
**το spike ΔΕΝ δοκίμασε**. Αν το `addImage` σκάσει μέσα στο κελί → το stack δεν ξετυλίγεται → **το
υπόλοιπο περιεχόμενο της σελίδας γράφεται μέσα στο pattern** ⇒ **λευκή σελίδα, κανένα σφάλμα**.

⇒ **ΟΛΑ** τα patterns ορίζονται σε **ένα** `advancedAPI()` block στην **αρχή** του `draw()`, πριν
εκπεμφθεί η πρώτη οντότητα. Τα specs είναι **ήδη resolved** από το pre-pass — **τίποτα δεν επιβάλλει
lazy**. Το `pageHeightMm` διαβάζεται **ΠΡΙΝ** μπούμε σε advanced mode (μέσα, το `pageSize.getHeight()`
επιστρέφει το **μέγεθος του κελιού**, όχι 210). `try/finally` γύρω από το block.

### Απόφαση 11 — Καμία σιωπηλή αλλοίωση: `fidelity` στο `CaptureResult`

Κάθε υποβάθμιση (budget υπέρβαση, decode fail, catalog miss, pattern cap) παράγει **`PrintFidelityNote`**.
Το `runPrint`/`runPrintSet` τα συλλέγει και τα εκπέμπει· ο χρήστης βλέπει **toast**.

**SSoT (audit-verified):** το `hooks/notifications/*` + `EventBus` + `useTranslation('dxf-viewer-shell')`
είναι το **υπάρχον** μοτίβο ειδοποιήσεων του DXF viewer (`grid-build-notifications.ts` κ.ά.).
**Μηδέν νέο κανάλι.** Τα i18n κλειδιά μπαίνουν **ΠΡΩΤΑ** σε `el` **ΚΑΙ** `en` (N.11).

> ⚠️ Το `runExport` **ήδη** συλλέγει `warnings` που **κανείς δεν εμφανίζει** (`ExportHost.tsx` τα
> αγνοεί). Ίδια ασθένεια, άλλο μονοπάτι. **Εκτός scope εδώ** — καταγράφεται ως pending.

### Απόφαση 12 — Σύμβαση γωνίας: **η οθόνη είναι η αλήθεια**

Υπάρχει **υπαρκτή ασυμφωνία** που κανένα test δεν κλειδώνει:

| Μονοπάτι | Μηχανισμός | Θετική γωνία = |
|---|---|---|
| **Οθόνη** | `computeImageTileMatrix` → `.rotateSelf(angle)` σε **Y-down** | **δεξιόστροφα** |
| **Export grid** | `buildTileFrame` περιστρέφει σε **world** + `worldToScreen` flip Y | **αριστερόστροφα** |

**Είναι αντίθετες.** Το design v1 υιοθετούσε σιωπηλά τη screen σύμβαση — σωστό για preview===commit,
αλλά **αντιστρέφει το σημερινό PDF output** για κάθε στραμμένο image hatch, χωρίς να το πει πουθενά.

**Απόφαση:** **η σύμβαση της οθόνης είναι η αλήθεια** (ό,τι βλέπει ο χρήστης ΕΙΝΑΙ ό,τι τυπώνεται).
Το `patternMatrixFor(anchor, deg)` δέχεται **visual-clockwise** γωνία. Το test το κλειδώνει στις **45°
με ασύμμετρο tile** (τετράγωνο tile στις 45° είναι συμμετρικό ⇒ **δεν** πιάνει το mirror).

**Το `buildTileFrame` (DXF path) μένει ως έχει** — ανοιχτή απόφαση, καταγεγραμμένη ως pending.

### Απόφαση 13 — Το DXF image-fill export **ΔΕΝ αγγίζεται**

Οι δύο caps στο `export/core/image-fill-export.ts` (`IMAGE_GRID_SCAN_CAP = 4000` σαρώσεων,
`IMAGE_TILE_CAP = 400` τοποθετήσεων) **δεν είναι διπλοτυπία** — είναι **σκόπιμος διβάθμιος φρουρός**
(φθηνό scan pre-check + placement cap **μετά** το PIP culling).

Το design v1 πρότεινε `scanCap = cap * SCAN_HEADROOM` → **DXF REGRESSION**: hatch με bbox grid μεταξύ
`cap*headroom` και 4000 που κάνει PIP-cull κάτω από 400 tiles θα γύριζε από πιστό tiled export σε
**σιωπηλό solid**. **Και τα υπάρχοντα tests ΔΕΝ θα το έπιαναν** (`image-fill-export.test.ts:86-90`
χρησιμοποιεί `cap=4` σε 3×3 grid → ίδιο observable πριν/μετά).

⇒ **Μηδέν αλλαγή στο DXF μονοπάτι.** (Το ότι το `buildTileFrame:98` αγνοεί την παράμετρο `cap` και
χρησιμοποιεί το hardcoded `IMAGE_GRID_SCAN_CAP` είναι υπαρκτό λανθάνον bug — αόρατο μόνο επειδή
έτυχε `PDF_TILE_CAP === IMAGE_GRID_SCAN_CAP === 4000`. Με το PDF path να φεύγει από τα tiles, ο
τελευταίος καταναλωτής που περνούσε διαφορετικό `cap` εξαφανίζεται ⇒ **η παράμετρος φεύγει**, το bug
πεθαίνει εξ ορισμού.)

### Απόφαση 14 — Cap patterns ανά σελίδα: **μετρημένος**, όχι αυθαίρετος

Το volume test (§Επαλήθευση) δείχνει **O(n²)** στα resource dicts (κάθε pattern παίρνει δικό του
`/Resources` που απαριθμεί **όλα** τα προηγούμενα patterns):

| clones | bytes | ms |
|---|---|---|
| 100 | 0.14 MB | 48 |
| 400 | 1.31 MB | 285 |
| 800 | 4.78 MB | 762 |

⇒ **`MAX_PDF_PATTERNS_PER_PAGE = 800`** — μετρημένο σημείο όπου το κόστος είναι ακόμη αποδεκτό
(~4.8MB / <1s). Υπέρβαση → solid + **fidelity note** (ορατό). Στην πράξη η πραγματική περίπτωση είναι
**1 pattern** (μία τοπογραφική επιφάνεια), οπότε ο cap είναι φράχτης, όχι λειτουργικό όριο.

---

## Επαλήθευση (μετρήσεις, όχι ανάγνωση πηγής)

### Από τη Φάση Α (ισχύουν)
`artifacts/spike-tiling.mjs` + `spike-out.pdf` — τρέχει με σκέτο `node`:
1. **Raw operators**: 5× `/Pattern cs` + `scn` + `f*` σε uncompressed stream
2. **pdfjs operator list**: `paintImageXObject` για το image cell
3. **Pixel probe**: 9/9 δείγματα στη σωστή φάση· στραμμένο pattern 30° → εκπεμπόμενο `/Matrix` ταιριάζει
   με την αναλυτική πρόβλεψη **σε 10 σημαντικά ψηφία**

### Από τη Φάση Β (νέες — ανατρέπουν το spike 1)

**Spike 2 — κόστος/dedup** (16 fills ίδιου υλικού+anchor):

| | clones | image XObjects | bytes |
|---|---|---|---|
| Χωρίς memoise | **16** | **1** | 31.367 |
| Με memoise (clone-key reuse) | **1** | **1** | 20.118 |

⇒ `imageXObjects === 1` **πάντα** ⇒ ο ισχυρισμός «το raster διπλασιάζεται ανά fill» είναι **λάθος**.
⇒ memoise → 1 clone για 16 fills, με **σωστό ψημένο `/Matrix`** ⇒ «dedup XOR placement» είναι **λάθος**.

**Spike 3 — volume** (worst case: κάθε fill ξεχωριστό anchor ⇒ μηδέν memoise): βλ. πίνακα Απόφασης 14.

> Τα spike 2/3 ζουν στο scratchpad (throwaway). **Δεν** μπαίνουν σε production paths.

---

## Φάσεις υλοποίησης (κάθε φάση **deployable**)

| Φ | Περιεχόμενο | Εξαρτάται από patterns; |
|---|---|---|
| **Φ1** ✅ | **Fidelity report + warnings surfacing.** `CaptureResult.fidelity` + `print-fidelity.ts` + event + registrar + i18n (el/en). **Σταματά ΑΜΕΣΩΣ τη σιωπηλή αλλοίωση** | ❌ **Ανεξάρτητη** |
| **Φ2** ✅ | **Pattern core**: `pdf-tiling-pattern.ts` (`patternMatrixFor` + per-draw registry + ένα advancedAPI block) + image/procedural fills. Καθαρισμός νεκρού κώδικα **με το χέρι** | ✅ |
| **Φ3** ⏳ | `patternSpace:'screen'` (vector stripe cell) + `predefined`/`user-defined` explode (budget-guarded, pre-pass) + `backgroundColor` | ✅ |
| **Φ4** ⏳ | `gradient` → PDF axial/radial shading patterns (Type 2/3) | ✅ |

> ⚠️ **Μετά τη Φ2 ο default τύπος κάθε νέου hatch (`user-defined`) εξακολουθεί να βγαίνει μόνο ως
> περίγραμμα** — αυτό είναι η **Φ3**, όχι παράλειψη. Η Φ2 σκότωσε το γκρι της **εικόνας/procedural**
> (το περιστατικό), όχι κάθε κενό γέμισμα.

**Νεκρός κώδικας (Φ2) — αφαίρεση ΜΕ ΤΟ ΧΕΡΙ:**
> ⚠️ **Το `knip.json` `ignore` περιέχει `src/subapps/dxf-viewer/**`. Το knip ΔΕΝ βλέπει τίποτα εδώ.**
> Ο ισχυρισμός του design v1 «το knip θα το πιάσει» είναι **ψευδής**.

- `emitClippedImage` + `clipToBoundary` (`scene-image-emitter.ts`) — **ΕΝΑΣ** consumer, ο hatch κλάδος
  (`scene-vector-emitter.ts:194`). *(Ο ισχυρισμός του design v1 ότι «το `scene-image-emitter.ts`
  εξυπηρετεί μόνο `ImageEntity`» είναι **λάθος**: το `ImageEntity` πάει από `emitResolvedImage:129`.)*
- `buildImageTileFullGrid` + `PDF_TILE_CAP` — ο PDF ήταν ο μόνος καταναλωτής
- **Ζωντανά tests σε νεκρό κώδικα** (φεύγουν μαζί): `__tests__/scene-image-emitter.test.ts:107,125,132`,
  `export/core/__tests__/image-fill-export.test.ts:25,97-135` — **απόντα από το file plan του v1**

---

## Reuse (μηδέν διπλότυπο — audit με grep, ΒΗΜΑ 0)

| SSoT | Πού ζει | Χρήση εδώ |
|---|---|---|
| `estimateHatchFillLines` + `MAX_TEK_FILL_LINES_*` | `export/core/tek/tek-hatch-explode.ts:41-68` | Budget guard **αυτούσιο** |
| `buildHatchEntitySegments` | `bim/geometry/shared/hatch-pattern-geometry.ts` | Γραμμές μοτίβου |
| `isSolidHatch` | `bim/hatch/hatch-properties.ts` | Dispatch #2 (χειρίζεται `fillType` undefined) |
| `computeImageTileMatrix` / `resolveImageFillOrigin` | `rendering/entities/shared/hatch-image-paint.ts` | **Ορισμός** tile matrix + anchor |
| `imageFillVariantKey` | `rendering/entities/shared/hatch-image-variant-key.ts` | Cell identity (dedup) |
| `renderProceduralTile` | `rendering/entities/shared/procedural-tile-render.ts` | Procedural cell (ήδη 3 call sites) |
| `prepareExportSource` / `averageImageColorHex` | `export/core/image-fill-export.ts` | Ανάλυση πηγής + fallback χρώμα |
| EventBus + `hooks/notifications/*` + `dxf-viewer-shell` | `hooks/useDxfViewerNotifications.ts` | Fidelity toasts — **μηδέν νέο κανάλι** |

**Νέο (δεν υπάρχει — επαληθεύτηκε):** `print/vector/pdf-tiling-pattern.ts`, `print/print-fidelity.ts`,
`CaptureResult.fidelity`.

---

## Consequences

- ✅ Τα procedural/image γεμίσματα βγαίνουν **μοτίβο**, ανεξάρτητα από το εμβαδόν. Το γκρι πεθαίνει.
- ✅ Το κόστος γίνεται **σταθερό ως προς το εμβαδόν** (1 pattern αντί για N tiles).
- ✅ **Καμία σιωπηλή αλλοίωση**: κάθε υποβάθμιση παράγει ορατή ειδοποίηση (Φ1, ανεξάρτητα).
- ✅ Τα `predefined`/`user-defined` γεμίζουν επιτέλους — ο **default** τύπος κάθε νέου hatch.
- ⚠️ **Ρητή απόκλιση**: screen-space hatch = 3px raster στην οθόνη, **vector 0.8mm** στο χαρτί (Απόφαση 6).
- ⚠️ **Ανοιχτό**: η ασυμφωνία γωνίας του `buildTileFrame` (DXF path) μένει καθρεφτισμένη (Απόφαση 12).
- ⚠️ **Ανοιχτό**: το `runExport` συλλέγει warnings που κανείς δεν δείχνει (Απόφαση 11).
- ⏳ **Φ4**: gradient → PDF shading patterns.
- 🔒 **Η επαλήθευση ΔΕΝ είναι τα tests.** Ο χρήστης βρήκε το bug **κοιτάζοντας PDF**. Κάθε φάση
  κλείνει με **πραγματικό εξαγόμενο PDF, ιδωμένο από τον Giorgio**.

## Changelog

- **2026-07-17** — ✅ **ΕΠΑΛΗΘΕΥΣΗ ΣΤΟ ΠΡΑΓΜΑΤΙΚΟ PDF — ο Giorgio εξήγαγε το σχέδιο του
  περιστατικού (ριγέ γραμμοσκίαση σε μεγάλη κεκλιμένη τοπογραφική επιφάνεια) και επιβεβαίωσε:
  «ΤΩΡΑ ΛΕΙΤΟΥΡΓΕΙ».** Το μοτίβο βγαίνει μοτίβο, όχι συμπαγές γκρι. **Η Φ2 έκλεισε.**
- **2026-07-17** — **Φ2 ΥΛΟΠΟΙΗΘΗΚΕ — ΤΟ ΓΚΡΙ ΠΕΘΑΝΕ.** `print/vector/pdf-tiling-pattern.ts` (**ΝΕΟ
  SSoT**: `patternMatrixFor` = ο **μόνος** κάτοχος της ακύρωσης του `F` · `createPdfPatternRegistry`
  = registry **ανά `draw()`** με clone-key memoise · `MAX_PDF_PATTERNS_PER_PAGE`) ·
  `scene-image-resolver` → **ΕΝΑ `ResolvedPatternCell`** αντί για N tiles (anchor από το **screen
  SSoT** `resolveImageFillOrigin`) · `emitHatch` → **κλειδωμένη σειρά dispatch** (Απόφαση 5:
  `dxfFaces` → `isSolidHatch` → pattern → solid fallback → **δάπεδο** outline).
  **Νεκρός κώδικας (με το χέρι — το knip αγνοεί όλο το `dxf-viewer`):** `emitClippedImage` +
  `clipToBoundary` + `buildImageTileFullGrid` + `PDF_TILE_CAP` + `TILE_KEEP_ALL`/`buildTiles`,
  **μαζί με τα ζωντανά tests τους**. **DXF μονοπάτι: μηδέν αλλαγή** (Απόφαση 13).
  **Tests:** **127/127 GREEN** (`print/` + `image-fill-export`), από τα οποία **11 νέα με
  ΑΛΗΘΙΝΟ jsPDF** — mock θα περνούσε πράσινο με λάθος μαθηματικά. `jscpd:diff` καθαρό, ESLint
  καθαρό, όλα τα αρχεία <500 γρ.
  **Δύο διορθώσεις έναντι του σχεδίου** (μετρημένες, όχι υποθετικές):
  1. Ο **cap μετακινήθηκε στο pre-pass**. Το σχέδιο τον τοποθετούσε στο registry «με fidelity note
     από τη Φ1» — **αδύνατο**: το `capture.fidelity` διαβάζεται **ΠΡΙΝ** τρέξει το `draw`, άρα
     υπέρβαση μέσα στο `draw` **δεν μπορεί ποτέ να αναφερθεί** (ακριβώς το σκεπτικό της Απόφασης 7).
     Το πλήθος των κελιών φράσσει άνω το πλήθος των patterns ⇒ ο cap είναι **υπολογίσιμος** στο
     pre-pass. Ο cap του registry μένει ως **αμυντική** δεύτερη γραμμή (N.7.2 #4).
  2. Ο κωδικός `image-fill:tile-overflow` **αντικαταστάθηκε** από `image-fill:pattern-cap` +
     `image-fill:degenerate-cell`: το μοντέλο «N πλακάκια ανά γραμμοσκίαση» **έπαψε να υπάρχει**,
     άρα ο κωδικός του ήταν πλέον **νεκρός**.
  **Ανοιχτό (εκτός scope, καταγραφή):** το `entity-export-coverage` αστοχεί για `leader` /
  `topo-surface` — **ξένη in-flight δουλειά** (ADR-662 πρόσθεσε renderable types χωρίς να ενημερώσει
  το coverage SSoT), **όχι** της Φ2· δεν αγγίχτηκε (κοινό working tree).
- **2026-07-17** — **Φ1 ΥΛΟΠΟΙΗΘΗΚΕ** (uncommitted): `print/print-fidelity.ts` (SSoT: κωδικοί +
  `summarizePrintFidelity` + `mergePrintFidelity`) · `CaptureResult.fidelity` · `capture-2d-vector`
  σταματά να πετά τα warnings · `runPrint`/`runPrintSet` → `dxf:print-fidelity-degraded` (το σετ
  **συγχωνεύεται** → ένα toast, όχι ένα ανά όροφο) · `print-fidelity-notifications.ts` (υπάρχον
  EventBus+sonner μοτίβο, μηδέν νέο κανάλι· exhaustive `Record<PrintFidelityCode,…>` ⇒ νέος κωδικός
  χωρίς μήνυμα **δεν κάνει compile**) · i18n `print.fidelity.*` σε **el+en** (ICU plurals).
  **Tests:** 10 νέα, 98/98 GREEN σε όλο το `print/`. `jscpd:diff` καθαρό.
  **Η σιωπηλή αλλοίωση σταμάτησε — ανεξάρτητα από τα patterns.** Το γκρι εξακολουθεί να βγαίνει
  (αυτό το λύνει η Φ2), αλλά ο χρήστης **το μαθαίνει** και ξέρει τη διαφυγή (raster έξοδος).
- **2026-07-17** — **PROPOSED.** Design v2 μετά από απόρριψη του v1 (3/3 κριτικοί `NEEDS_WORK`,
  8 killer issues — όλα ενσωματωμένα εδώ ως Αποφάσεις 4-13). Spike 2/3 ανέτρεψαν **δύο** θεμελιώδη
  ευρήματα του spike 1 (dedup XOR placement· raster size bomb) → η προσέγγιση είναι **φθηνότερη** από
  ό,τι νομίζαμε. Αρίθμηση 666 → **667** (το 666 δεσμεύτηκε την ίδια μέρα από το Pseudo Locale ADR).
