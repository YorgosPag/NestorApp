/**
 * @fileoverview Άγκυρες της ΠΟΛΙΤΙΚΗΣ των ονομάτων εμφάνισης — ADR-893.
 *
 * Όλες οι περιπτώσεις είναι μετρημένες στις πηγές, 2026-09-27: Κηφισιά (το Wikidata διαφωνεί με
 * τον εαυτό του), Νικαίας (νόμος ≠ Wikidata), Ιάσμου Ροδόπης (ουρά νομού), κωδικός `11` (Πιερία στο
 * Wikidata, αποκεντρωμένη διοίκηση σε εμάς).
 */

import type { Law3852 } from '../law-3852';
import { resolveDisplayNames, type RegistryRow, type ReviewedName } from '../resolve-display-names';
import { levelCodeKey, type WikidataNames } from '../wikidata-names';

const ROWS: readonly RegistryRow[] = [
  { id: 'decentralized_administration:11', n: 'ΑΠΟΚΕΝΤΡΩΜΕΝΗ ΔΙΟΙΚΗΣΗ ΜΑΚΕΔΟΝΙΑΣ - ΘΡΑΚΗΣ', sn: 'ΜΑΚΕΔΟΝΙΑΣ - ΘΡΑΚΗΣ', c: '11', l: 2, p: null },
  { id: 'regional_unit:01', n: 'ΠΕΡΙΦΕΡΕΙΑΚΗ ΕΝΟΤΗΤΑ ΡΟΔΟΠΗΣ', sn: 'ΡΟΔΟΠΗΣ', c: '01', l: 4, p: null },
  { id: 'municipality:0103', n: 'ΔΗΜΟΣ ΙΑΣΜΟΥ', sn: 'ΙΑΣΜΟΥ', c: '0103', l: 5, p: 'regional_unit:01' },
  { id: 'municipal_unit:010301', n: 'ΔΗΜΟΤΙΚΗ ΕΝΟΤΗΤΑ ΙΑΣΜΟΥ', sn: 'ΙΑΣΜΟΥ', c: '010301', l: 6, p: 'municipality:0103' },
  { id: 'municipality:4605', n: 'ΔΗΜΟΣ ΚΗΦΙΣΙΑΣ', sn: 'ΚΗΦΙΣΙΑΣ', c: '4605', l: 5, p: null },
  { id: 'municipality:5104', n: 'ΔΗΜΟΣ ΝΙΚΑΙΑΣ - ΑΓΙΟΥ ΙΩΑΝΝΗ ΡΕΝΤΗ', sn: 'ΝΙΚΑΙΑΣ - ΑΓΙΟΥ ΙΩΑΝΝΗ ΡΕΝΤΗ', c: '5104', l: 5, p: null },
  { id: 'municipal_unit:510401', n: 'ΔΗΜΟΤΙΚΗ ΕΝΟΤΗΤΑ ΝΙΚΑΙΑΣ', sn: 'ΝΙΚΑΙΑΣ', c: '510401', l: 6, p: 'municipality:5104' },
  { id: 'municipality:5207', n: 'ΔΗΜΟΣ ΣΠΕΤΣΩΝ', sn: 'ΣΠΕΤΣΩΝ', c: '5207', l: 5, p: null },
  { id: 'community:01030101', n: 'Δημοτική Κοινότητα Ιάσμου', sn: 'Ιάσμου', c: '01030101', l: 7, p: 'municipal_unit:010301' },
];

const LAW: Law3852 = {
  municipalities: [
    { name: 'Ιάσμου', units: ['Ιάσμου', 'Αμαξάδων'] },
    { name: 'Κηφισιάς', units: ['Κηφισιάς'] },
    { name: 'Νίκαιας – Αγίου Ιωάννη Ρέντη', units: ['Νικαίας', 'Αγίου Ιωάννου Ρέντη'] },
  ],
  unchanged: [],
};

function wikidata(byCode: Record<string, readonly string[]>, byLevel: Record<number, readonly string[]> = {}): WikidataNames {
  return {
    byLevelCode: new Map(Object.entries(byCode)),
    byLevel: new Map(Object.entries(byLevel).map(([level, labels]) => [Number(level), labels])),
  };
}

