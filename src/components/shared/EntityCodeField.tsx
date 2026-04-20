'use client';

/**
 * 🏢 ADR-233: Shared Entity Code Field Component
 *
 * Reusable field for entity code auto-suggestion with Popover info and validation feedback.
 * Used by: StorageGeneralTab, ParkingGeneralTab, AddStorageDialog, AddParkingDialog
 *
 * @module components/shared/EntityCodeField
 */

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useEntityCodeSuggestion } from '@/hooks/useEntityCodeSuggestion';
import { isValidEntityCodeFormat } from '@/services/entity-code.service';
import type { ParkingLocationZone } from '@/types/parking';
import type { PropertyType } from '@/types/property';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import '@/lib/design-system';

/** Minimal translation function type compatible with i18next TFunction */
type TranslationFn = {
  (key: string, defaultValue: string): string;
  (key: string, opts: Record<string, unknown>): string;
  (key: string): string;
};

// ============================================================================
// TYPES
// ============================================================================

interface EntityCodeFieldProps {
  /** Current code value */
  value: string;
  /** Called when user changes value (both manual and auto-applied) */
  onChange: (value: string) => void;
  /** Entity type for code suggestion */
  entityType: 'property' | 'storage' | 'parking';
  /** Building ID for code suggestion context */
  buildingId: string;
  /** Floor level for code suggestion context. Pass '' when floor not yet selected. */
  floorLevel: number | '';
  /** Property type (required for entityType='property') */
  propertyType?: PropertyType;
  /** Location zone (parking only) */
  locationZone?: ParkingLocationZone;
  /** Label text */
  label: string;
  /** Placeholder when no suggestion available */
  placeholderFallback: string;
  /** Example to show in Popover (ignored when infoContent is provided) */
  infoExample?: string;
  /** Custom Popover body content — replaces default infoExample paragraph */
  infoContent?: React.ReactNode;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Whether to show as compact (dialogs) vs full (detail forms) */
  variant?: 'form' | 'dialog';
  /**
   * Called when the auto-suggestion is applied (not on manual user input).
   * Use this to trigger side-effects like auto-save.
   */
  onAutoApply?: (code: string) => void;
  /**
   * Called whenever the internal suggestedCode value changes.
   * Allows parent orchestrators to keep a reference to the latest suggestion
   * for use in save payloads (e.g. as a fallback when formData.code is empty).
   */
  onSuggestionChange?: (suggestion: string | null) => void;
  /** @deprecated No longer needed — component uses its own useTranslation(['common', 'common-account', 'common-actions', 'common-empty-states', 'common-navigation', 'common-photos', 'common-sales', 'common-shared', 'common-status', 'common-validation']) */
  t?: TranslationFn;
}

