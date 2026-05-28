'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * ADR-345 — Global app-header visibility toggle, scoped to /dxf/viewer.
 *
 * On /dxf/viewer the global AppHeader (sidebar trigger, search, company
 * switcher, notifications, user menu…) steals vertical space the CAD canvas
 * wants. This hook drives a single `data-dxf-header-hidden` attribute on
 * <html>; route-scoped CSS in `ribbon-tokens.css` collapses the whole header
 * when it is `"true"`.
 *
 * Default: hidden every time the viewer mounts (no persistence — Giorgio's
 * explicit choice). The attribute is cleared on unmount so no other route is
 * ever affected. SSoT: this hook is the sole writer of the attribute.
 */
export const DXF_HEADER_HIDDEN_DATASET_KEY = 'dxfHeaderHidden'; // → data-dxf-header-hidden

export interface DxfGlobalHeaderToggle {
  readonly hidden: boolean;
  readonly toggle: () => void;
}

export function useDxfGlobalHeaderToggle(): DxfGlobalHeaderToggle {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const root = document.documentElement;
    if (hidden) {
      root.dataset[DXF_HEADER_HIDDEN_DATASET_KEY] = 'true';
    } else {
      delete root.dataset[DXF_HEADER_HIDDEN_DATASET_KEY];
    }
    return () => {
      delete root.dataset[DXF_HEADER_HIDDEN_DATASET_KEY];
    };
  }, [hidden]);

  const toggle = useCallback(() => setHidden((h) => !h), []);

  return { hidden, toggle };
}
