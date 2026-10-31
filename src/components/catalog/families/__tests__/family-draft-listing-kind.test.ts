/**
 * ADR-923 §22 — το είδος καταχώρισης στο πρόχειρο: παλιά εγγραφή δεν φαίνεται αλλαγμένη, ο δεσμός δεν ξεφεύγει από το είδος του.
 */
import type { FamilyRecord } from '@/services/catalog/catalog-api.client';
import type { CatalogFamilyDefinition } from '@/subapps/catalog/types/family';

import { emptyFamilyDraft, familyDraftOf, withListingKind, withoutFamilyAttribute } from '../family-draft';

const draft: CatalogFamilyDefinition = { ...emptyFamilyDraft(), listingKind: 'productWithInstallation', installationAttributeId: 'attr_install' };

describe('πρόχειρο οικογένειας — είδος καταχώρισης', () => {
  it('🔴 εγγραφή χωρίς τα πεδία ανοίγει ως προϊόν, με κανονικοποιημένο σχήμα ώστε να μη φαίνεται αλλαγμένη', () => {
    const { listingKind: _kind, installationAttributeId: _link, ...legacy } = emptyFamilyDraft();
    expect(familyDraftOf(legacy as FamilyRecord)).toEqual(emptyFamilyDraft());
  });

  it('το αποθηκευμένο είδος διαβάζεται αυτούσιο', () => {
    expect(familyDraftOf(draft as FamilyRecord)).toEqual(draft);
  });

  it('🔴 έξοδος από το είδος σβήνει τον δεσμό, ενώ η παραμονή τον κρατά', () => {
    expect(withListingKind(draft, 'service').installationAttributeId).toBeNull();
    expect(withListingKind(draft, 'productWithInstallation').installationAttributeId).toBe('attr_install');
  });

  it('αφαίρεση της ιδιότητας σβήνει και τον δεσμό', () => {
    expect(withoutFamilyAttribute(draft, 'attr_install').installationAttributeId).toBeNull();
  });
});
