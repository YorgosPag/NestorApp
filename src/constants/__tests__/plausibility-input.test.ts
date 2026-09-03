/**
 * **Η ΑΓΚΥΡΑ ΤΗΣ ΠΟΡΤΑΣ ΕΙΣΟΔΟΥ** — ADR-842 §7.6.
 *
 * Ερώτημα: *«απαντούν οι τέσσερις πύλες **διαφορετικά**, εκεί ακριβώς που ο τομέας το
 * απαιτεί — και συμφωνούν παντού αλλού;»*
 *
 * 🔴 **Γιατί υπάρχει.** Ως τις 2026-09-03 η ίδια μηχανή ζούσε σε **έξι** αντίγραφα
 * *(τρία byte-για-byte ταυτόσημα)*. Η ενοποίηση σε ένα module είναι εύκολο να γίνει
 * **λάθος με έναν τρόπο που κανείς δεν βλέπει**: αν οι τέσσερις πύλες συγχωνευθούν σε
 * μία «γενική», τότε ο όροφος χάνει το υπόγειο, η τιμή δέχεται το μηδέν, και τα
 * δωμάτια γίνονται δεκαδικά — **χωρίς καμία μεταγλώττιση να κοκκινίσει**.
 *
 * ⇒ Οι τρεις ομάδες παρακάτω είναι ακριβώς οι **τρεις διαφορές** που δικαιολογούν την
 * ύπαρξη τεσσάρων πυλών αντί για μία. Αν κάποια πάψει να ισχύει, η πύλη περισσεύει.
 *
 * @see ADR-842 §7.6.7 · constants/plausibility-input.ts
 */

import {
  toFiniteNumber,
  toNonNegativeInt,
  toNonNegativeNumber,
  toPositiveNumber,
} from '@/constants/plausibility-input';

const ALL_GATES = [
  ['toFiniteNumber', toFiniteNumber],
  ['toNonNegativeNumber', toNonNegativeNumber],
  ['toNonNegativeInt', toNonNegativeInt],
  ['toPositiveNumber', toPositiveNumber],
] as const;

describe('🟢 Κ — ο κοινός πυρήνας: όλες οι πύλες συμφωνούν', () => {
  const REJECTED_BY_ALL = [
    ['null', null],
    ['undefined', undefined],
    ['κενό αλφαριθμητικό', ''],
    ['μόνο κενά', '   '],
    ['μη αριθμός', 'δώδεκα'],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['-Infinity', Number.NEGATIVE_INFINITY],
    ['αντικείμενο', { value: 5 }],
    ['πίνακας', [5]],
    ['boolean', true],
  ] as const;

  it.each(
    ALL_GATES.flatMap(([gateName, gate]) =>
      REJECTED_BY_ALL.map(([label, input]) => [gateName, label, gate, input] as const),
    ),
  )('Κ1 — %s απορρίπτει: %s', (_g, _l, gate, input) => {
    expect(gate(input)).toBeNull();
  });

  /**
   * 🔴 **Η παγίδα του `Number('')`.** Επιστρέφει **`0`** — δηλαδή «δεν συμπλήρωσε
   * τίποτα» θα γινόταν «δήλωσε μηδέν», η ακριβώς αντίθετη πληροφορία. Το Κ1 από πάνω
   * το καλύπτει, αλλά μπαίνει **και ονομαστικά**: είναι ο λόγος που ο πυρήνας κόβει το
   * κενό **πριν** από το `Number()`, και μια «απλοποίηση» θα το επανέφερε σιωπηλά.
   */
  it('Κ2 — το κενό αλφαριθμητικό ΔΕΝ γίνεται μηδέν', () => {
    expect(Number('')).toBe(0); // η παγίδα, εκτελεσμένη
    for (const [, gate] of ALL_GATES) expect(gate('')).toBeNull();
  });

  it('Κ3 — τα αλφαριθμητικά διαβάζονται σαν αριθμοί, με κενά γύρω', () => {
    expect(toNonNegativeNumber(' 85.5 ')).toBe(85.5);
    expect(toFiniteNumber(' -1 ')).toBe(-1);
    expect(toPositiveNumber('150000')).toBe(150000);
    expect(toNonNegativeInt(' 3 ')).toBe(3);
  });
});

/**
 * 🔴 **Δ — ΟΙ ΤΡΕΙΣ ΔΙΑΦΟΡΕΣ.** Κάθε μία είναι ο λόγος ύπαρξης μιας πύλης.
 */
describe('🔴 Δ — εκεί που οι πύλες ΔΙΑΦΩΝΟΥΝ, και πρέπει', () => {
  /** Το υπόγειο είναι `-1`. Πύλη «μη αρνητικών» στον όροφο θα το έσβηνε από τον κόσμο. */
  it('Δ1 — αρνητικός: ΜΟΝΟ ο όροφος τον δέχεται', () => {
    expect(toFiniteNumber(-1)).toBe(-1);
    expect(toNonNegativeNumber(-1)).toBeNull();
    expect(toNonNegativeInt(-1)).toBeNull();
    expect(toPositiveNumber(-1)).toBeNull();
  });

  /**
   * «Μηδέν τ.μ. κήπου» είναι **δήλωση** *(«απάντησα: δεν έχει»)* — και υπάρχει ζωντανά
   * (ADR-842 Φ3). «Τιμή μηδέν» είναι **απουσία τιμής**, όχι δωρεάν ακίνητο.
   */
  it('Δ2 — το μηδέν: δήλωση για τα μεγέθη, απουσία για την τιμή', () => {
    expect(toNonNegativeNumber(0)).toBe(0);
    expect(toNonNegativeInt(0)).toBe(0);
    expect(toFiniteNumber(0)).toBe(0);
    expect(toPositiveNumber(0)).toBeNull();
  });

  /** «2,7 υπνοδωμάτια» σημαίνει ότι κάποιος μέτρησε κάτι άλλο — ποτέ στρογγυλοποίηση προς τα πάνω. */
  it('Δ3 — δεκαδικοί: τα δωμάτια κόβονται ΠΡΟΣ ΤΑ ΚΑΤΩ, τα εμβαδά όχι', () => {
    expect(toNonNegativeNumber(85.5)).toBe(85.5);
    expect(toNonNegativeInt(2.7)).toBe(2);
    expect(toNonNegativeInt(0.9)).toBe(0);
    expect(toFiniteNumber(-1.5)).toBe(-1.5);
  });
});
