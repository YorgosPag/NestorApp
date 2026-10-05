/**
 * Άγκυρα ρίζας: ο κατάλογος **ονομάτων είδους** στάθμης (`floors:kind`) είναι δεμένος στο
 * `FLOOR_KIND_VALUES` — και το ιστορικό τον βρίσκει από **μία** εγγραφή (ADR-903 · ADR-195).
 *
 * Το ερώτημα: «υπάρχει είδος στάθμης που το ιστορικό θα έδειχνε ωμό (`stair-penthouse`);»
 */

import { AUDIT_VALUE_CATALOGS } from '@/config/audit-value-catalogs';
import { FLOOR_TRACKED_FIELDS } from '@/config/audit-tracked-fields';
import { FLOOR_KIND_VALUES } from '@/utils/floor-naming';

import el from '@/i18n/locales/el/floors.json';
import en from '@/i18n/locales/en/floors.json';

/** Η ίδια κανονικοποίηση με τον αναγνώστη (`audit-value-resolver.ts: toCamelCase`). */
const catalogKey = (kind: string): string =>
  kind.replace(/[_-]([a-z0-9])/g, (_, c: string) => c.toUpperCase());

const EXPECTED_KEYS = FLOOR_KIND_VALUES.map(catalogKey).sort();

describe('floors:kind — ο κατάλογος ονομάτων είδους στάθμης', () => {
  it.each([
    ['el', el.kind],
    ['en', en.kind],
  ])('%s: ακριβώς ένα όνομα ανά είδος του FLOOR_KIND_VALUES', (_locale, catalog) => {
    expect(Object.keys(catalog).sort()).toEqual(EXPECTED_KEYS);
  });

  it.each([
    ['el', el.kind],
    ['en', en.kind],
  ])('%s: κανένα όνομα δεν ζητά παράμετρο — ο κατάλογος τιμών καλείται χωρίς', (_locale, catalog) => {
    for (const name of Object.values(catalog)) {
      expect(name).not.toMatch(/[{}]/);
      expect(name.trim()).not.toBe('');
    }
  });

  it('το ιστορικό τον βρίσκει από ΜΙΑ εγγραφή: φιλοξενούμενα (`floorKind`) και στάθμη (`kind`)', () => {
    expect(AUDIT_VALUE_CATALOGS.floorKind).toEqual({ ns: 'floors', path: 'kind' });
    expect(FLOOR_TRACKED_FIELDS.kind.enumCatalog).toBe(AUDIT_VALUE_CATALOGS.floorKind);
  });

  it('το `kind` ΔΕΝ είναι κατάλογος ανά όνομα πεδίου — ανήκει και στις οντότητες BIM', () => {
    expect(Object.keys(AUDIT_VALUE_CATALOGS)).not.toContain('kind');
  });
});
