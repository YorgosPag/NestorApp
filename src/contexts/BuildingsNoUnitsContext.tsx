'use client';

/**
 * 🏢 ENTERPRISE: BuildingsNoUnitsContext
 *
 * SSoT for the "has at least one building with no active units" signal.
 * Fetches ONCE at AppLayout mount, distributes via context.
 *
 * Consumers use `useBuildingsNoUnits()` — zero extra API calls.
 * The raw fetch logic lives in `useHasBuildingsWithNoUnits.ts` (used only here).
 */

import React, { createContext, useContext } from 'react';
import { useHasBuildingsWithNoUnits } from '@/hooks/useHasBuildingsWithNoUnits';

const BuildingsNoUnitsContext = createContext<boolean>(false);

export function BuildingsNoUnitsProvider({ children }: { children: React.ReactNode }) {
  const hasEmpty = useHasBuildingsWithNoUnits();
  return (
    <BuildingsNoUnitsContext.Provider value={hasEmpty}>
      {children}
    </BuildingsNoUnitsContext.Provider>
  );
}

/** Consume the SSoT boolean — never call useHasBuildingsWithNoUnits() directly in components. */
export function useBuildingsNoUnits(): boolean {
  return useContext(BuildingsNoUnitsContext);
}
