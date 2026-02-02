/**
 * DYNAMIC SYSTEM IMPORTS
 * Lazy loading utilities for DXF viewer systems to improve initial page load
 */

import dynamic from 'next/dynamic';
import React from 'react';
import type { ToolbarsSystemProps } from '../systems/toolbars/ToolbarsContext.types';
import type { RulersGridSystemProps } from '../systems/rulers-grid/types';
import type { ConstraintsSystemProps } from '../systems/constraints/ConstraintsSystem';

const EmptyToolbarsSystem: React.FC<ToolbarsSystemProps> = () => null;
const EmptyRulersGridSystem: React.FC<RulersGridSystemProps> = () => null;
const EmptyConstraintsSystem: React.FC<ConstraintsSystemProps> = () => null;

export const DynamicToolbarsSystem = dynamic<ToolbarsSystemProps>(
  () => import('../systems/toolbars/ToolbarsSystem').then(mod => ({ default: mod.ToolbarsSystem || EmptyToolbarsSystem })),
  {
    loading: () => React.createElement('div', { className: 'animate-pulse bg-muted rounded' }, 'Loading toolbars...'),
    ssr: false
  }
);

export const DynamicRulersGridSystem = dynamic<RulersGridSystemProps>(
  () => import('../systems/rulers-grid/RulersGridSystem').then(mod => ({ default: mod.RulersGridSystem || EmptyRulersGridSystem })),
  {
    loading: () => React.createElement('div', { className: 'animate-pulse bg-muted rounded' }, 'Loading rulers/grid...'),
    ssr: false
  }
);

export const DynamicConstraintsSystem = dynamic<ConstraintsSystemProps>(
  () => import('../systems/constraints/ConstraintsSystem').then(mod => ({ default: mod.ConstraintsSystem || EmptyConstraintsSystem })),
  {
    loading: () => React.createElement('div', { className: 'animate-pulse bg-muted rounded' }, 'Loading constraints...'),
    ssr: false
  }
);

// Note: LayeringSystem was removed as it was dead code

// Preload critical systems on idle
export const preloadCriticalSystems = () => {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    requestIdleCallback(() => {
      // Preload most commonly used systems
      import('../systems/toolbars/ToolbarsSystem');
      import('../systems/rulers-grid/RulersGridSystem');
    });
  }
};

// System priority loading based on usage frequency
export const SYSTEM_LOAD_PRIORITIES = {
  toolbars: 1,         // Most used
  'rulers-grid': 2,    // Commonly used
  selection: 1,        // Critical
  cursor: 1,           // Critical
  coordinates: 1,      // Critical
  viewport: 1,         // Critical
  levels: 2,           // Moderately used
  constraints: 3,      // Less frequently used
  history: 4,          // Background functionality
  rendering: 1         // Critical
} as const;
