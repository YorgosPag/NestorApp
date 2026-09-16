/**
 * @jest-environment node
 *
 * @fileoverview 🔴 **Η ΑΓΚΥΡΑ ΤΟΥ ADMIN-SIDE ΓΡΑΦΕΑ ΙΧΝΟΥΣ** (ADR-191 · ADR-862 Φ0 Β6).
 * @related services/file-audit-admin.service · types/file-audit
 * @module services/__tests__/file-audit-admin-anchor
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΞΕΧΩΡΙΣΤΑ ΑΠΟ ΤΗΝ Α17
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Η άγκυρα των τεσσάρων πράξεων κάνει **mock** αυτόν τον γραφέα — και **πρέπει**, γιατί
 * είναι fire-and-forget και θα έκανε τη μέτρηση ατομικότητας ασταθή. Συνέπεια: μετά την
 * Α17 ο γραφέας ήταν **γραμμένος και ανεκτέλεστος** — ο *«607ος αδρανής φρουρός»* του
 * ADR-749 §5. Πράσινη σουίτα που δεν αγγίζει τον κώδικα δεν είναι απόδειξη.
 *
 * ⇒ Εδώ ο γραφέας **εκτελείται πραγματικά**, πάνω σε αληθινό πλαστό δίσκο.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🔑 ΤΙ ΦΥΛΑΕΙ — ΤΙΣ ΔΥΟ ΑΠΟΚΛΙΣΕΙΣ ΠΟΥ ΜΕΤΡΗΘΗΚΑΝ ΣΤΑ ΠΕΝΤΕ ΔΙΔΥΜΑ
 * ════════════════════════════════════════════════════════════════════════════
 *
 *   1. **Χρόνος**: τα πέντε γράφουν `nowISO()` (**συμβολοσειρά**) στο ίδιο πεδίο όπου ο
 *      πελάτης γράφει `serverTimestamp()` (**Timestamp**). Δύο τύποι, ένα πεδίο.
 *   2. **Μισθωτής**: `archive` και `purge` **δεν** γράφουν `companyId`, ενώ ο μοναδικός
 *      αναγνώστης ρωτά `where('companyId','==',…)` ⇒ γραμμές **δομικά αόρατες**.
 *
 * Οι δύο ισχυρισμοί παρακάτω είναι ακριβώς αυτές οι δύο αποκλίσεις, ως **κανόνας**.
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

/**
 * Ό,τι επιστρέφει ο πλαστός `FieldValue.serverTimestamp()`.
 *
 * 🔴 **ΑΝΤΙΚΕΙΜΕΝΟ, ΟΧΙ ΣΥΜΒΟΛΟΣΕΙΡΑ — ΚΑΙ Η ΠΡΩΤΗ ΓΡΑΦΗ ΤΟ ΕΙΧΕ ΛΑΘΟΣ.** Το πραγματικό
 * `FieldValue.serverTimestamp()` επιστρέφει **sentinel αντικείμενο**· ένας πλαστός που
 * γυρίζει string είναι **πιο συγχωρητικός από την παραγωγή** και κάνει τον ισχυρισμό
 * *«δεν είναι συμβολοσειρά ρολογιού»* **αδύνατο να διατυπωθεί** — ακριβώς το σχήμα που
 * προειδοποιεί το `fake-firestore.ts` (*«μη «βελτιώσεις» τον πλαστό ώστε να δέχεται
 * περισσότερα — θα έκρυβε τη βλάβη»*).
 */
const SERVER_TS = { __fieldValue: 'serverTimestamp' } as const;

// ⚠️ `let`: το εργοστάσιο του `jest.mock` ανυψώνεται πάνω από κάθε αρχικοποίηση· η
//    `getAdminFirestore` διαβάζει τη μεταβλητή σε **χρόνο κλήσης**.
let fake: FakeFirestore;
let failingDb: unknown = null;

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: (): AdminFirestore =>
    (failingDb ?? fake) as unknown as AdminFirestore,
  FieldValue: { serverTimestamp: () => SERVER_TS },
}));

import { recordFileAudit } from '../file-audit-admin.service';

const FILE_ID = 'file_trace';
const COMPANY = 'c_alpha';

