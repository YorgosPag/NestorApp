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
 * ⚠️ **Αποτυχία του store ⇒ επιτρέπει** — ίδια πολιτική με το `withRateLimit`: η διαθεσιμότητα
 * μιας αποστολής δεν εξαρτάται από το Redis. Το όριο ανά IP της διαδρομής μένει ως δεύτερος φρουρός.
 */

import 'server-only';

import { createHash } from 'crypto';

import { getErrorMessage } from '@/lib/error-utils';
import { checkQuota } from '@/lib/middleware/rate-limiter';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('RECIPIENT_QUOTA');

export interface RecipientQuota {
  readonly limit: number;
  readonly windowMs: number;
}

/**
 * @param scope Ποιο είδος μηνύματος μετράει (`auth-mail:reset` · `showcase-email-confirmation`) — δύο
 *   είδη **δεν** τρώνε το ένα το όριο του άλλου.
 */
export async function withinRecipientQuota(
  scope: string,
  recipient: string,
  quota: RecipientQuota,
): Promise<boolean> {
  const key = `${scope}:${createHash('sha256').update(recipient.trim().toLowerCase()).digest('hex')}`;
  try {
    return (await checkQuota(key, quota.limit, quota.windowMs)).allowed;
  } catch (error: unknown) {
    logger.warn('Ο έλεγχος ορίου παραλήπτη απέτυχε — επιτρέπεται', { scope, error: getErrorMessage(error) });
    return true;
  }
}
