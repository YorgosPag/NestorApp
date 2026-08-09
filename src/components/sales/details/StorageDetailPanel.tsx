'use client';

/**
 * @fileoverview Storage Detail Panel for Sales — ADR-199
 * @description Info tab content for storage in sales context
 * @pattern Mirrors SaleInfoContent with storage-specific fields
 */

import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';
import React from 'react';
import {
  Layers,
  MapPin,
  Maximize2,
  Building2,
  Hash,
} from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { SalesSpaceFinancialCard } from './SalesSpaceFinancialCard';
import { SalesSpaceEmptyPanel, SalesSpaceSection } from './sales-space-panel-parts';
import { InfoRow } from '@/components/shared/InfoRow';
import { SALES_ICON_COLORS } from '@/components/sales/config/sales-colors';
import type { Storage } from '@/types/storage/contracts';
import '@/lib/design-system';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

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
  const colors = useSemanticColors();
  const { t } = useTranslation(COMMON_NAMESPACES);

  if (!data) {
    return <SalesSpaceEmptyPanel message={t('salesStorage.details.noSelection')} />;
  }

  const area = data.area ?? 0;

  return (
    <section className="space-y-3 p-3">
      {/* Basic Info */}
      <SalesSpaceSection icon={Layers} title={t('storage:general.basicInfo')}>
        <InfoRow icon={Layers} iconColor={SALES_ICON_COLORS.type} label={t('storage:general.fields.type')} value={t(`storage:types.${data.type}`, { defaultValue: data.type })} />
        <InfoRow icon={Building2} iconColor={SALES_ICON_COLORS.building} label={t('storage:general.fields.building')} value={data.building || '—'} />
        <InfoRow icon={MapPin} iconColor={SALES_ICON_COLORS.floor} label={t('storage:general.fields.floor')} value={data.floor || '—'} />
        <InfoRow icon={Maximize2} iconColor={SALES_ICON_COLORS.area} label={t('storage:general.fields.area')} value={area > 0 ? `${area} m²` : '—'} />
        {data.millesimalShares != null && data.millesimalShares > 0 && (
          <InfoRow icon={Hash} iconColor={SALES_ICON_COLORS.millesimalShares} label={t('salesStorage.details.millesimalShares')} value={`${data.millesimalShares}‰`} />
        )}
      </SalesSpaceSection>

      {/* Financial Info — ΜΙΑ οικονομική κάρτα για στάθμευση ΚΑΙ αποθήκη */}
      <SalesSpaceFinancialCard
        item={data}
        labels={{
          section: t('storage:general.financial'),
          price: t('storage:general.fields.price'),
          pricePerSqm: t('storage:general.fields.pricePerSqm'),
          finalPrice: t('salesStorage.details.finalPrice'),
        }}
      />

      {/* Notes */}
      {(data.description || data.notes) && (
        <SalesSpaceSection title={t('storage:general.descriptionNotes')}>
          <p className={cn("text-sm whitespace-pre-wrap", colors.text.muted)}>
            {data.description || data.notes}
          </p>
        </SalesSpaceSection>
      )}
    </section>
  );
}
