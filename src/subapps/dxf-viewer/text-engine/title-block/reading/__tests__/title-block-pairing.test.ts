/**
 * @fileoverview Ζευγάρωμα ετικέτα→τιμή — ADR-745 §2.2α / §2.3 Ε.
 *
 * Κάθε ισχυρισμός εδώ αντιστοιχεί σε πραγματικό κελί του `G753_ergasia F.dxf`. Οι δύο
 * βαρύτεροι:
 *   · το `ΕΡΓΟΔΟΤΗΣ` φέρει την τιμή του **μέσα** στο κελί (θα διαβαζόταν κενό)·
 *   · το `Τ1` είναι **πιο κοντά** στη λάθος ετικέτα από ό,τι στη σωστή.
 */

import { classifyCell, pairTitleBlockCells } from '../title-block-pairing';
import { compileProfile, GREEK_SURVEYOR_PROFILE } from '../title-block-vocabulary';
import type { TitleBlockSourceCell } from '../title-block-reading.types';
import { G753_TITLEBLOCK_ROWS } from './fixtures/g753-titleblock.fixture';

const LEFT_BLOCK = G753_TITLEBLOCK_ROWS.filter((r) => r.x < 408060);
const RIGHT_BLOCK = G753_TITLEBLOCK_ROWS.filter((r) => r.x > 408060);
const PROFILE = compileProfile(GREEK_SURVEYOR_PROFILE);

/** Το κελί-φόρμα της δεξιάς πινακίδας: «ΕΡΓΟΔΟΤΗΣ : … ΥΠΟΓΡΑΦΗ» σε ένα MTEXT. */
const RIGHT_FORM_CELL = RIGHT_BLOCK.find((r) => r.raw.includes('ΥΠΟΓΡΑΦΗ'))!;

const cellWith = (needle: string): TitleBlockSourceCell => {
  const hit = G753_TITLEBLOCK_ROWS.find((r) => r.raw.includes(needle));
  if (!hit) throw new Error(`Το fixture δεν περιέχει «${needle}»`);
  return hit;
};

const pairLeft = () => pairTitleBlockCells(LEFT_BLOCK, GREEK_SURVEYOR_PROFILE);
const fieldOf = (key: string) => pairLeft().fields.find((f) => f.key === key);

describe('ταξινόμηση κελιού — ετικέτα ή τιμή;', () => {
  it('🔴 INLINE: το ΕΡΓΟΔΟΤΗΣ φέρει την τιμή του στο ΙΔΙΟ κελί', () => {
    const [slot] = classifyCell(cellWith('ΖΕΡΒΑ'), PROFILE).slots;
    expect(slot).toMatchObject({ key: 'employer', inlineValue: 'ΖΕΡΒΑ ΓΕΩΡΓΙΑ' });
  });

  it('🔴 το «ΣΥΝΤΑΞH» με ΛΑΤΙΝΙΚΟ H αναγνωρίζεται ως ετικέτα', () => {
    // Χωρίς δίπλωμα ομόγλυφων το κελί θα ταξινομούνταν ως ΤΙΜΗ — και μια ετικέτα που
    // πέρασε για τιμή δεν αφήνει κανένα ίχνος σφάλματος, μόνο ένα παράξενο πεδίο.
    const classified = classifyCell(cellWith('ΣΥΝΤΑΞ'), PROFILE);
    expect(classified.plain.codePointAt(6)).toBe(0x0048); // το αρχείο όντως γράφει λατινικό H
    expect(classified.slots.map((s) => s.key)).toEqual(['drawnBy']);
  });

  it('🔴 «ΧΡΟΝΟΣ ΜΕΛΕΤΗΣ» = ΜΙΑ ετικέτα δύο λέξεων, όχι το «ΜΕΛΕΤΗ» παραμέσα', () => {
    const slots = classifyCell(cellWith('ΧΡΟΝΟΣ ΜΕΛΕΤΗΣ'), PROFILE).slots;
    expect(slots.map((s) => s.key)).toEqual(['studyDate']);
  });

  it('το κελί μελετητών είναι ΤΙΜΗ, παρότι περιέχει τη λέξη «ΜΕΛΕΤΕΣ»', () => {
    expect(classifyCell(cellWith('ΜΑΥΡΟΜΙΧΑΛΗΣ'), PROFILE).slots).toEqual([]);
  });

  it('🔴 ΔΥΟ ετικέτες σε ένα κελί: «ΕΡΓΟΔΟΤΗΣ … ΥΠΟΓΡΑΦΗ» της δεξιάς πινακίδας', () => {
    const slots = classifyCell(RIGHT_FORM_CELL, PROFILE).slots;
    expect(slots.map((s) => s.key)).toEqual(['employer', 'signature']);
  });

  it('🔴 οι τελείες οδηγοί μιας φόρμας ΔΕΝ είναι τιμή', () => {
    const [employer] = classifyCell(RIGHT_FORM_CELL, PROFILE).slots;
    expect(classifyCell(RIGHT_FORM_CELL, PROFILE).plain).toContain('...');
    expect(employer.inlineValue).toBe('');
  });

  it('κενή ετικέτα «ΕΡΓΟ:» δίνει κενή τιμή, όχι την άνω τελεία', () => {
    const [slot] = classifyCell(cellWith('ΕΡΓΟ\\H1.143x;:'), PROFILE).slots;
    expect(slot).toMatchObject({ key: 'projectTitle', inlineValue: '' });
  });
});

