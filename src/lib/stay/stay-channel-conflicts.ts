/**
 * @fileoverview **ΤΟ OVERBOOKING ΠΟΥ ΗΔΗ ΣΥΝΕΒΗ** — οι συγκρούσεις των εισαγόμενων
 *   blocks, **ονομασμένες** κατά είδος και υπόχρεο.
 * @related ADR-835 §22 (Στάδιο Γ) · §6.4 · lib/stay/stay-conflict.ts ·
 *   components/stay-calendar/StayChannelConflicts.tsx
 * @module lib/stay/stay-channel-conflicts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΔΕΝ ΑΠΟΡΡΙΠΤΕΤΑΙ Η ΕΙΣΑΓΩΓΗ ΠΟΥ ΣΥΓΚΡΟΥΕΤΑΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Μια κράτηση σε άλλο κανάλι πάνω σε δική μας κράτηση **δεν είναι αίτημα** που
 * κρίνουμε: είναι **γεγονός που έγινε**. Η άρνηση της εγγραφής θα έκρυβε το γεγονός και
 * θα άφηνε δύο οικογένειες στην ίδια πόρτα — γι' αυτό το block **γράφεται πάντα**, και
 * η σύγκρουση **ονομάζεται**.
 *
 * 🏆 **Παράγωγη, ΠΟΤΕ αποθηκευμένη**: η σύγκρουση παύει να υπάρχει τη στιγμή που ο
 * οικοδεσπότης ακυρώνει τη μία κράτηση. Αποθηκευμένη, θα ζούσε ως ψεύτικος κόκκινος
 * συναγερμός — και ο συναγερμός που λέει ψέματα διδάσκει να τον αγνοούν.
 *
 * 🔑 **Τρία είδη, τρεις θεραπείες** (ίδιο ιδίωμα με τους εννέα κάδους του §18.3):
 * ο ίδιος κριτής, αλλά *«το κανάλι πούλησε νύχτες που πούλησες κι εσύ»* ≠ *«το κανάλι
 * πούλησε νύχτες που είχες κλείσει»* ≠ *«δύο κανάλια δηλώνουν τις ίδιες νύχτες»*.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O, μηδέν ρολόι.
 */

import { stayCalendarConflicts } from './stay-conflict';
import type { StayCalendarEntry } from '@/types/stay-calendar';

/**
 * | Είδος | Τι συνέβη | Ποιος πράττει |
 * |---|---|---|
 * | `overbooking` | εισαγόμενη κατάληψη πάνω σε **κράτησή μας** | ο οικοδεσπότης, **επειγόντως** |
 * | `owner-block` | το κανάλι έδωσε νύχτες που ο ιδιοκτήτης είχε **κλείσει** | ο οικοδεσπότης, στο κανάλι |
 * | `other-channel` | **δύο κανάλια** δηλώνουν τις ίδιες νύχτες | έλεγχος: διπλή κράτηση ή διπλή δήλωση |
 */
export const STAY_CHANNEL_CONFLICT_KINDS = ['overbooking', 'owner-block', 'other-channel'] as const;

export type StayChannelConflictKind = (typeof STAY_CHANNEL_CONFLICT_KINDS)[number];

/** Με τι συγκρούστηκε — **ποτέ** όνομα, σημείωση ή άτομα (ίδιος κανόνας με τη προβολή). */
export interface StayChannelConflictParty {
  readonly entryKind: 'booking' | 'block';
  readonly entryId: string;
  readonly from: string;
  readonly to: string;
}

export interface StayChannelConflict {
  readonly kind: StayChannelConflictKind;
  readonly feedId: string;
  readonly blockId: string;
  readonly from: string;
  readonly to: string;
  readonly party: StayChannelConflictParty;
}

function partyOf(entry: StayCalendarEntry): StayChannelConflictParty {
  return entry.kind === 'booking'
    ? { entryKind: 'booking', entryId: entry.booking.id, from: entry.booking.checkIn, to: entry.booking.checkOut }
    : { entryKind: 'block', entryId: entry.block.id, from: entry.block.from, to: entry.block.to };
}

function kindOf(other: StayCalendarEntry): StayChannelConflictKind {
  if (other.kind === 'booking') return 'overbooking';
  return other.block.source === 'external' ? 'other-channel' : 'owner-block';
}

/** Οι εγγραφές που κρίνονται **απέναντι** σε ένα εξωτερικό block: όλες, εκτός του **ίδιου** feed. */
function othersFor(entries: readonly StayCalendarEntry[], feedId: string): readonly StayCalendarEntry[] {
  return entries.filter((entry) => entry.kind !== 'block' || entry.block.channel?.feedId !== feedId);
}

/**
 * **Οι συγκρούσεις των εισαγόμενων νυχτών.** Μόνο για `to > today`: μια σύγκρουση που
 * τελείωσε δεν έχει **καμία** διέξοδο, και ένας συναγερμός χωρίς διέξοδο είναι θόρυβος.
 *
 * ⚠️ Οι συγκρούσεις **μέσα στο ίδιο feed** αγνοούνται επίτηδες: το κανάλι στέλνει
 * μετρημένα γειτονικά/επικαλυπτόμενα γεγονότα (κράτηση + «not available» μαζί), και
 * είναι **η δική του** εσωτερική συνέπεια — δεν έχει τι να κάνει ο οικοδεσπότης.
 */
export function stayChannelConflicts(
  entries: readonly StayCalendarEntry[],
  today: string,
): readonly StayChannelConflict[] {
  const out: StayChannelConflict[] = [];
  for (const entry of entries) {
    if (entry.kind !== 'block' || entry.block.channel === null) continue;
    const { block } = entry;
    if (block.to <= today) continue;
    const verdict = stayCalendarConflicts(entry, othersFor(entries, block.channel.feedId));
    // `undetermined` ⇒ όχι σύγκρουση εδώ: το ημερολόγιο είναι ήδη `unreadable` και η
    // οθόνη το λέει· ένας δεύτερος συναγερμός για το ίδιο πράγμα είναι θόρυβος.
    if (verdict.kind !== 'conflicts') continue;
    const seen = new Set<string>();
    for (const conflict of verdict.conflicts) {
      const other = conflict.with.source;
      const party = partyOf(other);
      if (seen.has(party.entryId)) continue;
      seen.add(party.entryId);
      out.push({
        kind: kindOf(other),
        feedId: block.channel.feedId,
        blockId: block.id,
        from: block.from,
        to: block.to,
        party,
      });
    }
  }
  return out;
}
