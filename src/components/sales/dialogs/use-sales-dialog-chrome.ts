'use client';

/**
 * @fileoverview Shared chrome hook for sales action dialogs
 * @description Το κοινό preamble κάθε sales dialog σε ένα σημείο.
 *              Πριν από αυτό οι ίδιες 4 κλήσεις hooks ήταν αντιγραμμένες
 *              σε κάθε dialog (CHECK 3.28 / ADR-584 token clone).
 * @see ADR-197 §2.9 — Sales action dialogs
 */

import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useNotifications } from '@/providers/NotificationProvider';

/**
 * Μεταφράσεις, σημασιολογικά χρώματα, μεγέθη εικονιδίων και ειδοποιήσεις —
 * ό,τι χρειάζεται κάθε sales action dialog για να ζωγραφίσει τον εαυτό του.
 */
export function useSalesDialogChrome() {
  const colors = useSemanticColors();
  const { t } = useTranslation(COMMON_NAMESPACES);
  const { success, error: notifyError } = useNotifications();
  const iconSizes = useIconSizes();

  return { colors, t, success, notifyError, iconSizes };
}
