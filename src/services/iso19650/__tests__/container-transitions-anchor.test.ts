/**
 * @jest-environment node
 *
 * @fileoverview 🔴 **Η ΑΓΚΥΡΑ Α17** — οι τέσσερις πράξεις του δοχείου (ADR-862 Φ0 Β6).
 * @related services/iso19650/container-transitions · lib/files/file-record-read
 * @module services/iso19650/__tests__/container-transitions-anchor
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🏆 ΤΙ ΕΚΤΕΛΕΙ — ΡΩΤΑΕΙ ΤΟΝ ΔΙΣΚΟ, ΚΑΙ ΜΕΤΑ ΤΟΝ **ΠΡΑΓΜΑΤΙΚΟ ΑΝΑΓΝΩΣΤΗ**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Κάθε ισχυρισμός διαβάζει το **έγγραφο**, ποτέ την επιστρεφόμενη τιμή. Και το
 * κρίσιμο: η συνέπεια επαληθεύεται καλώντας τον **γνήσιο** `readContainerState` πάνω
 * σε ό,τι γράφτηκε. Ένα test που έπλαθε τον αναγνώστη θα απεδείκνυε ότι ο γραφέας
 * **καλεί** ό,τι νομίζουμε — όχι ότι το αρχείο μένει **ορατό**.
 *
 * ⚠️ **ΓΙ' ΑΥΤΟ ΔΕΝ ΓΙΝΕΤΑΙ mock ΤΟ `file-record-read`.** Είναι ο κριτής που, αν
 * διαφωνήσει με τον γραφέα, βγάζει `unreadable` ⇒ **αόρατο αρχείο στην παραγωγή**.
 * Η διαφωνία των δύο είναι **ακριβώς** η βλάβη που αυτή η σουίτα υπάρχει να πιάνει.
 *
 * 🔑 Το ίχνος (`recordFileAudit`) **γίνεται mock επίτηδες**: είναι fire-and-forget, άρα
 * η γραφή του θα προσέθετε **ασύγχρονα** μία ακόμη εγγραφή στον πλαστό και η μέτρηση
 * ατομικότητας (`writes === 1`) θα γινόταν **ασταθής**. Το mock το κάνει ντετερμινιστικό
 * **και** επιτρέπει να ελεγχθεί ότι η ενέργεια είναι **διακριτή** (`cde_*`).
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import { readContainerState } from '@/lib/files/file-record-read';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

// ⚠️ `let` και όχι `const`: το εργοστάσιο του `jest.mock` ανυψώνεται **πάνω** από κάθε
//    αρχικοποίηση. Η `getAdminFirestore` διαβάζει τη μεταβλητή σε **χρόνο κλήσης**,
//    οπότε κάθε test μπορεί να βάλει καινούργιο πλαστό (καθαρότερο από `reset()`).
let fake: FakeFirestore;

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: (): AdminFirestore => fake as unknown as AdminFirestore,
}));

jest.mock('@/services/file-audit-admin.service', () => ({
  recordFileAudit: jest.fn(async () => 'audit_test'),
}));

import { recordFileAudit } from '@/services/file-audit-admin.service';
import { transitionContainer, deriveCdeState } from '../container-transitions';

const FILE_ID = 'file_cde_anchor';
const COMPANY = 'c_alpha';
const AUTHOR = 'u_author';

/** Ο δημιουργός — `company_admin`, άρα κατέχει και τις τέσσερις ικανότητες. */
const author = { uid: AUTHOR, companyId: COMPANY, globalRole: 'company_admin' as const };

/** Άλλος άνθρωπος, **με τον ανώτατο ρόλο του συστήματος**. */
const superAdmin = { uid: 'u_super', companyId: COMPANY, globalRole: 'super_admin' as const };

function seedFile(extra: Record<string, unknown> = {}): void {
  fake.seed(COLLECTIONS.FILES, FILE_ID, {
    id: FILE_ID,
    companyId: COMPANY,
    createdBy: AUTHOR,
    status: 'ready',
    revision: 2,
    ...extra,
  });
}

