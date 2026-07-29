/**
 * ADR-344 Phase 1 — MTEXT inline-code tokenizer.
 *
 * Converts a raw MTEXT content string (DXF group codes 1 + 3 concatenated)
 * into a flat list of typed tokens. Interpretation is left to mtext-parser.ts.
 *
 * All codes from ADR-344 Appendix B are handled:
 *   \f/\F  \H  \W  \T  \Q  \C  \c  \L/\l  \O/\o  \K/\k
 *   \P  \N  \S  \A  \p  \~  %%c  %%d  %%p  \U+XXXX
 *
 * Case sensitivity (per AutoCAD spec):
 *   \C (ACI) vs \c (true-color) — case-sensitive.
 *   \L/\l \O/\o \K/\k — upper=on, lower=off.
 *   \P (paragraph break) vs \p (paragraph formatting) — case-sensitive.
 *   \f and \F are equivalent (case-insensitive).
 */

// ── Token types ───────────────────────────────────────────────────────────────

/**
 * Τρόπος διάστιχου παραγράφου, όπως τον γράφει το `\ps<γράμμα><τιμή>;`. Ίδιο λεξιλόγιο με το
 * `LineSpacingMode` του AST — ο tokenizer μένει ανεξάρτητος από τους τύπους του AST, οπότε η
 * αντιστοίχιση γίνεται στον parser (μία μετάφραση, ένα σημείο).
 */
export type MtextLineSpacingMode = 'multiple' | 'exact' | 'at-least';

export type MtextToken =
  | { kind: 'text'; value: string }
  | { kind: 'font'; family: string; bold: boolean; italic: boolean; charset: number; pitch: number }
  | { kind: 'height'; value: number; relative: boolean }
  | { kind: 'width'; value: number; relative: boolean }
  | { kind: 'tracking'; value: number }
  | { kind: 'oblique'; degrees: number }
  | { kind: 'colorAci'; index: number }
  | { kind: 'colorTrue'; r: number; g: number; b: number }
  | { kind: 'underlineOn' }
  | { kind: 'underlineOff' }
  | { kind: 'overlineOn' }
  | { kind: 'overlineOff' }
  | { kind: 'strikeOn' }
  | { kind: 'strikeOff' }
  | { kind: 'paragraphBreak' }
  | { kind: 'lineBreak' }
  | { kind: 'stack'; top: string; bottom: string; type: 'tolerance' | 'diagonal' | 'horizontal' }
  | { kind: 'alignment'; value: 0 | 1 | 2 }
  | {
      kind: 'paragraph';
      indent: number;
      left: number;
      right: number;
      tabs: number[];
      justification: number;
      /** `\ps…` διάστιχο παραγράφου· `null` = δεν δηλώθηκε ή `s*` (επαναφορά στην προεπιλογή). */
      lineSpacingMode: MtextLineSpacingMode | null;
      lineSpacingFactor: number | null;
    }
  | { kind: 'nonBreakSpace' }
  | { kind: 'diameter' }
  | { kind: 'degree' }
  | { kind: 'plusMinus' }
  | { kind: 'unicode'; codePoint: number }
  | { kind: 'groupOpen' }
  | { kind: 'groupClose' };

// ── Internal state ────────────────────────────────────────────────────────────

interface TokenizerState {
  readonly input: string;
  pos: number;
}

// ── Main entry point ──────────────────────────────────────────────────────────

/** Tokenize a raw MTEXT content string into a flat token list. */
export function tokenizeMtext(raw: string): MtextToken[] {
  const state: TokenizerState = { input: raw, pos: 0 };
  const tokens: MtextToken[] = [];
  while (state.pos < state.input.length) {
    const ch = state.input[state.pos];
    if (ch === '{') {
      tokens.push({ kind: 'groupOpen' });
      state.pos++;
    } else if (ch === '}') {
      tokens.push({ kind: 'groupClose' });
      state.pos++;
    } else if (ch === '\\') {
      const tok = readBackslashToken(state);
      if (tok !== null) tokens.push(tok);
    } else if (ch === '%' && state.input[state.pos + 1] === '%') {
      const tok = readPercentCode(state);
      if (tok !== null) tokens.push(tok);
    } else if (ch === '^') {
      const tok = readCaretCode(state);
      if (tok !== null) tokens.push(tok);
    } else {
      tokens.push(readTextRun(state));
    }
  }
  return tokens;
}

