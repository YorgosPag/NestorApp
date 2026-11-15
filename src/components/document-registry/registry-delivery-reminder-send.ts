/**
 * @fileoverview ADR-915 §45 Φ3 — **η αποστολή της «Υπενθύμισης»** και ό,τι λέει στον άνθρωπο μετά (επιτυχία · δεν έφυγε ·
 *   άρνηση με όνομα). Φορτώνεται **δυναμικά**, τη στιγμή του πατήματος.
 * @related RegistryDeliveryReminder.tsx (το κουμπί) · services/document-registry/document-registry.client.ts (η μεταφορά)
 * @module components/document-registry/registry-delivery-reminder-send
 *
 * ⚠️ **Χωριστό, επίτηδες** (CHECK 3.34, μετρημένο 2026-11-15): με τα μηνύματα μέσα στο αρχείο του κουμπιού, ο πίνακας
 *    (πρώτο καρέ) έσερνε όλο το λεξιλόγιο αρνήσεων στο slice της διαδρομής — **14.188 / 13.475** bytes. Εδώ τα μηνύματα
 *    ζητούνται μόνο όταν πατηθεί το κουμπί.
 * 🔑 **Όχι αισιόδοξη**: ένα email δεν «παίρνεται πίσω». Η οθόνη λέει **τι απέγινε** (`accepted` ≠ «παραδόθηκε»).
 */

import { DELIVERY_REMINDER_KEYS, DELIVERY_REMINDER_REFUSAL_KEYS } from '@/components/document-registry/issuance-delivery-labels';
import type { DocumentKind } from '@/config/document-validity/document-validity';
import type { useTranslation } from '@/i18n/hooks/useTranslation';
import { sendIssuanceDeliveryReminder } from '@/services/document-registry/document-registry.client';

export interface DeliveryReminderFeedback {
  readonly t: ReturnType<typeof useTranslation>['t'];
  readonly success: (message: string) => void;
  readonly warning: (message: string) => void;
  readonly error: (message: string) => void;
  readonly revalidate: () => Promise<void>;
}

/** **Ένα** πάτημα ⇒ ένα αίτημα· μετά το μήνυμα και η επαναφόρτωση του μητρώου (η «τελευταία» έρχεται από τον διακομιστή). */
export async function sendDeliveryReminder(
  target: { readonly propertyId: string; readonly kind: DocumentKind },
  feedback: DeliveryReminderFeedback,
): Promise<void> {
  const { t } = feedback;
  const result = await sendIssuanceDeliveryReminder({ propertyId: target.propertyId, documentKind: target.kind });
  if (result.kind === 'failed') {
    feedback.error(t(DELIVERY_REMINDER_REFUSAL_KEYS[result.code ?? 'generic'] ?? DELIVERY_REMINDER_REFUSAL_KEYS.generic));
    return;
  }
  if (result.data.delivery === 'accepted') feedback.success(t(DELIVERY_REMINDER_KEYS.sent));
  else feedback.warning(t(DELIVERY_REMINDER_KEYS.sentUndelivered));
  await feedback.revalidate();
}
