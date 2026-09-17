/**
 * @fileoverview **ΤΟ FEED ΩΣ ΔΙΑΦΟΡΑ** — ποια εξωτερικά blocks γεννιούνται, ποια
 *   αλλάζουν, ποια σβήνονται. Καθαρή συνάρτηση: **καμία** γραφή εδώ.
 * @related ADR-835 §22 (Στάδιο Γ) · lib/ical/ical-read.ts · types/stay-channels.ts ·
 *   services/stay-calendar/stay-channel-import.service.ts
 * @module lib/stay/stay-channel-reconcile
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΡΕΙΣ ΑΠΟΦΑΣΕΙΣ, ΚΑΙ ΚΑΘΕ ΜΙΑ ΕΙΝΑΙ ΑΜΥΝΑ ΣΕ ΜΕΤΡΗΜΕΝΗ ΣΥΜΠΕΡΙΦΟΡΑ ΚΑΝΑΛΙΟΥ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * **1. Ταυτότητα ανά `UID`** (ντετερμινιστικό id) ⇒ η ίδια ανάγνωση δύο φορές γράφει
 * **το ίδιο** έγγραφο: ιδιοδύναμο χωρίς ερώτημα.
 *
 * **2. 🏆 Επανα-ταύτιση κυλιόμενου `UID`.** Η **Booking.com δίνει νέο opaque `UID` κάθε
 * μέρα** για την ίδια κράτηση και μετακινεί το `DTSTART` όσο περνούν οι νύχτες
 * (μετρημένο). Με σκέτο UID-keying, **κάθε πρωί** κάθε κράτηση της Booking θα σβηνόταν
 * και θα ξαναγραφόταν: θόρυβος στο ίχνος, ψεύτικες «νέες συγκρούσεις», και μια στιγμή
 * μέσα στη συναλλαγή όπου η νύχτα **δεν** είναι πιασμένη. Θεραπεία: `UID` που χάθηκε +
 * νέο `UID` με **ίδια ημέρα αναχώρησης** και επικαλυπτόμενο διάστημα = **το ίδιο
 * γεγονός** (η αναχώρηση είναι το μόνο σταθερό σημείο, όπως το βρήκε και η αγορά).
 *
 * **3. 🏆 Διαγραφή με ΔΥΟ αναγνώσεις.** Το «άνοιγμα» νύχτας είναι η **μόνη** μη
 * αναστρέψιμη κατεύθυνση (ανοιχτή νύχτα ⇒ κράτηση ⇒ overbooking). Μελλοντικό block που
 * λείπει καταγράφεται ως `pendingRemoval` και σβήνεται στην **επόμενη** επιτυχή
 * ανάγνωση που εξακολουθεί να το μη-βλέπει. Παρελθοντικό ⇒ αμέσως (καμία ζημιά).
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O, μηδέν ρολόι (ο καλών δίνει
 * `now`/`today` και τη γεννήτρια ταυτοτήτων).
 */

import type { IcalEvent } from '@/lib/ical/ical-read';
import type { StayBlock } from '@/types/stay-calendar';
import { STAY_ICAL_UID_DOMAIN } from './stay-channel-export';

/** Μία πράξη πάνω σε **ένα** εξωτερικό block. Ο καλών τις μεταφράζει σε γραφές. */
export type StayChannelBlockPlan =
  | { readonly kind: 'create'; readonly id: string; readonly uid: string; readonly from: string; readonly to: string }
  | { readonly kind: 'update'; readonly id: string; readonly uid: string; readonly from: string; readonly to: string }
  | { readonly kind: 'delete'; readonly id: string };

export interface StayChannelReconciliation {
  readonly plan: readonly StayChannelBlockPlan[];
  /** Η **νέα** εικόνα των εκκρεμών διαγραφών (αντικαθιστά την παλιά, ποτέ συγχώνευση). */
  readonly pendingRemovals: Readonly<Record<string, string>>;
  /** Πόσα γεγονότα **μέτρησε** αυτή η ανάγνωση (μετά την ασπίδα echo). */
  readonly eventCount: number;
}

export interface StayChannelReconcileInput {
  readonly feedId: string;
  readonly events: readonly IcalEvent[];
  /** Τα blocks **αυτού** του feed, όπως τα διάβασε η συναλλαγή. */
  readonly existing: readonly StayBlock[];
  /** Οι εκκρεμείς διαγραφές της προηγούμενης επιτυχούς ανάγνωσης. */
  readonly pendingRemovals: Readonly<Record<string, string>>;
  /** Η σημερινή ημέρα του καταλύματος (`YYYY-MM-DD`). */
  readonly today: string;
  readonly now: string;
  /** Ντετερμινιστική ταυτότητα — δίνεται, ώστε το αρχείο να μένει καθαρό. */
  readonly blockIdOf: (feedId: string, uid: string) => string;
}

