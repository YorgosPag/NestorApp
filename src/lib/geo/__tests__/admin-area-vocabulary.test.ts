/**
 * @fileoverview Άγκυρα του λεξιλογίου και της ανοχής ορθογραφίας (ADR-883 §5.11) — βαθμοί, όρια λαθών,
 * και η ΙΔΙΟΤΗΤΑ του φίλτρου γραμμάτων: δεν απορρίπτει ΠΟΤΕ ζεύγος που είναι πραγματικά μέσα στο όριο.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { editDistance } from '../../string/edit-distance';
import { ADMIN_AREA_INDEX_FILE, readAdminAreaIndex } from '../admin-area-index-file';
import {
  NO_GRADE,
  buildAdminAreaVocabulary,
  editDistanceBudget,
  gradeIsWhole,
  gradeTypos,
  gradeVocabulary,
  letterSignature,
} from '../admin-area-vocabulary';
import { nameWordForms } from '../admin-area-words';

/** Ο βαθμός μιας λέξης του ανθρώπου απέναντι σε ένα λεξιλόγιο μίας λέξης. */
function gradeOf(asked: string, known: string, correct = true): number {
  return gradeVocabulary(buildAdminAreaVocabulary([known]), [asked], correct)[0];
}

describe('όριο λαθών ανά μήκος (Meilisearch 5/9)', () => {
  it.each([
    [4, 0],
    [5, 1],
    [8, 1],
    [9, 2],
  ])('%i γράμματα ⇒ %i λάθη', (length, budget) => {
    expect(editDistanceBudget(length)).toBe(budget);
  });
});

describe('gradeVocabulary', () => {
  it('ίδια λέξη / κλίση ⇒ ολόκληρη, 0 λάθη · πρόθεμα ⇒ όχι ολόκληρη', () => {
    expect(gradeOf('ροδοσ', 'ροδου', false)).toBe(0);
    expect(gradeOf('ξυλοπ', 'ξυλοπολεωσ', false)).toBe(1);
  });

  it('χωρίς διόρθωση: λάθος ⇒ κανένας βαθμός', () => {
    expect(gradeOf('καλαμαζασ', 'καλαματασ', false)).toBe(NO_GRADE);
  });

  it('🔑 λάθος ΑΝΤΙΚΑΤΑΣΤΑΣΗΣ με γράμμα που λείπει (ρ→ζ), στο όριο του 1 λάθους ⇒ ΟΛΟΚΛΗΡΗ λέξη — το φίλτρο δεν την κόβει', () => {
    const grade = gradeOf('κατεζινη', 'κατερινη');
    expect(gradeTypos(grade)).toBe(1);
    expect(gradeIsWhole(grade)).toBe(true);
  });

  it('μισή λέξη με λάθος αντικατάστασης («κατεζι…») ⇒ ΠΡΟΘΕΜΑ του «κατερινη», 1 λάθος — ούτε αυτό το κόβει το φίλτρο', () => {
    const grade = gradeOf('κατεζι', 'κατερινη');
    expect(gradeTypos(grade)).toBe(1);
    expect(gradeIsWhole(grade)).toBe(false);
  });

  it('θέμα με λάθος απέναντι σε άλλη κατάληξη: «ξυλουπολη» ↔ «ξυλοπολεωσ» ⇒ ολόκληρη, 1 λάθος', () => {
    const grade = gradeOf('ξυλουπολη', 'ξυλοπολεωσ');
    expect(gradeTypos(grade)).toBe(1);
    expect(gradeIsWhole(grade)).toBe(true);
  });

  it('πρώτο γράμμα λάθος ⇒ ποτέ (Elasticsearch `prefix_length: 1`)', () => {
    expect(gradeOf('φυλοπολη', 'ξυλοπολη')).toBe(NO_GRADE);
  });

  it('κοντή λέξη (< 5) ⇒ καμία διόρθωση', () => {
    expect(gradeOf('ροδι', 'ροδο')).toBe(NO_GRADE);
  });
});

describe('ιδιότητα του φίλτρου γραμμάτων, στο ΠΡΑΓΜΑΤΙΚΟ λεξιλόγιο', () => {
  const index = readAdminAreaIndex(
    JSON.parse(readFileSync(join(process.cwd(), 'public', ADMIN_AREA_INDEX_FILE), 'utf8')),
  );
  const words = [...new Set([...index.values()].flatMap((area) => nameWordForms(area.name).flat()))];

  it('🔑 κάθε ζεύγος με απόσταση ≤ όριο έχει «γράμματα που λείπουν» ≤ όριο (κάτω φράγμα, ποτέ ψευδώς αρνητικό)', () => {
    const popcount = (value: number) => (value >>> 0).toString(2).replace(/0/g, '').length;
    let checked = 0;
    for (let i = 0; i < words.length; i += 41) {
      const asked = words[i];
      const budget = editDistanceBudget(asked.length);
      if (budget === 0) continue;
      for (let j = 0; j < words.length; j += 17) {
        const known = words[j];
        const distance = editDistance(asked, known, { transpositions: true, max: budget });
        if (distance > budget) continue;
        checked += 1;
        expect(popcount(letterSignature(asked) & ~letterSignature(known))).toBeLessThanOrEqual(distance);
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});
