'use client';

import React from 'react';
import { Calendar, User } from 'lucide-react';
import { formatDate } from '@/lib/intl-utils';
import { useIconSizes } from '@/hooks/useIconSizes';

interface StorageListItemFooterProps {
  lastUpdated?: Date | string;
  owner?: string;
}

export function StorageListItemFooter({ lastUpdated, owner }: StorageListItemFooterProps) {
  const iconSizes = useIconSizes();
  if (!lastUpdated && !owner) return null;

  return (
    <div className="mt-3 pt-3 border-t border-border/50">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        {lastUpdated && (
          <div className="flex items-center gap-1">
            <Calendar className={iconSizes.xs} />
            <span>Ενημέρωση: {formatDate(
              lastUpdated instanceof Date
                ? lastUpdated.toISOString()
                : lastUpdated
            )}</span>
          </div>
        )}
        {owner && (
          <div className="flex items-center gap-1">
            <User className={iconSizes.xs} />
            <span className="truncate max-w-24">{owner}</span>
          </div>
        )}
      </div>
    </div>
  );
}