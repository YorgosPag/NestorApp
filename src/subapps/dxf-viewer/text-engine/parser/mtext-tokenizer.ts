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
  | { kind: 'paragraph'; indent: number; left: number; right: number; tabs: number[]; justification: number }
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
    } else {
      tokens.push(readTextRun(state));
    }
  }
  return tokens;
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

function readParagraphCode(state: TokenizerState): MtextToken {
  state.pos++; // skip 'p'
  const content = readUntilSemicolon(state);
  let indent = 0;
  let left = 0;
  let right = 0;
  let justification = 0;
  const tabs: number[] = [];
  for (const part of content.split(',')) {
    if (!part) continue;
    const key = part[0];
    const val = parseFloat(part.slice(1));
    if (isNaN(val)) continue;
    switch (key) {
      case 'i': indent = val; break;
      case 'l': left = val; break;
      case 'r': right = val; break;
      case 'q': justification = Math.floor(val); break;
      case 't': tabs.push(val); break;
    }
  }
  return { kind: 'paragraph', indent, left, right, tabs, justification };
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
