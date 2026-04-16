'use client';

/**
 * =============================================================================
 * 🏢 ENTERPRISE: Price Plausibility Warning (Google-style sanity check)
 * =============================================================================
 *
 * Inline non-blocking warning όταν ο χρήστης εισάγει asking price που είναι
 * εκτός εύλογου εύρους αγοράς για τον τύπο ακινήτου + την εμπορική κατάσταση.
 *
 * **Pattern**: "sanity check / plausibility warning" — ΠΟΤΕ δεν μπλοκάρει το
 * save. Ο χρήστης μπορεί να έχει legitimate reason (test data, edge case,
 * κρυφή συμφωνία). Το warning είναι UX hint για να πιάσει typos.
 *
 * **Three verdicts surfaced** (από `assessPricePlausibility()`):
 *   - `hardFloor` — απόλυτα σίγουρο typo (π.χ. 1€ για διαμέρισμα)
 *   - `suspiciousLow` — €/τ.μ. χαμηλότερο από το τυπικό market band
 *   - `suspiciousHigh` — €/τ.μ. υψηλότερο από το τυπικό market band
 *
 * **SSoT**: Όλη η λογική + ranges βρίσκονται στο `@/constants/price-plausibility`.
 * Το component είναι pure render layer — καμία επιχειρηματική λογική εδώ.
 *
 * @module components/properties/shared/PricePlausibilityWarning
 * @enterprise ADR-287 — Enum SSoT Centralization (Batch 17)
 */

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import {
  assessPricePlausibility,
  isActionableVerdict,
  type AssessPricePlausibilityArgs,
} from '@/constants/price-plausibility';

interface PricePlausibilityWarningProps
  extends AssessPricePlausibilityArgs {
  /** Επιπλέον className για fine-tuning spacing από το parent. */
  readonly className?: string;
}

function formatSqmPrice(value: number): string {
  return value.toLocaleString('el-GR', { maximumFractionDigits: 0 });
}

function formatTotal(value: number): string {
  return value.toLocaleString('el-GR', { maximumFractionDigits: 0 });
}

export function PricePlausibilityWarning({
  commercialStatus,
  propertyType,
  askingPrice,
  grossArea,
  className,
}: PricePlausibilityWarningProps) {
  const { t } = useTranslation(['properties', 'properties-detail']);
  const iconSizes = useIconSizes();

  const assessment = assessPricePlausibility({
    commercialStatus,
    propertyType,
    askingPrice,
    grossArea,
  });

  if (!isActionableVerdict(assessment.verdict)) return null;

  const titleKey = `alerts.pricePlausibility.${assessment.verdict}.title`;
  const descriptionKey = `alerts.pricePlausibility.${assessment.verdict}.description`;

  const interpolation = assessment.expected
    ? {
        min: formatSqmPrice(assessment.expected.minPerSqm),
        max: formatSqmPrice(assessment.expected.maxPerSqm),
        absoluteFloor: formatTotal(assessment.expected.absoluteFloor),
        pricePerSqm:
          assessment.pricePerSqm !== null
            ? formatSqmPrice(assessment.pricePerSqm)
            : '',
      }
    : {};

  return (
    <Alert
      className={cn(
        'border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-700',
        className,
      )}
    >
      <AlertTriangle className={iconSizes.sm} />
      <AlertTitle>{t(titleKey)}</AlertTitle>
      <AlertDescription>{t(descriptionKey, interpolation)}</AlertDescription>
    </Alert>
  );
}
