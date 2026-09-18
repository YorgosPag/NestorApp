/**
 * @fileoverview 🏆 **ΑΓΚΥΡΑ Α37.6 του ADR-866 Φ1.2** — πώς χωρίζονται/ταξινομούνται οι φάκελοι, και πώς λέγεται η κάτοψη.
 * @related ADR-866 §2.9.6 · §2.9.8 Δ2 · §2.7.1 · lib/property-dossier/property-dossier-view.ts
 *
 * | Μετάλλαξη | Αποτέλεσμα |
 * |---|---|
 * | ταξινόμηση αύξουσα | «πιο πρόσφατη πρώτη» ⇒ 🔴 |
 * | αρχειοθετημένοι μέσα στους ενεργούς | «χωρίζει» ⇒ 🔴 |
 * | «τοπογραφικό» με λίστα ειδών αντί της κλάσης | «κάθε είδος γης» ⇒ 🔴 (αν η λίστα ξεχάσει ένα) |
 */

import { PROPERTY_TYPES, PROPERTY_TYPE_CLASS } from '@/constants/property-types';
import { floorplanTabKind, partitionDossiers } from '@/lib/property-dossier/property-dossier-view';
import type { PropertyDossier } from '@/types/property-dossier';

function dossier(id: string, lifecycle: PropertyDossier['lifecycle'], updatedAt: string): PropertyDossier {
  return { id, userId: 'u', label: id, type: null, lifecycle, createdAt: '2026-01-01T00:00:00.000Z', updatedAt };
}

describe('🏆 Α37.6 — `partitionDossiers`', () => {
  const list = [
    dossier('old-active', 'active', '2026-09-01T10:00:00.000Z'),
    dossier('archived', 'archived', '2026-09-10T10:00:00.000Z'),
    dossier('new-active', 'active', '2026-09-15T10:00:00.000Z'),
  ];

  it('χωρίζει κατά κύκλο ζωής — ο αρχειοθετημένος ΔΕΝ είναι στους ενεργούς', () => {
    const { active, archived } = partitionDossiers(list);

    expect(active.map((d) => d.id)).toEqual(['new-active', 'old-active']);
    expect(archived.map((d) => d.id)).toEqual(['archived']);
  });

  it('πιο πρόσφατη αλλαγή πρώτη· ισοπαλία ⇒ σταθερή σειρά κατά ταυτότητα', () => {
    const tied = [dossier('b', 'active', '2026-09-01T00:00:00.000Z'), dossier('a', 'active', '2026-09-01T00:00:00.000Z')];

    expect(partitionDossiers(tied).active.map((d) => d.id)).toEqual(['a', 'b']);
  });

  it('κάθε κύκλος ζωής έχει κλειδί — και ο άδειος (η οθόνη μετρά `0`, όχι `undefined`)', () => {
    expect(partitionDossiers([])).toEqual({ active: [], archived: [] });
  });

  it('δεν αλλάζει τη λίστα εισόδου (η ζωντανή κατάσταση του hook μένει ανέγγιχτη)', () => {
    const input = [...list];
    partitionDossiers(input);
    expect(input).toEqual(list);
  });
});

describe('🏆 Α37.6 — `floorplanTabKind`: σε ΓΗ δεν υπάρχει κάτοψη, υπάρχει τοπογραφικό (§2.7.1)', () => {
  it.each(PROPERTY_TYPES.map((type) => [type, PROPERTY_TYPE_CLASS[type]] as const))(
    '%s (κλάση %s)',
    (type, cls) => {
      expect(floorplanTabKind(type)).toBe(cls === 'land' ? 'topographic' : 'floorplan');
    },
  );

  it('άγνωστο είδος ⇒ κάτοψη (η συνήθης περίπτωση)', () => {
    expect(floorplanTabKind(null)).toBe('floorplan');
  });
});
