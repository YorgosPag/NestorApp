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
  const { t } = useTranslation('common');
  const iconSizes = useIconSizes();

  if (!data) {
    return (
      <section className="p-4 text-center text-sm text-muted-foreground">
        {t('salesParking.details.noSelection', { defaultValue: 'Επιλέξτε μια θέση στάθμευσης για λεπτομέρειες.' })}
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
            {t('parking:general.basicInfo', { defaultValue: 'Βασικές Πληροφορίες' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <InfoRow icon={Car} label={t('parking:general.fields.type', { defaultValue: 'Τύπος' })} value={t(`parking:types.${data.type ?? 'standard'}`, { defaultValue: data.type ?? 'standard' })} />
          <InfoRow icon={MapPin} label={t('parking:general.fields.locationZone', { defaultValue: 'Ζώνη' })} value={data.locationZone ? t(`parking:locationZone.${data.locationZone}`, { defaultValue: data.locationZone }) : '—'} />
          <InfoRow icon={Layers} label={t('parking:general.fields.floor', { defaultValue: 'Επίπεδο' })} value={data.floor || '—'} />
          {area > 0 && (
            <InfoRow icon={Maximize2} label={t('parking:general.fields.area', { defaultValue: 'Εμβαδόν' })} value={`${area} m²`} />
          )}
          {data.millesimalShares != null && data.millesimalShares > 0 && (
            <InfoRow icon={Hash} label={t('salesParking.details.millesimalShares', { defaultValue: 'Χιλιοστά' })} value={`${data.millesimalShares}‰`} />
          )}
        </CardContent>
      </Card>

      {/* Financial Info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <DollarSign className={`${iconSizes.sm} ${SALES_ICON_COLORS.financialSection}`} />
            {t('parking:general.financial', { defaultValue: 'Οικονομικά Στοιχεία' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <InfoRow
            icon={DollarSign}
            iconColor={SALES_ICON_COLORS.askingPrice}
            label={t('parking:general.fields.price', { defaultValue: 'Τιμή' })}
            value={formatCurrencyWhole(price > 0 ? price : null)}
            valueColor={SALES_ICON_COLORS.askingPrice}
          />
          {pricePerSqm && (
            <InfoRow
              icon={DollarSign}
              iconColor={SALES_ICON_COLORS.pricePerSqm}
              label={t('parking:general.fields.pricePerSqm', { defaultValue: '€/m²' })}
              value={`${formatCurrencyWhole(pricePerSqm)}/m²`}
            />
          )}
          {data.commercial?.finalPrice && (
            <InfoRow
              icon={DollarSign}
              iconColor={SALES_ICON_COLORS.finalPrice}
              label={t('salesParking.details.finalPrice', { defaultValue: 'Τελική Τιμή' })}
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
              {t('parking:general.notes', { defaultValue: 'Σημειώσεις' })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {data.notes}
            </p>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
