'use client';

/**
 * 🏢 ENTERPRISE AGREEMENT GRID CARD - Domain Component
 *
 * Domain-specific card for framework agreements in grid/tile views.
 * Extends GridCard with agreement-specific defaults: validity, commitment, discount type.
 *
 * @fileoverview Agreement domain card using centralized GridCard.
 * @see GridCard for base component
 * @see AgreementListCard for list view equivalent
 */

import React, { useMemo } from 'react';
import { ScrollText, Calendar, DollarSign, Percent, Building2 } from 'lucide-react';

import { GridCard } from '@/design-system';
import type { StatItem } from '@/design-system';
import type {
  GridCardBadge,
  GridCardBadgeVariant,
} from '@/design-system/components/GridCard/GridCard.types';

import { formatCurrency, formatDate } from '@/lib/intl-formatting';
import { useTranslation } from '@/i18n/hooks/useTranslation';

import type {
  FrameworkAgreement,
  FrameworkAgreementStatus,
} from '@/subapps/procurement/types/framework-agreement';

const STATUS_BADGE_VARIANTS: Record<FrameworkAgreementStatus, GridCardBadgeVariant> = {
  draft: 'secondary',
  active: 'success',
  expired: 'warning',
  terminated: 'destructive',
};

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
  const { t } = useTranslation('procurement');

  const statusLabel = t(`hub.frameworkAgreements.status.${agreement.status}`);

  const stats = useMemo<StatItem[]>(() => {
    const items: StatItem[] = [];
    if (vendorName) {
      items.push({
        icon: Building2,
        iconColor: 'text-green-600',
        label: t('hub.frameworkAgreements.detail.vendor'),
        value: vendorName,
      });
    }
    items.push({
      icon: Calendar,
      iconColor: 'text-blue-600',
      label: t('hub.frameworkAgreements.validUntil'),
      value: formatDate(agreement.validUntil.toDate()),
    });
    if (agreement.totalCommitment !== null) {
      items.push({
        icon: DollarSign,
        iconColor: 'text-emerald-600',
        label: t('hub.frameworkAgreements.totalCommitment'),
        value: formatCurrency(agreement.totalCommitment),
      });
    }
    if (agreement.discountType === 'flat' && agreement.flatDiscountPercent !== null) {
      items.push({
        icon: Percent,
        iconColor: 'text-amber-600',
        label: t('hub.frameworkAgreements.discount.label'),
        value: `${agreement.flatDiscountPercent}%`,
      });
    } else if (
      agreement.discountType === 'volume_breakpoints' &&
      agreement.volumeBreakpoints.length > 0
    ) {
      items.push({
        icon: Percent,
        iconColor: 'text-amber-600',
        label: t('hub.frameworkAgreements.discount.label'),
        value: t('hub.frameworkAgreements.discount.tiers', {
          count: agreement.volumeBreakpoints.length,
        }),
      });
    }
    return items;
  }, [agreement, vendorName, t]);

  const badges = useMemo<GridCardBadge[]>(
    () => [{ label: statusLabel, variant: STATUS_BADGE_VARIANTS[agreement.status] }],
    [statusLabel, agreement.status],
  );

  const subtitle = agreement.agreementNumber;

  return (
    <GridCard
      customIcon={ScrollText}
      customIconColor="text-purple-600"
      title={agreement.title}
      subtitle={subtitle}
      badges={badges}
      stats={stats}
      isSelected={isSelected}
      onClick={onSelect}
      compact={compact}
      className={className}
      aria-label={t('hub.frameworkAgreements.cardAriaLabel', {
        number: agreement.agreementNumber,
        title: agreement.title,
      })}
    />
  );
}

AgreementGridCard.displayName = 'AgreementGridCard';

export default AgreementGridCard;
