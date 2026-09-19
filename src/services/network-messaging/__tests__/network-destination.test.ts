/**
 * @jest-environment node
 *
 * ADR-867 Β7 · §8 #9 — ΑΓΚΥΡΕΣ του **προορισμού ειδοποιήσεων δικτύου** (`network-destination.ts`) — Π-1…Π-5.
 */

import { mandateActSeed } from '@/lib/network-edge/edge-sources';
import { threadIdFromHash } from '@/lib/network-messaging/thread-anchor';
import type { NetworkThreadTopic } from '@/types/network-thread';

import { actHostDestination, threadMessageDestination } from '../network-destination';

const OWNP = 'ownp_1';
const AGENCY = 'comp_alfa';
const OWNER = 'user_owner';
const THREAD = 'nthr_abc';

const ACT: NetworkThreadTopic = {
  kind: 'act',
  actKind: 'mandate',
  actSeed: mandateActSeed(OWNP, AGENCY),
  hostCompanyId: AGENCY,
  counterpartUid: OWNER,
};

const urlOf = (destination: ReturnType<typeof threadMessageDestination>) => destination?.actions[0]?.url ?? null;

describe('Π — πού ανοίγει η ειδοποίηση νέου μηνύματος', () => {
  it('Π-1 γραφείο ⇒ η ΕΝΤΟΛΗ, ανοιχτή στο νήμα, στον χώρο του γραφείου (μετάλλαξη: η σελίδα του ιδιοκτήτη)', () => {
    const destination = threadMessageDestination(ACT, THREAD, 'user_kostas');
    expect(destination?.workspace).toStrictEqual({ kind: 'org', companyId: AGENCY });
    expect(urlOf(destination)).toBe(`/listings/mandates/${OWNP}#network-thread-${THREAD}`);
  });

  it('Π-2 ιδιοκτήτης ⇒ η ΑΓΓΕΛΙΑ ΤΟΥ, στον ΙΔΙΩΤΙΚΟ του χώρο (μετάλλαξη: χώρος του γραφείου — ξένος για αυτόν)', () => {
    const destination = threadMessageDestination(ACT, THREAD, OWNER);
    expect(destination?.workspace).toStrictEqual({ kind: 'personal', userId: OWNER });
    expect(urlOf(destination)).toBe(`/offers/${OWNP}#network-thread-${THREAD}`);
  });

  it('Π-3 νήμα σχέσης ⇒ ΚΑΝΕΝΑΣ προορισμός — δεν έχει οθόνη ακόμη (ADR-848: ποτέ «Άνοιγμα» προς το πουθενά)', () => {
    const relationship: NetworkThreadTopic = { kind: 'relationship', personUids: ['user_a', 'user_b'] };
    expect(threadMessageDestination(relationship, THREAD, 'user_a')).toBeNull();
  });

  it('Π-4 χαλασμένος σπόρος ⇒ κανένας προορισμός, ποτέ λάθος αγγελία', () => {
    expect(actHostDestination({ actKind: 'mandate', actSeed: 'χωρίς-διαχωριστή', hostCompanyId: AGENCY }, THREAD)).toBeNull();
  });

  it('Π-5 🔑 η άγκυρα του συνδέσμου ΞΑΝΑΔΙΝΕΙ το ίδιο νήμα στη σελίδα (μετάλλαξη: δύο αντίγραφα του προθέματος)', () => {
    const url = urlOf(threadMessageDestination(ACT, THREAD, OWNER)) ?? '';
    expect(threadIdFromHash(url.slice(url.indexOf('#')))).toBe(THREAD);
    expect(threadIdFromHash('#άλλο')).toBeNull();
    expect(threadIdFromHash('#%E0%A4%A')).toBeNull();
  });
});
