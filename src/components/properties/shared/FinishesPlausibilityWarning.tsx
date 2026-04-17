'use client';

/**
 * =============================================================================
 * 🏢 ENTERPRISE: Finishes (Flooring + Frames + Glazing) Plausibility Warning
 * =============================================================================
 *
 * Inline non-blocking warning όταν τα φινιρίσματα δεν συνάδουν με ενεργειακή
 * κλάση, κατάσταση, ή interior features (μονό τζάμι + κλάση Α, μοκέτα +
 * ενδοδαπέδια θέρμανση, finished unit χωρίς δάπεδο/τζάμι).
 *
 * **Pattern**: sanity check / plausibility — ΠΟΤΕ δεν μπλοκάρει το save.
 * **SSoT**: Όλη η λογική στο `@/constants/finishes-plausibility`.
 * **Pure render**.
 *
 * @module components/properties/shared/FinishesPlausibilityWarning
 * @enterprise ADR-287 — Enum SSoT Centralization (Batch 24)
 */

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import {
  assessFinishesPlausibility,
  isActionableFinishesVerdict,
  type AssessFinishesPlausibilityArgs,
  type FinishesReason,
} from '@/constants/finishes-plausibility';

interface FinishesPlausibilityWarningProps
  extends AssessFinishesPlausibilityArgs {
  readonly className?: string;
}

function reasonKey(reason: FinishesReason): string {
  switch (reason) {
    case 'glazingSingleHighEnergy':
      return 'alerts.finishesPlausibility.reasons.glazingSingleHighEnergy';
    case 'glazingTripleLowEnergy':
      return 'alerts.finishesPlausibility.reasons.glazingTripleLowEnergy';
    case 'carpetWithUnderfloor':
      return 'alerts.finishesPlausibility.reasons.carpetWithUnderfloor';
    case 'flooringEmptyFinished':
      return 'alerts.finishesPlausibility.reasons.flooringEmptyFinished';
    case 'glazingMissingFinished':
      return 'alerts.finishesPlausibility.reasons.glazingMissingFinished';
    default:
      return '';
  }
}

function conditionLabelKey(condition: string | null): string {
  if (!condition) return '';
  return `condition.${condition}`;
}

export function FinishesPlausibilityWarning({
  flooring,
  windowFrames,
  glazing,
  energyClass,
  condition,
  interiorFeatures,
  className,
}: FinishesPlausibilityWarningProps) {
  const { t } = useTranslation(['properties']);
  const iconSizes = useIconSizes();

  const assessment = assessFinishesPlausibility({
    flooring,
    windowFrames,
    glazing,
    energyClass,
    condition,
    interiorFeatures,
  });

  if (!isActionableFinishesVerdict(assessment.verdict)) return null;

  const titleKey = `alerts.finishesPlausibility.${assessment.verdict}.title`;
  const conditionLabel = assessment.condition
    ? t(conditionLabelKey(assessment.condition))
    : '';

  const reasonTemplate = reasonKey(assessment.reason);
  const reasonText = reasonTemplate
    ? t(reasonTemplate, {
        energyClass: assessment.energyClass ?? '',
        condition: conditionLabel,
      })
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
