/**
 * @jest-environment node
 *
 * ADR-867 Β6 — ΑΓΚΥΡΕΣ του **καθαρού πυρήνα ειδοποιήσεων** (`network-notification-plan.ts`).
 *
 *   Π-1  Εισερχόμενο ⇒ ειδοποιείται το **κύριο πρόσωπο** της άλλης πλευράς — ο συνεργάτης **όχι** (Follow Up Boss)
 *   Π-2  🏆 Κύριο πρόσωπο **λείπει** ⇒ οι συνεργάτες της πλευράς του **αναπληρώνουν** (ADR-834 (ε))
 *   Π-3  Εξερχόμενο ⇒ **κανείς** από τη δική μου πλευρά (το μήνυμα του συναδέλφου δεν είναι «νέο»)
 *   Π-4  🔴 Σίγαση ⇒ **καμία** ειδοποίηση — ούτε ως αναπληρωτής
 *   Π-5  🔴 Σφραγισμένη γραμμή ⇒ **καμία** ειδοποίηση
 *   Π-6  Ο αποστολέας **ποτέ**
 *   Π-7  Συνεργάτης που **λείπει κι αυτός** δεν αναπληρώνει
 *   Π-8  🔑 Ταυτότητα = το **διάστημα αδιάβαστων** (`lastReadAt` ή `never`)
 *   Π-9  Νήμα σχέσης: κάθε πρόσωπο είναι πλευρά μόνο του
 *   Π-10 🔑 Νέος αποκλεισμός (φραγή του Β8) = **μία** γραμμή, ο πυρήνας δεν αλλάζει
 *   Π-11 Απουσία που **έληξε** ⇒ καμία αναπλήρωση
 *   Φ-1…Φ-4  «Ακολουθώ» (Β7): ο ακόλουθος ειδοποιείται άμεσα · η σίγαση νικά · κανένα διπλό · «λείπει» = μόνο το κύριο πρόσωπο
 *   Ο-1…Ο-6  Είσοδος στην ομάδα: ανάθεση · μεταβίβαση · προσθήκη · **ποτέ ο δρων** · προαγωγή μέλους · καμία αλλαγή
 */

import type { NetworkAudienceEntry } from '@/types/network-thread';

import type { NetworkAway } from '../network-away';
import {
  MESSAGE_VETOES,
  planMessageNotifications,
  teamArrivals,
  unreadEpisodeOf,
  type RecipientVeto,
} from '../network-notification-plan';

const NOW = '2026-09-18T12:00:00.000Z';
const KOSTAS = 'user_kostas'; // υπεύθυνος γραφείου
const ELENI = 'user_eleni'; // συνεργάτιδα γραφείου
const NIKOS = 'user_nikos'; // συνεργάτης γραφείου
const OWNER = 'user_owner'; // ιδιοκτήτης (αντισυμβαλλόμενος)

function row(uid: string, patch: Partial<NetworkAudienceEntry> = {}): NetworkAudienceEntry {
  const base: NetworkAudienceEntry = {
    uid,
    side: uid === OWNER ? 'counterpart' : 'host',
    role: uid === OWNER ? 'counterpart' : uid === KOSTAS ? 'responsible' : 'collaborator',
    reason: 'creator',
    addedBy: KOSTAS,
    since: '2026-09-01T00:00:00.000Z',
    until: null,
    lastReadAt: null,
    muted: false,
    following: false,
    threadActivityAt: NOW,
  };
  return { ...base, ...patch };
}

const TEAM = [row(KOSTAS), row(ELENI), row(NIKOS), row(OWNER)];

function away(uid: string, endsAt = '2026-09-24T00:00:00.000Z'): [string, NetworkAway] {
  return [uid, { id: `naway_${uid}`, uid, startsAt: '2026-09-17T00:00:00.000Z', endsAt, updatedAt: NOW }];
}

const plan = (audience: readonly NetworkAudienceEntry[], senderUid: string, aways: [string, NetworkAway][] = [], vetoes = MESSAGE_VETOES) =>
  planMessageNotifications({ audience, senderUid, aways: new Map(aways), nowISO: NOW }, vetoes);

const uidsOf = (recipients: readonly { readonly uid: string }[]) => recipients.map((r) => r.uid).sort();

