/**
 * ADR-777 §8.95 — **η τελική ενέργεια και η ωφέλιμη επιφάνεια του ΠΕΑ**: ο πίνακας διαβάζεται ολόκληρος ή καθόλου,
 * και τα δύο πεδία ζουν μόνο δίπλα σε κλάση.
 */

import { CERTIFICATE_ENERGY_SOURCES } from '@/constants/certificate-energy-sources';

import {
  MAX_FINAL_ENERGY_PER_SQM,
  MAX_USEFUL_AREA,
  isUsefulArea,
  readFinalEnergy,
  sameFinalEnergy,
} from '../certificate-final-energy';
import {
  applyEnergyCertificatePatch,
  energyCertificatePatchSchema,
  listedEnergyCertificateOf,
  readEnergyCertificate,
  relistedFinalEnergyOf,
  sameEnergyCertificate,
} from '../energy-certificate';
import { CERTIFICATE_ENERGY_SOURCE_KEY } from '../energy-certificate-keys';

const LINES = [
  { source: 'electricity', perSqm: 21.5 },
  { source: 'oil', perSqm: 96.3 },
];
const sale = { type: 'apartment', offerKinds: ['sell'] };

describe('Τ1 — ο πίνακας: ολόκληρος ή καθόλου', () => {
  it('έγκυρες γραμμές ⇒ σε σειρά εντύπου, όποια σειρά κι αν γράφτηκαν', () => {
    expect(readFinalEnergy([LINES[1], LINES[0]])).toEqual(LINES);
  });

  it.each([
    ['άγνωστη πηγή', [...LINES, { source: 'coal', perSqm: 5 }]],
    ['διπλή πηγή', [...LINES, { source: 'oil', perSqm: 5 }]],
    ['μηδέν — δεν είναι γραμμή', [...LINES, { source: 'solar', perSqm: 0 }]],
    ['πάνω από το όριο', [{ source: 'oil', perSqm: MAX_FINAL_ENERGY_PER_SQM + 1 }]],
    ['δύο δεκαδικά', [{ source: 'oil', perSqm: 12.34 }]],
    ['γραμμή που δεν είναι αντικείμενο', [...LINES, 'oil']],
  ])('🔴 %s ⇒ `null` για ΟΛΟΝ τον πίνακα — όχι «οι γραμμές που κατάλαβα»', (_name, raw) => {
    expect(readFinalEnergy(raw)).toBeNull();
  });

  it('κενός πίνακας, ή ό,τι δεν είναι πίνακας ⇒ `null`', () => {
    expect(readFinalEnergy([])).toBeNull();
    expect(readFinalEnergy(undefined)).toBeNull();
    expect(readFinalEnergy({ source: 'oil', perSqm: 5 })).toBeNull();
  });

  it('η ωφέλιμη επιφάνεια είναι ΘΕΤΙΚΗ, έως το όριο, με ένα δεκαδικό', () => {
    expect(isUsefulArea(84.6)).toBe(true);
    expect(isUsefulArea(0)).toBe(false);
    expect(isUsefulArea(84.65)).toBe(false);
    expect(isUsefulArea(MAX_USEFUL_AREA + 1)).toBe(false);
  });

  it('σύγκριση πινάκων: `null` μόνο με `null`', () => {
    expect(sameFinalEnergy(LINES, [...LINES])).toBe(true);
    expect(sameFinalEnergy(LINES, null)).toBe(false);
    expect(sameFinalEnergy(null, null)).toBe(true);
    expect(sameFinalEnergy(LINES, [LINES[0], { source: 'oil', perSqm: 96.4 }])).toBe(false);
  });
});

