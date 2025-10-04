'use client';

import React from 'react';
import { Calendar } from 'lucide-react';
import type { ExtendedPropertyDetails } from '@/types/property-viewer';

interface PropertyDatesProps {
  dates: ExtendedPropertyDetails['dates'];
}

export function PropertyDates({ dates }: PropertyDatesProps) {
  if (!dates) return null;

  return (
    <div className="space-y-1">
      <h4 className="text-xs font-medium flex items-center gap-1">
        <Calendar className="h-3 w-3" />
        Ημερομηνίες
      </h4>
      <div className="space-y-1 text-xs text-muted-foreground">
        {dates.created && <div>Δημιουργία: {new Date(dates.created).toLocaleDateString('el-GR')}</div>}
        {dates.updated && <div>Ενημέρωση: {new Date(dates.updated).toLocaleDateString('el-GR')}</div>}
        {dates.available && (
          <div>Διαθεσιμότητα: {new Date(dates.available).toLocaleDateString('el-GR')}</div>
        )}
      </div>
    </div>
  );
}
