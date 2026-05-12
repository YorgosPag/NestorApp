'use client';

/**
 * ADR-345 Fase 3 — Bridge between ribbon button components and the
 * DXF viewer state (`handleToolChange` / split-last-used persistence).
 * Provider lives in RibbonRoot; leaves consume via useRibbonCommand().
 */

import React, { createContext, useContext, useMemo } from 'react';
import type { ToolType } from '../../toolbar/types';
import { useSplitLastUsed } from '../hooks/useSplitLastUsed';

export interface RibbonCommandsApi {
  onToolChange: (tool: ToolType) => void;
  /** ADR-345 §3.2 Fase 4 — fires when a button marked `comingSoon` is clicked. */
  onComingSoon: (label: string) => void;
}

interface RibbonCommandContextValue {
  onToolChange: (tool: ToolType) => void;
  onComingSoon: (label: string) => void;
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
      splitLastUsed,
      setSplitLastUsed,
    }),
    [commands.onToolChange, commands.onComingSoon, splitLastUsed, setSplitLastUsed],
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