function storedEntries(): Record<string, unknown>[] {
  return [...fake.all<Record<string, unknown>>(COLLECTIONS.FILE_AUDIT_LOG)];
}

beforeEach(() => {
  fake = new FakeFirestore();
  failingDb = null;
});

describe('Γ — ο ΕΝΑΣ γραφέας ίχνους του διακομιστή', () => {
  it('✅ Γ1 — γράφει ΧΡΟΝΟ ΔΙΑΚΟΜΙΣΤΗ, όχι συμβολοσειρά ρολογιού', async () => {
    const id = await recordFileAudit({
      fileId: FILE_ID,
      action: 'cde_seal',
      performedBy: 'u_author',
      companyId: COMPANY,
    });

    expect(id).not.toBeNull();

    const [entry] = storedEntries();
    // 🔑 Η απόκλιση #1 των πέντε διδύμων, ως κανόνας: **ποτέ** `nowISO()` εδώ.
    expect(entry.timestamp).toBe(SERVER_TS);
    expect(typeof entry.timestamp).not.toBe('string' as never);
    expect(entry).toMatchObject({
      fileId: FILE_ID,
      action: 'cde_seal',
      performedBy: 'u_author',
      companyId: COMPANY,
    });
  });

  it('🔴 Γ2 — ΑΡΝΕΙΤΑΙ χωρίς μισθωτή: καμία αόρατη γραμμή, καμία γραφή', async () => {
    const before = fake.writes;

    const id = await recordFileAudit({
      fileId: FILE_ID,
      action: 'cde_share',
      performedBy: 'u_author',
      // 🔴 Κενό = **απουσία** μισθωτή, όχι μισθωτής. Ο τύπος το επιτρέπει (εγγυάται
      //    σχήμα, όχι τιμή) — γι' αυτό ο φρουρός ζει σε χρόνο εκτέλεσης.
      companyId: '   ',
    });

    // Η απόκλιση #2 των πέντε διδύμων: γραμμή που **κανείς δεν μπορεί να διαβάσει**
    // κοστίζει και δεν προσφέρει τίποτα ⇒ δεν γράφεται καθόλου.
    expect(id).toBeNull();
    expect(fake.writes).toBe(before);
    expect(storedEntries()).toHaveLength(0);
  });

  it('🔒 Γ3 — βλάβη βάσης ⇒ `null`, ΠΟΤΕ ρίψη (το ίχνος δεν ακυρώνει πράξη που έγινε)', async () => {
    failingDb = {
      collection: () => {
        throw new Error('FIRESTORE_UNAVAILABLE');
      },
    };

    // ⚠️ ADR-862 §5.7: *«ένα ίχνος που αποτυγχάνει δεν επιτρέπεται να ακυρώσει πράξη
    //    που έγινε»*. Αν πετούσε, ο καλών θα γύριζε 500 για σφραγίδα που **δεσμεύτηκε**.
    await expect(
      recordFileAudit({
        fileId: FILE_ID,
        action: 'cde_release',
        performedBy: 'u_coordinator',
        companyId: COMPANY,
      }),
    ).resolves.toBeNull();
  });

  it('✅ Γ4 — χωρίς metadata δεν γράφεται πεδίο `metadata` καθόλου', async () => {
    await recordFileAudit({
      fileId: FILE_ID,
      action: 'cde_withdraw',
      performedBy: 'u_author',
      companyId: COMPANY,
    });

    // Το Firestore απορρίπτει `undefined`. Ο γραφέας δεν βασίζεται σε καθαριστή: η
    // απουσία είναι **ιδιότητα της κατασκευής** (conditional spread).
    expect(Object.hasOwn(storedEntries()[0] ?? {}, 'metadata')).toBe(false);
  });

  it('✅ Γ5 — με metadata, ταξιδεύει αυτούσιο', async () => {
    await recordFileAudit({
      fileId: FILE_ID,
      action: 'cde_seal',
      performedBy: 'u_author',
      companyId: COMPANY,
      metadata: { from: 'SHARED', to: 'PUBLISHED', revision: 2 },
    });

    expect(storedEntries()[0]?.metadata).toEqual({
      from: 'SHARED',
      to: 'PUBLISHED',
      revision: 2,
    });
  });
});