/** Το έγγραφο **όπως είναι τώρα στον δίσκο**. */
function storedFile(): Record<string, unknown> {
  const rows = fake.all<Record<string, unknown>>(COLLECTIONS.FILES);
  return rows[0] ?? {};
}

beforeEach(() => {
  fake = new FakeFirestore();
  jest.clearAllMocks();
});

// ============================================================================
// Μ0 — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: ΜΠΟΡΕΙ ΑΥΤΗ Η ΣΟΥΙΤΑ ΝΑ ΚΟΚΚΙΝΙΣΕΙ;
// ============================================================================

describe('Μ0 — ο παρονομαστής (η μετάλλαξη που ΠΡΕΠΕΙ να πιάνεται)', () => {
  it('🔴 Μ0 — πράξη ΧΩΡΙΣ προβολή ⇒ ο θεματοφύλακας λέει act-without-declared-state', () => {
    // 🔑 **ΑΥΤΗ ΕΙΝΑΙ Η ΜΕΤΑΛΛΑΞΗ ΤΟΥ Β6, ΕΚΤΕΛΕΣΜΕΝΗ.** Αν κάποιος σπάσει την
    //    ατομικότητα του γραφέα (γράψει το `cdeShare` και **όχι** το `cdeState`), το
    //    έγγραφο καταλήγει **ακριβώς** εδώ — και ο θεματοφύλακας το κάνει `unreadable`,
    //    δηλαδή **αόρατο**. Χωρίς αυτόν τον ισχυρισμό, η άγκυρα Α17.2 θα ήταν πράσινη
    //    για λόγο που κανείς δεν επαλήθευσε.
    const state = readContainerState({
      cdeShare: { by: AUTHOR, at: '2026-09-16T10:00:00.000Z', revision: 2 },
      // ⛔ ΛΕΙΠΕΙ ΕΠΙΤΗΔΕΣ: cdeState
    });

    expect(state).toEqual({ phase: 'unreadable', why: 'act-without-declared-state' });
  });

  it('🔴 Μ0β — προβολή ΧΩΡΙΣ πράξη ⇒ shared-without-share-act', () => {
    // Η **αντίστροφη** μισή γραφή: η ετικέτα χωρίς την πράξη που τη γεννά.
    const state = readContainerState({ cdeState: 'SHARED' });
    expect(state).toEqual({ phase: 'unreadable', why: 'shared-without-share-act' });
  });
});

// ============================================================================
// Α17 — ΟΙ ΤΕΣΣΕΡΙΣ ΠΡΑΞΕΙΣ
// ============================================================================

