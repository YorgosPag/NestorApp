/**
 * ADR-507 Φ7 — **`$MEASUREMENT`: σε τι μονάδες είναι ο ορισμός του μοτίβου.**
 *
 * Το DXF group 41 δεν είναι απόσταση — είναι **πολλαπλασιαστής** πάνω σε έναν ορισμό μοτίβου
 * που ζει σε **άλλο αρχείο**. Ποιο αρχείο, το λέει το `$MEASUREMENT`:
 *   • `0` (English) → `acad.pat`    → `ANSI31` delta-y = **0,125 ίντσες**
 *   • `1` (Metric)  → `acadiso.pat` → `ANSI31` delta-y = **3,175 mm**
 *
 * Ο κατάλογός μας είναι `acad.pat × 25.4`, δηλαδή **το acadiso**. Άρα το ίδιο `41` σημαίνει
 * **25,4× διαφορετική πυκνότητα** ανάλογα με το αρχείο προέλευσης — και μέχρι σήμερα το
 * αγνοούσαμε εντελώς: κάθε imperial σχέδιο έβγαινε με μοτίβο **25,4× πιο αραιό**.
 *
 * ⚠️ Ο έλεγχος εδώ είναι **φυσικός, όχι αριθμητικός**: δεν κοιτάει «βγήκε ο τύπος που έγραψα»
 * αλλά «το βήμα στον κόσμο είναι αυτό που θα ζωγράφιζε το AutoCAD». Αυτό είναι που έχει σημασία.
 */

import { describe, it, expect } from '@jest/globals';
import { convertHatch } from '../dxf-hatch-converter';
import { convertEntityToScene } from '../dxf-entity-converters';
import { hatchMinWorldSpacing } from '../../bim/geometry/shared/hatch-pattern-geometry';
import { getSuggestedScale } from '../../data/hatch-pattern-catalog';
import type { DxfHeaderData } from '../dxf-parser-types';
import type { HatchEntity } from '../../types/entities';

/** `acad.pat`: `ANSI31` = 45°, delta-y **0,125 ίντσες**. Ο κατάλογός μας το έχει ως 3,175 mm. */
const ANSI31_INCH = 0.125;
const INCH_MM = 25.4;

const header = (measurement: number): DxfHeaderData => ({
  insunits: 0, dimscale: 1, dimtxt: 2.5, annoScale: 1, measurement, pdmode: 0, pdsize: 0,
});

/**
 * HATCH pairs **γραμμένα στο χέρι** — σκόπιμα ΧΩΡΙΣ group 78 (καμία inline pattern definition),
 * ώστε ο renderer να πέσει στον κατάλογο. Ένα αρχείο με 78 κουβαλά τον δικό του ορισμό σε
 * μονάδες σχεδίου και **δεν** περνά καθόλου από αυτόν τον δρόμο (βλ. τελευταίο test).
 */
function hatchPairs(patternName: string, scale41: number): Array<[string, string]> {
  return [
    ['8', 'L'],
    ['2', patternName],
    ['70', '0'],          // solid fill flag: 0 = μοτίβο
    ['71', '0'],          // associativity
    ['91', '1'],          // πλήθος boundary paths
    ['92', '3'],          // external (1) + polyline (2)
    ['72', '0'],          // has bulge = όχι
    ['73', '1'],          // κλειστό
    ['93', '4'],          // πλήθος κορυφών
    ['10', '0'], ['20', '0'],
    ['10', '100'], ['20', '0'],
    ['10', '100'], ['20', '100'],
    ['10', '0'], ['20', '100'],
    ['97', '0'],          // πλήθος source objects
    ['75', '0'],          // island style
    ['76', '1'],          // pattern type: predefined
    ['52', '0'],          // γωνία
    ['41', String(scale41)],
    ['98', '0'],          // πλήθος seed points
  ];
}

const convert = (scale41: number, measurement?: number): HatchEntity => {
  const e = convertHatch(
    hatchPairs('ANSI31', scale41), 'L', 0,
    measurement === undefined ? undefined : header(measurement),
  );
  expect(e).not.toBeNull();
  return e as unknown as HatchEntity;
};

