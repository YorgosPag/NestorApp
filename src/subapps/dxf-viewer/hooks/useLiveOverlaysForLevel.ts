'use client';

/**
 * 🏢 SSoT: Live overlays for a DXF level
 *
 * Wraps `overlayStore.getByLevel` with a filter that drops overlays whose
 * linked property has been soft-deleted (status='deleted'). Orphaned overlays
 * are invisible to the user and re-appear automatically when the linked
 * property is restored from trash.
 *
 * Sibling to SharedPropertiesProvider's provider-level filter (ADR-281):
 * that layer hides deleted properties from every consumer, this layer
 * propagates the same invariant to DXF overlays linked to them.
 *
 * @module subapps/dxf-viewer/hooks/useLiveOverlaysForLevel
 */

import { useMemo } from 'react';
import { useSharedProperties } from '@/contexts/SharedPropertiesProvider';
import { useOverlayStore } from '../overlays/overlay-store';
import type { Overlay } from '../overlays/types';

export function useLiveOverlaysForLevel(levelId: string | null | undefined): Overlay[] {
  const overlayStore = useOverlayStore();
  const { properties } = useSharedProperties();

  return useMemo(() => {
    if (!levelId) return [];
    const livePropertyIds = new Set(properties.map(p => p.id));
    return Object.values(overlayStore.overlays).filter(o => {
      if (o.levelId !== levelId) return false;
      const propId = o.linked?.propertyId;
      if (propId && !livePropertyIds.has(propId)) return false;
      return true;
    });
  }, [levelId, overlayStore.overlays, properties]);
}
