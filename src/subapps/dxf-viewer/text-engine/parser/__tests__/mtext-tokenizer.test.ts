/**
 * ADR-344 Phase 1 — mtext-tokenizer unit tests.
 *
 * Test fixture source: ADR-344 Appendix B (MTEXT inline code reference).
 * Each code family from the spec gets its own describe block.
 */

import { tokenizeMtext } from '../mtext-tokenizer';
import type { MtextToken } from '../mtext-tokenizer';

// ── Helpers ───────────────────────────────────────────────────────────────────

function firstToken(raw: string): MtextToken {
  return tokenizeMtext(raw)[0];
}

// ── Plain text ────────────────────────────────────────────────────────────────

describe('mtext-tokenizer — plain text', () => {
  it('returns empty array for empty string', () => {
    expect(tokenizeMtext('')).toEqual([]);
  });

  it('tokenizes plain text as single text token', () => {
    expect(tokenizeMtext('Hello World')).toEqual([{ kind: 'text', value: 'Hello World' }]);
  });

  it('splits text at group boundaries', () => {
    const tokens = tokenizeMtext('{A}B');
    expect(tokens).toEqual([
      { kind: 'groupOpen' },
      { kind: 'text', value: 'A' },
      { kind: 'groupClose' },
      { kind: 'text', value: 'B' },
    ]);
  });
});

// ── Font code \f / \F ─────────────────────────────────────────────────────────

describe('mtext-tokenizer — \\f font code', () => {
  it('parses full font spec with all attributes', () => {
    expect(firstToken('\\fArial|b1|i0|c0|p34;')).toEqual({
      kind: 'font', family: 'Arial', bold: true, italic: false, charset: 0, pitch: 34,
    });
  });

  it('parses italic font', () => {
    expect(firstToken('\\fTimes New Roman|b0|i1|c0|p0;')).toEqual({
      kind: 'font', family: 'Times New Roman', bold: false, italic: true, charset: 0, pitch: 0,
    });
  });

  it('parses font with no pipe attributes', () => {
    const tok = firstToken('\\fRomans;') as Extract<MtextToken, { kind: 'font' }>;
    expect(tok.kind).toBe('font');
    expect(tok.family).toBe('Romans');
    expect(tok.bold).toBe(false);
    expect(tok.italic).toBe(false);
  });

  it('case-insensitive: \\F works same as \\f', () => {
    const lower = firstToken('\\fArial|b1|i0|c0|p0;');
    const upper = firstToken('\\FArial|b1|i0|c0|p0;');
    expect(lower).toEqual(upper);
  });
});

// ── Height code \H ────────────────────────────────────────────────────────────

describe('mtext-tokenizer — \\H height code', () => {
  it('parses absolute height', () => {
    expect(firstToken('\\H2.5;')).toEqual({ kind: 'height', value: 2.5, relative: false });
  });

  it('parses relative height (x suffix)', () => {
    expect(firstToken('\\H3x;')).toEqual({ kind: 'height', value: 3, relative: true });
  });

  it('defaults to 1 on invalid value', () => {
    const tok = firstToken('\\Habc;') as Extract<MtextToken, { kind: 'height' }>;
    expect(tok.value).toBe(1);
  });
});

// ── Width code \W ─────────────────────────────────────────────────────────────

describe('mtext-tokenizer — \\W width code', () => {
  it('parses absolute width factor', () => {
    expect(firstToken('\\W0.8;')).toEqual({ kind: 'width', value: 0.8, relative: false });
  });

  it('parses relative width factor', () => {
    expect(firstToken('\\W0.5x;')).toEqual({ kind: 'width', value: 0.5, relative: true });
  });
});

// ── Tracking \T, Oblique \Q ───────────────────────────────────────────────────

describe('mtext-tokenizer — \\T tracking / \\Q oblique', () => {
  it('parses tracking', () => {
    expect(firstToken('\\T1.5;')).toEqual({ kind: 'tracking', value: 1.5 });
  });

  it('parses oblique angle', () => {
    expect(firstToken('\\Q15;')).toEqual({ kind: 'oblique', degrees: 15 });
  });
});

// ── Colour codes \C (ACI) and \c (true-color) ─────────────────────────────────

describe('mtext-tokenizer — colour codes', () => {
  it('\\C parses ACI index', () => {
    expect(firstToken('\\C2;')).toEqual({ kind: 'colorAci', index: 2 });
  });

  it('\\c parses true-color from integer', () => {
    // 16711680 = 0xFF0000 = red
    expect(firstToken('\\c16711680;')).toEqual({ kind: 'colorTrue', r: 255, g: 0, b: 0 });
  });

  it('\\c parses green', () => {
    // 65280 = 0x00FF00
    expect(firstToken('\\c65280;')).toEqual({ kind: 'colorTrue', r: 0, g: 255, b: 0 });
  });
});

// ── Toggle codes \L\l \O\o \K\k ──────────────────────────────────────────────

describe('mtext-tokenizer — toggle codes', () => {
  it('\\L → underlineOn', () => {
    expect(firstToken('\\L')).toEqual({ kind: 'underlineOn' });
  });
  it('\\l → underlineOff', () => {
    expect(firstToken('\\l')).toEqual({ kind: 'underlineOff' });
  });
  it('\\O → overlineOn', () => {
    expect(firstToken('\\O')).toEqual({ kind: 'overlineOn' });
  });
  it('\\o → overlineOff', () => {
    expect(firstToken('\\o')).toEqual({ kind: 'overlineOff' });
  });
  it('\\K → strikeOn', () => {
    expect(firstToken('\\K')).toEqual({ kind: 'strikeOn' });
  });
  it('\\k → strikeOff', () => {
    expect(firstToken('\\k')).toEqual({ kind: 'strikeOff' });
  });
});

