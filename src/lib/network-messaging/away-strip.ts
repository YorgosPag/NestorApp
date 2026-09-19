/**
 * @fileoverview **Η ΛΩΡΙΔΑ ΑΠΟΥΣΙΑΣ** — «ο Κώστας απουσιάζει ως 24/9 — διαβάζει η Ελένη», καθαρός πυρήνας.
 * @related ADR-834 §5 Β (ε) 🏆 · ADR-867 §4.4 · `services/network-messaging/network-away.ts` (`presenceOf`)
 * @module lib/network-messaging/away-strip
 *
 * 🏆 Ο αποστολέας το μαθαίνει **ΠΡΙΝ** πατήσει «στείλε» (Intercom: μόνο ανάθεση · HubSpot: τίποτα ·
 * Outlook: αυτόματη απάντηση **μετά**). Ο διακομιστής δίνει **ποιος λείπει** και **ποιοι καλύπτουν**·
 * εδώ ομαδοποιούνται **ανά πλευρά**, γιατί η Ελένη καλύπτει τον Κώστα **της ίδιας** πλευράς — όχι τον
 * ιδιοκτήτη που έτυχε να λείπει κι αυτός.
 *
 * 🔑 **Κανείς δεν καλύπτει ⇒ το λέμε** (`covering: []`): «απουσιάζει ως 24/9 — κανείς δεν διαβάζει ως
 * τότε». Η οθόνη **δεν** ωραιοποιεί· ο αποστολέας αποφασίζει αν θα γράψει τώρα.
 * ⛔ **Κανένα ελεύθερο κείμενο απουσίας** — δεν υπάρχει (ΓΚΠΔ, §4.4)· μόνο ημερομηνία.
 */

import type { NetworkAudienceEntry } from '@/types/network-thread';
import type { NetworkPresenceResult } from '@/types/network-wire';

import type { RosterSideRelation } from './audience-roster';

/** Η απάντηση `GET …/presence` (το **καλώδιο**), χωρίς τον φάκελο `success`. */
export type ThreadPresenceView = Pick<NetworkPresenceResult, 'away' | 'covering'>;

export interface AwayNotice {
  readonly relation: RosterSideRelation;
  readonly absent: readonly { readonly uid: string; readonly until: string }[];
  /** Κενό ⇒ **κανείς** δεν διαβάζει στη θέση τους ως τότε. Μπορεί να περιέχει τον **θεατή** («εσείς»). */
  readonly covering: readonly string[];
}

/**
 * **Παρουσία + ακροατήριο ⇒ μία ειδοποίηση ανά πλευρά που έχει απόντα.** Πρώτα η **άλλη** πλευρά
 * (σε αυτήν γράφω). Άγνωστο `uid` (έφυγε από το ακροατήριο στο μεταξύ) ⇒ αγνοείται: ποτέ λωρίδα για
 * άνθρωπο που δεν διαβάζει πια.
 */
export function awayNotices(
  presence: ThreadPresenceView,
  audience: readonly NetworkAudienceEntry[],
  viewerUid: string,
): readonly AwayNotice[] {
  const sideByUid = new Map(audience.filter((e) => e.until === null).map((e) => [e.uid, e.side] as const));
  const viewerSide = audience.find((e) => e.uid === viewerUid)?.side ?? null;
  const relationOf = (uid: string): RosterSideRelation | null => {
    const side = sideByUid.get(uid);
    if (side === undefined) return null;
    return side === viewerSide && side !== 'person' ? 'mine' : 'theirs';
  };

  // 🔴 Στο νήμα ΣΧΕΣΗΣ κάθε πρόσωπο είναι πλευρά μόνο του ⇒ **κανείς** δεν αναπληρώνει κανέναν
  //    (ο θεατής θα φαινόταν «αναπληρωτής» του άλλου). Ο θεατής ΜΕΝΕΙ στους αναπληρωτές της δικής του
  //    πλευράς: αν τον έβγαζα, η λωρίδα θα έλεγε ψευδώς «κανείς δεν διαβάζει» ενώ διαβάζει ο ίδιος.
  const canCover = (uid: string) => sideByUid.get(uid) !== 'person';

  const notices: AwayNotice[] = [];
  for (const relation of ['theirs', 'mine'] as const) {
    const absent = presence.away
      .filter((member) => relationOf(member.uid) === relation)
      .map((member) => ({ uid: member.uid, until: member.until }));
    if (absent.length === 0) continue;
    const covering = presence.covering.filter((uid) => relationOf(uid) === relation && canCover(uid));
    notices.push({ relation, absent, covering });
  }
  return notices;
}