interface EntityCodeFieldReturn {
  /** Whether the user has manually overridden the auto-suggested code */
  codeOverridden: boolean;
  /** The auto-suggested code (null if not yet available) */
  suggestedCode: string | null;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function EntityCodeField({
  value,
  onChange,
  entityType,
  buildingId,
  floorLevel,
  propertyType,
  locationZone,
  label,
  placeholderFallback,
  infoExample,
  infoContent,
  disabled = false,
  variant = 'form',
  onAutoApply,
  onSuggestionChange,
  t: _t,
}: EntityCodeFieldProps): React.JSX.Element {
  const { t: tc } = useTranslation(['common', 'common-account', 'common-actions', 'common-empty-states', 'common-navigation', 'common-photos', 'common-sales', 'common-shared', 'common-status', 'common-validation']);
  const colors = useSemanticColors();
  const [codeOverridden, setCodeOverridden] = useState(!!value);

  // Track the last code that was applied by auto-suggest (not manually typed).
  // Allows re-applying a new suggestion when building or floor changes,
  // as long as the user has not manually overridden the field.
  const lastAutoApplied = useRef<string | null>(value || null);

  // Track the disabled prop to detect transitions.
  const prevDisabledRef = useRef(disabled);

  const { suggestedCode, isLoading: codeLoading } = useEntityCodeSuggestion({
    entityType,
    buildingId,
    floorLevel,
    propertyType: propertyType || undefined,
    locationZone: locationZone || undefined,
    disabled: codeOverridden || disabled,
  });

  // When value is cleared externally (e.g. parent resets on building/floor/type change),
  // reset internal override state so the next suggestion is auto-applied.
  useEffect(() => {
    if (!value) {
      setCodeOverridden(false);
      lastAutoApplied.current = null;
    }
  }, [value]);

  // When the field transitions from disabled→enabled (entering edit mode) with an existing
  // code, lock in the current value. This prevents stale lastAutoApplied state from causing
  // the auto-suggest to silently override a persisted code on every edit session.
  useEffect(() => {
    const wasDisabled = prevDisabledRef.current;
    prevDisabledRef.current = disabled;
    if (wasDisabled && !disabled && value) {
      setCodeOverridden(true);
      lastAutoApplied.current = null;
    }
  }, [disabled, value]);

  // Propagate suggestion changes to parent orchestrators that need it for save payloads.
  useEffect(() => {
    onSuggestionChange?.(suggestedCode);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestedCode]);

  // Auto-populate when suggestion arrives:
  // - field is empty, OR
  // - field currently holds the previously auto-applied code (not manually typed)
  useEffect(() => {
    if (suggestedCode && !codeOverridden && (!value || value === lastAutoApplied.current)) {
      lastAutoApplied.current = suggestedCode;
      onChange(suggestedCode);
      onAutoApply?.(suggestedCode);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestedCode, codeOverridden]);

  const handleChange = (newValue: string) => {
    onChange(newValue);
    if (!codeOverridden && newValue !== suggestedCode) setCodeOverridden(true);
    if (!newValue) {
      setCodeOverridden(false);
      lastAutoApplied.current = null;
    }
  };

  const isForm = variant === 'form';
  const labelClassName = isForm
    ? cn(colors.text.muted, 'text-xs flex items-center gap-1')
    : 'text-sm font-medium flex items-center gap-1';

  return (
    <fieldset className={isForm ? 'space-y-1.5' : 'flex flex-col gap-1.5'}>
      {isForm ? (
        <Label className={labelClassName}>
          {label}
          <CodeInfoPopover infoExample={infoExample} infoContent={infoContent} />
        </Label>
      ) : (
        <span className={labelClassName}>
          {label}
          <CodeInfoPopover infoExample={infoExample} infoContent={infoContent} />
        </span>
      )}
      <Input
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={suggestedCode || placeholderFallback}
        className={isForm ? 'h-8 text-sm' : undefined}
        disabled={disabled}
      />
      {value && isValidEntityCodeFormat(value) && (
        <p className="text-[10px] text-emerald-600">
          {tc('entityCode.autoGenerated')}
        </p>
      )}
      {codeLoading && !disabled && (
        <p className={cn("text-[10px]", colors.text.muted)}>
          {tc('entityCode.loading')}
        </p>
      )}
      {suggestedCode && codeOverridden && value !== suggestedCode && !disabled && (
        <p className={cn("text-[10px]", colors.text.muted)}>
          {tc('entityCode.suggested', { code: suggestedCode })}
        </p>
      )}
      {value && !isValidEntityCodeFormat(value) && !disabled && (
        <p className="text-[10px] text-amber-600">
          {tc('entityCode.formatWarning')}
        </p>
      )}
    </fieldset>
  );
}

// ============================================================================
// SUB-COMPONENT: Popover
// ============================================================================

function CodeInfoPopover({
  infoExample,
  infoContent,
}: {
  infoExample?: string;
  infoContent?: React.ReactNode;
}) {
  const { t: tc } = useTranslation(['common', 'common-account', 'common-actions', 'common-empty-states', 'common-navigation', 'common-photos', 'common-sales', 'common-shared', 'common-status', 'common-validation']);
  const colors = useSemanticColors();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(colors.text.muted, "hover:text-foreground transition-colors")}
          aria-label="Info"
        >
          <Info className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 text-xs" side="right" align="start">
        {infoContent ?? (
          <>
            <h4 className="font-semibold mb-1">
              {tc('entityCode.infoTitle')}
            </h4>
            <p className={cn(colors.text.muted, "mb-1")}>
              {tc('entityCode.infoFormat')}
            </p>
            <p className={colors.text.muted}>{infoExample}</p>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

export type { EntityCodeFieldProps };
