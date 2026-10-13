/**
 * @fileoverview ADR-777 §8.93 — **το φύλλο των κοινοχρήστων**: ο ένας αναγνώστης, η μερική διόρθωση, ο ένας κριτής
 * «τίθεται η ερώτηση;», και το σύνολο του μήνα.
 * @related lib/common-charges/common-charges.ts
 */

import {
  applyCommonChargesPatch,
  COMMON_CHARGE_INCLUSIONS,
  commonChargesPatchSchema,
  commonChargesSchema,
  listedCommonChargesOf,
  MAX_COMMON_CHARGES_MONTHLY,
  monthlyOutlay,
  raisesCommonChargesQuestion,
  readCommonCharges,
  sameCommonCharges,
  storedCommonChargesSchema,
  UNDECLARED_COMMON_CHARGES,
} from '../common-charges';
import { COMMON_CHARGE_INCLUSION_KEY } from '../common-charges-keys';

describe('Α1 — ο αναγνώστης: τρεις απαντήσεις για το ποσό, καμία μαντεψιά', () => {
  it('απουσία · `null` · σκουπίδι ⇒ «τίποτα δηλωμένο»', () => {
    for (const raw of [undefined, null, 'x', 42, [], {}]) {
      expect(readCommonCharges(raw)).toEqual(UNDECLARED_COMMON_CHARGES);
    }
  });

  it('🔴 το `0` είναι ΑΠΑΝΤΗΣΗ («χωρίς κοινόχρηστα»), όχι απουσία', () => {
    expect(readCommonCharges({ monthlyAmount: 0 })).toEqual({ monthlyAmount: 0, includes: null });
  });

  it('ποσό εκτός κανόνα ⇒ `null`: αρνητικό · δεκαδικό · πάνω από το όριο · συμβολοσειρά', () => {
    for (const monthlyAmount of [-1, 120.5, MAX_COMMON_CHARGES_MONTHLY + 1, '120', Number.NaN, Infinity]) {
      expect(readCommonCharges({ monthlyAmount }).monthlyAmount).toBeNull();
    }
    expect(readCommonCharges({ monthlyAmount: MAX_COMMON_CHARGES_MONTHLY }).monthlyAmount).toBe(MAX_COMMON_CHARGES_MONTHLY);
  });

  it('«τι περιλαμβάνουν»: τρεις καταστάσεις — δεν ρωτήθηκε · τίποτα · κάποια', () => {
    expect(readCommonCharges({ monthlyAmount: 120 }).includes).toBeNull();
    expect(readCommonCharges({ monthlyAmount: 120, includes: [] }).includes).toEqual([]);
    expect(readCommonCharges({ monthlyAmount: 120, includes: ['heating'] }).includes).toEqual(['heating']);
  });

  it('το σύνολο βγαίνει στη σειρά του ΚΑΤΑΛΟΓΟΥ, όχι στη σειρά που γράφτηκε', () => {
    expect(readCommonCharges({ monthlyAmount: 120, includes: ['pool', 'heating', 'elevator'] }).includes).toEqual([
      'heating',
      'elevator',
      'pool',
    ]);
  });

  it('άγνωστη τιμή ⇒ ολόκληρο το σύνολο `null` — ποτέ μισή απάντηση· η διπλή απλώς συμπτύσσεται', () => {
    expect(readCommonCharges({ monthlyAmount: 120, includes: ['heating', 'sauna'] }).includes).toBeNull();
    expect(readCommonCharges({ monthlyAmount: 120, includes: ['heating', 42] }).includes).toBeNull();
    expect(readCommonCharges({ monthlyAmount: 120, includes: ['heating', 'heating'] }).includes).toEqual(['heating']);
    expect(readCommonCharges({ monthlyAmount: 120, includes: 'heating' }).includes).toBeNull();
  });

  it('🔴 ποτέ ορφανός προσδιοριστής: «περιλαμβάνουν» χωρίς ΘΕΤΙΚΟ ποσό ⇒ `null`', () => {
    expect(readCommonCharges({ includes: ['heating'] })).toEqual(UNDECLARED_COMMON_CHARGES);
    expect(readCommonCharges({ monthlyAmount: 0, includes: ['heating'] })).toEqual({ monthlyAmount: 0, includes: null });
  });

  it('ιδιοδύναμος: έγκυρο μπλοκ περνά αυτούσιο', () => {
    const block = readCommonCharges({ monthlyAmount: 85, includes: ['water', 'cleaning'] });
    expect(readCommonCharges(block)).toEqual(block);
  });
});

