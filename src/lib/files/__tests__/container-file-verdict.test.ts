/**
 * ⚓ ADR-777 §8.96 · ADR-900 §3.8 — ο ΕΝΑΣ κριτής «είναι αυτό το αρχείο ΤΟΥ δοχείου που ρωτά;», πριν διαβαστεί byte.
 */

import { judgeContainerFile, type ExpectedContainer } from '../container-file-verdict';

const PERSONAL: ExpectedContainer = {
  owner: { kind: 'personal', userId: 'u1' },
  entityType: 'property_dossier',
  entityId: 'pdos_1',
  contentType: 'application/pdf',
};

const COMPANY: ExpectedContainer = {
  owner: { kind: 'company', companyId: 'c1' },
  entityType: 'property',
  entityId: 'prop_1',
  contentType: 'application/pdf',
};

const personalFile = {
  userId: 'u1',
  entityType: 'property_dossier',
  entityId: 'pdos_1',
  status: 'ready',
  contentType: 'application/pdf',
  storagePath: 'people/u1/entities/property_dossier/pdos_1/x.pdf',
  storagePlacement: { bucket: 'b' },
};

const companyFile = { ...personalFile, userId: undefined, companyId: 'c1', entityType: 'property', entityId: 'prop_1' };

describe('Δ1 — αποδοχή', () => {
  it.each([
    ['ιδιωτικός φάκελος', personalFile, PERSONAL],
    ['εταιρικό ακίνητο', companyFile, COMPANY],
  ] as const)('%s', (_name, data, expected) => {
    expect(judgeContainerFile('file_1', data, expected)).toEqual({
      kind: 'accepted',
      file: { fileId: 'file_1', storagePath: personalFile.storagePath, storagePlacement: { bucket: 'b' } },
    });
  });
});

describe('Δ2 — 🔒 μόνωση: ξένο id δεν διαβάζει έγγραφο άλλου', () => {
  it.each([
    ['άλλος άνθρωπος', { ...personalFile, userId: 'u2' }, PERSONAL],
    ['άλλος φάκελος', { ...personalFile, entityId: 'pdos_2' }, PERSONAL],
    ['άλλο είδος δοχείου', { ...personalFile, entityType: 'property' }, PERSONAL],
    ['άλλη εταιρεία', { ...companyFile, companyId: 'c2' }, COMPANY],
    ['εταιρικό αρχείο σε ιδιωτικό αίτημα', companyFile, PERSONAL],
    ['δοχείο που δεν υπάρχει (αγγελία χωρίς φάκελο)', personalFile, { ...PERSONAL, entityId: null }],
  ] as const)('%s ⇒ file-not-yours', (_name, data, expected) => {
    expect(judgeContainerFile('file_1', data, expected)).toEqual({ kind: 'refused', reason: 'file-not-yours' });
  });
});

describe('Δ3 — κατάσταση και τύπος', () => {
  it('ανύπαρκτο ή στον κάδο ⇒ file-missing', () => {
    expect(judgeContainerFile('file_1', null, PERSONAL)).toEqual({ kind: 'refused', reason: 'file-missing' });
    expect(judgeContainerFile('file_1', { ...personalFile, isDeleted: true }, PERSONAL)).toEqual({ kind: 'refused', reason: 'file-missing' });
  });

  it('δεν ολοκλήρωσε το ανέβασμα (ή χωρίς διαδρομή) ⇒ file-not-ready', () => {
    expect(judgeContainerFile('file_1', { ...personalFile, status: 'pending' }, PERSONAL)).toMatchObject({ reason: 'file-not-ready' });
    expect(judgeContainerFile('file_1', { ...personalFile, storagePath: '' }, PERSONAL)).toMatchObject({ reason: 'file-not-ready' });
  });

  it('άλλος τύπος ⇒ file-wrong-type', () => {
    expect(judgeContainerFile('file_1', { ...personalFile, contentType: 'image/jpeg' }, PERSONAL)).toMatchObject({ reason: 'file-wrong-type' });
  });
});
