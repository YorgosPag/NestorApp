'use client';

/**
 * @fileoverview AppurtenancesSection — ADR-199
 * @description Section component for sale dialogs showing linked parking/storage
 *              spaces that can be included in a unit's sale transaction.
 * @see ADR-199 Sales Appurtenances
 */

import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Car, Package, AlertTriangle, Ban } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrencyWhole } from '@/lib/intl-utils';
import type { ResolvedLinkedSpace } from '@/hooks/sales/useLinkedSpacesForSale';
import '@/lib/design-system';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

// =============================================================================
// TYPES
// =============================================================================

interface AppurtenancesSectionProps {
  spaces: ResolvedLinkedSpace[];
  unitPrice: number;
  totalAppurtenancesPrice: number;
  onToggle: (spaceId: string) => void;
  onPriceChange: (spaceId: string, price: number) => void;
  readOnly?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function AppurtenancesSection({
  const colors = useSemanticColors();
  spaces,
  unitPrice,
  totalAppurtenancesPrice,
  onToggle,
  onPriceChange,
  readOnly = false,
}: AppurtenancesSectionProps) {
  const iconSizes = useIconSizes();
  const { t } = useTranslation('common');

  if (spaces.length === 0) return null;

  const grandTotal = unitPrice + totalAppurtenancesPrice;

  return (
    <section className="space-y-3">
      <Label className="text-sm font-semibold">
        {t('sales.appurtenances.title', { defaultValue: 'Παρακολουθήματα' })} ({spaces.length})
      </Label>

      <ul className="space-y-2">
        {spaces.map((space) => {
          const SpaceIcon = space.spaceType === 'parking' ? Car : Package;
          const iconColor = space.spaceType === 'parking'
            ? 'text-blue-600'
            : 'text-amber-600';
          const hasNoArea = space.area <= 0;

          return (
            <li
              key={space.spaceId}
              className={`flex flex-col gap-1 rounded-md border p-2 ${hasNoArea ? 'opacity-60 border-destructive/40' : ''}`}
            >
              <div className="flex items-center gap-3">
                {!readOnly && (
                  <Checkbox
                    id={`space-${space.spaceId}`}
                    checked={space.checked}
                    onCheckedChange={() => onToggle(space.spaceId)}
                    disabled={hasNoArea}
                  />
                )}

                <SpaceIcon className={`${iconSizes.sm} ${iconColor} shrink-0`} />

                <label
                  htmlFor={`space-${space.spaceId}`}
                  className={`flex-1 text-sm font-medium ${hasNoArea ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {space.displayName}
                  {space.isRented && (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">
                      <AlertTriangle className={iconSizes.xs} />
                      {t('sales.appurtenances.activeRental', { defaultValue: 'Ενεργή μίσθωση' })}
                    </span>
                  )}
                </label>

                {readOnly ? (
                  <span className={cn("text-sm", colors.text.muted)}>
                    {space.salePrice > 0 ? formatCurrencyWhole(space.salePrice) : '—'}
                  </span>
                ) : (
                  <Input
                    type="number"
                    min={0}
                    step={500}
                    value={space.salePrice || ''}
                    onChange={(e) => onPriceChange(space.spaceId, Number(e.target.value) || 0)}
                    placeholder={t('sales.appurtenances.pricePlaceholder', { defaultValue: 'Τιμή €' })}
                    className="w-28 text-right text-sm"
                    disabled={!space.checked || hasNoArea}
                  />
                )}
              </div>
              {hasNoArea && (
                <p className="flex items-center gap-1.5 text-xs text-destructive ml-7">
                  <Ban className="h-3 w-3 shrink-0" />
                  {t('sales.appurtenances.noArea', {
                    defaultValue: 'Δεν έχει εμβαδόν (τ.μ.) — δεν μπορεί να συμπεριληφθεί',
                  })}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <footer className="flex justify-between border-t pt-2 text-sm font-medium">
        <span>{t('sales.appurtenances.grandTotal', { defaultValue: 'Σύνολο (μονάδα + παρακολουθήματα)' })}</span>
        <span>{formatCurrencyWhole(grandTotal)}</span>
      </footer>
    </section>
  );
}
