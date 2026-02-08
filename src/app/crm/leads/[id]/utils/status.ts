'use client';

import type { Opportunity } from '@/types/crm';
import { cn, getStatusColor } from '@/lib/design-system';

export const useStatusColor = () => {
  const getStatusClassName = (status?: Opportunity['stage']) => {
    const statusMap: Record<Opportunity['stage'], string> = {
      initial_contact: 'pending',
      qualification: 'reserved',
      viewing: 'completed',
      proposal: 'reserved',
      negotiation: 'pending',
      contract: 'pending',
      closed_won: 'active',
      closed_lost: 'error',
    };

    const fallbackStatus = 'pending';
    const mappedStatus = status ? statusMap[status] : fallbackStatus;

    return cn(
      getStatusColor(mappedStatus, 'bg'),
      getStatusColor(mappedStatus, 'text')
    );
  };

  return { getStatusColor: getStatusClassName };
};
