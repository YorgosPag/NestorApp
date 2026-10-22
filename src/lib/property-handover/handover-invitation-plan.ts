/**
 * @fileoverview **Τι χρωστάμε στον αγοραστή ως πρόσκληση** — η καθαρή κρίση πάνω σε μία παράδοση (ADR-916 Φ-Β · Δ7).
 * @related lib/property-handover/handover-plan.ts (ο κύκλος ζωής — **πριν** από εδώ) ·
 *          services/property-handover/property-handover-invitation-stage.ts (ο εκτελεστής, μέσα στη συναλλαγή)
 * @module lib/property-handover/handover-invitation-plan
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΣΥΜΦΙΛΙΩΣΗ, ΟΧΙ ΓΕΓΟΝΟΣ — όπως ο κύκλος ζωής (Π5)
 * ────────────────────────────────────────────────────────────────────────────
 * Δεν ρωτά «τι άλλαξε;» αλλά «τι **ισχύει**;»: το κάτοπτρο της πρόσκλησης πάνω στην παράδοση **και** το **τρέχον**
 * email της επαφής. Ίδια αλήθεια ⇒ `none` ⇒ καμία εγγραφή, κανένα email (ιδεμπότητα — δύο κλήσεις, ένα μήνυμα).
 *
 * ⚖️ **Κανόνες** (άγκυρες Β1–Β8):
 *   · αποδέχτηκε ήδη ⇒ τίποτα, ποτέ ξανά
 *   · ακυρώθηκε ⇒ ανάκληση της ζωντανής (ο σύνδεσμος στα εισερχόμενα **πεθαίνει**)
 *   · χωρίς email ⇒ σήμα `no-address` στο γραφείο — ποτέ σιωπηλή αποτυχία
 *   · πρώτη φορά · άλλαξε το email · έφτασε η ολοκλήρωση χωρίς αποδοχή ⇒ **νέα** πρόσκληση (η παλιά ανακαλείται)
 *   · αρνήθηκε ⇒ **καμία** αυτόματη νέα στο ίδιο email — ούτε στην ολοκλήρωση (σεβασμός, όχι spam)
 *
 * **Layering**: leaf — καθαρές συναρτήσεις· ο χρόνος **δίνεται**, δεν διαβάζεται.
 */

import {
  HANDOVER_INVITATION_DELIVERY_CAP,
  isHandoverInvitationExpired,
  isHandoverInvitationReminderDue,
} from '@/config/property-handover-invitation-policy';
import type { PropertyHandover, PropertyHandoverInvitationOccasion } from '@/types/property-handover';

/** Η πράξη **μέσα** στη συναλλαγή της παράδοσης. */
export type HandoverInvitationIntent =
  | { readonly kind: 'none' }
  /** Ανάκληση κάθε ζωντανής + κάτοπτρο `no-address`. */
  | { readonly kind: 'no-address' }
  /** Νέα πρόσκληση (supersede της ζωντανής) προς **αυτό** το email, με **αυτή** την αφορμή. */
  | { readonly kind: 'issue'; readonly email: string; readonly occasion: PropertyHandoverInvitationOccasion }
  /** Ανάκληση κάθε ζωντανής + καθαρό κάτοπτρο — η πώληση έπεσε πριν την αποδοχή. */
  | { readonly kind: 'revoke' };

/** Η αφορμή που **οφείλεται** τώρα: ολοκληρωμένη πώληση ⇒ «ο φάκελός σας είναι έτοιμος». */
export function invitationOccasionOf(handover: PropertyHandover): PropertyHandoverInvitationOccasion {
  return handover.lifecycle === 'ready' ? 'completion' : 'reservation';
}

/**
 * **Η κρίση.** `email` = το **κύριο** email της επαφής **τώρα**, ήδη κανονικοποιημένο (`normaliseChannelEmail`) — ή
 * `null` αν δεν υπάρχει ή η επαφή δεν διαβάζεται (ξένη ≡ ανύπαρκτη).
 */
export function handoverInvitationIntentOf(handover: PropertyHandover, email: string | null): HandoverInvitationIntent {
  if (handover.recipient !== null) return { kind: 'none' };
  const link = handover.invitation;

  if (handover.lifecycle === 'cancelled') {
    return link?.status === 'issued' ? { kind: 'revoke' } : { kind: 'none' };
  }
  if (email === null) return link?.status === 'no-address' ? { kind: 'none' } : { kind: 'no-address' };

  const occasion = invitationOccasionOf(handover);
  if (link === null || link.status === 'no-address' || link.inviteeEmail !== email) {
    return { kind: 'issue', email, occasion };
  }
  if (link.declinedAt !== null) return { kind: 'none' };
  return link.occasion === occasion ? { kind: 'none' } : { kind: 'issue', email, occasion };
}

// =============================================================================
// ΜΕΤΑ ΤΗ ΣΥΝΑΛΛΑΓΗ — το δίχτυ των email (μόνο στη νυχτερινή συμφιλίωση)
// =============================================================================

/** Τι οφείλει το δίχτυ σε μια **ήδη** εκδομένη πρόσκληση. */
export type HandoverInvitationFollowUp = 'none' | 'redeliver' | 'remind';

/**
 * **Νέο email για την ΙΔΙΑ πρόσκληση;** — επανάληψη όταν το προηγούμενο **δεν** έγινε δεκτό (πτώση ανάμεσα σε commit
 * και αποστολή · ο πάροχος αρνήθηκε · έλειπε η δημόσια διεύθυνση και ρυθμίστηκε στο μεταξύ), ή
 * η **μία** υπενθύμιση. Ποτέ σε ληγμένη, απαντημένη ή ακυρωμένη· ποτέ πάνω από το όριο.
 */
export function handoverInvitationFollowUpOf(handover: PropertyHandover, nowValue: string): HandoverInvitationFollowUp {
  const link = handover.invitation;
  if (handover.recipient !== null || handover.lifecycle === 'cancelled' || link === null || link.status !== 'issued') return 'none';
  if (link.declinedAt !== null || isHandoverInvitationExpired(link.expiresAt, nowValue)) return 'none';
  if (link.deliveryAttempts >= HANDOVER_INVITATION_DELIVERY_CAP) return 'none';
  // Μια υπενθύμιση που ο πάροχος δεν δέχτηκε ξαναδοκιμάζεται **ως υπενθύμιση** — ποτέ δεύτερη «πρώτη» πρόσκληση.
  const reminderDue = link.remindedAt === null && isHandoverInvitationReminderDue(link.issuedAt, nowValue);
  if (link.delivery === 'accepted') return reminderDue ? 'remind' : 'none';
  return reminderDue ? 'remind' : 'redeliver';
}
