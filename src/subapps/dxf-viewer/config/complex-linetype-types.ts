/**
 * Complex Linetype types — ADR-642 §6.1 (Φ1 data model, superset του `LinetypeDef`).
 *
 * Ένας τύπος γραμμής, στην πλήρη enterprise μορφή, είναι μια **διατεταγμένη λίστα
 * στοιχείων μοτίβου** (`PatternElement` — discriminated union) + **stroke attributes**
 * (caps, joins, corner policy, width, phase, scale-space) + προαιρετικά **compound
 * layers**. Το σημερινό `LinetypeDef.pattern: number[]` παραμένει έγκυρο· ένας pure
 * adapter (`complex-linetype-adapters.ts`) το ανεβάζει/κατεβάζει σε/από αυτό το μοντέλο.
 *
 * Τα text/symbol elements ορίζονται εδώ (πλήρες μοντέλο) αλλά αποδίδονται σε
 * μεταγενέστερες φάσεις: text = Φ2, symbols/ρόλοι = Φ3/Φ4. Ο Φ1 stroker τα προσπερνά.
 *
 * Types-only file (no logic) → εκτός του ορίου 500 γραμμών (CLAUDE.md N.7.1).
 */

import type { LinetypeOrigin } from './linetype-iso-catalog';

/** Πώς κλιμακώνεται το μοτίβο όταν αλλάζει το zoom. #11. */
export type LinetypeScaleSpace =
  /** Μονάδες σχεδίου — οι παύλες μεγαλώνουν με το zoom (AutoCAD default, σημερινή μας συμπεριφορά). */
  | 'model'
  /** Σταθερό στο χαρτί — dash 3mm = πάντα 3mm στην εκτύπωση, ανεξάρτητα zoom (Revit). */
  | 'paper';

/** Άκρο ενός dash/dot. #5 (SVG `stroke-linecap`). */
export type DashCap = 'butt' | 'round' | 'square';

/** Ένωση διαδοχικών τμημάτων polyline σε μια κορυφή. #6 (SVG `stroke-linejoin`). */
export type StrokeJoin = 'miter' | 'round' | 'bevel';

/** Πού «κάθεται» ένα σύμβολο κατά μήκος/στα άκρα. #4 (Illustrator 5-tile). */
export type SymbolRole = 'side' | 'innerCorner' | 'outerCorner' | 'start' | 'end';

/**
 * Τι κάνει το μοτίβο στη γωνία. #7 (MicroStation Break/Bypass).
 *   - `break`     : το μοτίβο ξαναξεκινά σε κάθε κορυφή (καθαρή γωνία).
 *   - `bypass`    : συνεχές — διαπερνά τη γωνία (AutoCAD LTGEN default).
 *   - `alignDash` : ρυθμίζει τη φάση ώστε dash (όχι gap) να πέφτει στη γωνία (Φ4).
 */
export type CornerPolicy = 'break' | 'bypass' | 'alignDash';

/** Ορατό τμήμα σταθερού/μεταβλητού πλάτους. */
export interface DashElement {
  readonly kind: 'dash';
  readonly lengthMm: number;
  /** Άκρο· default `'butt'`. #5 */
  readonly cap?: DashCap;
  /** Override του πλάτους στρώματος για ΑΥΤΟ το dash (mm). #8 */
  readonly widthMm?: number;
  /** Normalized taper samples 0..1 κατά μήκος του dash (variable width). #8 */
  readonly widthProfile?: readonly number[];
}

/** Κενό (pen-up). Το `lengthMm` είναι πάντα θετικό εδώ (το πρόσημο ζει στο `number[]`). */
export interface GapElement {
  readonly kind: 'gap';
  readonly lengthMm: number;
}

/** Τελεία — μηδενικού μήκους ορατό στίγμα (DXF `0`). */
export interface DotElement {
  readonly kind: 'dot';
  readonly cap?: DashCap;
}

/** Ενσωματωμένο κείμενο κατά μήκος της γραμμής. #2 (AutoCAD `["GAS",STYLE,S,R,X,Y]`). Render: Φ2. */
export interface TextElement {
  readonly kind: 'text';
  readonly value: string;
  readonly styleId: string;
  readonly scale: number;
  readonly rotationDeg: number;
  readonly offsetXMm: number;
  readonly offsetYMm: number;
  /** `true` → η γωνία R είναι σχετική με την εφαπτομένη της γραμμής· `false` → απόλυτη. */
  readonly followPath: boolean;
}

/** Ενσωματωμένο σύμβολο/glyph από τη Symbol Library. #3/#4. Render: Φ3/Φ4. */
export interface SymbolElement {
  readonly kind: 'symbol';
  readonly glyphId: string;
  readonly role: SymbolRole;
  readonly scale: number;
  readonly rotationDeg: number;
  readonly offsetXMm: number;
  readonly offsetYMm: number;
}

/** Ένα στοιχείο του μοτίβου — discriminated union στο `kind`. */
export type PatternElement =
  | DashElement
  | GapElement
  | DotElement
  | TextElement
  | SymbolElement;

/** Τα `kind` που έχουν γεωμετρικό μήκος/σχήμα και αποδίδονται από τον Φ1 stroker. */
export type GeometryElementKind = 'dash' | 'gap' | 'dot';

/**
 * Ένα «στρώμα» (single stroke). Ένας κοινός τύπος έχει ΕΝΑ στρώμα· compound (#9,
 * π.χ. διπλή γραμμή δρόμου / σιδηρόδρομος) έχει πολλά με διαφορετικό `offsetMm`.
 */
export interface StrokeLayer {
  readonly elements: readonly PatternElement[];
  /** Κάθετη μετατόπιση του στρώματος από τον άξονα της γραμμής (mm). Compound. #9 */
  readonly offsetMm?: number;
  /** Βασικό πλάτος του στρώματος (mm)· default = γενικό πλάτος γραμμής. */
  readonly widthMm?: number;
}

/**
 * Το πλήρες complex-linetype — **superset** του `LinetypeDef`. Ένα single-layer,
 * dash/gap/dot-only instance είναι ισοδύναμο με τον σημερινό απλό τύπο (βλ.
 * `isSimpleExpressible` / `complexToPattern`).
 */
export interface ComplexLinetypeDef {
  readonly id?: string;
  readonly name: string;
  readonly description: string;
  /** ≥1 στρώμα· single-layer = ο κοινός τύπος. */
  readonly layers: readonly StrokeLayer[];
  readonly join?: StrokeJoin;
  readonly miterLimit?: number;
  readonly cornerPolicy?: CornerPolicy;
  /** Default `'model'` (AutoCAD-faithful, backward-compatible — ADR-642 §9 Q2). #11 */
  readonly scaleSpace?: LinetypeScaleSpace;
  /** Συνεχής παραγωγή κατά μήκος polyline (AutoCAD LTGEN). */
  readonly continuous?: boolean;
  /** Από πού μέσα στο μοτίβο ξεκινά (mm offset). #10 */
  readonly phaseMm?: number;
  readonly origin: LinetypeOrigin;
  readonly sourceFile?: string;
}