// ── Caret (control-character) notation ────────────────────────────────────────

/**
 * DXF **caret notation**: a control character is stored as `^` + the letter whose ASCII code
 * is `letter − 64`. AutoCAD emits `^I` for every TAB inside MTEXT — 149 of them in the sample
 * that exposed this (ADR-635 Φ C.20). Nothing recognised `^`, so the two characters flowed
 * through `readTextRun` as ordinary text and were **painted literally** («*I*I» on the canvas)
 * while every tab-aligned column collapsed.
 *
 * Only the three control codes AutoCAD actually writes are consumed, plus the documented
 * literal-caret escape `^ ` (caret + space). Anything else keeps the caret as plain text and
 * advances ONE character, so an ordinary `^` in prose is untouched and the loop cannot stall.
 */
function readCaretCode(state: TokenizerState): MtextToken | null {
  const next = state.input[state.pos + 1];
  switch (next) {
    case 'I': state.pos += 2; return { kind: 'text', value: '\t' };
    case 'J': state.pos += 2; return { kind: 'lineBreak' };
    case 'M': state.pos += 2; return null;            // CR — paired with ^J, no visual effect
    case ' ': state.pos += 2; return { kind: 'text', value: '^' }; // escaped literal caret
    default:  state.pos += 1; return { kind: 'text', value: '^' };
  }
}

// ── Backslash dispatch ────────────────────────────────────────────────────────

function readBackslashToken(state: TokenizerState): MtextToken | null {
  state.pos++; // consume backslash
  if (state.pos >= state.input.length) return null;
  const cmd = state.input[state.pos];
  switch (cmd) {
    case 'f': case 'F': return readFontCode(state);
    case 'H': return readHeightCode(state);
    case 'W': return readWidthCode(state);
    case 'T': return readTrackingCode(state);
    case 'Q': return readObliqueCode(state);
    case 'C': return readColorAciCode(state);
    case 'c': return readColorTrueCode(state);
    case 'L': state.pos++; return { kind: 'underlineOn' };
    case 'l': state.pos++; return { kind: 'underlineOff' };
    case 'O': state.pos++; return { kind: 'overlineOn' };
    case 'o': state.pos++; return { kind: 'overlineOff' };
    case 'K': state.pos++; return { kind: 'strikeOn' };
    case 'k': state.pos++; return { kind: 'strikeOff' };
    case 'P': state.pos++; return { kind: 'paragraphBreak' };
    case 'N': state.pos++; return { kind: 'lineBreak' };
    case 'S': return readStackCode(state);
    case 'A': return readAlignmentCode(state);
    case 'p': return readParagraphCode(state);
    case '~': state.pos++; return { kind: 'nonBreakSpace' };
    case 'U':
      if (state.input[state.pos + 1] === '+') return readUnicodeCode(state);
      state.pos++;
      return null;
    default:
      state.pos++;
      return null;
  }
}

// ── Individual code parsers ───────────────────────────────────────────────────

function readFontCode(state: TokenizerState): MtextToken {
  state.pos++; // skip 'f' or 'F'
  const spec = readUntilSemicolon(state);
  const parts = spec.split('|');
  const family = parts[0] ?? '';
  let bold = false;
  let italic = false;
  let charset = 0;
  let pitch = 0;
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;
    if (part.startsWith('b')) bold = part[1] === '1';
    else if (part.startsWith('i')) italic = part[1] === '1';
    else if (part.startsWith('c')) charset = parseInt(part.slice(1), 10) || 0;
    else if (part.startsWith('p')) pitch = parseInt(part.slice(1), 10) || 0;
  }
  return { kind: 'font', family, bold, italic, charset, pitch };
}

