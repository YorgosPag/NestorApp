'use client';

/**
 * =============================================================================
 * 🏢 ENTERPRISE: Condition Plausibility Warning
 * =============================================================================
 *
 * Inline non-blocking warning όταν ο συνδυασμός `condition` + `operationalStatus`
 * + `heatingType` + `energyClass` αντιφάσκει (π.χ. "νέο" χωρίς θέρμανση,
 * "χρήζει ανακαίνισης" + "έτοιμο", "νέο" + κλάση F).
 *
 * **Pattern**: sanity check / plausibility — ΠΟΤΕ δεν μπλοκάρει το save.
 * **SSoT**: Όλη η λογική στο `@/constants/condition-plausibility`.
 * **Pure render**.
 *
 * @module components/properties/shared/ConditionPlausibilityWarning
 * @enterprise ADR-287 — Enum SSoT Centralization (Batch 25)
 */

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import {
  assessConditionPlausibility,
  isActionableConditionVerdict,
  type AssessConditionPlausibilityArgs,
  type ConditionReason,
} from '@/constants/condition-plausibility';
import {
  PROPERTY_TYPE_I18N_KEYS,
  type PropertyTypeCanonical,
} from '@/constants/property-types';

interface ConditionPlausibilityWarningProps
  extends AssessConditionPlausibilityArgs {
  readonly className?: string;
}

function reasonKey(reason: ConditionReason): string {
  switch (reason) {
    case 'newWithoutHeating':
      return 'alerts.conditionPlausibility.reasons.newWithoutHeating';
    case 'needsRenovationButReady':
      return 'alerts.conditionPlausibility.reasons.needsRenovationButReady';
    case 'newButLowEnergy':
      return 'alerts.conditionPlausibility.reasons.newButLowEnergy';
    case 'needsRenovationHighEnergy':
      return 'alerts.conditionPlausibility.reasons.needsRenovationHighEnergy';
    case 'conditionMissingResidential':
      return 'alerts.conditionPlausibility.reasons.conditionMissingResidential';
    case 'energyClassMissingResidential':
      return 'alerts.conditionPlausibility.reasons.energyClassMissingResidential';
    default:
      return '';
  }
}

export function ConditionPlausibilityWarning({
  propertyType,
  condition,
  operationalStatus,
  heatingType,
  energyClass,
  className,
}: ConditionPlausibilityWarningProps) {
  const { t } = useTranslation(['properties']);
  const iconSizes = useIconSizes();

  const assessment = assessConditionPlausibility({
    propertyType,
    condition,
    operationalStatus,
    heatingType,
    energyClass,
  });

  if (!isActionableConditionVerdict(assessment.verdict)) return null;

  const titleKey = `alerts.conditionPlausibility.${assessment.verdict}.title`;
  const typeKey =
    assessment.propertyType !== null &&
    assessment.propertyType in PROPERTY_TYPE_I18N_KEYS
      ? PROPERTY_TYPE_I18N_KEYS[assessment.propertyType as PropertyTypeCanonical]
      : '';
  const typeLabel = typeKey ? t(typeKey) : '';
  const reasonTemplate = reasonKey(assessment.reason);
  const reasonText = reasonTemplate
    ? t(reasonTemplate, {
        type: typeLabel,
        condition: assessment.condition ?? '',
        operationalStatus: assessment.operationalStatus ?? '',
        heatingType: assessment.heatingType ?? '',
        energyClass: assessment.energyClass ?? '',
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
