/**
 * 🔒 ΑΓΚΥΡΑ — ADR-852 §4.7 · Η ΡΗΧΟΤΗΤΑ ΤΟΥ AUDIT WRITER ΕΙΝΑΙ **ΣΥΜΒΟΛΑΙΟ**
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ: όλη η ορθότητα του διπλού καναλιού της Φ3 στέκεται σε **μία** ιδιότητα —
 * ο καθαριστής του `EntityAuditService.recordChange` είναι **ρηχός**, άρα ο πίνακας
 * `changes[]` φτάνει στο Firestore **αυτούσιος**. Μέχρι αυτό το αρχείο, η ιδιότητα ίσχυε
 * **ΚΑΤΑ ΤΥΧΗ**: τίποτα δεν τη φύλαγε, και το όνομα του καθαριστή (`removeUndefinedValues`)
 * ήταν **τριπλό ομώνυμο** με τρεις διαφορετικές εγγυήσεις.
 *
 * ΤΙ ΣΠΑΕΙ ΑΝ ΧΑΘΕΙ Η ΡΗΧΟΤΗΤΑ — δύο ανεξάρτητες διαδρομές:
 *   1. Αναδρομικός καθαριστής θα καθάριζε τα `undefined` **μέσα** στο `changes[]` ⇒ το
 *      conditional spread του `descriptorChannels()` θα φαινόταν **περιττό** ⇒ κάποιος θα
 *      το «απλοποιούσε» σε `quantity: def.quantity` ⇒ και όταν αργότερα ο καθαριστής
 *      ξαναγινόταν ρηχός, **κάθε** εγγραφή αδήλωτου πεδίου θα έριχνε το write — **σιωπηλά**,
 *      σε διαδρομή fire-and-forget όπου κανείς δεν μαθαίνει (σχήμα **ADR-436**).
 *   2. Αντικατάσταση με το SSoT `stripUndefinedDeep` (`@/utils/firestore-sanitize`) θα
 *      κατέστρεφε τον `serverTimestamp()` sentinel — ίδια μηχανική με το **ADR-438**.
 *
 * 🔑 ΔΟΚΙΜΑΖΕΤΑΙ ΤΟ OBSERVABLE CONTRACT, ΟΧΙ Η ΙΔΙΩΤΙΚΗ ΣΥΝΑΡΤΗΣΗ: όλα περνούν από το
 * **public API** (`recordChange`) και κοιτούν **το payload που φτάνει στο `.set()`** — ίδιο
 * πρότυπο με το `lib/auth/__tests__/audit-core-persistence.test.ts`. Το `stripUndefinedShallow`
 * είναι module-local και **δεν** εξάγεται· μια άγκυρα πάνω του θα δοκίμαζε υλοποίηση, όχι
 * συμβόλαιο, και θα επέτρεπε στο συμβόλαιο να σπάσει από αλλαγή στο **σημείο κλήσης**.
 *
 * @module services/__tests__/entity-audit-write-shallow
 * @enterprise ADR-852 §4.7 · ADR-438 · ADR-195
 */

// Chainable Firestore double, ΟΛΑ δηλωμένα ΜΕΣΑ στο factory (πρότυπο του repo — δεν υπάρχει
// κοινός test double: 40+ αρχεία χειροποιούν το `jest.mock('@/lib/firebaseAdmin')`).
jest.mock('@/lib/firebaseAdmin', () => {
  const setMock = jest.fn().mockResolvedValue(undefined);
  const docMock = jest.fn(() => ({ set: setMock }));
  const collectionMock = jest.fn(() => ({ doc: docMock }));

  // ⚠️ ΟΧΙ object literal. Ο πραγματικός `FieldValue.serverTimestamp()` επιστρέφει **instance
  // κλάσης** του οποίου το prototype ΔΕΝ είναι το `Object.prototype`, και που **δεν έχει own
  // enumerable properties** — το ADR-438 το μέτρησε εκτελώντας πάνω στο πραγματικό
  // firebase-admin του ίδιου αυτού repo (`Object.entries(serverTimestamp())` === `[]`).
  // Ένα `{}` εδώ θα ήταν «σκέτο» αντικείμενο ⇒ οι φρουροί θα συμπεριφερόντουσαν αλλιώς και
  // η άγκυρα θα περνούσε για **ΛΑΘΟΣ ΛΟΓΟ**.
  class ServerTimestampSentinel {}
  const SERVER_TIMESTAMP_SENTINEL = new ServerTimestampSentinel();

  return {
    getAdminFirestore: () => ({ collection: collectionMock }),
    FieldValue: { serverTimestamp: () => SERVER_TIMESTAMP_SENTINEL },
    __setMock: setMock,
    __docMock: docMock,
    __collectionMock: collectionMock,
    __SERVER_TIMESTAMP_SENTINEL: SERVER_TIMESTAMP_SENTINEL,
  };
});