/** Ασπίδα echo: γεγονός που **εμείς** δημοσιεύσαμε δεν επιστρέφει ως κατάληψη. */
function isOwnEvent(event: IcalEvent): boolean {
  return event.uid.endsWith(`@${STAY_ICAL_UID_DOMAIN}`);
}

/**
 * **Ένα γεγονός ανά `UID`.** Δύο γεγονότα με το ίδιο `UID` (μετρημένο σε χαλασμένα
 * feeds) ενώνονται στο **ευρύτερο** διάστημα: fail-closed — κλείνουμε ό,τι δήλωσαν και
 * τα δύο, ποτέ το ένα σιωπηλά.
 */
function dedupeByUid(events: readonly IcalEvent[]): readonly IcalEvent[] {
  const byUid = new Map<string, IcalEvent>();
  for (const event of events) {
    if (isOwnEvent(event)) continue;
    const seen = byUid.get(event.uid);
    if (seen === undefined) {
      byUid.set(event.uid, event);
      continue;
    }
    byUid.set(event.uid, {
      ...seen,
      from: event.from < seen.from ? event.from : seen.from,
      to: event.to > seen.to ? event.to : seen.to,
    });
  }
  return [...byUid.values()];
}

function uidOfBlock(block: StayBlock): string {
  return block.channel?.externalUid ?? '';
}

/**
 * **Το block που είναι «το ίδιο γεγονός με άλλο όνομα»**: χαμένο `UID`, **ίδια** ημέρα
 * αναχώρησης, και διαστήματα που επικαλύπτονται. Δες την απόφαση 2 της κεφαλίδας.
 */
function rebindableBlock(
  event: IcalEvent,
  orphans: readonly StayBlock[],
): StayBlock | undefined {
  return orphans.find((block) => block.to === event.to && block.from < event.to && event.from < block.to);
}

function planForEvents(
  input: StayChannelReconcileInput,
  events: readonly IcalEvent[],
  byUid: ReadonlyMap<string, StayBlock>,
): { readonly plan: StayChannelBlockPlan[]; readonly kept: Set<string> } {
  const plan: StayChannelBlockPlan[] = [];
  const kept = new Set<string>();
  const uids = new Set(events.map((event) => event.uid));
  const orphans = [...byUid.values()].filter((block) => !uids.has(uidOfBlock(block)));

  for (const event of events) {
    const known = byUid.get(event.uid);
    if (known !== undefined) {
      kept.add(known.id);
      if (known.from !== event.from || known.to !== event.to) {
        plan.push({ kind: 'update', id: known.id, uid: event.uid, from: event.from, to: event.to });
      }
      continue;
    }
    const rebindable = rebindableBlock(event, orphans.filter((block) => !kept.has(block.id)));
    if (rebindable !== undefined) {
      kept.add(rebindable.id);
      plan.push({ kind: 'update', id: rebindable.id, uid: event.uid, from: event.from, to: event.to });
      continue;
    }
    const id = input.blockIdOf(input.feedId, event.uid);
    kept.add(id);
    plan.push({ kind: 'create', id, uid: event.uid, from: event.from, to: event.to });
  }
  return { plan, kept };
}

/**
 * **Η διαφορά μιας επιτυχούς ανάγνωσης.** Καλείται **μόνο** για επιτυχία: αποτυχία
 * σημαίνει «δεν ξέρω», και το «δεν ξέρω» **δεν σβήνει** τίποτα (§6.4).
 */
export function reconcileStayChannelFeed(input: StayChannelReconcileInput): StayChannelReconciliation {
  const events = dedupeByUid(input.events);
  const byUid = new Map(input.existing.map((block) => [uidOfBlock(block), block]));
  const { plan, kept } = planForEvents(input, events, byUid);

  const pendingRemovals: Record<string, string> = {};
  for (const block of input.existing) {
    if (kept.has(block.id)) continue;
    // Παρελθόν: καμία νύχτα δεν ανοίγει προς τα πίσω.
    if (block.to <= input.today) {
      plan.push({ kind: 'delete', id: block.id });
      continue;
    }
    const firstMissingAt = input.pendingRemovals[block.id];
    if (firstMissingAt === undefined) {
      pendingRemovals[block.id] = input.now;
      continue;
    }
    // Δεύτερη συνεχόμενη επιτυχής ανάγνωση χωρίς το γεγονός ⇒ το κανάλι το εννοεί.
    plan.push({ kind: 'delete', id: block.id });
  }

  return { plan, pendingRemovals, eventCount: events.length };
}
