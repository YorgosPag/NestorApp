/**
 * @jest-environment node
 *
 * ADR-909 §6.2 — ΑΓΚΥΡΕΣ του **συμβολαίου του σύρματος** της «Δημοσίευσης κάτοψης».
 *
 *   Σ1  κάθε κωδικός `FLOORPLAN_*` που γράφει η ΠΗΓΗ της πόρτας υπάρχει στην κλειστή λίστα
 *   Σ2  κάθε κωδικός της λίστας γράφεται πράγματι στην πόρτα — καμία γραμμή-φάντασμα
 *   Σ3  κάθε κωδικός έχει ανθρώπινο μήνυμα σε `el` ΚΑΙ `en`, και κανένα μήνυμα δεν περισσεύει
 *   Σ4  `isFloorplanRefusalCode` δέχεται μόνο τη λίστα
 *
 * 🔑 Η Σ1 διαβάζει **κείμενο πηγής**, επίτηδες: ο τύπος `FloorplanRefusalCode` πιάνει το ίδιο λάθος στη
 * μεταγλώττιση, αλλά ο πράκτορας δεν τρέχει `tsc` (N.17) — η άγκυρα το πιάνει στο jest.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  FLOORPLAN_REFUSAL_CODES,
  isFloorplanRefusalCode,
} from '../floorplan-publication-contract';

const SRC = join(__dirname, '..', '..', '..');
const DOOR_SOURCE = readFileSync(join(SRC, 'app/api/properties/[id]/floorplan/route.ts'), 'utf8');

/** Κυριολεκτικά `'FLOORPLAN_…'` — μόνο ό,τι είναι **μέσα σε εισαγωγικά**, άρα όχι ονόματα σταθερών. */
const literalsOf = (source: string): string[] =>
  [...new Set([...source.matchAll(/'(FLOORPLAN_[A-Z_]+)'/g)].map((match) => match[1]))].sort();

function refusalMessagesOf(language: 'el' | 'en'): Record<string, unknown> {
  const file = join(SRC, 'i18n', 'locales', language, 'dxf-viewer-shell.json');
  const locale = JSON.parse(readFileSync(file, 'utf8')) as { publishFloorplan?: { refusals?: Record<string, unknown> } };
  return locale.publishFloorplan?.refusals ?? {};
}

describe('ADR-909 — συμβόλαιο σύρματος της δημοσίευσης κάτοψης', () => {
  it('Σ1+Σ2 οι κωδικοί της πόρτας ΕΙΝΑΙ η κλειστή λίστα — ούτε ένας παραπάνω, ούτε ένας λιγότερος', () => {
    expect(literalsOf(DOOR_SOURCE)).toStrictEqual([...FLOORPLAN_REFUSAL_CODES].sort());
  });

  it.each(['el', 'en'] as const)('Σ3 [%s] κάθε κωδικός έχει μήνυμα, και κανένα μήνυμα δεν είναι ορφανό', (language) => {
    const messages = refusalMessagesOf(language);
    const serverCodes = Object.keys(messages).filter((key) => key.startsWith('FLOORPLAN_')).sort();

    expect(serverCodes).toStrictEqual([...FLOORPLAN_REFUSAL_CODES].sort());
    for (const code of FLOORPLAN_REFUSAL_CODES) {
      expect(typeof messages[code]).toBe('string');
      expect(String(messages[code]).trim().length).toBeGreaterThan(10);
    }
  });

  it('Σ4 μόνο η λίστα περνά', () => {
    expect(isFloorplanRefusalCode('FLOORPLAN_SHELF_FULL')).toBe(true);
    expect(isFloorplanRefusalCode('FLOORPLAN_SOMETHING_ELSE')).toBe(false);
    expect(isFloorplanRefusalCode(undefined)).toBe(false);
  });
});
