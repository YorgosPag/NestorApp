/**
 * @fileoverview **ΧΩΡΑΕΙ ΑΚΟΜΗ ΕΝΑ ΜΗΝΥΜΑ ΣΕ ΑΥΤΟΝ ΤΟΝ ΠΑΡΑΛΗΠΤΗ;** — όριο ανά γραμματοκιβώτιο, όχι ανά καλούντα.
 * @related lib/middleware/rate-limit-config.ts (οι ποσοστώσεις) · server/auth/auth-action-mail.ts ·
 *   services/mandate/showcase-email-confirmation.service.ts
 * @module lib/middleware/recipient-quota
 *
 * 🔴 **ΕΞΗΧΘΗ ΤΗ ΣΤΙΓΜΗ ΠΟΥ ΧΡΕΙΑΣΤΗΚΕ ΔΕΥΤΕΡΗ ΦΟΡΑ** (ADR-841 §7 Α21.18, N.0.2): ζούσε ιδιωτικό μέσα
 * στο `auth-action-mail.ts`. Η επιβεβαίωση email της κάρτας ρωτά **την ίδια** ερώτηση — και ένα
 * αντίγραφο θα ήταν δεύτερη ευκαιρία να ξεχαστεί το **hash** του κλειδιού (email ωμό σε store ορίων).
 *
 * 🔑 **Ο πυρήνας ζει πλέον στο `subject-quota.ts`** (hash κλειδιού · «αποτυχία του store ⇒ επιτρέπει» ·
 * σκιά): εδώ μένει **μόνο** ό,τι ξέρει για γραμματοκιβώτια — η κανονικοποίηση του email (κενά, πεζά).
 */

import 'server-only';

import { withinSubjectQuota, type SubjectQuota } from '@/lib/middleware/subject-quota';

/** Ποσόστωση ανά παραλήπτη — η **ίδια** δήλωση με κάθε άλλη ποσόστωση ανά υποκείμενο. */
export type RecipientQuota = SubjectQuota;

/**
 * @param scope Ποιο είδος μηνύματος μετράει (`auth-mail:reset` · `showcase-email-confirmation`) — δύο
 *   είδη **δεν** τρώνε το ένα το όριο του άλλου.
 */
export async function withinRecipientQuota(
  scope: string,
  recipient: string,
  quota: RecipientQuota,
): Promise<boolean> {
  return withinSubjectQuota(scope, recipient.trim().toLowerCase(), quota);
}
