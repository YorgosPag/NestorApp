'use client';

/**
 * =============================================================================
 * 🏢 ENTERPRISE: Orientation Plausibility Warning
 * =============================================================================
 *
 * Inline non-blocking warning όταν ο συνδυασμός `propertyType` + orientations
 * δεν συνάδει με τον ορισμό του τύπου (residential χωρίς orientation, εμπορικός
 * με 5 προσανατολισμούς, και οι 8 σε non-standalone).
 *
 * **Pattern**: sanity check / plausibility — ΠΟΤΕ δεν μπλοκάρει το save.
 * **SSoT**: Όλη η λογική στο `@/constants/orientation-plausibility`.
 * **Pure render** — καμία επιχειρηματική λογική.
 *
 * @module components/properties/shared/OrientationPlausibilityWarning
 * @enterprise ADR-287 — Enum SSoT Centralization (Batch 24)
 */

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import {
  assessOrientationPlausibility,
  isActionableOrientationVerdict,
  type AssessOrientationPlausibilityArgs,
  type OrientationReason,
} from '@/constants/orientation-plausibility';
import { PROPERTY_TYPE_I18N_KEYS } from '@/constants/property-types';

interface OrientationPlausibilityWarningProps
  extends AssessOrientationPlausibilityArgs {
  readonly className?: string;
}

function reasonKey(reason: OrientationReason): string {
  switch (reason) {
    case 'missingResidential':
      return 'alerts.orientationPlausibility.reasons.missingResidential';
    case 'tooMany':
      return 'alerts.orientationPlausibility.reasons.tooMany';
    case 'allEightNonStandalone':
      return 'alerts.orientationPlausibility.reasons.allEightNonStandalone';
    case 'commercialAllDirections':
      return 'alerts.orientationPlausibility.reasons.commercialAllDirections';
    default:
      return '';
  }
}

export function OrientationPlausibilityWarning({
  propertyType,
  orientations,
  className,
}: OrientationPlausibilityWarningProps) {
  const { t } = useTranslation(['properties']);
  const iconSizes = useIconSizes();

  const assessment = assessOrientationPlausibility({ propertyType, orientations });

  if (!isActionableOrientationVerdict(assessment.verdict)) return null;

  const titleKey = `alerts.orientationPlausibility.${assessment.verdict}.title`;
  const typeLabel =
    assessment.propertyType !== null
      ? t(PROPERTY_TYPE_I18N_KEYS[assessment.propertyType])
      : '';

  const reasonTemplate = reasonKey(assessment.reason);
  const reasonText = reasonTemplate
    ? t(reasonTemplate, { type: typeLabel, count: assessment.count })
    : '';

  return (
    <Alert
      className={cn(
        'border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-700',
        className,
      )}
    >
      <AlertTriangle className={iconSizes.sm} />
      <AlertTitle>{t(titleKey)}</AlertTitle>
      <AlertDescription>{reasonText}</AlertDescription>
    </Alert>
  );
}
