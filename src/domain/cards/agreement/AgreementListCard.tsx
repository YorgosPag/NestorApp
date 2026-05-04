'use client';

/**
 * 🏢 ENTERPRISE AGREEMENT LIST CARD - Domain Component
 *
 * Domain-specific card for framework agreements in list views.
 * Extends ListCard with agreement-specific defaults; single-line truncated subtitle
 * "AgreementNumber · Vendor · Validity" + inline status badge.
 *
 * @fileoverview Agreement domain card using centralized ListCard.
 * @see ListCard for base component
 */

import React, { useMemo } from 'react';
import { ScrollText } from 'lucide-react';

import { ListCard } from '@/design-system';
import type {
  ListCardBadge,
  ListCardBadgeVariant,
} from '@/design-system/components/ListCard/ListCard.types';

import { useTranslation } from '@/i18n/hooks/useTranslation';

import type {
  FrameworkAgreement,
  FrameworkAgreementStatus,
} from '@/subapps/procurement/types/framework-agreement';

const STATUS_BADGE_VARIANTS: Record<FrameworkAgreementStatus, ListCardBadgeVariant> = {
  draft: 'secondary',
  active: 'success',
  expired: 'warning',
  terminated: 'destructive',
};

export interface AgreementListCardProps {
  agreement: FrameworkAgreement;
  vendorName?: string | null;
  isSelected?: boolean;
  onSelect?: () => void;
  className?: string;
}

export function AgreementListCard({
  agreement,
  vendorName,
  isSelected = false,
  onSelect,
  className,
}: AgreementListCardProps) {
  const { t } = useTranslation('procurement');

  const statusLabel = t(`hub.frameworkAgreements.status.${agreement.status}`);

  const badges: ListCardBadge[] = useMemo(
    () => [{ label: statusLabel, variant: STATUS_BADGE_VARIANTS[agreement.status] }],
    [statusLabel, agreement.status],
  );

  const subtitle = useMemo(() => {
    const parts: string[] = [agreement.agreementNumber];
    if (vendorName) parts.push(vendorName);
    return parts.join(' · ');
  }, [agreement.agreementNumber, vendorName]);

  return (
    <ListCard
      customIcon={ScrollText}
      customIconColor="text-purple-600"
      title={agreement.title}
      subtitle={subtitle}
      badges={badges}
      inlineBadges
      isSelected={isSelected}
      onClick={onSelect}
      className={className}
      aria-label={t('hub.frameworkAgreements.cardAriaLabel', {
        number: agreement.agreementNumber,
        title: agreement.title,
      })}
    />
  );
}

AgreementListCard.displayName = 'AgreementListCard';

export default AgreementListCard;
