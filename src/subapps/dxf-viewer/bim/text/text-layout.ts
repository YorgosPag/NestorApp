/**
 * 🏢 ENTERPRISE — MTEXT visual layout SSoT (ADR-635 Φ C.20).
 *
 * Turns a `DxfText` into the VISUAL lines that are actually painted: word-wrapped inside the
 * MTEXT column (group 41), with `\t` resolved to real tab stops, and with the per-run style
 * (colour / font / weight / height) preserved on each span.
 *
 * ── Why this module exists ───────────────────────────────────────────────────────────────
 * Everything downstream used to consume the FLAT `text` string and one style:
 *   1. **No wrapping.** `splitTextLines` breaks only on `\n` (an explicit `\P`), so a 2.800-
 *      character paragraph was painted as ONE line running far outside the drawing.
 *   2. **No tab stops.** Even after `^I` became a real `\t` (tokenizer), a tab has no glyph —
 *      every tab-aligned column collapsed.
 *   3. **One colour for the whole block.** `extractFirstRunStyle` takes the FIRST run and
 *      applies it everywhere, while AutoCAD switches colour dozens of times inside one MTEXT.
 *
 * ── Parity contract (ADR-557) ────────────────────────────────────────────────────────────
 * The renderer and the box/grip math MUST agree on the line set. Both call `layoutTextBlock`,
 * so the wrap decision is made ONCE. Measurement is in WORLD units via the existing
 * `measureTextAdvanceWorld` SSoT — the same metric the box already used — so wrapping is
 * zoom-independent, exactly like AutoCAD.
 *
 * ── Deliberately NOT imported ────────────────────────────────────────────────────────────
 * `text-box.ts` (which consumes this) is not imported back: height + font style arrive as
 * parameters, so there is no cycle.
 *
 * Pure: zero React / DOM / THREE / Firestore deps (the lazy CSS `measureText` fallback lives
 * inside `measureTextAdvanceWorld` and is `typeof document`-guarded there).
 *
 * @module bim/text/text-layout
 */

import type { DxfText } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { DxfTextNode, TextRun, TextRunStyle } from '../../text-engine/types';
import { measureTextAdvanceWorld, type TextAdvanceStyle } from '../../text-engine/fonts';
import { resolveRunColorHex } from '../../text-engine/render/run-color';
import { splitTextLines } from './text-lines';

/**
 * Default tab-stop interval, in **em** (multiples of the text height), used when the MTEXT
 * carries no explicit `\pt` stops — which is the overwhelmingly common case (the AutoCAD
 * sample that exposed this has 149 tabs and ZERO explicit stops).
 *
 * Το `4` στηρίζεται σε **δύο ανεξάρτητες πηγές που συμφωνούν**:
 *   1. Ο χάρακας του συντάκτη MTEXT δείχνει προεπιλεγμένες στάσεις στο 4, 8, 12 — και οι μονάδες
 *      του χάρακα είναι πολλαπλάσια του ύψους χαρακτήρα (BricsCAD forum, ίδια σύμβαση με AutoCAD).
 *   2. Εμπειρική βαθμονόμηση από στιγμιότυπο AutoCAD του ΙΔΙΟΥ σχεδίου: η στήλη ημερομηνιών μετά
 *      από 3 tab πέφτει στα ≈16,4 em ⇒ βήμα ≈4,1 em.
 *
 * ⚠️ Δεν το βρήκα σε **επίσημη** προδιαγραφή της Autodesk (το ezdxf τεκμηριώνει τη μονάδα, όχι την
 * προεπιλογή). Αν κάποια στοίχιση δεν ταιριάζει οπτικά, αυτός είναι ο **ΕΝΑΣ** αριθμός που
 * αλλάζει — μην κυνηγήσεις τον αλγόριθμο.
 */
export const MTEXT_DEFAULT_TAB_INTERVAL_EM = 4;

/** A contiguous piece of one visual line, at its own x offset, with its own paint style. */
export interface TextLayoutSpan {
  readonly text: string;
  /** Horizontal offset from the line start, world units. */
  readonly xWorld: number;
  /** Glyph advance of `text`, world units. */
  readonly widthWorld: number;
  /** Character height for this span, world units (inline `\H` overrides the block height). */
  readonly heightWorld: number;
  /** CSS colour, or undefined when the run inherits the entity/layer colour. */
  readonly color?: string;
  readonly fontFamily?: string;
  readonly bold?: boolean;
  readonly italic?: boolean;
}

