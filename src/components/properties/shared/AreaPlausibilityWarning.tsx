'use client';

/**
 * =============================================================================
 * 🏢 ENTERPRISE: Area (gross / net / balcony / terrace / garden) Plausibility
 * =============================================================================
 *
 * Inline non-blocking warning όταν ο συνδυασμός `propertyType` + area fields
 * δεν συνάδει με φυσική πραγματικότητα (net > gross), με τον ορισμό του τύπου
 * (ρετιρέ χωρίς outdoor), ή με τυπικά όρια αγοράς (στούντιο 500 τ.μ.).
 *
 * **Pattern**: "sanity check / plausibility warning" — ΠΟΤΕ δεν μπλοκάρει το
 * save. Ο χρήστης μπορεί να έχει legitimate reason (raw/unfinished unit,
 * μεταφορά κάλυψης, converted industrial loft). UX hint για να πιάσει typos
 * στο data entry των measurements.
 *
 * **Two verdicts surfaced** (από `assessAreaPlausibility()`):
 *   - `unusual` — atypical αλλά πιθανό
 *   - `implausible` — φυσικά αδύνατο ή contradicts type definition
 *
 * **Single-reason surfacing**: Εμφανίζουμε μόνο την πιο σοβαρή παραβίαση για
 * να αποφύγουμε alert fatigue. Η `reason` code διαλέγει localized message.
 *
 * **SSoT**: Όλη η λογική + rules βρίσκονται στο `@/constants/area-plausibility`.
 * Pure render layer — καμία επιχειρηματική λογική εδώ.
 *
 * @module components/properties/shared/AreaPlausibilityWarning
 * @enterprise ADR-287 — Enum SSoT Centralization (Batch 21)
 */

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import {
  assessAreaPlausibility,
  isActionableAreaVerdict,
  type AssessAreaPlausibilityArgs,
  type AreaReason,
} from '@/constants/area-plausibility';
import { PROPERTY_TYPE_I18N_KEYS } from '@/constants/property-types';

interface AreaPlausibilityWarningProps
  extends AssessAreaPlausibilityArgs {
  /** Επιπλέον className για fine-tuning spacing από το parent. */
  readonly className?: string;
}

function reasonKey(reason: AreaReason): string {
  switch (reason) {
    case 'netExceedsGross':
      return 'alerts.areaPlausibility.reasons.netExceedsGross';
    case 'netZeroWithGross':
      return 'alerts.areaPlausibility.reasons.netZeroWithGross';
    case 'grossBelowMin':
      return 'alerts.areaPlausibility.reasons.grossBelowMin';
    case 'luxuryNoOutdoor':
      return 'alerts.areaPlausibility.reasons.luxuryNoOutdoor';
    case 'grossAboveMax':
      return 'alerts.areaPlausibility.reasons.grossAboveMax';
    case 'netRatioTooLow':
      return 'alerts.areaPlausibility.reasons.netRatioTooLow';
    case 'netRatioTooHigh':
      return 'alerts.areaPlausibility.reasons.netRatioTooHigh';
    case 'netEqualsGross':
      return 'alerts.areaPlausibility.reasons.netEqualsGross';
    case 'noOutdoorResidential':
      return 'alerts.areaPlausibility.reasons.noOutdoorResidential';
    case 'gardenOnNonGround':
      return 'alerts.areaPlausibility.reasons.gardenOnNonGround';
    default:
      return '';
  }
}

function formatPercent(ratio: number | null): string {
  if (ratio === null || !Number.isFinite(ratio)) return '';
  return `${Math.round(ratio * 100)}%`;
}

export function AreaPlausibilityWarning({
  propertyType,
  gross,
  net,
  balcony,
  terrace,
  garden,
  className,
}: AreaPlausibilityWarningProps) {
  const { t } = useTranslation(['properties']);
  const iconSizes = useIconSizes();

  const assessment = assessAreaPlausibility({
    propertyType,
    gross,
    net,
    balcony,
    terrace,
    garden,
  });

  if (!isActionableAreaVerdict(assessment.verdict)) return null;

  const titleKey = `alerts.areaPlausibility.${assessment.verdict}.title`;
  const typeLabel =
    assessment.propertyType !== null
      ? t(PROPERTY_TYPE_I18N_KEYS[assessment.propertyType])
      : '';

  const reasonTemplate = reasonKey(assessment.reason);
  const reasonText = reasonTemplate
    ? t(reasonTemplate, {
        type: typeLabel,
        gross: assessment.gross ?? 0,
        net: assessment.net ?? 0,
        balcony: assessment.balcony ?? 0,
        terrace: assessment.terrace ?? 0,
        garden: assessment.garden ?? 0,
        ratio: formatPercent(assessment.ratio),
        min: assessment.rule?.grossHardMin ?? 0,
        max: assessment.rule?.grossTypicalMax ?? 0,
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
