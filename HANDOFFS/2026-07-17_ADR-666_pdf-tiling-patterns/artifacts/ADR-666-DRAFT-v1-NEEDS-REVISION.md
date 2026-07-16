# ADR-666 — Native PDF tiling patterns για hatch fills (vector export)

- **Status:** PROPOSED
- **Date:** 2026-07-17
- **Owner:** DXF Viewer
- **Related:** ADR-608 (vector PDF export — αυτό το ADR **αίρει** τα Known Limitations (a) και (e)), ADR-643 (image-fill hatch), ADR-653 (procedural υλικά), ADR-507 (fillType/gradient), ADR-505 (BIM→DXF primitives), ADR-040 (deferred draw closure), ADR-661 (2D z-order)
- **Αρίθμηση:** επαληθεύτηκε με `ls docs/centralized-systems/reference/adrs/` — υψηλότερο υπαρκτό = ADR-665· το 666 είναι ελεύθερο.

---

## 1. Πλαίσιο (Context)

### 1.1 Το επιβεβαιωμένο σφάλμα

Ένας μεγάλος **λοξός τοπογραφικός hatch** με διαδικαστικό υλικό (stripes) εξάγεται στο vector PDF ως **επίπεδο γκρι**. Η αιτία εντοπίστηκε πλήρως:

1. Ο PDF resolver (`print/vector/scene-image-resolver.ts:137`) χτίζει **πλήρες πλέγμα tiles** πάνω στο bbox του hatch με `PDF_TILE_CAP = 4000` (γραμμή 47).
2. Ένας **λοξός** hatch έχει bbox πολύ μεγαλύτερο από την πραγματική του επιφάνεια → το πλέγμα εκρήγνυται.
3. Το `collectTiles` κόβεται στο `IMAGE_GRID_SCAN_CAP = 4000` (`export/core/image-fill-export.ts:98`) — το οποίο **αγνοεί το όρισμα `cap` που του περνιέται** (υπαρκτό bug).
4. `grid.overflow = true` → `solidFallbacks.set(hatch.id, averageImageColorHex(...))` → **γκρι**.
5. Το `warnings.push('image-fill:tile-overflow')` γράφεται σε ένα πεδίο **που δεν διαβάζει κανείς**: εξαντλητικό grep σε όλο το `print/` για `.warnings` δίνει **μηδέν** καταναλωτές. Ούτε logger. Ο χρήστης δεν μαθαίνει **τίποτα**.

### 1.2 Το δεύτερο, ευρύτερο σφάλμα

Ανεξάρτητα από το cap, το `emitHatch` (`scene-vector-emitter.ts:204-207`) έχει default branch:

```ts
// Pattern/plain hatch → stroke the boundary loops (outline). Pattern lines: raster fallback.
for (const loop of e.boundaryPaths ?? []) {
  if (loop.length >= 2) strokePolyline(pdf, loop, true, toPaper);
}
```

Άρα **solid**, **user-defined**, **predefined** και **gradient** hatches εξάγονται ως **γυμνό περίγραμμα**. Το ADR-608 το κατέγραψε ως Known Limitation (a) «pattern lines → raster fallback» — αλλά ο χρήστης **δεν ειδοποιείται ποτέ** να αλλάξει σε raster. Απλώς το γέμισμα λείπει.

### 1.3 Γιατί τώρα

Το κοινό στοιχείο και των δύο είναι **δομικό, όχι ρυθμιστικό**: το PDF path προσπαθεί να προσομοιώσει γέμισμα **σφραγίζοντας N raster tiles**. Το ανέβασμα του cap μεταθέτει το πρόβλημα και φουσκώνει το PDF. Το PDF έχει **native tiling patterns** — ένα αντικείμενο, άπειρη επανάληψη, μηδέν tiles. Το Revit/ArchiCAD ακριβώς αυτό εκπέμπουν.

---

## 2. Ground truth — τι αποδείχθηκε εκτελεστικά (ΟΧΙ από ανάγνωση πηγής)

Έγινε **spike** που παρήγαγε πραγματικό PDF (jsPDF 3.0.4, doc φτιαγμένο **ακριβώς** όπως το `pdf-assembler.ts:90`: `new jsPDF({orientation, unit:'mm', format})`). Επαληθεύτηκε **τρεις ανεξάρτητους τρόπους**: raw bytes του content stream, `pdfjs-dist` operator list, και **pixel probe** σε πραγματικό raster render.

