/**
 * ADR-901 Φ4.5 (ζωντανή δοκιμή 2026-10-04) — ο τίτλος ανεβάσματος από entry point.
 *
 * Το σφάλμα που φυλάει: η ροή προχείρων της υπόθεσης δεν έδινε τίτλο και το όνομα του αρχείου έβγαινε με ωμό κλειδί
 * σκοπού («Συμβόλαια contract_draft»). Η άγκυρα ρωτά τον **πραγματικό** κατάλογο της υπόθεσης.
 */

import { ENTITY_TYPES } from '@/config/domain-constants';
import { entryPointUploadTitle } from '../entry-point-title';
import { getEntryPointsForEntity } from '../queries';

describe('entryPointUploadTitle', () => {
  it('κάθε entry point της υπόθεσης δίνει την ελληνική ετικέτα του — ποτέ τον σκοπό', () => {
    const entryPoints = getEntryPointsForEntity(ENTITY_TYPES.CONVEYANCE_CASE);
    expect(entryPoints.length).toBeGreaterThan(0);
    for (const entryPoint of entryPoints) {
      const title = entryPointUploadTitle(entryPoint);
      expect(title).toBe(entryPoint.label.el);
      expect(title).not.toBe(entryPoint.purpose);
    }
  });

  it('όπου ζητείται τίτλος από τον άνθρωπο, νικά ό,τι έγραψε', () => {
    const entryPoint = { label: { el: 'Άλλο', en: 'Other' }, requiresCustomTitle: true };
    expect(entryPointUploadTitle(entryPoint, 'Δικός μου τίτλος')).toBe('Δικός μου τίτλος');
  });

  it('χωρίς entry point ⇒ κανένας τίτλος (η ροή διαλέγει τη δική της προεπιλογή)', () => {
    expect(entryPointUploadTitle(undefined)).toBeUndefined();
  });
});
