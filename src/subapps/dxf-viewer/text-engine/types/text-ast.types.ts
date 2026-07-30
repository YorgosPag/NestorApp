/**
 * ADR-344 Phase 1 — DxfTextNode AST and associated types.
 *
 * DxfTextNode is the canonical in-memory representation of a DXF TEXT or
 * MTEXT entity. The parser (Layer 1) produces it; the serializer (Layer 1)
 * consumes it; the layout engine (Layer 3) reads it; the renderer (Layer 2)
 * draws it.
 *
 * AnnotationScale is part of the DxfTextNode data model (Q11).
 * The viewport infrastructure (Phase 11) reads these fields at render time.
 */

import type { DxfColor } from './text-toolbar.types';

// ── Justification & spacing ───────────────────────────────────────────────────

/** 9-point attachment grid used by MTEXT group code 71. */
export type TextJustification =
  | 'TL' | 'TC' | 'TR'
  | 'ML' | 'MC' | 'MR'
  | 'BL' | 'BC' | 'BR';

/**
 * Vertical anchor of a text entity's `position` — stated in the CANVAS `textBaseline`
 * vocabulary on purpose, because that is the vocabulary `ctx.textBaseline`,
 * `drawGlyphRunToCanvas` and `DxfTextStyle.textBaseline` already speak. One word per
 * concept, so nothing needs translating between the import, the box and the paint.
 *
 * ⚠️ `'alphabetic'` is the DXF **baseline** (TEXT group code 73 = 0) — the glyph baseline
 * itself, offset ZERO from `position`. It is NOT `'bottom'`: `'bottom'` sits a full font
 * DESCENT lower (ADR-635 Φ C.26). The 9-point {@link TextJustification} grid has three rows
 * only, so it cannot express this fourth state — which is exactly why it is carried
 * separately (`DxfTextNode.baselineAnchored`).
 */
export type TextVerticalAnchor = 'top' | 'middle' | 'bottom' | 'alphabetic';

/** MTEXT line-spacing mode (group code 73). */
export type LineSpacingMode = 'multiple' | 'exact' | 'at-least';

// ── Annotation scaling (Q11) ─────────────────────────────────────────────────

/**
 * One entry in the per-entity annotation-scale list.
 * Stored in DXF XDATA (group codes 1000/1070/1071) on ANNOTATIVE entities.
 */
export interface AnnotationScale {
  /** Display name, e.g. "1:100". */
  readonly name: string;
  /** Desired paper-space text height in mm. */
  readonly paperHeight: number;
  /** model-space height = paperHeight × scaleFactor (computed). */
  readonly modelHeight: number;
}

// ── Run-level styling ─────────────────────────────────────────────────────────

/** Style attributes that can vary per inline run within a paragraph. */
export interface TextRunStyle {
  fontFamily: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  overline: boolean;
  strikethrough: boolean;
  /** Character height in drawing units. */
  height: number;
  /** Width factor (1.0 = normal). */
  widthFactor: number;
  /** Oblique angle in degrees (positive = slant right). */
  obliqueAngle: number;
  /** Character tracking/spacing factor (1.0 = normal). */
  tracking: number;
  color: DxfColor;
  /**
   * ADR-344 — κατακόρυφη στοίχιση χαρακτήρων ΜΕΣΑ στη γραμμή, από το inline `\A#;`
   * (`0` = bottom, `1` = center, `2` = top). State-change κωδικός όπως το χρώμα/ύψος:
   * ισχύει για τα ΕΠΟΜΕΝΑ runs και περιορίζεται στο πεδίο ενός `{…}` group.
   *
   * 🐛 Μέχρι τη διόρθωση αυτή ο tokenizer παρήγαγε σωστά `{ kind: 'alignment' }` αλλά η
   * `applyStyleToken` **δεν είχε case** → έπεφτε στο `default: break`. Μετρημένο στο
   * `47_ergasia.dxf`: **49 εμφανίσεις `\A#;`**, όλες χαμένες — άρα και το export τις έσβηνε.
   *
   * ⚠️ `undefined` = «δεν δηλώθηκε» ⇒ προεπιλογή `0`. Προαιρετικό σκόπιμα: ένα υποχρεωτικό
   * πεδίο θα έσπαγε ~20 σημεία που χτίζουν πλήρες `TextRunStyle` κυριολεκτικά.
   */
  verticalAlign?: 0 | 1 | 2;
}

