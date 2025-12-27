
'use client';

import type { Opportunity } from '@/types/crm';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

export const useStatusColor = () => {
  const semanticColors = useSemanticColors();

  const getStatusColor = (status?: Opportunity['stage']) => {
    const colors: Record<string, string> = {
      'initial_contact': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200',
      'qualification': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200',
      'viewing': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200',
      'proposal': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200',
      'negotiation': 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-200',
      'contract': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200',
      'closed_won': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200',
      'closed_lost': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200',
    };
    return colors[status || ''] || `${semanticColors.bg.secondary} ${semanticColors.text.secondary}`;
  };

  return { getStatusColor };
};
