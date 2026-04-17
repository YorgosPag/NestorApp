/**
 * =============================================================================
 * 🏢 ENTERPRISE: Property Completion Meter (Google Profile-Strength Pattern)
 * =============================================================================
 *
 * Display component για completion meter. Wraps:
 *   - `usePropertyCompletion` (composition hook: assess + media + dismissal)
 *   - `<Progress>` (shadcn Radix Progress bar)
 *   - `<PropertyCompletionBreakdown>` (collapsible missing list)
 *
 * **Rendering guards**:
 *   - `operationalStatus === 'draft'` → null (shouldHide sentinel from assess)
 *   - Dismissed + not-expanded → 1-line undismiss link (Google pattern)
 *
 * **Color coding**: 3 buckets (red/amber/green) mapped σε design-system
 * semantic colors. No inline style.
 *
 * @module features/property-details/components/PropertyCompletionMeter
 * @enterprise ADR-287 Batch 28 — Completion Meter
 */

'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ChevronDown, ChevronUp, X, Gauge } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { cn } from '@/lib/utils';
import type { Property } from '@/types/property-viewer';
import type { PropertyLevel } from '@/types/property';
import type { PropertyFieldsFormData } from './property-fields-form-types';
import { usePropertyCompletion } from '@/hooks/properties/usePropertyCompletion';
import { PropertyCompletionBreakdown } from './PropertyCompletionBreakdown';
import type { CompletionBucket } from '@/constants/property-completion';

// =============================================================================
// PROPS
// =============================================================================

interface PropertyCompletionMeterProps {
  readonly property: Property;
  readonly formData: PropertyFieldsFormData;
  /** Active multi-level floors (ADR-236) — length used for floorplan scoring. */
  readonly effectiveLevels?: readonly PropertyLevel[];
}

// =============================================================================
// BUCKET → SEMANTIC COLOR RESOLVER
// =============================================================================

function resolveBucketTextClass(
  bucket: CompletionBucket,
  colors: ReturnType<typeof useSemanticColors>,
): string {
  switch (bucket) {
    case 'green':
      return colors.text.success;
    case 'amber':
      return colors.text.warning;
    case 'red':
    default:
      return colors.text.error;
  }
}

// =============================================================================
// COMPONENT
// =============================================================================

export function PropertyCompletionMeter({
  property,
  formData,
  effectiveLevels,
}: PropertyCompletionMeterProps) {
  const { t } = useTranslation(['properties']);
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();
  const spacing = useSpacingTokens();

  const levelCount = effectiveLevels?.length && effectiveLevels.length >= 1
    ? effectiveLevels.length
    : 1;

  const { assessment, isDismissed, setDismissed } = usePropertyCompletion({
    propertyId: property.id ?? null,
    formData,
    levelCount,
  });

  // Default expanded — Google My Business / LinkedIn "what's next" always-
  // visible coaching panel. User can collapse if distracting.
  const [expanded, setExpanded] = useState(true);

  // Note: `assessment.shouldHide` (draft) intentionally NOT used as render
  // gate — `buildFormDataFromProperty` defaults missing operationalStatus to
  // 'draft', which would hide the meter for most legacy records. Progressive-
  // disclosure theory conflicts here with practical UX: draft is exactly when
  // completion guidance matters most. The flag remains in the public API for
  // future consumers that can distinguish default vs explicit draft.

  // Dismissed + collapsed → render 1-line undismiss link (Google pattern)
  if (isDismissed && !expanded) {
    return (
      <section
        aria-label={t('completion.aria')}
        className="flex items-center justify-end"
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn('h-6 text-xs', spacing.padding.x.sm)}
          onClick={() => setDismissed(false)}
        >
          <Gauge className={cn(iconSizes.xs, spacing.margin.right.xs)} />
          {t('completion.reshow')}
        </Button>
      </section>
    );
  }

  const { percentage, bucketColor, missingCritical } = assessment;
  const textClass = resolveBucketTextClass(bucketColor, colors);
  const bucketLabelKey = `completion.bucket.${bucketColor}` as const;

  return (
    <section
      aria-label={t('completion.aria')}
      className={cn(
        // `shrink-0` critical: parent PropertyDetailsContent outer div is
        // `h-full flex flex-col` (inside ScrollArea). Default flex-shrink: 1
        // squeezes all children to share bounded height — meter would collapse
        // and scroll internally. `shrink-0` preserves natural height; overflow
        // is handled by the outer ScrollArea (Radix viewport).
        'w-full shrink-0 rounded-md border',
        spacing.padding.md,       // 16px outer card padding (Google card spec)
        spacing.spaceBetween.sm,  // 8px between header / progress / label / breakdown
        colors.border.default,
        colors.bg.secondary,
      )}
    >
      <header className={cn('flex items-center justify-between', spacing.gap.sm)}>
        <div className={cn('flex items-center', spacing.gap.sm)}>
          <Gauge className={cn(iconSizes.md, textClass)} aria-hidden="true" />
          <h3 className="text-base font-semibold">
            {t('completion.title')}
          </h3>
          <span
            className={cn('text-base font-bold tabular-nums', textClass)}
            aria-live="polite"
          >
            {percentage}%
          </span>
        </div>
        <div className={cn('flex items-center', spacing.gap.xs)}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn('h-7 text-xs', spacing.padding.x.sm)}
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            {expanded ? (
              <>
                <ChevronUp className={cn(iconSizes.xs, spacing.margin.right.xs)} />
                {t('completion.hideDetails')}
              </>
            ) : (
              <>
                <ChevronDown className={cn(iconSizes.xs, spacing.margin.right.xs)} />
                {t('completion.showDetails')}
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn('h-7 w-7', spacing.padding.none)}
            onClick={() => setDismissed(true)}
            aria-label={t('completion.dismiss')}
            title={t('completion.dismiss')}
          >
            <X className={iconSizes.xs} />
          </Button>
        </div>
      </header>

      <Progress value={percentage} className="h-3" />

      <p className={cn('text-sm font-medium', textClass)}>
        {t(bucketLabelKey, { count: missingCritical.length })}
      </p>

      {expanded && (
        <div className={cn(spacing.padding.top.sm, 'border-t border-[hsl(var(--border))]')}>
          <PropertyCompletionBreakdown assessment={assessment} />
        </div>
      )}
    </section>
  );
}
