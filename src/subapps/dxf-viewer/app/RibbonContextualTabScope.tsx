'use client';

/**
 * ADR-532 Stage 2 (perf) — app-layer scope that computes the ribbon contextual
 * trigger and feeds it to `RibbonRoot` via context (NOT a prop), so a
 * click-select no longer breaks `RibbonRoot`'s `React.memo`.
 *
 * This thin leaf self-subscribes to the selection store (`usePrimarySelectedId`
 * / `useSelectedEntityIds`) + reads `currentScene`/`activeTool` from props and
 * runs the SSoT `useActiveContextualTrigger`. It re-renders on every selection
 * change, but renders ONLY the context provider + its (memoized) `RibbonRoot`
 * child → the ribbon shell stays put; only the in-shell tab region reacts.
 *
 * Owns the `selectedEntityIds`/`primarySelectedId` subscriptions that the ribbon
 * needs for the contextual trigger, so `DxfViewerTopBar` no longer threads them
 * into `useDxfViewerRibbon` (the bridges read the stable selection facade).
 */

import React from 'react';
import type { SceneModel } from '../types/scene';
import { usePrimarySelectedId, useSelectedEntityIds } from '../systems/selection';
import { useActiveContextualTrigger } from './ribbon-contextual-config';
import { RibbonContextualTabProvider } from '../ui/ribbon/context/RibbonContextualTabContext';

export interface RibbonContextualTabScopeProps {
  readonly currentScene: SceneModel | null;
  readonly activeTool: string;
  readonly children: React.ReactNode;
}

export function RibbonContextualTabScope({
  currentScene,
  activeTool,
  children,
}: RibbonContextualTabScopeProps) {
  const primarySelectedId = usePrimarySelectedId();
  const selectedEntityIds = useSelectedEntityIds();
  const activeContextualTrigger = useActiveContextualTrigger({
    primarySelectedId, selectedEntityIds, currentScene, activeTool,
  });
  return (
    <RibbonContextualTabProvider trigger={activeContextualTrigger}>
      {children}
    </RibbonContextualTabProvider>
  );
}