import { EntityAuditService } from '@/services/entity-audit.service';
import { stripUndefinedDeep } from '@/utils/firestore-sanitize';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { AuditFieldChange } from '@/types/audit-trail';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const firebaseAdminMock = require('@/lib/firebaseAdmin') as {
  __setMock: jest.Mock;
  __collectionMock: jest.Mock;
  __SERVER_TIMESTAMP_SENTINEL: object;
};

const SENTINEL = firebaseAdminMock.__SERVER_TIMESTAMP_SENTINEL;

function recordParams(changes: AuditFieldChange[]) {
  return {
    entityType: 'column' as const,
    entityId: 'col_1',
    entityName: 'Κ1',
    action: 'updated' as const,
    changes,
    performedBy: 'user_1',
    // ⚠️ Χωρίς '@' ⇒ το `resolvePerformerDisplayName` το κρατά ΩΣ ΕΧΕΙ και επιστρέφει
    // **χωρίς να αγγίξει τη βάση**. Γι' αυτό το double δεν χρειάζεται `.get()`, και η
    // άγκυρα δεν εξαρτάται από διαδρομή που δεν εξετάζει.
    performedByName: 'Σύστημα',
    companyId: 'comp_1',
  };
}

/** Το payload που φτάνει πράγματι στο Firestore `.set()`. */
function writtenEntry(): Record<string, unknown> {
  expect(firebaseAdminMock.__setMock).toHaveBeenCalledTimes(1);
  return firebaseAdminMock.__setMock.mock.calls[0][0] as Record<string, unknown>;
}

beforeEach(() => {
  firebaseAdminMock.__setMock.mockClear();
  firebaseAdminMock.__collectionMock.mockClear();
});

describe('EntityAuditService.recordChange — ο καθαριστής είναι ΡΗΧΟΣ εκ συμβολαίου', () => {
  it('Ε0 ΠΑΡΟΝΟΜΑΣΤΗΣ — το write φτάνει στη σωστή συλλογή και ο sentinel επιβιώνει ΑΥΤΟΥΣΙΟΣ', async () => {
    const auditId = await EntityAuditService.recordChange(
      recordParams([{ field: 'width', oldValue: '700', newValue: '750', label: 'width' }]),
    );

    expect(auditId).not.toBeNull();
    expect(firebaseAdminMock.__collectionMock).toHaveBeenCalledWith(COLLECTIONS.ENTITY_AUDIT_TRAIL);

    const entry = writtenEntry();
    // Ταυτότητα, ΟΧΙ ισότητα: αναδρομή χωρίς φρουρό θα τον είχε κάνει `{}` — και τότε το
    // document θα γραφόταν ΧΩΡΙΣ πραγματικό timestamp, σιωπηλά (ADR-438).
    expect(entry.timestamp).toBe(SENTINEL);
    expect(entry.entityType).toBe('column');
    expect(entry.source).toBe('service');
  });

  it('Ε1 🔴 Η ΑΝΑΛΛΟΙΩΤΗ — ο πίνακας `changes[]` φτάνει στο Firestore με ΤΑΥΤΟΤΗΤΑ ΑΝΑΦΟΡΑΣ', async () => {
    const changes: AuditFieldChange[] = [
      { field: 'width', oldValue: '700', newValue: '750', label: 'width' },
    ];

    await EntityAuditService.recordChange(recordParams(changes));

    // `toBe`, ΟΧΙ `toEqual`. Το ερώτημα δεν είναι «ίδιο περιεχόμενο;» αλλά «**μπήκε μέσα**
    // ο καθαριστής;». Κάθε αναδρομικός καθαριστής **αντιγράφει**, άρα σπάει την ταυτότητα
    // ακόμα κι όταν το περιεχόμενο βγαίνει ίδιο. Είναι το μόνο κριτήριο εδώ που **δεν
    // μπορεί** να ικανοποιηθεί κατά τύχη — και το μόνο που κοκκινίζει ΠΡΙΝ εμφανιστεί ζημιά.
    expect(writtenEntry().changes).toBe(changes);
  });

  it('Ε2 🔴 — `quantity: undefined` ΜΕΣΑ σε εγγραφή ΕΠΙΒΙΩΝΕΙ: γι΄ αυτό υπάρχει το conditional spread', async () => {
    // ΑΥΤΟ είναι το σενάριο που το ADR-852 §4.6 απαγορεύει στην ΠΑΡΑΓΩΓΗ: αν κάποιος
    // «απλοποιήσει» το `descriptorChannels()` σε `quantity: def.quantity`, κάθε **αδήλωτο**
    // πεδίο παράγει ακριβώς αυτό. Η άγκυρα δεν το εγκρίνει — **αποδεικνύει ότι ο writer
    // ΔΕΝ το σώζει**, άρα το `undefined` θα έφτανε στον Admin SDK και θα έριχνε το write.
    const changes: AuditFieldChange[] = [
      { field: 'width', oldValue: '700', newValue: '750', label: 'width', quantity: undefined },
    ];

    await EntityAuditService.recordChange(recordParams(changes));

    const written = writtenEntry().changes as AuditFieldChange[];
    expect('quantity' in written[0]).toBe(true); // το κλειδί ΔΕΝ αφαιρέθηκε…
    expect(written[0].quantity).toBeUndefined(); // …και κρατά την επικίνδυνη τιμή
  });
});

