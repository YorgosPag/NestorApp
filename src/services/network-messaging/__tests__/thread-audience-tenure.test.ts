/**
 * @fileoverview Άγκυρες του ιστορικού θητειών (ADR-867 Β9(β) εύρημα Ε8) — Θ-1…Θ-5.
 *
 * 🔴 **Το περιστατικό (2026-09-21, ζωντανά)**: αφαίρεση του Νέστωρ (v2→v3) ⇒ «▸ Διάβαζαν παλαιότερα»· ξανά
 * προσθήκη ⇒ η **ίδια** γραμμή ξανανοίγει με νέο `since`, και η παλιά θητεία **χάνεται** από την οθόνη.
 * Ο άλλος δικαιούται να ξέρει ότι κάποιος **είχε** δει ό,τι γράφτηκε ως τότε.
 */

import { tenureHistoryOf } from '@/lib/network-messaging/network-thread-from-document';
import { projectActAudience } from '@/services/network-messaging/thread-audience';
import {
  NETWORK_AUDIENCE_TENURE_CAP,
  NO_EARLIER_TENURES,
  type NetworkAudienceEntry,
  type NetworkAudienceTenure,
} from '@/types/network-thread';

const OWNER = 'uid_owner';
const LEAD = 'uid_lead';
const NESTOR = 'uid_nestor';
const T0 = '2026-09-01T00:00:00.000Z';
const T1 = '2026-09-10T00:00:00.000Z';
const NOW = '2026-09-22T00:00:00.000Z';

function project(memberUids: string[], existing: readonly NetworkAudienceEntry[]) {
  return projectActAudience({
    team: { responsibleUid: LEAD, memberUids },
    counterpartUid: OWNER,
    existing,
    newcomerReason: 'added',
    addedBy: LEAD,
    nowISO: NOW,
    threadActivityAt: NOW,
  });
}

/** Η σφραγισμένη γραμμή του Νέστωρ — όπως τη γράφει η ίδια η προβολή (γέννηση → έξοδος), όχι χειρόγραφη. */
function sealedNestor(): NetworkAudienceEntry {
  const born = project([LEAD, NESTOR], []).map((write) => ({ ...write.entry, since: T0 }));
  const sealed = project([LEAD], born).find((write) => write.uid === NESTOR);
  if (sealed === undefined) throw new Error('η έξοδος δεν σφράγισε');
  return { ...sealed.entry, until: T1 };
}

function tenure(i: number): NetworkAudienceTenure {
  const day = String(i + 1).padStart(2, '0');
  return { role: 'collaborator', reason: 'added', since: `2026-08-${day}T00:00:00.000Z`, until: `2026-08-${day}T12:00:00.000Z` };
}

describe('thread-audience — η επιστροφή κρατά την παλιά θητεία', () => {
  it('🔴 Θ-1 επανένταξη ⇒ νέα θητεία ΤΩΡΑ, η παλιά στο ιστορικό με τον ρόλο της (μετάλλαξη: `tenureHistory` δεν ενημερώνεται)', () => {
    const back = project([LEAD, NESTOR], [sealedNestor()]).find((write) => write.uid === NESTOR);

    expect(back?.change).toBe('rejoined');
    expect(back?.entry).toMatchObject({ since: NOW, until: null });
    expect(back?.entry.tenureHistory).toStrictEqual({
      earlier: [{ role: 'collaborator', reason: 'added', since: T0, until: T1 }],
      omitted: 0,
    });
  });

  it('Θ-2 γραμμή ΠΡΙΝ το Ε8 (χωρίς πεδίο) ⇒ το ιστορικό ξεκινά από αυτήν, δεν σκάει (μετάλλαξη: ανάγνωση χωρίς `tenureHistoryOf`)', () => {
    const legacy: Record<string, unknown> = { ...sealedNestor() };
    delete legacy.tenureHistory;
    const back = project([LEAD, NESTOR], [legacy as unknown as NetworkAudienceEntry]).find((write) => write.uid === NESTOR);

    expect(back?.entry.tenureHistory.earlier).toHaveLength(1);
  });

  it('🔑 Θ-3 στο όριο: η παλαιότερη βγαίνει ΚΑΙ ΜΕΤΡΙΕΤΑΙ — ποτέ σιωπηλή απώλεια (μετάλλαξη: `omitted` δεν αυξάνει)', () => {
    const full = Array.from({ length: NETWORK_AUDIENCE_TENURE_CAP }, (_, i) => tenure(i));
    const row = { ...sealedNestor(), tenureHistory: { earlier: full, omitted: 4 } };
    const history = project([LEAD, NESTOR], [row]).find((write) => write.uid === NESTOR)?.entry.tenureHistory;

    expect(history?.earlier).toHaveLength(NETWORK_AUDIENCE_TENURE_CAP);
    expect(history?.omitted).toBe(5);
    expect(history?.earlier[0]).toStrictEqual(tenure(1));
    expect(history?.earlier.at(-1)).toMatchObject({ since: T0, until: T1 });
  });

  it('Θ-4 γέννηση ⇒ καμία προηγούμενη θητεία (μετάλλαξη: η γέννηση ξεχνά το πεδίο)', () => {
    const born = project([LEAD, NESTOR], []);
    for (const write of born) expect(write.entry.tenureHistory).toBe(NO_EARLIER_TENURES);
  });
});

describe('tenureHistoryOf — ο ένας αναγνώστης', () => {
  it('Θ-5 χαλασμένη θητεία ΔΕΝ χάνεται σιωπηλά: μετριέται (μετάλλαξη: απορρίπτεται χωρίς μέτρηση)', () => {
    const history = tenureHistoryOf({ earlier: [tenure(0), { role: 'πειρατής', since: T0 }, 42], omitted: 1 });

    expect(history.earlier).toStrictEqual([tenure(0)]);
    expect(history.omitted).toBe(3);
    expect(tenureHistoryOf(undefined)).toBe(NO_EARLIER_TENURES);
  });
});
