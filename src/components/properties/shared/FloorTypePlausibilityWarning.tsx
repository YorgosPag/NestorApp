'use client';

/**
 * =============================================================================
 * 🏢 ENTERPRISE: Floor ↔ Property-Type Plausibility Warning
 * =============================================================================
 *
 * Inline non-blocking warning όταν ο συνδυασμός `propertyType` + `floor` είναι
 * ασυνήθιστος (unusual) ή εντελώς ασύμβατος (implausible) — π.χ. "ρετιρέ" σε
 * υπόγειο, "βίλα" σε 3ο όροφο.
 *
 * **Pattern**: "sanity check / plausibility warning" — ΠΟΤΕ δεν μπλοκάρει το
 * save. Ο χρήστης μπορεί να έχει legitimate reason (test data, edge case,
 * μετατροπή υπογείου σε κατοικία). UX hint για να πιάσει errors στο dropdown.
 *
 * **Two verdicts surfaced** (από `assessFloorTypePlausibility()`):
 *   - `unusual` — σπάνιος αλλά πιθανός συνδυασμός
 *   - `implausible` — σχεδόν σίγουρο error (π.χ. penthouse σε υπόγειο)
 *
 * **SSoT**: Όλη η λογική + matrix βρίσκονται στο `@/constants/floor-type-plausibility`.
 * Pure render layer — καμία επιχειρηματική λογική εδώ.
 *
 * @module components/properties/shared/FloorTypePlausibilityWarning
 * @enterprise ADR-287 — Enum SSoT Centralization (Batch 19)
 */

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import {
  assessFloorTypePlausibility,
  isActionableFloorVerdict,
  type AssessFloorTypePlausibilityArgs,
} from '@/constants/floor-type-plausibility';
import { PROPERTY_TYPE_I18N_KEYS } from '@/constants/property-types';

interface FloorTypePlausibilityWarningProps
  extends AssessFloorTypePlausibilityArgs {
  /** Επιπλέον className για fine-tuning spacing από το parent. */
  readonly className?: string;
}

export function FloorTypePlausibilityWarning({
  propertyType,
  floor,
  className,
}: FloorTypePlausibilityWarningProps) {
  const { t } = useTranslation(['properties']);
  const iconSizes = useIconSizes();

  const assessment = assessFloorTypePlausibility({ propertyType, floor });

  if (!isActionableFloorVerdict(assessment.verdict)) return null;

  const titleKey = `alerts.floorTypePlausibility.${assessment.verdict}.title`;
  const descriptionKey = `alerts.floorTypePlausibility.${assessment.verdict}.description`;

  const typeLabel =
    assessment.propertyType !== null
      ? t(PROPERTY_TYPE_I18N_KEYS[assessment.propertyType])
      : '';

  const bandKey = assessment.band
    ? t(`alerts.floorTypePlausibility.bands.${assessment.band}`)
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
      <AlertDescription>
        {t(descriptionKey, { type: typeLabel, band: bandKey })}
      </AlertDescription>
    </Alert>
  );
}
