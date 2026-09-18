/**
 * @fileoverview **ΠΟΙΟΣ ΕΚΔΙΔΕΙ ΠΟΙΑ ΠΡΑΞΗ** — ο ΕΝΑΣ πίνακας εξουσίας του ημερολογίου καταλύματος.
 * @related ADR-835 §23.4 · lib/stay/stay-calendar-command.ts ·
 *   services/stay-calendar/stay-calendar-write.service.ts · lib/owner-property/listing-custody.ts
 * @module lib/stay/stay-command-authority
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΕΝΑΣ ΓΡΑΦΕΑΣ, ΤΡΕΙΣ ΔΡΩΝΤΕΣ — ΚΑΙ Η ΑΠΑΝΤΗΣΗ ΖΕΙ ΣΕ ΕΝΑ `Record`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ως το Στάδιο Γ ο γραφέας ήξερε **έναν** δρώντα: τον διαχειριστή της αγγελίας (`mayAdminister`).
 * Το Στάδιο Δ φέρνει τον **επισκέπτη** (αίτημα, απόσυρση) και το **σύστημα** (λήξη). Δεύτερος
 * γραφέας για αυτούς θα ήταν δεύτερη σειριοποίηση — δηλαδή overbooking με άλλο όνομα. Άρα ο γραφέας
 * μένει **ένας**, και το «επιτρέπεται;» ρωτά **πρώτα αυτόν τον πίνακα**, ύστερα το δικό του κριτήριο
 * κάθε δρώντα (κατοχή για τον οικοδεσπότη, ταυτότητα για τον επισκέπτη).
 *
 * ⚠️ `Record` πάνω στο κλειστό σύνολο των πράξεων: **δέκατη τρίτη πράξη δεν μεταγλωττίζεται** χωρίς
 * να απαντηθεί *«ποιος την εκδίδει;»*. Ένα `?? 'host'` θα έδινε σιωπηλά στον οικοδεσπότη πράξη που
 * ίσως ανήκει στον επισκέπτη.
 *
 * ⛔ **Δεν είναι κριτής ρόλων** (CHECK 3.68): δεν ρωτά `globalRole`. Ρωτά **ποιος είσαι απέναντι στο
 * συγκεκριμένο ημερολόγιο** — διαχειριστής, επισκέπτης, ή ο ίδιος ο μηχανισμός λήξης.
 *
 * **Layering**: leaf — καθαροί τύποι, μηδέν I/O.
 */

import type { ListingActor } from '@/lib/owner-property/listing-custody';

import type { StayCalendarCommand } from './stay-calendar-command';

/** **Ποιος ενεργεί** πάνω στο ημερολόγιο. */
export type StayActor =
  /** Ο διαχειριστής της αγγελίας — κρίνεται από το `mayAdminister(custodyOf(…))`. */
  | { readonly kind: 'host'; readonly actor: ListingActor }
  /**
   * Επισκέπτης με λογαριασμό. Το `displayName` γράφεται ως **στιγμιότυπο** στο αίτημα — είναι αυτό
   * που βλέπει ο οικοδεσπότης. Ποτέ κριτής ταυτότητας (αυτό είναι το `uid`).
   */
  | { readonly kind: 'guest'; readonly uid: string; readonly displayName: string | null }
  /** Ο μηχανισμός λήξης (cron `stay-hold-expiry`) — **καμία** άλλη πράξη. */
  | { readonly kind: 'system' };

export type StayActorKind = StayActor['kind'];

export type StayCommandAction = StayCalendarCommand['action'];

/** **Ο πίνακας.** Μία γραμμή ανά πράξη, μία απάντηση ανά γραμμή. */
export const STAY_COMMAND_AUTHORITY: Readonly<Record<StayCommandAction, StayActorKind>> = {
  declare: 'host',
  block: 'host',
  unblock: 'host',
  book: 'host',
  cancel: 'host',
  rules: 'host',
  restrict: 'host',
  // ── Στάδιο Δ ──
  request: 'guest',
  withdraw: 'guest',
  accept: 'host',
  decline: 'host',
  expire: 'system',
};

/** `true` αν ο δρώντας **επιτρέπεται να εκδώσει** αυτή την πράξη — πριν από κάθε άλλο κριτήριο. */
export function actorMayIssue(actor: StayActor, action: StayCommandAction): boolean {
  return STAY_COMMAND_AUTHORITY[action] === actor.kind;
}

/** Η ταυτότητα του ίχνους — ποιος **έκανε** την πράξη. */
export const STAY_SYSTEM_PERFORMER = 'system:stay-hold-expiry';

/** Το `performedBy` του ίχνους ελέγχου για κάθε δρώντα. */
export function stayActorPerformer(actor: StayActor): string {
  switch (actor.kind) {
    case 'host':
      return actor.actor.uid;
    case 'guest':
      return actor.uid;
    case 'system':
      return STAY_SYSTEM_PERFORMER;
  }
}