**Δουλεύει:**
- Pattern ορισμένο σε `advancedAPI()`, γεμισμένο από το **κανονικό COMPAT mode** της εφαρμογής (mm, Y-down). Το filling **δεν έχει κανένα apiMode gate** — επιβεβαιώθηκε με εκτέλεση, όχι μόνο με ανάγνωση.
- Λοξό παραλληλόγραμμο, even-odd fill: `/Pattern cs` + `scn` + `f*`.
- Περιστροφή pattern (30°): το εκπεμπόμενο `/Matrix` ταιριάζει με την αναλυτική πρόβλεψη σε **10 σημαντικά ψηφία**.
- **Αγκύρωση σε world origin**: pixel probe, 9/9 δείγματα ταιριάζουν με την προβλεπόμενη φάση των λωρίδων. Οι μόνες «αποκλίσεις» είναι δείγματα ακριβώς πάνω στο όριο λωρίδας → επιστρέφουν antialiasing blend, δηλαδή **το όριο είναι ακριβώς εκεί που λέει η μαθηματική**.
- **Image cell** (`addImage` μέσα στο cell): δουλεύει χωρίς ειδικό χειρισμό· το `/XObject` μπαίνει αυτόματα στο `/Resources` του pattern.

**Οι δύο παγίδες που καθορίζουν την αρχιτεκτονική:**

1. **Το flip matrix του jsPDF είναι μονάδο-λάθος.** Το `fillWithPattern` (5154) χτίζει `F = Matrix(1,0,0,-1,0,getPageHeight())` όπου το `getPageHeight()` επιστρέφει **mm** (210.0016), ενώ το PDF spec απαιτεί το pattern `/Matrix` να μαπάρει σε **points**. Σώζεσαι μόνο επειδή το F είναι **involution** και το ακυρώνεις. Αν περάσεις «λογικό» matrix χωρίς ακύρωση → το pattern πέφτει **~74mm λάθος, σιωπηλά**.
2. **Dedup και έλεγχος τοποθέτησης είναι αμοιβαία αποκλειόμενα** στον προφανή δρόμο. Αν παραλείψεις `patternData.matrix` → μηδέν clones **αλλά** το pattern space καταρρέει σε **points, Y-up από το κάτω μέρος** (pixel-probed: το 6-μονάδων cell βγήκε 6pt = 2.117mm). Αν δώσεις matrix → το `cloneTilingPattern` (5122-5134) φτιάχνει **νέο pattern object σε ΚΑΘΕ fill**, ποτέ cached, με **πλήρες αντίγραφο του cell stream**. Για image cell = **το raster ανά fill**. 5 fills / 2 ορισμοί → 5 objects (P1..P5).

---

## 3. Απόφαση

### 3.1 Διπλή στρατηγική ανά φύση του fill — όχι ένα σφυρί για όλα

| fillType | Στρατηγική | Αιτιολόγηση |
|---|---|---|
| `image` (raster/tint/procedural) | **Native TilingPattern** | Εξαφανίζει tiles+cap. Εδώ είναι το σφάλμα. |
| `user-defined` | **Vector segments** | Ακριβές clip υπάρχει ήδη· AutoCAD βλέπει γραμμές |
| `predefined` (PAT) | **Vector segments** | Pattern cell **αδύνατο** — βλ. §3.2 |
| `solid` | **`fillPolygon` even-odd** | Δεν θέλει pattern |
| `gradient` | **ShadingPattern** (Φ4) | Native PDF, 1:1 με canvas |
| `dxfFaces` | αμετάβλητο | Ήδη σωστό |

### 3.2 Γιατί ΟΧΙ patterns για τις γραμμές (η μη-προφανής απόφαση)

Ένα PDF tiling cell είναι **ορθογώνιο** με `xStep`/`yStep`. Μία οικογένεια παράλληλων γραμμών σε γωνία α εκφράζεται (άξονο-ευθυγραμμισμένο cell + περιστροφή στο `/Matrix`). Ένα **predefined PAT** όμως έχει **N οικογένειες σε αυθαίρετες γωνίες με dash spans** — κοινό ορθογώνιο πλέγμα επανάληψης για γωνίες με άρρητο λόγο **δεν υπάρχει**.