describe('ζευγάρωμα — αριστερή πινακίδα', () => {
  it('όλα τα ζεύγη του πραγματικού αρχείου, με τον τρόπο που προέκυψαν', () => {
    const actual = pairLeft()
      .fields.map((f) => [f.key, f.rawValue, f.matchedBy])
      .sort();
    expect(actual).toEqual(
      [
        ['employer', 'ΖΕΡΒΑ ΓΕΩΡΓΙΑ', 'same-cell'],
        ['scale', '1:200', 'row-alignment'],
        ['studyDate', 'ΙΟΥΛΙΟΣ 2026', 'row-alignment'],
        ['drawingType', 'ΤΟΠΟΓΡΑΦΙΚΟ ΔΙΑΓΡΑΜΜΑ', 'row-alignment'],
        ['drawingNumber', 'Τ1', 'column-alignment'],
        ['location', expect.stringContaining('ΔΗΜΟΣ ΚΟΡΔΕΛΙΟΥ'), 'row-alignment'],
        ['designers', expect.stringContaining('ΜΑΥΡΟΜΙΧΑΛΗΣ'), 'row-alignment'],
      ].sort(),
    );
  });

  it('🔴 το Τ1 πάει στο ΑΡ.ΣΧΕΔΙΟΥ, όχι στο ΜΕΛΕΤΗ που είναι ΠΙΟ ΚΟΝΤΑ', () => {
    // Δy(ΜΕΛΕΤΗ→Τ1) = 1,61 · Δy(ΑΡ.ΣΧΕΔΙΟΥ→Τ1) = 3,29. Κάθε «πλησιέστερη τιμή» χάνει εδώ.
    expect(fieldOf('drawingNumber')).toMatchObject({
      rawValue: 'Τ1',
      matchedBy: 'column-alignment',
      labelHandle: '105B',
    });
    expect(fieldOf('studyType')).toBeUndefined();
  });

  it('🔴 η στοίχιση στηλών είναι απαραίτητη — χωρίς αυτήν χάνεται ο αριθμός σχεδίου', () => {
    const numbers = pairLeft().fields.filter((f) => f.matchedBy === 'column-alignment');
    expect(numbers).toHaveLength(1);
    expect(numbers[0].key).toBe('drawingNumber');
  });

  it('🔴 το ΥΠΟΓΡΑΦΗ δεν γίνεται τιμή του ΣΥΝΤΑΞΗ, παρότι κάθεται δεξιά στο ίδιο ύψος', () => {
    // Δy = 0,24 — το πιο δελεαστικό ζεύγος της πινακίδας, και εντελώς λάθος.
    expect(fieldOf('drawnBy')).toBeUndefined();
    expect(fieldOf('signature')).toBeUndefined();
  });

  it('τα κενά κελιά του τοπογράφου μένουν κενά — δεν εφευρίσκεται τιμή', () => {
    expect(fieldOf('projectTitle')).toBeUndefined();
    expect(fieldOf('studyType')).toBeUndefined();
  });

  it('κάθε πεδίο ξέρει ΚΑΙ την ετικέτα ΚΑΙ την τιμή του — ιχνηλασιμότητα δύο άκρων', () => {
    expect(fieldOf('studyDate')).toMatchObject({ labelHandle: '105F', sourceHandle: '110E' });
    // Στο ίδιο κελί, τα δύο άκρα συμπίπτουν.
    expect(fieldOf('employer')).toMatchObject({ labelHandle: '1052', sourceHandle: '1052' });
  });

  it('καμία τιμή δεν μένει ορφανή στο πραγματικό αρχείο', () => {
    expect(pairLeft().orphanValues).toEqual([]);
  });
});

