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
 * @enterprise ADR-287 — Enum SSoT Centralization (Batch 25)
 */

import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  PlausibilityAlert,
  plausibilityTypeLabel,
} from '@/components/properties/shared/PlausibilityAlert';
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
    case 'glazingMissingResidential':
      return 'alerts.finishesPlausibility.reasons.glazingMissingResidential';
    case 'flooringMissingResidential':
      return 'alerts.finishesPlausibility.reasons.flooringMissingResidential';
    case 'framesMissingResidential':
      return 'alerts.finishesPlausibility.reasons.framesMissingResidential';
    default:
      return '';
  }
}

function conditionLabelKey(condition: string | null): string {
  if (!condition) return '';
  return `condition.${condition}`;
}

export function FinishesPlausibilityWarning({
  propertyType,
  flooring,
  windowFrames,
  glazing,
  energyClass,
  condition,
  interiorFeatures,
  operationalStatus,
  className,
}: FinishesPlausibilityWarningProps) {
  const { t } = useTranslation(['properties']);

  const assessment = assessFinishesPlausibility({
    propertyType,
    flooring,
    windowFrames,
    glazing,
    energyClass,
    condition,
    interiorFeatures,
    operationalStatus,
  });

  if (!isActionableFinishesVerdict(assessment.verdict)) return null;

  const titleKey = `alerts.finishesPlausibility.${assessment.verdict}.title`;
  const conditionLabel = assessment.condition
    ? t(conditionLabelKey(assessment.condition))
    : '';
  // 🔑 Η ετικέτα του είδους ζει **σε ένα σημείο** — δες `PlausibilityAlert.tsx` για το
  //    γιατί (ADR-842 §7.6.12 · N.18: ο δίδυμος γεννήθηκε μέσα στην ίδια δέσμευση).
  const typeLabel = plausibilityTypeLabel(t, assessment.propertyType);

  const reasonTemplate = reasonKey(assessment.reason);
  const reasonText = reasonTemplate
    ? t(reasonTemplate, {
        energyClass: assessment.energyClass ?? '',
        condition: conditionLabel,
        type: typeLabel,
      })
    : '';

  return (
    <PlausibilityAlert
      titleKey={titleKey}
      reasonText={reasonText}
      t={t}
      className={className}
    />
  );
}
