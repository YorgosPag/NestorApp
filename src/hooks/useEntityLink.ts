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
import { RealtimeService } from '@/services/realtime';
import type { RealtimeEventMap } from '@/services/realtime';

// =============================================================================
// TYPES
// =============================================================================

/** Supported entity relationship types */
export type EntityLinkRelation =
  | 'storage-building'
  | 'parking-building'
  | 'property-building'
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
  /** Icon color from NAVIGATION_ENTITIES (SSoT) */
  iconColor?: string;
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
  /** Spread these on <EntityLinkCard key={linkCardKey} {...linkCardProps} /> */
  linkCardProps: EntityLinkCardProps;
  /** React key — pass directly to JSX, NOT via spread */
  linkCardKey: string;
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
  'property-building': 'buildingId',
  'building-project': 'projectId',
  'project-company': 'linkedCompanyId',
};

// =============================================================================
// REALTIME REFRESH — maps relation → events that invalidate options
// =============================================================================

/**
 * Each relation type links TO a parent entity type.
 * When that parent entity type is created, updated (name change), or deleted,
 * the dropdown options must refresh.
 *
 * Example: relation 'property-building' means the dropdown shows buildings.
 * → subscribe to BUILDING_CREATED, BUILDING_UPDATED, BUILDING_DELETED
 */
const RELATION_REALTIME_EVENTS: Record<EntityLinkRelation, Array<keyof RealtimeEventMap>> = {
  'storage-building': ['BUILDING_CREATED', 'BUILDING_UPDATED', 'BUILDING_DELETED'],
  'parking-building': ['BUILDING_CREATED', 'BUILDING_UPDATED', 'BUILDING_DELETED'],
  'property-building':    ['BUILDING_CREATED', 'BUILDING_UPDATED', 'BUILDING_DELETED'],
  'building-project': ['PROJECT_CREATED', 'PROJECT_UPDATED', 'PROJECT_DELETED'],
  'project-company':  ['CONTACT_CREATED', 'CONTACT_UPDATED', 'CONTACT_DELETED'],
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
    iconColor,
    cardId,
    searchable,
    hideCurrentLabel,
  } = config;

  const [linkedId, setLinkedId] = useState<string | null>(initialParentId);
  const prevEntityIdRef = useRef(entityId);

  // Realtime refresh — increments when parent entity type changes (create/update/delete)
  const [refreshSignal, setRefreshSignal] = useState(0);

  useEffect(() => {
    const events = RELATION_REALTIME_EVENTS[relation];
    const unsubscribers = events.map((event) =>
      RealtimeService.subscribe(event, () => {
        setRefreshSignal((prev) => prev + 1);
      })
    );
    return () => { unsubscribers.forEach((unsub) => unsub()); };
  }, [relation]);

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

  const linkCardProps: EntityLinkCardProps = {
    cardId,
    icon,
    iconColor,
    labels,
    currentValue: linkedId ?? undefined,
    loadOptions,
    isEditing,
    autoSave,
    searchable,
    hideCurrentLabel,
    refreshSignal,
    // immediate mode → onSave for auto-save
    ...(autoSave && onSave ? { onSave } : {}),
    // form/local mode → onValueChange for parent state sync
    ...(!autoSave ? { onValueChange: handleValueChange } : {}),
  };

  return {
    linkedId,
    setLinkedId,
    linkCardProps,
    linkCardKey: key,
    getPayload,
    isDirty,
    reset,
  };
}
