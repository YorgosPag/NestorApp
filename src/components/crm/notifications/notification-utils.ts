'use client';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn, getStatusColor } from '@/lib/design-system';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';

export const useNotificationUtils = () => {
  const { t } = useTranslation('crm');

  const getTypeStyles = (type: string) => {
    switch(type) {
      case 'new_lead':
        return cn(getStatusColor('info', 'bg'), getStatusColor('info', 'text'));
      case 'task_due':
        return cn(getStatusColor('warning', 'bg'), getStatusColor('warning', 'text'));
      case 'meeting_reminder':
        return cn(getStatusColor('pending', 'bg'), getStatusColor('pending', 'text'));
      case 'contract_signed':
        return cn(getStatusColor('success', 'bg'), getStatusColor('success', 'text'));
      default:
        return cn(COLOR_BRIDGE.bg.secondary, COLOR_BRIDGE.text.secondary);
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
    getTypeStyles,
    getTypeLabel
  };
};
