/**
 * ADR-507 — **Σε ποιο σύστημα αξόνων ζει το `PatternLine.delta`;** (PAT τοπικό ↔ DXF world)
 *
 * Γιατί υπάρχει αυτό το αρχείο: επί μήνες ΟΛΑ τα hatch round-trip tests ήταν πράσινα ενώ η
 * γραμμοσκίαση στον καμβά είχε **λάθος πυκνότητα**. Ο λόγος: ο importer αποθήκευε world delta
 * σε πεδίο που ορίζεται τοπικό, και ο writer έγραφε το τοπικό ωμό ως world — **τα δύο λάθη
 * αλληλοαναιρούνταν στο αρχείο**. Ένα round-trip test δεν μπορεί να δει τέτοιο ζεύγος.
 * ⇒ Εδώ ελέγχουμε την **ΕΝΔΙΑΜΕΣΗ** τιμή (τι μπαίνει στη σκηνή) απέναντι σε **πραγματικά bytes
 * του AutoCAD**, όχι την τιμή που βγαίνει στην άλλη άκρη.
 *
 * Πηγή δεδομένων: `C:\Users\user\Downloads\47_ergasia.dxf` (τοπογραφικό ΕΓΣΑ87, AC1032,
 * `$MEASUREMENT=0`, 50 HATCH) + τα αντίστοιχα persisted Firestore έγγραφα.
 */

import { convertHatch } from '../dxf-hatch-converter';
import { patternDeltaFromWorld, patternDeltaToWorld } from '../../data/hatch-pattern-delta-frame';
import { hatchMinWorldSpacing } from '../../bim/geometry/shared/hatch-pattern-geometry';
import type { HatchEntity } from '../../types/entities';

type Pairs = ReadonlyArray<readonly [string, string]>;

/**
 * Οι ΠΡΑΓΜΑΤΙΚΟΙ group codes του `HATCH[1]` του `47_ergasia.dxf`, στη σειρά που είναι στο
 * αρχείο (αντιγραμμένοι από dump των bytes — ΟΧΙ κατασκευασμένοι).
 * ANSI31 @ `41=0.4` ⇒ acad.pat delta-y `0.125″ × 0.4` = **0,05 μονάδες σχεδίου**.
 */
const REAL_ANSI31_PAIRS: Pairs = [
  ['0', 'HATCH'], ['5', '2F1'], ['100', 'AcDbEntity'], ['8', 'ΓΡΑΜΜΟΣΚΙΑΣΗ'],
  ['100', 'AcDbHatch'], ['10', '0.0'], ['20', '0.0'], ['30', '0.0'],
  ['210', '0.0'], ['220', '0.0'], ['230', '1.0'],
  ['2', 'ANSI31'], ['70', '0'], ['71', '0'],
  ['91', '1'], ['92', '1'], ['93', '3'],
  ['72', '1'], ['10', '3.702445570201234'], ['20', '1.31887523666478'], ['11', '4.539731676533847'], ['21', '2.88337197978376'],
  ['72', '1'], ['10', '4.539731676533847'], ['20', '2.88337197978376'], ['11', '13.59237762023622'], ['21', '1.322036066752616'],
  ['72', '1'], ['10', '13.59237762023622'], ['20', '1.322036066752616'], ['11', '3.702445570201234'], ['21', '1.31887523666478'],
  ['97', '1'], ['330', '337'],
  ['75', '0'], ['76', '1'], ['52', '0.0'], ['41', '0.4'], ['77', '0'],
  ['78', '1'],
  ['53', '45.0'],
  ['43', '4823.412377620236'], ['44', '-772.3979639332474'],
  ['45', '-0.0353553390593274'], ['46', '0.0353553390593274'],
  ['79', '0'],
  ['98', '1'], ['10', '4823.412377620236'], ['20', '-772.3979639332474'],
];

