"use client";

// ============================================================================
// USE BIM ENTITY PROXY ACCESSIBILITY — Wires DOM proxy + keyboard navigator
// ADR-366 Phase 9 / C.5 integration hook
// ============================================================================

import { useEffect, useRef, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import {
  createEntityDomProxyRenderer,
  type EntityDomProxyRenderer,
  type ProxyEntity,
} from './entity-dom-proxy-renderer';
import {
  createEntityKeyboardNavigator,
  type EntityKeyboardNavigator,
} from './entity-keyboard-navigator';
import { useBim3DEntitiesStore } from '../stores/Bim3DEntitiesStore';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';

interface Options {
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly managerRef: RefObject<ThreeJsSceneManager | null>;
  readonly effectiveVisible: boolean;
  readonly externalEntitiesMode: boolean;
}

export function useBimEntityProxyAccessibility({
  containerRef,
  managerRef,
  effectiveVisible,
  externalEntitiesMode,
}: Options): void {
  const { t: t3d } = useTranslation('bim3d');
  const { t: tAria } = useTranslation('bim-3d-aria');
  const proxyRendererRef = useRef<EntityDomProxyRenderer | null>(null);
  const navigatorRef = useRef<EntityKeyboardNavigator | null>(null);

  useEffect(() => {
    if (!effectiveVisible) return;
    const container = containerRef.current;
    const manager = managerRef.current;
    if (!container || !manager) return;

    const focusManager = manager.getKeyboardFocusManager();

    proxyRendererRef.current = createEntityDomProxyRenderer({
      mountRoot: container,
      focusManager,
      onActivate: (bimId) => manager.selectBimEntity(bimId),
      containerLabel: t3d('aria.entityNav.proxyContainerLabel'),
    });

    navigatorRef.current = createEntityKeyboardNavigator({
      focusManager,
      getOrder: () => manager.getEntityFocusOrder(),
      onActivate: (bimId) => manager.selectBimEntity(bimId),
    });

    // Initial sync (store subscription fires only on future changes).
    if (!externalEntitiesMode) {
      proxyRendererRef.current.sync(buildProxyEntities(useBim3DEntitiesStore.getState(), tAria));
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      navigatorRef.current?.handleKeyDown(e);
    };
    container.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      proxyRendererRef.current?.dispose();
      proxyRendererRef.current = null;
      navigatorRef.current?.dispose();
      navigatorRef.current = null;
    };
  // tAria + t3d stable refs — intentionally excluded to avoid re-creating on i18n re-renders
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveVisible, externalEntitiesMode]);

  // ── Ongoing entity sync on store changes ─────────────────────────────────
  useEffect(() => {
    if (!effectiveVisible || externalEntitiesMode) return;
    return useBim3DEntitiesStore.subscribe((s) => {
      proxyRendererRef.current?.sync(buildProxyEntities(s, tAria));
    });
  }, [effectiveVisible, externalEntitiesMode, tAria]);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

type TFn = (key: string) => string;

function buildProxyEntities(
  s: ReturnType<typeof useBim3DEntitiesStore.getState>,
  tAria: TFn,
): ProxyEntity[] {
  const entities: ProxyEntity[] = [];
  for (const e of s.walls) {
    entities.push({ bimId: e.id, ariaLabel: `${tAria('entity.wall')} ${e.id}` });
  }
  for (const e of s.columns) {
    entities.push({ bimId: e.id, ariaLabel: `${tAria('entity.column')} ${e.id}` });
  }
  for (const e of s.beams) {
    entities.push({ bimId: e.id, ariaLabel: `${tAria('entity.beam')} ${e.id}` });
  }
  for (const e of s.slabs) {
    entities.push({ bimId: e.id, ariaLabel: `${tAria('entity.slab')} ${e.id}` });
  }
  return entities;
}
