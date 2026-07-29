/**
 * 🏢 ENTERPRISE — AST/flat κείμενο → ΠΗΓΑΙΕΣ γραμμές (ADR-635 Φ C.20/C.21).
 *
 * Το βήμα ΠΡΙΝ τη διάταξη: παίρνει το `DxfTextNode` (ή το legacy flat string) και το κόβει σε
 * `SourceLine[]` — μια ανά παράγραφο, χωρισμένη περαιτέρω σε κάθε `\n` που άφησε ένα `\N`.
 * Οι στηλοθέτες και η αναδίπλωση λύνονται μετά, στο `text-layout.ts`.
 *
 * Εδώ ζει η **επίλυση στυλ ανά run**: το στυλ του run υπερισχύει του στυλ μπλοκ, και το
 * αποτέλεσμα ταξιδεύει αυτούσιο μέχρι το span (βλ. τη σύμβαση στο `text-layout-types.ts`).
 *
 * Καθαρό: μηδέν React / DOM / THREE / Firestore.
 *
 * @module bim/text/text-layout-source
 */

import type { DxfText, DxfTextStyle } from '../../canvas-v2/dxf-canvas/dxf-types';
import type {
  DxfTextNode, LineSpacingMode, TextRun, TextRunStyle, TextStack,
} from '../../text-engine/types';
import type { TextAdvanceStyle } from '../../text-engine/fonts';
import { resolveRunColorHex } from '../../text-engine/render/run-color';
import { splitTextLines } from './text-lines';
import {
  NO_DECORATION,
  type ParagraphJustification,
  type SourceLine,
  type SourcePiece,
  type TextSpanDecoration,
} from './text-layout-types';

/** Είναι αυτό το παιδί του AST ένα στυλισμένο run (σε αντίθεση με μια στοίβα `\S`); */
function isRun(child: TextRun | { top: string }): child is TextRun {
  return !('top' in child);
}

/**
 * Οι διακοσμήσεις του ΜΠΛΟΚ, από το flat `textStyle` της οντότητας. Χρησιμεύουν ΜΟΝΟ ως
 * κληρονομιά για πηγές χωρίς AST (legacy / in-app κείμενο) και για τις στοίβες `\S`, που δεν
 * κουβαλούν πλήρες run style. Όταν υπάρχει AST, ο run είναι η αλήθεια.
 */
export function blockDecorationOf(style: DxfTextStyle | undefined): TextSpanDecoration {
  if (!style) return NO_DECORATION;
  const d: TextSpanDecoration = {
    underline: style.underline === true,
    overline: style.overline === true,
    strikethrough: style.strikethrough === true,
  };
  return d.underline || d.overline || d.strikethrough ? d : NO_DECORATION;
}

/** Συγχώνευση στυλ run πάνω στο στυλ μπλοκ — ο run νικά όπου δηλώνει κάτι. */
function pieceStyle(runStyle: TextRunStyle | undefined, block: TextAdvanceStyle): TextAdvanceStyle {
  if (!runStyle) return block;
  return {
    fontFamily: runStyle.fontFamily || block.fontFamily,
    // `??` (ΟΧΙ `||`): το ρητό `false` ενός `\f…|b0|i0;` ΠΡΕΠΕΙ να νικά ένα bold μπλοκ — αυτή
    // ακριβώς η διάκριση χανόταν παρακάτω, στο span, μέχρι το Φ C.21.
    bold: runStyle.bold ?? block.bold,
    italic: runStyle.italic ?? block.italic,
    // Το `widthFactor` μένει το X-scale της ΟΝΤΟΤΗΤΑΣ: το `\W` είναι κωδικός run που δεν
    // μεταφέρουμε ακόμη ανά span (θα διπλομετρούσε με το `ctx.scale` του renderer).
    widthFactor: block.widthFactor,
    tracking: runStyle.tracking > 0 ? runStyle.tracking : block.tracking,
  };
}

/** Διακοσμήσεις run πάνω στις διακοσμήσεις μπλοκ — ίδιος κανόνας νίκης με το `pieceStyle`. */
function pieceDecoration(
  runStyle: TextRunStyle | undefined, block: TextSpanDecoration,
): TextSpanDecoration {
  if (!runStyle) return block;
  const d: TextSpanDecoration = {
    underline: runStyle.underline ?? block.underline,
    overline: runStyle.overline ?? block.overline,
    strikethrough: runStyle.strikethrough ?? block.strikethrough,
  };
  return d.underline || d.overline || d.strikethrough ? d : NO_DECORATION;
}

/**
 * Στοίχιση παραγράφου από το AST, αμυντικά. Το `justification` λείπει σε χειροποίητα/legacy AST
 * (in-app κείμενο, fixtures) παρότι ο τύπος το δηλώνει υποχρεωτικό — ίδια περίπτωση με το `tabs`.
 */
function normaliseJustification(raw: number | undefined): ParagraphJustification {
  return raw === 1 || raw === 2 || raw === 3 ? raw : 0;
}