/** A contiguous run of text sharing a single style. */
export interface TextRun {
  readonly text: string;
  readonly style: TextRunStyle;
}

/**
 * A stacked fraction or tolerance produced by the \S inline code.
 * Rendered as vertically stacked top/bottom text.
 */
export interface TextStack {
  readonly top: string;
  readonly bottom: string;
  /** ^ = tolerance (diagonal), / = diagonal fraction, # = horizontal fraction. */
  readonly type: 'tolerance' | 'diagonal' | 'horizontal';
  /**
   * ADR-737 §11-2 — το `verticalAlign` ΠΡΕΠΕΙ να είναι εδώ, δεν είναι καλλωπισμός. Μετρημένο
   * στο `47_ergasia.dxf`: στις 5 ετικέτες εμβαδού (`\A1;{\C7;Ε\H0.7x;\S^ τίτλου;\H1.4286x;…}`)
   * το **κοντό** περιεχόμενο της γραμμής — αυτό ακριβώς που το `\A` μετακινεί — **ΕΙΝΑΙ** η
   * στοίβα. Χωρίς το πεδίο, η στοίχιση θα εφαρμοζόταν παντού ΕΚΤΟΣ από εκεί που μετράει.
   */
  readonly style: Pick<TextRunStyle, 'fontFamily' | 'height' | 'color' | 'verticalAlign'>;
}

/**
 * Το ΕΞ ΟΡΙΣΜΟΥ στυλ run — η γραμμή βάσης που ο parser δίνει στο πρώτο run και ως προς την οποία
 * ο serializer υπολογίζει τη διαφορά στυλ. **Πρέπει** να είναι το ίδιο αντικείμενο εννοιολογικά:
 * αν αποκλίνουν, ο serializer εκπέμπει (ή παραλείπει) κωδικούς για τιμές που ο parser θεωρεί
 * προεπιλογή — σιωπηλή διαρροή/θόρυβος σε κάθε export.
 *
 * N.0.2 — ήταν κυριολεκτικά αντιγραμμένο σε `mtext-parser.buildDefaultStyle` και
 * `mtext-serializer.buildBaseStyle` (13 γραμμές / 53 tokens· το έπιασε το CHECK 3.28 jscpd).
 *
 * Επιστρέφει ΝΕΟ αντικείμενο σε κάθε κλήση — ο parser το μεταλλάσσει μέσα από το styleStack.
 */
export function createDefaultTextRunStyle(overrides?: Partial<TextRunStyle>): TextRunStyle {
  const base: TextRunStyle = {
    fontFamily: 'Standard',
    bold: false,
    italic: false,
    underline: false,
    overline: false,
    strikethrough: false,
    height: 2.5,
    widthFactor: 1.0,
    obliqueAngle: 0,
    tracking: 1.0,
    color: { kind: 'ByLayer' },
  };
  return overrides ? { ...base, ...overrides } : base;
}

/**
 * Ο διαχωριστής που χωρίζει `top` από `bottom` μέσα σε ένα `\S…;` — **ένα** λεξιλόγιο για τις
 * τρεις διαδρομές που το χρειάζονται: ο tokenizer τον ψάχνει για να βρει τον τύπο, ο serializer
 * τον ξαναγράφει, και η flat προβολή (`extractFlatText`) τον χρησιμοποιεί ώστε το κείμενο που
 * βλέπει hit-test/bounds να μη λέει άλλα από ό,τι εξάγουμε.
 *
 * ⚠️ Αλλαγή εδώ = αλλαγή στο DXF που γράφουμε. Δεν είναι θέμα εμφάνισης.
 */
export const MTEXT_STACK_DIVIDERS: Readonly<Record<TextStack['type'], string>> = {
  tolerance: '^',
  diagonal: '/',
  horizontal: '#',
};

/**
 * Ο διαχωριστής μιας στοίβας, ανεκτικός σε χειροποίητα/legacy AST όπου το `type` λείπει
 * (`'#'` = ο ίδιος κανόνας «ό,τι δεν είναι `^` ή `/`» που εφαρμόζει ο tokenizer).
 */
export function mtextStackDivider(type: TextStack['type'] | undefined): string {
  return (type && MTEXT_STACK_DIVIDERS[type]) ?? MTEXT_STACK_DIVIDERS.horizontal;
}

// ── Paragraph ─────────────────────────────────────────────────────────────────

