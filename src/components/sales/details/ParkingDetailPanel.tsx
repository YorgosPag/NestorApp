'use client';

/**
 * @fileoverview Parking Detail Panel for Sales — ADR-199
 * @description Info tab content for parking in sales context
 * @pattern Mirrors SaleInfoContent with parking-specific fields
 */

import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';
import React from 'react';
import {
  Car,
  MapPin,
  Maximize2,
  Hash,
  Layers,
} from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { SalesSpaceFinancialCard } from './SalesSpaceFinancialCard';
import { SalesSpaceEmptyPanel, SalesSpaceSection } from './sales-space-panel-parts';
import { InfoRow } from '@/components/shared/InfoRow';
import { SALES_ICON_COLORS } from '@/components/sales/config/sales-colors';
import type { ParkingSpot } from '@/types/parking';
import '@/lib/design-system';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

// =============================================================================
// 🏢 TYPES
// =============================================================================

interface ParkingDetailPanelProps {
  data?: ParkingSpot;
}

// =============================================================================
// 🏢 COMPONENT
// =============================================================================

export function ParkingDetailPanel({ data }: ParkingDetailPanelProps) {
  const colors = useSemanticColors();
  const { t } = useTranslation(COMMON_NAMESPACES);

  if (!data) {
    return <SalesSpaceEmptyPanel message={t('salesParking.details.noSelection')} />;
  }

  const area = data.area ?? 0;

  return (
    <section className="space-y-3 p-3">
      {/* Basic Info */}
      <SalesSpaceSection icon={Car} title={t('parking:general.basicInfo')}>
        <InfoRow icon={Car} iconColor={SALES_ICON_COLORS.type} label={t('parking:general.fields.type')} value={t(`parking:types.${data.type ?? 'standard'}`, { defaultValue: data.type ?? 'standard' })} />
        <InfoRow icon={MapPin} iconColor={SALES_ICON_COLORS.locationZone} label={t('parking:general.fields.locationZone')} value={data.locationZone ? t(`parking:locationZone.${data.locationZone}`, { defaultValue: data.locationZone }) : '—'} />
        <InfoRow icon={Layers} iconColor={SALES_ICON_COLORS.floor} label={t('parking:general.fields.floor')} value={data.floor || '—'} />
        {area > 0 && (
          <InfoRow icon={Maximize2} iconColor={SALES_ICON_COLORS.area} label={t('parking:general.fields.area')} value={`${area} m²`} />
        )}
        {data.millesimalShares != null && data.millesimalShares > 0 && (
          <InfoRow icon={Hash} iconColor={SALES_ICON_COLORS.millesimalShares} label={t('salesParking.details.millesimalShares')} value={`${data.millesimalShares}‰`} />
        )}
      </SalesSpaceSection>

      {/* Financial Info — ΜΙΑ οικονομική κάρτα για στάθμευση ΚΑΙ αποθήκη */}
      <SalesSpaceFinancialCard
        item={data}
        labels={{
          section: t('parking:general.financial'),
          price: t('parking:general.fields.price'),
          pricePerSqm: t('parking:general.fields.pricePerSqm'),
          finalPrice: t('salesParking.details.finalPrice'),
        }}
      />

      {/* Notes */}
      {data.notes && (
        <SalesSpaceSection title={t('parking:general.notes')}>
          <p className={cn("text-sm whitespace-pre-wrap", colors.text.muted)}>
            {data.notes}
          </p>
        </SalesSpaceSection>
      )}
    </section>
  );
}