function parseRelativeScalar(raw: string): { value: number; relative: boolean } {
  const relative = raw.endsWith('x');
  const value = parseFloat(relative ? raw.slice(0, -1) : raw);
  return { value: isNaN(value) ? 1 : value, relative };
}

function readHeightCode(state: TokenizerState): MtextToken {
  state.pos++; // skip 'H'
  const { value, relative } = parseRelativeScalar(readUntilSemicolon(state));
  return { kind: 'height', value, relative };
}

function readWidthCode(state: TokenizerState): MtextToken {
  state.pos++; // skip 'W'
  const { value, relative } = parseRelativeScalar(readUntilSemicolon(state));
  return { kind: 'width', value, relative };
}

function readTrackingCode(state: TokenizerState): MtextToken {
  state.pos++; // skip 'T'
  const value = parseFloat(readUntilSemicolon(state));
  return { kind: 'tracking', value: isNaN(value) ? 1 : value };
}

function readObliqueCode(state: TokenizerState): MtextToken {
  state.pos++; // skip 'Q'
  const degrees = parseFloat(readUntilSemicolon(state));
  return { kind: 'oblique', degrees: isNaN(degrees) ? 0 : degrees };
}

function readColorAciCode(state: TokenizerState): MtextToken {
  state.pos++; // skip 'C'
  const index = parseInt(readUntilSemicolon(state), 10);
  return { kind: 'colorAci', index: isNaN(index) ? 7 : index };
}

function readColorTrueCode(state: TokenizerState): MtextToken {
  state.pos++; // skip 'c'
  const raw = parseInt(readUntilSemicolon(state), 10);
  const value = isNaN(raw) ? 0 : raw;
  return {
    kind: 'colorTrue',
    r: (value >> 16) & 0xff,
    g: (value >> 8) & 0xff,
    b: value & 0xff,
  };
}

function splitOnFirst(str: string, sep: string): [string, string] {
  const idx = str.indexOf(sep);
  if (idx < 0) return [str, ''];
  return [str.slice(0, idx), str.slice(idx + 1)];
}

function readStackCode(state: TokenizerState): MtextToken {
  state.pos++; // skip 'S'
  const content = readUntilSemicolon(state);
  let type: 'tolerance' | 'diagonal' | 'horizontal';
  let top: string;
  let bottom: string;
  if (content.includes('^')) {
    type = 'tolerance';
    [top, bottom] = splitOnFirst(content, '^');
  } else if (content.includes('/')) {
    type = 'diagonal';
    [top, bottom] = splitOnFirst(content, '/');
  } else {
    type = 'horizontal';
    [top, bottom] = splitOnFirst(content, '#');
  }
  return { kind: 'stack', top: top ?? '', bottom: bottom ?? '', type };
}

function readAlignmentCode(state: TokenizerState): MtextToken {
  state.pos++; // skip 'A'
  const raw = parseInt(readUntilSemicolon(state), 10);
  const value = raw === 0 || raw === 1 || raw === 2 ? raw : 0;
  return { kind: 'alignment', value };
}

/** `\pq` justification given as a LETTER: left / centre / right / justified / distributed. */
const PARAGRAPH_JUSTIFICATION_LETTERS: Readonly<Record<string, number>> = {
  l: 0, c: 1, r: 2, j: 3, d: 3,
};

