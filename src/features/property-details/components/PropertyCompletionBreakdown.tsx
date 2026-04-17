/**
 * =============================================================================
 * 🏢 ENTERPRISE: Property Completion Breakdown (Collapsible Missing List)
 * =============================================================================
 *
 * Pure-render list component. Takes an already-computed
 * `CompletionAssessment` and displays the missing fields sorted by weight,
 * with click-to-jump buttons που scroll-άρουν στην card που αντιστοιχεί στο
 * field.
 *
 * **Click-to-jump mapping**: Static FIELD_KEY → card anchor ID. Cards add
 * `id="field-{anchor}"` in `PropertyFieldsDetailCards` + Row2. Media fields
 * (photos, floorplan) live σε άλλα tabs — V1 scroll silent no-op.
 *
 * @module features/property-details/components/PropertyCompletionBreakdown
 * @enterprise ADR-287 Batch 28 — Completion Meter
 */

'use client';

import React, { useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type {
  CompletionAssessment,
  FieldKey,
} from '@/constants/property-completion';

// =============================================================================
// HIGHLIGHT — temporary ring-pulse on jump target (Google Material Design cue)
// =============================================================================

const HIGHLIGHT_CLASSES: readonly string[] = [
  'ring-4',
  'ring-yellow-400',
  'ring-offset-2',
  'ring-offset-background',
  'transition-shadow',
  'duration-300',
];
const HIGHLIGHT_DURATION_MS = 2400;

// =============================================================================
// FIELD → CARD ANCHOR MAPPING
// =============================================================================

/**
 * Maps each scorable field-key to a jump target. Two shapes supported:
 *   - `card:{anchorId}` → scroll to the element with matching `id=` in the
 *     current info tab (PropertyFieldsDetailCards + Row2 cards).
 *   - `tab:{tabValue}`  → activate the Radix Tabs trigger with that value
 *     (photos, videos, floor-plan, etc). Used για media fields που ζουν
 *     σε άλλο tab.
 *   - `null`            → no jump target (silent no-op; button disabled).
 */
const FIELD_TO_JUMP_TARGET: Record<FieldKey, string | null> = {
  type: null, // Lives in identity card — no anchor yet (V2 candidate)
  areaGross: null,
  areaNet: null,
  bedrooms: 'card:field-layout',
  bathrooms: 'card:field-layout',
  orientations: 'card:field-orientation',
  condition: 'card:field-condition-energy',
  energyClass: 'card:field-condition-energy',
  heatingType: 'card:field-systems',
  coolingType: 'card:field-systems',
  windowFrames: 'card:field-finishes',
  glazing: 'card:field-finishes',
  flooring: 'card:field-finishes',
  interiorFeatures: 'card:field-features',
  securityFeatures: 'card:field-features',
  floorplan: 'tab:floor-plan', // Dedicated floorplan tab
  photos: 'tab:photos', // Dedicated photos tab
};

/**
 * Activate a Radix Tabs trigger by its `value`. Radix renders each trigger
 * with a generated id ending in `-trigger-{value}` — we locate it via
 * attribute-ends-with selector and dispatch a click. Falls back to no-op
 * if no matching trigger is found (e.g. tab disabled via config).
 */
function activateTab(tabValue: string): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const escaped = tabValue.replace(/"/g, '\\"');
  const trigger = document.querySelector<HTMLElement>(
    `[role="tab"][id$="-trigger-${escaped}"]`,
  );
  if (!trigger) return null;
  trigger.click();
  return trigger;
}

// =============================================================================
// PROPS
// =============================================================================

interface PropertyCompletionBreakdownProps {
  readonly assessment: CompletionAssessment;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function PropertyCompletionBreakdown({
  assessment,
}: PropertyCompletionBreakdownProps) {
  const { t } = useTranslation(['properties']);
  const colors = useSemanticColors();
  const spacing = useSpacingTokens();

  // Track active highlight so consecutive clicks clear the previous target
  // before applying the new one (no orphan rings if user clicks quickly).
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const highlightElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
      if (highlightElementRef.current) {
        highlightElementRef.current.classList.remove(...HIGHLIGHT_CLASSES);
      }
    };
  }, []);

  const missingEntries = assessment.breakdown
    .filter((b) => b.status === 'missing' || b.status === 'partial')
    .slice()
    .sort((a, b) => b.weight - a.weight);

  if (missingEntries.length === 0) {
    return (
      <p className={cn('text-xs italic', colors.text.muted)}>
        {t('completion.breakdown.allComplete')}
      </p>
    );
  }

  const clearPreviousHighlight = () => {
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = null;
    }
    if (highlightElementRef.current) {
      highlightElementRef.current.classList.remove(...HIGHLIGHT_CLASSES);
      highlightElementRef.current = null;
    }
  };

  const handleJump = (fieldKey: FieldKey) => {
    const target = FIELD_TO_JUMP_TARGET[fieldKey];
    if (!target || typeof document === 'undefined') return;

    clearPreviousHighlight();

    // Tab jump — activate the Radix Tabs trigger, then highlight it briefly.
    if (target.startsWith('tab:')) {
      const tabValue = target.slice('tab:'.length);
      const trigger = activateTab(tabValue);
      if (!trigger) return;
      trigger.classList.add(...HIGHLIGHT_CLASSES);
      highlightElementRef.current = trigger;
      highlightTimeoutRef.current = setTimeout(() => {
        trigger.classList.remove(...HIGHLIGHT_CLASSES);
        highlightElementRef.current = null;
        highlightTimeoutRef.current = null;
      }, HIGHLIGHT_DURATION_MS);
      return;
    }

    // Card jump — scroll to the card anchor in the info tab + pulse ring.
    if (target.startsWith('card:')) {
      const anchorId = target.slice('card:'.length);
      const element = document.getElementById(anchorId);
      if (!(element instanceof HTMLElement)) return;

      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add(...HIGHLIGHT_CLASSES);
      element.focus({ preventScroll: true });

      highlightElementRef.current = element;
      highlightTimeoutRef.current = setTimeout(() => {
        element.classList.remove(...HIGHLIGHT_CLASSES);
        highlightElementRef.current = null;
        highlightTimeoutRef.current = null;
      }, HIGHLIGHT_DURATION_MS);
    }
  };

  return (
    <div className={cn('w-full', spacing.spaceBetween.sm)}>
      <p className={cn('text-sm font-semibold', colors.text.secondary)}>
        {t('completion.breakdown.heading')}
      </p>
      <ul
        className={cn(
          'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 w-full',
          spacing.gap.sm,
        )}
      >
        {missingEntries.map(({ fieldKey, weight, critical, status }) => {
          const target = FIELD_TO_JUMP_TARGET[fieldKey];
          const weightLabelKey = resolveWeightLabelKey(weight);
          return (
            <li key={fieldKey} className="w-full">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!target}
                onClick={() => handleJump(fieldKey)}
                className={cn(
                  'w-full justify-between h-9 text-sm',
                  spacing.padding.x.sm,
                )}
              >
                <span className={cn('flex items-center min-w-0', spacing.gap.sm)}>
                  <span
                    className={cn(
                      'inline-block h-2 w-2 rounded-full shrink-0',
                      status === 'partial'
                        ? colors.bg.warning
                        : critical
                          ? colors.bg.error
                          : colors.bg.muted,
                    )}
                    aria-hidden="true"
                  />
                  <span className="truncate">{t(`completion.fields.${fieldKey}`)}</span>
                </span>
                <span
                  className={cn(
                    'flex items-center shrink-0',
                    spacing.gap.xs,
                    colors.text.muted,
                  )}
                >
                  <span className="text-[10px] uppercase tracking-wide">
                    {t(`completion.breakdown.${weightLabelKey}`)}
                  </span>
                  {target && <ChevronRight className="h-3 w-3" />}
                </span>
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function resolveWeightLabelKey(weight: number): 'weightCritical' | 'weightNormal' | 'weightOptional' {
  if (weight >= 2) return 'weightCritical';
  if (weight >= 1) return 'weightNormal';
  return 'weightOptional';
}