/** One VISUAL line (after wrapping) — what the renderer paints on a single baseline. */
export interface TextLayoutLine {
  readonly spans: readonly TextLayoutSpan[];
  /** Total advance of the line, world units (max span right edge). */
  readonly widthWorld: number;
}

/** A styled piece of SOURCE text, before tabs/wrapping are resolved. */
interface SourcePiece {
  readonly text: string;
  readonly style: TextAdvanceStyle;
  readonly heightWorld: number;
  readonly color?: string;
}

/**
 * One SOURCE line (a paragraph, or a `\N` break inside one) with the tab stops that apply to it.
 * Stops are **per paragraph** in the AST — a single global list would apply one paragraph's
 * `\pt` ladder to the whole entity.
 */
interface SourceLine {
  readonly pieces: SourcePiece[];
  /** Tab stops in **em** (multiples of char height) — converted to world at layout time. */
  readonly tabsEm: readonly number[];
}

// ── Source extraction: AST first, flat string as fallback ─────────────────────

/** Is this AST child a styled run (vs a `\S` stack)? */
function isRun(child: TextRun | { top: string }): child is TextRun {
  return !('top' in child);
}

/** Merge a run's style over the block style — the run wins wherever it declares something. */
function pieceStyle(runStyle: TextRunStyle | undefined, block: TextAdvanceStyle): TextAdvanceStyle {
  if (!runStyle) return block;
  return {
    fontFamily: runStyle.fontFamily || block.fontFamily,
    bold: runStyle.bold ?? block.bold,
    italic: runStyle.italic ?? block.italic,
    // widthFactor stays the ENTITY's X-scale: `\W` is a run code we do not carry per span yet.
    widthFactor: block.widthFactor,
    tracking: runStyle.tracking > 0 ? runStyle.tracking : block.tracking,
  };
}

/**
 * Source lines from the AST: one per paragraph (`\P`), further split on any `\n` a `\N`
 * line-break produced inside a run. Each line is a list of styled pieces whose concatenated
 * text equals what `extractFlatText` yields — so the wrap/box maths cannot drift from the
 * flat path for texts that have no per-run styling.
 */
function sourceLinesFromNode(
  node: DxfTextNode, block: TextAdvanceStyle, blockHeight: number,
): SourceLine[] {
  const lines: SourceLine[] = [];
  for (const para of node.paragraphs) {
    // `tabs` λείπει σε χειροποίητα/legacy AST (in-app κείμενο, fixtures) παρότι ο τύπος το
    // δηλώνει υποχρεωτικό — το AST έρχεται και από μη-parser πηγές. Χωρίς αυτό το `?? []`,
    // κάθε in-app κείμενο έριχνε `Cannot read properties of undefined` μέσα από το κουτί
    // επιλογής (το έπιασαν τα υπάρχοντα tests παρότι ο compiler ήταν ευχαριστημένος).
    const tabsEm = para.tabs ?? [];
    let current: SourcePiece[] = [];
    const close = (): void => { lines.push({ pieces: current, tabsEm }); current = []; };
    for (const child of para.runs) {
      // Ένα `\S` stack δεν έχει πλήρες run style — κρατά μόνο fontFamily/height/color. Το
      // αποδίδουμε γραμμικά ως `πάνω/κάτω` (η κάθετη στοίβαξη είναι δικό της κεφάλαιο)· έτσι
      // το περιεχόμενο **υπάρχει** αντί να εξαφανίζεται από τη διάταξη.
      const raw = isRun(child) ? child.text : `${child.top}/${child.bottom}`;
      const runStyle = isRun(child) ? child.style : undefined;
      const height = child.style.height > 0 ? child.style.height : blockHeight;
      const piece = {
        style: pieceStyle(runStyle, block),
        heightWorld: height,
        color: resolveRunColorHex(child.style.color),
      };
      const parts = raw.split('\n');
      parts.forEach((part, i) => {
        if (i > 0) close();
        if (part) current.push({ ...piece, text: part });
      });
    }
    close();
  }
  return lines.length > 0 ? lines : [{ pieces: [], tabsEm: [] }];
}

