'use client';

/**
 * useSpaceNameSuggestion — createMode auto-named space entities
 *
 * SSoT for the "derive the display name from type + area while the user has not
 * typed their own" behaviour that was copy-pasted across the Parking and Storage
 * general tabs (seed-on-mount + `nameManuallyChanged` ref + the two derived
 * handlers). Composes {@link useEntityNameSuggestion} (ADR-233), which owns the
 * actual "{typeLabel} {area} τ.μ." string format.
 *
 * The hook never owns the form state: the caller passes an `applyPatch` adapter
 * that merges a partial patch into its own concretely-typed state. That keeps
 * the hook generic over the entity's type union without casting through it.
 *
 * @module hooks/useSpaceNameSuggestion
 * @see ADR-233 — entity coding / naming system
 * @see ADR-588 §General tab — space tab de-duplication (Phase 2)
 */

import { useCallback, useEffect, useRef } from 'react';
import { useEntityNameSuggestion } from '@/hooks/useEntityNameSuggestion';
import type { SelectOption } from '@/components/shared/space-info/OptionSelectField';

// ============================================================================
// TYPES
// ============================================================================

/** The slice of a space form state this hook derives. */
export interface SuggestibleSpaceForm<TType extends string> {
  name: string;
  type: TType;
  /** Raw input string — parsed by `useEntityNameSuggestion`. */
  area: string;
}

/**
 * Merges a partial patch into the owner's form state. The owner supplies this
 * so the spread happens against its own concrete form type.
 */
export type SpaceFormPatchApplier<TType extends string> = (
  patch: (prev: SuggestibleSpaceForm<TType>) => Partial<SuggestibleSpaceForm<TType>>,
) => void;

interface UseSpaceNameSuggestionConfig<TType extends string> {
  /** Suggestions only apply while creating — an existing entity keeps its name. */
  createMode: boolean;
  /** The entity's type options; supplies each type's i18n label key. */
  typeOptions: ReadonlyArray<SelectOption<TType>>;
  /** Type used to seed the name on mount. */
  defaultType: TType;
  /** Namespaced translator (ADR-280) — resolves an option's `labelKey`. */
  t: (key: string) => string;
  applyPatch: SpaceFormPatchApplier<TType>;
}

interface UseSpaceNameSuggestionReturn<TType extends string> {
  /** Bind to the name input — marks the name as user-owned. */
  handleNameChange: (value: string) => void;
  /** Bind to the type select — re-derives the name unless user-owned. */
  handleTypeChange: (value: TType) => void;
  /** Bind to the area input — re-derives the name unless user-owned. */
  handleAreaChange: (value: string) => void;
}

// ============================================================================
// HOOK
// ============================================================================

export function useSpaceNameSuggestion<TType extends string>(
  config: UseSpaceNameSuggestionConfig<TType>,
): UseSpaceNameSuggestionReturn<TType> {
  const { createMode, typeOptions, defaultType, t, applyPatch } = config;

  const buildName = useEntityNameSuggestion();
  /** Set once the user edits the name — freezes the suggestion for good. */
  const nameManuallyChanged = useRef(false);

  // Read latest values from a ref so the seed effect stays mount-only without
  // capturing a stale translator.
  const derive = useCallback(
    (type: TType, area: string): string => {
      const labelKey = typeOptions.find(option => option.value === type)?.labelKey
        ?? typeOptions[0]?.labelKey
        ?? '';
      return buildName(t(labelKey), area);
    },
    [typeOptions, buildName, t],
  );

  const deriveRef = useRef(derive);
  deriveRef.current = derive;

  // Seed the initial name once translations are mounted (create mode only).
  useEffect(() => {
    if (!createMode) return;
    nameManuallyChanged.current = false;
    const seeded = deriveRef.current(defaultType, '');
    applyPatch(() => ({ name: seeded }));
    // Mount-only by design — re-seeding would fight the user's typing. Reads the
    // translator through `deriveRef` so an empty dep list stays honest.
  }, []);

  const isDerived = useCallback(
    () => createMode && !nameManuallyChanged.current,
    [createMode],
  );

  const handleNameChange = useCallback(
    (value: string) => {
      nameManuallyChanged.current = true;
      applyPatch(() => ({ name: value }));
    },
    [applyPatch],
  );

  const handleTypeChange = useCallback(
    (value: TType) => {
      applyPatch(prev => (isDerived()
        ? { type: value, name: derive(value, prev.area) }
        : { type: value }));
    },
    [applyPatch, isDerived, derive],
  );

  const handleAreaChange = useCallback(
    (value: string) => {
      applyPatch(prev => (isDerived()
        ? { area: value, name: derive(prev.type, value) }
        : { area: value }));
    },
    [applyPatch, isDerived, derive],
  );

  return { handleNameChange, handleTypeChange, handleAreaChange };
}
