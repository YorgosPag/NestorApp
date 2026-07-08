'use client';

/**
 * 🏢 ENTERPRISE AGREEMENT LIST CARD - Domain Component
 *
 * List card for framework agreements; single-line truncated subtitle
 * "AgreementNumber · Vendor" + inline status badge. Shared status derivation
 * comes from useAgreementCardCommon (ADR-585).
 *
 * @fileoverview Agreement domain card using centralized ListCard.
 * @see ListCard for base component
 * @see useAgreementCardCommon for the shared model (ADR-585)
 */

import React, { useMemo } from 'react';
import { ScrollText } from 'lucide-react';

import { ListCard } from '@/design-system';

import type { FrameworkAgreement } from '@/subapps/procurement/types/framework-agreement';

import { useAgreementCardCommon } from './agreement-card-model';

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
  const { badges, ariaLabel } = useAgreementCardCommon(agreement);

  const subtitle = useMemo(() => {
    const parts: string[] = [agreement.agreementNumber];
    if (vendorName) parts.push(vendorName);
    return parts.join(' · ');
  }, [agreement.agreementNumber, vendorName]);

  return (
    <ListCard
      customIcon={ScrollText}
      customIconColor="text-primary"
      title={agreement.title}
      subtitle={subtitle}
      badges={badges}
      inlineBadges
      isSelected={isSelected}
      onClick={onSelect}
      className={className}
      aria-label={ariaLabel}
    />
  );
}

AgreementListCard.displayName = 'AgreementListCard';

export default AgreementListCard;
