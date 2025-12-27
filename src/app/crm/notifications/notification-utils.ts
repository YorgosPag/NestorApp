'use client';

import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

export const useNotificationUtils = () => {
  const colors = useSemanticColors();

  const getTypeStyles = (type: string) => {
    switch(type) {
      case 'new_lead': return 'bg-blue-100 text-blue-800';
      case 'task_due': return 'bg-yellow-100 text-yellow-800';
      case 'meeting_reminder': return 'bg-purple-100 text-purple-800';
      case 'contract_signed': return 'bg-green-100 text-green-800';
      default: return `${colors.bg.secondary} ${colors.text.secondary}`;
    }
  };

  const getTypeLabel = (type: string) => {
    switch(type) {
      case 'new_lead': return 'Lead';
      case 'task_due': return 'Εργασία';
      case 'meeting_reminder': return 'Ραντεβού';
      case 'contract_signed': return 'Πώληση';
      default: return 'Γενικό';
    }
  };

  return {
    getTypeStyles,
    getTypeLabel
  };
};
