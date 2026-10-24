/**
 * ADR-920 Β3β — «ποιο τοπογραφικό δημοσιεύει τώρα αυτό το οικόπεδο;». Μόνο ό,τι έγραψε η πόρτα (ταυτότητα),
 * δημόσιο, παραδοτέο, JSON· το νεότερο νικά. Ένα οποιοδήποτε άλλο σχέδιο DRAWINGS ΔΕΝ γίνεται ποτέ έδαφος.
 * ADR-920 Β4.4 — ο κριτής εξήχθη στο καθαρό `terrain-source-selection` (τον καλεί και ο φάκελος ιδιοκτήτη) και ρωτά
 * πλέον ΡΗΤΑ τον τύπο οντότητας: αρχείο φακέλου δεν γίνεται έδαφος εταιρικού ακινήτου, ούτε αντίστροφα.
 */

import { AGENCY_ENTITY_TYPE, type AgencyMediaCandidate } from '../agency-media-publication';
import { currentTerrainSource } from '../terrain-source-selection';

function file(id: string, over: Partial<AgencyMediaCandidate> = {}): AgencyMediaCandidate {
  return {
    id,
    entityType: 'property',
    storagePath: `companies/c1/terrain/${id}.json`,
    category: 'drawings',
    classification: 'public',
    contentType: 'application/json',
    status: 'ready',
    createdAt: '2026-10-01T08:00:00.000Z',
    publicationIdentity: 'terrain/measured',
    ...over,
  } as AgencyMediaCandidate;
}

describe('currentTerrainSource', () => {
  it('δίνει την πηγή της πόρτας ως υλικό `terrain`', () => {
    expect(currentTerrainSource([file('file_a')], AGENCY_ENTITY_TYPE)).toEqual({
      privateStoragePath: 'companies/c1/terrain/file_a.json',
      storagePlacement: undefined,
      material: { kind: 'terrain' },
      sourceFileId: 'file_a',
    });
  });

  it('🔑 ένα ανά ακίνητο: νικά η νεότερη', () => {
    const older = file('file_a', { createdAt: '2026-09-01T08:00:00.000Z' });
    const newer = file('file_b', { createdAt: '2026-10-01T08:00:00.000Z' });
    expect(currentTerrainSource([newer, older], AGENCY_ENTITY_TYPE)?.sourceFileId).toBe('file_b');
  });

  it.each([
    ['σχέδιο χωρίς ταυτότητα εδάφους', { publicationIdentity: undefined }],
    ['άλλη ταυτότητα', { publicationIdentity: 'model/as-built' }],
    ['ιδιωτικό', { classification: 'internal' }],
    ['όχι JSON', { contentType: 'application/dxf' }],
    ['όχι έτοιμο', { status: 'pending' }],
    ['διαδεγμένο', { lifecycleState: 'superseded' }],
    ['σβησμένο', { isDeleted: true }],
    ['αρχείο ΦΑΚΕΛΟΥ σε εταιρικό ακίνητο (Β4.4)', { entityType: 'property_dossier' }],
  ])('⛔ %s ⇒ κανένα έδαφος', (_label, over) => {
    expect(currentTerrainSource([file('file_a', over as Partial<AgencyMediaCandidate>)], AGENCY_ENTITY_TYPE)).toBeNull();
  });
});