describe('ζευγάρωμα — δεξιά πινακίδα (κενή φόρμα υπογραφής)', () => {
  it('τρεις ετικέτες, καμία τιμή — και τίποτα δεν δανείζεται από την αριστερή', () => {
    const paired = pairTitleBlockCells(RIGHT_BLOCK, GREEK_SURVEYOR_PROFILE);
    expect(paired.fields).toEqual([]);
    expect(paired.orphanValues).toEqual([]);
  });
});

describe('ζευγάρωμα — συνθετικά που το πραγματικό αρχείο δεν ασκεί', () => {
  const cell = (handle: string, x: number, y: number, raw: string): TitleBlockSourceCell => ({
    handle,
    x,
    y,
    height: 1,
    raw,
  });

  it('🔴 τιμή χωρίς ετικέτα γίνεται ΟΡΦΑΝΗ — δεν εξαφανίζεται', () => {
    // Στο G753 και οι 6 τιμές βρίσκουν ετικέτα, άρα η διαδρομή της απώλειας δεν ασκείται
    // ποτέ από το πραγματικό αρχείο. Χωρίς αυτό το δείγμα ο φύλακας είναι αόρατος.
    const paired = pairTitleBlockCells(
      [cell('A1', 0, 0, 'ΚΛΙΜΑΚΑ'), cell('A2', 10, 0, '1:50'), cell('A3', 10, 40, 'ΞΕΚΡΕΜΑΣΤΟ')],
      GREEK_SURVEYOR_PROFILE,
    );
    expect(paired.fields.map((f) => f.rawValue)).toEqual(['1:50']);
    expect(paired.orphanValues.map((v) => v.plain)).toEqual(['ΞΕΚΡΕΜΑΣΤΟ']);
  });

  it('η τιμή ΑΡΙΣΤΕΡΑ της ετικέτας δεν ζευγαρώνει — η πινακίδα διαβάζεται όπως γράφεται', () => {
    const paired = pairTitleBlockCells(
      [cell('B1', 10, 0, 'ΚΛΙΜΑΚΑ'), cell('B2', 0, 0, '1:50')],
      GREEK_SURVEYOR_PROFILE,
    );
    expect(paired.fields).toEqual([]);
    expect(paired.orphanValues.map((v) => v.plain)).toEqual(['1:50']);
  });

  it('η τιμή ΠΑΝΩ από την ετικέτα δεν ζευγαρώνει ως στήλη', () => {
    const paired = pairTitleBlockCells(
      [cell('C1', 0, 0, 'ΑΡ.ΣΧΕΔΙΟΥ'), cell('C2', 0, 3, 'Τ9')],
      GREEK_SURVEYOR_PROFILE,
    );
    expect(paired.fields).toEqual([]);
  });

  it('ετικέτα με τιμή στο ίδιο κελί δεν διεκδικεί και δεύτερη από δίπλα', () => {
    const paired = pairTitleBlockCells(
      [cell('D1', 0, 0, 'ΚΛΙΜΑΚΑ: 1:50'), cell('D2', 10, 0, '1:100')],
      GREEK_SURVEYOR_PROFILE,
    );
    expect(paired.fields.map((f) => f.rawValue)).toEqual(['1:50']);
    expect(paired.orphanValues.map((v) => v.plain)).toEqual(['1:100']);
  });
});
