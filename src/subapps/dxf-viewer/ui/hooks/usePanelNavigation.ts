/**
 * USEPANELNAVIGATION HOOK
 * Extracted from FloatingPanelContainer.tsx for ΒΗΜΑ 4 refactoring
 * Panel navigation and content rendering logic
 */

import { useMemo } from 'react';
import type { PanelType } from './useFloatingPanelState';

export interface PanelNavigationMethods {
  getDisabledPanels: () => Partial<Record<PanelType, boolean>>;
  handleTabClick: (panel: PanelType) => void;
  isTabDisabled: (panel: PanelType) => boolean;
}

interface UsePanelNavigationParams {
  setActivePanel: (panel: PanelType) => void;
}

/**
 * Custom hook για τη διαχείριση του panel navigation του FloatingPanelContainer
 * Εξαγωγή από FloatingPanelContainer.tsx για καλύτερη οργάνωση
 */
export function usePanelNavigation({
  setActivePanel
}: UsePanelNavigationParams): PanelNavigationMethods {

  // ✅ Panel disabled state logic
  const getDisabledPanels = (): Partial<Record<PanelType, boolean>> => {
    return {};
  };

  const disabledPanels = useMemo(() => getDisabledPanels(), []);

  // ✅ Tab click handler
  const handleTabClick = (panel: PanelType) => {
    if (disabledPanels[panel]) return;
    setActivePanel(panel);
  };

  // ✅ Check if tab is disabled
  const isTabDisabled = (panel: PanelType): boolean => {
    return !!disabledPanels[panel];
  };

  return {
    getDisabledPanels,
    handleTabClick,
    isTabDisabled,
  };
}