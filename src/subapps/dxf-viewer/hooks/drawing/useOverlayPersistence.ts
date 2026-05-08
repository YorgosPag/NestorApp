'use client';

/**
 * 🔷 OVERLAY PERSISTENCE HOOK (ADR-340 Phase 9 STEP G)
 *
 * Thin React wrapper over the floorplan-overlay-mutation-gateway, exposing
 * a single `persistEntity()` call that translates a (tool, entity) pair into
 * an OverlayGeometry and posts it to `/api/floorplan-overlays`.
 *
 * Used by `completeEntity()` when caller opts into Firestore persistence via
 * the `persistToOverlays` option. Layering tools route through the overlay
 * store directly and do NOT use this hook.
 *
 * Bundle isolation: imports only the shared gateway + types; no FloorplanGallery
 * dependency.
 */

import { useCallback } from 'react';
import { createModuleLogger } from '@/lib/telemetry';
import {
  createFloorplanOverlay,
  type CreateFloorplanOverlayPayload,
} from '@/services/floorplan-overlay-mutation-gateway';
import type {
  OverlayLinked,
  OverlayRole,
  OverlayStyle,
} from '@/types/floorplan-overlays';
import type { Entity } from '../../types/entities';
import type { DrawingTool } from './drawing-types';
import { entityToGeometry } from './overlay-persistence-utils';

const logger = createModuleLogger('useOverlayPersistence');

export interface PersistEntityOptions {
  backgroundId: string;
  floorId: string;
  role: OverlayRole;
  linked?: OverlayLinked;
  label?: string;
  style?: OverlayStyle;
  layer?: string;
}

export interface PersistEntityResult {
  overlayId: string | null;
  skipped: boolean;
  error?: string;
}

/**
 * Hook returning a stable `persistEntity` callback. Returns `{ skipped: true }`
 * for unsupported entity/tool combinations (no throw — caller continues).
 */
export function useOverlayPersistence() {
  const persistEntity = useCallback(
    async (
      entity: Entity,
      tool: DrawingTool,
      options: PersistEntityOptions,
    ): Promise<PersistEntityResult> => {
      const geometry = entityToGeometry(entity, tool);
      if (!geometry) {
        logger.debug('Skipping persistence — no geometry mapping', {
          data: { tool, type: entity.type },
        });
        return { overlayId: null, skipped: true };
      }

      const payload: CreateFloorplanOverlayPayload = {
        backgroundId: options.backgroundId,
        floorId: options.floorId,
        geometry,
        role: options.role,
        ...(options.linked ? { linked: options.linked } : {}),
        ...(options.label !== undefined ? { label: options.label } : {}),
        ...(options.style ? { style: options.style } : {}),
        ...(options.layer ? { layer: options.layer } : {}),
      };

      try {
        const result = await createFloorplanOverlay(payload);
        logger.debug('Overlay persisted', {
          data: { overlayId: result.overlayId, tool, role: options.role },
        });
        return { overlayId: result.overlayId, skipped: false };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error('Overlay persistence failed', {
          error: err as Error,
          data: { tool, role: options.role },
        });
        return { overlayId: null, skipped: false, error: message };
      }
    },
    [],
  );

  return { persistEntity };
}
