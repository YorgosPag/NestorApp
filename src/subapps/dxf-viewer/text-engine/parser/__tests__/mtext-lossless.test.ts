/**
 * ADR-344 — MTEXT lossless-import contract (ΒΛΑΒΕΣ Δ + Ε).
 *
 * Δύο αποδεδειγμένες απώλειες πληροφορίας στο `47_ergasia.dxf` (89 MTEXT):
 *
 *   ΒΛΑΒΗ Δ — `\A#;` (κατακόρυφη στοίχιση χαρακτήρα). Ο tokenizer παρήγαγε σωστά
 *     `{ kind: 'alignment' }`, αλλά η `applyStyleToken` **δεν είχε case** → σιωπηλή
 *     απόρριψη. Μετρημένο: **49 εμφανίσεις** στο δείγμα, όλες χαμένες.
 *
 *   ΒΛΑΒΗ Ε — `\\`, `\{`, `\}` (escaped literals). Το `default:` του
 *     `readBackslashToken` έκανε `pos++; return null;` → ο χαρακτήρας **εξαφανιζόταν**.
 *     Είναι **ασυμμετρία στο ΔΙΚΟ μας round-trip**: η `escapeText()` του serializer ήδη
 *     παράγει `\\`/`\{`/`\}`, άρα ό,τι εξάγαμε και ξαναεισάγαμε έχανε χαρακτήρες.
 *
 * Ο κανόνας (Autodesk spec + ezdxf `plain_mtext`): `\\`→`\`, `\{`→`{`, `\}`→`}`.
 */

import { tokenizeMtext } from '../mtext-tokenizer';
import type { MtextToken } from '../mtext-tokenizer';
import { parseMtext } from '../mtext-parser';
import { serializeDxfTextNode } from '../../serializer/mtext-serializer';
import { DxfDocumentVersion } from '../../types/text-toolbar.types';
import type { DxfTextNode, TextRun } from '../../types/text-ast.types';
import { extractFlatText } from '../../../utils/text-node-utils';

// ── Helpers ───────────────────────────────────────────────────────────────────

function parse(raw: string): DxfTextNode {
  return parseMtext(tokenizeMtext(raw));
}

function firstRun(node: DxfTextNode): TextRun {
  return node.paragraphs[0].runs[0] as TextRun;
}

/** parse → serialize, στην πιο πρόσφατη έκδοση (πλήρεις inline κωδικοί). */
function roundTrip(raw: string): string {
  return serializeDxfTextNode(parse(raw), { version: DxfDocumentVersion.R2018 }).content;
}

function textTokens(raw: string): string[] {
  return tokenizeMtext(raw)
    .filter((t: MtextToken): t is Extract<MtextToken, { kind: 'text' }> => t.kind === 'text')
    .map((t) => t.value);
}

// ── ΒΛΑΒΗ Ε — escaped literals ────────────────────────────────────────────────

describe('ΒΛΑΒΗ Ε — mtext-tokenizer κρατά τα escaped literals \\\\ \\{ \\}', () => {
  it('\\\\ → literal backslash', () => {
    expect(textTokens('A\\\\B')).toEqual(['A', '\\', 'B']);
  });

  it('\\{ και \\} → literal άγκιστρα (ΟΧΙ groupOpen/groupClose)', () => {
    expect(tokenizeMtext('\\{A\\}')).toEqual([
      { kind: 'text', value: '{' },
      { kind: 'text', value: 'A' },
      { kind: 'text', value: '}' },
    ]);
  });

  it('το AST φέρει τους χαρακτήρες αυτούσιους', () => {
    expect(firstRun(parse('C:\\\\Temp\\\\a\\{1\\}')).text).toBe('C:\\Temp\\a{1}');
  });

  it('ένα σκέτο `{`/`}` παραμένει ομαδοποίηση (δεν αλλάζει η υπάρχουσα σημασία)', () => {
    expect(tokenizeMtext('{A}')).toEqual([
      { kind: 'groupOpen' },
      { kind: 'text', value: 'A' },
      { kind: 'groupClose' },
    ]);
  });
});

// ── ΒΛΑΒΗ Δ — \A κατακόρυφη στοίχιση ──────────────────────────────────────────

describe('ΒΛΑΒΗ Δ — το `\\A#;` διατηρείται στο AST', () => {
  it.each([
    ['\\A0;bottom', 0],
    ['\\A1;center', 1],
    ['\\A2;top', 2],
  ] as const)('%s → style.verticalAlign = %i', (raw, expected) => {
    expect(firstRun(parse(raw)).style.verticalAlign).toBe(expected);
  });

  it('χωρίς `\\A` δεν εφευρίσκεται τιμή (undefined = προεπιλογή 0)', () => {
    expect(firstRun(parse('plain')).style.verticalAlign).toBeUndefined();
  });

  it('ισχύει μόνο για τα ΕΠΟΜΕΝΑ runs, όπως κάθε state-change κωδικός', () => {
    const node = parse('a\\A2;b');
    const runs = node.paragraphs[0].runs as TextRun[];
    expect(runs.map((r) => [r.text, r.style.verticalAlign])).toEqual([
      ['a', undefined],
      ['b', 2],
    ]);
  });

  it('περιορίζεται στο πεδίο ενός group {…}', () => {
    const runs = parse('{\\A2;up}down').paragraphs[0].runs as TextRun[];
    expect(runs.map((r) => [r.text, r.style.verticalAlign])).toEqual([
      ['up', 2],
      ['down', undefined],
    ]);
  });
});

// ── Συμμετρία tokenizer ↔ serializer ──────────────────────────────────────────

describe('MTEXT round-trip — serialize(parse(x)) διατηρεί την πληροφορία', () => {
  it.each([
    ['escaped backslash', 'A\\\\B'],
    ['escaped braces', '\\{A\\}'],
    ['alignment top', '\\A2;X'],
    ['alignment centre', '\\A1;X'],
    ['stack diagonal', '\\S1/2;'],
    ['stack tolerance', '\\S+0.1^-0.05;'],
    ['stack horizontal', '\\S3#4;'],
  ] as const)('%s — «%s» ξαναγράφεται αυτούσιο', (_label, raw) => {
    expect(roundTrip(raw)).toBe(raw);
  });

  it('`\\A0;` είναι η προεπιλογή — δεν εκπέμπεται περιττός κωδικός', () => {
    expect(roundTrip('\\A0;X')).toBe('X');
  });

  it('idempotent: το δεύτερο πέρασμα δίνει το ίδιο string', () => {
    const once = roundTrip('\\A1;a\\\\b\\{c\\}\\S1/2;');
    expect(roundTrip(once)).toBe(once);
  });

  it('το flat κείμενο του re-import ισούται με του πρώτου import', () => {
    const raw = '\\A1;a\\\\b\\{c\\}\\S1/2;';
    expect(extractFlatText(parse(roundTrip(raw)))).toBe(extractFlatText(parse(raw)));
  });
});
