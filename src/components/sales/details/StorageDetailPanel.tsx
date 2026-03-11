'use client';

/**
 * @fileoverview Storage Detail Panel for Sales — ADR-199
 * @description Info tab content for storage in sales context
 * @pattern Mirrors SaleInfoContent with storage-specific fields
 */

import React from 'react';
import {
  DollarSign,
  Layers,
  MapPin,
  Maximize2,
  Building2,
  Hash,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrencyWhole } from '@/lib/intl-utils';
import { InfoRow } from '@/components/shared/InfoRow';
import { SALES_ICON_COLORS } from '@/components/sales/config/sales-colors';
import type { Storage } from '@/types/storage/contracts';

// =============================================================================
// 🏢 TYPES
// =============================================================================

interface StorageDetailPanelProps {
  data?: Storage;
}

// =============================================================================
// 🏢 COMPONENT
// =============================================================================

export function StorageDetailPanel({ data }: StorageDetailPanelProps) {
  const { t } = useTranslation('common');
  const iconSizes = useIconSizes();

  if (!data) {
    return (
      <section className="p-4 text-center text-sm text-muted-foreground">
        {t('salesStorage.details.noSelection', { defaultValue: 'Επιλέξτε μια αποθήκη για λεπτομέρειες.' })}
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
            <Layers className={`${iconSizes.sm} ${SALES_ICON_COLORS.basicInfoSection}`} />
            {t('storage:general.basicInfo', { defaultValue: 'Βασικές Πληροφορίες' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <InfoRow icon={Layers} label={t('storage:general.fields.type', { defaultValue: 'Τύπος' })} value={t(`storage:types.${data.type}`, { defaultValue: data.type })} />
          <InfoRow icon={Building2} label={t('storage:general.fields.building', { defaultValue: 'Κτίριο' })} value={data.building || '—'} />
          <InfoRow icon={MapPin} label={t('storage:general.fields.floor', { defaultValue: 'Όροφος' })} value={data.floor || '—'} />
          <InfoRow icon={Maximize2} label={t('storage:general.fields.area', { defaultValue: 'Εμβαδόν' })} value={area > 0 ? `${area} m²` : '—'} />
          {data.millesimalShares != null && data.millesimalShares > 0 && (
            <InfoRow icon={Hash} label={t('salesStorage.details.millesimalShares', { defaultValue: 'Χιλιοστά' })} value={`${data.millesimalShares}‰`} />
          )}
        </CardContent>
      </Card>

      {/* Financial Info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <DollarSign className={`${iconSizes.sm} ${SALES_ICON_COLORS.financialSection}`} />
            {t('storage:general.financial', { defaultValue: 'Οικονομικά Στοιχεία' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <InfoRow
            icon={DollarSign}
            iconColor={SALES_ICON_COLORS.askingPrice}
            label={t('storage:general.fields.price', { defaultValue: 'Τιμή' })}
            value={formatCurrencyWhole(price > 0 ? price : null)}
            valueColor={SALES_ICON_COLORS.askingPrice}
          />
          {pricePerSqm && (
            <InfoRow
              icon={DollarSign}
              iconColor={SALES_ICON_COLORS.pricePerSqm}
              label={t('storage:general.fields.pricePerSqm', { defaultValue: '€/m²' })}
              value={`${formatCurrencyWhole(pricePerSqm)}/m²`}
            />
          )}
          {data.commercial?.finalPrice && (
            <InfoRow
              icon={DollarSign}
              iconColor={SALES_ICON_COLORS.finalPrice}
              label={t('salesStorage.details.finalPrice', { defaultValue: 'Τελική Τιμή' })}
              value={formatCurrencyWhole(data.commercial.finalPrice)}
              valueColor={SALES_ICON_COLORS.finalPrice}
            />
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      {(data.description || data.notes) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              {t('storage:general.descriptionNotes', { defaultValue: 'Περιγραφή & Σημειώσεις' })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {data.description || data.notes}
            </p>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
