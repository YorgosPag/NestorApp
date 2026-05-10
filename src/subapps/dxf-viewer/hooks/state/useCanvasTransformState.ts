/**
 * useCanvasTransformState — Phase XIII (ADR-040)
 *
 * SSoT delegate: writes through to TransformStore singleton
 * (`ImmediateTransformStore`). No React state, no orchestrator subscription.
 *
 * BEFORE (Phase XII and earlier): held a `useState<CanvasTransform>` inside
 * `DxfViewerContent` → every `setCanvasTransform` re-rendered the entire
 * MainContent subtree (Tooltip, DropdownMenu, ZoomControls, RulerCornerBox,
 * ScreenshotSection, dialogs, etc.).
 *
 * AFTER (Phase XIII): mutations write to TransformStore. Components that need
 * the reactive value subscribe via `useTransformValue()` / `useTransformScale()`.
 * DxfViewerContent no longer re-renders on pan/zoom.
 */

'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useEventBus } from '../../systems/events/EventBus';
import type { SceneModel } from '../../types/scene';
import { useCanvasOperations } from '../interfaces/useCanvasOperations';
import {
  TRANSFORM_SCALE_LIMITS,
  TRANSFORM_OFFSET_LIMITS,
  validateTransform as validateTransformConfig,
  transformsEqual as transformsEqualConfig,
} from '../../config/transform-config';
import {
  updateImmediateTransform,
  getImmediateTransform,
} from '../../systems/cursor/ImmediateTransformStore';

interface CanvasTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

const DEFAULT_TRANSFORM: CanvasTransform = {
  scale: TRANSFORM_SCALE_LIMITS.DEFAULT_SCALE,
  offsetX: TRANSFORM_OFFSET_LIMITS.DEFAULT_OFFSET_X,
  offsetY: TRANSFORM_OFFSET_LIMITS.DEFAULT_OFFSET_Y,
};

interface UseCanvasTransformStateProps {
  currentScene: SceneModel | null;
  activeTool: string;
}

export function useCanvasTransformState({ currentScene, activeTool }: UseCanvasTransformStateProps) {
  const isInitializedRef = useRef(false);
  const canvasOps = useCanvasOperations();
  const eventBus = useEventBus();

  // Initialize transform from canvas operations (once when scene becomes available).
  useEffect(() => {
    if (isInitializedRef.current || !currentScene) return;
    try {
      const initial = canvasOps.getTransform();
      updateImmediateTransform(validateTransformConfig(initial));
      isInitializedRef.current = true;
    } catch (error) {
      console.error('[useCanvasTransformState] Failed to initialize transform:', error);
      updateImmediateTransform(DEFAULT_TRANSFORM);
      isInitializedRef.current = true;
    }
  }, [currentScene, canvasOps]);

  // EventBus listener — sync from external zoom events (layering mode).
  useEffect(() => {
    if (activeTool !== 'layering') return;

    const cleanup = eventBus.on('dxf-zoom-changed', ({ transform: newTransform }) => {
      try {
        if (!newTransform) return;
        const prev = getImmediateTransform();
        const validated = validateTransformConfig(newTransform);
        if (transformsEqualConfig(prev, validated)) return;
        updateImmediateTransform(validated);
      } catch (error) {
        console.error('[useCanvasTransformState] Failed to sync transform from event:', error);
      }
    });

    return cleanup;
  }, [eventBus, activeTool]);

  // Stable mutation API — no subscription, no caller re-render.
  const setCanvasTransform = useCallback((patch: Partial<CanvasTransform>) => {
    const prev = getImmediateTransform();
    const merged = { ...prev, ...patch };
    updateImmediateTransform(validateTransformConfig(merged));
  }, []);

  const reset = useCallback(() => {
    updateImmediateTransform(DEFAULT_TRANSFORM);
  }, []);

  return {
    setCanvasTransform,
    reset,
    isInitialized: isInitializedRef.current,
  };
}