// ── Paragraph / line break ────────────────────────────────────────────────────

describe('mtext-tokenizer — paragraph and line break', () => {
  it('\\P → paragraphBreak', () => {
    expect(firstToken('\\P')).toEqual({ kind: 'paragraphBreak' });
  });
  it('\\N → lineBreak', () => {
    expect(firstToken('\\N')).toEqual({ kind: 'lineBreak' });
  });
});

// ── Stack code \S ─────────────────────────────────────────────────────────────

describe('mtext-tokenizer — \\S stack code', () => {
  it('parses tolerance stack (^)', () => {
    expect(firstToken('\\S+0.1^-0.05;')).toEqual({
      kind: 'stack', top: '+0.1', bottom: '-0.05', type: 'tolerance',
    });
  });

  it('parses diagonal fraction (/)', () => {
    expect(firstToken('\\S1/2;')).toEqual({
      kind: 'stack', top: '1', bottom: '2', type: 'diagonal',
    });
  });

  it('parses horizontal fraction (#)', () => {
    expect(firstToken('\\S3#4;')).toEqual({
      kind: 'stack', top: '3', bottom: '4', type: 'horizontal',
    });
  });
});

// ── Alignment code \A ─────────────────────────────────────────────────────────

describe('mtext-tokenizer — \\A alignment', () => {
  it('\\A0; → bottom alignment', () => {
    expect(firstToken('\\A0;')).toEqual({ kind: 'alignment', value: 0 });
  });
  it('\\A1; → center alignment', () => {
    expect(firstToken('\\A1;')).toEqual({ kind: 'alignment', value: 1 });
  });
  it('\\A2; → top alignment', () => {
    expect(firstToken('\\A2;')).toEqual({ kind: 'alignment', value: 2 });
  });
});

// ── Paragraph formatting \p ───────────────────────────────────────────────────

describe('mtext-tokenizer — \\p paragraph formatting', () => {
  it('parses full paragraph spec', () => {
    expect(firstToken('\\pi1.5,l2.0,r3.0,q1,t4.0;')).toEqual({
      kind: 'paragraph',
      indent: 1.5,
      left: 2.0,
      right: 3.0,
      justification: 1,
      tabs: [4.0],
    });
  });

  it('parses minimal paragraph spec (indent only)', () => {
    const tok = firstToken('\\pi2;') as Extract<MtextToken, { kind: 'paragraph' }>;
    expect(tok.indent).toBe(2);
    expect(tok.left).toBe(0);
    expect(tok.tabs).toEqual([]);
  });
});

// ── Special characters ────────────────────────────────────────────────────────

describe('mtext-tokenizer — special characters', () => {
  it('\\~ → nonBreakSpace', () => {
    expect(firstToken('\\~')).toEqual({ kind: 'nonBreakSpace' });
  });
  it('%%c → diameter symbol', () => {
    expect(firstToken('%%c')).toEqual({ kind: 'diameter' });
  });
  it('%%d → degree symbol', () => {
    expect(firstToken('%%d')).toEqual({ kind: 'degree' });
  });
  it('%%p → plus/minus symbol', () => {
    expect(firstToken('%%p')).toEqual({ kind: 'plusMinus' });
  });
  it('%%C (uppercase) → diameter symbol', () => {
    expect(firstToken('%%C')).toEqual({ kind: 'diameter' });
  });
});

// ── Unicode code \U+XXXX ──────────────────────────────────────────────────────

describe('mtext-tokenizer — \\U+XXXX unicode', () => {
  it('parses \\U+00B2 → superscript 2 (²)', () => {
    expect(firstToken('\\U+00B2')).toEqual({ kind: 'unicode', codePoint: 0x00b2 });
  });

  it('parses \\U+03B1 → alpha (α)', () => {
    expect(firstToken('\\U+03B1')).toEqual({ kind: 'unicode', codePoint: 0x03b1 });
  });
});

// ── Multi-token sequence ──────────────────────────────────────────────────────

describe('mtext-tokenizer — sequences', () => {
  it('tokenizes bold group + following text', () => {
    const tokens = tokenizeMtext('{\\fArial|b1|i0|c0|p0;Bold}Normal');
    expect(tokens[0]).toEqual({ kind: 'groupOpen' });
    expect(tokens[1]).toEqual({ kind: 'font', family: 'Arial', bold: true, italic: false, charset: 0, pitch: 0 });
    expect(tokens[2]).toEqual({ kind: 'text', value: 'Bold' });
    expect(tokens[3]).toEqual({ kind: 'groupClose' });
    expect(tokens[4]).toEqual({ kind: 'text', value: 'Normal' });
  });

  it('tokenizes two paragraphs separated by \\P', () => {
    const tokens = tokenizeMtext('First\\PSecond');
    expect(tokens).toEqual([
      { kind: 'text', value: 'First' },
      { kind: 'paragraphBreak' },
      { kind: 'text', value: 'Second' },
    ]);
  });
});
