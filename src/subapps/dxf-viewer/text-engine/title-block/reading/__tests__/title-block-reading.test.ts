/**
 * @fileoverview Λ1 άκρη-σε-άκρη: το layer `PINAKAKI 500` του πραγματικού αρχείου,
 * όπως θα το παραδώσει η εισαγωγή, μέχρι το `TitleBlockReading[]`.
 *
 * Αυτή η σουίτα είναι η μόνη που βλέπει το αποτέλεσμα **ως σύνολο** — και το σύνολο είναι
 * που κρίνεται: μια πινακίδα με σωστά επιμέρους βήματα αλλά ανακατεμένες ομάδες παράγει
 * απολύτως εύλογα, απολύτως λάθος δεδομένα.
 */

import { readTitleBlocks } from '../title-block-reading';
import type { TitleBlockSourceCell } from '../title-block-reading.types';
import { G753_TITLEBLOCK_ROWS } from './fixtures/g753-titleblock.fixture';

const LAYER = 'PINAKAKI 500';
const readAll = () => readTitleBlocks(LAYER, G753_TITLEBLOCK_ROWS);
const left = () => readAll()[0];
const valueOf = (key: string) => left().fields.find((f) => f.key === key)?.rawValue;

describe('Λ1 — ανάγνωση του layer PINAKAKI 500', () => {
  it('🔴 δίνει ΔΥΟ αναγνώσεις, όχι μία ανακατεμένη', () => {
    expect(readAll()).toHaveLength(2);
    expect(readAll().every((r) => r.layerName === LAYER)).toBe(true);
  });

  it('η αριστερή πινακίδα δίνει τα επτά συμπληρωμένα πεδία του τοπογράφου', () => {
    expect(
      Object.fromEntries(left().fields.map((f) => [f.key, f.rawValue])),
    ).toEqual({
      employer: 'ΖΕΡΒΑ ΓΕΩΡΓΙΑ',
      location: expect.stringContaining('ΔΗΜΟΣ ΚΟΡΔΕΛΙΟΥ ΕΥΟΣΜΟΥ'),
      designers: expect.stringContaining('ΜΑΥΡΟΜΙΧΑΛΗΣ ΚΩΝ/ΝΟΣ'),
      drawingType: 'ΤΟΠΟΓΡΑΦΙΚΟ ΔΙΑΓΡΑΜΜΑ',
      drawingNumber: 'Τ1',
      scale: '1:200',
      studyDate: 'ΙΟΥΛΙΟΣ 2026',
    });
  });

  it('🔴 τα κομμάτια που το αρχείο σπάει έχουν ξαναενωθεί μέσα στις τιμές', () => {
    // «Π.Ε. 3»+«9», «Ο.Τ. Γ»+« 753», «1»+«:2»+«00» (ADR-745 §2.3 Παγίδα Α).
    expect(valueOf('location')).toContain('Π.Ε. 39');
    expect(valueOf('location')).toContain('Ο.Τ. Γ 753');
    expect(valueOf('scale')).toBe('1:200');
  });

  it('🔴 τα δύο πρόσωπα βγαίνουν από το κελί, με τις ειδικότητές τους', () => {
    expect(left().people.map((p) => p.displayName)).toEqual([
      'ΜΑΥΡΟΜΙΧΑΛΗΣ ΚΩΝ/ΝΟΣ',
      'ΝΙΚΟΛΑΟΥ ΕΥ. ΙΩΑΝΝΗΣ',
    ]);
    expect(left().people[0].professionText).toBe('ΑΓΡΟΝΟΜΟΣ ΤΟΠΟΓΡΑΦΟΣ ΜΗΧΑΝΙΚΟΣ Α.Π.Θ.');
  });

  it('🔴 ό,τι δεν αναγνωρίστηκε είναι ΟΡΑΤΟ', () => {
    expect(left().unparsed).toEqual(['ΤΟΠΟΓΡΑΦΙΚΕΣ ΜΕΛΕΤΕΣ - ΕΦΑΡΜΟΓΕΣ']);
  });

  it('🔴 η δεξιά πινακίδα είναι ΚΕΝΗ φόρμα — και δεν δανείζεται τίποτα από την αριστερή', () => {
    const right = readAll()[1];
    expect(right.fields).toEqual([]);
    expect(right.people).toEqual([]);
    // Το «ΖΕΡΒΑ ΓΕΩΡΓΙΑ» ανήκει ΜΟΝΟ στην αριστερή· χωρίς ομαδοποίηση θα εμφανιζόταν
    // και στις δύο, και η δεύτερη εγγραφή θα έμοιαζε απόλυτα εύλογη.
    expect(JSON.stringify(right)).not.toContain('ΖΕΡΒΑ');
  });

  it('το περίγραμμα κάθε πινακίδας περιέχει μόνο τα δικά της κελιά', () => {
    const [leftBlock, rightBlock] = readAll();
    expect(leftBlock.bbox.maxX).toBeLessThan(rightBlock.bbox.minX);
    expect(leftBlock.bbox.minX).toBeCloseTo(408012.762, 3);
    expect(rightBlock.bbox.minX).toBeCloseTo(408069.733, 3);
  });

  it('ο Λ1 είναι καθαρή συνάρτηση — δύο κλήσεις δίνουν ίδιο αποτέλεσμα', () => {
    expect(readAll()).toEqual(readAll());
  });
});

describe('Λ1 — οριακά', () => {
  it('layer χωρίς κελιά δίνει καμία ανάγνωση', () => {
    expect(readTitleBlocks(LAYER, [])).toEqual([]);
  });

  it('🔴 κελί που δεν ταιριάζει πουθενά επιβιώνει στο unparsed', () => {
    const cells: TitleBlockSourceCell[] = [
      { handle: 'X1', x: 0, y: 0, height: 1, raw: 'ΚΛΙΜΑΚΑ' },
      { handle: 'X2', x: 8, y: 0, height: 1, raw: '1:50' },
      { handle: 'X3', x: 8, y: 6, height: 1, raw: 'ΑΓΝΩΣΤΟ ΚΕΙΜΕΝΟ' },
    ];
    const [reading] = readTitleBlocks(LAYER, cells);
    expect(reading.fields.map((f) => f.rawValue)).toEqual(['1:50']);
    expect(reading.unparsed).toEqual(['ΑΓΝΩΣΤΟ ΚΕΙΜΕΝΟ']);
  });
});