/**
 * `\p…;` paragraph properties.
 *
 * 🐛 ADR-635 Φ C.20 — ΗΤΑΝ ΣΧΕΔΟΝ ΟΛΟΚΛΗΡΟΣ ΝΕΚΡΟΣ ΣΕ ΠΡΑΓΜΑΤΙΚΑ ΑΡΧΕΙΑ. Δύο λόγοι:
 *   1. **Το πρόθεμα `x`.** Το AutoCAD γράφει `\pxqc;`, `\pxi-3,l3,sm1.5,t3;`. Το `x` έμπαινε ως
 *      «κλειδί» του πρώτου πεδίου και το `parseFloat('qc')`/`parseFloat('i-3')` έβγαζε NaN ⇒ το
 *      **πρώτο** πεδίο κάθε τέτοιου κωδικού πεταγόταν σιωπηλά.
 *   2. **Γραμματικές τιμές.** Το `q` παίρνει γράμμα (`qc` = κεντραρισμένη, `qj` = πλήρης
 *      στοίχιση), όχι αριθμό· ο αριθμητικός-μόνο αναγνώστης τα αγνοούσε όλα.
 * Μετρημένο στο δείγμα: **36 κωδικοί `\p`**, από τους οποίους διαβαζόταν σωστά **ένα** πεδίο.
 *
 * Τα tab stops είναι **πολλαπλάσια του ύψους χαρακτήρα** (ezdxf, MTEXT internals) — η μετατροπή
 * σε μονάδες σχεδίου γίνεται στη διάταξη, όχι εδώ, ώστε το AST να μένει ανεξάρτητο κλίμακας.
 * Οι τρεις τύποι στάσης (`t` αριστερή, `r` δεξιά, `c` κεντρική — π.χ. `\pxt1,r5,c8`) κρατούνται
 * όλοι ως ΘΕΣΕΙΣ· η δεξιά/κεντρική **προσαρμογή** δεν υλοποιείται ακόμη (η θέση είναι σωστή,
 * η στοίχιση πάνω της είναι αριστερή).
 *
 * Το `s` είναι το **διάστιχο παραγράφου**: `\psm1;` πολλαπλάσιο 1,0 · `\psm0.9;` 0,9 ·
 * `\pse2;` ακριβώς 2 · `\psa1.5;` «τουλάχιστον» 1,5 · `\ps*;` επαναφορά στην προεπιλογή.
 * Μετρημένο στο δείγμα: **28 κωδικοί `s`** (12×`sm1`, 10×`sm0.9`, 4×`s*`, 2×`sm1`) που μέχρι το
 * Φ C.20 πέφτονταν σιωπηλά στο `if (isNaN(val)) continue` — το `parseFloat('m1')` είναι NaN.
 * Πηγή γραμμάτων: CAD Forum «Text formatting codes in MText objects» («se» line spacing exactly,
 * «sm» line spacing multiples)· η μονάδα του πολλαπλασιαστή είναι το μονό διάστιχο του AutoCAD
 * (= 5/3 × ύψος χαρακτήρα, DXF κωδ. 44 «3-on-5»), που ζει στο `CHARACTER_METRICS`.
 */
function readParagraphCode(state: TokenizerState): MtextToken {
  state.pos++; // skip 'p'
  const raw = readUntilSemicolon(state);
  // Το ηγετικό `x` σημαίνει «ακολουθούν ιδιότητες παραγράφου» — δεν είναι ιδιότητα το ίδιο.
  const content = raw.startsWith('x') ? raw.slice(1) : raw;
  const acc: ParagraphAccumulator = {
    indent: 0, left: 0, right: 0, tabs: [], justification: 0,
    lineSpacingMode: null, lineSpacingFactor: null, inTabList: false,
  };
  for (const part of content.split(',')) if (part) applyParagraphField(acc, part);
  const { inTabList: _drop, ...token } = acc;
  return { kind: 'paragraph', ...token };
}

/** Τα πεδία ενός `\p…;` καθώς συλλέγονται (το `inTabList` είναι κατάσταση, όχι αποτέλεσμα). */
interface ParagraphAccumulator {
  indent: number;
  left: number;
  right: number;
  tabs: number[];
  justification: number;
  lineSpacingMode: MtextLineSpacingMode | null;
  lineSpacingFactor: number | null;
  inTabList: boolean;
}

/** `\ps` τρόπος διάστιχου: το γράμμα ΜΕΤΑ το `s`. `*` = επαναφορά (καμία δήλωση). */
const LINE_SPACING_MODE_LETTERS: Readonly<Record<string, MtextLineSpacingMode>> = {
  m: 'multiple', e: 'exact', a: 'at-least',
};