Και το αποφασιστικό: **υπάρχει ήδη ακριβής SSoT**. Το `buildHatchEntitySegments` (`bim/geometry/shared/hatch-pattern-geometry.ts:338`) επιστρέφει segments **κομμένα ακριβώς στο boundary polygon** με islands (μέσω `clipSegmentToRegion`, όχι απλό bbox clip). Το να τα εκπέμψουμε ως `pdf.lines` είναι **πιο σωστό, πιο απλό, και πιο χρήσιμο**: το AutoCAD PDFIMPORT βλέπει **πραγματικές γραμμές** στο `PDF_Geometry`, όχι αδιαφανές pattern. Επιπλέον είναι **ο ίδιος SSoT που τροφοδοτεί την οθόνη και τον DXF writer** → τρία backends, μία γεωμετρία.

### 3.3 Ο μηχανισμός patterns — η εξυπνάδα που ακυρώνει και τις δύο παγίδες

**Μη δίνεις ποτέ `patternData.matrix`. Βάλ' το στον constructor.**

Ο `TilingPattern(boundingBox, xStep, yStep, gState, matrix)` (jspdf.node.js:974-988) δέχεται matrix, και το `putTilingPattern` (3029-3034) γράφει `/Matrix` από το `pattern.matrix`:

```js
if (pattern.matrix) { options.push({ key: "Matrix", value: "[" + pattern.matrix.toString() + "]" }); }
```

Άρα:
```
ensurePattern(pdf, spec):
  new TilingPattern(bbox, xStep, yStep, null, M_final)     ← matrix ΜΕΣΑ
  pdf.advancedAPI(() => { beginTilingPattern(tp); <cell>; endTilingPattern(key, tp) })
…
pdf.fillEvenOdd({ key, boundingBox, xStep, yStep })         ← ΧΩΡΙΣ matrix
```

Το guard `if (patternData.matrix)` (5156-5167) **δεν μπαίνει** → **μηδέν clones**, αναφέρεται το original id, το `/Matrix` βγαίνει **αυτούσιο**, και **δεν χρειάζεται ακύρωση του F**.

> ⚠️ **Ειλικρίνεια — αυτό είναι code-verified, ΟΧΙ execution-verified.** Το spike απέδειξε «matrix=null στον constructor + κανένα patternData.matrix → points space». Δεν δοκίμασε «matrix ΣΤΟΝ constructor + κανένα patternData.matrix». Γι' αυτό η **Φ0 είναι micro-spike, όχι παραδοχή**. Αν διαψευστεί → Fallback A (§6.3).

### 3.4 Dedup

`patternKey = imageFillVariantKey(fill) + '|' + placementKey`, όπου `placementKey = round(anchor) + angle + tileW×tileH`.

- Ίδιο υλικό **και** ίδια τοποθέτηση → **ΕΝΑ pattern object**.
- Ίδιο υλικό, διαφορετικό anchor (default = bbox-BL, άρα per-hatch) → **δύο objects**. **Αναπόφευκτο**: το anchor ζει μέσα στο `/Matrix` και το `/Matrix` ζει στο pattern dict. Το εναλλακτικό (επιβολή κοινού anchor) θα **άλλαζε την εικόνα σε σχέση με την οθόνη** → απορρίπτεται (preview===commit).
- Το **cell stream** πάντως παράγεται **μία φορά ανά variantKey** και το `alias` του `addImage` εξασφαλίζει ότι τα **bytes ενσωματώνονται μία φορά**. Κόστος CPU = O(variants), όχι O(hatches).

### 3.5 Κανόνας μονάδων (γράψ' τον στο header κάθε αρχείου)

> **world = mm σχεδίου · paper = mm χαρτιού · PDF default user space = points.**

Το `buildPatternMatrix` είναι **το μοναδικό σημείο** μετάβασης mm→points. **Κανένα** call site δεν ξαναγράφει matrix μαθηματικά. Και **ποτέ hardcoded 210** — το `getPageHeight()` για A4 landscape δίνει `210.0015555…` (floating slop από το pt↔mm round trip).

---

## 4. Τι φεύγει (root-cause removal)

**PDF path:** `PDF_TILE_CAP` → διαγράφεται. `buildImageTileFullGrid` → διαγράφεται (ήταν PDF-only· γίνεται dead code). Ο σιωπηλός `tile-overflow` downgrade → **παύει να υπάρχει ως έννοια** (ένα pattern δεν έχει πλήθος tiles). **Ο λοξός τοπογραφικός hatch δεν μπορεί πλέον να βγει γκρι.**

