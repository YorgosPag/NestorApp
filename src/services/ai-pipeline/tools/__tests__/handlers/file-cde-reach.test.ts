/**
 * 🔐 ΕΜΒΕΛΕΙΑ CDE ΣΤΑ ΕΡΓΑΛΕΙΑ ΑΡΧΕΙΩΝ (ADR-901 Φ2 · ADR-862 §5.4.1)
 *
 * Κάθε δρόμος με τον οποίο ο πράκτορας διαβάζει αρχείο: ο πελάτης δεν φτάνει σε WIP, ούτε ως περιεχόμενο ούτε ως
 * ύπαρξη· ο διαχειριστής και τα `pre-cde` μένουν όπως ήταν. Ο κριτής και ο αναγνώστης τρέχουν αληθινοί.
 *
 * @module __tests__/handlers/file-cde-reach
 */

import '../setup';

import { DocumentReaderHandler } from '../../handlers/document-reader-handler';
import { FileDeliveryHandler } from '../../handlers/file-delivery-handler';
import { FirestoreHandler } from '../../handlers/firestore-handler';
import { createAdminContext, createCustomerContext } from '../test-utils/context-factory';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import { getAdminFirestore } from '@/lib/firebaseAdmin';

jest.mock('@/services/ai-pipeline/shared/channel-reply-dispatcher', () => ({
  sendChannelMediaReply: jest.fn(async () => ({ success: true })),
}));

