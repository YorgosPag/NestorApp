/**
 * BOQ tenant isolation — η απόδειξη ότι ξένη γραμμή ΔΕΝ διαβάζεται και ΔΕΝ γράφεται
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΑΥΤΟ ΤΟ TEST ΔΕΝ ΥΠΗΡΧΕ — ΚΑΙ ΓΙΑΤΙ ΕΙΝΑΙ ΤΟ ΚΡΙΣΙΜΟ
 * ─────────────────────────────────────────────────────────────────────────────
 * Μέχρι 2026-07-31 κανένα test δεν έλεγχε ότι το `boqService` αρνείται γραμμή
 * άλλου πελάτη — **γιατί δεν την αρνιόταν**. Οι μέθοδοι που δέχονταν `id`
 * (`getById`, `update`, `delete`, `bulkDelete`, `duplicate`, `updateStatus`,
 * `transition`, `reopenToDraft`) δεν έπαιρναν καθόλου `companyId`.
 *
 * 🔴 Το χειρότερο κομμάτι δεν ήταν η ανάγνωση: τα `delete()` και `updateStatus()`
 * του repository **έγραφαν χωρίς να διαβάσουν ποτέ το έγγραφο**. Ένα id αρκούσε
 * για `deleteDoc`. Τα Firestore rules το έκοβαν (`firestore.rules:3015`), αλλά
 * μια άμυνα που ζει μόνο στον διακομιστή σημαίνει ότι ο κώδικας εδώ δεν ξέρει τι
 * κάνει — και το Admin SDK, που **παρακάμπτει** τους κανόνες, δεν θα την είχε.
 *
 * Γι' αυτό κάθε test εγγραφής εδώ ελέγχει **δύο** πράγματα: την επιστρεφόμενη
 * τιμή **και** ότι το αντίστοιχο `deleteDoc`/`updateDoc`/`setDoc` δεν κλήθηκε
 * ποτέ. Μόνο η πρώτη θα περνούσε και με σιωπηλά αποτυχημένη εγγραφή.
 *
 * Ελέγχεται η **πλήρης στοίβα** (service → repository → SDK) και όχι το
 * repository μόνο του: η σειρά των δύο ορισμάτων `companyId`/`id` είναι έγκυρη
 * κατά τους τύπους και στις δύο κατευθύνσεις — μια αντιστροφή θα περνούσε τον
 * μεταγλωττιστή και θα άφηνε το σύστημα να αρνείται τα πάντα.
 *
 * @module services/measurements/__tests__/boq-tenant-isolation
 * @see ADR-734 §7 · ADR-175 (BOQ)
 */

interface StoredDocument {
  readonly id: string;
  data: Record<string, unknown>;
}

const store = new Map<string, StoredDocument>();

const mockGetDoc = jest.fn(async (ref: { id: string }) => {
  const found = store.get(ref.id);
  return {
    exists: () => found !== undefined,
    id: ref.id,
    data: () => found?.data,
  };
});
const mockUpdateDoc = jest.fn(async (ref: { id: string }, data: Record<string, unknown>) => {
  const existing = store.get(ref.id);
  if (existing) existing.data = { ...existing.data, ...data };
});
const mockDeleteDoc = jest.fn(async (ref: { id: string }) => {
  store.delete(ref.id);
});
const mockSetDoc = jest.fn(async (ref: { id: string }, data: Record<string, unknown>) => {
  store.set(ref.id, { id: ref.id, data });
});

jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db: unknown, ...segments: string[]) => ({ id: segments[segments.length - 1] })),
  getDoc: (...args: Parameters<typeof mockGetDoc>) => mockGetDoc(...args),
  updateDoc: (...args: Parameters<typeof mockUpdateDoc>) => mockUpdateDoc(...args),
  deleteDoc: (...args: Parameters<typeof mockDeleteDoc>) => mockDeleteDoc(...args),
  setDoc: (...args: Parameters<typeof mockSetDoc>) => mockSetDoc(...args),
  collection: jest.fn(() => ({ __collection: true })),
  getDocs: jest.fn(async () => ({ docs: [] })),
  query: jest.fn(() => ({ __query: true })),
  where: jest.fn(() => ({ __where: true })),
  orderBy: jest.fn(() => ({ __orderBy: true })),
}));

jest.mock('@/lib/firebase', () => ({ db: { __mockDb: true } }));

jest.mock('@/services/enterprise-id.service', () => ({
  generateBoqItemId: () => 'boq_duplicate_target',
}));

// SUT μετά τα mocks
import { BOQService } from '../boq-service';
import { FirestoreBOQRepository } from '../boq-repository';

const OWNER = 'co-owner';
const INTRUDER = 'co-intruder';
const ITEM_ID = 'boq-1';

const service = BOQService.getInstance();
const repository = new FirestoreBOQRepository();

