/**
 * 🧪 **ΖΩΝΤΑΝΗ ΕΠΑΛΗΘΕΥΣΗ — Ο ΠΡΑΓΜΑΤΙΚΟΣ ΓΡΑΦΕΑΣ ΣΥΝΑΝΤΑ ΤΟΝ ΠΡΑΓΜΑΤΙΚΟ ΚΑΝΟΝΑ** (ADR-867 Β4)
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΚΕΝΟ ΠΟΥ ΚΛΕΙΝΕΙ — ΚΑΙ ΥΠΗΡΧΕ ΑΚΟΜΗ ΚΑΙ ΜΕ **ΟΛΑ** ΤΑ TESTS ΠΡΑΣΙΝΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το Β4 είχε **δύο** σετ αποδείξεων, και **κανένα** δεν άγγιζε το άλλο:
 *
 *   1. `thread-writer.test.ts` — ο γραφέας, πάνω σε **ΠΛΑΣΤΟ** Firestore. Αποδεικνύει
 *      *«γράφω τα σωστά έγγραφα»*, με μηχανή που **εμείς** γράψαμε.
 *   2. `network-threads.rules.test.ts` — ο κανόνας, πάνω σε **ΣΠΑΡΜΕΝΑ ΜΕ ΤΟ ΧΕΡΙ** έγγραφα.
 *      Αποδεικνύει *«κόβω τον σωστό άνθρωπο»*, πάνω σε σχήμα που **εμείς** γράψαμε.
 *
 * ⇒ Αν ο γραφέας έγραφε `until: undefined` αντί για `null`, ή το πεδίο λεγόταν `endedAt`,
 * **και τα δύο σετ θα έμεναν ΠΡΑΣΙΝΑ** — και στην παραγωγή **κανείς δεν θα διάβαζε τίποτα**.
 * Το σχήμα «δύο πράσινα που δεν μιλούν μεταξύ τους» είναι μετρημένο σε αυτό το δέντρο
 * (ADR-823 §11: η σουίτα δοκίμαζε την **πηγή** ενώ η παραγωγή έτρεχε **άλλο αρχείο**).
 *
 * 🔑 **ΕΔΩ ΤΡΕΧΕΙ Ο ΠΡΑΓΜΑΤΙΚΟΣ ΓΡΑΦΕΑΣ (Admin SDK) ΠΑΝΩ ΣΕ ΠΡΑΓΜΑΤΙΚΟ FIRESTORE**, και
 * μετά ο **πραγματικός κανόνας** ρωτιέται με **πελατικό** SDK και αληθινά claims. Καμία
 * γραμμή σπαρμένη με το χέρι· κανένα πλαστό `runTransaction`.
 *
 * ⚠️ **Ο Admin SDK ΠΑΡΑΚΑΜΠΤΕΙ τους κανόνες — και είναι ο σκοπός, όχι παραχώρηση**: αυτό
 * **ΕΙΝΑΙ** η παραγωγή. Οι κανόνες κλείνουν τον πελάτη· ο διακομιστής γράφει. Η CHECK 3.89
 * υπάρχει ακριβώς επειδή ο κανόνας **δεν** φυλάει τον διακομιστή.
 *
 * 🏆 **ΤΟ ΣΕΝΑΡΙΟ ΕΙΝΑΙ Ο ΙΣΧΥΡΙΣΜΟΣ ΤΟΥ ADR-834 §5 Β (ε), ΕΚΤΕΛΕΣΜΕΝΟΣ**: «κανένα ορφανό
 * νήμα, ποτέ». Η αποχώρηση του υπευθύνου **αλλάζει ποιος διαβάζει** — και το μετράμε από
 * την **έξοδο του κανόνα**, όχι από το έγγραφο.
 *
 * @since 2026-09-17 (ADR-867 Β4 — πρώιμη εκδοχή του Β9)
 */

import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { mandateActSeed } from '@/lib/network-edge/edge-sources';
import { transferActTeamsOnDeparture } from '@/services/network-messaging/act-team-departure';
import { ensureActTeam } from '@/services/network-messaging/act-team-writer';
import { retractNetworkMessage, sendNetworkMessage } from '@/services/network-messaging/thread-messages';
import { decodeDirectoryCursor, listNetworkThreads } from '@/services/network-messaging/thread-directory';
import { ensureActThread } from '@/services/network-messaging/thread-writer';

import { getContext } from '../_harness/auth-contexts';
import { initEmulator, resetData, teardownEmulator } from '../_harness/emulator';
import { NETWORK_THREADS, NETWORK_THREAD_MESSAGES } from '../_harness/seed-helpers-network';
import { PERSONA_CLAIMS, SAME_TENANT_COMPANY_ID } from '../_registry/personas';

