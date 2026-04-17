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
import { useTypography } from '@/hooks/useTypography';
import { useBorderTokens } from '@/hooks/useBorderTokens';
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

/**
 * Radix Progress renders the fill as a `<span>` child of the root. We use
 * Tailwind's arbitrary child selector to recolor that indicator based on
 * the bucket. All three colors are semantic design-system variables
 * (`--bg-success`, `--bg-warning`, `--bg-error`) — same SSoT pipe as
 * `colors.bg.*`, just wrapped in the child selector prefix.
 */
function resolveProgressIndicatorClass(bucket: CompletionBucket): string {
  switch (bucket) {
    case 'green':
      return '[&>span]:bg-[hsl(var(--bg-success))]';
    case 'amber':
      return '[&>span]:bg-[hsl(var(--bg-warning))]';
    case 'red':
    default:
      return '[&>span]:bg-[hsl(var(--bg-error))]';
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
  const typography = useTypography();
  const { radiusClass } = useBorderTokens();

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

  // Dismissed → render a prominent reshow banner (full-width, bordered).
  // Using a thin banner not a floating link — Giorgio feedback: meter
  // «scompare completamente» when dismissed. Banner keeps the control
  // visible so no page reload needed to reopen.
  if (isDismissed) {
    return (
      <section
        aria-label={t('completion.aria')}
        className={cn(
          'w-full shrink-0 border flex items-center justify-between',
          radiusClass.md,
          spacing.padding.sm,
          colors.border.default,
          colors.bg.secondary,
        )}
      >
        <span className={cn('flex items-center', colors.text.muted, spacing.gap.sm)}>
          <Gauge className={iconSizes.sm} aria-hidden="true" />
          <span className={typography.label.sm}>{t('completion.title')}</span>
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn('h-7', typography.label.simple, spacing.padding.x.sm, spacing.gap.sm)}
          onClick={() => setDismissed(false)}
        >
          {t('completion.reshow')}
        </Button>
      </section>
    );
  }

  const { percentage, bucketColor, missingCritical } = assessment;
  const textClass = resolveBucketTextClass(bucketColor, colors);
  const indicatorClass = resolveProgressIndicatorClass(bucketColor);
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
        'w-full shrink-0 border',
        radiusClass.md,           // rounded-md via SSoT border token
        spacing.padding.sm,       // 8px outer card padding — uniform SSoT
        spacing.spaceBetween.sm,  // 8px between header / progress / label / breakdown
        colors.border.default,
        colors.bg.secondary,
      )}
    >
      <header className={cn('flex items-center justify-between', spacing.gap.sm)}>
        <div className={cn('flex items-center', spacing.gap.sm)}>
          <Gauge className={cn(iconSizes.md, textClass)} aria-hidden="true" />
          <h3 className={typography.card.title}>
            {t('completion.title')}
          </h3>
          <span
            className={cn(typography.card.title, 'tabular-nums', textClass)}
            aria-live="polite"
          >
            {percentage}%
          </span>
        </div>
        <div className={cn('flex items-center', spacing.gap.sm)}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn('h-7', typography.label.simple, spacing.padding.x.sm, spacing.gap.sm)}
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            {expanded ? (
              <>
                <ChevronUp className={iconSizes.xs} />
                {t('completion.hideDetails')}
              </>
            ) : (
              <>
                <ChevronDown className={iconSizes.xs} />
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

      <Progress value={percentage} className={cn('h-3', indicatorClass)} />

      <p className={cn(typography.label.sm, textClass)}>
        {t(bucketLabelKey, { count: missingCritical.length })}
      </p>

      {expanded && (
        // No padding-top: outer `spaceBetween.sm` already gives the 8px gap
        // above the divider. Doubling here would produce 16px.
        <div className="border-t border-[hsl(var(--border))]">
          <PropertyCompletionBreakdown assessment={assessment} />
        </div>
      )}
    </section>
  );
}