describe('Π — νέο μήνυμα: ποιος ειδοποιείται', () => {
  it('Π-1 εισερχόμενο ⇒ ΜΟΝΟ ο υπεύθυνος — οι συνεργάτες όχι', () => {
    const recipients = plan(TEAM, OWNER);
    expect(recipients).toHaveLength(1);
    expect(recipients[0]).toStrictEqual({ uid: KOSTAS, side: 'host', reason: 'direct', episode: 'never', coversUid: null });
  });

  it('Π-2 🏆 ο υπεύθυνος λείπει ⇒ ειδοποιούνται ΚΑΙ οι συνεργάτες, ως αναπληρωτές του', () => {
    const recipients = plan(TEAM, OWNER, [away(KOSTAS)]);
    expect(uidsOf(recipients)).toStrictEqual([ELENI, NIKOS, KOSTAS].sort());
    expect(recipients.find((r) => r.uid === ELENI)).toMatchObject({ reason: 'covering', coversUid: KOSTAS });
    // Ο απών κρατά το καμπανάκι του — είναι τα εισερχόμενά του όταν γυρίσει (το email το κόβει η πύλη).
    expect(recipients.find((r) => r.uid === KOSTAS)).toMatchObject({ reason: 'direct', coversUid: null });
  });

  it('Π-3 εξερχόμενο ⇒ ο ιδιοκτήτης ΝΑΙ, οι συνάδελφοι του αποστολέα ΟΧΙ', () => {
    expect(uidsOf(plan(TEAM, ELENI))).toStrictEqual([OWNER]);
    expect(uidsOf(plan(TEAM, KOSTAS))).toStrictEqual([OWNER]);
  });

  it('Π-4 🔴 σίγαση ⇒ καμία ειδοποίηση, ούτε ως αναπληρωτής', () => {
    expect(plan([row(KOSTAS, { muted: true }), row(OWNER)], OWNER)).toHaveLength(0);
    const covering = plan([row(KOSTAS), row(ELENI, { muted: true }), row(OWNER)], OWNER, [away(KOSTAS)]);
    expect(uidsOf(covering)).toStrictEqual([KOSTAS]);
  });

  it('Π-5 🔴 σφραγισμένη γραμμή ⇒ καμία ειδοποίηση', () => {
    expect(plan([row(KOSTAS, { until: '2026-09-10T00:00:00.000Z' }), row(OWNER)], OWNER)).toHaveLength(0);
  });

  it('Π-6 ο αποστολέας ποτέ — ούτε όταν είναι ο μόνος της πλευράς του', () => {
    expect(plan(TEAM, OWNER).some((r) => r.uid === OWNER)).toBe(false);
    expect(plan([row(OWNER)], OWNER)).toHaveLength(0);
  });

  it('Π-7 συνεργάτης που λείπει κι αυτός δεν αναπληρώνει', () => {
    expect(uidsOf(plan(TEAM, OWNER, [away(KOSTAS), away(ELENI)]))).toStrictEqual([KOSTAS, NIKOS].sort());
  });

  it('Π-8 🔑 ταυτότητα = το διάστημα αδιάβαστων του ΠΑΡΑΛΗΠΤΗ', () => {
    const read = '2026-09-18T08:00:00.000Z';
    expect(plan([row(KOSTAS, { lastReadAt: read }), row(OWNER)], OWNER)[0]?.episode).toBe(read);
    expect(unreadEpisodeOf({ lastReadAt: null })).toBe('never');
  });

  it('Π-9 νήμα σχέσης: ο άλλος ειδοποιείται — κάθε πρόσωπο είναι πλευρά μόνο του', () => {
    const people = [
      row('user_a', { side: 'person', role: 'person' }),
      row('user_b', { side: 'person', role: 'person' }),
    ];
    expect(uidsOf(plan(people, 'user_a'))).toStrictEqual(['user_b']);
  });

  it('Π-10 🔑 νέος αποκλεισμός = μία γραμμή στη λίστα — ο πυρήνας δεν αλλάζει', () => {
    const blockedByOwner: RecipientVeto = (entry) => entry.uid === KOSTAS;
    expect(plan(TEAM, OWNER, [], [...MESSAGE_VETOES, blockedByOwner])).toHaveLength(0);
  });

  it('Π-11 απουσία που έληξε ⇒ καμία αναπλήρωση', () => {
    expect(uidsOf(plan(TEAM, OWNER, [away(KOSTAS, '2026-09-18T11:59:59.000Z')]))).toStrictEqual([KOSTAS]);
  });
});

