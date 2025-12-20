'use client';

import React from 'react';
import { Calendar } from 'lucide-react';
import type { ExtendedPropertyDetails } from '@/types/property-viewer';
import { formatDate } from '@/lib/intl-utils'; // ✅ Using centralized function

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
        {dates.created && <div>Δημιουργία: {formatDate(new Date(dates.created))}</div>}
        {dates.updated && <div>Ενημέρωση: {formatDate(new Date(dates.updated))}</div>}
        {dates.available && (
          <div>Διαθεσιμότητα: {formatDate(new Date(dates.available))}</div>
        )}
      </div>
    </div>
  );
}
