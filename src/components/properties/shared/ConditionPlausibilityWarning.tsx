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

import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  PlausibilityAlert,
  plausibilityTypeLabel,
} from '@/components/properties/shared/PlausibilityAlert';
import {
  assessConditionPlausibility,
  isActionableConditionVerdict,
  type AssessConditionPlausibilityArgs,
  type ConditionReason,
} from '@/constants/condition-plausibility';

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

  const assessment = assessConditionPlausibility({
    propertyType,
    condition,
    operationalStatus,
    heatingType,
    energyClass,
  });

  if (!isActionableConditionVerdict(assessment.verdict)) return null;

  const titleKey = `alerts.conditionPlausibility.${assessment.verdict}.title`;
  // 🔑 Η ετικέτα του είδους ζει **σε ένα σημείο** — δες `PlausibilityAlert.tsx` για το
  //    γιατί (ADR-842 §7.6.12 · N.18: ο δίδυμος γεννήθηκε μέσα στην ίδια δέσμευση).
  const typeLabel = plausibilityTypeLabel(t, assessment.propertyType);
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
    <PlausibilityAlert
      titleKey={titleKey}
      reasonText={reasonText}
      t={t}
      className={className}
    />
  );
}
