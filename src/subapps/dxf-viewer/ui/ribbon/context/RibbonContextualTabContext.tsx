'use client';

/**
 * ADR-532 Stage 2 (perf) — contextual-tab trigger as a leaf subscription.
 *
 * The active contextual trigger (which contextual tab — Wall/Column/MEP/… —
 * should surface for the current selection/tool) changes on EVERY click-select.
 * Previously it was a `RibbonRoot` prop, so each selection broke `RibbonRoot`'s
 * `React.memo` → the whole ribbon shell + command provider + tab body re-rendered
 * (the ~96 ribbon fibers + ~300 tooltips in the 2026-06-28 profile).
 *
 * Routing it through context decouples the trigger from `RibbonRoot`'s props:
 * `RibbonRoot` stays referentially stable on selection (memo holds → the shell
 * does NOT re-render), and ONLY the in-shell leaf that calls
 * `useRibbonContextualTrigger()` (the tab bar + body region) reacts — and only
 * when the trigger STRING actually changes (string identity → React skips
 * context consumers when the value is unchanged).
 *
 * Layering: the context lives here (ui/ribbon) and is consumed here
 * (RibbonRoot's tab region); the VALUE is computed in the app layer
 * (`RibbonContextualTabScope`, which owns `useActiveContextualTrigger` +
 * self-subscribes to the selection store). app → ui only, no cycle.
 */

import React, { createContext, useContext } from 'react';

const RibbonContextualTabContext = createContext<string | null>(null);

interface RibbonContextualTabProviderProps {
  /** Active contextual trigger token, `null` when no contextual tab applies. */
  trigger: string | null;
  children: React.ReactNode;
}

export const RibbonContextualTabProvider: React.FC<RibbonContextualTabProviderProps> = ({
  trigger,
  children,
}) => (
  <RibbonContextualTabContext.Provider value={trigger}>
    {children}
  </RibbonContextualTabContext.Provider>
);

/** Leaf-only subscription to the active contextual trigger (ADR-532 Stage 2). */
export function useRibbonContextualTrigger(): string | null {
  return useContext(RibbonContextualTabContext);
}