describe('Φ — «ακολουθώ» (ADR-867 Β7 · §8 #10 · HubSpot «Follow a record»)', () => {
  const FOLLOWING_ELENI = [row(KOSTAS), row(ELENI, { following: true }), row(NIKOS), row(OWNER)];

  it('Φ-1 ο συνεργάτης που ακολουθεί ειδοποιείται ΑΜΕΣΑ — οι άλλοι συνεργάτες όχι (μετάλλαξη: αγνοείται το following)', () => {
    const recipients = plan(FOLLOWING_ELENI, OWNER);
    expect(uidsOf(recipients)).toStrictEqual([ELENI, KOSTAS].sort());
    expect(recipients.find((r) => r.uid === ELENI)).toMatchObject({ reason: 'direct', coversUid: null });
  });

  it('Φ-2 🔴 η σίγαση ΝΙΚΑ το follow (μετάλλαξη: το follow παρακάμπτει τα βέτο)', () => {
    const muted = [row(KOSTAS), row(ELENI, { following: true, muted: true }), row(OWNER)];
    expect(uidsOf(plan(muted, OWNER))).toStrictEqual([KOSTAS]);
  });

  it('Φ-3 λείπει ο υπεύθυνος ⇒ όποιος ακολουθεί μένει «άμεσος», οι υπόλοιποι αναπληρώνουν — χωρίς διπλό (μετάλλαξη: ο ακόλουθος μετράει δύο φορές)', () => {
    const recipients = plan(FOLLOWING_ELENI, OWNER, [away(KOSTAS)]);
    expect(recipients).toHaveLength(3);
    expect(recipients.find((r) => r.uid === ELENI)).toMatchObject({ reason: 'direct', coversUid: null });
    expect(recipients.find((r) => r.uid === NIKOS)).toMatchObject({ reason: 'covering', coversUid: KOSTAS });
  });

  it('Φ-4 λείπει ΜΟΝΟ ο ακόλουθος συνεργάτης ⇒ κανείς δεν γίνεται αναπληρωτής (μετάλλαξη: «λείπει» μετράει και ο ακόλουθος)', () => {
    expect(uidsOf(plan(FOLLOWING_ELENI, OWNER, [away(ELENI)]))).toStrictEqual([ELENI, KOSTAS].sort());
  });
});

describe('Ο — είσοδος στην ομάδα της πράξης', () => {
  const before = { responsibleUid: KOSTAS, memberUids: [KOSTAS, ELENI] };

  it('Ο-1 νέος υπεύθυνος από άνθρωπο ⇒ `assigned`', () => {
    const after = { responsibleUid: NIKOS, memberUids: [KOSTAS, ELENI, NIKOS] };
    expect(teamArrivals(before, after, { actorUid: 'user_admin', departure: false }))
      .toStrictEqual([{ uid: NIKOS, kind: 'assigned' }]);
  });

  it('Ο-2 🔑 νέος υπεύθυνος από αποχώρηση ⇒ `failover` (ο κληρονόμος ΜΑΘΑΙΝΕΙ)', () => {
    const after = { responsibleUid: ELENI, memberUids: [ELENI] };
    expect(teamArrivals(before, after, { actorUid: 'user_super', departure: true }))
      .toStrictEqual([{ uid: ELENI, kind: 'failover' }]);
  });

  it('Ο-3 νέος συνεργάτης ⇒ `added`', () => {
    const after = { responsibleUid: KOSTAS, memberUids: [KOSTAS, ELENI, NIKOS] };
    expect(teamArrivals(before, after, { actorUid: KOSTAS, departure: false }))
      .toStrictEqual([{ uid: NIKOS, kind: 'added' }]);
  });

  it('Ο-4 🔴 ο δρων ΠΟΤΕ — ο διαχειριστής που αναθέτει στον εαυτό του δεν ειδοποιείται', () => {
    const after = { responsibleUid: 'user_admin', memberUids: [KOSTAS, ELENI, 'user_admin'] };
    expect(teamArrivals(before, after, { actorUid: 'user_admin', departure: false })).toHaveLength(0);
  });

  it('Ο-5 μέλος που γίνεται υπεύθυνος ειδοποιείται — άλλαξε η ευθύνη του', () => {
    const after = { responsibleUid: ELENI, memberUids: [KOSTAS, ELENI] };
    expect(teamArrivals(before, after, { actorUid: KOSTAS, departure: false }))
      .toStrictEqual([{ uid: ELENI, kind: 'assigned' }]);
  });

  it('Ο-6 αφαίρεση μόνο ⇒ καμία ειδοποίηση', () => {
    const after = { responsibleUid: KOSTAS, memberUids: [KOSTAS] };
    expect(teamArrivals(before, after, { actorUid: KOSTAS, departure: false })).toHaveLength(0);
  });
});
