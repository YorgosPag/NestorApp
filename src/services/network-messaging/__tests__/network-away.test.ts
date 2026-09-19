/**
 * @jest-environment node
 *
 * ADR-867 §4.4 · Β5 — ΑΓΚΥΡΕΣ της **απουσίας** (καθαρά κομμάτια).
 *
 *   Α-1  Η δήλωση στέκει μόνο αν **λήγει μετά την έναρξη** και **μετά το τώρα**
 *   Α-2  🔴 Πάνω από έναν χρόνο **δεν** είναι απουσία — είναι αποχώρηση (άλλη πράξη)
 *   Α-3  Διάστημα `[έναρξη, λήξη)` — η λήξη **δεν** λογίζεται απουσία
 *   Α-4  🏆 Η άλλη πλευρά μαθαίνει **ποιος λείπει ως πότε** ΚΑΙ **ποιος διαβάζει στη θέση του**
 *   Α-5  🔴 Ο καλών δεν ενημερώνεται για τον εαυτό του· σφραγισμένα μέλη **δεν** μετρούν
 *   Α-6  Όλοι λείπουν ⇒ «κανείς» — η οθόνη λέει την αλήθεια, δεν την ωραιοποιεί
 */

import {
  MAX_AWAY_DAYS,
  isAwayActive,
  judgeAway,
  presenceOf,
  type NetworkAway,
} from '@/services/network-messaging/network-away';
import type { NetworkAudienceEntry } from '@/types/network-thread';

const NOW = '2026-09-18T10:00:00.000Z';
const TOMORROW = '2026-09-19T10:00:00.000Z';
const YESTERDAY = '2026-09-17T10:00:00.000Z';

const row = (uid: string, over: Partial<NetworkAudienceEntry> = {}): NetworkAudienceEntry => ({
  uid,
  side: 'host',
  role: 'collaborator',
  reason: 'added',
  addedBy: 'user_admin',
  since: YESTERDAY,
  until: null,
  lastReadAt: null,
  muted: false,
  following: false,
  threadActivityAt: YESTERDAY,
  alsoHostRole: null,
  ...over,
});
const away = (uid: string, startsAt = YESTERDAY, endsAt = TOMORROW): NetworkAway => ({
  id: `naway_${uid}`,
  uid,
  startsAt,
  endsAt,
  updatedAt: YESTERDAY,
});

const KOSTAS = row('user_kostas', { role: 'responsible' });
const ELENI = row('user_eleni');
const OWNER = row('user_owner', { side: 'counterpart', role: 'counterpart' });

describe('Α — η δήλωση', () => {
  it('Α-1 στέκει μόνο αν λήγει μετά την έναρξη ΚΑΙ μετά το τώρα', () => {
    expect(judgeAway({ startsAt: NOW, endsAt: TOMORROW, nowISO: NOW })).toBeNull();
    expect(judgeAway({ startsAt: TOMORROW, endsAt: NOW, nowISO: NOW })).toBe('ends-before-start');
    expect(judgeAway({ startsAt: YESTERDAY, endsAt: NOW, nowISO: NOW })).toBe('already-ended');
    expect(judgeAway({ startsAt: 'χθες', endsAt: TOMORROW, nowISO: NOW })).toBe('invalid-dates');
  });

  it('Α-2 🔴 πάνω από έναν χρόνο ⇒ δεν είναι απουσία', () => {
    const limit = new Date(Date.parse(NOW) + MAX_AWAY_DAYS * 86_400_000).toISOString();
    const beyond = new Date(Date.parse(limit) + 60_000).toISOString();

    expect(judgeAway({ startsAt: NOW, endsAt: limit, nowISO: NOW })).toBeNull();
    expect(judgeAway({ startsAt: NOW, endsAt: beyond, nowISO: NOW })).toBe('too-long');
  });

  it('Α-3 διάστημα [έναρξη, λήξη): η στιγμή της λήξης ΔΕΝ είναι απουσία', () => {
    const record = away('u', NOW, TOMORROW);

    expect(isAwayActive(record, NOW)).toBe(true);
    expect(isAwayActive(record, TOMORROW)).toBe(false);
    expect(isAwayActive(record, YESTERDAY)).toBe(false);
    expect(isAwayActive(null, NOW)).toBe(false);
  });
});

describe('Α — η παρουσία του νήματος', () => {
  it('Α-4 🏆 ο ιδιοκτήτης βλέπει: ο υπεύθυνος λείπει ως αύριο — διαβάζει η Ελένη', () => {
    const presence = presenceOf([KOSTAS, ELENI, OWNER], new Map([[KOSTAS.uid, away(KOSTAS.uid)]]), OWNER.uid, NOW);

    expect(presence).toStrictEqual({
      away: [{ uid: KOSTAS.uid, role: 'responsible', until: TOMORROW }],
      covering: [ELENI.uid],
    });
  });

  it('Α-5 🔴 ο καλών δεν ενημερώνεται για τον εαυτό του· σφραγισμένο μέλος δεν «καλύπτει»', () => {
    const sealed = row('user_nikos', { until: YESTERDAY });
    const aways = new Map([[KOSTAS.uid, away(KOSTAS.uid)], [OWNER.uid, away(OWNER.uid)]]);

    const seenByKostas = presenceOf([KOSTAS, ELENI, OWNER, sealed], aways, KOSTAS.uid, NOW);

    expect(seenByKostas.away).toHaveLength(1);
    expect(seenByKostas.away).toStrictEqual([{ uid: OWNER.uid, role: 'counterpart', until: TOMORROW }]);
    expect(seenByKostas.covering).toStrictEqual([]);
  });

  it('Α-6 όλοι λείπουν ⇒ κανείς δεν καλύπτει', () => {
    const aways = new Map([[KOSTAS.uid, away(KOSTAS.uid)], [ELENI.uid, away(ELENI.uid)]]);

    const presence = presenceOf([KOSTAS, ELENI, OWNER], aways, OWNER.uid, NOW);

    expect(presence.away.map((a) => a.uid)).toStrictEqual([KOSTAS.uid, ELENI.uid]);
    expect(presence.covering).toStrictEqual([]);
  });
});
