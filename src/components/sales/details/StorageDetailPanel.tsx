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
import type { Storage } from '@/types/storage/contracts';

// =============================================================================
// 🏢 TYPES
// =============================================================================

interface StorageDetailPanelProps {
  data?: Storage;
}

// =============================================================================
// 🏢 HELPERS
// =============================================================================

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
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

  const infoRows: Array<{ icon: React.ElementType; label: string; value: string }> = [
    { icon: Layers, label: t('storage:general.fields.type', { defaultValue: 'Τύπος' }), value: t(`storage:types.${data.type}`, { defaultValue: data.type }) },
    { icon: Building2, label: t('storage:general.fields.building', { defaultValue: 'Κτίριο' }), value: data.building || '—' },
    { icon: MapPin, label: t('storage:general.fields.floor', { defaultValue: 'Όροφος' }), value: data.floor || '—' },
    { icon: Maximize2, label: t('storage:general.fields.area', { defaultValue: 'Εμβαδόν' }), value: area > 0 ? `${area} m²` : '—' },
  ];

  if (data.millesimalShares != null && data.millesimalShares > 0) {
    infoRows.push({
      icon: Hash,
      label: t('salesStorage.details.millesimalShares', { defaultValue: 'Χιλιοστά' }),
      value: `${data.millesimalShares}‰`,
    });
  }

  return (
    <section className="space-y-3 p-3">
      {/* Basic Info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Layers className={iconSizes.sm} />
            {t('storage:general.basicInfo', { defaultValue: 'Βασικές Πληροφορίες' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {infoRows.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Icon className={iconSizes.xs} />
                {label}
              </span>
              <span className="font-medium">{value}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Financial Info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <DollarSign className={iconSizes.sm} />
            {t('storage:general.financial', { defaultValue: 'Οικονομικά Στοιχεία' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('storage:general.fields.price', { defaultValue: 'Τιμή' })}</span>
            <span className="font-bold text-green-600">{formatCurrency(price > 0 ? price : null)}</span>
          </div>
          {pricePerSqm && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t('storage:general.fields.pricePerSqm', { defaultValue: '€/m²' })}</span>
              <span className="font-medium">{formatCurrency(pricePerSqm)}/m²</span>
            </div>
          )}
          {data.commercial?.finalPrice && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t('salesStorage.details.finalPrice', { defaultValue: 'Τελική Τιμή' })}</span>
              <span className="font-bold text-blue-600">{formatCurrency(data.commercial.finalPrice)}</span>
            </div>
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
