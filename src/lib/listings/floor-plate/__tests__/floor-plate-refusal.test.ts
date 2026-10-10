/**
 * @fileoverview Άγκυρες της **άρνησης της δήλωσης ορόφου, από το σύρμα ως τον άνθρωπο** (ADR-907 §11.10).
 *
 * | # | Κανόνας | Μετάλλαξη που πιάνει |
 * |---|---|---|
 * | ΑΡ-1 | ό,τι **γράφει** η πόρτα το **διαβάζει** η οθόνη, για **κάθε** άρνηση | πεδίο σε άλλη θέση (π.χ. μέσα σε `details`) |
 * | ΑΡ-2 | ξένο σφάλμα ή άγνωστο `why` **δεν** γίνεται πρόταση | ανάγνωση χωρίς διακριτή · `in` αντί για ίδιο κλειδί |
 * | ΑΡ-3 | κάθε πρόταση έχει **λέξεις** σε el **και** en, και καμία ορφανή | κλειδί που λείπει (ωμό κλειδί στην οθόνη) |
 * | ΑΡ-4 | οι δύο γλώσσες της δήλωσης έχουν τα **ίδια** κλειδιά | κλειδί μόνο στη μία γλώσσα |
 */

import elBuildingTabs from '@/i18n/locales/el/building-tabs.json';
import enBuildingTabs from '@/i18n/locales/en/building-tabs.json';

import { FLOOR_PLATE_REFUSED_CODE, type FloorPlateRefusal } from '../floor-plate-declaration';
import {
  FLOOR_PLATE_REFUSAL_MESSAGE,
  floorPlateRefusalBody,
  readFloorPlateRefusal,
} from '../floor-plate-refusal';

const REFUSALS = Object.keys(FLOOR_PLATE_REFUSAL_MESSAGE) as FloorPlateRefusal[];
const MESSAGES = [...new Set(Object.values(FLOOR_PLATE_REFUSAL_MESSAGE))].sort();

const LOCALES = { el: elBuildingTabs.tabs.floors.floorPlate, en: enBuildingTabs.tabs.floors.floorPlate };

/** Κάθε φύλλο ενός αντικειμένου locale, ως μονοπάτι με τελείες. */
function leafPaths(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [prefix];
  return Object.entries(node).flatMap(([key, value]) => leafPaths(value, prefix === '' ? key : `${prefix}.${key}`));
}

describe('ΑΡ-1 — γραφή και ανάγνωση του σώματος συμφωνούν', () => {
  it('το λεξιλόγιο δεν είναι κενό (μάρτυρας: ο βρόχος παρακάτω εκτελείται)', () => {
    expect(REFUSALS.length).toBeGreaterThan(20);
  });

  it.each(REFUSALS)('«%s» επιβιώνει τον γύρο, με το περίγραμμα που φταίει', (why) => {
    const body: unknown = JSON.parse(JSON.stringify(floorPlateRefusalBody({ why, overlayId: 'ovl_7' })));
    expect(readFloorPlateRefusal(body)).toEqual({ why, overlayId: 'ovl_7' });
  });

  it('άρνηση χωρίς περίγραμμα διαβάζεται με `overlayId: null`', () => {
    const body: unknown = JSON.parse(JSON.stringify(floorPlateRefusalBody({ why: 'image-not-public', overlayId: null })));
    expect(readFloorPlateRefusal(body)).toEqual({ why: 'image-not-public', overlayId: null });
  });

  it('το σώμα είναι φάκελος σφάλματος: `success: false` και ο κωδικός της πόρτας στη ρίζα', () => {
    const body = floorPlateRefusalBody({ why: 'unlinked-outline', overlayId: 'ovl_1' });
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe(FLOOR_PLATE_REFUSED_CODE);
  });
});

describe('ΑΡ-2 — μόνο η άρνηση της πόρτας γίνεται πρόταση', () => {
  const refusal = floorPlateRefusalBody({ why: 'frame-mismatch', overlayId: null });

  it.each([
    ['ξένος κωδικός με πεδίο `why`', { ...refusal, errorCode: 'DELETION_BLOCKED' }],
    ['χωρίς κωδικό', { why: 'frame-mismatch' }],
    ['άγνωστο `why`', { ...refusal, why: 'brand-new-reason' }],
    ['`why` που είναι όνομα του πρωτοτύπου', { ...refusal, why: 'toString' }],
    ['`why` που δεν είναι συμβολοσειρά', { ...refusal, why: 7 }],
    ['το `why` θαμμένο σε `details`', { errorCode: FLOOR_PLATE_REFUSED_CODE, details: { why: 'frame-mismatch' } }],
    ['πίνακας', [refusal]],
    ['null', null],
    ['κείμενο', 'Floor plate refused: frame-mismatch'],
  ])('%s ⇒ null', (_name, body) => {
    expect(readFloorPlateRefusal(body)).toBeNull();
  });

  it('κενό ή μη κειμενικό `overlayId` διαβάζεται ως «κανένα περίγραμμα»', () => {
    expect(readFloorPlateRefusal({ ...refusal, overlayId: '  ' })?.overlayId).toBeNull();
    expect(readFloorPlateRefusal({ ...refusal, overlayId: 12 })?.overlayId).toBeNull();
  });
});

describe.each(Object.entries(LOCALES))('ΑΡ-3 — οι λέξεις της άρνησης (%s)', (_language, locale) => {
  it.each(MESSAGES)('η πρόταση «%s» έχει κείμενο', (message) => {
    const text: unknown = (locale.refusal as Record<string, unknown>)[message];
    expect(typeof text).toBe('string');
    expect((text as string).trim().length).toBeGreaterThan(10);
  });

  it('καμία ορφανή πρόταση: ό,τι έχει λέξεις, το ζητά κάποια άρνηση', () => {
    expect(Object.keys(locale.refusal).sort()).toEqual(MESSAGES);
  });
});

describe('ΑΡ-4 — el και en έχουν τα ίδια κλειδιά', () => {
  it('ολόκληρο το κουτί `tabs.floors.floorPlate`', () => {
    expect(leafPaths(LOCALES.en).sort()).toEqual(leafPaths(LOCALES.el).sort());
  });
});