describe('Α2 — η διόρθωση είναι μερική, και το σχήμα αρνείται ό,τι δεν ξέρει', () => {
  it('αλλάζει ΜΟΝΟ το κλειδί που στάλθηκε', () => {
    const current = readCommonCharges({ monthlyAmount: 120, includes: ['heating'] });
    expect(applyCommonChargesPatch(current, { monthlyAmount: 150 })).toEqual({ monthlyAmount: 150, includes: ['heating'] });
    expect(applyCommonChargesPatch(current, { includes: [] })).toEqual({ monthlyAmount: 120, includes: [] });
  });

  it('ρητό `null` σβήνει την απάντηση — και παίρνει μαζί του τον προσδιοριστή', () => {
    const current = readCommonCharges({ monthlyAmount: 120, includes: ['heating'] });
    expect(applyCommonChargesPatch(current, { monthlyAmount: null })).toEqual(UNDECLARED_COMMON_CHARGES);
    expect(applyCommonChargesPatch(current, { monthlyAmount: 0 })).toEqual({ monthlyAmount: 0, includes: null });
  });

  it('το σχήμα της διόρθωσης: κενό · άγνωστο κλειδί · άκυρη τιμή ⇒ απόρριψη', () => {
    const rejected: unknown[] = [{}, { amount: 5 }, { monthlyAmount: -1 }, { monthlyAmount: 1.5 }, { includes: ['sauna'] }, null, 'x'];
    for (const body of rejected) expect(commonChargesPatchSchema.safeParse(body).success).toBe(false);
    for (const body of [{ monthlyAmount: 0 }, { monthlyAmount: null }, { includes: null }, { includes: ['heating'] }]) {
      expect(commonChargesPatchSchema.safeParse(body).success).toBe(true);
    }
  });

  it('το πλήρες σχήμα ζητά ΚΑΙ τα δύο κλειδιά· το αποθηκεύσιμο βγαίνει ήδη κανονικοποιημένο', () => {
    expect(commonChargesSchema.safeParse({ monthlyAmount: 120 }).success).toBe(false);
    expect(storedCommonChargesSchema.parse({ monthlyAmount: 0, includes: ['heating'] })).toEqual({
      monthlyAmount: 0,
      includes: null,
    });
    expect(storedCommonChargesSchema.parse({ monthlyAmount: 90, includes: ['pool', 'water'] })).toEqual({
      monthlyAmount: 90,
      includes: ['water', 'pool'],
    });
  });

  it('`sameCommonCharges`: ίδια δήλωση · άλλο ποσό · άλλο σύνολο · «δεν ρωτήθηκε» ≠ «τίποτα»', () => {
    const a = readCommonCharges({ monthlyAmount: 120, includes: ['heating'] });
    expect(sameCommonCharges(a, readCommonCharges({ monthlyAmount: 120, includes: ['heating'] }))).toBe(true);
    expect(sameCommonCharges(a, readCommonCharges({ monthlyAmount: 121, includes: ['heating'] }))).toBe(false);
    expect(sameCommonCharges(a, readCommonCharges({ monthlyAmount: 120, includes: ['water'] }))).toBe(false);
    expect(sameCommonCharges(a, readCommonCharges({ monthlyAmount: 120, includes: ['heating', 'water'] }))).toBe(false);
    expect(
      sameCommonCharges(readCommonCharges({ monthlyAmount: 120 }), readCommonCharges({ monthlyAmount: 120, includes: [] })),
    ).toBe(false);
    expect(sameCommonCharges(UNDECLARED_COMMON_CHARGES, readCommonCharges(undefined))).toBe(true);
  });
});