/** Source lines from the flat string — legacy / in-app text with no AST. */
function sourceLinesFromFlat(
  flat: string | undefined, block: TextAdvanceStyle, blockHeight: number,
): SourceLine[] {
  return splitTextLines(flat).map(line => ({
    pieces: line ? [{ text: line, style: block, heightWorld: blockHeight }] : [],
    tabsEm: [],
  }));
}

// ── Tab stops ─────────────────────────────────────────────────────────────────

/**
 * Tab stops in WORLD units, ascending. Explicit `\pt` stops win when the MTEXT declares them;
 * otherwise the uniform default ladder (`nextTabStop`).
 *
 * ⚠️ **ΜΟΝΑΔΑ: em, ΟΧΙ μονάδες σχεδίου.** Οι θέσεις στηλοθετών (και οι εσοχές) στο MTEXT είναι
 * **πολλαπλάσια του ύψους χαρακτήρα** — τεκμηριωμένο στο ezdxf («Indentation and tabulator stops
 * are multiples of the default MText text height stored in `MText.dxf.char_height`»). Ένα `t3` σε
 * κείμενο ύψους 0,8 σημαίνει 2,4 μονάδες, όχι 3. Χωρίς τον πολλαπλασιασμό, μια στάση «3» έπεφτε
 * ουσιαστικά πάνω στην αρχή της γραμμής σε σχέδιο σε mm.
 */
function resolveTabStops(tabsEm: readonly number[] | undefined, height: number): readonly number[] {
  if (!tabsEm || tabsEm.length === 0) return [];
  return tabsEm
    .filter(t => Number.isFinite(t) && t > 0)
    .map(t => t * height)
    .sort((a, b) => a - b);
}

/** The first stop strictly right of `x`; falls back to the uniform default ladder. */
function nextTabStop(x: number, stops: readonly number[], height: number): number {
  for (const stop of stops) if (stop > x) return stop;
  const step = MTEXT_DEFAULT_TAB_INTERVAL_EM * height;
  if (step <= 0) return x;
  return (Math.floor(x / step) + 1) * step;
}

// ── Line building ─────────────────────────────────────────────────────────────

/** Mutable accumulator for the line currently being filled. */
class LineBuilder {
  private spans: TextLayoutSpan[] = [];
  private x = 0;
  readonly lines: TextLayoutLine[] = [];

  get cursor(): number { return this.x; }
  get isEmpty(): boolean { return this.spans.length === 0 && this.x === 0; }

  moveTo(x: number): void { this.x = x; }

  push(text: string, width: number, piece: SourcePiece): void {
    this.spans.push({
      text, xWorld: this.x, widthWorld: width, heightWorld: piece.heightWorld,
      ...(piece.color ? { color: piece.color } : {}),
      ...(piece.style.fontFamily ? { fontFamily: piece.style.fontFamily } : {}),
      ...(piece.style.bold ? { bold: true } : {}),
      ...(piece.style.italic ? { italic: true } : {}),
    });
    this.x += width;
  }

  /** Close the current line (even when empty — an empty source line is a real blank line). */
  flush(): void {
    const width = this.spans.reduce((m, s) => Math.max(m, s.xWorld + s.widthWorld), 0);
    this.lines.push({ spans: this.spans, widthWorld: width });
    this.spans = [];
    this.x = 0;
  }
}

/**
 * Largest prefix of `text` that fits in `available` world units. Prefers a word boundary;
 * falls back to a character cut when a single word is wider than the whole column (AutoCAD
 * does the same rather than overflowing indefinitely). Returns 0 when nothing fits.
 */
function fittingPrefixLength(
  text: string, available: number, piece: SourcePiece,
): number {
  if (available <= 0) return 0;
  const measure = (s: string): number => measureTextAdvanceWorld(s, piece.heightWorld, piece.style);
  if (measure(text) <= available) return text.length;

  // ⚠️ ΠΡΟΣΟΧΗ ΣΤΟ ΚΟΣΤΟΣ: μια αφελής σάρωση χαρακτήρα-χαρακτήρα κάνει O(n) μετρήσεις **ανά
  // γραμμή** ⇒ O(n²) για μια παράγραφο 2.800 χαρακτήρων, σε κάθε υπολογισμό κουτιού/απόδοσης.
  // Πρώτα λοιπόν όρια ΛΕΞΕΩΝ (O(λέξεις)), και δυαδική αναζήτηση σε χαρακτήρες **μόνο** όταν μία
  // και μόνη λέξη είναι φαρδύτερη από ολόκληρη τη στήλη.
  let lastWordEnd = 0;
  for (let i = text.indexOf(' '); i >= 0; i = text.indexOf(' ', i + 1)) {
    if (measure(text.slice(0, i + 1)) > available) break;
    lastWordEnd = i + 1;
  }
  if (lastWordEnd > 0) return lastWordEnd;

  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (measure(text.slice(0, mid)) <= available) lo = mid; else hi = mid - 1;
  }
  return lo;
}

