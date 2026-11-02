/**
 * 🔐 ΠΟΙΑ ΑΡΧΕΙΑ ΚΑΙ ΕΓΓΡΑΦΕΣ ΦΤΑΝΟΥΝ ΣΤΟΝ ΘΕΑΤΗ (ADR-257 · ADR-901 Φ2 · ADR-862 §5.4.1)
 *
 * Κάθε δρόμος με τον οποίο ο πράκτορας διαβάζει: ο πελάτης δεν φτάνει σε WIP ούτε σε ξένη εγγραφή, ούτε ως περιεχόμενο
 * ούτε ως ύπαρξη· ο διαχειριστής, τα `pre-cde` και τα δικά του ανεβάσματα μένουν όπως ήταν. Ο κριτής, ο αναγνώστης και
 * ο ρόλος `buyer` τρέχουν αληθινοί, και τα σχήματα είναι όσα γράφει η παραγωγή: αρχείο με `entityType`/`entityId`
 * (χωρίς `propertyId`), `cdeReadReach` της φάσης, σύνδεση ακινήτου με `projectId: ''` (`contact-linker`).
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
const SENDER = 'telegram_777';
const ACT = { by: 'uid_engineer', at: '2026-09-01T00:00:00Z', revision: 1 };

const STATES: Record<string, Record<string, unknown>> = {
  WIP: { cdeState: 'WIP', cdeTeamId: 'team_eng', cdeReadReach: 'author' },
  SHARED: { cdeState: 'SHARED', cdeShare: ACT, cdeReadReach: 'tenant' },
  PUBLISHED: { cdeState: 'PUBLISHED', cdeSeal: ACT, cdeRelease: ACT, cdeReadReach: 'tenant' },
  'pre-cde': { cdeReadReach: 'tenant' },
};

/** Όπως το `FileRecord` της παραγωγής: κάτοχος οντότητα, καθόλου `propertyId`. */
function fileOn(entityId: string, state: string): Record<string, unknown> {
  return {
    companyId: COMPANY, entityType: 'property', entityId, status: 'ready', revision: 1,
    displayName: 'Μυστικό σχέδιο', downloadUrl: 'https://x/f.pdf', contentType: 'application/pdf', ...STATES[state],
  };
}

/** Όπως το γράφει το `buildIngestionFileRecordData`: ανήκει στην εταιρεία, η πηγή λέει ποιος το έστειλε. */
function inbound(type: string, fromUserId: string): Record<string, unknown> {
  return {
    companyId: COMPANY, entityType: 'company', entityId: COMPANY, domain: 'ingestion', status: 'pending', cdeReadReach: 'tenant',
    displayName: 'Μυστικό εισερχόμενο', downloadUrl: 'https://x/in.pdf', contentType: 'application/pdf', source: { type, fromUserId },
  };
}

function seed(collections: Record<string, Record<string, Record<string, unknown>>>): void {
  const kit = new FakeFirestore();
  for (const [name, docs] of Object.entries(collections)) kit.seedCollection(name, docs);
  (getAdminFirestore as jest.Mock).mockReturnValue(kit);
}

const seedFile = (state: string) => seed({ files: { file_1: fileOn('unit_001', state) } });

const customer = (overrides: Parameters<typeof createCustomerContext>[0] = {}) => createCustomerContext({
  channelSenderId: SENDER,
  // Ο ΠΡΑΓΜΑΤΙΚΟΣ ρόλος: το `setup` αντικαθιστά τον πίνακα με mock χωρίς `files`.
  _resolvedAccess: jest.requireActual('@/config/ai-role-access-matrix').AI_ROLE_ACCESS_MATRIX.buyer,
  contactMeta: {
    contactId: 'cont_1', displayName: 'Τ', firstName: 'Τ', primaryPersona: null, linkedPropertyIds: ['unit_001'],
    projectRoles: [{ projectId: '', role: 'buyer', entityType: 'property', entityId: 'unit_001' }],
  },
  ...overrides,
});

const firestore = (tool: string, args: Record<string, unknown>, ctx = customer()) => new FirestoreHandler().execute(tool, args, ctx);
const deliver = (id: string, ctx = customer()) => new FileDeliveryHandler().execute('deliver_file_to_chat', { sourceType: 'file', sourceId: id }, ctx);
const read = (id: string, ctx = customer()) => new DocumentReaderHandler().execute('read_document', { fileRecordId: id }, ctx);
const FILES_QUERY = { collection: 'files', filters: [] };
const search = (term: string, collection: string) => ({ searchTerm: term, collections: [collection] });