/** Ένα πεδίο `κλειδί+τιμή` του `\p…;` πάνω στον συσσωρευτή. */
function applyParagraphField(acc: ParagraphAccumulator, part: string): void {
  const key = part[0];
  const rest = part.slice(1);
  if (key === 'q') {
    // `q*` = επαναφορά στην προεπιλογή· γράμμα ή αριθμός αλλιώς.
    const numeric = parseFloat(rest);
    acc.justification =
      PARAGRAPH_JUSTIFICATION_LETTERS[rest] ?? (isNaN(numeric) ? 0 : Math.floor(numeric));
    return;
  }
  if (key === 's') {
    const mode = LINE_SPACING_MODE_LETTERS[rest[0]];
    const factor = parseFloat(rest.slice(1));
    // `s*` (ή οτιδήποτε μη αναγνωρίσιμο) = επαναφορά: αφήνει `null`, ώστε ο parser να ξέρει τη
    // διαφορά «γύρνα στην προεπιλογή» από «κράτα ό,τι ίσχυε».
    acc.lineSpacingMode = mode ?? null;
    acc.lineSpacingFactor = mode && isFinite(factor) && factor > 0 ? factor : null;
    return;
  }
  const val = parseFloat(rest);
  if (isNaN(val)) return;
  switch (key) {
    case 'i': acc.indent = val; break;
    case 'l': acc.left = val; break;
    case 't': acc.tabs.push(val); acc.inTabList = true; break;
    // Μόλις ανοίξει η λίστα στάσεων, τα `r`/`c` είναι δεξιά/κεντρική ΣΤΑΣΗ (`t1,r5,c8`)·
    // πριν από αυτήν, το `r` είναι το δεξί περιθώριο της παραγράφου.
    case 'c': if (acc.inTabList) acc.tabs.push(val); break;
    case 'r': if (acc.inTabList) acc.tabs.push(val); else acc.right = val; break;
  }
}

function readUnicodeCode(state: TokenizerState): MtextToken {
  state.pos++; // skip 'U'
  state.pos++; // skip '+'
  const hex = state.input.slice(state.pos, state.pos + 4);
  state.pos += 4;
  const codePoint = parseInt(hex, 16);
  return { kind: 'unicode', codePoint: isNaN(codePoint) ? 0xfffd : codePoint };
}

function readPercentCode(state: TokenizerState): MtextToken | null {
  const code = state.input[state.pos + 2]?.toLowerCase();
  if (code === 'c') { state.pos += 3; return { kind: 'diameter' }; }
  if (code === 'd') { state.pos += 3; return { kind: 'degree' }; }
  if (code === 'p') { state.pos += 3; return { kind: 'plusMinus' }; }
  state.pos++;
  return null;
}

// ── Text accumulation ─────────────────────────────────────────────────────────

function readTextRun(state: TokenizerState): MtextToken {
  const start = state.pos;
  while (state.pos < state.input.length) {
    const ch = state.input[state.pos];
    const stop =
      ch === '\\' ||
      ch === '{' ||
      ch === '}' ||
      // ADR-635 Φ C.20 — caret notation (`^I` tab κ.λπ.)· χωρίς αυτό το stop, το run θα
      // κατάπινε το `^` και ο `readCaretCode` δεν θα καλούνταν ΠΟΤΕ.
      ch === '^' ||
      (ch === '%' && state.input[state.pos + 1] === '%');
    if (stop) break;
    state.pos++;
  }
  return { kind: 'text', value: state.input.slice(start, state.pos) };
}

// ── Utility ───────────────────────────────────────────────────────────────────

function readUntilSemicolon(state: TokenizerState): string {
  const start = state.pos;
  while (state.pos < state.input.length && state.input[state.pos] !== ';') {
    state.pos++;
  }
  const result = state.input.slice(start, state.pos);
  if (state.pos < state.input.length) state.pos++; // consume ';'
  return result;
}
