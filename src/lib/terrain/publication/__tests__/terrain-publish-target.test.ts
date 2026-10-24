/**
 * ADR-920 Β4.7 — ΑΓΚΥΡΕΣ των δύο θυρών «πού δημοσιεύεται το τοπογραφικό».
 *
 *   Θ1  γραφείο: σωσμένο οικόπεδο ⇒ η πόρτα του · ακίνητο που δεν σώθηκε / χωρίς id / κανένα ⇒ `null`
 *   Θ2  Δ1: μόνο γη — διαμέρισμα ή άγνωστος τύπος ⇒ `null` (αλλιώς κουμπί που η πόρτα αρνείται με `TERRAIN_NOT_LAND`)
 *   Θ3  ιδιοκτήτης: προσωπική θεματοφυλακή ΜΕ φάκελο ⇒ η πόρτα του φακέλου · χωρίς φάκελο ⇒ `null` (`TERRAIN_NO_DOSSIER`)
 *   Θ4  μεσιτευμένη αγγελία (εταιρική θεματοφυλακή) ⇒ `null`, ακόμη και με φάκελο
 *   Σ1  ο ΕΝΑΣ ορισμός του «σωσμένου»: `'__new__'`, κενό, `null`, `undefined` ⇒ όχι
 */

import { isPersistedPropertyId, UNSAVED_PROPERTY_ID } from '@/lib/properties/unsaved-property';

import { companyPropertyTerrainTarget, ownerPropertyTerrainTarget } from '../terrain-publish-target';

const OWNER = { id: 'ownp_1', type: 'plot', dossierId: 'dos_1', authorUserId: 'usr_1', authorCompanyId: null } as const;

describe('Θ — η θύρα του γραφείου', () => {
  it('Θ1 σωσμένο οικόπεδο ⇒ η πόρτα του · αλλιώς `null`', () => {
    expect(companyPropertyTerrainTarget({ id: 'prop_1', type: 'plot' })).toStrictEqual({ kind: 'property', propertyId: 'prop_1' });
    expect(companyPropertyTerrainTarget({ id: UNSAVED_PROPERTY_ID, type: 'plot' })).toBeNull();
    expect(companyPropertyTerrainTarget({ type: 'plot' })).toBeNull();
    expect(companyPropertyTerrainTarget(null)).toBeNull();
  });

  it('Θ2 μόνο γη', () => {
    expect(companyPropertyTerrainTarget({ id: 'prop_1', type: 'apartment' })).toBeNull();
    expect(companyPropertyTerrainTarget({ id: 'prop_1', type: null })).toBeNull();
    expect(ownerPropertyTerrainTarget({ ...OWNER, type: 'apartment' })).toBeNull();
  });
});

describe('Θ — η θύρα του ιδιοκτήτη', () => {
  it('Θ3 προσωπική θεματοφυλακή με φάκελο ⇒ η πόρτα του φακέλου · χωρίς φάκελο ⇒ `null`', () => {
    expect(ownerPropertyTerrainTarget(OWNER)).toStrictEqual({ kind: 'owner-property', ownerPropertyId: 'ownp_1' });
    expect(ownerPropertyTerrainTarget({ ...OWNER, dossierId: undefined })).toBeNull();
    expect(ownerPropertyTerrainTarget({ ...OWNER, dossierId: '' })).toBeNull();
  });

  it('Θ4 μεσιτευμένη αγγελία ⇒ `null`, ακόμη και με φάκελο', () => {
    expect(ownerPropertyTerrainTarget({ ...OWNER, authorCompanyId: 'comp_1' })).toBeNull();
  });
});

describe('Σ — το «σωσμένο» ακίνητο', () => {
  it('Σ1 ο δείκτης θέσης, το κενό και η απουσία δεν είναι ταυτότητα', () => {
    expect(isPersistedPropertyId('prop_1')).toBe(true);
    for (const id of [UNSAVED_PROPERTY_ID, '', null, undefined]) expect(isPersistedPropertyId(id)).toBe(false);
  });
});
