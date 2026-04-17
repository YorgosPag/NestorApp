'use client';

/**
 * =============================================================================
 * 🏢 ENTERPRISE: Systems (Heating + Cooling) Plausibility Warning
 * =============================================================================
 *
 * Inline non-blocking warning όταν ο συνδυασμός heating/cooling/type/area/
 * condition αντιφάσκει με ελληνικό κλίμα + ΚΕνΑΚ (residential χωρίς θέρμανση,
 * central-air σε στούντιο, νέα κατασκευή με heating=none, μεγάλη μονάδα χωρίς
 * ψύξη).
 *
 * **Pattern**: sanity check / plausibility — ΠΟΤΕ δεν μπλοκάρει το save.
 * **SSoT**: Όλη η λογική στο `@/constants/systems-plausibility`.
 * **Pure render**.
 *
 * @module components/properties/shared/SystemsPlausibilityWarning
 * @enterprise ADR-287 — Enum SSoT Centralization (Batch 25)
 */

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import {
  assessSystemsPlausibility,
  isActionableSystemsVerdict,
  type AssessSystemsPlausibilityArgs,
  type SystemsReason,
} from '@/constants/systems-plausibility';
import { PROPERTY_TYPE_I18N_KEYS } from '@/constants/property-types';

interface SystemsPlausibilityWarningProps
  extends AssessSystemsPlausibilityArgs {
  readonly className?: string;
}

function reasonKey(reason: SystemsReason): string {
  switch (reason) {
    case 'heatingNoneResidential':
      return 'alerts.systemsPlausibility.reasons.heatingNoneResidential';
    case 'heatingNoneNewBuild':
      return 'alerts.systemsPlausibility.reasons.heatingNoneNewBuild';
    case 'heatingMissingResidential':
      return 'alerts.systemsPlausibility.reasons.heatingMissingResidential';
    case 'coolingMissingResidential':
      return 'alerts.systemsPlausibility.reasons.coolingMissingResidential';
    case 'coolingOversizedTinyUnit':
      return 'alerts.systemsPlausibility.reasons.coolingOversizedTinyUnit';
    case 'coolingNoneLargeUnit':
      return 'alerts.systemsPlausibility.reasons.coolingNoneLargeUnit';
    default:
      return '';
  }
}

function coolingLabelKey(coolingType: string | null): string {
  if (!coolingType) return '';
  return `systems.cooling.${coolingType}`;
}

export function SystemsPlausibilityWarning({
  propertyType,
  heatingType,
  coolingType,
  condition,
  areaGross,
  operationalStatus,
  className,
}: SystemsPlausibilityWarningProps) {
  const { t } = useTranslation(['properties']);
  const iconSizes = useIconSizes();

  const assessment = assessSystemsPlausibility({
    propertyType,
    heatingType,
    coolingType,
    condition,
    areaGross,
    operationalStatus,
  });

  if (!isActionableSystemsVerdict(assessment.verdict)) return null;

  const titleKey = `alerts.systemsPlausibility.${assessment.verdict}.title`;
  const typeLabel =
    assessment.propertyType !== null
      ? t(PROPERTY_TYPE_I18N_KEYS[assessment.propertyType])
      : '';
  const coolingLabel = assessment.coolingType
    ? t(coolingLabelKey(assessment.coolingType))
    : '';

  const reasonTemplate = reasonKey(assessment.reason);
  const reasonText = reasonTemplate
    ? t(reasonTemplate, {
        type: typeLabel,
        cooling: coolingLabel,
        area: assessment.areaGross ?? 0,
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
