'use client';

/**
 * @fileoverview Sales Parking List Card — ADR-199
 * @description Card for parking spots in sales context — extends ListCard molecule
 * @pattern Same as SalesPropertyListCard but with parking-specific data
 */

import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';
import React, { useMemo } from 'react';
import { DollarSign, Calculator, MapPin, Car } from 'lucide-react';
import { ListCard } from '@/design-system/components/ListCard/ListCard';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrencyWhole } from '@/lib/intl-utils';
import { salesSpaceCardPricing, salesSpaceStatusBadge } from '@/components/sales/shared/sales-space-page';
import type { ParkingSpot } from '@/types/parking';
import '@/lib/design-system';

// =============================================================================
// 🏢 TYPES
// =============================================================================

interface SalesParkingCardProps {
  spot: ParkingSpot;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  compact?: boolean;
  className?: string;
}

// =============================================================================
// 🏢 COMPONENT
// =============================================================================

export function SalesParkingCard({
  spot,
  isSelected = false,
  onSelect,
  compact = true,
  className,
}: SalesParkingCardProps) {
  const { t } = useTranslation(COMMON_NAMESPACES);

  const status = spot.status ?? 'available';

  // Το χρώμα μιας κατάστασης είναι κοινό και για τους δύο χώρους — δες
  // `sales-space-page`. Ήταν γραμμένο δύο φορές και μπορούσε να αποκλίνει.
  const badges = useMemo(
    () => [salesSpaceStatusBadge('parking', status, t)],
    [t, status],
  );

  // ADR-777 Α6 — the ONE shared pricing helper, so this card and the parking
  // detail panel cannot disagree about the same unit.
  const { price } = salesSpaceCardPricing(spot);
  const area = spot.area ?? 0;

  const stats = useMemo(() => {
    const items = [
      {
        icon: Car,
        iconColor: 'text-primary',
        label: t('parking:general.fields.type'),
        value: t(`parking:types.${spot.type ?? 'standard'}`, { defaultValue: spot.type ?? 'standard' }),
      },
      {
        icon: MapPin,
        iconColor: 'text-[hsl(var(--text-warning))]',
        label: t('parking:general.fields.locationZone'),
        value: spot.locationZone
          ? t(`parking:locationZone.${spot.locationZone}`, { defaultValue: spot.locationZone })
          : '—',
      },
      {
        icon: DollarSign,
        iconColor: 'text-[hsl(var(--text-success))]',
        label: t('parking:general.fields.price'),
        value: formatCurrencyWhole(price),
      },
    ];

    if (area > 0) {
      items.push({
        icon: Calculator,
        iconColor: 'text-primary',
        label: t('parking:general.fields.area'),
        value: `${area} m²`,
      });
    }

    return items;
  }, [t, spot.type, spot.locationZone, price, area]);

  return (
    <ListCard
      title={spot.number || spot.id}
      subtitle={spot.floor ? `${t('parking:general.fields.floor')}: ${spot.floor}` : undefined}
      badges={badges}
      stats={stats}
      compact={compact}
      hideIcon
      inlineBadges
      hoverVariant="standard"
      isSelected={isSelected}
      onClick={() => onSelect?.(spot.id)}
      role="option"
      entityType="parking"
      className={className}
    />
  );
}