function seedOwnerItem(overrides: Record<string, unknown> = {}): void {
  store.set(ITEM_ID, {
    id: ITEM_ID,
    data: {
      companyId: OWNER,
      projectId: 'prj-1',
      buildingId: 'bld-1',
      categoryCode: 'OIK-2',
      title: 'Σκυρόδεμα C20/25',
      unit: 'm3',
      estimatedQuantity: 100,
      wasteFactor: 0.05,
      materialUnitCost: 50,
      laborUnitCost: 30,
      equipmentUnitCost: 20,
      status: 'draft',
      ...overrides,
    },
  });
}

/** Καμία εγγραφή δεν έφτασε στο Firestore — με οποιονδήποτε τρόπο. */
function expectNoWrites(): void {
  expect(mockDeleteDoc).not.toHaveBeenCalled();
  expect(mockUpdateDoc).not.toHaveBeenCalled();
  expect(mockSetDoc).not.toHaveBeenCalled();
}

beforeEach(() => {
  store.clear();
  jest.clearAllMocks();
  seedOwnerItem();
});

// ============================================================================
// ΑΝΑΓΝΩΣΗ
// ============================================================================

describe('ανάγνωση — ξένη γραμμή είναι αδιάκριτη από ανύπαρκτη', () => {
  it('ο ιδιοκτήτης διαβάζει τη γραμμή του', async () => {
    const item = await service.getById(OWNER, ITEM_ID);
    expect(item?.id).toBe(ITEM_ID);
    expect(item?.companyId).toBe(OWNER);
  });

  it('άλλος πελάτης παίρνει null, όχι τα δεδομένα', async () => {
    await expect(service.getById(INTRUDER, ITEM_ID)).resolves.toBeNull();
  });

  it('ξένη και ανύπαρκτη γραμμή δίνουν ΤΟ ΙΔΙΟ αποτέλεσμα (κανένα μαντείο ύπαρξης)', async () => {
    const foreign = await service.getById(INTRUDER, ITEM_ID);
    const missing = await service.getById(INTRUDER, 'boq-does-not-exist');
    expect(foreign).toEqual(missing);
  });
});

// ============================================================================
// ΕΓΓΡΑΦΗ — Η ΕΠΙΣΤΡΕΦΟΜΕΝΗ ΤΙΜΗ ΔΕΝ ΑΡΚΕΙ
// ============================================================================

describe('εγγραφή — ξένη γραμμή δεν αγγίζεται καν', () => {
  it('delete: επιστρέφει false ΚΑΙ δεν καλεί deleteDoc', async () => {
    await expect(service.delete(INTRUDER, ITEM_ID)).resolves.toBe(false);
    expectNoWrites();
    expect(store.has(ITEM_ID)).toBe(true);
  });

  it('update: επιστρέφει null ΚΑΙ δεν καλεί updateDoc', async () => {
    await expect(service.update(INTRUDER, ITEM_ID, { title: 'Κλεμμένο' })).resolves.toBeNull();
    expectNoWrites();
    expect(store.get(ITEM_ID)?.data.title).toBe('Σκυρόδεμα C20/25');
  });

  it('transition: επιστρέφει false ΚΑΙ δεν αλλάζει κατάσταση', async () => {
    await expect(service.transition(INTRUDER, ITEM_ID, 'submitted', 'user-x')).resolves.toBe(false);
    expectNoWrites();
    expect(store.get(ITEM_ID)?.data.status).toBe('draft');
  });

  it('reopenToDraft: επιστρέφει false σε ξένη certified γραμμή', async () => {
    seedOwnerItem({ status: 'certified' });
    await expect(service.reopenToDraft(INTRUDER, ITEM_ID, 'user-x')).resolves.toBe(false);
    expectNoWrites();
    expect(store.get(ITEM_ID)?.data.status).toBe('certified');
  });

  it('duplicate: επιστρέφει null ΚΑΙ δεν δημιουργεί αντίγραφο', async () => {
    await expect(service.duplicate(INTRUDER, ITEM_ID)).resolves.toBeNull();
    expectNoWrites();
    expect(store.has('boq_duplicate_target')).toBe(false);
  });

  it('bulkDelete: σβήνει ΜΟΝΟ τις δικές του γραμμές από ανάμεικτη λίστα', async () => {
    store.set('boq-intruder', {
      id: 'boq-intruder',
      data: { companyId: INTRUDER, buildingId: 'bld-9', title: 'Δική του', status: 'draft' },
    });

    const deleted = await service.bulkDelete(INTRUDER, [ITEM_ID, 'boq-intruder']);

    expect(deleted).toBe(1);
    expect(store.has(ITEM_ID)).toBe(true);
    expect(store.has('boq-intruder')).toBe(false);
  });

  it('updateStatus στο repository: ξένη γραμμή ⇒ false χωρίς updateDoc', async () => {
    // Απευθείας στο repository: το `updateStatus` δεν εκτίθεται από το service
    // και μέχρι το ADR-734 §7 έγραφε **χωρίς καμία ανάγνωση**.
    await expect(repository.updateStatus(INTRUDER, ITEM_ID, 'approved', 'user-x')).resolves.toBe(false);
    expectNoWrites();
  });
});

