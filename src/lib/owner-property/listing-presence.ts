/**
 * @fileoverview **ΕΙΝΑΙ ΣΤΗΝ ΑΓΟΡΑ; — ΚΑΙ ΠΟΙΑ ΠΡΑΞΗ ΕΧΕΙ ΝΟΗΜΑ ΤΩΡΑ.**
 * @related ADR-777 §8.39 · types/owner-property.ts · lib/mandate/mandate-actions.ts
 * @module lib/owner-property/listing-presence
 *
 * 🔑 **ΞΕΧΩΡΙΣΤΟ ΑΠΟ ΤΟ `mandate-actions.ts`, ΚΑΙ ΕΙΝΑΙ ΟΥΣΙΑ.** Εκείνο κρίνει τις
 * πράξεις της **πρόσκλησης** (`resend`·`revoke`) πάνω στο `MandateStanding`, με
 * αρνήσεις σαν `declined`·`expired`·`not-pending`. Αυτό κρίνει την **παρουσία της
 * αγγελίας στην αγορά** πάνω στο `OwnerPropertyLifecycle`. Δύο μηχανές καταστάσεων,
 * δύο διαδρομές HTTP, δύο λεξιλόγια αρνήσεων — μια κοινή λίστα πράξεων θα σήμαινε ότι
 * ο ένας κριτής θα καλούνταν να απαντήσει για την **άλλη** μηχανή.
 *
 * ⚠️ **Η ΑΠΟΣΥΡΣΗ ΔΕΝ ΑΚΥΡΩΝΕΙ ΤΗΝ ΕΝΤΟΛΗ, ΚΑΙ ΤΟ ΑΝΤΙΣΤΡΟΦΟ.** Το γράφει ήδη το
 * `setOwnerPropertyLifecycle`: *«τα invariants ΔΕΝ ξανακρίνονται εδώ… μια πύλη που
 * εμποδίζει τον άνθρωπο να αποσύρει το ακίνητό του τον κλειδώνει έξω από την έξοδο»*.
 * Άρα η απόσυρση δουλεύει **σε κάθε** κατάσταση εντολής, και η εντολή μένει όπως ήταν.
 */

import type { OwnerPropertyLifecycle } from '@/types/owner-property';

/** Οι δύο κατευθύνσεις — **κλειστό σύνολο**, ώστε καμία `switch` να μη χρειάζεται `default`. */
export const PRESENCE_ACTIONS = ['withdraw', 'restore'] as const;

export type PresenceAction = (typeof PRESENCE_ACTIONS)[number];

/**
 * **Ο κύκλος ζωής που γράφει η πράξη** — πλήρες `Record` πάνω στο κλειστό σύνολο, ώστε
 * μια τρίτη πράξη να **σπάει τη μεταγλώττιση** αντί να ξεχαστεί.
 */
export const PRESENCE_LIFECYCLE: Record<PresenceAction, OwnerPropertyLifecycle> = {
  withdraw: 'withdrawn',
  restore: 'listed',
};

/**
 * **Η μία πράξη που έχει νόημα τώρα.**
 *
 * 🔑 Επιστρέφει **μία**, όχι λίστα: η άλλη κατεύθυνση θα ήταν no-op («ανέβασέ το» σε
 * κάτι που είναι ήδη πάνω), δηλαδή κουμπί που δεν κάνει τίποτα — και ένα κουμπί που
 * δεν κάνει τίποτα διδάσκει τον άνθρωπο να μην εμπιστεύεται τα κουμπιά.
 *
 * ⚠️ Το `onTheMarket` το υπολογίζει ο **διακομιστής** (`isOwnerPropertyOnTheMarket`),
 * και η οθόνη το **διαβάζει**. Ένας τοπικός υπολογισμός εδώ θα ήταν δεύτερος
 * ταξινομητής — ίδιο επιχείρημα με το «η οθόνη ζητά νέο κατάλογο» του
 * `runMandateAction`.
 */
export function presenceActionFor(onTheMarket: boolean): PresenceAction {
  return onTheMarket ? 'withdraw' : 'restore';
}
