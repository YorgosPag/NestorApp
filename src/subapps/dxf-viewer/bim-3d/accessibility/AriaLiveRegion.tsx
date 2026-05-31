"use client";

import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ariaLiveBus } from './aria-live-bus';
import { useSelection3DStore } from '../stores/Selection3DStore';
import { useViewMode3DStore } from '../stores/ViewMode3DStore';
import { entityTypeLabel } from './status-bar-text-generator';
import type { KeyboardFocusManagerApi } from './KeyboardFocusManager';
import type { FocusEntityLabelData } from './FocusIndicator3D';
import { generateAriaDescription } from './aria-entity-description-generator';

// ============================================================================
// ♿ ARIA LIVE REGION — Screen reader announcement leaf (ADR-366 Phase 8.0+8.1)
// ============================================================================
//
// ADR-040 micro-leaf: zero useSyncExternalStore, zero React state.
// All subscriptions via useEffect → direct DOM textContent mutation.
// Two visually-hidden divs (sr-only) carry aria-live=polite / assertive.
// Screen reader announces when textContent changes; clearing first forces
// re-announce even for identical text (some SR implementations deduplicate).
//
// Phase 8.1 addition: optional focusManager + getEntityData props allow
// per-entity ARIA descriptions on Tab navigation. getEntityData is accessed
// via ref (stable callback, avoids useEffect churn on each render).
//
// Mounting: BimViewport3D mounts this once per 3D viewport lifetime.
// Consumers call ariaLiveBus.announce() from anywhere — no prop drilling.
// ============================================================================

export interface AriaLiveRegionProps {
  readonly focusManager?: KeyboardFocusManagerApi | null;
  readonly getEntityData?: ((bimId: string) => FocusEntityLabelData | null) | null;
}

export function AriaLiveRegion({ focusManager, getEntityData }: AriaLiveRegionProps = {}) {
  const { t: tBim3d } = useTranslation('bim3d');
  const { t: tAria } = useTranslation('bim-3d-aria');
  const politeRef = useRef<HTMLDivElement>(null);
  const assertiveRef = useRef<HTMLDivElement>(null);

  // Stable ref for getEntityData — avoids re-subscribing description listener on every render.
  const getEntityDataRef = useRef(getEntityData);
  useEffect(() => { getEntityDataRef.current = getEntityData; });

  // Subscribe to bus — direct DOM update, zero React re-renders.
  useEffect(() => {
    return ariaLiveBus.subscribe((message, severity) => {
      const el = severity === 'assertive' ? assertiveRef.current : politeRef.current;
      if (!el) {
        console.warn('[AriaLiveRegion] live region element not mounted');
        return;
      }
      // Clear then set in next animation frame forces SR re-announce.
      el.textContent = '';
      requestAnimationFrame(() => { el.textContent = message; });
    });
  }, []);

  // Auto-announce selection changes (low-frequency, user-triggered).
  // ADR-402 Phase C — multi-select aware: announces "N entities selected" for >1.
  useEffect(() => {
    return useSelection3DStore.subscribe(
      (s) => s.selectedBimIds,
      (ids) => {
        if (ids.length === 0) {
          ariaLiveBus.announce(tBim3d('aria.live.selectionCleared'), 'polite');
          return;
        }
        if (ids.length > 1) {
          ariaLiveBus.announce(tBim3d('aria.live.selectionMultiple', { count: ids.length }), 'polite');
          return;
        }
        const bimId = ids[0];
        const type = useSelection3DStore.getState().selectedBimType;
        const typeLabel = entityTypeLabel(type, tBim3d);
        const msg = typeLabel
          ? tBim3d('aria.live.selectionChangedTypeOnly', { type: typeLabel })
          : tBim3d('aria.live.selectionChanged', { type: '', name: bimId });
        ariaLiveBus.announce(msg, 'polite');
      },
    );
  }, [tBim3d]);

  // Auto-announce mode switches (low-frequency, user-triggered).
  useEffect(() => {
    return useViewMode3DStore.subscribe(
      (s) => s.mode,
      (mode) => {
        if (mode === '2d') {
          ariaLiveBus.announce(tBim3d('aria.live.modeSwitchedTo2D'), 'polite');
        } else if (mode === '3d-raster' || mode === '3d-preview') {
          ariaLiveBus.announce(tBim3d('aria.live.modeSwitchedTo3D'), 'polite');
        }
      },
    );
  }, [tBim3d]);

  // Phase 8.1: announce entity description on Tab focus (ADR-366 §4.5.2).
  // Subscribes to description channel (separate from visual FocusListener).
  // Uses ref for getEntityData to keep subscription stable across renders.
  useEffect(() => {
    if (!focusManager) return;
    return focusManager.subscribeDescription((entityId) => {
      if (!entityId) return;
      const labelData = getEntityDataRef.current?.(entityId);
      const ariaData = {
        bimType: labelData?.bimType ?? null,
        entityName: labelData?.entityName ?? null,
      };
      const description = generateAriaDescription(ariaData, tAria);
      ariaLiveBus.announce(description, 'polite');
    });
  }, [focusManager, tAria]);

  return (
    <>
      {/* polite: selection changes, mode switches, entity descriptions on focus */}
      <div
        ref={politeRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />
      {/* assertive: errors, blocking issues */}
      <div
        ref={assertiveRef}
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      />
    </>
  );
}
