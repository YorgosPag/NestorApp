'use client';
/**
 * 🏢 PropertyQuickView — Shared 2-column property info display
 *
 * Used in BOTH containers:
 * - "Επιλεγμένο Ακίνητο" (selected property, read-only)
 * - "Γρήγορη Προβολή" (hover preview)
 *
 * Same layout, same data, same appearance — SSoT.
 * @since ADR-258D
 */

import React from 'react';
import { Separator } from '@/components/ui/separator';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { PropertyHoverHeader } from './PropertyHoverHeader';
import { getPropertyStatusConfig } from '../constants';
import { formatFloorLabel } from '@/lib/intl-utils';
import { ORIENTATION_LABELS } from '@/constants/property-features-enterprise';
import type { OrientationType } from '@/types/property';
import type { Property } from '@/types/property-viewer';
import type { PropertyStatus } from '@/core/types/BadgeTypes';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import '@/lib/design-system';

interface PropertyQuickViewProps {
  property: Property;
}

/** Local compact row — label (left) + value (right), no icon. Different from shared InfoRow (has icon). */
function QuickViewRow({ label, value }: { label: string; value: React.ReactNode }) {
  const colors = useSemanticColors();
  if (!value && value !== 0) return null;
  return (
    <div className="flex justify-between gap-2 text-xs">
      <span className={`${colors.text.muted} shrink-0`}>{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

export function PropertyQuickView({ property }: PropertyQuickViewProps) {
  const { t } = useTranslation('properties');
  const { t: tUnits } = useTranslation('properties');
  const colors = useSemanticColors();
  const statusConfig = getPropertyStatusConfig();
  // 🏢 ADR-258: commercialStatus is SSoT, legacy status is fallback
  const effectiveStatus = property.commercialStatus ?? property.status;
  const statusInfo = statusConfig[effectiveStatus as keyof typeof statusConfig] || statusConfig['unknown'];

  const { areas, layout, orientations, linkedSpaces } = property;
  // 🏢 ENTERPRISE: Price from commercial.askingPrice (SSoT) → fallback to legacy price field
  const effectivePrice = property.commercial?.askingPrice ?? property.price ?? null;
  const parkingCount = linkedSpaces?.filter(s => s.spaceType === 'parking').length ?? 0;
  const storageCount = linkedSpaces?.filter(s => s.spaceType === 'storage').length ?? 0;
  const pricePerSqm = effectivePrice && property.area && property.area > 0
    ? Math.round(effectivePrice / property.area)
    : null;

  // Translate orientations using SSoT ORIENTATION_LABELS → i18n
  const translatedOrientations = orientations
    ?.map(o => {
      const key = ORIENTATION_LABELS[o as OrientationType];
      return key ? tUnits(key, { defaultValue: o }) : o;
    })
    .join(', ');

  return (
    <div className="space-y-1.5">
      {/* Header: Name + Code · Type · Building + Status badge */}
      <PropertyHoverHeader
        name={property.name}
        type={property.type}
        building={property.building}
        statusLabel={statusInfo.label}
        statusColor={statusInfo.color}
        status={effectiveStatus as PropertyStatus}
      />

      <Separator />

      {/* 2-column grid: labels (left) + values (right) */}
      <div className="space-y-0.5">
        <QuickViewRow label={formatFloorLabel(property.floor)} value="" />
        {property.area && (
          <QuickViewRow
            label={t('hoverInfo.gross')}
            value={`${property.area} m²`}
          />
        )}
        {areas?.net && (
          <QuickViewRow
            label={t('hoverInfo.net')}
            value={`${areas.net} m²`}
          />
        )}
        {areas?.balcony && (
          <QuickViewRow
            label={t('hoverInfo.balcony')}
            value={`${areas.balcony} m²`}
          />
        )}
        {areas?.terrace && (
          <QuickViewRow
            label={t('hoverInfo.terrace')}
            value={`${areas.terrace} m²`}
          />
        )}
        {areas?.garden && (
          <QuickViewRow
            label={t('hoverInfo.garden')}
            value={`${areas.garden} m²`}
          />
        )}
        {layout?.bedrooms !== undefined && (
          <QuickViewRow
            label={t('hoverInfo.bedroomsFull')}
            value={layout.bedrooms}
          />
        )}
        {layout?.bathrooms !== undefined && (
          <QuickViewRow
            label={t('hoverInfo.bathroomsFull')}
            value={layout.bathrooms}
          />
        )}
        {layout?.wc !== undefined && layout.wc > 0 && (
          <QuickViewRow label="WC" value={layout.wc} />
        )}
        {translatedOrientations && (
          <QuickViewRow
            label={t('hoverInfo.orientation')}
            value={translatedOrientations}
          />
        )}
        {parkingCount > 0 && (
          <QuickViewRow
            label={t('hoverInfo.parking')}
            value={parkingCount}
          />
        )}
        {storageCount > 0 && (
          <QuickViewRow
            label={t('hoverInfo.storageFull')}
            value={storageCount}
          />
        )}
        {effectivePrice && effectivePrice > 0 && (
          <>
            <Separator className="my-1" />
            <QuickViewRow
              label={t('hoverInfo.price')}
              value={
                <span className={`${COLOR_BRIDGE.text.price} font-semibold`}>
                  {effectivePrice.toLocaleString('el-GR')}€
                  {pricePerSqm && (
                    <span className={`${colors.text.muted} font-normal text-[10px]`}> ({pricePerSqm.toLocaleString('el-GR')}€/m²)</span>
                  )}
                </span>
              }
            />
          </>
        )}
      </div>
    </div>
  );
}
