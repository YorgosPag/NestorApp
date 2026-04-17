'use client';

/**
 * =============================================================================
 * 🏢 ENTERPRISE: Interior Features Plausibility Warning
 * =============================================================================
 *
 * Inline non-blocking warning όταν τα εσωτερικά χαρακτηριστικά αντιφάσκουν με
 * energy class, type, area, ή άλλα συστήματα/security (φωτοβολταϊκά + κλάση F,
 * τζάκι σε στούντιο 25 τ.μ., κλιματιστικό feature + coolingType set, alarm
 * δύο φορές, ενδοδαπέδια χωρίς κεντρικό σύστημα).
 *
 * **Pattern**: sanity check / plausibility — ΠΟΤΕ δεν μπλοκάρει το save.
 * **SSoT**: Όλη η λογική στο `@/constants/interior-features-plausibility`.
 * **Pure render**.
 *
 * @module components/properties/shared/InteriorFeaturesPlausibilityWarning
 * @enterprise ADR-287 — Enum SSoT Centralization (Batch 24)
 */

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import {
  assessInteriorFeaturesPlausibility,
  isActionableInteriorFeaturesVerdict,
  type AssessInteriorFeaturesPlausibilityArgs,
  type InteriorFeaturesReason,
} from '@/constants/interior-features-plausibility';
import { PROPERTY_TYPE_I18N_KEYS } from '@/constants/property-types';

interface InteriorFeaturesPlausibilityWarningProps
  extends AssessInteriorFeaturesPlausibilityArgs {
  readonly className?: string;
}

function reasonKey(reason: InteriorFeaturesReason): string {
  switch (reason) {
    case 'solarPanelsLowEnergy':
      return 'alerts.interiorFeaturesPlausibility.reasons.solarPanelsLowEnergy';
    case 'fireplaceTinyStudio':
      return 'alerts.interiorFeaturesPlausibility.reasons.fireplaceTinyStudio';
    case 'airConditioningRedundant':
      return 'alerts.interiorFeaturesPlausibility.reasons.airConditioningRedundant';
    case 'luxuryFeaturesStudio':
      return 'alerts.interiorFeaturesPlausibility.reasons.luxuryFeaturesStudio';
    case 'alarmSystemRedundant':
      return 'alerts.interiorFeaturesPlausibility.reasons.alarmSystemRedundant';
    case 'underfloorHeatingNoCentral':
      return 'alerts.interiorFeaturesPlausibility.reasons.underfloorHeatingNoCentral';
    default:
      return '';
  }
}

function coolingLabelKey(coolingType: string | null): string {
  if (!coolingType) return '';
  return `systems.cooling.${coolingType}`;
}

function heatingLabelKey(heatingType: string | null): string {
  if (!heatingType) return '';
  return `systems.heating.${heatingType}`;
}

function featureLabelKey(feature: string): string {
  return `features.interior.${feature}`;
}

export function InteriorFeaturesPlausibilityWarning({
  propertyType,
  interiorFeatures,
  securityFeatures,
  energyClass,
  heatingType,
  coolingType,
  areaGross,
  className,
}: InteriorFeaturesPlausibilityWarningProps) {
  const { t } = useTranslation(['properties']);
  const iconSizes = useIconSizes();

  const assessment = assessInteriorFeaturesPlausibility({
    propertyType,
    interiorFeatures,
    securityFeatures,
    energyClass,
    heatingType,
    coolingType,
    areaGross,
  });

  if (!isActionableInteriorFeaturesVerdict(assessment.verdict)) return null;

  const titleKey = `alerts.interiorFeaturesPlausibility.${assessment.verdict}.title`;
  const typeLabel =
    assessment.propertyType !== null
      ? t(PROPERTY_TYPE_I18N_KEYS[assessment.propertyType])
      : '';
  const coolingLabel = assessment.coolingType
    ? t(coolingLabelKey(assessment.coolingType))
    : '';
  const heatingLabel = assessment.heatingType
    ? t(heatingLabelKey(assessment.heatingType))
    : '';
  const luxuryLabels = assessment.luxuryFeatureList
    .map((f) => t(featureLabelKey(f)))
    .join(', ');

  const reasonTemplate = reasonKey(assessment.reason);
  const reasonText = reasonTemplate
    ? t(reasonTemplate, {
        type: typeLabel,
        energyClass: assessment.energyClass ?? '',
        cooling: coolingLabel,
        heating: heatingLabel,
        area: assessment.areaGross ?? 0,
        features: luxuryLabels,
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