describe('Α17 — παράδοση (WIP → SHARED)', () => {
  it('✅ Α17.1 — η παράδοση γράφει πράξη ΚΑΙ προβολή, και ο ΠΡΑΓΜΑΤΙΚΟΣ αναγνώστης συμφωνεί', async () => {
    seedFile();

    const outcome = await transitionContainer({ fileId: FILE_ID, act: 'share', actor: author });

    expect(outcome).toMatchObject({ kind: 'transitioned', from: 'pre-cde', to: 'SHARED' });

    const stored = storedFile();
    expect(stored.cdeState).toBe('SHARED');
    expect(stored.cdeShare).toMatchObject({ by: AUTHOR, revision: 2 });

    // 🔑 Η ΚΡΙΣΙΜΗ ΓΡΑΜΜΗ: ο γνήσιος θεματοφύλακας ξαναδιαβάζει ό,τι γράφτηκε.
    expect(readContainerState(stored)).toEqual({ phase: 'SHARED', teamId: null });
  });

  it('🔑 Α17.2 — ΑΤΟΜΙΚΟΤΗΤΑ: ακριβώς ΜΙΑ εγγραφή στον δίσκο', async () => {
    seedFile();
    const before = fake.writes;

    await transitionContainer({ fileId: FILE_ID, act: 'share', actor: author });

    // Δύο γραφές θα σήμαιναν παράθυρο όπου η πράξη υπάρχει χωρίς την προβολή της —
    // δηλαδή στιγμή όπου το αρχείο είναι **αόρατο** (δες Μ0).
    expect(fake.writes - before).toBe(1);
  });

  it('♻️ Α17.3 — ΙΔΕΜΠΟΤΗΣΙΑ: δεύτερη παράδοση ⇒ noop, καμία δεύτερη γραφή', async () => {
    seedFile();
    await transitionContainer({ fileId: FILE_ID, act: 'share', actor: author });
    const afterFirst = fake.writes;

    const again = await transitionContainer({ fileId: FILE_ID, act: 'share', actor: author });

    expect(again).toMatchObject({ kind: 'noop', why: 'already-in-state' });
    expect(fake.writes).toBe(afterFirst);
  });

  it('📒 Α17.4 — το ίχνος χρησιμοποιεί ΔΙΑΚΡΙΤΗ ενέργεια, ποτέ το πιασμένο «share»', async () => {
    seedFile();
    await transitionContainer({ fileId: FILE_ID, act: 'share', actor: author });

    // ⚠️ Το `'share'` σημαίνει **σύνδεσμο κοινοποίησης** (`file-share.service`). Αν η
    //    πράξη CDE το χρησιμοποιούσε, το AuditLogPanel θα έδειχνε **δύο εντελώς
    //    διαφορετικά γεγονότα** στην ίδια γραμμή.
    expect(recordFileAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'cde_share', companyId: COMPANY, performedBy: AUTHOR }),
    );
  });
});

describe('Α17 — σφραγίδα: ΙΔΙΟΚΤΗΣΙΑ, όχι ικανότητα', () => {
  it('🔴 Α17.5 — σφραγίδα από ΜΗ-ΔΗΜΙΟΥΡΓΟ ⇒ not-author, ΑΚΟΜΗ ΚΑΙ με super_admin', async () => {
    seedFile();

    const outcome = await transitionContainer({ fileId: FILE_ID, act: 'seal', actor: superAdmin });

    // 🔑 Ο `super_admin` περνά τον `decideCapability` με `granted-by-bypass`. Αν ο
    //    έλεγχος ιδιοκτησίας ζούσε **μέσα** στον κριτή, αυτό το test θα ήταν πράσινο
    //    κατά λάθος — και ο υπερδιαχειριστής θα υπέγραφε αντί για μηχανικό.
    expect(outcome).toMatchObject({ kind: 'refused', why: 'not-author' });
    expect(storedFile().cdeSeal).toBeUndefined();
  });

  it('✅ Α17.6 — ο δημιουργός σφραγίζει, και η καταλληλότητά του ταξιδεύει', async () => {
    seedFile();

    await transitionContainer({
      fileId: FILE_ID,
      act: 'seal',
      actor: author,
      suitabilityCode: 'IFC',
    });

    expect(storedFile().cdeSeal).toMatchObject({ by: AUTHOR, revision: 2, suitabilityCode: 'IFC' });
  });
});

