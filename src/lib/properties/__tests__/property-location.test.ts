/**
 * Άγκυρες — ADR-840 §7.6: **ο ΕΝΑΣ κριτής τοποθεσίας** (έργο → κτίριο → όροφος).
 *
 * Τα φίλτρα «Έργο»/«Κτίριο» ήταν άδεια ΚΑΙ νεκρά: επιλογές από `project`/`building` (πεδία που δεν υπάρχουν
 * στο έγγραφο), καμία εφαρμογή στη «Διαθέσιμα Ακίνητα», εφαρμογή με ΟΝΟΜΑ στο `/spaces/properties`. Τα
 * σταθερά εδώ είναι έγγραφα **μόνο με ταυτότητες** — ακριβώς το σχήμα του Firestore.
 */

import {
  countDistinctBuildings,
  joinLocationParts,
  locationChoices,
  matchesPropertyLocation,
  reconcileLocationSelection,
  type LocatedProperty,
} from '../property-location';

interface Row extends LocatedProperty {
  readonly id: string;
}

// Δύο έργα· το Β έχει δύο κτίρια· ισόγειο (0) και υπόγειο (-1) παρόντα.
const ROWS: readonly Row[] = [
  { id: 'a-1', projectId: 'proj_A', buildingId: 'bld_A1', floor: 0 },
  { id: 'a-2', projectId: 'proj_A', buildingId: 'bld_A1', floor: 1 },
  { id: 'b-1', projectId: 'proj_B', buildingId: 'bld_B1', floor: 2 },
  { id: 'b-2', projectId: 'proj_B', buildingId: 'bld_B2', floor: 10 },
  { id: 'b-3', projectId: 'proj_B', buildingId: 'bld_B2', floor: -1 },
  { id: 'loose', projectId: null, buildingId: '', floor: undefined },
];

const ids = (rows: readonly Row[]) => rows.map((r) => r.id);
const pick = (selection: Parameters<typeof matchesPropertyLocation>[1]) =>
  ids(ROWS.filter((r) => matchesPropertyLocation(r, selection)));

describe('locationChoices — επιλογές από έγγραφα ΜΟΝΟ με ταυτότητες', () => {
  it('(α) έργα και κτίρια ΔΕΝ είναι κενά· κενές ταυτότητες αποβάλλονται', () => {
    const choices = locationChoices(ROWS, {});
    expect(choices.projectIds.sort()).toEqual(['proj_A', 'proj_B']);
    expect(choices.buildingIds.sort()).toEqual(['bld_A1', 'bld_B1', 'bld_B2']);
  });

  it('(γ) το ισόγειο (0) ΕΠΙΒΙΩΝΕΙ, και οι όροφοι ταξινομούνται αριθμητικά', () => {
    expect(locationChoices(ROWS, {}).floors).toEqual([-1, 0, 1, 2, 10]);
  });

  it('(δ) καταρράκτης: έργο ⇒ μόνο τα κτίρια του· έργο+κτίριο ⇒ μόνο οι όροφοί του', () => {
    expect(locationChoices(ROWS, { project: ['proj_A'] }).buildingIds).toEqual(['bld_A1']);
    const inB2 = locationChoices(ROWS, { project: ['proj_B'], building: ['bld_B2'] });
    expect(inB2.floors).toEqual([-1, 10]);
    // Το ίδιο το έργο ΔΕΝ περιορίζεται από τη δική του επιλογή — μένει δυνατή η αλλαγή.
    expect(inB2.projectIds.sort()).toEqual(['proj_A', 'proj_B']);
  });
});

describe('matchesPropertyLocation — (β) η επιλογή ΦΙΛΤΡΑΡΕΙ', () => {
  it('κενή επιλογή = όλα', () => {
    expect(pick({})).toEqual(ids(ROWS));
  });

  it('έργο', () => {
    expect(pick({ project: ['proj_B'] })).toEqual(['b-1', 'b-2', 'b-3']);
  });

  it('κτίριο', () => {
    expect(pick({ building: ['bld_B2'] })).toEqual(['b-2', 'b-3']);
  });

  it('όροφος — ισόγειο ως "0"', () => {
    expect(pick({ floor: ['0'] })).toEqual(['a-1']);
  });

  it('συνδυασμός: έργο ∩ κτίριο ∩ όροφος', () => {
    expect(pick({ project: ['proj_B'], building: ['bld_B2'], floor: ['10'] })).toEqual(['b-2']);
  });

  it('ακίνητο χωρίς έργο ΔΕΝ περνά φίλτρο έργου (κενό ≠ ταίρι)', () => {
    expect(pick({ project: ['proj_A', 'proj_B'] })).not.toContain('loose');
  });

  it('συγκρίνει ΤΑΥΤΟΤΗΤΑ, όχι όνομα — ένα ψευδοκάτοπτρο `project` αγνοείται', () => {
    const withMirror = { projectId: 'proj_A', buildingId: 'bld_A1', floor: 1, project: 'proj_B' };
    expect(matchesPropertyLocation(withMirror, { project: ['proj_B'] })).toBe(false);
    expect(matchesPropertyLocation(withMirror, { project: ['proj_A'] })).toBe(true);
  });
});

describe('reconcileLocationSelection — αλλαγή έργου καθαρίζει ό,τι δεν ανήκει πια', () => {
  it('(δ) κτίριο άλλου έργου και όροφος εκτός πεδίου αφαιρούνται', () => {
    const next = reconcileLocationSelection(
      { project: ['proj_A'], building: ['bld_B2'], floor: ['10'], searchTerm: 'x' },
      ROWS,
    );
    expect(next).toEqual({ project: ['proj_A'], building: [], floor: [], searchTerm: 'x' });
  });

  it('έγκυρη επιλογή μένει — και επιστρέφεται το ΙΔΙΟ αντικείμενο (ιδεμποτές, χωρίς περιττό render)', () => {
    const selection = { project: ['proj_B'], building: ['bld_B2'], floor: ['-1'] };
    expect(reconcileLocationSelection(selection, ROWS)).toBe(selection);
    const once = reconcileLocationSelection({ project: ['proj_A'], building: ['bld_B1'] }, ROWS);
    expect(reconcileLocationSelection(once, ROWS)).toBe(once);
  });

  it('άδειος κατάλογος (φορτώνει) ⇒ καμία αλλαγή — «δεν ήρθε» ≠ «δεν υπάρχει»', () => {
    const selection = { project: ['proj_A'], building: ['bld_B2'] };
    expect(reconcileLocationSelection(selection, [])).toBe(selection);
  });
});

describe('countDistinctBuildings / joinLocationParts', () => {
  it('μετρά κτίρια με ταυτότητα — το κενό δεν μετρά ως κτίριο', () => {
    expect(countDistinctBuildings(ROWS)).toBe(3);
  });

  it('«Έργο • Κτίριο • Όροφος» χωρίς κενά τμήματα — ποτέ «• •»', () => {
    expect(joinLocationParts(['Έργο', 'Κτίριο', 'Ισόγειο'])).toBe('Έργο • Κτίριο • Ισόγειο');
    expect(joinLocationParts([null, undefined, '1ος Όροφος'])).toBe('1ος Όροφος');
    expect(joinLocationParts(['Έργο', '  ', 'Ισόγειο'])).toBe('Έργο • Ισόγειο');
    expect(joinLocationParts([])).toBe('');
  });
});
