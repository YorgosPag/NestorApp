/**
 * @jest-environment node
 *
 * ADR-867 Β7 · §8 #9 · **Β9γ** — ΑΓΚΥΡΕΣ του `network-destination.ts`: Π (πού ανοίγει) + Σ (τι είναι).
 *
 * 🔴 **ΤΙ ΑΛΛΑΞΕ ΚΑΙ ΓΙΑΤΙ ΟΙ ΠΑΛΙΕΣ ΑΓΚΥΡΕΣ ΗΤΑΝ ΣΩΣΤΕΣ ΓΙΑ ΛΑΘΟΣ ΠΡΑΓΜΑ**: τα Π-1/Π-2 κρατούσαν
 * *«γραφείο ⇒ η εντολή · ιδιοκτήτης ⇒ η αγγελία του»*. Ήταν **πιστές** στον κώδικα και **κόκκινες σε
 * κάθε μετάλλαξη** — και παρ' όλα αυτά η οθόνη έσπαγε: η σελίδα της εντολής **δεν υπάρχει** στο
 * γραφείο για αγγελία ιδιώτη (`isPersonalCustody ⇒ not-yours`). Μια άγκυρα επαληθεύει ότι ο κώδικας
 * κάνει ό,τι λέει· **δεν** ρωτά αν αυτό που λέει **υπάρχει**. Το βρήκε ο ζωντανός browser
 * (2026-09-21, `nthr_42f6cdda…`) — δες `HANDOFFS/` και το §8 #13.
 *
 * ⇒ Τώρα οι δύο ερωτήσεις είναι **χωριστές**, και χωριστά αγκυρωμένες.
 */

import { mandateActSeed } from '@/lib/network-edge/edge-sources';
import { threadIdFromHash } from '@/lib/network-messaging/thread-anchor';
import type { NetworkThreadTopic } from '@/types/network-thread';

import { actContextDestination, threadDestination } from '../network-destination';

const OWNP = 'ownp_1';
const AGENCY = 'comp_alfa';
const OWNER = 'user_owner';
const BROKER = 'user_kostas';
const THREAD = 'nthr_abc';

const ACT: NetworkThreadTopic = {
  kind: 'act',
  actKind: 'mandate',
  actSeed: mandateActSeed(OWNP, AGENCY),
  hostCompanyId: AGENCY,
  counterpartUid: OWNER,
};

const RELATIONSHIP: NetworkThreadTopic = { kind: 'relationship', personUids: ['user_a', 'user_b'] };

const urlOf = (destination: ReturnType<typeof actContextDestination>) => destination?.actions[0]?.url ?? null;

