'use client';

/**
 * 🏢 ENTERPRISE AGREEMENT GRID CARD - Domain Component
 *
 * Grid card for framework agreements. Shared status derivation comes from
 * useAgreementCardCommon (ADR-585); this wrapper owns the Grid StatItems.
 *
 * @fileoverview Agreement domain card using centralized GridCard.
 * @see GridCard for base component
 * @see AgreementListCard for list view equivalent
 * @see useAgreementCardCommon for the shared model (ADR-585)
 */

import React, { useMemo } from 'react';
import { ScrollText, Calendar, DollarSign, Percent, Building2 } from 'lucide-react';

import { GridCard } from '@/design-system';
import type { StatItem } from '@/design-system';

import { formatCurrency, formatDate } from '@/lib/intl-formatting';

import type { FrameworkAgreement } from '@/subapps/procurement/types/framework-agreement';

import { useAgreementCardCommon } from './agreement-card-model';

export interface AgreementGridCardProps {
  agreement: FrameworkAgreement;
  vendorName?: string | null;
  isSelected?: boolean;
  onSelect?: () => void;
  compact?: boolean;
  className?: string;
}

export function AgreementGridCard({
  agreement,
  vendorName,
  isSelected = false,
  onSelect,
  compact = false,
  className,
}: AgreementGridCardProps) {
  const { t, badges, ariaLabel } = useAgreementCardCommon(agreement);

  const stats = useMemo<StatItem[]>(() => {
    const items: StatItem[] = [];
    if (vendorName) {
      items.push({
        icon: Building2,
        iconColor: 'text-[hsl(var(--text-success))]',
        label: t('hub.frameworkAgreements.detail.vendor'),
        value: vendorName,
      });
    }
    items.push({
      icon: Calendar,
      iconColor: 'text-primary',
      label: t('hub.frameworkAgreements.validUntil'),
      value: formatDate(agreement.validUntil.toDate()),
    });
    if (agreement.totalCommitment !== null) {
      items.push({
        icon: DollarSign,
        iconColor: 'text-[hsl(var(--text-success))]',
        label: t('hub.frameworkAgreements.totalCommitment'),
        value: formatCurrency(agreement.totalCommitment),
      });
    }
    if (agreement.discountType === 'flat' && agreement.flatDiscountPercent !== null) {
      items.push({
        icon: Percent,
        iconColor: 'text-[hsl(var(--text-warning))]',
        label: t('hub.frameworkAgreements.discount.label'),
        value: `${agreement.flatDiscountPercent}%`,
      });
    } else if (
      agreement.discountType === 'volume_breakpoints' &&
      agreement.volumeBreakpoints.length > 0
    ) {
      items.push({
        icon: Percent,
        iconColor: 'text-[hsl(var(--text-warning))]',
        label: t('hub.frameworkAgreements.discount.label'),
        value: t('hub.frameworkAgreements.discount.tiers', {
          count: agreement.volumeBreakpoints.length,
        }),
      });
    }
    return items;
  }, [agreement, vendorName, t]);

  return (
    <GridCard
      customIcon={ScrollText}
      customIconColor="text-primary"
      title={agreement.title}
      subtitle={agreement.agreementNumber}
      badges={badges}
      stats={stats}
      isSelected={isSelected}
      onClick={onSelect}
      compact={compact}
      className={className}
      aria-label={ariaLabel}
    />
  );
}

AgreementGridCard.displayName = 'AgreementGridCard';

export default AgreementGridCard;