describe('Τ2 — μέσα στο μπλοκ του πιστοποιητικού', () => {
  it('με κλάση: διαβάζονται και τα δύο', () => {
    const block = readEnergyCertificate({ class: 'D', usefulArea: 84.6, finalEnergy: LINES });
    expect(block).toMatchObject({ class: 'D', usefulArea: 84.6, finalEnergy: LINES });
  });

  it('🔴 ΧΩΡΙΣ κλάση ⇒ `null` και τα δύο — ποτέ ορφανός προσδιοριστής', () => {
    const block = readEnergyCertificate({ usefulArea: 84.6, finalEnergy: LINES, absence: 'pending' });
    expect(block).toMatchObject({ class: null, usefulArea: null, finalEnergy: null, absence: 'pending' });
  });

  it('η διόρθωση στέλνει τον πίνακα ΟΛΟΚΛΗΡΟ, και `null` τον σβήνει', () => {
    const start = readEnergyCertificate({ class: 'D', usefulArea: 84.6, finalEnergy: LINES });
    const one = applyEnergyCertificatePatch(start, { finalEnergy: [{ source: 'electricity', perSqm: 30 }] });
    expect(one.finalEnergy).toEqual([{ source: 'electricity', perSqm: 30 }]);
    expect(one.usefulArea).toBe(84.6);
    expect(applyEnergyCertificatePatch(one, { finalEnergy: null }).finalEnergy).toBeNull();
    expect(sameEnergyCertificate(start, one)).toBe(false);
    expect(sameEnergyCertificate(start, readEnergyCertificate({ ...start }))).toBe(true);
  });

  it('το σχήμα της διόρθωσης απορρίπτει διπλή πηγή, κενό πίνακα, μηδενική επιφάνεια', () => {
    expect(energyCertificatePatchSchema.safeParse({ finalEnergy: LINES, usefulArea: 84.6 }).success).toBe(true);
    for (const rejected of [
      { finalEnergy: [] },
      { finalEnergy: [LINES[0], LINES[0]] },
      { finalEnergy: [{ source: 'oil', perSqm: 5, note: 'x' }] },
      { usefulArea: 0 },
    ]) {
      expect(energyCertificatePatchSchema.safeParse(rejected).success).toBe(false);
    }
  });
});

describe('Τ3 — το δημόσιο κουτί και ο κρίκος 23', () => {
  it('η προβολή κουβαλά τα δύο πεδία· γη ⇒ `null`', () => {
    const raw = { class: 'D', primaryEnergy: 210.4, usefulArea: 84.6, finalEnergy: LINES };
    expect(listedEnergyCertificateOf(sale, raw)).toEqual({
      primaryEnergy: 210.4,
      co2Emissions: null,
      usefulArea: 84.6,
      finalEnergy: LINES,
      absence: null,
    });
    expect(listedEnergyCertificateOf({ type: 'land', offerKinds: ['sell'] }, raw)).toBeNull();
  });

  it('🔴 κουτί έκδοσης 22 ⇒ τα δύο νέα πεδία `null`, και ό,τι υπήρχε μένει αυτούσιο', () => {
    const v22 = { primaryEnergy: 132.4, co2Emissions: 38.1, absence: null };
    expect(relistedFinalEnergyOf(sale, v22)).toEqual({ ...v22, usefulArea: null, finalEnergy: null });
  });

  it('ιδιοδύναμο πάνω σε κουτί που ήδη τα έχει· σκουπίδι ⇒ `null`', () => {
    const v23 = { primaryEnergy: 132.4, co2Emissions: 38.1, absence: null, usefulArea: 84.6, finalEnergy: LINES };
    expect(relistedFinalEnergyOf(sale, v23)).toEqual(v23);
    expect(relistedFinalEnergyOf(sale, { ...v23, usefulArea: -1, finalEnergy: 'πολλά' })).toMatchObject({
      usefulArea: null,
      finalEnergy: null,
    });
    expect(relistedFinalEnergyOf({ type: 'land', offerKinds: ['sell'] }, v23)).toBeNull();
  });
});

describe('Τ4 — κάθε γραμμή του εντύπου έχει όνομα', () => {
  it('ένα κλειδί i18n ανά πηγή, όλα στο `properties-enums`, όλα διαφορετικά', () => {
    const keys = CERTIFICATE_ENERGY_SOURCES.map((source) => CERTIFICATE_ENERGY_SOURCE_KEY[source]);
    expect(new Set(keys).size).toBe(CERTIFICATE_ENERGY_SOURCES.length);
    for (const key of keys) expect(key).toMatch(/^properties-enums:energyCertificate\.source\.[a-zA-Z]+$/);
  });
});