// ============================================================================
// ΤΟ REPOSITORY ΦΥΛΑΣΣΕΤΑΙ ΚΑΙ ΜΟΝΟ ΤΟΥ
// ============================================================================

/**
 * 🔴 Αυτό το block προστέθηκε επειδή **μια μετάλλαξη επέζησε**: η αφαίρεση του
 * ελέγχου από το `repository.delete()` δεν κοκκίνιζε κανένα test, γιατί το
 * `service.delete()` κόβει νωρίτερα με δικό του `getById`.
 *
 * Η `FirestoreBOQRepository` όμως **εξάγεται** και μπορεί να χρησιμοποιηθεί
 * απευθείας — από migration script, από μελλοντικό service, από test. Ένα
 * στρώμα που φυλάσσεται μόνο επειδή τυχαίνει να καλείται από άλλο φυλασσόμενο
 * στρώμα δεν είναι φυλασσόμενο· είναι τυχερό.
 */
describe('repository απευθείας — χωρίς το service από πάνω', () => {
  it('delete: ξένη γραμμή ⇒ false ΚΑΙ κανένα deleteDoc', async () => {
    await expect(repository.delete(INTRUDER, ITEM_ID)).resolves.toBe(false);
    expectNoWrites();
    expect(store.has(ITEM_ID)).toBe(true);
  });

  it('update: ξένη γραμμή ⇒ null ΚΑΙ κανένα updateDoc', async () => {
    await expect(repository.update(INTRUDER, ITEM_ID, { title: 'X' })).resolves.toBeNull();
    expectNoWrites();
  });

  it('duplicate: ξένη γραμμή ⇒ null ΚΑΙ κανένα setDoc', async () => {
    await expect(repository.duplicate(INTRUDER, ITEM_ID)).resolves.toBeNull();
    expectNoWrites();
  });

  it('bulkDelete: ξένες γραμμές ⇒ 0 διαγραφές', async () => {
    await expect(repository.bulkDelete(INTRUDER, [ITEM_ID])).resolves.toBe(0);
    expectNoWrites();
  });

  it('ο ιδιοκτήτης δεν εμποδίζεται στο repository', async () => {
    await expect(repository.delete(OWNER, ITEM_ID)).resolves.toBe(true);
    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================
// Ο ΙΔΙΟΚΤΗΤΗΣ ΔΕΝ ΕΜΠΟΔΙΖΕΤΑΙ — ΑΛΛΙΩΣ Η «ΑΣΦΑΛΕΙΑ» ΕΙΝΑΙ ΑΠΛΩΣ ΒΛΑΒΗ
// ============================================================================

describe('ο ιδιοκτήτης εξακολουθεί να δουλεύει κανονικά', () => {
  it('delete draft γραμμής του ⇒ true και το έγγραφο φεύγει', async () => {
    await expect(service.delete(OWNER, ITEM_ID)).resolves.toBe(true);
    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
    expect(store.has(ITEM_ID)).toBe(false);
  });

  it('update γραμμής του ⇒ γράφει και επιστρέφει την ενημερωμένη', async () => {
    const updated = await service.update(OWNER, ITEM_ID, { title: 'Νέος τίτλος' });
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    expect(updated?.title).toBe('Νέος τίτλος');
  });

  it('transition draft→submitted ⇒ true', async () => {
    await expect(service.transition(OWNER, ITEM_ID, 'submitted', 'user-1')).resolves.toBe(true);
    expect(store.get(ITEM_ID)?.data.status).toBe('submitted');
  });

  it('duplicate γραμμής του ⇒ νέο έγγραφο στον ΙΔΙΟ tenant', async () => {
    const copy = await service.duplicate(OWNER, ITEM_ID);
    expect(copy?.companyId).toBe(OWNER);
    expect(copy?.status).toBe('draft');
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================
// Η ΣΕΙΡΑ ΤΩΝ ΟΡΙΣΜΑΤΩΝ — ΕΓΚΥΡΗ ΚΑΤΑ ΤΟΥΣ ΤΥΠΟΥΣ ΚΑΙ ΣΤΙΣ ΔΥΟ ΚΑΤΕΥΘΥΝΣΕΙΣ
// ============================================================================

describe('το service προωθεί companyId και id στη ΣΩΣΤΗ θέση', () => {
  it('αντιστροφή των δύο θα απέρριπτε και τον ιδιοκτήτη', async () => {
    // Ένα `getById(id, companyId)` περνά τον μεταγλωττιστή (δύο string) και
    // αρνείται τα πάντα. Αυτό το test είναι ο μόνος τρόπος να πιαστεί.
    await expect(service.getById(OWNER, ITEM_ID)).resolves.not.toBeNull();
    await expect(service.getById(ITEM_ID, OWNER)).resolves.toBeNull();
  });
});
