/**
 * @jest-environment node
 *
 * @fileoverview ADR-916 Φ-Ε1 — άγκυρες της **πόρτας ανοίγματος** αρχείου του φακέλου ιδιώτη (`openDossierFile`).
 *
 * 🔑 Mock **μόνο** τα σύνορα I/O (ανάγνωση φακέλου/αρχείων · υπογραφή · ίχνος). Ο κριτής της συμμετοχής, ο κριτής
 *    «ζωντανός φάκελος» και η κρίση εύρους είναι οι **πραγματικοί**.
 *
 * | Μετάλλαξη | Κοκκινίζει |
 * |---|---|
 * | σύνδεσμος χωρίς ίχνος (ίχνος `null` αγνοείται · ίχνος μετά την επιστροφή) | Ο1 |
 * | ανακλημένη / ληγμένη / ξένη συμμετοχή ανοίγει | Ο2 |
 * | ο φάκελος άλλαξε χέρια / αρχειοθετήθηκε και ανοίγει ακόμη | Ο3 |
 * | αρχείο εκτός εύρους (καρτέλα · εξαίρεση) ανοίγει | Ο4 |
 * | το ίχνος γράφεται σε βιβλίο άλλου από τον κάτοχο / χωρίς τον επαγγελματία | Ο5 |
 * | το ίχνος πάει **εκτός** Ιστορικού του φακέλου (βιβλίο αρχείου · οντότητα `engagement`) · χωρίς όνομα αρχείου · λάθος τρόπος | Ο5 |
 */

jest.mock('server-only', () => ({}));
jest.mock('@/lib/telemetry', () => ({ createModuleLogger: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }) }));

const mockReadDossier = jest.fn();
const mockReadFiles = jest.fn();
jest.mock('../dossier-media.reader', () => ({
  readPropertyDossier: (...args: unknown[]) => mockReadDossier(...args),
  readDossierReadyFiles: (...args: unknown[]) => mockReadFiles(...args),
}));
const mockSign = jest.fn();
jest.mock('@/lib/storage/signed-download-url', () => ({ signedDownloadUrl: (...args: unknown[]) => mockSign(...args) }));
jest.mock('@/server/files/file-record-bucket', () => ({ fileRecordBucket: () => ({ name: 'bucket' }) }));
const mockAudit = jest.fn();
jest.mock('@/services/entity-audit.service', () => ({
  EntityAuditService: { recordChange: (...args: unknown[]) => mockAudit(...args) },
}));

import type { Firestore } from 'firebase-admin/firestore';

import { activeDossierByInvitation } from '@/lib/auth/engagement-dossier-plan';
import type { DossierEngagement } from '@/types/engagement';
import type { PropertyDossier } from '@/types/property-dossier';
import { personalWorkspace } from '@/types/workspace-membership';
import { openDossierFile } from '../dossier-file-access.service';

