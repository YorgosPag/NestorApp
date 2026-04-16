/**
 * USEPANELDESCRIPTION HOOK
 * Extracted from FloatingPanelContainer.tsx for ΒΗΜΑ 6 refactoring
 * Panel description and status logic
 */

import { useTranslationLazy } from '../../../../i18n/hooks/useTranslationLazy';
// 🏢 ENTERPRISE: Import from Single Source of Truth
import type { FloatingPanelType } from '../../types/panel-types';
// 🏢 ADR-081: Centralized percentage formatting
import { formatPercent } from '../../rendering/entities/shared/distance-label-utils';

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
  // ADR-309 Phase 1: 'hierarchy' and 'overlay' cases removed
  const getDescription = (): string => {
    switch (activePanel) {
      case 'levels':
        return t('panels.levels.description');

      case 'colors':
        return 'Ρυθμίσεις DXF - Γραμμές, Χρώματα, Κείμενο, Grips και Εμφάνιση';

      default:
        return '';
    }
  };

  // ✅ Zoom level formatting (ADR-081: Uses centralized formatPercent)
  const getZoomText = (): string => {
    return `Zoom: ${formatPercent(zoomLevel)}`;
  };

  return {
    description: getDescription(),
    zoomText: getZoomText()
  };
}