const NOW = '2026-09-17T10:00:00.000Z';
const LATER = '2026-11-01T10:00:00.000Z';

/** Ο υπάλληλος που ανέλαβε την εντολή. */
const RESPONSIBLE = PERSONA_CLAIMS.same_tenant_user.uid;
/** Ο διαχειριστής του γραφείου — **έξω** από την ομάδα, μέχρι την αποχώρηση. */
const ADMIN = PERSONA_CLAIMS.same_tenant_admin.uid;
/** Ο ιδιοκτήτης: ιδιώτης, άλλος χώρος, `external_user` (ADR-798). */
const OWNER = PERSONA_CLAIMS.external_user.uid;

const ACT_SEED = mandateActSeed('ownp_live_1', SAME_TENANT_COMPANY_ID);

const threadDocOf = (env: RulesTestEnvironment, persona: Parameters<typeof getContext>[1], id: string) =>
  getContext(env, persona).firestore().collection(NETWORK_THREADS).doc(id);

const messagesOf = (env: RulesTestEnvironment, persona: Parameters<typeof getContext>[1], id: string) =>
  threadDocOf(env, persona, id).collection(NETWORK_THREAD_MESSAGES);

describe('🧪 ΖΩΝΤΑΝΗ — ο γραφέας γράφει, ο κανόνας κρίνει (ADR-867 Β4)', () => {
  let env: RulesTestEnvironment;
  let adminApp: App;
  let adminDb: AdminFirestore;

  beforeAll(async () => {
    env = await initEmulator();

    // 🔑 **ΤΟ ΙΔΙΟ projectId** με το περιβάλλον κανόνων — αλλιώς ο γραφέας θα έγραφε σε
    //    **άλλη** βάση και ο κανόνας θα κρινόταν πάνω στο κενό: πράσινο που σημαίνει
    //    «δεν υπήρχε τίποτα να διαβαστεί».
    // ⚠️ Ο Admin SDK εντοπίζει **μόνος του** το `FIRESTORE_EMULATOR_HOST` (δες
    //    `src/lib/firebase.ts`), που το ορίζει το `firebase emulators:exec`.
    // ⚠️ **ΚΑΝΕΝΑ `credential`, ΚΑΙ ΕΙΝΑΙ ΣΩΣΤΟ**: με `FIRESTORE_EMULATOR_HOST` ο Admin SDK
    //    δεν υπογράφει τίποτα. Η πρώτη γραφή περνούσε `cert({ privateKey: '…emulator…' })`
    //    και έσκαγε με «Too few bytes to read ASN.1 value» — δηλαδή η σουίτα θα κοκκίνιζε
    //    για **ψεύτικο κλειδί**, όχι για τον κώδικα που δοκιμάζει.
    adminApp = initializeApp({ projectId: env.projectId }, `live-${env.projectId}`);
    adminDb = getFirestore(adminApp);
  });

  afterAll(async () => {
    await deleteApp(adminApp);
    await teardownEmulator(env);
  });

  afterEach(async () => {
    await resetData(env);
  });

  /** Η πράξη, όπως τη γεννά η **αποδοχή αιτήματος** — με τον ΠΡΑΓΜΑΤΙΚΟ γραφέα. */
  async function birthFromRealWriter(): Promise<string> {
    await ensureActTeam(
      adminDb,
      {
        actKind: 'mandate',
        actSeed: ACT_SEED,
        hostCompanyId: SAME_TENANT_COMPANY_ID,
        responsibleUid: RESPONSIBLE,
      },
      NOW,
    );

    const outcome = await ensureActThread(adminDb, {
      actSeed: ACT_SEED,
      birth: {
        kind: 'act',
        actKind: 'mandate',
        actSeed: ACT_SEED,
        hostCompanyId: SAME_TENANT_COMPANY_ID,
        counterpartUid: OWNER,
      },
      team: { responsibleUid: RESPONSIBLE, memberUids: [RESPONSIBLE] },
      newcomerReason: 'creator',
      addedBy: RESPONSIBLE,
      nowISO: NOW,
    });

    expect(outcome.created).toBe(true);
    expect(outcome.threadId).not.toBeNull();
    return outcome.threadId as string;
  }

  // ==========================================================================
  // Ζ1 — Η ΑΛΥΣΙΔΑ: ΓΡΑΦΕΙ Ο ΔΙΑΚΟΜΙΣΤΗΣ, ΔΙΑΒΑΖΕΙ Ο ΑΝΘΡΩΠΟΣ
  // ==========================================================================

  it('Ζ1 — ο ιδιοκτήτης στέλνει μήνυμα (Admin SDK) και το ΔΙΑΒΑΖΕΙ μέσα από τον κανόνα', async () => {
    const threadId = await birthFromRealWriter();

    const sent = await sendNetworkMessage(adminDb, {
      threadId,
      senderUid: OWNER,
      text: 'Καλησπέρα, υπάρχει ενδιαφέρον για το διαμέρισμα;',
      nowISO: NOW,
    });
    expect(sent).toMatchObject({ kind: 'sent' });

    // 🔑 Ο ΠΕΛΑΤΗΣ, με πραγματικά claims, μέσα από τους πραγματικούς κανόνες.
    const thread = await assertSucceeds(threadDocOf(env, 'external_user', threadId).get());
    expect(thread.data()?.lastMessageAt).toBe(NOW);

    const messages = await assertSucceeds(messagesOf(env, 'external_user', threadId).get());
    expect(messages.size).toBe(1);
    expect(messages.docs[0].data().text).toContain('ενδιαφέρον');

    // Και ο υπεύθυνος του γραφείου, από την άλλη πλευρά της ίδιας ακμής.
    await assertSucceeds(threadDocOf(env, 'same_tenant_user', threadId).get());
  });

  it('Ζ2 — ο διαχειριστής του ΙΔΙΟΥ γραφείου δεν διαβάζει τίποτα, ούτε ο super_admin', async () => {
    const threadId = await birthFromRealWriter();
    await sendNetworkMessage(adminDb, { threadId, senderUid: OWNER, text: 'γεια', nowISO: NOW });

    for (const persona of ['same_tenant_admin', 'super_admin', 'cross_tenant_admin'] as const) {
      await assertFails(threadDocOf(env, persona, threadId).get());
      await assertFails(messagesOf(env, persona, threadId).get());
    }
  });

  // ==========================================================================
  // Ζ3 — 🏆 «ΚΑΝΕΝΑ ΟΡΦΑΝΟ ΝΗΜΑ, ΠΟΤΕ» — ΜΕΤΡΗΜΕΝΟ ΑΠΟ ΤΗΝ ΕΞΟΔΟ ΤΟΥ ΚΑΝΟΝΑ
  // ==========================================================================

  it('Ζ3 — η ΑΠΟΧΩΡΗΣΗ του υπευθύνου αλλάζει ΠΟΙΟΣ ΔΙΑΒΑΖΕΙ, ζωντανά', async () => {
    const threadId = await birthFromRealWriter();
    await sendNetworkMessage(adminDb, { threadId, senderUid: OWNER, text: 'γεια', nowISO: NOW });

    // ── ΠΡΙΝ: ο υπεύθυνος διαβάζει, ο διαχειριστής όχι. Ο ΠΑΡΟΝΟΜΑΣΤΗΣ της άγκυρας.
    await assertSucceeds(threadDocOf(env, 'same_tenant_user', threadId).get());
    await assertFails(threadDocOf(env, 'same_tenant_admin', threadId).get());

    // ── Η ΑΠΟΧΩΡΗΣΗ: ο ΠΡΑΓΜΑΤΙΚΟΣ γραφέας μεταβίβασης, σε πραγματικές συναλλαγές.
    const transfer = await transferActTeamsOnDeparture(adminDb, {
      companyId: SAME_TENANT_COMPANY_ID,
      departingUid: RESPONSIBLE,
      fallbackUid: ADMIN,
      performedBy: ADMIN,
      nowISO: LATER,
    });
    expect(transfer.transferred).toBe(1);

    // ── ΜΕΤΑ: η πρόσβαση **αντιστράφηκε** — και το λέει ο ΚΑΝΟΝΑΣ, όχι το έγγραφο.
    await assertFails(threadDocOf(env, 'same_tenant_user', threadId).get());
    await assertSucceeds(threadDocOf(env, 'same_tenant_admin', threadId).get());

    // 🔑 Ο πελάτης **δεν** έχασε τίποτα: η αλλαγή αφορά το γραφείο, όχι τη σχέση.
    await assertSucceeds(threadDocOf(env, 'external_user', threadId).get());
  });

  it('Ζ4 — μετά την αποχώρηση, ο αποχωρών ΔΕΝ στέλνει· ο κληρονόμος στέλνει', async () => {
    const threadId = await birthFromRealWriter();
    await transferActTeamsOnDeparture(adminDb, {
      companyId: SAME_TENANT_COMPANY_ID,
      departingUid: RESPONSIBLE,
      fallbackUid: ADMIN,
      performedBy: ADMIN,
      nowISO: LATER,
    });

    await expect(
      sendNetworkMessage(adminDb, { threadId, senderUid: RESPONSIBLE, text: 'μια τελευταία', nowISO: LATER }),
    ).resolves.toEqual({ kind: 'refused', reason: 'not-audience' });

    await expect(
      sendNetworkMessage(adminDb, { threadId, senderUid: ADMIN, text: 'καλημέρα, ανέλαβα εγώ', nowISO: LATER }),
    ).resolves.toMatchObject({ kind: 'sent' });

    // Και ο πελάτης το **βλέπει** — η συνέχεια της συνομιλίας είναι ο σκοπός όλου του Β4.
    const messages = await assertSucceeds(messagesOf(env, 'external_user', threadId).get());
    expect(messages.size).toBe(1);
    expect(messages.docs[0].data().senderUid).toBe(ADMIN);
  });

  // ==========================================================================
  // Ζ6 — 🔒 Η ΑΝΑΚΛΗΣΗ: Ο ΠΕΛΑΤΗΣ ΒΛΕΠΕΙ ΤΑΦΟΠΛΑΚΑ, ΤΟ ΚΕΙΜΕΝΟ ΕΙΝΑΙ ΑΠΡΟΣΙΤΟ
  // ==========================================================================

  it('Ζ6 — μετά την ανάκληση ο πελάτης βλέπει ΑΔΕΙΟ σώμα, και το βιβλίο είναι ΚΛΕΙΣΤΟ σε όλους', async () => {
    const threadId = await birthFromRealWriter();

    const sent = await sendNetworkMessage(adminDb, {
      threadId,
      senderUid: RESPONSIBLE,
      text: 'η τιμή πέφτει στις 180.000',
      nowISO: NOW,
    });
    const messageId = (sent as { readonly messageId: string }).messageId;

    // ── ΠΡΙΝ: ο πελάτης το διαβάζει ολόκληρο. Ο ΠΑΡΟΝΟΜΑΣΤΗΣ.
    const before = await assertSucceeds(messagesOf(env, 'external_user', threadId).doc(messageId).get());
    expect(before.data()?.text).toContain('180.000');

    const retracted = await retractNetworkMessage(adminDb, {
      threadId,
      messageId,
      actorUid: RESPONSIBLE,
      nowISO: NOW,
    });
    expect(retracted).toEqual({ kind: 'retracted', readBeforeRetraction: false });

    // ── ΜΕΤΑ: το έγγραφο ΥΠΑΡΧΕΙ (ταφόπλακα), το σώμα είναι ΑΔΕΙΟ.
    const after = await assertSucceeds(messagesOf(env, 'external_user', threadId).doc(messageId).get());
    expect(after.exists).toBe(true);
    expect(after.data()?.text).toBe('');
    expect(after.data()?.retractedAt).toBe(NOW);
    expect(after.data()?.readBeforeRetraction).toBe(false);

    // 🔴 ΚΑΙ ΤΟ ΚΕΙΜΕΝΟ ΔΕΝ ΕΙΝΑΙ ΕΝΑ ΕΡΩΤΗΜΑ ΜΑΚΡΙΑ — ούτε για τον ΙΔΙΟ τον αποστολέα.
    for (const persona of ['external_user', 'same_tenant_user', 'same_tenant_admin', 'super_admin'] as const) {
      await assertFails(
        getContext(env, persona)
          .firestore()
          .collection('network_message_retractions')
          .doc(messageId)
          .get(),
      );
    }

    // 🔒 Και ο ΔΙΑΚΟΜΙΣΤΗΣ το κρατά ακέραιο — ΓΚΠΔ άρθρο 17 §3(ε).
    const book = await adminDb.collection('network_message_retractions').doc(messageId).get();
    expect(book.data()?.originalText).toBe('η τιμή πέφτει στις 180.000');
    expect(book.data()?.threadKind).toBe('act');
  });

  // ==========================================================================
  // Ζ5 — Η ΙΔΕΜΠΟΤΗΣΙΑ, ΣΕ ΠΡΑΓΜΑΤΙΚΟ FIRESTORE
  // ==========================================================================

  it('Ζ5 — δεύτερη γέννηση (ανανέωση όρων) βρίσκει το ΙΔΙΟ νήμα, χωρίς να πειράξει το ιστορικό', async () => {
    const threadId = await birthFromRealWriter();
    await sendNetworkMessage(adminDb, { threadId, senderUid: OWNER, text: 'πρώτο', nowISO: NOW });

    const again = await ensureActThread(adminDb, {
      actSeed: ACT_SEED,
      birth: {
        kind: 'act',
        actKind: 'mandate',
        actSeed: ACT_SEED,
        hostCompanyId: SAME_TENANT_COMPANY_ID,
        counterpartUid: OWNER,
      },
      team: { responsibleUid: RESPONSIBLE, memberUids: [RESPONSIBLE] },
      newcomerReason: 'creator',
      addedBy: RESPONSIBLE,
      nowISO: LATER,
    });

    expect(again.threadId).toBe(threadId);
    expect(again.created).toBe(false);
    expect(again.audienceWrites).toEqual([]);

    const thread = await assertSucceeds(threadDocOf(env, 'external_user', threadId).get());
    // 🔴 Το `lastMessageAt` **δεν** μηδενίστηκε: μια ανανέωση όρων δεν σβήνει τη συνομιλία.
    expect(thread.data()?.lastMessageAt).toBe(NOW);
    expect(thread.data()?.createdAt).toBe(NOW);

    const messages = await assertSucceeds(messagesOf(env, 'external_user', threadId).get());
    expect(messages.size).toBe(1);
  });

  // ==========================================================================
  // Ζ7 — Ο ΚΑΤΑΛΟΓΟΣ: ΠΡΑΓΜΑΤΙΚΟ COLLECTION GROUP, ΠΡΑΓΜΑΤΙΚΗ ΤΑΞΙΝΟΜΗΣΗ, ΔΡΟΜΕΑΣ (ADR-867 Β5)
  // ==========================================================================

  it('Ζ7 — ο κατάλογος: σειρά δραστηριότητας, σελίδες με δρομέα, και ΜΟΝΟ ό,τι διαβάζει τώρα', async () => {
    const first = await birthFromRealWriter();
    const secondSeed = mandateActSeed('ownp_live_2', SAME_TENANT_COMPANY_ID);
    const second = await ensureActThread(adminDb, {
      actSeed: secondSeed,
      birth: { kind: 'act', actKind: 'mandate', actSeed: secondSeed, hostCompanyId: SAME_TENANT_COMPANY_ID, counterpartUid: OWNER },
      team: { responsibleUid: ADMIN, memberUids: [ADMIN] },
      newcomerReason: 'creator',
      addedBy: ADMIN,
      nowISO: NOW,
    });
    // 🔑 Μήνυμα στο ΠΡΩΤΟ, αργότερα ⇒ πρέπει να ανέβει πάνω από το δεύτερο (fan-out on write).
    await sendNetworkMessage(adminDb, { threadId: first, senderUid: RESPONSIBLE, text: 'Νέα τιμή', nowISO: LATER });

    const page1 = await listNetworkThreads(adminDb, { uid: OWNER, limit: 1, after: null });
    expect(page1.items).toHaveLength(1);
    expect(page1.items[0]).toMatchObject({ threadId: first, activityAt: LATER, unread: true, role: 'counterpart' });
    expect(page1.next).not.toBeNull();

    const page2 = await listNetworkThreads(adminDb, {
      uid: OWNER,
      limit: 1,
      after: decodeDirectoryCursor(page1.next as string),
    });
    expect(page2.items.map((item) => item.threadId)).toStrictEqual([second.threadId]);
    expect(page2.next).toBeNull();

    // 🔴 Ο αποστολέας ΔΕΝ βλέπει δικό του μήνυμα ως αδιάβαστο· ο υπάλληλος ΔΕΝ βλέπει ξένο νήμα.
    const mine = await listNetworkThreads(adminDb, { uid: RESPONSIBLE, limit: 10, after: null });
    expect(mine.items.map((item) => item.threadId)).toStrictEqual([first]);
    expect(mine.items[0]?.unread).toBe(false);

    // 🔴 Μετά την αποχώρηση, το νήμα ΦΕΥΓΕΙ από τον κατάλογό του — η γραμμή μένει σφραγισμένη.
    await transferActTeamsOnDeparture(adminDb, {
      companyId: SAME_TENANT_COMPANY_ID,
      departingUid: RESPONSIBLE,
      fallbackUid: ADMIN,
      performedBy: ADMIN,
      nowISO: LATER,
    });
    expect((await listNetworkThreads(adminDb, { uid: RESPONSIBLE, limit: 10, after: null })).items).toHaveLength(0);
    const admin = await listNetworkThreads(adminDb, { uid: ADMIN, limit: 10, after: null });
    expect(admin.items.map((item) => item.threadId)).toStrictEqual([first, second.threadId]);
  });
});