jest.mock('../../../document-preview-service', () => ({
  downloadAndValidateFile: jest.fn(async () => null),
  isVisionSupportedMime: jest.fn(() => true),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { downloadAndValidateFile } = require('../../../document-preview-service') as { downloadAndValidateFile: jest.Mock };

const COMPANY = createCustomerContext().companyId;
const ACT = { by: 'uid_engineer', at: '2026-09-01T00:00:00Z', revision: 1 };

const STATES: Record<string, Record<string, unknown>> = {
  WIP: { cdeState: 'WIP', cdeTeamId: 'team_eng' },
  SHARED: { cdeState: 'SHARED', cdeShare: ACT },
  PUBLISHED: { cdeState: 'PUBLISHED', cdeSeal: ACT, cdeRelease: ACT },
  'pre-cde': {},
};

/** Δηλωμένο πεδίο πελάτη: το ακίνητό του, άρα μόνο η εμβέλεια μπορεί να το κόψει. */
function seedFile(state: string): void {
  const kit = new FakeFirestore();
  kit.seedCollection('files', {
    file_1: {
      companyId: COMPANY, entityType: 'property', entityId: 'unit_001', propertyId: 'unit_001', status: 'ready', revision: 1,
      displayName: 'Μυστικό σχέδιο', downloadUrl: 'https://x/f.pdf', contentType: 'application/pdf', ...STATES[state],
    },
  });
  (getAdminFirestore as jest.Mock).mockReturnValue(kit);
}

const customer = () => createCustomerContext({
  // Ο ΠΡΑΓΜΑΤΙΚΟΣ ρόλος: το `setup` αντικαθιστά τον πίνακα με mock χωρίς `files`.
  _resolvedAccess: jest.requireActual('@/config/ai-role-access-matrix').AI_ROLE_ACCESS_MATRIX.buyer,
  contactMeta: { contactId: 'cont_1', displayName: 'Τ', firstName: 'Τ', primaryPersona: null, linkedPropertyIds: ['unit_001'], projectRoles: [{ projectId: 'proj_001', role: 'buyer', entityType: 'project', entityId: 'proj_001' }] },
});

const firestore = (tool: string, args: Record<string, unknown>, ctx = customer()) => new FirestoreHandler().execute(tool, args, ctx);
const FILES_QUERY = { collection: 'files', filters: [] };

describe('🔐 εμβέλεια CDE στα εργαλεία αρχείων', () => {
  beforeEach(() => jest.clearAllMocks());

  describe.each(['WIP', 'SHARED'])('πελάτης + %s ⇒ τίποτα', (state) => {
    beforeEach(() => seedFile(state));

    it('deliver_file_to_chat: δεν στέλνεται', async () => {
      const result = await new FileDeliveryHandler().execute('deliver_file_to_chat', { sourceType: 'file', sourceId: 'file_1' }, customer());
      expect(result).toMatchObject({ success: false, error: 'Δεν έχετε πρόσβαση σε αυτό το αρχείο.' });
    });

    it('read_document: απαντά σαν να μην υπάρχει και δεν κατεβάζει τίποτα', async () => {
      const result = await new DocumentReaderHandler().execute('read_document', { fileRecordId: 'file_1' }, customer());
      expect(result).toEqual({ success: false, error: 'FileRecord "file_1" not found.' });
      expect(downloadAndValidateFile).not.toHaveBeenCalled();
    });

    it('firestore_query: εκτός αποτελεσμάτων', async () => {
      expect(await firestore('firestore_query', FILES_QUERY)).toMatchObject({ success: true, count: 0 });
    });

    it('firestore_get_document: το ίδιο σχήμα με το «δεν υπάρχει»', async () => {
      const hidden = await firestore('firestore_get_document', { collection: 'files', documentId: 'file_1' });
      const absent = await firestore('firestore_get_document', { collection: 'files', documentId: 'file_none' });
      expect(hidden).toEqual(absent);
    });

    it('firestore_count: δεν μετρά', async () => {
      expect(await firestore('firestore_count', FILES_QUERY)).toMatchObject({ success: true, count: 0 });
    });

    it('search_text: εκτός αποτελεσμάτων', async () => {
      expect(await firestore('search_text', { searchTerm: 'Μυστικό', collections: ['files'] })).toMatchObject({ success: true, count: 0 });
    });
  });

  describe.each(['PUBLISHED', 'pre-cde'])('πελάτης + %s ⇒ φτάνει (καμία παλινδρόμηση)', (state) => {
    beforeEach(() => seedFile(state));

    it('όλοι οι δρόμοι το βρίσκουν', async () => {
      const delivered = await new FileDeliveryHandler().execute('deliver_file_to_chat', { sourceType: 'file', sourceId: 'file_1' }, customer());
      expect(delivered.success).toBe(true);
      await new DocumentReaderHandler().execute('read_document', { fileRecordId: 'file_1' }, customer());
      expect(downloadAndValidateFile).toHaveBeenCalledTimes(1);
      expect((await firestore('firestore_query', FILES_QUERY)).count).toBe(1);
      expect((await firestore('firestore_get_document', { collection: 'files', documentId: 'file_1' })).count).toBe(1);
      expect((await firestore('firestore_count', FILES_QUERY)).count).toBe(1);
      expect((await firestore('search_text', { searchTerm: 'Μυστικό', collections: ['files'] })).count).toBe(1);
    });
  });

  it('διαχειριστής + WIP ⇒ όλα ανοιχτά', async () => {
    seedFile('WIP');
    const admin = createAdminContext();
    const delivered = await new FileDeliveryHandler().execute('deliver_file_to_chat', { sourceType: 'file', sourceId: 'file_1' }, admin);
    expect(delivered.success).toBe(true);
    await new DocumentReaderHandler().execute('read_document', { fileRecordId: 'file_1' }, admin);
    expect(downloadAndValidateFile).toHaveBeenCalledTimes(1);
    expect((await firestore('firestore_query', FILES_QUERY, admin)).count).toBe(1);
    expect((await firestore('firestore_get_document', { collection: 'files', documentId: 'file_1' }, admin)).count).toBe(1);
    expect((await firestore('firestore_count', FILES_QUERY, admin)).count).toBe(1);
    expect((await firestore('search_text', { searchTerm: 'Μυστικό', collections: ['files'] }, admin)).count).toBe(1);
  });
});
