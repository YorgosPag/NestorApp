// ============================================================================
// ENTITY DOM PROXY RENDERER — Offscreen DOM proxies for AT (ADR-366 Phase 9 / C.5.Q2)
// ============================================================================
//
// Creates a hidden <div role="application"> containing one <button> per visible
// BIM entity. Screen readers Tab-navigate these buttons — the focus event wires
// into KeyboardFocusManager → FocusOutlineRenderer + AriaLiveRegion.
//
// Design:
//   - Container: positioned offscreen via sr-only class (NOT display:none —
//     assistive technologies cannot focus hidden elements).
//   - Roving tabindex: only the currently focused entity has tabindex=0.
//     All others are tabindex=-1. WAI-ARIA Authoring Practices composite pattern.
//   - sync() is called by BimViewport3D on entity list changes (Bim3DEntitiesStore
//     subscription). The renderer is a pure DOM manager — no React, no stores.
//   - Button focus event → KeyboardFocusManager.setFocus() → FocusIndicator3D
//     + AriaLiveRegion auto-announce via subscribeDescription.
// ============================================================================

import type { KeyboardFocusManagerApi } from './KeyboardFocusManager';

export interface ProxyEntity {
  /** BIM entity id (bimId). */
  readonly bimId: string;
  /** Pre-generated ARIA label from aria-entity-description-generator. */
  readonly ariaLabel: string;
}

export interface EntityDomProxyRendererOptions {
  /** Element into which the offscreen container is appended. */
  readonly mountRoot: HTMLElement;
  readonly focusManager: KeyboardFocusManagerApi;
  /** Called when the user activates (clicks / Enter) a proxy button. */
  readonly onActivate?: (bimId: string) => void;
  /** Localized label for the proxy container's role="application" region. */
  readonly containerLabel?: string;
}

export interface EntityDomProxyRenderer {
  /** Sync DOM buttons to the given entity list. Adds/removes/updates as needed. */
  sync(entities: readonly ProxyEntity[]): void;
  /** Remove all buttons and the container from the DOM. */
  dispose(): void;
}

const SR_ONLY_CLASS = 'sr-only';

export function createEntityDomProxyRenderer({
  mountRoot,
  focusManager,
  onActivate,
  containerLabel = 'BIM entities',
}: EntityDomProxyRendererOptions): EntityDomProxyRenderer {
  const container = document.createElement('div');
  container.setAttribute('role', 'application');
  container.setAttribute('aria-label', containerLabel);
  container.className = SR_ONLY_CLASS;
  mountRoot.appendChild(container);

  const buttonMap = new Map<string, HTMLButtonElement>();
  let currentFocused: string | null = focusManager.getFocused();

  function updateRovingTabindex(focusedId: string | null): void {
    for (const [bimId, btn] of buttonMap) {
      btn.tabIndex = bimId === focusedId ? 0 : -1;
    }
  }

  const unsubscribeFocus = focusManager.subscribe((focusedId) => {
    currentFocused = focusedId;
    updateRovingTabindex(focusedId);
  });

  function createButton(entity: ProxyEntity): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('data-bim-id', entity.bimId);
    btn.setAttribute('aria-label', entity.ariaLabel);
    btn.tabIndex = entity.bimId === currentFocused ? 0 : -1;

    btn.addEventListener('focus', () => {
      focusManager.setFocus(entity.bimId);
    });
    btn.addEventListener('click', () => {
      focusManager.setFocus(entity.bimId);
      onActivate?.(entity.bimId);
    });
    return btn;
  }

  function sync(entities: readonly ProxyEntity[]): void {
    const incomingIds = new Set(entities.map((e) => e.bimId));

    for (const [bimId, btn] of buttonMap) {
      if (!incomingIds.has(bimId)) {
        container.removeChild(btn);
        buttonMap.delete(bimId);
      }
    }

    for (const entity of entities) {
      const existing = buttonMap.get(entity.bimId);
      if (existing) {
        existing.setAttribute('aria-label', entity.ariaLabel);
      } else {
        const btn = createButton(entity);
        container.appendChild(btn);
        buttonMap.set(entity.bimId, btn);
      }
    }

    updateRovingTabindex(currentFocused);
  }

  function dispose(): void {
    unsubscribeFocus();
    buttonMap.clear();
    if (container.parentNode) container.parentNode.removeChild(container);
  }

  return { sync, dispose };
}
