'use client';

/**
 * ADR-345 Fase 3 — Bridge between ribbon button components and the
 * DXF viewer state (`handleToolChange` / split-last-used persistence).
 * Provider lives in RibbonRoot; leaves consume via useRibbonCommand().
 */

import React, { createContext, useContext, useMemo } from 'react';
import type { ToolType } from '../../toolbar/types';
import { useSplitLastUsed } from '../hooks/useSplitLastUsed';

export type RibbonActionPayload = number | string | Record<string, unknown>;

export interface RibbonCommandsApi {
  onToolChange: (tool: ToolType) => void;
  /** ADR-345 §3.2 Fase 4 — fires when a button marked `comingSoon` is clicked. */
  onComingSoon: (label: string) => void;
  /**
   * ADR-345 Fase 5 — generic action dispatcher for non-ToolType commands
   * (zoom-extents, undo, redo, fit-to-view, toggle-snap…). Forwarded to
   * `handleAction(action, data)` in `useDxfViewerState`.
   */
  onAction: (action: string, data?: RibbonActionPayload) => void;
}

interface RibbonCommandContextValue {
  onToolChange: (tool: ToolType) => void;
  onComingSoon: (label: string) => void;
  onAction: (action: string, data?: RibbonActionPayload) => void;
  splitLastUsed: Record<string, string>;
  setSplitLastUsed: (commandId: string, variantId: string) => void;
}

const RibbonCommandContext = createContext<RibbonCommandContextValue | null>(
  null,
);

interface RibbonCommandProviderProps {
  commands: RibbonCommandsApi;
  children: React.ReactNode;
}

export const RibbonCommandProvider: React.FC<RibbonCommandProviderProps> = ({
  commands,
  children,
}) => {
  const { splitLastUsed, setSplitLastUsed } = useSplitLastUsed();

  const value = useMemo<RibbonCommandContextValue>(
    () => ({
      onToolChange: commands.onToolChange,
      onComingSoon: commands.onComingSoon,
      onAction: commands.onAction,
      splitLastUsed,
      setSplitLastUsed,
    }),
    [
      commands.onToolChange,
      commands.onComingSoon,
      commands.onAction,
      splitLastUsed,
      setSplitLastUsed,
    ],
  );

  return (
    <RibbonCommandContext.Provider value={value}>
      {children}
    </RibbonCommandContext.Provider>
  );
};

export function useRibbonCommand(): RibbonCommandContextValue {
  const ctx = useContext(RibbonCommandContext);
  if (!ctx) {
    throw new Error(
      'useRibbonCommand must be used inside <RibbonCommandProvider>',
    );
  }
  return ctx;
}
