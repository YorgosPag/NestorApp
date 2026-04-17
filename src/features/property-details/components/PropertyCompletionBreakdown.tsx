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

import React from 'react';
import { Button } from '@/components/ui/button';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type {
  CompletionAssessment,
  FieldKey,
} from '@/constants/property-completion';

// =============================================================================
// FIELD → CARD ANCHOR MAPPING
// =============================================================================

/**
 * Maps each scorable field-key to the card anchor ID μέσα στο property-details
 * info tab. Null means no in-tab anchor exists yet (media fields live in
 * dedicated tabs — V1 no-op on click).
 */
const FIELD_TO_CARD_ANCHOR: Record<FieldKey, string | null> = {
  type: null, // Lives in identity card — no anchor yet (V2 candidate)
  areaGross: null,
  areaNet: null,
  bedrooms: 'field-layout',
  bathrooms: 'field-layout',
  orientations: 'field-orientation',
  condition: 'field-condition-energy',
  energyClass: 'field-condition-energy',
  heatingType: 'field-systems',
  coolingType: 'field-systems',
  windowFrames: 'field-finishes',
  glazing: 'field-finishes',
  flooring: 'field-finishes',
  interiorFeatures: 'field-features',
  securityFeatures: 'field-features',
  floorplan: null, // Lives in dedicated Floorplan tab
  photos: null, // Lives in dedicated Photos tab
};

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

  const handleJump = (fieldKey: FieldKey) => {
    const anchor = FIELD_TO_CARD_ANCHOR[fieldKey];
    if (!anchor || typeof document === 'undefined') return;
    const element = document.getElementById(anchor);
    if (!element) return;
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Brief highlight — relies on CSS :target-like visual cue via focus
    if (element instanceof HTMLElement) {
      element.focus({ preventScroll: true });
    }
  };

  return (
    <div className="w-full space-y-2">
      <p className={cn('text-sm font-semibold', colors.text.secondary)}>
        {t('completion.breakdown.heading')}
      </p>
      <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-1.5 w-full">
        {missingEntries.map(({ fieldKey, weight, critical, status }) => {
          const anchor = FIELD_TO_CARD_ANCHOR[fieldKey];
          const weightLabelKey = resolveWeightLabelKey(weight);
          return (
            <li key={fieldKey} className="w-full">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!anchor}
                onClick={() => handleJump(fieldKey)}
                className="w-full justify-between h-9 px-2 text-sm"
              >
                <span className="flex items-center gap-2 min-w-0">
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
                <span className={cn('flex items-center gap-1 shrink-0', colors.text.muted)}>
                  <span className="text-[10px] uppercase tracking-wide">
                    {t(`completion.breakdown.${weightLabelKey}`)}
                  </span>
                  {anchor && <ChevronRight className="h-3 w-3" />}
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
