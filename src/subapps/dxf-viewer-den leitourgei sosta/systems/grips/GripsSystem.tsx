'use client';

import React from 'react';

// Re-export the existing GripProvider as the main system
import { GripProvider as ExistingGripProvider } from '../../providers/GripProvider';
export { useGripContext } from '../../providers/GripProvider';

// Main grips system component that wraps the existing provider
export function GripsSystem({ children }: { children: React.ReactNode }) {
  return (
    <ExistingGripProvider>
      {children}
    </ExistingGripProvider>
  );
}

// Backward compatibility export
export const GripSystem = GripsSystem;