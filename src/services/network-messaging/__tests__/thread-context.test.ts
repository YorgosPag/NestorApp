/**
 * @jest-environment node
 *
 * ADR-867 **Β9γ** — ΑΓΚΥΡΕΣ των **συμφραζομένων** μιας συνομιλίας (`thread-context.ts`) — Σ-1…Σ-6.
 *
 * 🔴 **ΤΙ ΦΥΛΑΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ, ΚΑΙ ΓΙΑΤΙ ΤΟ ΒΡΗΚΕ ΜΟΝΟ Ο ΖΩΝΤΑΝΟΣ BROWSER**: η συνομιλία απέκτησε
 * δική της διεύθυνση επειδή η σελίδα της πράξης **δεν υπάρχει** για κάθε πλευρά. Η κάρτα
 * συμφραζομένων είναι η **μία** θέση όπου ξαναγεννιέται ο κίνδυνος: αν δώσει σύνδεσμο σε όποιον δεν
 * τον ανοίγει, ξαναφτιάξαμε το ελάττωμα **ένα επίπεδο πιο μέσα** — «Άνοιγμα» που απαντά «δεν
 * βρέθηκε» (ADR-848).
 *
 * ⚠️ Οι άγκυρες **εκτελούν** την πραγματική συνάρτηση πάνω σε FakeFirestore, ποτέ έλεγχο
 * συμβολοσειράς στην πηγή: το ελάττωμα ζει στον **αρμό** «επιμέλεια → σύνδεσμος».
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { mandateActSeed } from '@/lib/network-edge/edge-sources';
import { actNetworkRefs } from '@/lib/network-messaging/act-network-refs';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import type { NetworkAudienceEntry, NetworkThread } from '@/types/network-thread';

import { readThreadContext } from '../thread-context';

const OWNP = 'ownp_11111111-1111-4111-8111-111111111111';
const AGENCY = 'comp_22222222-2222-4222-8222-222222222222';
const OWNER = 'u_owner';
const BROKER = 'u_broker';
const STRANGER = 'u_stranger';

const ACT_SEED = mandateActSeed(OWNP, AGENCY);
const THREAD_ID = actNetworkRefs(ACT_SEED).threadId;
const TEAM_ID = actNetworkRefs(ACT_SEED).teamId;
const NOW = '2026-09-21T10:00:00.000Z';

const THREAD: NetworkThread = {
  id: THREAD_ID,
  topic: { kind: 'act', actKind: 'mandate', actSeed: ACT_SEED, hostCompanyId: AGENCY, counterpartUid: OWNER },
  state: 'open',
  createdAt: NOW,
  lastMessageAt: null,
};

function seat(uid: string, side: NetworkAudienceEntry['side']): NetworkAudienceEntry {
  return {
    uid,
    side,
    role: side === 'host' ? 'responsible' : 'counterpart',
    reason: side === 'host' ? 'responsible' : 'counterpart',
    addedBy: uid,
    since: NOW,
    until: null,
    lastReadAt: null,
    muted: false,
    following: false,
    alsoHostRole: null,
    threadActivityAt: NOW,
  } as NetworkAudienceEntry;
}

/** Ο κόσμος: νήμα + δύο θέσεις + η αγγελία, με την **επιμέλεια** που ορίζει το σενάριο. */
function world(custody: 'personal' | 'agency'): AdminFirestore {
  const fake = new FakeFirestore();
  fake.seed(COLLECTIONS.NETWORK_THREADS, THREAD_ID, THREAD as unknown as Record<string, unknown>);
  for (const [uid, side] of [[OWNER, 'counterpart'], [BROKER, 'host']] as const) {
    fake.seed(`${COLLECTIONS.NETWORK_THREADS}/${THREAD_ID}/network_audience`, uid, {
      ...seat(uid, side),
    } as unknown as Record<string, unknown>);
  }
  fake.seed(COLLECTIONS.OWNER_PROPERTIES, OWNP, {
    id: OWNP,
    title: 'Δοκιμή από Ανώνυμη περιήγηση',
    ownerUserId: OWNER,
    // 🔑 **Η ΜΟΝΗ ΔΙΑΦΟΡΑ ΤΩΝ ΔΥΟ ΣΕΝΑΡΙΩΝ**: ποιος επιμελείται την αγγελία.
    authorCompanyId: custody === 'agency' ? AGENCY : null,
  });
  return fake as unknown as AdminFirestore;
}

