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
import { NO_PRICE_TOTAL } from '@/lib/listings/listing-price-label';
import { salesCardPricing } from '@/components/sales/shared/sales-space-page';
import { spaceStatusBadges } from '@/lib/units/unit-status-badges';
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
  // ADR-777 §8.60.20 — ξεχωριστό hook με ρητό namespace (ο CHECK 3.8 τα διαβάζει στατικά· πρότυπο ADR-744).
  const { t: tUnit } = useTranslation('properties-enums');

  // ADR-777 §8.60.20 — διάθεση (από το `commercialStatus`) + λειτουργική εξαίρεση, από το ΕΝΑ SSoT
  // των μονάδων. Ως τις 2026-09-18 διάβαζε το παλιό `status`: θέση πωλημένη μαζί με ακίνητο
  // εμφανιζόταν εδώ «Διαθέσιμη» — στη σελίδα ΠΩΛΗΣΕΩΝ.
  const badges = useMemo(() => spaceStatusBadges(spot, tUnit), [spot, tUnit]);

  // ADR-777 Α6 + §8.60.14.14 — the ONE shared pricing helper, with the UNIT written in:
  // «60 €/μήνα» for a space offered for rent, never a bare «60 €».
  const { price } = salesCardPricing(spot, t);
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
        value: price ?? NO_PRICE_TOTAL,
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
