/**
 * DXF MTEXT import↔export round-trip — ADR-635 Φ4 (closes ADR-636 Φ2.3 double-escape)
 * + ADR-636 Φ2.4 (D.7): το εισαγόμενο MTEXT ΔΕΝ υποβαθμίζεται πλέον σε μονογραμμικό TEXT.
 *
 * ⚠️ ΓΙΑΤΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΞΑΝΑΓΡΑΦΤΗΚΕ (ADR-636 Φ2.4 D.7): μέχρι σήμερα κάθε test εδώ περνούσε το
 * output του `convertMText` από έναν helper `asMText()` που το **ξανα-ταγκάριζε χειροκίνητα** σε
 * `type:'mtext'` πριν το δώσει στον writer. Ο importer όμως ΠΟΤΕ δεν παράγει `type:'mtext'`
 * (`buildTextSceneEntity` → σκληρά `type:'text'`), άρα η σουίτα πιστοποιούσε ένα μονοπάτι που **δεν
 * εκτελείται στην παραγωγή** — πράσινο test πάνω σε νεκρό δίδυμο = μηδενική κάλυψη. Μετρημένο:
 * πηγή 89 MTEXT → export 0 MTEXT / +70 TEXT. **ΜΗΝ ξαναβάλεις re-tag helper**: ο writer πρέπει να
 * τρέχει στο ΩΜΟ output του `convertMText`, αλλιώς το regression guard εξαφανίζεται ξανά.
 *
 * Η Φ4 έκανε το `convertMText` να τροφοδοτεί τον ADR-344 parser SSoT ώστε το εισαγόμενο `textNode`
 * να είναι πραγματικό multi-paragraph/run AST χωρίς ωμούς inline codes. Η σουίτα καρφώνει το ΠΛΗΡΕΣ
 * loop μέσα από τον production writer (`writeDxfAscii` → `emitMText` → `serializeDxfTextNode`).
 */
import { describe, it, expect } from '@jest/globals';
import { writeDxfAscii } from '../dxf-ascii-writer';
import { convertMText, convertText } from '../../../utils/dxf-text-converters';
import type { Entity } from '../../../types/entities';
import type { AnySceneEntity } from '../../../types/scene';
import type { DxfTextNode } from '../../../text-engine/types';

const LAYERS = { L: { name: 'TXT' } };

/** Flat `data` Record of the first `<TYPE>` entity block (header codes to the next `0`). */
function extractEntity(dxf: string, type: string): Record<string, string> | null {
  const t = dxf.split('\n');
  let start = -1;
  for (let i = 0; i < t.length - 1; i += 2) {
    if (t[i] === '0' && t[i + 1] === type) { start = i + 2; break; }
  }
  if (start < 0) return null;
  const data: Record<string, string> = {};
  for (let i = start; i < t.length - 1; i += 2) {
    if (t[i] === '0') break;
    data[t[i]] = t[i + 1];
  }
  return data;
}

/** Minimal MTEXT `data` map (flat Record, as the parser produces). */
function mtextData(content: string, extra: Record<string, string> = {}): Record<string, string> {
  return { '10': '100', '20': '50', '40': '2.5', '1': content, ...extra };
}

/**
 * The imported entity handed to the writer **AS IS** — no re-tag, no mutation. The scene type is
 * `AnySceneEntity` and the writer's is `Entity` (two overlapping unions), hence the structural cast.
 */
function asEntity(imported: AnySceneEntity): Entity {
  return imported as unknown as Entity;
}

function nodeOf(e: AnySceneEntity): DxfTextNode {
  return (e as unknown as { textNode: DxfTextNode }).textNode;
}

