/**
 * 🏢 ENTERPRISE POLYGON SYSTEM CONTEXT HOOK
 * Access to centralized polygon system context
 *
 * @module polygon-system/hooks
 */

import { useContext } from 'react';
import { PolygonSystemContext as PolygonContext } from '../providers/PolygonSystemProvider';
import type { PolygonSystemContext } from '../types/polygon-system.types';

/**
 * Hook to access polygon system context
 *
 * @throws Error if used outside PolygonSystemProvider
 * @returns PolygonSystemContext
 */
export function usePolygonSystemContext(): PolygonSystemContext {
  const context = useContext(PolygonContext);

  if (!context) {
    throw new Error(
      'usePolygonSystemContext must be used within a PolygonSystemProvider. ' +
      'Make sure to wrap your components with <PolygonSystemProvider>.'
    );
  }

  return context;
}