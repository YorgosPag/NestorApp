'use client';

import React, { createContext, useContext } from 'react';
import { useSelectionSystemState, type SelectionContextType } from './useSelectionSystemState';

// Create context
export const SelectionContext = createContext<SelectionContextType | null>(null);

// Provider component
export function SelectionSystem({ children }: { children: React.ReactNode }) {
  const { contextValue } = useSelectionSystemState();

  return (
    <SelectionContext.Provider value={contextValue}>
      {children}
    </SelectionContext.Provider>
  );
}

// Hook for consuming the selection context
export function useSelection(): SelectionContextType {
  const context = useContext(SelectionContext);
  if (!context) {
    throw new Error('useSelection must be used within a SelectionSystem');
  }
  return context;
}

// Backward compatibility exports
export { useSelection as useSelectionContext };
export type { SelectionContextType };