describe('ADR-507 Φ7 — $MEASUREMENT: μονάδες ορισμού μοτίβου', () => {
  it('🔴 imperial (`$MEASUREMENT=0`) με 41=1 ⇒ βήμα 0,125 μονάδες σχεδίου (ό,τι κάνει το AutoCAD)', () => {
    // Το AutoCAD κλιμακώνει το `acad.pat` (0,125″) × 1 ⇒ 0,125 **μονάδες σχεδίου**.
    expect(hatchMinWorldSpacing(convert(1, 0))).toBeCloseTo(ANSI31_INCH, 9);
  });

  it('metric (`$MEASUREMENT=1`) με 41=1 ⇒ βήμα 3,175 μονάδες σχεδίου', () => {
    // Το AutoCAD κλιμακώνει το `acadiso.pat` (3,175) × 1 ⇒ 3,175 μονάδες σχεδίου.
    expect(hatchMinWorldSpacing(convert(1, 1))).toBeCloseTo(ANSI31_INCH * INCH_MM, 9);
  });

  it('η διαφορά είναι ΑΚΡΙΒΩΣ 25,4× — ούτε στρογγυλοποίηση ούτε προσέγγιση', () => {
    expect(hatchMinWorldSpacing(convert(1, 1)) / hatchMinWorldSpacing(convert(1, 0)))
      .toBeCloseTo(INCH_MM, 9);
  });

  it('header ΑΠΩΝ ⇒ metric (η ιστορική συμπεριφορά· μηδέν regression)', () => {
    expect(hatchMinWorldSpacing(convert(1))).toBeCloseTo(hatchMinWorldSpacing(convert(1, 1)), 9);
  });

  it('το `suggested` ΑΠΑΛΕΙΦΕΤΑΙ στο import — δεν αλλοιώνει την πυκνότητα του αρχείου', () => {
    // Import: ÷ suggested · render: × suggested. Ό,τι μένει είναι ΜΟΝΟ το group 41 του αρχείου.
    // Γι' αυτό το `SUGGESTED_SCALES` δεν χρειάζεται να «περιοριστεί στα user-created»: στο
    // import είναι ήδη no-op **εξ ορισμού**, όχι κατά σύμπτωση.
    const suggested = getSuggestedScale('ANSI31');
    expect(suggested).toBeGreaterThan(1);            // αλλιώς το test δεν αποδεικνύει τίποτα
    expect(convert(suggested, 1).patternScale).toBeCloseTo(1, 9);
    expect(hatchMinWorldSpacing(convert(2, 1)) / hatchMinWorldSpacing(convert(1, 1)))
      .toBeCloseTo(2, 9);
  });

  it('ο διαιρέτης ΔΕΝ κρύβεται μέσα στο suggested — είναι ανεξάρτητοι παράγοντες', () => {
    const suggested = getSuggestedScale('ANSI31');
    expect(convert(suggested, 0).patternScale).toBeCloseTo(1 / INCH_MM, 9);
  });

  it('Η ΚΑΛΩΔΙΩΣΗ — το header φτάνει στον hatch converter μέσω του dispatcher', () => {
    // Χωρίς αυτό, ο τύπος θα ήταν σωστός και **αδρανής**: το `case 'HATCH'` του router δεν
    // περνούσε καθόλου το `header`, ενώ το είχε ήδη στα χέρια του.
    const viaRouter = convertEntityToScene(
      { type: 'HATCH', layer: 'L', data: {}, pairs: hatchPairs('ANSI31', 1) },
      0, header(0),
    ) as unknown as HatchEntity;
    expect(hatchMinWorldSpacing(viaRouter)).toBeCloseTo(ANSI31_INCH, 9);
  });

  it('αρχείο ΜΕ δικό του ορισμό μοτίβου (group 78) δεν επηρεάζεται — φέρνει μονάδες σχεδίου', () => {
    // Το inline pattern είναι ήδη σε μονάδες σχεδίου· ο renderer το ζωγραφίζει αυτούσιο
    // (`scale: 1`), οπότε το `$MEASUREMENT` δεν έχει καμία δουλειά εκεί.
    const withInline = (measurement: number): HatchEntity => {
      const pairs = hatchPairs('ANSI31', 1);
      pairs.push(
        ['78', '1'],                                  // 1 γραμμή ορισμού
        ['53', '45'], ['43', '0'], ['44', '0'], ['45', '0'], ['46', '9'],
        ['79', '0'],
      );
      return convertHatch(pairs, 'L', 0, header(measurement)) as unknown as HatchEntity;
    };
    expect(withInline(0).inlinePattern).toBeDefined();
    expect(hatchMinWorldSpacing(withInline(0)))
      .toBeCloseTo(hatchMinWorldSpacing(withInline(1)), 9);
  });
});
