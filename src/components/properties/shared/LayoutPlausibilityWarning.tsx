'use client';

/**
 * =============================================================================
 * 🏢 ENTERPRISE: Layout (bedrooms / bathrooms / WC) Plausibility Warning
 * =============================================================================
 *
 * Inline non-blocking warning όταν ο συνδυασμός `propertyType` + bedrooms +
 * bathrooms + WC δεν συνάδει με τον ορισμό του τύπου — π.χ. "στούντιο" με 2
 * υπνοδωμάτια, "γκαρσονιέρα" με 0, διαμέρισμα χωρίς sanitary facilities,
 * κατάστημα με υπνοδωμάτιο.
 *
 * **Pattern**: "sanity check / plausibility warning" — ΠΟΤΕ δεν μπλοκάρει το
 * save. Ο χρήστης μπορεί να έχει legitimate reason (raw/unfinished unit,
 * loft industriale, mezzanine conversion). UX hint για να πιάσει errors στο
 * data entry.
 *
 * **Two verdicts surfaced** (από `assessLayoutPlausibility()`):
 *   - `unusual` — atypical αλλά πιθανό
 *   - `implausible` — contradicts type definition (studio with bedrooms κ.λπ.)
 *
 * **Single-reason surfacing**: Εμφανίζουμε μόνο την πιο σοβαρή παραβίαση για
 * να αποφύγουμε alert fatigue. Η `reason` code διαλέγει localized message.
 *
 * **SSoT**: Όλη η λογική + rules βρίσκονται στο `@/constants/layout-plausibility`.
 * Pure render layer — καμία επιχειρηματική λογική εδώ.
 *
 * @module components/properties/shared/LayoutPlausibilityWarning
 * @enterprise ADR-287 — Enum SSoT Centralization (Batch 20)
 */

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import {
  assessLayoutPlausibility,
  isActionableLayoutVerdict,
  type AssessLayoutPlausibilityArgs,
  type LayoutReason,
} from '@/constants/layout-plausibility';
import { PROPERTY_TYPE_I18N_KEYS } from '@/constants/property-types';

interface LayoutPlausibilityWarningProps
  extends AssessLayoutPlausibilityArgs {
  /** Επιπλέον className για fine-tuning spacing από το parent. */
  readonly className?: string;
}

function reasonKey(reason: LayoutReason): string {
  switch (reason) {
    case 'bedroomMismatch':
      return 'alerts.layoutPlausibility.reasons.bedroomMismatch';
    case 'bedroomAtypical':
      return 'alerts.layoutPlausibility.reasons.bedroomAtypical';
    case 'bedroomsForbidden':
      return 'alerts.layoutPlausibility.reasons.bedroomsForbidden';
    case 'noSanitary':
      return 'alerts.layoutPlausibility.reasons.noSanitary';
    case 'noDedicatedBathroom':
      return 'alerts.layoutPlausibility.reasons.noDedicatedBathroom';
    case 'noDedicatedWC':
      return 'alerts.layoutPlausibility.reasons.noDedicatedWC';
    default:
      return '';
  }
}

export function LayoutPlausibilityWarning({
  propertyType,
  bedrooms,
  bathrooms,
  wc,
  className,
}: LayoutPlausibilityWarningProps) {
  const { t } = useTranslation(['properties']);
  const iconSizes = useIconSizes();

  const assessment = assessLayoutPlausibility({
    propertyType,
    bedrooms,
    bathrooms,
    wc,
  });

  if (!isActionableLayoutVerdict(assessment.verdict)) return null;

  const titleKey = `alerts.layoutPlausibility.${assessment.verdict}.title`;
  const typeLabel =
    assessment.propertyType !== null
      ? t(PROPERTY_TYPE_I18N_KEYS[assessment.propertyType])
      : '';

  const reasonTemplate = reasonKey(assessment.reason);
  const reasonText = reasonTemplate
    ? t(reasonTemplate, {
        type: typeLabel,
        bedrooms: assessment.bedrooms ?? 0,
        bathrooms: assessment.bathrooms ?? 0,
        wc: assessment.wc ?? 0,
        min: assessment.rule?.bedroomMin ?? 0,
        max: assessment.rule?.bedroomMax ?? 0,
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
