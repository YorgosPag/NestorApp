/**
 * @fileoverview ADR-934 §5.2.2 Μ-β5 — **ο κριτής κατάστασης του περιεχομένου καραντίνας**: κάθε μία από τις πέντε καταστάσεις, και
 *   η ταυτότητα («δική μας;») κρίνεται με τον ΙΔΙΟ τρόπο σε ζωντανή, κάδο και επιτύμβιο — ξένο στον κάδο δεν γίνεται «δικό μας».
 */

import { mediaContentStateOf } from '../media-content-state';

const SHA = 'a'.repeat(64);
const identity = { companyId: 'comp_1', fileId: 'file_1', sha256: SHA };

const live = {
  companyId: 'comp_1', entityType: 'catalog_media_content', entityId: SHA, status: 'ready', isDeleted: false,
  storagePath: 'companies/comp_1/catalog/documents/file_1.pdf', contentType: 'application/pdf',
};
const trashed = { ...live, isDeleted: true, lifecycleState: 'trashed' };
const purged = { ...trashed, lifecycleState: 'purged' };

describe('mediaContentStateOf', () => {
  it.each([
    ['ζωντανή', live, 'live'],
    ['στον κάδο', trashed, 'trashed'],
    ['μόνο `lifecycleState: trashed` (χωρίς legacy σημάδι)', { ...live, lifecycleState: 'trashed' }, 'trashed'],
    ['επιτύμβιο', purged, 'purged'],
    ['καμία εγγραφή', null, 'absent'],
  ] as const)('%s ⇒ %s', (_name, data, expected) => {
    expect(mediaContentStateOf(identity, data)).toBe(expected);
  });

  it.each([
    ['ζωντανή', live],
    ['στον κάδο', trashed],
    ['επιτύμβιο', purged],
  ])('🔴 %s ΑΛΛΟΥ χώρου ⇒ foreign (ποτέ επαναφορά/αναγέννηση ξένου)', (_name, data) => {
    expect(mediaContentStateOf(identity, { ...data, companyId: 'comp_2' })).toBe('foreign');
  });

  it.each([
    ['ζωντανή', live],
    ['στον κάδο', trashed],
    ['επιτύμβιο', purged],
  ])('🔴 %s με ΑΛΛΑ bytes στο ίδιο κλειδί ⇒ foreign', (_name, data) => {
    expect(mediaContentStateOf(identity, { ...data, entityId: 'f'.repeat(64) })).toBe('foreign');
  });

  it('ανολοκλήρωτη (όχι `ready`) ⇒ foreign — δεν υιοθετείται εγγραφή χωρίς bytes', () => {
    expect(mediaContentStateOf(identity, { ...live, status: 'pending' })).toBe('foreign');
  });
});
