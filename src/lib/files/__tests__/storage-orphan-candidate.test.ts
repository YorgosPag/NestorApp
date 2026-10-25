/**
 * ADR-916 Ο24 · ADR-895 Ρ14 — το σημάδι υποψηφίου ορφανού: ΕΝΑΣ κώδικας για εφαρμογή και Cloud Functions.
 * Χρυσά διανύσματα: το legacy κλειδί είναι αυτολεξεί το προ-ADR-895 (κάθε υπάρχον σημάδι μένει έγκυρο).
 */

import { candidateDocId, fileRecordIdOfPathSegments, orphanCandidateFields, stripStorageExtension } from '../storage-orphan-candidate';

const PATH = 'companies/comp_alfa/entities/property/prop_1/files/f_plan.pdf';

describe('candidateDocId — χρυσά διανύσματα', () => {
  it('🔴 legacy = base64url(path) αυτολεξεί', () => {
    expect(candidateDocId(PATH, 'legacy-default')).toBe(Buffer.from(PATH, 'utf8').toString('base64url'));
  });

  it('🔴 άλλη θέση = base64url(`{θέση}:{path}`) — δύο κάδοι, δύο έγγραφα', () => {
    expect(candidateDocId(PATH, 'eu-originals')).toBe(Buffer.from(`eu-originals:${PATH}`, 'utf8').toString('base64url'));
    expect(candidateDocId(PATH, 'eu-originals')).not.toBe(candidateDocId(PATH, 'legacy-default'));
  });
});

describe('fileRecordIdOfPathSegments — ο κανόνας `files` του μητρώου κηδεμονίας', () => {
  it.each([
    [['entities', 'property', 'p1', 'files', 'f_plan.pdf'], 'f_plan'],
    [['files', 'f_a.b.c'], 'f_a'],
    [['files', 'noext'], 'noext'],
    [['bim', 'x.png'], null],
    [['files', '.hidden'], null],
    [['f.pdf'], null],
  ])('%j ⇒ %s', (segments, expected) => {
    expect(fileRecordIdOfPathSegments(segments)).toBe(expected);
  });

  it('η πρώτη τελεία κόβει (όπως πάντα)', () => {
    expect(stripStorageExtension('bmat_x.jpg')).toBe('bmat_x');
  });
});

describe('orphanCandidateFields — το σχήμα που διαβάζει ο sweeper', () => {
  it('χωρίς `firstSeenAt` (το γράφει ο γραφέας μόνο την πρώτη φορά) · κενά ⇒ null', () => {
    const fields = orphanCandidateFields({ storagePath: PATH, bucket: 'b', contentType: null, size: 10 }, { kind: 'orphaned', rule: 'files' }, 'TS');
    expect(fields).toEqual({
      storagePath: PATH, bucket: 'b', custodyKind: 'orphaned', custodyRule: 'files', unknownReason: null, contentType: null, size: 10, lastSeenAt: 'TS',
    });
    expect(fields).not.toHaveProperty('firstSeenAt');
  });
});
