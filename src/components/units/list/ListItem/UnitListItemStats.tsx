'use client';

import React from 'react';
import { formatCurrency } from '@/lib/project-utils';
import type { Property } from '@/types/property-viewer';

interface UnitListItemStatsProps {
  unit: Property;
}

// Safe number formatting function to avoid hydration errors
function formatNumber(num: number | undefined): string {
  if (!num) return '0';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Safe currency formatting function
function formatPrice(price: number | undefined): string {
  if (!price) return '€0';
  try {
    return `€${formatNumber(price)}`;
  } catch (error) {
    return `€${price}`;
  }
}

export function UnitListItemStats({ unit }: UnitListItemStatsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 text-xs">
      <div>
        <p className="text-muted-foreground">Επιφάνεια</p>
        <p className="font-medium">{formatNumber(unit.area)} m²</p>
      </div>
      <div>
        <p className="text-muted-foreground">Αξία</p>
        <p className="font-medium text-green-600">{formatPrice(unit.price)}</p>
      </div>
      {unit.project && (
        <div className="col-span-2">
          <p className="text-muted-foreground">Έργο</p>
          <p className="font-medium text-xs truncate">{unit.project}</p>
        </div>
      )}
    </div>
  );
}