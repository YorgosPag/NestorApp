'use client';

/**
 * @fileoverview Parking Detail Panel for Sales — ADR-199
 * @description Info tab content for parking in sales context
 * @pattern Mirrors SaleInfoContent with parking-specific fields
 */

import React from 'react';
import {
  DollarSign,
  Car,
  MapPin,
  Maximize2,
  Hash,
  Layers,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrencyWhole } from '@/lib/intl-utils';
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
  const { t } = useTranslation('common');
  const iconSizes = useIconSizes();

  if (!data) {
    return (
      <section className={cn("p-4 text-center text-sm", colors.text.muted)}>
        {t('salesParking.details.noSelection')}
      </section>
    );
  }

  const price = data.commercial?.askingPrice ?? data.price ?? 0;
  const area = data.area ?? 0;
  const pricePerSqm = price > 0 && area > 0 ? Math.round(price / area) : null;

  return (
    <section className="space-y-3 p-3">
      {/* Basic Info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Car className={`${iconSizes.sm} ${SALES_ICON_COLORS.basicInfoSection}`} />
            {t('parking:general.basicInfo')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <InfoRow icon={Car} iconColor={SALES_ICON_COLORS.type} label={t('parking:general.fields.type')} value={t(`parking:types.${data.type ?? 'standard'}`, { defaultValue: data.type ?? 'standard' })} />
          <InfoRow icon={MapPin} iconColor={SALES_ICON_COLORS.locationZone} label={t('parking:general.fields.locationZone')} value={data.locationZone ? t(`parking:locationZone.${data.locationZone}`, { defaultValue: data.locationZone }) : '—'} />
          <InfoRow icon={Layers} iconColor={SALES_ICON_COLORS.floor} label={t('parking:general.fields.floor')} value={data.floor || '—'} />
          {area > 0 && (
            <InfoRow icon={Maximize2} iconColor={SALES_ICON_COLORS.area} label={t('parking:general.fields.area')} value={`${area} m²`} />
          )}
          {data.millesimalShares != null && data.millesimalShares > 0 && (
            <InfoRow icon={Hash} iconColor={SALES_ICON_COLORS.millesimalShares} label={t('salesParking.details.millesimalShares')} value={`${data.millesimalShares}‰`} />
          )}
        </CardContent>
      </Card>

      {/* Financial Info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <DollarSign className={`${iconSizes.sm} ${SALES_ICON_COLORS.financialSection}`} />
            {t('parking:general.financial')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <InfoRow
            icon={DollarSign}
            iconColor={SALES_ICON_COLORS.askingPrice}
            label={t('parking:general.fields.price')}
            value={formatCurrencyWhole(price > 0 ? price : null)}
            valueColor={SALES_ICON_COLORS.askingPrice}
          />
          {pricePerSqm && (
            <InfoRow
              icon={DollarSign}
              iconColor={SALES_ICON_COLORS.pricePerSqm}
              label={t('parking:general.fields.pricePerSqm')}
              value={`${formatCurrencyWhole(pricePerSqm)}/m²`}
            />
          )}
          {data.commercial?.finalPrice && (
            <InfoRow
              icon={DollarSign}
              iconColor={SALES_ICON_COLORS.finalPrice}
              label={t('salesParking.details.finalPrice')}
              value={formatCurrencyWhole(data.commercial.finalPrice)}
              valueColor={SALES_ICON_COLORS.finalPrice}
            />
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      {data.notes && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              {t('parking:general.notes')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={cn("text-sm whitespace-pre-wrap", colors.text.muted)}>
              {data.notes}
            </p>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