/**
 * ΓΙΑΤΙ Ο WRITER ΔΕΝ ΧΡΗΣΙΜΟΠΟΙΕΙ ΤΟ SSoT `stripUndefinedDeep` — εκτελεσμένο, όχι ισχυρισμός.
 *
 * Το `.claude-rules/pending-ratchet-work.md` καταγράφει ότι ο ρηχός καθαριστής είναι
 * **οικογένεια 4** και θέλει κάποτε ένα SSoT. Αυτές οι δύο άγκυρες καρφώνουν **γιατί** το
 * σπίτι δεν μπορεί να είναι το `firestore-sanitize.ts` **ως έχει**: ο γείτονας
 * `stripUndefinedDeep` είναι μια αλλαγή **μιας λέξης** μακριά, και είναι **επικίνδυνος**.
 */
describe('Ε3 — το SSoT `stripUndefinedDeep` είναι ΑΚΑΤΑΛΛΗΛΟ για audit entry (μετρημένο)', () => {
  it('Ε3α ΠΑΡΟΝΟΜΑΣΤΗΣ — το `Date` ΕΠΙΒΙΩΝΕΙ: το SSoT έχει ρητό φρουρό γι΄ αυτό', () => {
    // Χωρίς αυτό το σκέλος, το Ε3β θα διαβαζόταν ως «το SSoT είναι χύμα». **Δεν είναι**:
    // η ζημιά είναι ΣΤΟΧΕΥΜΕΝΗ, και η ακρίβεια εδώ είναι ο λόγος που η §4.7 μπορεί να
    // πει «`Date` ✅ / sentinel ❌» χωρίς να λέει ψέματα.
    const expiresAt = new Date('2027-01-01T00:00:00.000Z');
    const cleaned = stripUndefinedDeep({ expiresAt }) as { expiresAt: unknown };
    expect(cleaned.expiresAt).toBe(expiresAt);
  });

  it('Ε3β 🔴 ΕΚΤΕΛΕΣΤΙΚΗ ΑΠΟΔΕΙΞΗ — ο sentinel του `serverTimestamp()` γίνεται `{}`', () => {
    // Η μηχανική: instance κλάσης ⇒ δεν είναι `Date`, δεν είναι πίνακας ⇒ πέφτει στο
    // `typeof === 'object'` ⇒ `Object.entries()` === `[]` ⇒ `Object.fromEntries([])` === `{}`.
    expect(Object.entries(SENTINEL)).toEqual([]);

    const cleaned = stripUndefinedDeep({ timestamp: SENTINEL }) as { timestamp: unknown };
    expect(cleaned.timestamp).not.toBe(SENTINEL);
    expect(cleaned.timestamp).toEqual({});
  });
});
