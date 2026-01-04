/**
 * USEPANELDESCRIPTION HOOK
 * Extracted from FloatingPanelContainer.tsx for ΒΗΜΑ 6 refactoring
 * Panel description and status logic
 */

import { useTranslationLazy } from '../../../../i18n/hooks/useTranslationLazy';
// 🏢 ENTERPRISE: Import from Single Source of Truth
import type { FloatingPanelType } from '../../types/panel-types';

interface UsePanelDescriptionParams {
  activePanel: FloatingPanelType;
  visibleRegions: unknown[];
  zoomLevel: number;
}

interface PanelDescriptionResult {
  description: string;
  zoomText: string;
}

/**
 * Custom hook για τη διαχείριση των panel descriptions και status info
 * Εξαγωγή από FloatingPanelContainer.tsx για καλύτερη οργάνωση
 */
export function usePanelDescription({
  activePanel,
  visibleRegions,
  zoomLevel
}: UsePanelDescriptionParams): PanelDescriptionResult {

  const { t } = useTranslationLazy('dxf-viewer');

  // ✅ Panel description logic
  const getDescription = (): string => {
    switch (activePanel) {
      case 'overlay':
        return t('panels.overlay.description', {
          regionCount: visibleRegions.length
        });

      case 'levels':
        return t('panels.levels.description');

      case 'hierarchy':
        return t('panels.hierarchy.description');

      // 🏢 ENTERPRISE: 'layers' case removed - not in FloatingPanelType
      // See types/panel-types.ts for valid panel types

      case 'colors':
        return 'Ρυθμίσεις DXF - Γραμμές, Χρώματα, Κείμενο, Grips και Εμφάνιση';

      default:
        return '';
    }
  };

  // ✅ Zoom level formatting
  const getZoomText = (): string => {
    return `Zoom: ${Math.round(zoomLevel * 100)}%`;
  };

  return {
    description: getDescription(),
    zoomText: getZoomText()
  };
}