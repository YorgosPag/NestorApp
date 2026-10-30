'use client';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { getStatusBadgeVariant } from '@/lib/design-system';
import type { BadgeVariant } from '@/core/types/BadgeTypes';

export const useNotificationUtils = () => {
  const { t } = useTranslation('crm');

  // Παραλλαγή `Badge` (γέμισμα + μετρημένο μελάνι), ΟΧΙ κλάσεις: ως τις 2026-10-29 γέμισμα και κείμενο από το
  // ΙΔΙΟ token ⇒ αόρατη ετικέτα (ADR-770).
  const getTypeVariant = (type: string): BadgeVariant => {
    switch(type) {
      case 'new_lead':
        return getStatusBadgeVariant('info');
      case 'task_due':
        return getStatusBadgeVariant('warning');
      case 'meeting_reminder':
        return getStatusBadgeVariant('pending');
      case 'contract_signed':
        return getStatusBadgeVariant('success');
      default:
        return 'secondary';
    }
  };

  const getTypeLabel = (type: string) => {
    switch(type) {
      case 'new_lead':
        return t('notifications.types.newLead');
      case 'task_due':
        return t('notifications.types.taskDue');
      case 'meeting_reminder':
        return t('notifications.types.meetingReminder');
      case 'contract_signed':
        return t('notifications.types.contractSigned');
      default:
        return t('notifications.types.other');
    }
  };

  return {
    getTypeVariant,
    getTypeLabel
  };
};
