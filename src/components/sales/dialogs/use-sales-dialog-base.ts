'use client';

/**
 * @fileoverview **Η ΚΟΙΝΗ ΚΕΦΑΛΙΔΑ ΤΩΝ ΔΙΑΛΟΓΩΝ ΠΩΛΗΣΕΩΝ** — χρώματα, μεταφράσεις, εικονίδια,
 * ειδοποιήσεις, κατάσταση αποθήκευσης και ο φύλακας επιπτώσεων του ακινήτου.
 * @module components/sales/dialogs/use-sales-dialog-base
 *
 * 🔑 N.18 (CHECK 3.28): οι ίδιες έξι γραμμές ζούσαν αυτούσιες στο `ChangePriceDialog` **και** στο
 * `RevertDialog`. Εδώ ζουν **μία** φορά· κάθε διάλογος κρατά μόνο ό,τι είναι δικό του.
 */

import { useState } from 'react';

import { useGuardedPropertyMutation } from '@/hooks/useGuardedPropertyMutation';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';
import { useNotifications } from '@/providers/NotificationProvider';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

import type { BaseDialogProps } from './sales-dialog-utils';

export function useSalesDialogBase(unit: BaseDialogProps['unit']) {
  const colors = useSemanticColors();
  const { t } = useTranslation(COMMON_NAMESPACES);
  const iconSizes = useIconSizes();
  const { success, error: notifyError } = useNotifications();
  const [saving, setSaving] = useState(false);
  const guarded = useGuardedPropertyMutation(unit);

  return { colors, t, iconSizes, success, notifyError, saving, setSaving, guarded };
}
