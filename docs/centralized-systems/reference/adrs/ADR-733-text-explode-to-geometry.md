# ADR-733 — TEXT/MTEXT Explode σε γεωμετρία (glyph outlines → LWPOLYLINE/GROUP)

- **Status**: Accepted — Φ1 υλοποιημένη (2026-07-30, εκκρεμεί commit)
- **Ημερομηνία**: 2026-07-30
- **Αίτημα**: Giorgio — «να μπορώ στο /dxf/viewer να κάνω explode τα επιλεγμένα κείμενα ή ένα γράμμα»
- **Σχετικά ADRs**: ADR-510 §Φ5 (EXPLODE SSoT), ADR-530 (glyph font rendering), ADR-344 (text engine),
  ADR-557 (text box/grip parity), ADR-575 (GROUP/UNGROUP), ADR-608 (SVG glyph → entities, ο flattener),
  ADR-635 §C.20–C.24 (layout/ύψος invariants), ADR-031 (command pattern), ADR-640 (block explode)

---

## 1. Έρευνα

### 1.1 Πώς το κάνει το AutoCAD 2021 (τοπική ανάγνωση `Express/txtexp.lsp`)

Η εντολή **TXTEXP** (Express Tools, Dominic Panholzer 1999) διαβάστηκε από το
`C:\Program Files\Autodesk\AutoCAD 2021\Express\txtexp.lsp`. Μηχανισμός:

1. Φίλτρο επιλογής: `TEXT` + `MTEXT`, **εκτός** leader text (`{ACAD_REACTORS`) και κλειδωμένων layers.
2. Απαιτεί **plan view** (0 0 1) — αλλιώς αρνείται.
3. Zoom ώστε όλα τα textbox να χωρούν στην οθόνη (+1 pixel margin).
4. `MIRROR` του κειμένου (το WMF έχει ανάποδο άξονα Y) → **`WMFOUT`** σε temp αρχείο →
   `ERASE` του πρωτοτύπου → **`WMFIN`** (επανεισαγωγή ως polylines) → `MIRROR` πίσω.
5. Αποτέλεσμα: «text object(s) have been exploded to lines… placed on **layer 0**».

Δηλαδή: **screen-space vector hack** μέσω Windows Metafile, όχι πραγματική μετατροπή γραμματοσειράς.
Τεκμηριωμένες συνέπειες (Autodesk help + forums): όλα γίνονται ευθύγραμμα τμήματα (κανένα τόξο/καμπύλη),
η ποιότητα εξαρτάται από το zoom της οθόνης τη στιγμή της εξαγωγής, χάνεται layer/χρώμα (όλα στο layer 0),
και σε TrueType fonts το καθαρό `WMFOUT`/`WMFIN` (χωρίς TXTEXP) διατηρεί το TEXT — μόνο το TXTEXP
εξαναγκάζει vectors. Στο AutoCAD LT (<2024) δούλευε μόνο με SHX fonts.

**Συμπέρασμα**: το TXTEXP είναι ιστορικό workaround. ΔΕΝ αντιγράφουμε τον μηχανισμό — αντιγράφουμε τη
**σημασιολογία** (κείμενο → polylines με μία εντολή) με σύγχρονο τρόπο.

Σημείωση: το δικό μας `text-engine/fonts/text-height-scale.ts` έχει ήδη βαθμονομηθεί (2026-07-29)
μετρώντας **εξόδους του TXTEXP** στο AutoCAD 2021 του Giorgio — άρα η μετατροπή «text height → em»
που θα χρησιμοποιήσει το explode είναι επικυρωμένη έναντι του ίδιου του AutoCAD.

### 1.2 ezdxf `text2path` (το ώριμο open-source prior art)

Το addon `text2path` του ezdxf (Python) μετατρέπει TEXT/ATTRIB σε paths μέσω fontTools:

- Τρία είδη εξόδου ως bit flags: **HATCHES** (γέμισμα), **SPLINES** (ακριβή περιγράμματα Bezier→spline),
  **LWPOLYLINES** (flattened προσέγγιση).
- Stroke fonts (`.shx`/`.shp`/`.lff`) → **μόνο paths, όχι hatches** (ανοιχτές διαδρομές, δεν γεμίζουν).
- `explode()` = virtual entities + καταστροφή πρωτοτύπου (ίδιο με το δικό μας `ExplodeEntityCommand`).
- **MTEXT δεν υποστηρίζεται** από το text2path — υπάρχει χωριστό `MTextExplode` (MTEXT → TEXT γραμμές).
  Εμείς ΔΕΝ έχουμε αυτόν τον περιορισμό, γιατί το layout SSoT μας (`layoutTextBlock`) λύνει ήδη
  αναδίπλωση/στηλοθέτες/runs για MTEXT.

