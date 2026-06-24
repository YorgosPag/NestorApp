'use client';

/**
 * useViewportUrlSync — Viewport State Persistence sync hook (ADR-400).
 *
 * Subscribes to ImmediateTransformStore and debounces writes to BOTH the URL
 * (history.replaceState) and localStorage via `persistViewport`.  No React
 * state reads, no useSyncExternalStore — safe to mount in an orchestrator
 * (DxfViewerContent) without causing pan/zoom re-renders.
 *
 * ADR-040 compliance:
 *   - MUST NOT call useSyncExternalStore / useTransformValue (orchestrator rule).
 *   - Uses TransformStore.subscribe (raw listener) + getImmediateTransform().
 *   - Does not render anything — pure side-effect hook.
 */

import { useEffect, useRef } from 'react';
import { DXF_TIMING } from '../../config/dxf-timing';
import { TransformStore, getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import { persistViewport } from '../../services/viewport-persistence';

const DEBOUNCE_MS = DXF_TIMING.ui.URL_DEBOUNCE; // ADR-516

/** Identity transform that should never be persisted (initial canvas state). */
function isIdentityTransform(scale: number, offsetX: number, offsetY: number): boolean {
  return scale === 1 && offsetX === 0 && offsetY === 0;
}

export interface UseViewportUrlSyncParams {
  fileRecordId: string | null;
  levelId: string | null;
}

/**
 * Mounts once; survives fileRecordId / levelId changes via refs.
 * The transform subscription uses an empty dep array so it is NEVER
 * torn down and rebuilt on pan/zoom — the ref pattern ensures it always
 * reads the latest fileRecordId / levelId without a new subscription.
 */
export function useViewportUrlSync({ fileRecordId, levelId }: UseViewportUrlSyncParams): void {
  const fileRecordIdRef = useRef<string | null>(fileRecordId);
  const levelIdRef = useRef<string | null>(levelId);

  // Mirror props → refs on every render so the long-lived subscription
  // closure always has the latest values without re-subscribing.
  useEffect(() => {
    fileRecordIdRef.current = fileRecordId;
    levelIdRef.current = levelId;
  });

  // Long-lived transform subscription with debounce — dep array intentionally [].
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const unsubscribe = TransformStore.subscribe(() => {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        const t = getImmediateTransform();
        persistViewport(fileRecordIdRef.current, t, levelIdRef.current);
      }, DEBOUNCE_MS);
    });

    return () => {
      if (timer !== null) clearTimeout(timer);
      unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Immediate write when levelId changes — but skip the initial identity transform
  // (the canvas hasn't been positioned yet; the user hasn't navigated anywhere).
  useEffect(() => {
    const t = getImmediateTransform();
    if (isIdentityTransform(t.scale, t.offsetX, t.offsetY)) return;
    persistViewport(fileRecordId, t, levelId);
  }, [fileRecordId, levelId]); // intentional: fires when either changes
}
