'use client';

/**
 * =============================================================================
 * InsuranceClassBadge — Display badge for insurance class assignment
 * =============================================================================
 *
 * Shows "Κλ. 10" styled badge, or warning badge when no class assigned.
 *
 * @module components/projects/ika/components/InsuranceClassBadge
 * @enterprise ADR-090 — IKA/EFKA Labor Compliance System (Phase 3)
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface InsuranceClassBadgeProps {
  /** Insurance class number (null = not assigned) */
  classNumber: number | null;
  /** Imputed daily wage (optional, for tooltip) */
  imputedWage?: number | null;
}

export function InsuranceClassBadge({ classNumber, imputedWage }: InsuranceClassBadgeProps) {
  const { t } = useTranslation('projects');

  if (classNumber === null) {
    return (
      <Badge variant="warning">
        {t('ika.stampsTab.noInsuranceClass')}
      </Badge>
    );
  }

  const label = imputedWage
    ? `Κλ. ${classNumber} — €${imputedWage.toFixed(2)}`
    : `Κλ. ${classNumber}`;

  return (
    <Badge variant="info">
      {label}
    </Badge>
  );
}
