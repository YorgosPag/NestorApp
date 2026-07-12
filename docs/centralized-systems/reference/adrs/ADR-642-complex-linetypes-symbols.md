# ADR-642 — Complex Linetypes: embedded text, symbols, width, caps/joins & compound strokes

- **Status:** 🔵 PROPOSED (research + design; no code yet — Φ1 pending Giorgio scope approval)
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

- Νέος **`stores/LinetypeSymbolRegistry.ts`** (mirror του `LinetypeRegistry`): κατάλογος από
  `SymbolGlyph = { id, name, kind: 'builtin'|'shx-import'|'user', path: Path2D-serializable }`.
- **Builtin seed**: τα τοπογραφικά/utility σύμβολα που ζήτησε ο Giorgio — `×`, `*`, `+`, `○`, `□`,
  tick, βέλος, batting/insulation S-curve, tree scallop. Ορισμένα ως **vector paths** (όχι font glyphs)
  ώστε να αποδίδονται με width/scale/rotation σωστά.
- `.shx` shape import = μεταγενέστερη φάση (interop). Το builtin seed αρκεί για enterprise UX.

### 6.4 Render engine (custom stroker)

- Νέο **`rendering/linetype/ComplexLineStroker.ts`**: δέχεται polyline (world→screen points) +
  `ComplexLinetypeDef` και κάνει **arc-length walk**:
  1. Υπολογίζει συνολικό μήκος & cumulative offsets (με `phaseMm`, `continuous`).
  2. Για κάθε element «καταναλώνει» μήκος: dash → sub-path με `cap`/`width`/`widthProfile`· text →
     `ctx.fillText` με tangent-angle rotation (αν `followPath`)· symbol → `ctx.transform` + draw
     `Path2D`· gap → skip.
  3. **Corner policy** στις κορυφές (Break/Bypass/alignDash) + `join`.
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

## 7. Phased roadmap

| Φάση | Περιεχόμενο | Μηχανισμοί | Ρίσκο |
|---|---|---|---|
| **Φ1** | Μοντέλο (`ComplexLinetypeDef`) + adapters + registry superset + **stroke geometry** (caps/join/corner/width/phase/scale-space) στον stroker· fast-path guard | #5 #6 #7 #8 #10 #11 | Μεσαίο (render path) |
| **Φ2** | **Embedded text** (#2) end-to-end: model → stroker → editor row → live preview → DXF I/O | #2 | Μεσαίο |
| **Φ3** | **Symbol Library** (§6.3, builtin seed) + **symbol elements** + **ρόλοι** side/start/end (#3, μέρος #4) | #3, #4α | Μεσαίο |
| **Φ4** | **Corner-role symbols** (inner/outer corner) + align-dash corner policy (υπόλοιπο #4/#7) | #4β #7 | Υψηλό (corner math) |
| **Φ5** | **Compound layers** (#9) + parallel-offset stroking + editor multi-layer UI | #9 | Υψηλό |
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

## 9. Open questions (για Giorgio)

1. **Scope**: επιβεβαίωση ότι κόβουμε #Art-brush, #Raster, `.shx` import (χαμηλή αξία/υψηλό κόστος).
2. **#11 scale-space default**: model-space (σαν AutoCAD) ή paper-space (σαν Revit) ως προεπιλογή;
3. **Symbol seed**: ποια ακριβώς σύμβολα θέλει στο builtin (τοπογραφικά: `×`, `*`, φράχτες, utilities
   GAS/W/ΔΕΗ/ΟΤΕ, βέλη, batting, tree-line);
4. **Προτεραιότητα φάσεων**: ξεκινάμε Φ1 (geometry) ή Φ2 (text — πιο ορατό «wow» στα τοπογραφικά);

## 10. Changelog

- **2026-07-12** — ADR δημιουργήθηκε. Research sweep (11 μηχανισμοί), current-state ανάλυση
  (simple-only μέσω `setLineDash`), ενοποιημένο μοντέλο `ComplexLinetypeDef`, custom-stroker απόφαση,
  5-φασικό roadmap. Status: PROPOSED — αναμονή scope-approval (§9) πριν Φ1.