**DXF path — ΜΗΔΕΝ αλλαγές.** Το native DXF `HATCH` **δεν έχει image fill** και δεν έχει patterns· τα tiles εκεί είναι σωστή απόφαση (ADR-643 §6). `buildImageTilePlacements` / `IMAGE_TILE_CAP=400` / `resolveImageFillsForDxf` / PIP culling → **άθικτα**. Οι δύο grid builders μένουν **σκόπιμα ξεχωριστοί**.

**`emitClippedImage` παραμένει** — αλλά μόνο για `ImageEntity` (γυμνές εικόνες: δέντρα/ταπετσαρίες).

---

## 5. Πολιτική fallback — ΠΟΤΕ σιωπηλά

Το νεκρό `warnings: string[]` **αντικαθίσταται** από τυπωμένο `PrintFidelityReport`, που ταξιδεύει `resolver → CaptureResult → runPrint → EventBus → toast`.

Κανάλι = **το υπάρχον notification SSoT**, μηδέν νέος μηχανισμός: `EventBus` + registrar στο `hooks/notifications/` (ακριβές mirror του `grid-build-notifications.ts`), wired στο `useDxfViewerNotifications`. **ΕΝΑ aggregated event ανά εργασία εκτύπωσης** (counts ανά reason) — όχι N toasts.

i18n (N.11): κλειδιά `print.fidelity.*` σε **el ΚΑΙ en**, ICU πληθυντικός, **πριν** τον κώδικα.

Σκάλα υποβάθμισης — κάθε σκαλί **ειδοποιεί**:

| Κατάσταση | Απόδοση | Ειδοποίηση |
|---|---|---|
| Όλα καλά | pattern / segments / solid | καμία (μηδέν θόρυβος) |
| Image decode fail | solid = μέσο χρώμα | ⚠️ `imageDecodeFailed` |
| Encode fail | solid | ⚠️ `imageEncodeFailed` |
| Άγνωστο fillType | boundary outline | ⚠️ `patternUnsupported` |
| Gradient πριν τη Φ4 | solid = μεσαίο stop | ⚠️ `gradientUnsupported` |
| Segments > 50k | **σωστό, πλήρες** | ℹ️ `segmentCountHigh` (μέγεθος, **όχι** υποβάθμιση) |

**Ρητά απορρίπτεται** cap που κόβει segments: ορθότητα πρώτα, ενημέρωση για το μέγεθος μετά.

---

## 6. Φάσεις — κάθε μία αφήνει το repo deployable

- **Φ0 — micro-spike (μηδέν product code).** Επιβεβαίωσε §3.3. Παραδοτέο: απάντηση ναι/όχι + οι πραγματικές τιμές `/Matrix`.
- **Φ1 — Fidelity report + notifications + i18n.** **ΠΡΩΤΑ** — ώστε καμία επόμενη φάση να μην μπορεί να στείλει σιωπηλή υποβάθμιση. Καμία αλλαγή rendering· το σημερινό `tile-overflow` γίνεται **ορατό** αμέσως. Deployable, από μόνο του χρήσιμο.
- **Φ2 — solid + user-defined + predefined → vector.** Λύνει το Known Limitation (a). **Μηδέν pattern μηχανισμός** — μόνο υπάρχων SSoT. Μεγαλύτερο κέρδος, μικρότερο ρίσκο.
- **Φ3 — image/procedural → TilingPattern.** Διαγραφή `buildImageTileFullGrid` + `PDF_TILE_CAP`. **Εδώ πεθαίνει το αναφερθέν σφάλμα.**
- **Φ4 — gradient → ShadingPattern.** ⚠️ Το jsPDF **πετά TypeError** αν λείπει το matrix στο shading branch (5148, χωρίς `identityMatrix` fallback — αντίθετα με το tiling branch που έχει guard στο 5157).
- **Φ5 — volume test.** Πραγματικός τοπογραφικός χάρτης. Μέτρηση μεγέθους PDF + O(n²) resource dicts (§7.2). Αν αποτύχει → §6.3.

### 6.3 Fallback A (αν η Φ0 διαψευστεί)
Ο **αποδεδειγμένος** clone path (`patternData.matrix` + ακύρωση `F.multiply(M_final)`) **συν** δικό μας memo cache στο registry ώστε ίδιο (variant+placement) να μη ξανα-κλωνοποιείται. Λειτουργεί — απλώς πληρώνει ένα αντίγραφο cell stream ανά **διακριτή** τοποθέτηση αντί για ανά fill. Το registry API **δεν αλλάζει** — η στρατηγική είναι κρυμμένη πίσω από το `ensure()`.

---

## 7. Συνέπειες