describe('MTEXT round-trip through emitMText (ADR-635 Φ4 / ADR-636 Φ2.4 D.7)', () => {
  it('εισαγόμενο MTEXT εξάγεται ως NATIVE MTEXT — ΟΧΙ υποβαθμισμένο TEXT', () => {
    const imported = convertMText(mtextData('Line1\\PLine2'), 'L', 0)!;
    // Ο importer κρατά `type:'text'` (15+ registries έχουν ασύμμετρη κάλυψη για 'mtext' — ADR-636
    // Φ2.4 D.7)· η ταυτότητα προέλευσης ταξιδεύει στο `dxfSourceType`, ίδιο ιδίωμα με το HATCH.
    expect((imported as unknown as { type: string }).type).toBe('text');
    expect((imported as unknown as { dxfSourceType?: string }).dxfSourceType).toBe('mtext');

    const dxf = writeDxfAscii([asEntity(imported)], { layersById: LAYERS });
    expect(dxf).toContain('0\nMTEXT\n');
    expect(dxf).not.toContain('0\nTEXT\n');
  });

  it('emits `\\P` cleanly (no `\\\\P`) and re-imports the two paragraphs identically', () => {
    const imported = convertMText(mtextData('Line1\\PLine2'), 'L', 0)!;
    const dxf = writeDxfAscii([asEntity(imported)], { layersById: LAYERS });

    const data = extractEntity(dxf, 'MTEXT')!;
    expect(data['1']).toContain('\\P');       // real paragraph break survived the writer
    expect(data['1']).not.toContain('\\\\P'); // NOT double-escaped

    const reimported = convertMText(data, 'L', 1)!;
    expect(nodeOf(reimported).paragraphs).toHaveLength(2);
    expect((reimported as unknown as { text: string }).text).toBe('Line1\nLine2');
  });

  it('re-exports an inline-height MTEXT with NO double-escaped backslash (no residual literal codes)', () => {
    // If the parser had left `\H5;` as literal run text, serializeDxfTextNode would escape its
    // backslash → `\\` in group-1. A clean AST re-emits a single-backslash `\H` code.
    const imported = convertMText(mtextData('small\\H5;big'), 'L', 0)!;
    const dxf = writeDxfAscii([asEntity(imported)], { layersById: LAYERS });

    const data = extractEntity(dxf, 'MTEXT')!;
    expect(data['1']).not.toContain('\\\\'); // no double-escape anywhere in the content
  });

  it('preserves attachment (code 71) and rotation (code 50) across the writer', () => {
    const imported = convertMText(mtextData('X', { '71': '5', '50': '90' }), 'L', 0)!;
    const dxf = writeDxfAscii([asEntity(imported)], { layersById: LAYERS });

    const data = extractEntity(dxf, 'MTEXT')!;
    expect(data['71']).toBe('5'); // MC attachment round-trips
    expect(parseFloat(data['50'])).toBe(90);
  });

  it('διατηρεί ύψος (40), πλάτος στήλης (41) και text style (7)', () => {
    // 41 = reference-rectangle width: ΤΟ πεδίο που χάνεται ολοσχερώς στο μονογραμμικό TEXT
    // (καμία αναδίπλωση ⇒ οι παράγραφοι τρέχουν σε μία ατέρμονη γραμμή έξω από το σχέδιο).
    const imported = convertMText(mtextData('wrapped paragraph', { '41': '30' }), 'L', 0)!;
    const dxf = writeDxfAscii([asEntity(imported)], { layersById: LAYERS });

    const data = extractEntity(dxf, 'MTEXT')!;
    expect(parseFloat(data['40'])).toBe(2.5);
    expect(parseFloat(data['41'])).toBe(30);
    expect(data['7']).toBe('STANDARD');
  });

  it('πλήρες round-trip: παράγραφοι + ανά-run ύψος επιβιώνουν της επανεισαγωγής', () => {
    const imported = convertMText(mtextData('alpha\\PbetaA\\H5;betaB', { '41': '30', '71': '5' }), 'L', 0)!;
    const dxf = writeDxfAscii([asEntity(imported)], { layersById: LAYERS });

    const data = extractEntity(dxf, 'MTEXT')!;
    const reimported = convertMText(data, 'L', 1)!;
    const before = nodeOf(imported);
    const after = nodeOf(reimported);

    expect(after.paragraphs).toHaveLength(before.paragraphs.length);
    expect(after.attachment).toBe(before.attachment);
    expect((reimported as unknown as { text: string }).text)
      .toBe((imported as unknown as { text: string }).text);
    expect((reimported as unknown as { width?: number }).width).toBe(30);
    // ανά-run μορφοποίηση (το `\H5;` της 2ης παραγράφου) επιβιώνει ως 2 runs με διαφορετικό ύψος
    const runsAfter = after.paragraphs[1].runs;
    expect(runsAfter.length).toBeGreaterThan(1);
  });

  it('ΑΡΝΗΤΙΚΟ: απλό TEXT (convertText) εξακολουθεί να βγαίνει ως TEXT — zero regression', () => {
    const imported = convertText({ '10': '0', '20': '0', '40': '2.5', '1': 'plain' }, 'L', 0)!;
    expect((imported as unknown as { dxfSourceType?: string }).dxfSourceType).toBeUndefined();

    const dxf = writeDxfAscii([asEntity(imported)], { layersById: LAYERS });
    expect(dxf).toContain('0\nTEXT\n');
    expect(dxf).not.toContain('0\nMTEXT\n');
  });

  it('explode (Τέκτονας): εισαγόμενο MTEXT μένει TEXT — ο minimal parser του διαβάζει μόνο TEXT', () => {
    const imported = convertMText(mtextData('Line1\\PLine2'), 'L', 0)!;
    const dxf = writeDxfAscii([asEntity(imported)], { layersById: LAYERS, lineMode: 'lines' });
    expect(dxf).toContain('0\nTEXT\n');
    expect(dxf).not.toContain('0\nMTEXT\n');
  });
});
