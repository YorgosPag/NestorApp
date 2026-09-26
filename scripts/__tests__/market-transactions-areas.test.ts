/**
 * @jest-environment node
 *
 * ADR-889 Φ1 — αντιστοίχιση (νομαρχία, προ-2011 δήμος) → ταυτότητα Καλλικράτη, πάνω στην ΠΡΑΓΜΑΤΙΚΗ ιεραρχία ΕΛΣΤΑΤ.
 * Κάθε περίπτωση είναι ζεύγος που εμφανίζεται στα αρχεία 2017–2026 (μετρημένο 2026-09-26).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  MAMA_AREA_ALIASES,
  MAMA_PREFECTURE_REGIONAL_UNITS,
  REGIONAL_UNITS_WITHOUT_PREFECTURE,
} from '../lib/market-transactions/mama-area-tables';
import { createMamaAreaResolver, type HierarchyEntity } from '../lib/market-transactions/mama-area-resolver';

const rows = (
  JSON.parse(readFileSync(join(__dirname, '..', '..', 'public', 'data', 'administrative-hierarchy.json'), 'utf8')) as {
    data: HierarchyEntity[];
  }
).data;
const resolver = createMamaAreaResolver(rows);

describe('πίνακας νομαρχιών → Π.Ε.', () => {
  it('54 νομαρχίες, όσες μετρήθηκαν στα αρχεία', () => {
    expect(Object.keys(MAMA_PREFECTURE_REGIONAL_UNITS)).toHaveLength(54);
  });

  it('κάθε Π.Ε. της ιεραρχίας καλύπτεται ΑΚΡΙΒΩΣ μία φορά (ή δηλώνεται ότι δεν έχει νομαρχία)', () => {
    const claimed = [...Object.values(MAMA_PREFECTURE_REGIONAL_UNITS).flat(), ...REGIONAL_UNITS_WITHOUT_PREFECTURE];
    const actual = rows.filter((row) => row.l === 4).map((row) => row.id.replace('regional_unit:', ''));
    expect([...claimed].sort()).toEqual([...actual].sort());
  });
});

describe('ψευδώνυμα', () => {
  it('καθένα δείχνει σε Δ.Ε. ή δήμο ΜΕΣΑ στην Π.Ε. της νομαρχίας του, με λόγο', () => {
    const byId = new Map(rows.map((row) => [row.id, row]));
    for (const alias of MAMA_AREA_ALIASES) {
      let row = byId.get(alias.areaId);
      expect(row && [5, 6]).toContain(row?.l);
      while (row !== undefined && row.l > 4) row = row.p === null ? undefined : byId.get(row.p);
      expect(MAMA_PREFECTURE_REGIONAL_UNITS[alias.prefecture]).toContain(row?.id.replace('regional_unit:', ''));
      expect(alias.reason.length).toBeGreaterThan(0);
    }
  });
});

describe('σκάλα απόφασης', () => {
  it('ακριβές όνομα Δ.Ε. — και η πόλη που λέγεται όπως ο νομός ΔΕΝ είναι ανωνυμοποίηση', () => {
    expect(resolver.resolve('ΘΕΣΣΑΛΟΝΙΚΗΣ', 'ΘΕΣΣΑΛΟΝΙΚΗΣ')).toEqual({ kind: 'resolved', areaId: 'municipal_unit:070101', via: 'exact' });
    expect(resolver.resolve('ΘΕΣΣΑΛΟΝΙΚΗΣ', 'ΕΥΟΣΜΟΥ')).toMatchObject({ kind: 'resolved', via: 'exact' });
  });

  it('δήμος ΧΩΡΙΣ Δ.Ε. ⇒ η ταυτότητα του δήμου', () => {
    expect(resolver.resolve('ΑΘΗΝΩΝ (ΝΟΜΑΡΧΙΑ)', 'ΑΘΗΝΑΙΩΝ')).toEqual({ kind: 'resolved', areaId: 'municipality:4501', via: 'exact' });
  });

  it('ετικέτα = νομαρχία χωρίς ακριβή Δ.Ε. ⇒ withheld, ΠΟΤΕ ανεκτικό δέσιμο', () => {
    expect(resolver.resolve('ΚΟΡΙΝΘΙΑΣ', 'ΚΟΡΙΝΘΙΑΣ')).toEqual({ kind: 'withheld' });
    expect(resolver.resolve('ΑΘΗΝΩΝ (ΝΟΜΑΡΧΙΑ)', 'ΑΘΗΝΩΝ (ΝΟΜΑΡΧΙΑ)')).toEqual({ kind: 'withheld' });
    // Μετρημένο: η πόλη είναι «ΚΑΡΔΙΤΣΑΣ» (612 γραμμές)· το «ΚΑΡΔΙΤΣΗΣ» (15) έδενε λάθος μέσω κοινότητας.
    expect(resolver.resolve('ΚΑΡΔΙΤΣΗΣ', 'ΚΑΡΔΙΤΣΗΣ')).toEqual({ kind: 'withheld' });
    expect(resolver.resolve('ΚΑΡΔΙΤΣΗΣ', 'ΚΑΡΔΙΤΣΑΣ')).toMatchObject({ kind: 'resolved', via: 'exact' });
  });

  it('παρενθετικό όνομα ⇒ δοκιμάζεται και το κύριο', () => {
    expect(resolver.resolve('ΑΘΗΝΩΝ (ΝΟΜΑΡΧΙΑ)', 'ΙΛΙΟΥ (ΝΕΩΝ ΛΙΟΣΙΩΝ)')).toMatchObject({ kind: 'resolved', areaId: expect.stringMatching(/^municipality:/) });
  });

  it('όνομα κοινότητας ⇒ η Δ.Ε. που την περιέχει', () => {
    expect(resolver.resolve('ΑΝΑΤ. ΑΤΤΙΚΗΣ (ΝΟΜΑΡΧΙΑ)', 'ΝΕΩΝ ΠΑΛΑΤΙΩΝ')).toEqual({ kind: 'resolved', areaId: 'municipal_unit:491301', via: 'community' });
  });

  it('άλλη πτώση μέσα στην Π.Ε. ⇒ inflected', () => {
    expect(resolver.resolve('ΛΑΡΙΣΗΣ', 'ΛΑΡΙΣΑΣ')).toEqual({ kind: 'resolved', areaId: 'municipal_unit:220101', via: 'inflected' });
  });

  it('ψευδώνυμο του πίνακα', () => {
    expect(resolver.resolve('ΧΙΟΥ', 'ΨΑΡΩΝ')).toEqual({ kind: 'resolved', areaId: 'municipality:5703', via: 'alias' });
  });

  it('ζώνη που απλώνεται σε τέσσερις δήμους ⇒ unmatched, όχι μαντεψιά', () => {
    expect(resolver.resolve('ΑΘΗΝΩΝ (ΝΟΜΑΡΧΙΑ)', 'ΕΛΛΗΝΙΚΟΥ-ΑΡΓΥΡΟΥΠΟΛΗΣ-ΓΛΥΦΑΔΑΣ-ΑΛΙΜΟΥ')).toMatchObject({ kind: 'unmatched' });
  });

  it('το ίδιο όνομα σε ΑΛΛΗ Π.Ε. δεν δένεται (η εμβέλεια είναι υποχρεωτική)', () => {
    expect(resolver.resolve('ΑΘΗΝΩΝ (ΝΟΜΑΡΧΙΑ)', 'ΕΥΟΣΜΟΥ')).toMatchObject({ kind: 'unmatched' });
  });

  it('άγνωστη νομαρχία ⇒ σφάλμα, ώστε ο γεννήτορας να σταματήσει', () => {
    expect(() => resolver.resolve('ΜΑΚΕΔΟΝΙΑΣ', 'ΕΥΟΣΜΟΥ')).toThrow(/άγνωστη νομαρχία/);
  });
});