/** Ό,τι χρειάζεται μια πηγαία γραμμή για να φτιάξει τα κομμάτια της. */
interface SourceContext {
  readonly block: TextAdvanceStyle;
  readonly blockHeight: number;
  readonly blockDecoration: TextSpanDecoration;
}

/** Τα κοινά πεδία ενός κομματιού από ένα παιδί του AST (κείμενο ή στοίβα). */
function pieceBaseOf(child: TextRun | TextStack, ctx: SourceContext): Omit<SourcePiece, 'text'> {
  const runStyle = isRun(child) ? child.style : undefined;
  const height = child.style.height > 0 ? child.style.height : ctx.blockHeight;
  const color = resolveRunColorHex(child.style.color);
  return {
    style: pieceStyle(runStyle, ctx.block),
    heightWorld: height,
    decoration: pieceDecoration(runStyle, ctx.blockDecoration),
    ...(color ? { color } : {}),
  };
}

/**
 * Πηγαίες γραμμές από το AST: μία ανά παράγραφο (`\P`), χωρισμένη περαιτέρω σε κάθε `\n` που
 * παρήγαγε ένα `\N`. Το συνενωμένο κείμενο των κομματιών ισούται με ό,τι δίνει το
 * `extractFlatText` — ώστε η αναδίπλωση/το κουτί να μην μπορούν να αποκλίνουν από τη flat
 * διαδρομή για κείμενα χωρίς στυλ ανά run.
 */
export function sourceLinesFromNode(
  node: DxfTextNode,
  block: TextAdvanceStyle,
  blockHeight: number,
  blockDecoration: TextSpanDecoration,
): SourceLine[] {
  const ctx: SourceContext = { block, blockHeight, blockDecoration };
  const lines: SourceLine[] = [];
  for (const para of node.paragraphs) {
    // `tabs` λείπει σε χειροποίητα/legacy AST (in-app κείμενο, fixtures) παρότι ο τύπος το
    // δηλώνει υποχρεωτικό — το AST έρχεται και από μη-parser πηγές. Χωρίς αυτό το `?? []`,
    // κάθε in-app κείμενο έριχνε `Cannot read properties of undefined` μέσα από το κουτί
    // επιλογής (το έπιασαν τα υπάρχοντα tests παρότι ο compiler ήταν ευχαριστημένος).
    const tabsEm = para.tabs ?? [];
    const justification = normaliseJustification(para.justification);
    // `\ps…` — λείπει σε χειροποίητα/legacy AST όπως τα `tabs`/`justification`.
    const spacingFactor = para.lineSpacingFactor != null && para.lineSpacingFactor > 0
      ? para.lineSpacingFactor
      : 1;
    const spacingMode: LineSpacingMode = para.lineSpacingMode ?? 'multiple';
    let current: SourcePiece[] = [];
    const close = (): void => {
      lines.push({ pieces: current, tabsEm, justification, spacingFactor, spacingMode });
      current = [];
    };
    for (const child of para.runs) {
      // Μια στοίβα `\S` δεν έχει πλήρες run style — κρατά μόνο fontFamily/height/color. Την
      // αποδίδουμε γραμμικά ως `πάνω/κάτω` (η κάθετη στοίβαξη είναι δικό της κεφάλαιο)· έτσι
      // το περιεχόμενο **υπάρχει** αντί να εξαφανίζεται από τη διάταξη.
      const raw = isRun(child) ? child.text : `${child.top}/${child.bottom}`;
      const base = pieceBaseOf(child, ctx);
      raw.split('\n').forEach((part, i) => {
        if (i > 0) close();
        if (part) current.push({ ...base, text: part });
      });
    }
    close();
  }
  return lines.length > 0
    ? lines
    : [{ pieces: [], tabsEm: [], justification: 0, spacingFactor: 1, spacingMode: 'multiple' }];
}

/** Πηγαίες γραμμές από το flat string — legacy / in-app κείμενο χωρίς AST. */
export function sourceLinesFromFlat(
  flat: string | undefined,
  block: TextAdvanceStyle,
  blockHeight: number,
  blockDecoration: TextSpanDecoration,
): SourceLine[] {
  return splitTextLines(flat).map(line => ({
    pieces: line
      ? [{ text: line, style: block, heightWorld: blockHeight, decoration: blockDecoration }]
      : [],
    tabsEm: [],
    justification: 0 as ParagraphJustification,
    spacingFactor: 1,
    spacingMode: 'multiple' as LineSpacingMode,
  }));
}

/** Οι πηγαίες γραμμές ενός `DxfText`: AST όταν υπάρχει, αλλιώς το flat string. */
export function sourceLinesOf(
  text: DxfText, block: TextAdvanceStyle, height: number,
): SourceLine[] {
  const node = (text as { textNode?: DxfTextNode }).textNode;
  const decoration = blockDecorationOf(text.textStyle);
  return node?.paragraphs?.length
    ? sourceLinesFromNode(node, block, height, decoration)
    : sourceLinesFromFlat(text.text, block, height, decoration);
}
