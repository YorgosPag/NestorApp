'use client';

import React from 'react';
import { Calendar } from 'lucide-react';
import { formatDate } from '@/lib/intl-utils';
import { useIconSizes } from '@/hooks/useIconSizes';

interface BuildingListItemFooterProps {
  completionDate?: string;
}

export function BuildingListItemFooter({ completionDate }: BuildingListItemFooterProps) {
  const iconSizes = useIconSizes();
  if (!completionDate) return null;

  return (
    <div className="mt-3 pt-3 border-t border-border/50">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Calendar className={iconSizes.xs} />
        <span>Παράδοση: {formatDate(completionDate)}</span>
      </div>
    </div>
  );
}
