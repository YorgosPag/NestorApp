/**
 * ADR-557 Φ-attachment — scaleTextNodeRunHeights (durable text-height write).
 *
 * A text-grip resize must scale the textNode run heights (the SSoT `resolveTextHeight`
 * reads FIRST) — a flat `height` write alone is shadowed. Covers proportional scaling,
 * multi-run preservation, height-less/stack runs, and no-op ratios.
 */

import type { DxfTextNode } from '../../text-engine/types';
import { tokenizeMtext } from '../../text-engine/parser/mtext-tokenizer';
import { parseMtext } from '../../text-engine/parser/mtext-parser';
import { extractFlatText, resolveEntityText, scaleTextNodeRunHeights } from '../text-node-utils';

const node = (runs: Array<Record<string, unknown>>): DxfTextNode =>
  ({ paragraphs: [{ runs }], attachment: 'TL' }) as unknown as DxfTextNode;

const runHeights = (n: DxfTextNode): Array<number | undefined> =>
  (n.paragraphs[0].runs as Array<{ style?: { height?: number } }>).map((r) => r.style?.height);

describe('scaleTextNodeRunHeights', () => {
  it('scales every run height by the ratio (proportional)', () => {
    const out = scaleTextNodeRunHeights(node([{ text: 'A', style: { height: 100 } }]), 2.5);
    expect(runHeights(out)).toEqual([250]);
  });

  it('preserves RELATIVE heights across multiple runs', () => {
    const out = scaleTextNodeRunHeights(
      node([{ text: 'A', style: { height: 100 } }, { text: 'b', style: { height: 50 } }]),
      1.5,
    );
    expect(runHeights(out)).toEqual([150, 75]);
  });

  it('leaves height-less runs and TextStack items untouched', () => {
    const out = scaleTextNodeRunHeights(
      node([{ text: 'A', style: {} }, { top: [], bottom: [] }]),
      2,
    );
    expect(runHeights(out)).toEqual([undefined, undefined]);
  });

  it('is a no-op (same reference) for ratio 1 or non-positive', () => {
    const n = node([{ text: 'A', style: { height: 100 } }]);
    expect(scaleTextNodeRunHeights(n, 1)).toBe(n);
    expect(scaleTextNodeRunHeights(n, 0)).toBe(n);
    expect(scaleTextNodeRunHeights(n, -3)).toBe(n);
  });

  it('does not mutate the input node (returns a fresh clone)', () => {
    const n = node([{ text: 'A', style: { height: 100 } }]);
    scaleTextNodeRunHeights(n, 3);
    expect(runHeights(n)).toEqual([100]);
  });
});

/**
 * ΒΛΑΒΗ Γ — η `extractFlatText` έκανε `.filter(r => !('top' in r))`, δηλαδή **πετούσε κάθε
 * TextStack**. Μετρημένο στο `47_ergasia.dxf`: `Ε\H0.7x;\S^ τίτλου;\H1.4286x;=231.04τ.μ.`
 * κατέληγε «Ε=231.04τ.μ.» — ο δείκτης «τίτλου» εξαφανιζόταν (ίδιο για «καταμέτρησης» + 3 εμβαδά).
 *
 * Πρακτική ezdxf (`fast_plain_mtext`): το περιεχόμενο του `\S…;` **δεν πετιέται ΠΟΤΕ** — μαζεύονται
 * όλοι οι χαρακτήρες μαζί με τον διαχωριστή. Ο διαχωριστής εδώ είναι ο ΙΔΙΟΣ που γράφει ο
 * serializer (`^` / `/` / `#`), ώστε flat προβολή και export να μη λένε διαφορετικά πράγματα.
 */
describe('extractFlatText — ΒΛΑΒΗ Γ: οι στοίβες `\\S` δεν χάνονται', () => {
  const parse = (raw: string): DxfTextNode => parseMtext(tokenizeMtext(raw));

  it('ΜΕΤΡΗΜΕΝΟ (47_ergasia.dxf): κρατά τον δείκτη «τίτλου»', () => {
    const flat = extractFlatText(parse('Ε\\H0.7x;\\S^ τίτλου;\\H1.4286x;=231.04τ.μ.'));
    expect(flat).toContain('τίτλου');
    expect(flat).toBe('Ε^ τίτλου=231.04τ.μ.');
  });

  it.each([
    ['diagonal', '\\S1/2;', '1/2'],
    ['tolerance', '\\S+0.1^-0.05;', '+0.1^-0.05'],
    ['horizontal', '\\S3#4;', '3#4'],
  ] as const)('%s — ο διαχωριστής είναι ο ίδιος με του serializer', (_l, raw, expected) => {
    expect(extractFlatText(parse(raw))).toBe(expected);
  });

  it('η στοίβα μένει στη ΘΕΣΗ της μέσα στη γραμμή', () => {
    expect(extractFlatText(parse('a\\S1/2;b'))).toBe('a1/2b');
  });

  it('συνεχίζει να ενώνει τις παραγράφους με \\n', () => {
    expect(extractFlatText(parse('a\\S1/2;\\Pb'))).toBe('a1/2\nb');
  });

  it('ανέχεται ημιτελείς στοίβες (χωρίς `type`) χωρίς να ρίχνει', () => {
    expect(extractFlatText(node([{ top: 'x', bottom: 'y' }]))).toBe('x#y');
  });

  it('resolveEntityText: το AST νικά τον flat καθρέφτη και φέρνει τη στοίβα', () => {
    expect(resolveEntityText({ textNode: parse('Ε\\S^ δείκτης;'), text: 'Ε' }))
      .toBe('Ε^ δείκτης');
  });
});
