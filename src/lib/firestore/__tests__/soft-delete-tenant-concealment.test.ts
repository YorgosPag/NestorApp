/**
 * ⚓ ADR-742 §7decies.4 — **ο κοινός engine κύκλου ζωής δεν μαρτυρά ύπαρξη**
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΥΠΑΡΧΕΙ
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο `soft-delete-engine` εξυπηρετεί **έξι** οντότητες — `contact`, `property`,
 * `building`, `project`, `parking`, `storage`. Τρεις από αυτές δηλώνονταν ήδη
 * **μεταμφιεσμένες** (Ομάδες 3 και 4), κι όμως **μία** διαδρομή διαγραφής
 * απαντούσε `403 'Unauthorized: {X} belongs to different company'` για το ίδιο
 * ακριβώς id.
 *
 * 🔴 Μήνυμα που **κατονομάζει τον λόγο** είναι μαντείο ακόμη κι όταν ο κωδικός
 * είναι «σωστός»: λέει ρητά ότι το έγγραφο **υπάρχει και ανήκει αλλού**. Και
 * επειδή ο engine είναι **κοινός**, ακύρωνε τη μεταμφίεση **και των τριών**
 * πόρων μαζί — με κάθε άλλο test πράσινο (§7septies: ιδιότητα ΠΟΡΟΥ, όχι
 * διαδρομής).
 *
 * @module lib/firestore/__tests__/soft-delete-tenant-concealment
 * @see ADR-742 §3.3 · §4 (η παγίδα του κενού) · §7.1 · §7decies.4
 */

jest.mock('server-only', () => ({}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() }),
}));

/** Ο engine εισάγει τον φύλακα διαγραφής, που σέρνει `next/server` (§7octies.4). */
jest.mock('../deletion-guard', () => ({
  executeDeletion: jest.fn(async () => ({ success: true, entityId: 'x' })),
}));

jest.mock('@/services/entity-audit.service', () => ({
  EntityAuditService: { recordChange: jest.fn(async () => undefined) },
  resolveUserDisplayName: jest.fn(async () => 'Tester'),
}));

import { ApiError } from '@/lib/api/api-error-types';
import { softDelete, restoreFromTrash } from '../soft-delete-engine';

const TENANT = 'comp_owner';
const ENTITY_ID = 'contact_1';

interface FakeDoc {
  readonly exists: boolean;
  data(): Record<string, unknown> | undefined;
}

/** Ελάχιστο Firestore: το μόνο που αγγίζει η υπό έλεγχο διαδρομή είναι η φόρτωση. */
function dbWith(doc: FakeDoc): FirebaseFirestore.Firestore {
  const docRef = {
    get: async () => doc,
    update: jest.fn(async () => undefined),
  };
  return {
    collection: () => ({ doc: () => docRef }),
  } as unknown as FirebaseFirestore.Firestore;
}

const missing: FakeDoc = { exists: false, data: () => undefined };
const foreign: FakeDoc = { exists: true, data: () => ({ companyId: 'other', status: 'active' }) };
const tenantless: FakeDoc = { exists: true, data: () => ({ status: 'active' }) };

async function refusal(doc: FakeDoc): Promise<ApiError> {
  try {
    await softDelete(dbWith(doc), 'contact', ENTITY_ID, 'uid_1', TENANT);
  } catch (err) {
    return err as ApiError;
  }
  throw new Error('περίμενα άρνηση, δεν ρίχτηκε τίποτα');
}

describe('⚓ soft-delete — ξένο ≡ ανύπαρκτο', () => {
  /**
   * 🔴 Η **ταυτότητα** κρίνεται στο ζεύγος (κωδικός **και** μήνυμα), όχι
   * «μοιάζει». Η Ομάδα 3 βρήκε μεταμφίεση με σωστό κείμενο και λάθος κωδικό —
   * που δεν κρύβει τίποτα (§7sexies.1).
   */
  it('🔴 η άρνηση ιδιοκτησίας είναι ΠΑΝΟΜΟΙΟΤΥΠΗ με το γνήσιο «δεν βρέθηκε»', async () => {
    const genuine = await refusal(missing);
    const disguised = await refusal(foreign);

    expect([disguised.statusCode, disguised.message]).toEqual([genuine.statusCode, genuine.message]);
    expect(genuine.statusCode).toBe(404);
  });

  it('🔴 το μήνυμα ΔΕΝ κατονομάζει τη διαφορά εταιρείας', async () => {
    const disguised = await refusal(foreign);

    expect(disguised.message).not.toMatch(/belongs to|different company|Unauthorized/i);
    expect(disguised.message).toBe('Contact not found');
  });

  /**
   * 🔴🔴 Η **παγίδα του κενού** (§4): μέχρι τις 2026-08-01 ο έλεγχος ήταν
   * `data?.companyId && data.companyId !== companyId` ⇒ έγγραφο **χωρίς**
   * `companyId` περνούσε για **οποιονδήποτε**, σε **έξι** οντότητες και σε τρεις
   * μεταλλάξεις κύκλου ζωής. Αυτολεξεί το σφάλμα που έκλεισε δύο φορές αλλού
   * (§7quinquies `rfq-service`, §7octies `bank-accounts-server`) — **ζωντανό σε
   * τρίτο αρχείο**.
   */
  it('🔴🔴 έγγραφο ΧΩΡΙΣ companyId ΔΕΝ περνά — το κενό είναι απουσία tenant', async () => {
    const refused = await refusal(tenantless);

    expect(refused.statusCode).toBe(404);
    expect(refused.message).toBe('Contact not found');
  });

  it('ο υπεργραφέας εξακολουθεί να περνά (δηλωμένο δόγμα, ADR-232)', async () => {
    await expect(
      softDelete(dbWith(foreign), 'contact', ENTITY_ID, 'uid_1', TENANT, undefined, true),
    ).resolves.toEqual({ success: true, entityId: ENTITY_ID });
  });

  /**
   * Η επαναφορά **δεν** παρακάμπτει ποτέ (διατηρήθηκε όπως ήταν, §7decies.4):
   * ο υπεργραφέας δεν έχει εδώ όρισμα bypass, οπότε η ξένη εγγραφή πρέπει να
   * απαντά με το **ίδιο** «δεν βρέθηκε».
   */
  it('🔴 restoreFromTrash: ξένη εγγραφή ⇒ ίδιο 404, χωρίς διαρροή λόγου', async () => {
    let thrown: ApiError | undefined;
    try {
      await restoreFromTrash(dbWith(foreign), 'contact', ENTITY_ID, 'uid_1', TENANT);
    } catch (err) {
      thrown = err as ApiError;
    }

    expect(thrown?.statusCode).toBe(404);
    expect(thrown?.message).toBe('Contact not found');
  });
});