describe('🔐 τι φτάνει στον θεατή', () => {
  beforeEach(() => jest.clearAllMocks());

  describe.each(['WIP', 'SHARED'])('πελάτης + δικό του ακίνητο + %s ⇒ τίποτα', (state) => {
    beforeEach(() => seedFile(state));

    it('deliver_file_to_chat: δεν στέλνεται', async () => {
      expect(await deliver('file_1')).toMatchObject({ success: false, error: 'Δεν έχετε πρόσβαση σε αυτό το αρχείο.' });
    });

    it('read_document: απαντά σαν να μην υπάρχει και δεν κατεβάζει τίποτα', async () => {
      expect(await read('file_1')).toEqual({ success: false, error: 'FileRecord "file_1" not found.' });
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
      expect(await firestore('search_text', search('Μυστικό', 'files'))).toMatchObject({ success: true, count: 0 });
    });
  });

  describe.each(['PUBLISHED', 'pre-cde'])('πελάτης + δικό του ακίνητο + %s ⇒ φτάνει (καμία παλινδρόμηση)', (state) => {
    beforeEach(() => seedFile(state));

    it('όλοι οι δρόμοι το βρίσκουν', async () => {
      expect((await deliver('file_1')).success).toBe(true);
      await read('file_1');
      expect(downloadAndValidateFile).toHaveBeenCalledTimes(1);
      expect((await firestore('firestore_query', FILES_QUERY)).count).toBe(1);
      expect((await firestore('firestore_get_document', { collection: 'files', documentId: 'file_1' })).count).toBe(1);
      expect((await firestore('firestore_count', FILES_QUERY)).count).toBe(1);
      expect((await firestore('search_text', search('Μυστικό', 'files'))).count).toBe(1);
    });
  });

  describe('🏠 ξένη εγγραφή της ίδιας εταιρείας', () => {
    beforeEach(() => seed({
      files: { file_alien: fileOn('unit_999', 'pre-cde') },
      properties: {
        unit_001: { id: 'unit_001', companyId: COMPANY, name: 'Μυστικό δικό μου' },
        unit_999: { id: 'unit_999', companyId: COMPANY, name: 'Μυστικό ξένο' },
      },
      contacts: { cont_9: { companyId: COMPANY, firstName: 'Μυστικό' } },
    }));

    it('αρχείο: κανένας δρόμος, ακόμη κι αν το μοντέλο ξέρει το id', async () => {
      expect((await deliver('file_alien')).success).toBe(false);
      expect(await read('file_alien')).toEqual({ success: false, error: 'FileRecord "file_alien" not found.' });
      expect(await firestore('firestore_get_document', { collection: 'files', documentId: 'file_alien' })).toMatchObject({ success: true, data: null });
      expect((await firestore('search_text', search('Μυστικό', 'files'))).count).toBe(0);
      expect((await firestore('firestore_count', FILES_QUERY)).count).toBe(0);
      expect(downloadAndValidateFile).not.toHaveBeenCalled();
    });

    it('firestore_get_document: ξένο ακίνητο ≡ «δεν υπάρχει», το δικό του φτάνει', async () => {
      expect(await firestore('firestore_get_document', { collection: 'properties', documentId: 'unit_999' })).toMatchObject({ success: true, data: null });
      expect((await firestore('firestore_get_document', { collection: 'properties', documentId: 'unit_001' })).count).toBe(1);
    });

    it('firestore_get_document: συλλογή εκτός ρόλου ⇒ άρνηση', async () => {
      expect(await firestore('firestore_get_document', { collection: 'contacts', documentId: 'cont_9' })).toMatchObject({ success: false });
    });

    it('search_text: συλλογή εκτός ρόλου δεν ψάχνεται, και μένουν μόνο τα δικά του ακίνητα', async () => {
      expect((await firestore('search_text', search('Μυστικό', 'contacts'))).count).toBe(0);
      const own = await firestore('search_text', search('Μυστικό', 'properties'));
      expect(own.count).toBe(1);
      expect(JSON.stringify(own.data)).not.toContain('unit_999');
    });
  });

  describe('📎 ανεβάσματα του ίδιου του πελάτη (ανήκουν στην εταιρεία, όχι σε ακίνητο)', () => {
    it('δικό του, από επαληθευμένο κανάλι, σε επόμενο μήνυμα ⇒ το διαβάζει', async () => {
      seed({ files: { in_1: inbound('telegram', '777') } });
      await read('in_1');
      expect(downloadAndValidateFile).toHaveBeenCalledTimes(1);
    });

    it('του τρέχοντος μηνύματος ⇒ το διαβάζει σε κάθε κανάλι', async () => {
      seed({ files: { in_1: inbound('email', 'x@y.gr') } });
      await read('in_1', customer({ attachments: [{ fileRecordId: 'in_1', filename: 'a.pdf', contentType: 'application/pdf', storageUrl: 'u' }] }));
      expect(downloadAndValidateFile).toHaveBeenCalledTimes(1);
    });

    it('άλλου αποστολέα ⇒ «δεν υπάρχει»', async () => {
      seed({ files: { in_1: inbound('telegram', '888') } });
      expect((await read('in_1')).success).toBe(false);
      expect(downloadAndValidateFile).not.toHaveBeenCalled();
    });

    it('🔒 email με πλαστό `From:` ίδιου αναγνωριστικού ⇒ «δεν υπάρχει»', async () => {
      seed({ files: { in_1: inbound('email', 'victim@y.gr') } });
      expect((await read('in_1', customer({ channel: 'email', channelSenderId: 'email_victim@y.gr' }))).success).toBe(false);
      expect(downloadAndValidateFile).not.toHaveBeenCalled();
    });
  });

  it('διαχειριστής + WIP ξένου ακινήτου ⇒ όλα ανοιχτά', async () => {
    seed({ files: { file_1: fileOn('unit_999', 'WIP') } });
    const admin = createAdminContext();
    expect((await deliver('file_1', admin)).success).toBe(true);
    await read('file_1', admin);
    expect(downloadAndValidateFile).toHaveBeenCalledTimes(1);
    expect((await firestore('firestore_query', FILES_QUERY, admin)).count).toBe(1);
    expect((await firestore('firestore_get_document', { collection: 'files', documentId: 'file_1' }, admin)).count).toBe(1);
    expect((await firestore('firestore_count', FILES_QUERY, admin)).count).toBe(1);
    expect((await firestore('search_text', search('Μυστικό', 'files'), admin)).count).toBe(1);
  });
});