const WIKIDATA = wikidata(
  {
    [levelCodeKey(4, '01')]: ['Περιφερειακή Ενότητα Ροδόπης', 'Νομός Ροδόπης'],
    [levelCodeKey(5, '0103')]: ['Δήμος Ιάσμου'],
    [levelCodeKey(6, '010301')]: ['Δημοτική Ενότητα Ιάσμου Ροδόπης'],
    [levelCodeKey(5, '4605')]: ['Δήμος Κηφισίας', 'Δήμος Κηφισιάς'],
    [levelCodeKey(5, '5104')]: ['Δήμος Νίκαιας - Αγίου Ιωάννη Ρέντη'],
    [levelCodeKey(6, '510401')]: ['Δημοτική Ενότητα Νίκαιας'],
    // ο κωδικός «11» του Wikidata είναι η Πιερία — ΔΕΝ πρέπει να φτάσει στη βαθμίδα 2
    [levelCodeKey(4, '11')]: ['Περιφερειακή Ενότητα Πιερίας'],
  },
  { 2: ['Αποκεντρωμένη Διοίκηση Μακεδονίας - Θράκης'] },
);

function resolve(reviewed: readonly ReviewedName[] = []) {
  return resolveDisplayNames(ROWS, { law: LAW, wikidata: WIKIDATA, reviewed });
}

function nameOf(result: ReturnType<typeof resolve>, level: number, code: string): string | undefined {
  return result.entries.find((entry) => entry.l === level && entry.c === code)?.n;
}

describe('resolveDisplayNames — η πολιτική', () => {
  const result = resolve();

  it('συμφωνία νόμου + Wikidata ⇒ δεκτό, με το πρόθεμα από τον ΕΝΑ πίνακα βαθμίδων', () => {
    expect(nameOf(result, 5, '0103')).toBe('Δήμος Ιάσμου');
    expect(result.entries.find((entry) => entry.c === '0103')?.source).toBe('law-3852-2010+wikidata');
  });

  it('η ουρά νομού του Wikidata («… Ροδόπης») κόβεται ΜΟΝΟ επειδή είναι όνομα προγόνου', () => {
    expect(nameOf(result, 6, '010301')).toBe('Δημοτική Ενότητα Ιάσμου');
  });

  it('το Wikidata διαφωνεί με τον εαυτό του και ο νόμος διαλέγει μία από τις μορφές του ⇒ ο νόμος', () => {
    expect(nameOf(result, 5, '4605')).toBe('Δήμος Κηφισιάς');
  });

  it('νόμος ≠ Wikidata ⇒ ΚΑΝΕΝΑΣ δεν κερδίζει: επιμέλεια', () => {
    expect(nameOf(result, 6, '510401')).toBeUndefined();
    expect(result.unresolved.find((entry) => entry.c === '510401')).toMatchObject({
      reason: 'conflict',
      law: ['Νικαίας'],
      wikidata: ['Νίκαιας'],
    });
  });

  it('καμία πηγή ⇒ το όνομα μένει, και η αναφορά το ονομάζει', () => {
    expect(result.unresolved.find((entry) => entry.c === '5207')?.reason).toBe('no-source');
  });

  it('βαθμίδα 2 κατά ΤΥΠΟ, ποτέ κατά κωδικό — ο κωδικός 11 δεν γίνεται Πιερία', () => {
    expect(nameOf(result, 2, '11')).toBe('Αποκεντρωμένη Διοίκηση Μακεδονίας - Θράκης');
  });

  it('οι βαθμίδες 7–8 δεν αγγίζονται — έρχονται ήδη τονισμένες', () => {
    expect(result.entries.some((entry) => entry.l === 7)).toBe(false);
    expect(result.unresolved.some((entry) => entry.l === 7)).toBe(false);
  });
});

describe('resolveDisplayNames — η επιμέλεια κερδίζει, αλλά ΔΕΝ περνά ανέλεγκτη', () => {
  it('απόφαση ανθρώπου λύνει τη διαφωνία, με την απόδειξη της', () => {
    const result = resolve([{ l: 6, c: '510401', name: 'Νικαίας', evidence: 'ΦΕΚ Α 87/2010' }]);
    expect(result.entries.find((entry) => entry.c === '510401')).toMatchObject({
      n: 'Δημοτική Ενότητα Νικαίας',
      source: 'reviewed',
      evidence: 'ΦΕΚ Α 87/2010',
    });
  });

  it('επιμέλεια με ΑΛΛΟ όνομα ή χωρίς τόνο ⇒ σφάλμα, όχι σιωπή', () => {
    expect(() => resolve([{ l: 5, c: '5207', name: 'Σπετσών Ύδρας', evidence: 'x' }])).toThrow(/different-words/);
    expect(() => resolve([{ l: 5, c: '5207', name: 'Σπετσων', evidence: 'x' }])).toThrow(/not-monotonic/);
  });
});