### 7.1 Θετικές
- ✅ Ο λοξός τοπογραφικός hatch εξάγεται **σωστά**, σε **οποιοδήποτε** μέγεθος. Δεν υπάρχει cap να χτυπήσει.
- ✅ solid/user-defined/predefined αποκτούν **πραγματικό γέμισμα** — τα Known Limitations (a) και (e) του ADR-608 **αίρονται**.
- ✅ Πολύ **μικρότερο** PDF στην κοινή περίπτωση: ένα pattern object αντί για N raster tiles.
- ✅ Οι γραμμές γίνονται **εισαγώγιμες οντότητες** στο AutoCAD, όχι σφραγισμένα pixel.
- ✅ **Καμία σιωπηλή υποβάθμιση** πουθενά στο print pipeline — για πρώτη φορά.

### 7.2 Αρνητικές / ρίσκα που αναλαμβάνουμε
- ⚠️ **Resource dicts O(n²)**: το jsPDF δίνει σε **κάθε** pattern δικό του `/Resources` που περιλαμβάνει **και τα 14 standard fonts, όλα τα XObjects, και κάθε pattern που ορίστηκε ως τότε**. Με N patterns → N dicts που το καθένα απαριθμεί έως N patterns. Στα 5 ασήμαντο· **αμέτρητο** στα εκατοντάδες. Γι' αυτό υπάρχει η Φ5.
- ⚠️ Το `buildPatternMatrix` είναι **load-bearing και μη-προφανές**. Open-coding ανά call site → σιωπηλά λάθος τοποθετημένα patterns.
- ⚠️ Πυκνός `user-defined` hatch σε μεγάλη επιφάνεια → δεκάδες χιλιάδες segments. Σωστό αλλά μεγάλο· γι' αυτό το `segmentCountHigh`.
- ⚠️ Το `fillWithPattern` κάνει **σιωπηλό no-op** σε άγνωστο key (`patterns[undefined]` δεν ταιριάζει σε κανένα instanceof branch, 5140-5151) → **αόρατο σχήμα, μηδέν error**. Το registry **υποχρεωτικά** κάνει assert πριν το fill.
- ⚠️ Raster assertion σε CI: το pdfjs πετά `InvalidArg` σε pattern fills στον Node χωρίς custom `canvasFactory` (`@napi-rs/canvas`). Είναι όριο του pdfjs/Node, **όχι** ελάττωμα του παραγόμενου PDF.

### 7.3 Ρητά εκτός σκοπού
- Το **Φ3 του ADR-608** (PDF slot στον Export dialog· `export-service.ts:54` ακόμη πετά `EXPORT_FORMAT_NOT_READY:pdf`). Το vector PDF είναι προσβάσιμο **μόνο** από τον Print dialog. Όποιος δουλέψει «στο export PDF pipeline» πρέπει να στοχεύσει τον **Print** dialog.
- Το 3D (πάντα raster — δεν έχει vector αναπαράσταση).

---

## 8. Changelog

- **2026-07-17** — **ADR-666 δημιουργήθηκε (PROPOSED)** (Opus· αίτημα Giorgio: «Revit/ArchiCAD-grade rewrite του hatch export στο vector PDF path»). Ground truth πριν από κάθε σχεδίαση: (1) πλήρης ανάγνωση του `jspdf.node.js` 3.0.4 (32.350 γραμμές) — advancedAPI/PatternData/Matrix/fill gating· (2) πλήρες inventory του hatch domain (fillType/units/SSoT/caches)· (3) πλήρες pipeline trace Print→emitHatch· (4) **εκτελεστικό spike** που παρήγαγε πραγματικό PDF με native tiling patterns, επαληθευμένο με raw bytes + pdfjs operator list + pixel probe. Το spike **ανέτρεψε** την αρχική υπόθεση «ένα pattern ανά υλικό, reused παντού»: dedup και έλεγχος τοποθέτησης είναι αμοιβαία αποκλειόμενα στον προφανή δρόμο (§2). Η σχεδίαση **απορρίπτει** επίσης τα patterns για γραμμές (§3.2) υπέρ του υπάρχοντος `buildHatchEntitySegments` SSoT — απλούστερο, ακριβέστερο, AutoCAD-importable. Ανοιχτό: **Φ0 micro-spike** για το §3.3 (constructor-matrix + key-only fill) — code-verified, όχι execution-verified· Fallback A έτοιμο. **UNCOMMITTED — μόνο πρόταση, μηδέν κώδικας.**