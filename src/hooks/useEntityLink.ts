'use client';

/**
 * useEntityLink — Centralized entity linking hook
 *
 * Single source of truth for entity linking logic across all GeneralTab components.
 * Handles: state management, entity reset, cascading field resets, save payload,
 * key isolation (prevents cross-entity state contamination).
 *
 * ADR-200: Replaces copy-pasted linking logic in Storage, Parking, Unit, Building, Project.
 *
 * @module hooks/useEntityLink
 * @see EntityLinkCard — the rendering component this hook drives
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { EntityLinkOption, EntityLinkLabels, EntityLinkCardProps } from '@/components/shared/EntityLinkCard';

// =============================================================================
// TYPES
// =============================================================================

/** Supported entity relationship types */
export type EntityLinkRelation =
  | 'storage-building'
  | 'parking-building'
  | 'unit-building'
  | 'building-project'
  | 'project-company';

/** Save behavior modes */
export type EntityLinkSaveMode = 'immediate' | 'form' | 'local';

/** Cascading reset definition */
export interface CascadingResetDef {
  /** The field to reset when parent changes */
  resetField: string;
  /** Value to reset to (defaults to empty string) */
  resetValue?: string;
}

export interface UseEntityLinkConfig {
  /** Relationship type — determines foreign key name */
  relation: EntityLinkRelation;
  /** Entity ID — used for reset detection + key generation */
  entityId: string;
  /** Current linked parent ID from the entity data */
  initialParentId: string | null;
  /** Async loader for dropdown options */
  loadOptions: () => Promise<EntityLinkOption[]>;
  /** How save is handled */
  saveMode: EntityLinkSaveMode;
  /** Auto-save callback (immediate mode). Signature matches EntityLinkCard.onSave */
  onSave?: (newId: string | null, name: string) => Promise<{ success: boolean; error?: string }>;
  /** Called when cascading resets fire (e.g. floor reset on building change) */
  onCascadingReset?: (resets: Array<{ field: string; value: string }>) => void;
  /** Fields to reset when linked entity changes */
  cascadingResets?: CascadingResetDef[];
  /** UI labels for EntityLinkCard */
  labels: EntityLinkLabels;
  /** Card header icon */
  icon: LucideIcon;
  /** Unique card ID for accessibility */
  cardId: string;
  /** Enable searchable mode (typeahead popover) */
  searchable?: boolean;
  /** Hide the "Τρέχον:" label */
  hideCurrentLabel?: boolean;
}

export interface UseEntityLinkReturn {
  /** Current linked entity ID */
  linkedId: string | null;
  /** Manually set the linked ID (rare — most changes go through EntityLinkCard) */
  setLinkedId: (id: string | null) => void;
  /** Spread these on <EntityLinkCard {...linkCardProps} /> */
  linkCardProps: EntityLinkCardProps & { key: string };
  /** For form/local save modes — returns changed foreign key or empty object */
  getPayload: () => Record<string, string | null>;
  /** True when current value differs from initial */
  isDirty: boolean;
  /** Reset to initial state */
  reset: () => void;
}

// =============================================================================
// FOREIGN KEY MAP
// =============================================================================

const FOREIGN_KEY_MAP: Record<EntityLinkRelation, string> = {
  'storage-building': 'buildingId',
  'parking-building': 'buildingId',
  'unit-building': 'buildingId',
  'building-project': 'projectId',
  'project-company': 'companyId',
};

// =============================================================================
// HOOK
// =============================================================================

/**
 * useEntityLink — centralizes all entity linking state + behavior
 *
 * @param config - Hook configuration
 * @param isEditing - Whether the parent form is in edit mode
 */
export function useEntityLink(
  config: UseEntityLinkConfig,
  isEditing: boolean,
): UseEntityLinkReturn {
  const {
    relation,
    entityId,
    initialParentId,
    loadOptions,
    saveMode,
    onSave,
    onCascadingReset,
    cascadingResets,
    labels,
    icon,
    cardId,
    searchable,
    hideCurrentLabel,
  } = config;

  const [linkedId, setLinkedId] = useState<string | null>(initialParentId);
  const prevEntityIdRef = useRef(entityId);

  // Reset when switching to a different entity (cross-entity isolation)
  useEffect(() => {
    if (prevEntityIdRef.current !== entityId) {
      prevEntityIdRef.current = entityId;
      setLinkedId(initialParentId);
    }
  }, [entityId, initialParentId]);

  // Also sync when initialParentId changes for the SAME entity
  // (e.g. external data refresh)
  const prevInitialRef = useRef(initialParentId);
  useEffect(() => {
    if (prevInitialRef.current !== initialParentId) {
      prevInitialRef.current = initialParentId;
      setLinkedId(initialParentId);
    }
  }, [initialParentId]);

  const foreignKey = FOREIGN_KEY_MAP[relation];

  // Handle value changes from EntityLinkCard
  const handleValueChange = useCallback((newId: string | null) => {
    if (newId !== linkedId) {
      setLinkedId(newId);

      // Fire cascading resets
      if (cascadingResets && cascadingResets.length > 0 && onCascadingReset) {
        const resets = cascadingResets.map(cr => ({
          field: cr.resetField,
          value: cr.resetValue ?? '',
        }));
        onCascadingReset(resets);
      }
    }
  }, [linkedId, cascadingResets, onCascadingReset]);

  const isDirty = linkedId !== initialParentId;

  const getPayload = useCallback((): Record<string, string | null> => {
    if (!isDirty) return {};
    return { [foreignKey]: linkedId };
  }, [isDirty, foreignKey, linkedId]);

  const reset = useCallback(() => {
    setLinkedId(initialParentId);
  }, [initialParentId]);

  // Build EntityLinkCard props
  const autoSave = saveMode === 'immediate';
  const key = `${relation}-${entityId}`;

  const linkCardProps: EntityLinkCardProps & { key: string } = {
    key,
    cardId,
    icon,
    labels,
    currentValue: linkedId ?? undefined,
    loadOptions,
    isEditing,
    autoSave,
    searchable,
    hideCurrentLabel,
    // immediate mode → onSave for auto-save
    ...(autoSave && onSave ? { onSave } : {}),
    // form/local mode → onValueChange for parent state sync
    ...(!autoSave ? { onValueChange: handleValueChange } : {}),
  };

  return {
    linkedId,
    setLinkedId,
    linkCardProps,
    getPayload,
    isDirty,
    reset,
  };
}
