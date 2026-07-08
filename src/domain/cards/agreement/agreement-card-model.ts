'use client';

/**
 * 📜 FRAMEWORK AGREEMENT CARD — Shared Model (ADR-585)
 *
 * Shared status-badge derivation for AgreementGridCard + AgreementListCard
 * (Grid = StatItems, List = single-line subtitle + inline badge). Centralizes
 * the duplicated `STATUS_BADGE_VARIANTS` map + status label + badge assembly.
 *
 * @see ADR-585 Domain card view-model hook SSoT
 */

import { useMemo } from 'react';

import type { GridCardBadge, GridCardBadgeVariant } from '@/design-system/components/GridCard/GridCard.types';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { FrameworkAgreement, FrameworkAgreementStatus } from '@/subapps/procurement/types/framework-agreement';

/** Status → badge variant (GridCardBadgeVariant ⊂ ListCardBadgeVariant → both shells). */
export const AGREEMENT_STATUS_BADGE_VARIANTS: Record<FrameworkAgreementStatus, GridCardBadgeVariant> = {
  draft: 'secondary',
  active: 'success',
  expired: 'warning',
  terminated: 'destructive',
};

/**
 * Resolve the shared status label, badge, aria label + `t` for an agreement.
 */
export function useAgreementCardCommon(agreement: FrameworkAgreement) {
  const { t } = useTranslation('procurement');

  const statusLabel = t(`hub.frameworkAgreements.status.${agreement.status}`);

  const badges = useMemo<GridCardBadge[]>(
    () => [{ label: statusLabel, variant: AGREEMENT_STATUS_BADGE_VARIANTS[agreement.status] }],
    [statusLabel, agreement.status],
  );

  return {
    t,
    badges,
    ariaLabel: t('hub.frameworkAgreements.cardAriaLabel', {
      number: agreement.agreementNumber,
      title: agreement.title,
    }),
  };
}
