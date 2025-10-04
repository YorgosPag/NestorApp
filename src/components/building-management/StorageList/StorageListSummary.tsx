'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import type { StorageUnit } from '@/types/storage';
import { formatPrice, formatArea } from '../StorageCard/StorageCardUtils';

interface StorageListSummaryProps {
  units: StorageUnit[];
}

export function StorageListSummary({ units }: StorageListSummaryProps) {
  const totalValue = units.reduce((sum, u) => sum + u.price, 0);
  const totalArea = units.reduce((sum, u) => sum + u.area, 0);
  const availableCount = units.filter(u => u.status === 'available').length;
  const averagePricePerSqm = totalArea > 0 ? totalValue / totalArea : 0;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="text-center">
            <div className="font-semibold text-foreground">
              {availableCount}
            </div>
            <div className="text-muted-foreground">Διαθέσιμα</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-foreground">
              {formatPrice(totalValue)}
            </div>
            <div className="text-muted-foreground">Συνολική Αξία</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-foreground">
              {formatArea(totalArea)}
            </div>
            <div className="text-muted-foreground">Συνολική Επιφάνεια</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-foreground">
              {formatPrice(averagePricePerSqm)}
            </div>
            <div className="text-muted-foreground">Μέσος όρος €/m²</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