/** A paragraph composed of one or more runs and/or stacks. */
export interface TextParagraph {
  readonly runs: ReadonlyArray<TextRun | TextStack>;
  /** First-line indent in drawing units (\pi). */
  readonly indent: number;
  /** Left margin in drawing units (\pl). */
  readonly leftMargin: number;
  /** Right margin in drawing units (\pr). */
  readonly rightMargin: number;
  /** Tab-stop positions in drawing units (\pt). */
  readonly tabs: readonly number[];
  /** Paragraph justification: 0=left, 1=center, 2=right, 3=justify (\pq). */
  readonly justification: 0 | 1 | 2 | 3;
  /** Line spacing for this paragraph. */
  readonly lineSpacingMode: LineSpacingMode;
  readonly lineSpacingFactor: number;
}

// ── Root node ─────────────────────────────────────────────────────────────────

/** Root AST node representing one TEXT or MTEXT DXF entity. */
export interface DxfTextNode {
  readonly paragraphs: readonly TextParagraph[];
  /** 9-point attachment point for MTEXT positioning (group code 71). */
  readonly attachment: TextJustification;
  /**
   * ADR-635 Φ C.26 — single-line TEXT/ATTRIB/ATTDEF only: `position` is the glyph
   * BASELINE (group code 73 = 0, the DXF default), not the bottom row of
   * {@link attachment}. The missing 4th vertical state of the 3-row attachment grid.
   *
   * MEASURED (`47_ergasia.dxf`, 1.127/1.127 TEXT carry 73 = 0): treating it as the
   * `'bottom'` row lifted every glyph by one font descent — **+0,1906 world units** for
   * h = 0,5 Roboto = 38,1% of the text height. In a 0,9000 table cell that left 0,0094 of
   * the 0,2000 top clearance (4,7%) for a caps/digits string, and the header «α/α» — whose
   * ink reaches 0,6380 because of the «/» — crossed the rule above it by 0,1286.
   * AutoCAD's own numbers in that file prove the anchor is the baseline:
   * baseline − lower rule = 0,2000 and upper rule − (baseline + h) = 0,2000, a symmetry
   * that holds ONLY with a zero offset.
   *
   * Absent (`undefined`) ⇒ the attachment row governs — MTEXT (group 71 always names a
   * real T/M/B row) and in-app text are untouched.
   */
  readonly baselineAnchored?: boolean;
  /** Node-level line spacing; individual paragraphs may override. */
  readonly lineSpacing: { readonly mode: LineSpacingMode; readonly factor: number };
  /** Background fill mask (group codes 90/63/421). */
  readonly bgMask?: {
    readonly color: DxfColor;
    readonly offsetFactor: number;
  };
  /** Multi-column layout (R2007+, group codes 73/74/45). */
  readonly columns?: {
    readonly type: 'static' | 'dynamic';
    readonly count: number;
    readonly width: number;
    readonly gutter: number;
  };
  /** Entity rotation in degrees (group code 50). */
  readonly rotation: number;
  /** True when the entity carries the ANNOTATIVE flag. */
  readonly isAnnotative: boolean;
  /** Per-entity annotation scales (Q11, DXF XDATA). */
  readonly annotationScales: readonly AnnotationScale[];
  /** Name of the currently active annotation scale ("" = use first scale). */
  readonly currentScale: string;
}

// ── STYLE table ───────────────────────────────────────────────────────────────

/** One entry from the DXF STYLE symbol table (section TABLES). */
export interface DxfStyleTableEntry {
  /** Style name (group code 2). */
  readonly name: string;
  /** Primary font filename (group code 3), e.g. "romans.shx" or "Arial.ttf". */
  readonly fontFile: string;
  /** Big-font filename (group code 4) for Asian glyph support. */
  readonly bigFontFile: string;
  /** Fixed text height in drawing units (group code 40). 0 = variable. */
  readonly height: number;
  /** Width factor (group code 41). */
  readonly widthFactor: number;
  /** Oblique angle in degrees (group code 50). */
  readonly obliqueAngle: number;
  /** Style flags (group code 70). */
  readonly flags: number;
  /** Text generation flags: 2=backward, 4=upside-down (group code 71). */
  readonly textGenerationFlags: number;
  /**
   * ADR-642 Φ2-B — DXF handle (group code 5) of this STYLE record, when present. Used to
   * resolve a complex-linetype embedded-text `340` STYLE reference on import. Absent when
   * the writer omits handles (the minimal client writer is otherwise handle-less).
   */
  readonly handle?: string;
}