describe('Π — πού ανοίγει η ειδοποίηση νέου μηνύματος', () => {
  it('Π-1 🔑 Η ΙΔΙΑ ΑΠΑΝΤΗΣΗ ΚΑΙ ΣΤΙΣ ΔΥΟ ΠΛΕΥΡΕΣ — η συνομιλία (μετάλλαξη: επιστροφή διακλάδωσης πλευράς)', () => {
    const host = threadDestination(THREAD, BROKER);
    const counterpart = threadDestination(THREAD, OWNER);

    expect(urlOf(host)).toBe(`/messages/${THREAD}`);
    expect(urlOf(counterpart)).toBe(`/messages/${THREAD}`);
    // 🔴 Η **διαδρομή** ταυτίζεται· ο **χώρος** είναι ο ιδιωτικός του καθενός, ποτέ κοινός.
    expect(host.workspace).toStrictEqual({ kind: 'personal', userId: BROKER });
    expect(counterpart.workspace).toStrictEqual({ kind: 'personal', userId: OWNER });
  });

  it('Π-2 🔴 ΚΑΝΕΝΑΣ ΠΡΟΟΡΙΣΜΟΣ ΔΕΝ ΔΕΙΧΝΕΙ ΣΕ ΣΕΛΙΔΑ ΧΩΡΟΥ — εκεί ζούσε το ελάττωμα του Β9γ', () => {
    // Μετάλλαξη που επαναφέρει το `/listings/mandates/...` ή το `/o/<χώρος>/...` πεθαίνει εδώ: για
    // αγγελία ιδιώτη εκείνη η σελίδα απαντά «Αυτή η εντολή δεν βρέθηκε».
    expect(urlOf(threadDestination(THREAD, BROKER))).not.toContain('/listings/');
    expect(urlOf(threadDestination(THREAD, BROKER))).not.toContain('/o/');
    expect(threadDestination(THREAD, BROKER).workspace.kind).not.toBe('org');
  });

  it('Π-3 🔑 ΤΟ ΝΗΜΑ ΣΧΕΣΗΣ ΕΧΕΙ ΠΛΕΟΝ ΠΡΟΟΡΙΣΜΟ — ο προορισμός δεν ρωτά καν το θέμα (Β8 δωρεάν)', () => {
    // Παλιά: `null` («δεν έχει οθόνη»). Η υπογραφή **δεν δέχεται** θέμα πια, που είναι η απόδειξη:
    // δεν μπορεί να διακλαδωθεί σε κάτι που δεν βλέπει.
    expect(urlOf(threadDestination(THREAD, 'user_a'))).toBe(`/messages/${THREAD}`);
  });

  it('Π-4 🔑 η άγκυρα του ΣΥΜΦΡΑΖΟΜΕΝΟΥ ξαναδίνει το ίδιο νήμα (μετάλλαξη: δύο αντίγραφα του προθέματος)', () => {
    const url = urlOf(actContextDestination(ACT, THREAD, OWNER)) ?? '';
    expect(threadIdFromHash(url.slice(url.indexOf('#')))).toBe(THREAD);
    expect(threadIdFromHash('#άλλο')).toBeNull();
    expect(threadIdFromHash('#%E0%A4%A')).toBeNull();
  });
});

describe('Σ — ποια είναι η σελίδα της πράξης (συμφραζόμενα)', () => {
  it('Σ-1 γραφείο ⇒ η ΕΝΤΟΛΗ, στον χώρο του γραφείου (μετάλλαξη: η σελίδα του ιδιοκτήτη)', () => {
    const destination = actContextDestination(ACT, THREAD, BROKER);
    expect(destination?.workspace).toStrictEqual({ kind: 'org', companyId: AGENCY });
    expect(urlOf(destination)).toBe(`/listings/mandates/${OWNP}#network-thread-${THREAD}`);
  });

  it('Σ-2 ιδιοκτήτης ⇒ η ΑΓΓΕΛΙΑ ΤΟΥ, στον ΙΔΙΩΤΙΚΟ του χώρο (μετάλλαξη: χώρος του γραφείου — ξένος για αυτόν)', () => {
    const destination = actContextDestination(ACT, THREAD, OWNER);
    expect(destination?.workspace).toStrictEqual({ kind: 'personal', userId: OWNER });
    expect(urlOf(destination)).toBe(`/offers/${OWNP}#network-thread-${THREAD}`);
  });

  it('Σ-3 νήμα σχέσης ⇒ ΚΑΜΙΑ σελίδα πράξης — δεν έχει πράξη (η κάρτα συμφραζομένων σιωπά)', () => {
    expect(actContextDestination(RELATIONSHIP, THREAD, 'user_a')).toBeNull();
  });

  it('Σ-4 χαλασμένος σπόρος ⇒ καμία σελίδα, ποτέ λάθος αγγελία', () => {
    const broken: NetworkThreadTopic = { ...ACT, actSeed: 'χωρίς-διαχωριστή' };
    expect(actContextDestination(broken, THREAD, BROKER)).toBeNull();
    expect(actContextDestination(broken, THREAD, OWNER)).toBeNull();
  });
});
