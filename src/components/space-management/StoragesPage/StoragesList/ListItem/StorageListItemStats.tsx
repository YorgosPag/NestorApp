'use client';

import React from 'react';
import { formatCurrency } from '@/lib/intl-utils';
import type { Storage } from '@/types/storage/contracts';

interface StorageListItemStatsProps {
  storage: Storage;
}

export function StorageListItemStats({ storage }: StorageListItemStatsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 text-xs">
      <div>
        <p className="text-muted-foreground">Τιμή</p>
        <p className="font-medium">
          {storage.price ? formatCurrency(storage.price) : 'Μη διαθέσιμη'}
        </p>
      </div>
      <div>
        <p className="text-muted-foreground">Τιμή/m²</p>
        <p className="font-medium">
          {storage.price && storage.area
            ? formatCurrency(storage.price / storage.area)
            : 'N/A'
          }
        </p>
      </div>
      <div>
        <p className="text-muted-foreground">Έργο</p>
        <p className="font-medium text-xs truncate">
          {storage.projectId || 'Δεν έχει καθοριστεί'}
        </p>
      </div>
      <div>
        <p className="text-muted-foreground">Περιγραφή</p>
        <p className="font-medium text-xs truncate">
          {storage.description || 'Δεν υπάρχει'}
        </p>
      </div>
    </div>
  );
}