describe('Σ — τα συμφραζόμενα της συνομιλίας', () => {
  it('Σ-1 ο ΙΔΙΟΚΤΗΤΗΣ παίρνει σύνδεσμο προς την αγγελία του (μετάλλαξη: σιωπή για όλους)', async () => {
    const context = await readThreadContext(world('personal'), THREAD_ID, OWNER);
    expect(context?.side).toBe('counterpart');
    expect(context?.subjectTitle).toBe('Δοκιμή από Ανώνυμη περιήγηση');
    expect(context?.subjectHref).toBe(`/offers/${OWNP}#network-thread-${THREAD_ID}`);
  });

  it('Σ-2 🔴 ΤΟ ΓΡΑΦΕΙΟ ΣΕ ΑΓΓΕΛΙΑ ΙΔΙΩΤΗ: ΟΝΟΜΑ ΝΑΙ, ΣΥΝΔΕΣΜΟΣ ΟΧΙ — εδώ ζούσε το σπασμένο κλικ', async () => {
    const context = await readThreadContext(world('personal'), THREAD_ID, BROKER);
    expect(context?.side).toBe('host');
    // Ο τίτλος **επιτρέπεται**: το γραφείο τον βλέπει ήδη στα εισερχόμενα αιτήματά του.
    expect(context?.subjectTitle).toBe('Δοκιμή από Ανώνυμη περιήγηση');
    // 🔴 Μετάλλαξη «δώσε πάντα τη σελίδα της πράξης» ⇒ αυτή η γραμμή κοκκινίζει. Εκείνη η σελίδα
    //    απαντά `MANDATE_NOT_YOURS` για προσωπική επιμέλεια (μετρημένο ζωντανά, 2026-09-21).
    expect(context?.subjectHref).toBeNull();
  });

  it('Σ-3 🔑 ΚΑΙ ΤΟ ΑΝΤΙΣΤΡΟΦΟ: αγγελία του ΙΔΙΟΥ του γραφείου ⇒ ο σύνδεσμος ΥΠΑΡΧΕΙ', async () => {
    // Χωρίς αυτό, μια μετάλλαξη «ποτέ σύνδεσμο στο γραφείο» θα επιζούσε — και η κάρτα θα ήταν
    // μονίμως μουγκή εκεί όπου η σελίδα **ανοίγει** κανονικά.
    const context = await readThreadContext(world('agency'), THREAD_ID, BROKER);
    expect(context?.subjectHref).toBe(`/listings/mandates/${OWNP}#network-thread-${THREAD_ID}`);
  });

  it('Σ-4 η ΟΜΑΔΑ ταξιδεύει μόνο στην πλευρά του γραφείου — ο ιδιοκτήτης δεν διαχειρίζεται ομάδα', async () => {
    const db = world('agency');
    expect((await readThreadContext(db, THREAD_ID, BROKER))?.teamId).toBe(TEAM_ID);
    expect((await readThreadContext(db, THREAD_ID, OWNER))?.teamId).toBeNull();
  });

  it('Σ-5 🔒 ΞΕΝΟΣ ⇒ `null` — ίδια απάντηση με ανύπαρκτο νήμα (ADR-742)', async () => {
    const db = world('agency');
    expect(await readThreadContext(db, THREAD_ID, STRANGER)).toBeNull();
    expect(await readThreadContext(db, 'nthr_δεν-υπάρχει', BROKER)).toBeNull();
  });

  it('Σ-6 η ΠΛΕΥΡΑ διαβάζεται από τη ΓΡΑΜΜΗ ΑΚΡΟΑΤΗΡΙΟΥ, όχι από σύγκριση με τον αντισυμβαλλόμενο', async () => {
    // Δεύτερος υπάλληλος: **δεν** είναι ο `counterpartUid`, αλλά ούτε και «ό,τι δεν είναι ιδιοκτήτης»
    // αρκεί — η αλήθεια είναι γραμμένη στη θέση του. Μετάλλαξη σε `uid === counterpartUid` επιζεί
    // στα Σ-1/Σ-2 και πεθαίνει **εδώ**, γιατί αυτή η θέση δηλώνει `person`.
    const fake = new FakeFirestore();
    fake.seed(COLLECTIONS.NETWORK_THREADS, THREAD_ID, THREAD as unknown as Record<string, unknown>);
    fake.seed(`${COLLECTIONS.NETWORK_THREADS}/${THREAD_ID}/network_audience`, STRANGER, {
      ...seat(STRANGER, 'person'),
    } as unknown as Record<string, unknown>);

    const context = await readThreadContext(fake as unknown as AdminFirestore, THREAD_ID, STRANGER);
    expect(context?.side).toBe('person');
    expect(context?.teamId).toBeNull();
  });
});
