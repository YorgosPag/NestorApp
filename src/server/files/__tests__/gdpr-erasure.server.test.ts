/**
 * @jest-environment node
 *
 * @fileoverview 🔐 **Η ΔΙΑΓΡΑΦΗ ΓΚΠΔ ΔΕΝ ΘΑΒΕΙ ΠΕΡΙΕΧΟΜΕΝΟ ΕΤΑΙΡΕΙΑΣ** — ADR-935 Στάδιο 1 (Ε1 · Ε2).
 * @related server/files/gdpr-erasure.server.ts · services/file-record/file-subject-scan.ts · lib/files/file-actor-fields.ts
 *
 * 🔴 **ΤΙ ΦΥΛΑΕΙ**: (Ε1) η διαγραφή έσβηνε οριστικά κάθε **εταιρικό** αρχείο που ανέβασε ο άνθρωπος· (Ε2) έγραφε τα πάντα
 * σε **μία** δέσμη (όριο 500), **αφού** είχε ήδη σβήσει τα bytes.
 *
 * ⚠️ Σαρωτές υποκειμένου, κριτής δέσμευσης, επιτύμβιο και γραφείς δεσμών είναι τα **ΑΛΗΘΙΝΑ**. Mock μόνο τα σύνορα
 * (Storage · επαναπροβολή αγγελίας).
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { ERASED_SUBJECT, isSystemActorId } from '@/config/domain-constants';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

jest.mock('server-only', () => ({}));

const deleteStorageObjectForPurge = jest.fn(async (..._args: unknown[]): Promise<string> => 'deleted');
jest.mock('@/services/file-record/file-purge-helpers', () => {
  const actual = jest.requireActual<typeof import('@/services/file-record/file-purge-helpers')>(
    '@/services/file-record/file-purge-helpers',
  );
  return {
    deleteStorageObjectForPurge: (...args: unknown[]) => deleteStorageObjectForPurge(...args),
    isFileHeld: actual.isFileHeld,
    purgedRecordFields: actual.purgedRecordFields,
  };
});

const refreshListingsAfterFileChanges = jest.fn(async (..._args: unknown[]): Promise<readonly unknown[]> => []);
jest.mock('@/services/listings/listing-media-refresh', () => ({
  refreshListingsAfterFileChanges: (...args: unknown[]) => refreshListingsAfterFileChanges(...args),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { eraseSubjectFromFiles } = require('../gdpr-erasure.server') as typeof import('../gdpr-erasure.server');

const SUBJECT = 'u_alpha';
const COLLEAGUE = 'u_beta';

let fake: FakeFirestore;
const db = (): AdminFirestore => fake as unknown as AdminFirestore;

function stored(collection: string, id: string): Record<string, unknown> {
  return fake.all<Record<string, unknown>>(collection).find((doc) => doc.id === id) ?? {};
}

function seedCompanyFile(id: string, extra: Record<string, unknown> = {}): void {
  fake.seed(COLLECTIONS.FILES, id, {
    id, companyId: 'c_alpha', createdBy: SUBJECT, uploaderName: 'Νίκος', lifecycleState: 'active',
    hold: 'none', storagePath: `companies/c_alpha/${id}.pdf`, ...extra,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  fake = new FakeFirestore();
});

describe('ADR-935 Στάδιο 1 — εταιρικός χώρος: ανωνυμοποίηση, ποτέ σβήσιμο (Ε1)', () => {
  it('Κ1 — αρχείο που ανέβασε: bytes ΑΘΙΚΤΑ, μόνο ο δράστης και το όνομά του φεύγουν', async () => {
    seedCompanyFile('file_plan');

    const { results, errors } = await eraseSubjectFromFiles(db(), SUBJECT);

    expect(errors).toEqual([]);
    expect(deleteStorageObjectForPurge).not.toHaveBeenCalled();
    expect(stored(COLLECTIONS.FILES, 'file_plan')).toMatchObject({
      createdBy: ERASED_SUBJECT.ID, uploaderName: null, lifecycleState: 'active', storagePath: 'companies/c_alpha/file_plan.pdf',
    });
    expect(results).toMatchObject({ filesDeleted: 0, companyFilesAnonymized: 1 });
  });

  it('Κ3 — αρχείο ΣΥΝΑΔΕΛΦΟΥ που ο άνθρωπος πέταξε: φεύγει μόνο το `trashedBy`', async () => {
    seedCompanyFile('file_other', { createdBy: COLLEAGUE, uploaderName: 'Μαρία', trashedBy: SUBJECT });

    await eraseSubjectFromFiles(db(), SUBJECT);

    expect(stored(COLLECTIONS.FILES, 'file_other')).toMatchObject({
      createdBy: COLLEAGUE, uploaderName: 'Μαρία', trashedBy: ERASED_SUBJECT.ID,
    });
  });

  it('Κ3β — ένθετο πεδίο δράστη (`iso19650Source.overriddenBy`) βρίσκεται και ανωνυμοποιείται', async () => {
    seedCompanyFile('file_iso', { createdBy: COLLEAGUE, iso19650Source: { filledBy: 'user', overriddenBy: SUBJECT } });

    await eraseSubjectFromFiles(db(), SUBJECT);

    expect(stored(COLLECTIONS.FILES, 'file_iso')).toMatchObject({
      createdBy: COLLEAGUE, iso19650Source: { filledBy: 'user', overriddenBy: ERASED_SUBJECT.ID },
    });
  });

  it('Κ6 — αρχείο σε ΔΕΣΜΕΥΣΗ μένει ΑΘΙΚΤΟ, και η απόδοσή του (τεκμήριο, άρθρο 17 §3)', async () => {
    seedCompanyFile('file_held', { hold: 'legal' });

    const { results } = await eraseSubjectFromFiles(db(), SUBJECT);

    expect(stored(COLLECTIONS.FILES, 'file_held')).toMatchObject({ createdBy: SUBJECT, uploaderName: 'Νίκος' });
    expect(results).toMatchObject({ filesSkippedHold: 1, companyFilesAnonymized: 0 });
  });

  it('Κ7 — σχόλιο: ο συντάκτης φεύγει, το κείμενο μένει · κοινοποίηση: ανακαλείται', async () => {
    fake.seed(COLLECTIONS.FILE_COMMENTS, 'cmt_1', { companyId: 'c_alpha', fileId: 'f', text: 'ok', authorId: SUBJECT, authorName: 'Νίκος', resolvedBy: null });
    fake.seed(COLLECTIONS.FILE_SHARES, 'shr_1', { companyId: 'c_alpha', createdBy: SUBJECT });

    const { results } = await eraseSubjectFromFiles(db(), SUBJECT);

    expect(stored(COLLECTIONS.FILE_COMMENTS, 'cmt_1')).toMatchObject({
      text: 'ok', authorId: ERASED_SUBJECT.ID, authorName: ERASED_SUBJECT.DISPLAY_NAME,
    });
    expect(fake.all(COLLECTIONS.FILE_SHARES)).toHaveLength(0);
    expect(results).toMatchObject({ commentsAnonymized: 1, sharesDeleted: 1 });
  });
});

describe('ADR-935 Στάδιο 1 — προσωπικός χώρος: σβήσιμο (ό,τι ίσχυε)', () => {
  it('Κ2 — αρχείο του φακέλου του: bytes σβήνονται, επιτύμβιο ΓΚΠΔ', async () => {
    fake.seed(COLLECTIONS.FILES_PERSONAL, 'file_home', {
      id: 'file_home', userId: SUBJECT, lifecycleState: 'active', hold: 'none', storagePath: `people/${SUBJECT}/home.jpg`,
    });

    const { results } = await eraseSubjectFromFiles(db(), SUBJECT);

    expect(deleteStorageObjectForPurge).toHaveBeenCalledTimes(1);
    expect(stored(COLLECTIONS.FILES_PERSONAL, 'file_home')).toMatchObject({
      lifecycleState: 'purged', storagePath: null, purgedBy: 'gdpr-erasure',
    });
    expect(results.filesDeleted).toBe(1);
  });

  it('Κ2β — άρνηση της πλατφόρμας να σβήσει bytes ⇒ η εγγραφή ΔΕΝ γράφεται ως σβησμένη', async () => {
    deleteStorageObjectForPurge.mockResolvedValueOnce('refused');
    fake.seed(COLLECTIONS.FILES_PERSONAL, 'file_locked', {
      id: 'file_locked', userId: SUBJECT, lifecycleState: 'active', hold: 'none', storagePath: 'p/x.jpg',
    });

    const { results } = await eraseSubjectFromFiles(db(), SUBJECT);

    expect(stored(COLLECTIONS.FILES_PERSONAL, 'file_locked').lifecycleState).toBe('active');
    expect(results).toMatchObject({ filesDeleted: 0, filesSkippedHold: 1 });
  });
});

describe('ADR-935 Στάδιο 1 — τεμαχισμένο και επαναλήψιμο (Ε2)', () => {
  it('Κ4 — 1.200 εγγραφές ⇒ τρεις δέσμες, όλες γραμμένες', async () => {
    for (let i = 0; i < 1200; i++) seedCompanyFile(`file_${i}`);
    const batches = jest.spyOn(fake, 'batch');

    const { results, errors } = await eraseSubjectFromFiles(db(), SUBJECT);

    expect(errors).toEqual([]);
    expect(results.companyFilesAnonymized).toBe(1200);
    expect(batches).toHaveBeenCalledTimes(3);
  });

  it('Κ5 — δεύτερη εκτέλεση ⇒ καμία εγγραφή, καμία αλλαγή', async () => {
    seedCompanyFile('file_plan');
    fake.seed(COLLECTIONS.FILES_PERSONAL, 'file_home', { id: 'file_home', userId: SUBJECT, lifecycleState: 'active', hold: 'none', storagePath: 'p/h.jpg' });
    await eraseSubjectFromFiles(db(), SUBJECT);
    const writesAfterFirst = fake.writes;

    const { results } = await eraseSubjectFromFiles(db(), SUBJECT);

    expect(fake.writes).toBe(writesAfterFirst);
    expect(results).toMatchObject({ filesDeleted: 0, companyFilesAnonymized: 0, commentsAnonymized: 0, sharesDeleted: 0 });
  });
});

describe('ADR-935 — η ταυτότητα του διαγραμμένου', () => {
  it('Κ8 — ΔΕΝ είναι μηχανή: το ιστορικό δεν τον γράφει «Σύστημα»', () => {
    expect(isSystemActorId(ERASED_SUBJECT.ID)).toBe(false);
  });
});