describe('Α3 — ο ΕΝΑΣ κριτής «τίθεται η ερώτηση;»', () => {
  it('κατοικία προς πώληση ή μακροχρόνια μίσθωση ⇒ ναι', () => {
    expect(raisesCommonChargesQuestion({ type: 'apartment', offerKinds: ['sell'] })).toBe(true);
    expect(raisesCommonChargesQuestion({ type: 'apartment', offerKinds: ['leaseOut'] })).toBe(true);
    expect(raisesCommonChargesQuestion({ type: 'shop', offerKinds: ['leaseShort', 'sell'] })).toBe(true);
  });

  it('🔴 γη ⇒ όχι, ό,τι κι αν διατίθεται', () => {
    expect(raisesCommonChargesQuestion({ type: 'land', offerKinds: ['sell'] })).toBe(false);
  });

  it('μόνο βραχυχρόνια · μόνο αντιπαροχή · καμία διάθεση ⇒ όχι', () => {
    expect(raisesCommonChargesQuestion({ type: 'apartment', offerKinds: ['leaseShort'] })).toBe(false);
    expect(raisesCommonChargesQuestion({ type: 'apartment', offerKinds: ['exchange'] })).toBe(false);
    expect(raisesCommonChargesQuestion({ type: 'apartment', offerKinds: [] })).toBe(false);
  });

  it('άγνωστο είδος δεν είναι γη ⇒ η ερώτηση τίθεται (το κενό είναι του είδους, όχι των κοινοχρήστων)', () => {
    expect(raisesCommonChargesQuestion({ type: null, offerKinds: ['sell'] })).toBe(true);
  });

  it('`listedCommonChargesOf`: κουτί `null` ⇔ δεν τίθεται· αλλιώς ό,τι λέει ο αναγνώστης', () => {
    const raw = { monthlyAmount: 120, includes: ['heating'] };
    expect(listedCommonChargesOf({ type: 'land', offerKinds: ['sell'] }, raw)).toBeNull();
    expect(listedCommonChargesOf({ type: 'apartment', offerKinds: ['sell'] }, raw)).toEqual(raw);
    expect(listedCommonChargesOf({ type: 'apartment', offerKinds: ['sell'] }, undefined)).toEqual(UNDECLARED_COMMON_CHARGES);
  });
});

describe('Α4 — το σύνολο του μήνα', () => {
  it('ενοίκιο + θετικά κοινόχρηστα', () => {
    expect(monthlyOutlay(900, { monthlyAmount: 120, includes: null })).toBe(1020);
  });

  it('🔴 αδήλωτα ⇒ κανένα σύνολο (θα ήταν ισχυρισμός)· μηδενικά ⇒ κανένα (θα επαναλάμβανε το ενοίκιο)', () => {
    expect(monthlyOutlay(900, UNDECLARED_COMMON_CHARGES)).toBeNull();
    expect(monthlyOutlay(900, { monthlyAmount: 0, includes: null })).toBeNull();
    expect(monthlyOutlay(900, null)).toBeNull();
  });
});

describe('Α5 — κάθε παροχή του καταλόγου έχει λέξη, και στις δύο γλώσσες', () => {
  it.each(['el', 'en'] as const)('[%s] κανένα κλειδί χωρίς μετάφραση', (language) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { commonCharges: bundle } = require(`@/i18n/locales/${language}/properties-enums.json`) as {
      commonCharges: { inclusion: Record<string, string> };
    };
    for (const inclusion of COMMON_CHARGE_INCLUSIONS) {
      expect(COMMON_CHARGE_INCLUSION_KEY[inclusion]).toBe(`properties-enums:commonCharges.inclusion.${inclusion}`);
      expect(bundle.inclusion[inclusion]?.length ?? 0).toBeGreaterThan(0);
    }
    expect(Object.keys(bundle.inclusion).sort()).toEqual([...COMMON_CHARGE_INCLUSIONS].sort());
  });
});
