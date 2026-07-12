# ADR-642 — Complex Linetypes: embedded text, symbols, width, caps/joins & compound strokes

- **Status:** 🟢 ACCEPTED — **Φ1 (stroke geometry) IMPLEMENTED** (2026-07-12). **Φ2-A (embedded text: render + editor + live preview) IMPLEMENTED** (2026-07-12). **Φ2-B IMPLEMENTED** (2026-07-12): μέρος 1 — full-canvas entity routing (κάθε renderer LINE/POLYLINE/ARC/CIRCLE ρουτάρει το `──GAS──` μέσω `strokeStyledPolyline` όταν ο τύπος έχει `complex`)· μέρος 2 — DXF `[TEXT,...]` import/export (LTYPE reader parse-άρει τα embedded 74/340/46/50/44/45/9 → `complex`, resolve `340`→font μέσω `buildStyleHandleFontMap`· writer εκπέμπει τα descriptors με synthetic STYLE handle ανά styleId· `.lin` reader δεν υπάρχει στο repo → εκτός scope). **Φ3-A (symbols: render + catalog + editor) IMPLEMENTED** (2026-07-12): builtin `linetype-symbol-catalog` (×/+/∗/○/□/tick/βέλος/μόνωση/δέντρο ως `AnnotationSymbolPrimitive[]`) + shared `stampSymbolPrimitive` painter (extracted από `AnnotationSymbolRenderer` → ΕΝΑ SSoT για annotation+linetype glyphs) + `drawSymbolElement` (mirror text) στον stroker + Symbol row στον editor. **Φ3-B (DXF symbol I/O) IMPLEMENTED** (2026-07-12): 3-tier resolution — Tier 1 Nestor `NESTOR_APP_LTYPE` XDATA (δικά μας αρχεία → lossless glyph/role/scale/rot/offset), Tier 2 well-known `acad.lin` όνομα→glyph (`FENCELINE1→circle` κ.λπ.· χαρτογράφηση με όνομα, ΟΧΙ με shape#), Tier 3 graceful-skip· universal-valid `49 0.0` degrade (κανένα dangling `.shx` ref)· §6.6.3. **Φ4 (corner-role symbols + alignDash) IMPLEMENTED** (2026-07-12): `innerCorner`/`outerCorner` glyphs στις κοίλες/κυρτές κορυφές (turn-sign classification μέσω `polylineVertices`), `start`/`end` στα άκρα — πέρασμα ΟΡΘΟΓΩΝΙΟ στον arc-length walk (`side` symbols μένουν στον κύκλο)· `alignDash` corner policy (dash αντί για κενό σε κάθε κορυφή)· role selector στον editor· round-trip corner-role μέσω XDATA επιβεβαιωμένο· §6.4 βήμα 3. **Φ5-A (compound layers: model + presets + editor + render) IMPLEMENTED** (2026-07-12): multi-layer authored model (`LinePatternLayer` = segments + `offsetMm` + `widthMm?`) ⇄ `ComplexLinetypeDef.layers[]` (`layersToComplex`/`complexToLayers`)· presets (δρόμος = 2 solid rails ±offset, σιδηρόδρομος = 2 rails + centre ties)· `LinePatternLayersEditor` (per-layer offset + nested single-layer editor + preset picker + compound WYSIWYG preview)· render + `offsetPolyline` ΗΔΗ από Φ1· solid sub-layers επιτρέπονται σε compound. **Φ5-B (DXF compound I/O) IMPLEMENTED** (2026-07-13): graceful-degrade base layer geometry (`49` slots → ξένος reader βλέπει μία γραμμή) + Nestor `NESTOR_APP_LTYPE` XDATA lossless για ΟΛΑ τα layers (per-layer `offsetMm`/`widthMm` + πλήρης element list των `layers[1..]`)· disjoint key namespace (`clayer`/`coff`/`cw`/`cel.*`) από τα Φ3-B symbol keys → record με ΚΑΙ symbols ΚΑΙ compound parse-άρει καθαρά· base-layer offset ≠ 0 διατηρείται (road ±0.5, χωρίς centre)· §6.6.4· mirror Φ3-B. Scope §9 εγκρίθηκε· Φ2 scope (2026-07-12): Q1 = υπάρχον text SSoT (`resolveEntityFont`), Q2 = `followPath` toggle ανά κείμενο (default true), Q3 = render+editor+preview πρώτα, DXF μετά. Φ2-B scope (2026-07-12): routing πρώτα, ΟΛΑ τα entity types μαζί (κοινό seam), STYLE handle = synthetic-per-styleId (MLINE pattern) στο μέρος 2. Φ3 scope (2026-07-12): symbol seed = οι 9 τοπογραφικά/utility glyphs· DXF export = **full-enterprise «όπως οι μεγάλοι» → graceful-degrade valid geometry + Nestor XDATA preservation** (Revit/ArchiCAD-style lossless-in-ecosystem· = Φ3-B)· render+editor πρώτα (mirror Φ2-A/Φ2-B).
- **Date:** 2026-07-12
- **Domain:** DXF Viewer · Linetype subsystem · Canvas render pipeline · Pattern editor UI · DXF/`.lin` I/O · Persistence
- **Related:** ADR-358 (Linetype ISO catalog + `LinetypeRegistry` SSoT), ADR-362 (Path B: user-authored reusable line patterns — the segment editor), ADR-357 §5.5 (canonical mm units), ADR-510 Φ2E #4 (copy-on-write inline pattern edit), ADR-040 (micro-leaf render discipline / bitmap cache keys)
- **Design input:** Web research sweep (2026-07-12) across AutoCAD/Civil 3D, Bentley MicroStation, Adobe Illustrator, SVG Strokes spec, Revit, Figma — see §3.

---

## 1. Context

Σήμερα, στο **Edit Mode**, ο χρήστης δημιουργεί τύπους γραμμής μόνο από **γραμμές, τελείες και κενά**
(dash / dot / gap). Ο Giorgio ζήτησε να δούμε **πώς οι μεγάλοι παίκτες** (AutoCAD, MicroStation,
Illustrator, Revit, Figma, καρτογραφικά GIS) φτιάχνουν τύπους γραμμών & πολυγραμμών, γιατί ξέρει ότι
χρησιμοποιούν και **άλλα σύμβολα** (π.χ. στα τοπογραφικά οι περιφράξεις με `×` ή `*`), και θέλει να
φτάσουμε το σύστημά μας σε **full-enterprise, Revit/Maxon/Figma-level**.

Η έρευνα επιβεβαίωσε ότι υπάρχουν **11 διακριτοί μηχανισμοί** — καλύπταμε μόνο τους 3 (dash/dot/gap).

## 2. Decision (σύνοψη)

1. **Ενοποιημένο μοντέλο δεδομένων**: ένας τύπος γραμμής = διατεταγμένη λίστα από **στοιχεία μοτίβου**
   (`PatternElement` — discriminated union: `dash | gap | dot | text | symbol`) + **stroke attributes**
   (caps, joins, width profile, scale-space, corner policy) + προαιρετικά **compound layers**.
2. **Custom stroking engine** αντί για native `ctx.setLineDash()`: arc-length διάσχιση του path με
   τοποθέτηση στοιχείων (dashes/text/symbols) — γιατί το `setLineDash` **δεν** μπορεί να αποδώσει
   κείμενο/σύμβολα/μεταβλητό πλάτος/ρόλους γωνίας.
3. **Superset & backward-compatible**: το σημερινό `pattern: number[]` παραμένει έγκυρο (auto-migrate
   στη νέα δομή). Καμία απώλεια, κανένα rework των υπαρχόντων ISO linetypes.
4. **Phased roadmap (Φ1–Φ5)** ώστε να χτιστεί σταδιακά χωρίς rework (§7).

---

## 3. Research findings — τι κάνουν οι μεγάλοι

Οι CAD/vector εφαρμογές χωρίζουν τους τύπους γραμμής σε **simple** (dash/dot/gap — pen up/down) και
**complex** (dash/dot/gap **+ ενσωματωμένο κείμενο & σύμβολα + geometry attributes**). Οι 11 μηχανισμοί:

| # | Μηχανισμός | Παράδειγμα | Ποιος τον έχει |
|---|---|---|---|
| 1 | **Multi-segment dash array** (αυθαίρετη ακολουθία dash/gap/dot, ελεύθερα μήκη) | `── · ── · ──` | Όλοι (SVG `stroke-dasharray`, Revit, Figma) — **✅ το έχουμε** |
| 2 | **Ενσωματωμένο κείμενο** (text style, scale, rotation, X/Y offset, follow-path) | `──GAS──GAS──` | AutoCAD `["GAS",STYLE,S,R,X,Y]`, ArcGIS, MicroStation |
| 3 | **Ενσωματωμένα σύμβολα / glyphs** (shape από βιβλιοθήκη, scale/rot/offset) | `──×──×──×──` (φράχτης) | AutoCAD (`.shx` shapes), MicroStation (point symbols) |
| 4 | **Ρόλοι θέσης συμβόλου** (side / inner-corner / outer-corner / **start** / **end**) | βέλος μόνο στο τέλος· ειδικό σύμβολο στη γωνία | Illustrator **Pattern Brush (5 tiles)** — killer feature |
| 5 | **Άκρα ανά dash (caps)**: `butt` / `round` / `square` | στρογγυλές τελείες vs τετράγωνες | SVG `stroke-linecap`, MicroStation dash caps, Figma |
| 6 | **Γωνίες (joins)**: `miter` / `round` / `bevel` + miter-limit | γωνία πολυγραμμής | SVG `stroke-linejoin`, όλοι |
| 7 | **Corner/vertex policy**: το μοτίβο **σπάει** (Break) ή **διαπερνά** (Bypass) στη γωνία· "align dashes to corners & ends" | παυλίτσα να πέφτει στη γωνία, όχι κενό | MicroStation (Break/Bypass), Illustrator (align dashes) |
| 8 | **Μεταβλητό πλάτος / taper (width profile)** | καλλιγραφική/fusiform γραμμή | Illustrator Width Tool & stroke profiles, MicroStation width-per-stroke (Full/Left/Right) |
| 9 | **Compound / πολυστρωματικός** (N παράλληλα στοιχεία με offset) | διπλή γραμμή δρόμου· σιδηρόδρομος (2 rails + ties) | MicroStation compound line styles |
| 10 | **Phase / offset** (από πού μέσα στο μοτίβο ξεκινά) | `stroke-dashoffset` | SVG, όλοι |
| 11 | **Scale-space: model vs paper** (μοτίβο κλιμακώνεται με το σχέδιο ή σταθερό στο χαρτί) | dash 3 mm πάντα 3 mm στην εκτύπωση | Revit (paper-based), AutoCAD (`PSLTSCALE`/`MSLTSCALE`) |
| — | **Continuous generation κατά μήκος polyline** (`LTGEN`) | μοτίβο αδιάκοπο σε όλη την polyline | AutoCAD `LTGEN`, Figma/Illustrator by default |
| — | **Art-brush stretch** (ένα σχέδιο τεντώνεται σε όλο το μήκος, προστατευμένα άκρα) | *out of scope Φ1–Φ5* | Illustrator Art Brush |
| — | **Raster / filled line styles** | *out of scope (χαμηλή αξία)* | MicroStation raster |

**Πηγές:** AutoCAD "Create Complex linetypes" & "About Text in Custom Linetypes"; MicroStation Line
Style Editor (Stroke Pattern Attributes — caps/corners/width; Point Symbols; compound); Illustrator
Pattern Brush (5 tiles) & Width Tool/stroke profiles; W3C SVG Strokes spec; Revit Line Patterns
(paper-based mm); Figma custom dash/gap.

## 4. Current state (δικό μας — code = source of truth)

- **Data model** (`config/linetype-iso-catalog.ts`): `LinetypeDef = { id?, name, description, pattern:
  number[], origin, sourceFile? }`. Το `pattern` = mm array, **+dash / −gap / 0=dot**, `[]` = solid.
- **SSoT registry** (`stores/LinetypeRegistry.ts`): ISO baseline + user-created + localStorage
  persistence + `useSyncExternalStore` micro-leaf (ADR-040). Mutations: `registerUserLinetype` /
  `upsertUserLinetype` (COW inline edit, ADR-510 Φ2E #4).
- **Editor** (`ui/panels/dimensions/LinePatternSegmentsEditor.tsx` + `config/line-pattern-segments.ts`):
  segment list `{ kind: 'dash'|'gap'|'dot', lengthMm }` ⇄ mm pattern. Shared από dialog + inline tab.
- **Render**: `resolveLinetypePatternMm` → `dashMmToScreenPx` → **native `ctx.setLineDash()`**
  (Canvas 2D). Autoscale: `rendering/linetype-autoscale.ts` + `LinetypeScaleStore`.
- **DXF I/O**: round-trips `pattern` mm arrays μέσω `LTYPE` table (`export/core/dxf-ascii-tables-writer.ts`).

**Συμπέρασμα:** καλύπτουμε **#1, #10 (μερικώς μέσω autoscale), #11 (μερικώς)**. Λείπουν **#2–#9** και
το «continuous generation». Ο περιορισμός-ρίζα: το `ctx.setLineDash()` αποδίδει **μόνο** dash/gap.

## 5. Gap analysis — γιατί δεν αρκεί επέκταση του υπάρχοντος

- Κείμενο/σύμβολα/ρόλοι-γωνίας/μεταβλητό-πλάτος **δεν εκφράζονται** ως `number[]` ούτε αποδίδονται από
  `setLineDash`. Χρειάζεται (α) **πλουσιότερο μοντέλο** και (β) **δικός μας stroker**.
- Το DXF complex-linetype format έχει **ήδη** τη σημασιολογία (embedded `[TEXT,...]` / `[SHAPE,...]`),
  άρα το μοντέλο μας πρέπει να το αντικατοπτρίζει για σωστό import/export (interop με AutoCAD).

## 6. Decision — ενοποιημένο enterprise μοντέλο

### 6.1 Data model (νέο· superset του σημερινού)

```ts
// config/complex-linetype-types.ts  (types file — no 500-line limit)

/** Πώς κλιμακώνεται το μοτίβο. #11 */
export type LinetypeScaleSpace = 'model' | 'paper';

/** Άκρο dash. #5 */
export type DashCap = 'butt' | 'round' | 'square';

/** Ένωση τμημάτων polyline. #6 */
export type StrokeJoin = 'miter' | 'round' | 'bevel';

/** Πού «κάθεται» ένα σύμβολο κατά μήκος/στα άκρα. #4 (Illustrator 5-tile) */
export type SymbolRole = 'side' | 'innerCorner' | 'outerCorner' | 'start' | 'end';

/** Τι κάνει το μοτίβο στη γωνία. #7 (MicroStation Break/Bypass) */
export type CornerPolicy = 'break' | 'bypass' | 'alignDash';

export interface DashElement {
  readonly kind: 'dash';
  readonly lengthMm: number;
  readonly cap?: DashCap;              // default 'butt'
  readonly widthMm?: number;          // #8 — override του γενικού πλάτους
  readonly widthProfile?: readonly number[]; // #8 — normalized taper samples 0..1
}
export interface GapElement { readonly kind: 'gap'; readonly lengthMm: number; }
export interface DotElement { readonly kind: 'dot'; readonly cap?: DashCap; }

export interface TextElement {                    // #2
  readonly kind: 'text';
  readonly value: string;                         // π.χ. 'GAS', 'ΔΕΗ', 'W'
  readonly styleId: string;                       // text style (SSoT)
  readonly scale: number;                         // S=
  readonly rotationDeg: number;                   // R=
  readonly offsetXMm: number;                     // X=
  readonly offsetYMm: number;                     // Y=
  readonly followPath: boolean;                   // R relative-to-line vs absolute
}
export interface SymbolElement {                  // #3, #4
  readonly kind: 'symbol';
  readonly glyphId: string;                       // ref στη Symbol Library (§6.3)
  readonly role: SymbolRole;                      // default 'side'
  readonly scale: number;
  readonly rotationDeg: number;
  readonly offsetXMm: number;
  readonly offsetYMm: number;
}

export type PatternElement =
  | DashElement | GapElement | DotElement | TextElement | SymbolElement;

/** Ένα «στρώμα» (single stroke) — compound = πολλά. #9 */
export interface StrokeLayer {
  readonly elements: readonly PatternElement[];
  readonly offsetMm?: number;         // κάθετη μετατόπιση (compound)
  readonly widthMm?: number;          // βασικό πλάτος στρώματος
}

/** Το πλήρες complex-linetype — superset του LinetypeDef. */
export interface ComplexLinetypeDef {
  readonly id?: string;
  readonly name: string;
  readonly description: string;
  readonly layers: readonly StrokeLayer[];   // ≥1· single-layer = ο κοινός τύπος
  readonly join?: StrokeJoin;                // #6
  readonly miterLimit?: number;
  readonly cornerPolicy?: CornerPolicy;      // #7
  readonly scaleSpace?: LinetypeScaleSpace;  // #11
  readonly continuous?: boolean;             // LTGEN κατά μήκος polyline
  readonly phaseMm?: number;                 // #10
  readonly origin: LinetypeOrigin;
  readonly sourceFile?: string;
}
```

### 6.2 Backward compatibility (κρίσιμο — καμία απώλεια)

- Ο σημερινός `LinetypeDef.pattern: number[]` **μένει** ως-έχει στα ISO baseline & persisted customs.
- Προσθέτουμε **pure adapter** `patternToComplex(def): ComplexLinetypeDef` (single layer, elements
  παραγόμενα από το `number[]`) και `complexToPattern(def): number[] | null` (null αν έχει text/symbol/
  compound → δεν εκφράζεται ως simple). Ο renderer/DXF-writer επιλέγει μονοπάτι με βάση το αν είναι
  «simple-expressible».
- **Persistence**: επεκτείνουμε το persisted shape με προαιρετικό `complex?: ComplexLinetypeDef`
  (το `pattern` παραμένει για simple· hydrate ανιχνεύει ποιο υπάρχει). Zero migration για παλιά data.

### 6.3 Symbol Library (SSoT για #3/#4)

> **Φ3-A υλοποίηση (code = source of truth, 2026-07-12) — ΑΝΑΘΕΩΡΗΣΗ του αρχικού σχεδίου:** το SSoT
> audit βρήκε ότι υπάρχει **ήδη** enterprise vector-glyph υποδομή (ADR-583 `annotation-symbol-catalog`)
> με πλήρες `AnnotationSymbolPrimitive` vocabulary (`line·polyline·circle·arc·text·svg`) + uniform stamp
> loop. Άρα **δεν** φτιάξαμε `SymbolGlyph{ path: Path2D }` (Path2D σπάει σε node tests, δεν είναι το
> καθιερωμένο μοτίβο· οι Illustrator/MicroStation κρατούν vector primitives, όχι rasterized paths).

- **`config/linetype-symbol-catalog.ts`** (ΝΕΟ, static — mirror `linetype-iso-catalog`/`annotation-symbol-catalog`):
  `LinetypeSymbolDefinition = { id, labelKey, geometry: AnnotationSymbolPrimitive[], origin }`. Builtin seed
  = οι 9 τοπογραφικά/utility glyphs που ζήτησε ο Giorgio — `×` `+` `∗` `○` `□` tick, βέλος (γεμάτη κεφαλή),
  μόνωση (γωνιώδες zigzag), δέντρο (τόξο-scallop) — **ως unit-space vector primitives** (1.0=ύψος, +Y=πάνω,
  [0,0]=κέντρο), όχι font/Path2D. `getLinetypeSymbol(id)` fallback → `cross`.
- **`rendering/entities/shared/symbol-primitive-stamp.ts`** (ΝΕΟ, pure SSoT): `stampSymbolPrimitive(ctx,
  prim, { toScreen, radiusScale, rot })` — extracted **VERBATIM** από το `AnnotationSymbolRenderer.stampPrimitive`
  (Boy-Scout N.0.2· ΕΝΑ painter για annotation symbols ΚΑΙ linetype symbols· ο renderer πλέον delegate-άρει).
- **Mutable registry** (user-authored glyphs) + **`.shx` shape import** = μεταγενέστερη φάση (§9.1, out of
  scope τώρα) — ακριβώς όπως ο `LinetypeRegistry` layer-άρει ISO-baseline-then-runtime. Το static builtin
  seed αρκεί για enterprise UX. **Follow-up**: registration του νέου stamper/catalog στο `.ssot-registry.json`
  (§8) — αναβλήθηκε ώστε να μη γίνει risky baseline regen μέσα στη συνεδρία.

### 6.4 Render engine (custom stroker)

- Νέο **`rendering/linetype/ComplexLineStroker.ts`**: δέχεται polyline (world→screen points) +
  `ComplexLinetypeDef` και κάνει **arc-length walk**:
  1. Υπολογίζει συνολικό μήκος & cumulative offsets (με `phaseMm`, `continuous`).
  2. Για κάθε element «καταναλώνει» μήκος: dash → sub-path με `cap`/`width`/`widthProfile`· text →
     **(Φ2 IMPLEMENTED)** zero-length slot (AutoCAD-faithful — τα γύρω gaps δίνουν χώρο) →
     `complex-text-draw.drawTextElement` με tangent-angle rotation (αν `followPath`) + X/Y offset +
     `scale`, μέσω του `paintTextRun`/`resolveEntityFont` SSoT (glyph-path ή CSS fallback)· symbol →
     **(Φ3-A IMPLEMENTED)** zero-length slot (mirror text)· `drawSymbolElement` resolve-άρει το glyph από
     το `linetype-symbol-catalog` και stamp-άρει τα unit-space primitives μέσω του κοινού
     `stampSymbolPrimitive` (X κατά tangent, Y κατά left normal, `scale`, R σχετικό-με-tangent + user R·
     ΟΧΙ upright-flip — τα βέλη ακολουθούν τη φορά)· gap → skip.
  3. **Corner policy** στις κορυφές (Break/Bypass/**alignDash — Φ4 IMPLEMENTED**) + `join`. Το
     `alignDash` κάνει per-segment walk (σαν `break`) αλλά με phase = `firstDashOffsetPx(cycle)` ώστε
     ένα **dash** (όχι κενό) να ξεκινά σε κάθε κορυφή (MicroStation "align dashes to corners"). Επιπλέον
     **corner-role symbols (Φ4 IMPLEMENTED)**: `stampCornerSymbols` τοποθετεί `innerCorner`/`outerCorner`
     glyphs στις εσωτερικές κορυφές (ταξινόμηση με το πρόσημο του `turn` cross-product μέσω
     `polylineVertices`) και `start`/`end` glyphs στα άκρα — ΟΡΘΟΓΩΝΙΟ πέρασμα στον walk (τα `side`
     μένουν στον arc-length κύκλο· τα non-`side` βγαίνουν από το `buildCycle`).
  4. Compound: επαναλαμβάνει ανά `StrokeLayer` με `offsetMm` (parallel offset του path).
- **Fast path αμετάβλητο**: αν ο τύπος είναι *simple-expressible* (`complexToPattern !== null` **και**
  single-layer **και** χωρίς caps/width/text/symbol), συνεχίζουμε με native `ctx.setLineDash()` — μηδέν
  performance regression για τους 99% κοινούς τύπους. Ο stroker τρέχει **μόνο** για complex τύπους.
- **ADR-040 συμμόρφωση**: το complex stroking μπαίνει στο ίδιο bitmap-cache path με τους entity
  renderers. Το cache key **δεν** αλλάζει με hover/selection (κανόνας ADR-040 #3). Ο stroker είναι
  pure (points+def→draw) → cacheable.

### 6.5 Editor UI (Revit/Figma-level)

- Επέκταση του `LinePatternSegmentsEditor`: πέρα από dash/gap/dot rows, νέοι τύποι row **Text** &
  **Symbol** (με scale/rotation/offset inputs + symbol picker από το `LinetypeSymbolRegistry`).
- Νέο section «Γεωμετρία γραμμής»: caps, join, corner policy, width, scale-space (model/paper),
  continuous — ακριβώς όπως το MicroStation Line Style Editor, με **live SVG preview** (επεκτείνουμε
  το υπάρχον `PatternPreview` ώστε να δείχνει και text/symbols, όχι μόνο `strokeDasharray`).
- **i18n**: όλες οι ετικέτες μέσω `t()` (N.11) — προστίθενται keys σε `el/*.json` + `en/*.json` **πριν**
  τον κώδικα. Καμία hardcoded συμβολοσειρά.

### 6.6 DXF/`.lin` interop

- **Import**: επέκταση `utils/dxf-entity-parser.ts` / `LTYPE` reader ώστε να διαβάζει τα embedded
  `[TEXT,...]` / `[SHAPE,...]` descriptors → `TextElement` / `SymbolElement`.
- **Export**: `dxf-ascii-tables-writer.ts` γράφει complex descriptors όταν ο τύπος δεν είναι
  simple-expressible. Simple τύποι → αμετάβλητο υπάρχον μονοπάτι.
- Interop caveat: shapes χρειάζονται `.shx` reference στο DXF — για builtin symbols εξάγουμε ισοδύναμο
  ή graceful-degrade σε simple (documented).
- **STYLE handle (Φ2-B μέρος 2 — IMPLEMENTED)**: ο client ASCII writer είναι handle-less· το embedded
  text `340` reference παράγεται με **deterministic synthetic handle ανά styleId**
  (`buildEmbeddedTextStyleHandles`, base `0xA0` — distinct από το MLINESTYLE `0x2A`), μιμούμενο το SSoT
  precedent `export/core/dxf-ascii-mline-writer.ts`. **Import**: `buildStyleHandleFontMap(dxfContent)`
  (STYLE reader, group 5 → font family) resolve-άρει το `340` → `styleId`· unresolved → `Standard` fallback.

### 6.6.2 DXF embedded-text I/O (Φ2-B μέρος 2 — IMPLEMENTED)

- **Reader** `utils/dxf-linetype-table-parser.ts` — `parseLinetypeTable(lines, styleHandleToFont?)`: μετά
  από ένα `49` slot, ένα `74` με bit `0x2` (text) διαβάζει `340`/`46`/`50`/`44`/`45`/`9` → `TextElement`
  (styleId = `styleHandleToFont[340]` ή `Standard`· `followPath = !(74 & 0x1)`)· η ordered element list
  γίνεται το `complex` def του `LinetypeDef` (`pattern` = geometry-only fallback). Shapes (bit `0x4`) = Φ3 skip.
  Wired στο `dxf-scene-builder.ts` (`buildStyleHandleFontMap(content)` πριν το LTYPE pre-pass) → εισαγόμενο
  AutoCAD `──GAS──` φορτώνει `complex` και ζωγραφίζεται με το κείμενο (μέσω §6.6.1 routing).
- **Writer** `utils/dxf-layer-table-writer.ts` — `emitLtypeTable`: όταν `lt.complex && !isSimpleExpressible`
  εκπέμπει τα ordered elements (`49` geometry + `49 0.0`/`74`/`75`/`340`/`46`/`50`/`44`/`45`/`9` text block)·
  synthetic handle ανά styleId (`buildEmbeddedTextStyleHandles`, PURE → ο reader το reconstruct-άρει στο
  round-trip test). Simple τύποι → αμετάβλητο `49` emission. Production export = ezdxf (Python), αμετάβλητο.

### 6.6.1 Full-canvas routing seam (Φ2-B μέρος 1 — IMPLEMENTED)

- **SSoT seam**: `rendering/entities/shared/complex-line-routing.ts` — `strokeStyledEntityPolyline(ctx,
  screenPoints, entity, scale, closed)`: επιστρέφει `true` (και ζωγραφίζει μέσω `strokeStyledPolyline`)
  όταν το entity έχει **genuine** `complex` (`!isSimpleExpressible`)· αλλιώς `false` → ο caller κάνει το
  native `ctx.stroke()` (μηδέν regression για solid/dash). Arc/circle → `sampleArcScreen`/`sampleCircleScreen`
  (screen-space tessellation· το κείμενο ακολουθεί την καμπύλη).
- **Threading**: `ResolvedRenderStyle.complex?` (`dxf-renderer-style-resolve.ts`, fallback ΚΑΙ layer path)
  → `buildEntityModelFromDxf` (spread όπως το `dashMm`) → οι 4 entity renderers.
- **Exclusions (correctness)**: το complex εξαιρείται από το solid **LINE batch** (`DxfRenderer.ts`) ΚΑΙ
  από την **GPU line ownership** (`is-webgl-owned-line.ts`) — και τα δύο δεν έχουν text capability· πέφτει
  στο per-entity path όπου ζωγραφίζεται με το κείμενο.
- **ADR-040**: το seam είναι pure (points+def→draw), δεν διαβάζει hover/selection → cacheable στο
  normal-state bitmap· το `complex` προέρχεται από `LinetypeRegistry` (τα edits ήδη invalidate-άρουν το
  bitmap μέσω `useDxfCanvasCacheInvalidation`). CHECK 6B/6D: co-staged με ADR-040 changelog.

### 6.6.3 DXF embedded-symbol I/O (Φ3-B — IMPLEMENTED)

**Απόφαση (Giorgio 2026-07-12):** «όπως οι μεγάλοι, full enterprise» → **3-tier resolution**, ώστε
δικά μας αρχεία = lossless, ξένα κοινά αρχεία = όσο γίνεται ίδιο, άγνωστα = ασφαλές degrade. Το DXF
complex linetype κρατά ένα σύμβολο ως `[shape#, file.shx]` (group `74` bit `0x4` + `75`)· η γεωμετρία
ζει στο εξωτερικό `.shx` binary (**out of scope §9.1**), όχι στο DXF. Άρα εφαρμόζουμε το enterprise
μοτίβο (Revit/ArchiCAD): **graceful-degrade σε valid geometry + preserve το proprietary σε XDATA**.

- **Writer** `utils/dxf-layer-table-writer.ts` — `emitComplexLtype`: το symbol element πλέον εκπέμπεται
  (δεν φιλτράρεται) ως **universal-valid zero-length slot** `49 0.0` (ΟΧΙ `74 4`/`75`/`340` → κανένα
  dangling `.shx` reference που θα χαλούσε άλλους readers)· ΝΕΟ `emitSymbolXData` προσθέτει ένα
  `1001 NESTOR_APP_LTYPE` block ανά record με per-symbol descriptor (`slot`/`glyph`/`role`/`scale`/
  `rot`/`offx`/`offy`, flat `key=value` `1000` strings — το LAYER XDATA idiom). Νέα σταθερά SSoT
  `LINETYPE_SYMBOL_XDATA_APP = 'NESTOR_APP_LTYPE'` (dedicated namespace· ποτέ σύγκρουση με `ACAD`).
- **APPID** `export/core/dxf-ascii-tables-writer.ts` — `NESTOR_APP_LTYPE` προστέθηκε στο
  `EXPORT_APPID_NAMES` (import της σταθεράς SSoT· strict-reader validity — κάθε `1001 <app>` χρειάζεται
  APPID record).
- **Reader** `utils/dxf-linetype-table-parser.ts` — streaming XDATA accumulation (mirror του LAYER
  parser: `xdataApp`/`xdataBuf`)· `74 & 0x4` → `foreignShapeSlots`· `finalizeSymbols(draft)` στο flush:
  - **Tier 1** — `NESTOR_APP_LTYPE` XDATA → `SymbolElement` στο `slot` (δικά μας αρχεία → lossless).
  - **Tier 2** — foreign shape χωρίς XDATA + **γνωστό standard όνομα** (`config/linetype-shape-import-map.ts`:
    `FENCELINE1→circle`, `FENCELINE2→square`, `BATTING→insulation`, `ZIGZAG→insulation`, `TRACKS→tick`)
    → mapped builtin glyph. Χαρτογράφηση **με το όνομα** (δημόσιο/σταθερό `acad.lin`), **ΟΧΙ** με shape#
    (θα ήταν εφεύρεση → λάθος glyph). Extension point: μελλοντικός `.shx` parser layer-άρει από κάτω, μηδέν rework.
  - **Tier 3** — άγνωστο foreign shape → **graceful skip** (μένει zero-length dot, τα dashes ακέραια·
    documented, ποτέ λάθος γεωμετρία).
- **Wiring**: κανένα νέο — το XDATA είναι στο ίδιο `lines` stream που ήδη περνά στο `parseLinetypeTable`
  (`dxf-scene-builder.ts`, Φ2-B). Production export = **ezdxf (Python), αμετάβλητο**· ο TS writer καλύπτει
  το in-app round-trip.

### 6.6.4 DXF compound I/O (Φ5-B — IMPLEMENTED)

**Απόφαση (Giorgio 2026-07-12):** ίδιο enterprise μοτίβο με Φ3-B — **graceful-degrade + Nestor XDATA
lossless**. Ένας compound τύπος (road/railway, #9) έχει N παράλληλα `StrokeLayer` με διαφορετικό
`offsetMm`· το DXF LTYPE record εκφράζει **μόνο μία** ακολουθία `49`. Άρα: το **base layer** (`layers[0]`)
ζει στα `49`/text/symbol slots (ό,τι βλέπει ξένος reader → degrade σε **μία** γραμμή, ποτέ σπασμένο
record)· τα υπόλοιπα layers + όλα τα per-layer offsets διατηρούνται lossless σε XDATA.

- **Writer** `utils/dxf-layer-table-writer.ts` — `emitComplexLtype` καλεί ΝΕΟ `emitCompoundXData(out, complex)`
  μετά το `emitSymbolXData`. Εκπέμπει ένα `1001 NESTOR_APP_LTYPE` block: `clayer=<idx>` ανοίγει layer,
  `coff`/`cw` το offset/width του, και κάθε `cel.kind=<dash|gap|dot|symbol|text>` ανοίγει ένα element με
  τα δικά του πεδία (`cel.len` ή `cel.glyph`/`cel.role`/`cel.scale`/`cel.rot`/`cel.offx`/`cel.offy` /
  `cel.val`/`cel.style`/`cel.follow`). Το **base layer** εκπέμπει block **μόνο** αν έχει offset/width ≠ 0
  (τα elements του είναι ήδη στα `49`)· non-compound single-layer → **no-op** (μηδέν regression Φ2/Φ3).
  Flat per-field `1000` (idiom Φ3-B): 255-char safe, escape-free — text value με `=`/`;` επιβιώνει (δικό του
  `1000`). **Disjoint key namespace** (`clayer`/`coff`/`cw`/`cel.*`) από τα symbol keys (`slot`/`glyph`/…)
  → record με ΚΑΙ base symbols ΚΑΙ compound layers δεν διασταυρώνεται.
- **Reader** `utils/dxf-linetype-table-parser.ts` — `finalizeCompound(draft)` στο flush (μετά το
  `finalizeSymbols`): `parseCompoundXData` ξαναχτίζει το base offset/width (index 0) + τα `layers[1..]`
  (offset/width + elements). `buildComplexIfEmbedded` προάγει σε `complex` **και** όταν δεν υπάρχει
  embedded text/symbol (καθαρά γεωμετρικός compound = διπλή γραμμή → και πάλι πολυστρωματικός).
- **SSoT (anti-duplication N.18)**: κοινός iterator `forEachNestorXData` (streaming `1001/1000` XDATA
  extraction — ΕΝΑ SSoT για symbol + compound decoders)· κοινό `buildSymbolElement` (symbol-slot + compound)·
  κοινό `emitCompoundPlacement` (S/R/X/Y symbol + text). Ίδιο `LINETYPE_SYMBOL_XDATA_APP` (κανένα νέο APPID).
- **Wiring / production**: κανένα νέο· production export = **ezdxf, αμετάβλητο**· ο TS writer = in-app round-trip.

## 7. Phased roadmap

| Φάση | Περιεχόμενο | Μηχανισμοί | Ρίσκο |
|---|---|---|---|
| **Φ1** ✅ | Μοντέλο (`ComplexLinetypeDef`) + adapters + registry superset + **stroke geometry** (caps/join/corner/width/phase/scale-space) στον stroker· fast-path guard | #5 #6 #7 #8 #10 #11 | Μεσαίο (render path) — **DONE** |
| **Φ2-A** ✅ | **Embedded text** (#2): model bridge → stroker render → editor Text row → live preview | #2 | Μεσαίο — **DONE** |
| **Φ2-B μέρος 1** ✅ | **Full-canvas entity routing**: LINE/POLYLINE/ARC/CIRCLE → `strokeStyledPolyline` όταν `complex` (κοινό `strokeStyledEntityPolyline` seam) | #2 | Μεσαίο — **DONE** |
| **Φ2-B μέρος 2** ✅ | **DXF `[TEXT,...]` import/export** (LTYPE embedded text reader/writer + STYLE synthetic handle· `.lin` δεν υπάρχει στο repo) | #2 | Μεσαίο — **DONE** |
| **Φ3-A** ✅ | **Symbol Library** (§6.3, builtin seed ως `AnnotationSymbolPrimitive[]`) + **shared `stampSymbolPrimitive`** + **symbol elements** στον stroker + Symbol row editor (ρόλος `side`) | #3 | Μεσαίο — **DONE** |
| **Φ3-B** ✅ | **DXF symbol I/O**: 3-tier — Nestor XDATA (lossless) / well-known `acad.lin` name→glyph / graceful-skip· universal-valid `49 0.0` degrade (mirror Φ2-B· `.shx` = out of scope §9.1) | #3 | Μεσαίο — **DONE** |
| **Φ4** ✅ | **Corner-role symbols** (inner/outer corner + start/end) + align-dash corner policy (υπόλοιπο #4/#7) | #4β #7 | Υψηλό (corner math) — **DONE** |
| **Φ5-A** ✅ | **Compound layers** (#9) — multi-layer model/bridge + presets (δρόμος/σιδηρόδρομος) + editor multi-layer UI + compound preview (render + `offsetPolyline` ήδη Φ1) | #9 | Υψηλό — **DONE** |
| **Φ5-B** ✅ | **DXF compound I/O** — full-enterprise graceful-degrade (base layer geometry) + Nestor XDATA lossless για τα υπόλοιπα layers + base offset (mirror Φ3-B· §6.6.4) | #9 | Μεσαίο — **DONE** |
| — | *Εκτός scope προς το παρόν:* Art-brush stretch, raster line styles, `.shx` shape import | — | — |

Κάθε φάση: αυτόνομα shippable, με tests (jest — όχι tsc, N.17), και ADR changelog update (N.0.1 Phase 3).

## 8. SSoT & architecture impact

- **Registry**: `LinetypeRegistry` γίνεται superset-aware (κρατά `pattern` **ή** `complex`). Νέο
  `LinetypeSymbolRegistry` προστίθεται στο `.ssot-registry.json` (Tier κατάλληλο) όταν υλοποιηθεί Φ3.
- **Render SSoT**: ο `ComplexLineStroker` είναι ο **μοναδικός** τόπος complex stroking — entity
  renderers, dim strokes, BIM strokes τον καλούν (όχι re-implementation). Boy-Scout: ενοποίηση των
  σημερινών `setLineDash` call-sites πίσω από ένα `strokeStyledPolyline()` seam.
- **Anti-duplication (N.18)**: πριν «done» σε κάθε φάση → `npm run jscpd:diff` στα staged αρχεία (ο
  stroker & τα adapters είναι υψηλού κινδύνου για sibling clones του dash math).

## 9. Open questions — αποφάσεις Giorgio (2026-07-12)

1. **Scope**: ✅ **Κόβουμε** Art-brush stretch, Raster line styles, `.shx` shape import (χαμηλή αξία/υψηλό
   κόστος). Ανοίγουν ως μελλοντική φάση μόνο αν προκύψει interop-ανάγκη (π.χ. πελάτης στέλνει `.shx`).
2. **#11 scale-space default**: ✅ **`model`** (AutoCAD-faithful + ίδια σημερινή συμπεριφορά → μηδέν
   regression). Το **`paper`** (Revit-mode) υλοποιείται ΚΑΙ αυτό, ανά τύπο, ως opt-in — «full enterprise»
   που καλύπτει όλους τους μεγάλους παίκτες χωρίς να χαλάει κανέναν (Giorgio: «όπως το κάνουν οι μεγάλοι»).
3. **Symbol seed**: ✅ (2026-07-12, έναρξη Φ3) — οι **9 τοπογραφικά/utility glyphs**: `×` `+` `∗` `○` `□` tick,
   βέλος, μόνωση, δέντρο. **DXF export**: ✅ full-enterprise «όπως οι μεγάλοι» → **graceful-degrade valid
   geometry + Nestor XDATA** (Revit/ArchiCAD lossless-in-ecosystem· = Φ3-B, ξεχωριστή συνεδρία).
4. **Προτεραιότητα φάσεων**: ✅ **Φ1 πρώτα** (geometry θεμέλιο· το text της Φ2 πατά πάνω του).

## 10. Changelog

- **2026-07-13 (Φ5 fix — inline Properties tab compound-aware preview + anti-flatten)** — Ο Giorgio
  παρατήρησε ότι η **«Προεπισκόπηση»** στο αριστερό Properties tab έβγαινε λάθος για compound (`_TEST1`):
  έδειχνε μία απλή γραμμή αντί για ράγες+ties. Root cause (`ui/line-advanced-panel/LinePropertiesTab.tsx`):
  ο inline tab παρήγαγε segments **μόνο** από το base `pattern` (`resolveLinetypeDef(name)?.pattern`),
  αγνοώντας το `complex`. Χειρότερο: μια επεξεργασία εκεί έκανε `upsertUserLinetype` με single-layer
  pattern → **ισοπέδωνε** τον compound (data loss ραγών/ties). Fix: όταν `linetypeDef.complex` υπάρχει &
  **δεν** είναι `isSimpleExpressible` (compound/text/symbol), ο tab δείχνει τον ακριβή
  `CompoundPatternPreview` (ίδιος `strokeStyledPolyline` SSoT) + hint «επεξεργασία από τον διάλογο», και
  **αποκρύπτει** τον single-layer segment editor (καμία flatten-edit). Simple τύποι = αμετάβλητοι.
  - `LinePropertiesTab.tsx` — resolve full def μία φορά· `compoundLayers` memo (`complexToLayers` όταν rich)·
    branch preview/editor. i18n `inlineTab.compoundHint` (el+en, N.11). jscpd καθαρό.
- **2026-07-13 (Φ5-A UX follow-up — «Κεντράρισμα» tie layer)** — Ο Giorgio ανέφερε ότι σε
  χειροκίνητα authored railway οι κάθετες ties έβγαιναν **έκκεντρες**: το tie layer ήταν σε offset 0 ενώ
  οι δύο ράγες **δεν** ήταν συμμετρικές γύρω από το 0 (π.χ. ράγες 0 και +1.5 → μέσο +0.75, όχι 0). Δεν
  ήταν bug render/IO (το tick glyph `line(0,±0.5)` + το `offsetPolyline` είναι συμμετρικά· το I/O διατηρεί
  πιστά ό,τι αυθεντικοποιήθηκε) — ήταν authoring gap. Λύση: explicit per-layer **«Κεντράρισμα»** κουμπί
  (όχι magic auto-mutation → reversible, Google-level).
  - `config/line-pattern-segments.ts` — ΝΕΟ pure `centerOffsetForLayer(layers, index)` = midpoint των
    min/max offsets των **άλλων** layers (geometric centre του compound span· lone layer → κρατά το offset του).
  - `ui/panels/dimensions/LinePatternLayersEditor.tsx` — κουμπί `AlignVerticalJustifyCenter` ανά `LayerCard`
    (δίπλα στο offset field· disabled όταν <2 layers)· `centerLayer` στο label bag + `buildLinePatternLayersLabels`.
  - i18n: `linePatternEditor.compound.centerLayer` (el+en, N.11 keys-first).
  - Tests (jest, N.17): +4 στο `line-pattern-segments-compound.test.ts` — symmetric ±0.75→0, asymmetric
    0/+1.5→0.75, self-excluded, lone-layer. 16/16 πράσινα. jscpd (N.18): καθαρό (0 new clones / 3 files).
- **2026-07-13 (Φ5-B IMPLEMENTED — DXF compound I/O: graceful-degrade + Nestor XDATA lossless)** —
  Ολοκλήρωση της Φ5 (Q2 = DXF full-enterprise «όπως οι μεγάλοι»). Λύνει το τεκμηριωμένο gap της Φ5-A (ο
  in-app TS writer εξέπεμπε ΜΟΝΟ base layer). Encoding: flat per-field `1000` (idiom Φ3-B· §9-Q εγκρίθηκε
  στο handoff). §6.6.4.
  - `utils/dxf-layer-table-writer.ts` — ΝΕΟ `emitCompoundXData` (per-layer `clayer`/`coff`/`cw` + `cel.*`
    elements για `layers[1..]`· base layer block μόνο για offset/width ≠ 0) + `emitCompoundElement` +
    κοινό `emitCompoundPlacement` (S/R/X/Y symbol+text)· κλήση στο `emitComplexLtype` μετά το `emitSymbolXData`.
    Non-compound → no-op (μηδέν regression Φ2/Φ3).
  - `utils/dxf-linetype-table-parser.ts` — ΝΕΟ `finalizeCompound` (flush, μετά `finalizeSymbols`) +
    `parseCompoundXData` (`clayer`/`cel.kind` state machine → base offset/width + `StrokeLayer[]`) +
    `fillCompoundElement`/`buildCompoundElement`· `buildComplexIfEmbedded` προάγει σε `complex` και σε
    καθαρά γεωμετρικό compound (base offset/width ή extra layers)· νέα draft fields
    (`baseLayerOffsetMm`/`baseLayerWidthMm`/`compoundExtraLayers`).
  - **Anti-duplication (N.18)**: extraction 3 SSoT helpers για να μηδενιστούν sibling clones που έπιασε το
    `jscpd:diff` — `forEachNestorXData` (κοινό streaming XDATA iterator: symbol+compound), `buildSymbolElement`
    (κοινό symbol build: `slot=` + `cel.kind=symbol`), `emitCompoundPlacement` (κοινά S/R/X/Y).
  - **Disjoint key namespace** (`clayer`/`coff`/`cw`/`cel.*` vs `slot`/`glyph`/…) → record με base symbols +
    compound layers parse-άρει καθαρά και με τους δύο decoders (test-covered).
  - **Base-layer offset ≠ 0** (road = 2 rails ±0.5 χωρίς centre) διατηρείται μέσω `clayer=0`/`coff` XDATA.
  - Tests (jest, N.17): +12 — `__tests__/dxf-linetype-compound-roundtrip.test.ts` (road base-offset round-trip,
    graceful degrade σε single stroke, railway 3-layer + tie symbol, sub-layer symbol S/R/X/Y fidelity,
    base-symbol+extra-layer coexistence, sub-layer text με `=`/`;`, simple type ανέγγιχτο, όλα τα presets).
    19/19 πράσινα με το υπάρχον Φ3-B symbol suite (μηδέν regression). jscpd (N.18): καθαρό (0 new clones / 3 files).
  - **ADR-040 (CHECK 6B/6D)**: DXF I/O only — κανένα canvas/render touch (mirror Φ3-B) → εκτός scope ADR-040.
- **2026-07-12 (Φ5-A IMPLEMENTED — compound layers: model + presets + multi-layer editor + render)** —
  Scope Φ5 (2026-07-12, Giorgio): Q1 = **free-form + presets**· Q2 = **DXF full-enterprise «όπως οι μεγάλοι»
  (Revit/ArchiCAD/Maxon/Figma)** → split σε **Φ5-A** (τώρα: in-app model+editor+render) + **Φ5-B** (DXF compound
  I/O = graceful-degrade base layer + Nestor XDATA lossless, mirror Φ3-B). **SSoT audit (grep-verified):** ο
  render loop (`strokeStyledPolyline` → `for layer of def.layers` + `offsetPolyline`) + `isSimpleExpressible`
  (layers>1 → complex) υπάρχουν **ΗΔΗ** από Φ1 → **μηδέν αλλαγή στον stroker**. Υλοποιήθηκαν:
  - `config/line-pattern-segments.ts` — ΝΕΟ `LinePatternLayer` (segments + `offsetMm` + `widthMm?`) +
    `singleLayer`/`defaultCompoundLayer`/`isCompound`/`layersToComplex`/`complexToLayers`/`describeLayers`/
    `validateLinePatternLayers` (reuse `segmentToElement`/`elementToSegment`)· refactor `validateLinePattern` →
    `validateName`+`validateSegmentList(requireGap)` helpers (solid sub-layers επιτρέπονται σε genuine compound).
  - `config/linetype-compound-presets.ts` (ΝΕΟ, data) — `COMPOUND_PRESETS` (`road` = 2 solid rails ±0.5mm,
    `railway` = 2 rails ±0.75mm + centre `tick` ties) + `listCompoundPresets`· κάθε preset `build()` = fresh-owned layers.
  - `ui/panels/dimensions/LinePatternLayersEditor.tsx` (ΝΕΟ) — compound editor: per-layer offset (`NumField`) +
    nested `LinePatternSegmentsEditor` (showPreview=false) + add/remove layer + preset picker + `CompoundPatternPreview`.
    Reuse του single-layer editor VERBATIM (N.18· `NumField` exported).
  - `ui/panels/dimensions/LinePatternPreviews.tsx` — ΝΕΟ κοινό `StrokePreviewCanvas` (DRY· text+compound
    previews μοιράζονται το dpr/clear boilerplate) + `CompoundPatternPreview` (full multi-layer def μέσω `layersToComplex`).
  - `ui/panels/dimensions/LinePatternEditorDialog.tsx` — state `segments`→`layers`· `validateLinePatternLayers`·
    `save()` χτίζει `complex` όταν `isCompound || hasComplexSegments` (base-layer `pattern` fallback)· `LinePatternLayersEditor`.
  - i18n: keys `linePatternEditor.compound.{layers,layer,offset,addLayer,removeLayer,presets,presetNames.{road,railway}}`
    σε `el` **και** `en` (`dxf-viewer-panels`· N.11 keys ΠΡΩΤΑ).
  - Tests (jest, N.17): +21 — compound bridge round-trip (offset/width preserve· single-layer identical)·
    `isCompound`/`describeLayers`/`singleLayer`/`defaultCompoundLayer`· validate (solid rails ok, single needs gap,
    taken name, empty sub-layer)· presets (road ±offset, railway 3 layers valid, fresh-build)· stroker compound
    render (2 offset rails). 9 suites / 94 tests πράσινα. jscpd (N.18): καθαρό (0 new clones / 6 src).
  - **ADR-040 (CHECK 6B/6D)**: ο stroker αμετάβλητος (compound render από Φ1)· ο νέος editor/preview κώδικας δεν
    αγγίζει hover/selection/cache key· μηδέν νέα `useSyncExternalStore` σε shell/orchestrator· co-staged ADR-040.
    **Γνωστό gap (ΟΧΙ silent):** ο in-app TS DXF writer εκπέμπει ΜΟΝΟ το base layer· full compound DXF = **Φ5-B**
    (production export = ezdxf, αμετάβλητο). ΟΧΙ tsc (N.17). Commit = Giorgio.
- **2026-07-12 (Φ4 IMPLEMENTED — corner-role symbols + alignDash corner policy)** — Scope Φ4 (2026-07-12,
  Giorgio): Q1 = **και τα δύο** (corner glyphs #4β + `alignDash` #7 μαζί· ίδιο touch-point στον stroker)·
  Q2 = **start/end τώρα** (τετριμμένο μόλις υπάρχει το vertex-placement). **SSoT audit (grep-verified):**
  reuse των `complex-stroke-geometry` arc-length primitives + `drawSymbolElement` (Φ3) + `emitSymbolXData`/
  `parseSymbolXData` role round-trip (ήδη generic) + `ComplexSegmentRowShell`/`PlacementFields` editor
  shell — **μηδέν νέος μηχανισμός**. Υλοποιήθηκαν:
  - `rendering/linetype/complex-stroke-geometry.ts` — ΝΕΟ pure `polylineVertices(points, closed)` →
    `PolylineVertex[]` (start/end/interior role + orientation tangent [διχοτόμος στις κορυφές] + signed
    `turn` cross-product). Merge διαδοχικών ταυτόσημων σημείων· closed → drop closing dup + όλα interior.
  - `rendering/linetype/ComplexLineStroker.ts` — `buildCycle` βγάζει τα non-`side` symbols από τον
    arc-length κύκλο· ΝΕΟ `stampCornerSymbols` (ΟΡΘΟΓΩΝΙΟ πέρασμα: `roleMatchesVertex` → inner=`turn>ε`,
    outer=`turn<−ε`, start/end στα άκρα· stamp μέσω `drawSymbolElement`)· `strokeLayer` += `alignDash`
    branch (per-segment walk με phase = ΝΕΟ `firstDashOffsetPx(cycle)` → dash σε κάθε κορυφή) + κλήση
    `stampCornerSymbols`. Corner symbols ζωγραφίζονται και στο solid-fallback (γραμμή + posts).
  - `config/line-pattern-segments.ts` — ΝΕΟ `SYMBOL_ROLES` (picker order: side/inner/outer/start/end).
    Ο υπάρχων `segmentToElement`/`elementToSegment` ήδη preserve-άρει το `role` (μηδέν αλλαγή bridge).
  - `ui/panels/dimensions/LinePatternSegmentsEditor.tsx` — **role selector** στο Symbol row (δεύτερο
    Select δίπλα στο glyph picker)· `labels.symbol.role`/`roleName` στο label bag + `buildLinePatternSegmentsLabels`.
  - i18n: keys `linePatternEditor.symbol.role` + `symbol.roles.{side,innerCorner,outerCorner,start,end}` σε
    `el` **και** `en` (`dxf-viewer-panels`· N.11 keys ΠΡΩΤΑ· shell namespace = allowSymbol false → δεν χρειάζεται).
  - Tests (jest, N.17): +18 — `polylineVertices` (start/end/interior classification, turn sign inner/outer,
    closed dedup, degenerate)· stroker corner placement (inner stamps/outer skips/start/end/immune-to-length)·
    `alignDash` vs `break` phase (first-dash-at-corner)· config corner-role round-trip· XDATA innerCorner
    round-trip. 8 suites / 81 tests πράσινα (linetype+config+utils). jscpd (N.18): καθαρό (0 new clones / 4 src).
  - **ADR-040 (CHECK 6B/6D)**: ο stroker παραμένει pure (points+def→draw)· `stampCornerSymbols`/`polylineVertices`
    δεν διαβάζουν hover/selection → cacheable, μηδέν αλλαγή cache key· καμία νέα `useSyncExternalStore`·
    co-staged ADR-040 changelog. ΟΧΙ tsc (N.17). Commit = Giorgio.
- **2026-07-12 (Φ3-B IMPLEMENTED — DXF embedded-symbol I/O: 3-tier graceful-degrade + Nestor XDATA)** —
  Scope Φ3-B (2026-07-12): Q1 appId = **`NESTOR_APP_LTYPE`** (dedicated, Revit-style· ποτέ σύγκρουση με
  `ACAD`)· Q2 ξένα shapes = **«όπως οι μεγάλοι, όσο γίνεται ίδιο»** → 3-tier (XDATA lossless / well-known
  όνομα→glyph / graceful-skip), χαρτογράφηση **με όνομα** `acad.lin` (verifiable), ΟΧΙ εφεύρεση shape#.
  **SSoT audit (grep-verified):** το `emitLayerXData` ήδη γράφει Nestor XDATA σε table record + ο
  `dxf-layer-table-parser` το διαβάζει streaming (`xdataApp`/`xdataBuf`) → **mirror** αντί για νέο parser.
  Ο production `dxf-ascii-tables-writer` delegate-άρει στο `emitLtypeTable` → ΕΝΑ writer αγγίχτηκε. Υλοποιήθηκαν:
  - `config/linetype-shape-import-map.ts` (ΝΕΟ, data) — `WELL_KNOWN_LINETYPE_SYMBOLS` (`FENCELINE1→circle`,
    `FENCELINE2→square`, `BATTING→insulation`, `ZIGZAG→insulation`, `TRACKS→tick`) +
    `resolveWellKnownLinetypeSymbol(name)` (case-insensitive· guard ότι το glyph υπάρχει στο catalog) +
    `listWellKnownLinetypeNames`. Tier 2 extension point για μελλοντικό `.shx` parser (zero rework).
  - `utils/dxf-layer-table-writer.ts` — `emitComplexLtype`: symbols πλέον εκπέμπονται ως universal-valid
    `49 0.0` slot (όχι filtered-out· κανένα `74 4`/`75`/`340` dangling `.shx` ref)· ΝΕΟ `emitSymbolXData`
    (mirror `emitLayerXData`) → `1001 NESTOR_APP_LTYPE` block ανά symbol (`slot`/`glyph`/`role`/`scale`/
    `rot`/`offx`/`offy`)· ΝΕΑ export σταθερά `LINETYPE_SYMBOL_XDATA_APP` (SSoT).
  - `utils/dxf-linetype-table-parser.ts` — streaming XDATA (`1001`→`xdataApp`, `1000/1040/1070/1071`→
    `xdataBuf`· mirror LAYER parser)· `74 & 0x4`→`foreignShapeSlots`· `finalizeSymbols(draft)` στο flush
    (Tier 1 XDATA → Tier 2 well-known name → Tier 3 skip)· `parseSymbolXData` + `normalizeSymbolRole`.
  - `export/core/dxf-ascii-tables-writer.ts` — `LINETYPE_SYMBOL_XDATA_APP` στο `EXPORT_APPID_NAMES`
    (import της SSoT σταθεράς· strict-reader APPID validity).
  - Tests (jest, N.17): +10 (`utils/__tests__/dxf-linetype-symbol-roundtrip.test.ts`) — Tier 1 round-trip
    glyph/role/scale/rot/offset· geometry-degrade `[5,0,-3]`· mixed text+symbol order· Tier 2
    `FENCELINE1→circle`/`fenceline2→square` (case-insensitive)· Tier 3 unknown→skip· simple unaffected·
    import-map unit (standards→glyph, case/trim, unknown→null, όλα τα mapped glyphs υπάρχουν). 16 πράσινα
    μαζί με το Φ2-B round-trip· 68 regression (linetype+config+layer round-trip) πράσινα. jscpd (N.18):
    καθαρό (0 new clones στα 4 staged src).
  - **ΟΧΙ render/canvas touch** (καθαρό DXF I/O → όχι ADR-040). ΟΧΙ tsc (N.17). Commit = Giorgio.
- **2026-07-12 (Φ3-A IMPLEMENTED — embedded symbols: catalog + shared stamper + render + editor)** —
  Scope Φ3 (2026-07-12): symbol seed = 9 τοπογραφικά/utility glyphs· DXF export = full-enterprise
  graceful-degrade + Nestor XDATA (= Φ3-B)· render+editor πρώτα (mirror Φ2-A/Φ2-B). **SSoT audit finding
  (code = source of truth):** υπήρχε ήδη το `AnnotationSymbolPrimitive` vocabulary + stamp loop (ADR-583)
  → **δεν** φτιάχτηκε `SymbolGlyph{Path2D}` registry (§6.3 ΑΝΑΘΕΩΡΗΘΗΚΕ). Υλοποιήθηκαν:
  - `rendering/entities/shared/symbol-primitive-stamp.ts` (ΝΕΟ, pure) — `stampSymbolPrimitive(ctx, prim,
    { toScreen, radiusScale, rot })` extracted **VERBATIM** από `AnnotationSymbolRenderer.stampPrimitive`
    (+`stampSvgGlyph`). ΕΝΑ painter για annotation ΚΑΙ linetype glyphs (N.18, Boy-Scout).
  - `rendering/entities/AnnotationSymbolRenderer.ts` — refactor: `drawGlyph` delegate-άρει στο shared
    stamper (μηδέν συμπεριφορική αλλαγή· render leaf → co-staged ADR-040/ADR-642, CHECK 6D).
  - `config/linetype-symbol-catalog.ts` (ΝΕΟ, static data) — `LinetypeSymbolDefinition` + 9 builtin glyphs
    ως unit-space `AnnotationSymbolPrimitive[]` (cross/plus/asterisk/circle/square/tick/arrow/insulation/tree)
    + `getLinetypeSymbol`/`listLinetypeSymbols` (fallback `cross`).
  - `rendering/linetype/complex-symbol-draw.ts` (ΝΕΟ) — `drawSymbolElement(ctx, el, at, mmToPx)`: mirror
    ΑΚΡΙΒΩΣ του `drawTextElement` (zero-length slot, X κατά tangent, Y κατά left normal, scale, R
    tangent-relative + user R)· virtual y-UP frame ώστε οι world-CCW/Y-flip συμβάσεις του stamper να ισχύουν.
  - `rendering/linetype/ComplexLineStroker.ts` — `symbol` branch στο `buildCycle` (zero-length) + `walkPath`
    (mirror text)· `CycleEntry` += `'symbol'`/`symbol?`. Symbols πλέον **ζωγραφίζονται** (ήταν skip Φ1/Φ2).
  - `config/line-pattern-segments.ts` — `LinePatternSymbolSegment` variant + `defaultSymbolSegment` +
    `hasSymbolSegments`/`hasComplexSegments` (= text||symbol gate)· `segmentToElement`/`elementToSegment`/
    `complexToSegments` symbol-aware (πλέον preserve, ΟΧΙ drop)· `validate`/`describeSegments`/`segmentsToDashPattern`
    symbol-aware (visible mark· skip στο mm pattern).
  - `ui/panels/dimensions/LinePatternSegmentsEditor.tsx` — **Symbol row** (glyph picker + S/R/X/Y) μέσω
    ΝΕΟΥ κοινού `ComplexSegmentRowShell` + `PlacementFields` (de-dup με το Text row, N.18)· `allowSymbol`
    prop (inline COW tab → false, όπως text)· WYSIWYG preview switch σε `hasComplexSegments`. Ο dialog
    (`LinePatternEditorDialog`) αποθηκεύει `complex` όταν `hasComplexSegments` (text **ή** symbol).
  - i18n: keys `linePatternEditor.{kinds,add}.symbol` + `linePatternEditor.symbol.*` (+ 9 `glyphs.*`) σε
    `el` **και** `en` (N.11, keys ΠΡΩΤΑ). Tests (jest, N.17): +30 (stamp per-kind· catalog seed/lookup/envelope·
    symbol-draw placement/rotation/guards· stroker symbol routing· segments symbol round-trip· ενημέρωση του
    Φ2 «drops symbol» test → «preserves symbol») — 9 suites πράσινα (72 tests linetype+config). jscpd (N.18):
    καθαρό μετά την εξαγωγή `PlacementFields`+`ComplexSegmentRowShell` (0 new clones στα 7 staged src).
  - **ADR-040 (CHECK 6D)**: ο `AnnotationSymbolRenderer` refactor = pure delegation· μηδέν νέα
    `useSyncExternalStore`/subscription· ο stamper είναι pure→cacheable, μηδέν hover/selection στο cache key·
    co-staged ADR-040 changelog. **Full-canvas routing seam (Φ2-B) ήδη έτοιμο** → τα symbol linetypes
    ζωγραφίζονται σε ΟΛΑ τα entities αυτόματα (κανένα touch στους 4 renderers). ΟΧΙ tsc (N.17). Commit = Giorgio.
- **2026-07-12 (Φ2-B μέρος 2 IMPLEMENTED — DXF `[TEXT,...]` embedded-text I/O)** — Scope Q3 (2026-07-12):
  STYLE handle = **synthetic-per-styleId** (MLINE pattern). Υλοποιήθηκαν:
  - `text-engine/parser/style-table-reader.ts` — `buildStyleHandleFontMap(dxfContent)` (νέο· `{ handle→font }`
    από το STYLE table)· `DxfStyleTableEntry.handle?` (group 5) captured. Barrel + type ενημερώθηκαν.
  - `utils/dxf-linetype-table-parser.ts` — `parseLinetypeTable(lines, styleHandleToFont?)`: ordered element
    walk· ένα `74 & 0x2` upgrade-άρει το `49 0.0` slot σε `TextElement` (styleId από `340`→font, `followPath
    = !(74 & 0x1)`, scale/rot/offset από `46/50/44/45`, value από `9`)· χτίζει `complex` def (`origin:
    'dxf-import'`). Shapes (`0x4`) = Φ3 skip.
  - `utils/dxf-scene-builder.ts` — build `buildStyleHandleFontMap(content)` πριν το LTYPE pre-pass, threaded
    στο `parseLinetypeTable` → εισαγόμενο AutoCAD complex linetype φορτώνει `complex` και ζωγραφίζεται (§6.6.1).
  - `utils/dxf-layer-table-writer.ts` — `emitLtypeTable` εκπέμπει embedded `[TEXT,...]` descriptors όταν
    `lt.complex && !isSimpleExpressible`· `buildEmbeddedTextStyleHandles` (νέο export, PURE, base `0xA0`)
    δίνει deterministic synthetic handle ανά styleId. Simple τύποι → αμετάβλητο `49` emission (zero regression).
  - Tests (jest, N.17): +6 (writer→reader round-trip value/style/scale/rot/offset/followPath· fallback
    `Standard`· simple no-complex· `buildStyleHandleFontMap` handle→font· full STYLE+LTYPE `340` resolve) —
    3 suites πράσινα (38 tests utils round-trip). jscpd (N.18): καθαρό (0 new clones στα 4 staged src).
  - Interop caveat: production DXF export = ezdxf (Python microservice), αμετάβλητο· ο TS writer καλύπτει το
    in-app round-trip. `.lin` reader δεν υπάρχει στο repo → εκτός scope. ΟΧΙ tsc (N.17). Commit = Giorgio.
- **2026-07-12 (Φ2-B μέρος 1 IMPLEMENTED — full-canvas entity routing)** — Scope Φ2-B (§9-style):
  routing πρώτα (όχι DXF), **ΟΛΑ** τα entity types μαζί μέσω ΕΝΟΣ seam, STYLE handle = synthetic-per-styleId
  (μέρος 2). Το `──GAS──` ζωγραφίζεται πλέον στον **κύριο καμβά** σε πραγματικές γραμμές, όχι μόνο στο
  editor preview. Υλοποιήθηκαν:
  - `rendering/entities/shared/complex-line-routing.ts` (ΝΕΟ) — `strokeStyledEntityPolyline` (SSoT seam:
    `complex` genuine → `strokeStyledPolyline`, αλλιώς `false` → native `ctx.stroke()`, μηδέν regression) +
    `sampleArcScreen`/`sampleCircleScreen` (screen-space tessellation για arc/circle, text-follow στην καμπύλη).
  - `canvas-v2/dxf-canvas/dxf-renderer-style-resolve.ts` — `ResolvedRenderStyle.complex?`· resolved και στο
    no-layer fallback (`resolveLinetypeDef(name)?.complex`) και στο cascade path (`resolved.linetype.complex`).
    Το OWN linetype def resolve-άρεται μία φορά (pattern + complex από ΕΝΑ lookup).
  - `canvas-v2/dxf-canvas/dxf-renderer-entity-model.ts` — `complex` spread στο EntityModel base (mirror `dashMm`).
  - `canvas-v2/dxf-canvas/DxfRenderer.ts` — το solid **LINE batch** εξαιρεί genuine complex (`continue`, χωρίς
    `batchedIds`) → πέφτει στο per-entity path· `toEntityModel` inline shape → `ResolvedRenderStyle` (DRY).
  - `canvas-v2/webgl-lines/is-webgl-owned-line.ts` — η GPU line ownership επιστρέφει `false` για genuine
    complex (ο flat `LineSegments2` δεν έχει text/symbol capability· belt-and-suspenders πάνω από το
    `dashMm.length>0` gate).
  - Οι 4 entity renderers (`LineRenderer`/`PolylineRenderer`/`ArcRenderer`/`CircleRenderer`) ρουτάρουν το
    geometry stroke μέσω του seam· arc/circle tessellate ΜΟΝΟ όταν `complex` παρών (fast path αμετάβλητος).
  - Tests (jest, N.17): +11 (seam true/false/simple-expressible/degenerate/celtscale· arc/circle samplers·
    entity-model complex passthrough) — 6 suites πράσινα (59 tests linetype+routing+entity-model). jscpd
    (N.18): καθαρό (0 new clones στα 9 staged src). **Εκκρεμεί Φ2-B μέρος 2**: DXF `[TEXT,...]` reader/writer.
  - **ADR-040 (CHECK 6B/6D)**: το seam είναι pure→cacheable, μηδέν hover/selection στο cache key, μηδέν νέα
    `useSyncExternalStore`· co-staged ADR-040 changelog. ΟΧΙ tsc (N.17). 🔴 browser-verify + commit (Giorgio).
- **2026-07-12 (Φ2-A IMPLEMENTED — embedded text: render + editor + live preview)** — Scope Φ2 (§9-style):
  Q1 = **υπάρχον text SSoT** (`styleId` = font family → `resolveEntityFont`/`paintTextRun`, το ΙΔΙΟ engine
  που ζωγραφίζει όλα τα TEXT σε 2D/3D — ADR-557/530· μηδέν δεύτερος font μηχανισμός), Q2 = `followPath`
  **toggle ανά κείμενο** (default `true`, τοπογραφικό de-facto), Q3 = **render+editor+preview πρώτα**,
  DXF I/O + full-canvas routing = Φ2-B. Υλοποιήθηκαν:
  - `rendering/linetype/complex-text-draw.ts` (ΝΕΟ) — `drawTextElement`: AutoCAD-faithful placement
    (zero-length slot· X κατά μήκος tangent, Y κατά left normal, `scale`×mmToPx, R σχετικό-με-tangent αν
    `followPath`· upright-flip σε leftward baseline). Reuse `paintTextRun`/`resolveEntityFont` (direct
    module imports — ΟΧΙ το `text-engine/fonts` barrel: αποφυγή Firebase/fetch deps στο hot path/tests).
  - `rendering/linetype/ComplexLineStroker.ts` — `buildCycle`/`walkPath` πλέον ΑΠΟΔΙΔΟΥΝ text elements
    (zero-length, σαν dot)· symbol elements ακόμη skip (Φ3). Το `mmToPx` περνά στο `walkPath`.
  - `config/line-pattern-segments.ts` — `LinePatternSegment` → discriminated union (+`text` variant)·
    νέα `segmentsToComplex`/`complexToSegments` bridge, `hasTextSegments`, `defaultTextSegment`,
    `LINETYPE_TEXT_STYLE_OPTIONS`· `validateLinePattern` (text = visible mark, `pattern.textEmpty`)·
    `segmentsToDashPattern`/`describeSegments` text-aware.
  - `ui/panels/dimensions/LinePatternSegmentsEditor.tsx` — νέα **Text row** (value + style picker +
    scale/rotation/offset + `followPath` Switch) + «Add text»· **WYSIWYG live preview** μέσω canvas
    `strokeStyledPolyline` (ο ΙΔΙΟΣ render SSoT) όταν υπάρχει text (αλλιώς το υπάρχον SVG dash preview).
    `allowText` prop (default true· ο inline `LinePropertiesTab` → `false`: geometry-only COW, το text
    authored κεντρικά στον dialog — AutoCAD/Revit convention).
  - `ui/panels/dimensions/LinePatternEditorDialog.tsx` — `save()` χτίζει `complex` όταν `hasTextSegments`
    και το περνά στο `registerUserLinetype` (το `pattern` κρατά το geometry-only fallback).
  - `stores/LinetypeRegistry.ts` — `registerUserLinetype` + persisted shape δέχονται optional `complex`
    (localStorage round-trip για authored `──GAS──`· light hydrate guard· zero migration).
  - i18n: keys `linePatternEditor.{kinds,add}.text` + `linePatternEditor.text.*` + `errors.pattern.textEmpty`
    σε `el` **και** `en` (N.11, keys ΠΡΩΤΑ). Tests (jest, N.17): +25 (text-draw placement/flip/guards·
    stroker text integration· segments bridge/validate) — 5 suites πράσινα (83 tests σύνολο linetype+config).
    jscpd (N.18): καθαρό (0 new clones στα 6 staged src). **Εκκρεμεί Φ2-B**: DXF `[TEXT,...]` reader/writer +
    routing των entity renderers μέσω `strokeStyledPolyline` (on-touch, §8).
- **2026-07-12 (Φ1 IMPLEMENTED)** — Scope §9 εγκρίθηκε (Q1: κόβουμε Art-brush/Raster/`.shx`· Q2:
  scale-space default `model` + `paper` opt-in· Q4: Φ1 πρώτα). Υλοποιήθηκε το **stroke-geometry θεμέλιο**:
  - `config/complex-linetype-types.ts` — πλήρες μοντέλο `ComplexLinetypeDef` / `PatternElement` (types-only).
  - `config/complex-linetype-adapters.ts` — pure `patternToComplex` / `complexToPattern` /
    `isSimpleExpressible` / `dashPatternToElements` / `effectiveScaleSpace` (backward-compat bridge, §6.2).
  - `rendering/linetype/complex-stroke-geometry.ts` — pure arc-length primitives (segments, cumulative
    length, `pointAt`, `sampleSubpath` με bend σε κορυφές, `offsetPolyline` για compound).
  - `rendering/linetype/complex-dash-draw.ts` — canvas primitives: `tracePolylinePath` (SSoT path trace),
    `strokeDashSubpath` (caps + width), `drawDot`, `fillTaperedDash` (variable width #8).
  - `rendering/linetype/ComplexLineStroker.ts` — `strokeStyledPolyline`: **fast-path guard** (simple →
    reuse `dashMmToScreenPx`, μηδέν regression) + **complex arc-length walk** (caps #5, join #6, corner
    break/bypass #7, width #8, phase #10, scale-space model/paper #11, compound layers #9). Text/symbol
    elements ορίζονται αλλά προσπερνώνται (Φ2/Φ3).
  - `config/linetype-iso-catalog.ts` — `LinetypeDef.complex?` προαιρετικό (registry superset, §8· type-only
    import, μηδέν runtime κύκλος, μηδέν migration).
  - Tests (jest, N.17): 33 πράσινα σε 3 suites (adapters round-trip + fast-path guard· geometry· stroker
    fast/complex/phase/break/compound/taper/degenerate-fallback). jscpd (N.18): καθαρό (0 new clones μετά
    την εξαγωγή του `tracePolylinePath`).
  - **On-touch migration (§8)**: τα 145 σημερινά `setLineDash` call-sites ΔΕΝ αγγίχτηκαν — το
    `strokeStyledPolyline()` seam υιοθετείται σταδιακά (Boy-Scout) καθώς complex τύποι εμφανίζονται (Φ2+).
- **2026-07-12 (created)** — ADR δημιουργήθηκε. Research sweep (11 μηχανισμοί), current-state ανάλυση
  (simple-only μέσω `setLineDash`), ενοποιημένο μοντέλο `ComplexLinetypeDef`, custom-stroker απόφαση,
  5-φασικό roadmap. Status: PROPOSED — αναμονή scope-approval (§9) πριν Φ1.