const NOW = Date.parse('2026-11-17T10:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const db = {} as unknown as Firestore;

const DOSSIER: PropertyDossier = {
  id: 'pdos_1', userId: 'u_owner', label: 'Σπίτι', type: 'land', lifecycle: 'active', origin: null,
  createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
};

const DEED = {
  id: 'file_deed', userId: 'u_owner', entityType: 'property_dossier', entityId: 'pdos_1', status: 'ready', isDeleted: false,
  domain: 'admin', category: 'documents', purpose: 'study-title-deed', contentType: 'application/pdf',
  storagePath: 'people/u_owner/entities/property_dossier/pdos_1/files/file_deed.pdf', displayName: 'Τίτλος.pdf',
};

function engagement(overrides: Partial<DossierEngagement> = {}): DossierEngagement {
  return {
    ...activeDossierByInvitation({
      subject: { kind: 'property_dossier', dossierId: 'pdos_1' }, role: 'owner_lawyer', uid: 'u_lawyer',
      email: 'l@example.gr', invitationId: 'inv_1',
      declaredCredential: { authority: 'notary-association', number: '1', chapter: 'Αθηνών', assurance: 'declared', declaredAt: new Date(NOW).toISOString() },
      actingFor: personalWorkspace('u_lawyer'), reach: { tabs: ['documents'], excludedFileIds: [] }, shareDays: 30,
      offeredBy: 'u_owner', nowMs: NOW - DAY,
    }),
    ...overrides,
  };
}

const request = { uid: 'u_lawyer', email: 'l@example.gr', engagementId: 'eng_1', fileId: 'file_deed', mode: 'view' as const, nowMs: NOW };

beforeEach(() => {
  jest.clearAllMocks();
  mockReadDossier.mockResolvedValue(DOSSIER);
  mockReadFiles.mockResolvedValue([DEED]);
  mockSign.mockResolvedValue({ outcome: 'signed', url: 'https://signed', expiresAt: NOW + 15 * 60 * 1000 });
  mockAudit.mockResolvedValue('audit_1');
});

describe('ADR-916 Φ-Ε1 — `openDossierFile`', () => {
  it('ζωντανή συμμετοχή + αρχείο στο εύρος ⇒ σύνδεσμος, ΑΦΟΥ γραφτεί το ίχνος', async () => {
    const opened = await openDossierFile(db, engagement({ id: 'eng_1' }), request);
    expect(opened).toMatchObject({ ok: true, url: 'https://signed' });
    expect(mockAudit).toHaveBeenCalledTimes(1);
  });

  it('Ο1 — ίχνος που δεν γράφτηκε (`null`) ⇒ `failed`, ΚΑΝΕΝΑΣ σύνδεσμος', async () => {
    mockAudit.mockResolvedValueOnce(null);
    expect(await openDossierFile(db, engagement(), request)).toEqual({ ok: false, rejection: 'failed' });
  });

  it('Ο1 — ίχνος που ρίχνει ⇒ `failed`, κανένας σύνδεσμος', async () => {
    mockAudit.mockRejectedValueOnce(new Error('down'));
    expect(await openDossierFile(db, engagement(), request)).toEqual({ ok: false, rejection: 'failed' });
  });

  it('Ο2 — ανακλημένη ⇒ `denied` χωρίς ανάγνωση, υπογραφή ή ίχνος', async () => {
    const revoked = engagement({ state: 'revoked', revokedAt: new Date(NOW - 1).toISOString(), revokedBy: 'u_owner' });
    expect(await openDossierFile(db, revoked, request)).toMatchObject({ ok: false, rejection: 'denied', verdict: 'revoked' });
    expect(mockReadFiles).not.toHaveBeenCalled();
    expect(mockSign).not.toHaveBeenCalled();
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it('Ο2 — ληγμένη ή ξένη ⇒ `denied`', async () => {
    expect(await openDossierFile(db, engagement({ expiresAt: new Date(NOW - 1).toISOString() }), request))
      .toMatchObject({ ok: false, rejection: 'denied', verdict: 'expired' });
    expect(await openDossierFile(db, engagement(), { ...request, uid: 'u_stranger' }))
      .toMatchObject({ ok: false, rejection: 'denied' });
  });

  it('Ο3 — ο φάκελος άλλαξε χέρια ή αρχειοθετήθηκε ⇒ `not-found` (≡ ανύπαρκτος), κανένα ίχνος', async () => {
    mockReadDossier.mockResolvedValueOnce({ ...DOSSIER, userId: 'u_new_owner' });
    expect(await openDossierFile(db, engagement(), request)).toEqual({ ok: false, rejection: 'not-found' });
    mockReadDossier.mockResolvedValueOnce({ ...DOSSIER, lifecycle: 'archived' });
    expect(await openDossierFile(db, engagement(), request)).toEqual({ ok: false, rejection: 'not-found' });
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it('Ο4 — αρχείο εκτός εύρους (καρτέλα · εξαίρεση · ανύπαρκτο) ⇒ `not-found`, κανένας σύνδεσμος', async () => {
    expect(await openDossierFile(db, engagement({ reach: { tabs: ['photos'], excludedFileIds: [] } }), request))
      .toEqual({ ok: false, rejection: 'not-found' });
    expect(await openDossierFile(db, engagement({ reach: { tabs: ['documents'], excludedFileIds: ['file_deed'] } }), request))
      .toEqual({ ok: false, rejection: 'not-found' });
    expect(await openDossierFile(db, engagement(), { ...request, fileId: 'file_other' }))
      .toEqual({ ok: false, rejection: 'not-found' });
    expect(mockSign).not.toHaveBeenCalled();
  });

  it('Ο5 — το ίχνος γράφεται στο ΙΣΤΟΡΙΚΟ ΤΟΥ ΦΑΚΕΛΟΥ (προσωπικό βιβλίο του κατόχου), με τον επαγγελματία ως δράστη', async () => {
    await openDossierFile(db, engagement({ id: 'eng_1' }), { ...request, mode: 'download' });
    expect(mockAudit).toHaveBeenCalledWith({
      entityType: 'property_dossier', entityId: 'pdos_1', entityName: 'Σπίτι', userId: 'u_owner',
      action: 'document_accessed', performedBy: 'u_lawyer', performedByName: 'l@example.gr',
      changes: [{ field: 'ownerLawyerDossierDocumentDownload', oldValue: null, newValue: 'file_deed', newValueLabel: 'Τίτλος.pdf' }],
    });
  });

  it('Ο5 — προβολή ⇒ το πεδίο της προβολής (όχι της λήψης)', async () => {
    await openDossierFile(db, engagement({ id: 'eng_1' }), request);
    expect(mockAudit.mock.calls[0][0].changes[0].field).toBe('ownerLawyerDossierDocumentView');
  });
});
