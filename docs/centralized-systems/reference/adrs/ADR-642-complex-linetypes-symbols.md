# ADR-642 — Complex Linetypes: embedded text, symbols, width, caps/joins & compound strokes

- **Status:** 🟢 ACCEPTED — **Φ1 (stroke geometry) IMPLEMENTED** (2026-07-12). **Φ2-A (embedded text: render + editor + live preview) IMPLEMENTED** (2026-07-12). **Φ2-B μέρος 1 — full-canvas entity routing IMPLEMENTED** (2026-07-12): κάθε entity renderer (LINE/POLYLINE/ARC/CIRCLE) ρουτάρει το `──GAS──` μέσω `strokeStyledPolyline` όταν ο τύπος έχει `complex`· **εκκρεμεί Φ2-B μέρος 2 — DXF `[TEXT,...]` import/export** (`.lin` reader δεν υπάρχει στο repo → εκτός scope). Φ3–Φ5 pending. Scope §9 εγκρίθηκε· Φ2 scope (2026-07-12): Q1 = υπάρχον text SSoT (`resolveEntityFont`), Q2 = `followPath` toggle ανά κείμενο (default true), Q3 = render+editor+preview πρώτα, DXF μετά. Φ2-B scope (2026-07-12): routing πρώτα, ΟΛΑ τα entity types μαζί (κοινό seam), STYLE handle = synthetic-per-styleId (MLINE pattern) στο μέρος 2.
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
     **(Φ2 IMPLEMENTED)** zero-length slot (AutoCAD-faithful — τα γύρω gaps δίνουν χώρο) →
     `complex-text-draw.drawTextElement` με tangent-angle rotation (αν `followPath`) + X/Y offset +
     `scale`, μέσω του `paintTextRun`/`resolveEntityFont` SSoT (glyph-path ή CSS fallback)· symbol →
     `ctx.transform` + draw `Path2D` (Φ3)· gap → skip.
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
- **STYLE handle (Φ2-B μέρος 2)**: ο client ASCII writer είναι handle-less· το embedded text `340`
  reference θα παραχθεί με **deterministic synthetic handle ανά styleId**, μιμούμενο το υπάρχον
  SSoT precedent `export/core/dxf-ascii-mline-writer.ts` (MLINESTYLE `340` → synthetic handle base).

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

## 7. Phased roadmap

| Φάση | Περιεχόμενο | Μηχανισμοί | Ρίσκο |
|---|---|---|---|
| **Φ1** ✅ | Μοντέλο (`ComplexLinetypeDef`) + adapters + registry superset + **stroke geometry** (caps/join/corner/width/phase/scale-space) στον stroker· fast-path guard | #5 #6 #7 #8 #10 #11 | Μεσαίο (render path) — **DONE** |
| **Φ2-A** ✅ | **Embedded text** (#2): model bridge → stroker render → editor Text row → live preview | #2 | Μεσαίο — **DONE** |
| **Φ2-B μέρος 1** ✅ | **Full-canvas entity routing**: LINE/POLYLINE/ARC/CIRCLE → `strokeStyledPolyline` όταν `complex` (κοινό `strokeStyledEntityPolyline` seam) | #2 | Μεσαίο — **DONE** |
| **Φ2-B μέρος 2** | **DXF `[TEXT,...]` import/export** (LTYPE embedded text + STYLE synthetic handle· `.lin` δεν υπάρχει στο repo) | #2 | Μεσαίο |
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

## 9. Open questions — αποφάσεις Giorgio (2026-07-12)

1. **Scope**: ✅ **Κόβουμε** Art-brush stretch, Raster line styles, `.shx` shape import (χαμηλή αξία/υψηλό
   κόστος). Ανοίγουν ως μελλοντική φάση μόνο αν προκύψει interop-ανάγκη (π.χ. πελάτης στέλνει `.shx`).
2. **#11 scale-space default**: ✅ **`model`** (AutoCAD-faithful + ίδια σημερινή συμπεριφορά → μηδέν
   regression). Το **`paper`** (Revit-mode) υλοποιείται ΚΑΙ αυτό, ανά τύπο, ως opt-in — «full enterprise»
   που καλύπτει όλους τους μεγάλους παίκτες χωρίς να χαλάει κανέναν (Giorgio: «όπως το κάνουν οι μεγάλοι»).
3. **Symbol seed**: ⏳ ΑΝΟΙΧΤΟ — θα ρωτηθεί στην έναρξη της **Φ3** (Symbol Library), όπου και χρησιμοποιείται.
4. **Προτεραιότητα φάσεων**: ✅ **Φ1 πρώτα** (geometry θεμέλιο· το text της Φ2 πατά πάνω του).

## 10. Changelog

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
