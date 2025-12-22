'use client';

import React from 'react';
import { Calendar, User } from 'lucide-react';
import { formatDate } from '@/lib/intl-utils';

interface StorageListItemFooterProps {
  lastUpdated?: Date | string;
  owner?: string;
}

export function StorageListItemFooter({ lastUpdated, owner }: StorageListItemFooterProps) {
  if (!lastUpdated && !owner) return null;

  return (
    <div className="mt-3 pt-3 border-t border-border/50">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        {lastUpdated && (
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            <span>Ενημέρωση: {formatDate(
              lastUpdated instanceof Date
                ? lastUpdated.toISOString()
                : lastUpdated
            )}</span>
          </div>
        )}
        {owner && (
          <div className="flex items-center gap-1">
            <User className="w-3 h-3" />
            <span className="truncate max-w-24">{owner}</span>
          </div>
        )}
      </div>
    </div>
  );
}