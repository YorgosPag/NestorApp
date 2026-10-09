/**
 * ADR-909 Γ1β — `meshAssetOf`: «από ποιο σχήμα ζωγραφίζεται αυτό το στοιχείο;» (SSoT).
 *
 * Το ρωτούν οι τρεις ζωγράφοι, η προφόρτωση της λήψης και η εξαγωγή DXF. Αν απαντήσει άλλο κλειδί από αυτό που
 * γνωρίζει το `bimMeshCache`, η προφόρτωση ζεσταίνει εγγραφή που κανείς δεν ζητά — άρα τα κλειδιά καρφώνονται εδώ.
 */

import { FURNITURE_MESH_CATEGORY, meshAssetOf } from '../entity-mesh-asset';

describe('meshAssetOf (ADR-909 Γ1β)', () => {
  it('Μ1 έπιπλο ⇒ κατηγορία `furniture` + το `assetId` του', () => {
    expect(meshAssetOf({ type: 'furniture', params: { assetId: 'chair_01' } })).toStrictEqual({
      category: FURNITURE_MESH_CATEGORY,
      assetId: 'chair_01',
    });
    expect(FURNITURE_MESH_CATEGORY).toBe('furniture');
  });

  it('Μ2 είδος Η/Μ: η κατηγορία βγαίνει από το ΕΙΔΟΣ (υγιεινής · συσκευή · φωτιστικό)', () => {
    const of = (kind: string) => meshAssetOf({ type: 'mep-fixture', params: { kind, assetId: 'a1' } });
    expect(of('wc')).toStrictEqual({ category: 'sanitary', assetId: 'a1' });
    expect(of('light-fixture')).toStrictEqual({ category: 'light-fixture', assetId: 'a1' });
  });

  it('Μ3 🔴 είδος Η/Μ ΧΩΡΙΣ `assetId` ⇒ `null`: έχει παραμετρικό σύμβολο, δεν του λείπει σχήμα', () => {
    expect(meshAssetOf({ type: 'mep-fixture', params: { kind: 'light-fixture' } })).toBeNull();
    expect(meshAssetOf({ type: 'mep-fixture', params: { kind: 'wc', assetId: '' } })).toBeNull();
  });

  it('Μ4 εισαγόμενο πλέγμα ⇒ `imported` + `<uploadId>#<nodeName>` (ο κόμβος, όχι το αρχείο)', () => {
    expect(meshAssetOf({ type: 'imported-mesh', params: { uploadId: 'imesh_a', nodeName: 'Rail_01' } })).toStrictEqual({
      category: 'imported',
      assetId: 'imesh_a#Rail_01',
    });
    expect(meshAssetOf({ type: 'imported-mesh', params: { uploadId: 'imesh_a' } })).toBeNull();
  });

  it('Μ5 κάθε άλλος τύπος, και στοιχείο χωρίς `params` ⇒ `null`', () => {
    expect(meshAssetOf({ type: 'wall', params: { assetId: 'x' } })).toBeNull();
    expect(meshAssetOf({ type: 'line' })).toBeNull();
    expect(meshAssetOf({ type: 'furniture' })).toBeNull();
  });
});