describe('Α17 — απελευθέρωση: ΔΥΟ σκαλοπάτια, ΙΔΙΑ αναθεώρηση', () => {
  it('🔴 Α17.7 — απελευθέρωση ΧΩΡΙΣ σφραγίδα ⇒ seal-missing', async () => {
    seedFile();
    await transitionContainer({ fileId: FILE_ID, act: 'share', actor: author });

    const outcome = await transitionContainer({ fileId: FILE_ID, act: 'release', actor: author });

    expect(outcome).toMatchObject({ kind: 'refused', why: 'seal-missing' });
    expect(storedFile().cdeState).toBe('SHARED');
  });

  it('🔴 Α17.8 — σφραγίδα σε ΠΑΛΙΑ αναθεώρηση ⇒ revision-moved', async () => {
    seedFile({ revision: 1 });
    await transitionContainer({ fileId: FILE_ID, act: 'seal', actor: author });

    // Ανέβηκε νέα έκδοση **μετά** τη σφραγίδα — «σφράγισα την P01, δημοσιεύτηκε η P02».
    fake.seed(COLLECTIONS.FILES, FILE_ID, { ...storedFile(), revision: 2 });

    const outcome = await transitionContainer({ fileId: FILE_ID, act: 'release', actor: author });

    expect(outcome).toMatchObject({ kind: 'refused', why: 'revision-moved' });
    expect(storedFile().cdeState).not.toBe('PUBLISHED');
  });

  it('✅ Α17.9 — σφραγίδα + απελευθέρωση στην ΙΔΙΑ αναθεώρηση ⇒ PUBLISHED, και ο αναγνώστης συμφωνεί', async () => {
    seedFile();
    await transitionContainer({ fileId: FILE_ID, act: 'seal', actor: author, suitabilityCode: 'IFC' });
    await transitionContainer({ fileId: FILE_ID, act: 'release', actor: author });

    const stored = storedFile();
    expect(stored.cdeState).toBe('PUBLISHED');
    expect(readContainerState(stored)).toEqual({ phase: 'PUBLISHED', teamId: null, revision: 2 });
    expect(stored.suitabilityCode).toBe('IFC');
  });
});

describe('Α17 — απόσυρση: SUPERSEDED, ΠΟΤΕ εξαφάνιση', () => {
  it('🔴 Α17.10 — η απόσυρση ΔΕΝ διαγράφει: το έγγραφο υπάρχει, isDeleted δεν μπαίνει', async () => {
    seedFile();

    const outcome = await transitionContainer({
      fileId: FILE_ID,
      act: 'withdraw',
      actor: author,
      reason: 'λάθος αποτύπωση',
    });

    expect(outcome).toMatchObject({ kind: 'transitioned', to: 'SUPERSEDED' });

    const stored = storedFile();
    // 🔑 Η μετάλλαξη (δ) της Α17: «απόσυρση που **σβήνει** αντί να αποσύρει».
    expect(stored.id).toBe(FILE_ID);
    expect(stored.isDeleted).not.toBe(true);
    expect(stored.purgeAt).toBeUndefined();
    expect(stored.cdeState).toBe('SUPERSEDED');
    expect(stored.cdeWithdrawal).toMatchObject({ by: AUTHOR, reason: 'λάθος αποτύπωση' });
    expect(readContainerState(stored)).toEqual({ phase: 'SUPERSEDED', teamId: null });
  });

  it('🔒 Α17.11 — η απόσυρση ΝΙΚΑ τη σφραγίδα: αποσυρμένο δεν ξαναγίνεται «για κατασκευή»', () => {
    // Καθαρή κρίση, χωρίς δίσκο: *«deny πάνω από allow»* (ADR-862 §3.5).
    const acts = {
      share: null,
      seal: { by: AUTHOR, at: 'x', revision: 2 },
      release: { by: AUTHOR, at: 'x', revision: 2 },
      withdrawal: { by: AUTHOR, at: 'x', revision: 2 },
      supersession: null,
    };
    expect(deriveCdeState(acts, 2)).toBe('SUPERSEDED');
  });
});

describe('Α17 — απομόνωση μισθωτή', () => {
  it('🔒 Α17.12 — ξένη εταιρεία ⇒ tenant-mismatch, καμία γραφή', async () => {
    seedFile();
    const before = fake.writes;

    const outcome = await transitionContainer({
      fileId: FILE_ID,
      act: 'share',
      actor: { ...author, companyId: 'c_other' },
    });

    expect(outcome).toMatchObject({ kind: 'refused', why: 'tenant-mismatch' });
    expect(fake.writes).toBe(before);
  });
});