/** Append one piece's text to the builder, wrapping at `frame` as needed. */
function emitPiece(
  builder: LineBuilder, piece: SourcePiece, frame: number,
): void {
  let rest = piece.text;
  while (rest.length > 0) {
    const width = measureTextAdvanceWorld(rest, piece.heightWorld, piece.style);
    if (builder.cursor + width <= frame) { builder.push(rest, width, piece); return; }

    const cut = fittingPrefixLength(rest, frame - builder.cursor, piece);
    if (cut <= 0) {
      // Nothing fits on the remainder of this line. Wrap and retry — unless the line is
      // already empty, in which case forcing at least one character avoids an infinite loop.
      if (!builder.isEmpty) { builder.flush(); continue; }
      const forced = rest.slice(0, 1);
      builder.push(forced, measureTextAdvanceWorld(forced, piece.heightWorld, piece.style), piece);
      rest = rest.slice(1);
      continue;
    }
    // Το κενό στο οποίο έσπασε η γραμμή είναι **διαχωριστικό, όχι περιεχόμενο**: μένοντας στο
    // τέλος θα φούσκωνε το πλάτος της γραμμής (άρα και το κουτί/λαβές) με αόρατο κενό, και θα
    // χαλούσε τη δεξιά/κεντρική στοίχιση. Ο διαχωριστής πέφτει και από τις δύο πλευρές.
    const head = rest.slice(0, cut).replace(/ +$/, '');
    if (head) builder.push(head, measureTextAdvanceWorld(head, piece.heightWorld, piece.style), piece);
    builder.flush();
    rest = rest.slice(cut).replace(/^ +/, '');
  }
}

/** Lay out ONE source line: tabs → stops, overflow → wrapped visual lines. */
function layoutSourceLine(
  line: SourceLine, frame: number, height: number, builder: LineBuilder,
): void {
  const stops = resolveTabStops(line.tabsEm, height);
  for (const piece of line.pieces) {
    const parts = piece.text.split('\t');
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) builder.moveTo(nextTabStop(builder.cursor, stops, height));
      if (parts[i]) emitPiece(builder, { ...piece, text: parts[i] }, frame);
    }
  }
  builder.flush();
}

// ── Public entry point ────────────────────────────────────────────────────────

/**
 * The VISUAL lines of a text block. `height` is the block height (world) and `style` the
 * entity-level font/X-scale — both supplied by the caller so this module never imports
 * `text-box.ts` (no cycle).
 *
 * An MTEXT column (`text.width`, group 41) drives the wrap. Without it — every simple TEXT
 * and every MTEXT AutoCAD wrote with `41 = 0` («auto», no column) — nothing wraps and the
 * result is byte-equivalent to the old `splitTextLines` path.
 */
export function layoutTextBlock(
  text: DxfText, height: number, style: TextAdvanceStyle,
): readonly TextLayoutLine[] {
  const node = (text as { textNode?: DxfTextNode }).textNode;
  const frame = text.width != null && text.width > 0 ? text.width : Number.POSITIVE_INFINITY;
  const sources = node?.paragraphs?.length
    ? sourceLinesFromNode(node, style, height)
    : sourceLinesFromFlat(text.text, style, height);

  const builder = new LineBuilder();
  for (const line of sources) layoutSourceLine(line, frame, height, builder);
  return builder.lines;
}

/** The plain string of each visual line — for consumers that only need the text, not spans. */
export function layoutLineStrings(
  text: DxfText, height: number, style: TextAdvanceStyle,
): string[] {
  return layoutTextBlock(text, height, style).map(l => l.spans.map(s => s.text).join(''));
}
