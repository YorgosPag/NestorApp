/**
 * DYNAMIC SYSTEM IMPORTS
 * Lazy loading utilities for DXF viewer systems to improve initial page load
 */

import dynamic from 'next/dynamic';
import React, { ComponentType } from 'react';

export const DynamicToolbarsSystem = dynamic(
  () => import('../systems/toolbars/ToolbarsSystem'),
  { 
    loading: () => React.createElement('div', { className: 'animate-pulse bg-muted rounded' }, 'Loading toolbars...'),
    ssr: false 
  }
);

export const DynamicRulersGridSystem = dynamic(
  () => import('../systems/rulers-grid/RulersGridSystem'),
  { 
    loading: () => React.createElement('div', { className: 'animate-pulse bg-muted rounded' }, 'Loading rulers/grid...'),
    ssr: false 
  }
);

export const DynamicConstraintsSystem = dynamic(
  () => import('../systems/constraints/ConstraintsSystem'),
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