### 1.3 Browser-side: opentype.js / SHX

- Το project έχει ήδη **opentype.js ^2.0.0** (`package.json`) και πλήρες font pipeline (ADR-530):
  `font-resolver` → `glyph-path-cache` → `paintTextRun`. Το `Font.getPath()/getPaths()` δίνει εντολές
  `M/L/Q/C/Z` (quadratic + cubic Bezier) ανά glyph, **με kerning**, σε y-down με baseline στο 0.
- SHX fonts: stroke-based (γραμμές, όχι κλειστά σχήματα). Στον viewer μας τα SHX ονόματα περνούν από
  το `font-substitution-table` σε outline substitute (π.χ. romans.shx → Liberation Sans) — ό,τι
  βλέπει η οθόνη θα δει και το explode (WYSIWYG). Υπάρχει και native `shx-parser/` (μόνο ευθύγραμμα
  strokes) — μελλοντική Φ2 επιλογή για «γνήσιο» SHX explode.

Πηγές: [TXTEXP docs](https://help.autodesk.com/cloudhelp/2021/ENU/AutoCAD-Core/files/GUID-80BE94B9-2ECE-438E-AEF8-984F7D27E0F9.htm) ·
[Exploding text with AutoCAD LT](https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/Exploding-text-with-AutoCAD-LT.html) ·
[cadpanacea: Exploding TEXT](https://cadpanacea.com/wp/?p=2260) ·
[ezdxf text2path](https://ezdxf.readthedocs.io/en/stable/addons/text2path.html) ·
[opentype.js](https://github.com/opentypejs/opentype.js)

---

## 2. Απόφαση

**Vector-first explode** (όχι screen-space): περπατάμε το ΙΔΙΟ layout που ζωγραφίζει την οθόνη
(`layoutTextBlock` — ADR-635 C.20/C.21 parity contract) και μετατρέπουμε κάθε glyph στα ΠΡΑΓΜΑΤΙΚΑ
περιγράμματά του από την opentype γραμματοσειρά, σε world units — ανεξάρτητα από zoom/οθόνη.

### 2.1 Σημασιολογία δύο σταδίων (καλύπτει και το «ένα γράμμα»)

- **Στάδιο 1** — EXPLODE σε TEXT/MTEXT: κάθε **γράμμα** γίνεται **μία επιλέξιμη μονάδα**:
  - glyph με ≥2 contours (π.χ. «Ο», «Β», «ά») → ένα `GroupEntity` με μέλη τα contour polylines του,
  - glyph με 1 contour (π.χ. «Ι», «C») → σκέτο κλειστό `LWPolylineEntity`.
  Έτσι ο χρήστης μετακινεί/περιστρέφει/σβήνει ΕΝΑ γράμμα με ένα κλικ.
- **Στάδιο 2** — EXPLODE στο group ενός γράμματος: ήδη δουλεύει (ADR-575 UNGROUP) → ωμά contours.

Παραλληλία με AutoCAD: EXPLODE σε MTEXT → TEXT (ενδιάμεσο στάδιο)· TXTEXP → γεωμετρία. Εμείς πάμε
κατευθείαν σε γεωμετρία αλλά κρατάμε τα γράμματα ως μονάδες — καλύτερη UX από τα «ορφανά» polylines
του TXTEXP, χωρίς νέο μηχανισμό (το GROUP υπάρχει).

### 2.2 Ενσωμάτωση: επέκταση του υπάρχοντος EXPLODE SSoT — ΚΑΝΕΝΑ νέο κουμπί

`'text'` + `'mtext'` μπαίνουν στο `EXPLODABLE_TYPES` του `systems/explode/explode-entity.ts`, με
delegation σε νέο pure module `explode-text.ts`. Αυτόματα αποκτούν explode:
- το κουμπί **Explode** (Home→Modify + Edit, shortcut **X**) μέσω `useExplodeRibbonAction`,
- το `ExplodeEntityCommand` (undo/redo/reselect) **χωρίς καμία αλλαγή** — ένα undo αναιρεί όλο το explode.

### 2.3 Μαθηματικά (parity με τον renderer, σε world space)

Ο `TextRenderer.renderTextContent` ζωγραφίζει σε screen y-down με σειρά μετασχηματισμών
`T(pos)·R(−θ)·Shear(−tanφ)·Scale(wf)`. Το explode αναπαράγει το ΙΔΙΟ layout σε world units
(worldToPx = 1, screenHeight = height) και χαρτογραφεί κάθε τοπικό σημείο p (y-down) στον κόσμο (y-up):

```
world = position + R(θ) · Shear(+tanφ) · Scale(wf, 1) · diag(1, −1) · p
```

(Η αντιστροφή προσήμων R/Shear προκύπτει από τη συζυγία με το y-flip — ίδια αρχή με το σχόλιο
«Λύση: αντιστροφή γωνίας (−rotation) λόγω Y-flip» του renderer.)

Αναλυτικά, ανά βήμα — κάθε γραμμή διαβάζει ΤΟ ΙΔΙΟ SSoT με τον renderer:

| Βήμα | SSoT |
|------|------|
| Οπτικές γραμμές/spans (αναδίπλωση, στηλοθέτες, runs) | `layoutTextBlock` + `advanceStyleOf` |
| Πρώτη γραμμή / κατακόρυφο βήμα | `resolveMultilineExtentsFromExtra` + `totalExtraLineRatio` + `spacingRatio` ανά γραμμή |
| Στοίχιση γραμμής + αγκύρωση (9-point) | `textStyle.textAlign/textBaseline` (ίδια ανάγνωση με renderer) |
| Ύψος κειμένου → em | `emSizeForTextHeight` (βαθμονομημένο έναντι TXTEXP — §1.1) |
| Baseline μέσα στη γραμμή | `baselineOffsetFromAnchor` (ADR-635 Φ C.26 — ΙΔΙΟ SSoT με `drawGlyphRunToCanvas`, καλύπτει και το `'alphabetic'` DXF baseline anchor)· διακοσμήσεις re-based μέσω `anchorBandFraction` |
| Περιγράμματα glyph | `font.getPaths(spanText, x, y, em)` (per-glyph, kerned) — tracking≠1: per-glyph pen advance όπως `stringToPath2D` |
| Flatten Bezier → σημεία | `flattenCubic`/`flattenQuad` του `svg-path-flatten.ts` (ADR-608) — γίνονται exports, ΟΧΙ δεύτερος flattener (N.18) |
| Στυλ παραγώγων (layer/χρώμα/lineweight) | `inheritEntityStyle` — **σε αντίθεση με το TXTEXP δεν πετάμε τα πάντα στο layer 0** |

Χορδική ανοχή flatten: `height / 200` ανά span (κλιμακώνεται με το μέγεθος του κειμένου — ένα κείμενο
ύψους 2.5 παίρνει tol 0.0125 world units· ομαλές καμπύλες σε κάθε λογικό zoom, χωρίς εκρηκτικό αριθμό
κορυφών).

### 2.4 Όρια / συνειδητές αποφάσεις Φ1

1. **CSS-fallback tier δεν explode-άρεται**: αν ΕΣΤΩ ΕΝΑ span του κειμένου δεν λύνει σε φορτωμένη
   opentype γραμματοσειρά (`resolveEntityFont` → null: italic faces, μη-bundled bold), το entity
   επιστρέφει `null` = no-op, όπως κάθε μη-explodable entity. **Τίμιο "δεν γίνεται" αντί για λάθος
   γεωμετρία** — δεν υπάρχουν outlines για να εξαχθούν από `ctx.fillText`. (AutoCAD LT precedent:
   απαιτούσε αντιστοίχιση SHX.)
2. **Outlines χωρίς γέμισμα**: τα γράμματα γίνονται κλειστά περιγράμματα — «κούφια», ακριβώς όπως στο
   TXTEXP. HATCH fill = Φ2 (το ezdxf το κάνει με flag· έχουμε ήδη `makeSolidFill` precedent στο export).
3. **Ευθύγραμμα τμήματα (bulge=0)**: οι καμπύλες Bezier flatten-άρονται σε κορυφές — ίδια απόφαση με
   TXTEXP και με τον ADR-608 exporter. Το LWPOLYLINE bulge εκφράζει μόνο κυκλικά τόξα, όχι Bezier.
4. **Διακοσμήσεις** (underline/overline/strikethrough): κλειστό ορθογώνιο polyline ανά διακοσμημένο
   span, με τα κλάσματα του renderer (`paintDecorations`) — τα κλάσματα προάγονται σε κοινή σταθερά
   στο `text-rendering-config.ts` ώστε renderer + explode να διαβάζουν ΜΙΑ πηγή.
5. **Annotative**: χρησιμοποιείται το βασικό ύψος του entity (ό,τι βλέπει ο renderer)· τα
   `annotationScales` δεν πολλαπλασιάζονται.
6. **bgMask/στήλες MTEXT**: το bgMask δεν παράγει γεωμετρία (decoration φόντου)· οι πολλαπλές στήλες
   ακολουθούν ό,τι κάνει ήδη το layout SSoT.
7. **Κενά/tabs**: δεν παράγουν entities (κανένα ink) — οι θέσεις των επόμενων γραμμάτων τα σέβονται
   μέσω των span x offsets.

### 2.5 Undo / εντολές

Καμία νέα εντολή: `ExplodeEntityCommand` ήδη κάνει snapshot το source, προσθέτει τα παράγωγα, αφαιρεί
το source, και αναιρεί/επανεκτελεί σωστά — το text explode είναι απλώς νέα περίπτωση του pure
`explodeEntity()`. Ένα explode Ν κειμένων = ένα undo step (ήδη multi-select).

---

## 3. Σχέδιο υλοποίησης (Φ1)

| # | Αρχείο | Αλλαγή |
|---|--------|--------|
| 1 | `systems/explode/explode-text.ts` | **ΝΕΟ** — pure: `explodeTextEntity(TextEntity\|MTextEntity): Entity[] \| null`. Layout walk (§2.3), per-glyph contours, per-letter grouping, transform σε world. |
| 2 | `utils/geometry/ot-path-flatten.ts` | **ΝΕΟ** — `flattenOtCommands(PathCommand[], tol): SvgSubpath[]` πάνω στους εξαγόμενους `flattenCubic`/`flattenQuad`. |
| 3 | `utils/geometry/svg-path-flatten.ts` | export τα `flattenCubic`, `flattenQuad` (ήταν private)· καμία αλλαγή λογικής. |
| 4 | `systems/explode/explode-entity.ts` | `EXPLODABLE_TYPES` += `'text'`, `'mtext'`· delegation στο `explodeTextEntity`. |
| 5 | `systems/entity-creation/inherit-entity-style.ts` | `ENTITY_STYLE_SKIP` += text πεδία (`position`, `text`, `textNode`, `fontSize`, `fontFamily`, `textStyle`, `alignment`, `widthFactor`, `lineSpacing`, `paragraphSpacing`, `wordWrap`, `isAnnotative`, `annotationScales`, `attributeTag`, `areaSourceId`) — superset-safe, ίδιο συμβόλαιο. |
| 6 | `config/text-rendering-config.ts` | Νέα κοινή σταθερά `TEXT_DECORATION_RATIOS` (0.90 / −0.05 / 0.40 / πάχος 0.07). |
| 7 | `rendering/entities/TextRenderer.ts` | `paintDecorations` διαβάζει τη νέα σταθερά (αντί για inline μαγικούς αριθμούς). |
| 8 | `systems/explode/__tests__/explode-text.test.ts` | **ΝΕΟ** — jest με stub Font (getPaths/getAdvanceWidth): contours→polylines, per-letter grouping, transform (rotation/wf/oblique), inherit style, null σε unresolved font. |

Εκτίμηση: ~8 αρχεία, 1 domain (dxf-viewer). Χωρίς νέο npm package (opentype.js υπάρχει ήδη — MIT ✅).
Δεν αγγίζονται ADR-040 micro-leaf αρχεία. CHECK 6D καλύπτεται από το παρόν ADR στο ίδιο commit.

## 4. Φάση 2 (μελλοντικά, εκτός παρόντος scope)

- HATCH solid fill ανά γράμμα (ezdxf Kind.HATCHES — έχουμε `makeSolidFill` στο export layer).
- Native SHX stroke explode (shx-parser strokes → ανοιχτά polylines, χωρίς substitution).
- Bezier → SplineEntity έξοδος (χρειάζεται Bezier→NURBS γέφυρα — το `SplineEntity` είναι NURBS μοντέλο).
- Context-menu entry «Διάλυση κειμένου» (precedent: `DimensionContextMenu`).

## 5. Changelog

- **2026-07-30** — Δημιουργία: έρευνα (τοπικό TXTEXP.LSP AutoCAD 2021, ezdxf text2path, opentype.js,
  SHX), απόφαση αρχιτεκτονικής vector-first two-stage, σχέδιο Φ1.
- **2026-07-30** — Φ1 υλοποιήθηκε: `explode-text.ts` (νέο), `ot-path-flatten.ts` (νέο),
  `svg-path-flatten.ts` (export πυρήνων), `explode-entity.ts` (+text/mtext), `inherit-entity-style.ts`
  (+text skip keys), `TEXT_DECORATION_RATIOS` στο config + `TextRenderer.paintDecorations` το διαβάζει.
  Ευθυγραμμισμένο με το παράλληλο ADR-635 Φ C.26 (anchor `'alphabetic'`): row μέσω
  `verticalAnchorToRow`, baseline μέσω `baselineOffsetFromAnchor`, διακοσμήσεις μέσω
  `anchorBandFraction` — κανένα τοπικό ternary. Tests: `__tests__/explode-text.test.ts` (9) +
  υπάρχοντα explode (12) + fillet/corner (51) πράσινα· jscpd:diff καθαρό (7 αρχεία).
