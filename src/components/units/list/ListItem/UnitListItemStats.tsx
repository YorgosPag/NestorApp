'use client';

import React from 'react';
import { formatCurrency, formatNumber as formatNumberIntl } from '@/lib/intl-utils';
import type { Property } from '@/types/property-viewer';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

interface UnitListItemStatsProps {
  unit: Property;
}

// 🔄 CENTRALIZED FORMATTING: Using enterprise formatters from intl-utils.ts
// 📍 REPLACED: Local formatNumber and formatPrice with centralized implementations

// Safe number formatting function to avoid hydration errors
function formatNumber(num: number | undefined): string {
  if (!num) return '0';
  try {
    // Use centralized formatter with fallback
    return formatNumberIntl(num);
  } catch (error) {
    // Fallback for hydration safety
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
}

// Safe currency formatting function
function formatPrice(price: number | undefined): string {
  if (!price) return '€0';
  try {
    // Use centralized currency formatter
    return formatCurrency(price, 'EUR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  } catch (error) {
    // Fallback for hydration safety
    return `€${price}`;
  }
}

export function UnitListItemStats({ unit }: UnitListItemStatsProps) {
  const colors = useSemanticColors();

  return (
    <div className="grid grid-cols-2 gap-3 text-xs">
      <div>
        <p className="text-muted-foreground">Επιφάνεια</p>
        <p className="font-medium">{formatNumber(unit.area)} m²</p>
      </div>
      <div>
        <p className="text-muted-foreground">Αξία</p>
        <p className={`font-medium ${colors.text.success}`}>{formatPrice(unit.price)}</p>
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