describe('patternDeltaFromWorld / patternDeltaToWorld — η σύμβαση, απομονωμένη', () => {
  it('AutoCAD ANSI31 @45° : world (-0.0353553, 0.0353553) → τοπικό (0, 0.05)', () => {
    const [along, perp] = patternDeltaFromWorld([-0.0353553390593274, 0.0353553390593274], 45);
    expect(along).toBeCloseTo(0, 12);       // ANSI31 δεν έχει stagger
    expect(perp).toBeCloseTo(0.05, 12);     // 0.125″ × fileScale 0.4
  });

  it('πραγματικό persisted hatch @302.4° : world (211.08, 133.96) → τοπικό (0, 250 mm)', () => {
    // Από `floorplan_hatches/hatch_1139` — το ίδιο μοτίβο μετά το canonical-mm pass.
    const [along, perp] = patternDeltaFromWorld([211.08198137550391, 133.956698744749], 302.4);
    expect(along).toBeCloseTo(0, 9);
    expect(perp).toBeCloseTo(250, 9);       // ΑΚΡΙΒΩΣ ό,τι δείχνει το AutoCAD
  });

  it('είναι γνήσια αντίστροφες (round-trip σε αυθαίρετες γωνίες, με stagger)', () => {
    for (const angle of [0, 30, 45, 90, 135, 180, 257.4, 302.4, 349.2, -17.5]) {
      const local: [number, number] = [12.5, 250];
      const world = patternDeltaToWorld(local, angle);
      const back = patternDeltaFromWorld(world, angle);
      expect(back[0]).toBeCloseTo(local[0], 9);
      expect(back[1]).toBeCloseTo(local[1], 9);
      // Το μέτρο είναι αναλλοίωτο στη στροφή — δικλείδα ότι δεν «χάνεται» σκέλος.
      expect(Math.hypot(world[0], world[1])).toBeCloseTo(Math.hypot(local[0], local[1]), 9);
    }
  });

  it('🔴 ο ΘΑΝΑΤΗΦΟΡΟΣ κλάδος: γραμμή στις 45° με world delta δίνει |delta[1]| ≪ πραγματικού βήματος', () => {
    // Αν το world delta περνούσε ωμό στον πυρήνα, το `buildPatternLineSegments` θα διάβαζε
    // `dy = |delta[1]|`. Για γωνία γραμμής 45° αυτό είναι spacing/√2 — και για γωνία 225°
    // (delta σχεδόν οριζόντιο) πέφτει κάτω από το EPS ⇒ `return []` ⇒ ΚΑΜΙΑ γραμμή.
    const world = patternDeltaToWorld([0, 100], 45);
    expect(Math.abs(world[1])).toBeCloseTo(70.7106781, 6);   // ό,τι ΘΑ διάβαζε ο πυρήνας: 70.7
    expect(patternDeltaFromWorld(world, 45)[1]).toBeCloseTo(100, 9); // ό,τι διαβάζει ΤΩΡΑ: 100
  });
});

describe('convertHatch — πραγματικά bytes AutoCAD → σκηνή (ADR-507)', () => {
  const entity = convertHatch(REAL_ANSI31_PAIRS, 'ΓΡΑΜΜΟΣΚΙΑΣΗ', 1) as HatchEntity | null;

  it('παράγει predefined hatch με διατηρημένο inlinePattern', () => {
    expect(entity).not.toBeNull();
    expect(entity!.fillType).toBe('predefined');
    expect(entity!.patternName).toBe('ANSI31');
    expect(entity!.inlinePattern!.lines).toHaveLength(1);
    expect(entity!.inlinePattern!.lines[0].angle).toBeCloseTo(45, 9);
  });

  it('🔴 ΤΟ BUG: το delta μπαίνει στη σκηνή σε ΤΟΠΙΚΟ frame (0, 0.05) — όχι world', () => {
    const [along, perp] = entity!.inlinePattern!.lines[0].delta;
    expect(along).toBeCloseTo(0, 12);
    expect(perp).toBeCloseTo(0.05, 12);
    // Πριν τη διόρθωση εδώ ήταν (-0.0353553, 0.0353553) ⇒ ο πυρήνας μετρούσε βήμα 0,0354
    // αντί 0,05 — δηλαδή **41% πυκνότερα**, με το σφάλμα να εξαρτάται από τη γωνία.
    expect(perp).not.toBeCloseTo(0.0353553390593274, 6);
  });

  it('🔴 το density-LOD ρωτά τη ΣΩΣΤΗ πυκνότητα (τροφοδοτεί κατώφλι οθόνης ΚΑΙ χαρτιού)', () => {
    // `hatchMinWorldSpacing` διαβάζει `|delta[1]|` του inlinePattern ⇒ με world delta έδινε
    // 0,0354 και το LOD έκρινε «sub-pixel» νωρίτερα απ' ό,τι έπρεπε (και το PDF τύπωνε tint).
    expect(hatchMinWorldSpacing(entity!)).toBeCloseTo(0.05, 12);
  });

  it('τα boundary vertices του πραγματικού path διαβάζονται ακέραια', () => {
    expect(entity!.boundaryPaths).toHaveLength(1);
    expect(entity!.boundaryPaths[0]).toHaveLength(3);
    expect(entity!.boundaryPaths[0][0].x).toBeCloseTo(3.702445570201234, 12);
  });
});
