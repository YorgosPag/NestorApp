'use client';

import React from 'react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { Square, Eye, Palette } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';  // ✅ ENTERPRISE: Centralized Radix Checkbox
import { useOverlayManager } from '../state/overlay-manager';
import type { RegionStatus } from '../types/overlay';
import { STATUS_COLORS_MAPPING } from '../config/color-mapping';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { PANEL_TOKENS, PANEL_LAYOUT } from '../config/panel-tokens';
import { useDynamicBackgroundClass } from '@/components/ui/utils/dynamic-styles';
import { ENHANCED_STATUS_LABELS as REGION_STATUS_LABELS } from '../../../constants/property-statuses-enterprise';
import { groupByKey } from '@/utils/collection-utils';

interface OverlayPanelProps {
  isDrawingMode: boolean;
  drawingStatus: RegionStatus;
  onStartDrawing: (status: RegionStatus) => void;
  onStopDrawing: () => void;
}

// 🎯 ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΟ: Χρησιμοποιούμε τα centralized constants αντί για διάσπαρτα
// ✅ MIGRATED: STATUS_LABELS τώρα από REGION_STATUS_LABELS στο property-statuses-enterprise.ts

export function OverlayPanel({ isDrawingMode, drawingStatus, onStartDrawing, onStopDrawing }: OverlayPanelProps) {
  const iconSizes = useIconSizes();
  const { getStatusBorder, quick } = useBorderTokens();
  const semanticColors = useSemanticColors();
  const {
    visibleRegions, 
    selectedRegionIds,
    toggleRegionVisibility,
    selectRegion,
    clearSelection 
  } = useOverlayManager();

  const regionsByStatus = groupByKey(visibleRegions, region => region.status) as Record<RegionStatus, typeof visibleRegions>;

  return (
    <div className={`${PANEL_LAYOUT.SPACING.GAP_LG} ${PANEL_LAYOUT.SPACING.LG} ${getStatusBorder('default')} ${quick.card}`}>
      <div className="flex items-center justify-between">
        <h3 className={`${PANEL_LAYOUT.BUTTON.TEXT_SIZE} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${semanticColors.text.primary} flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
          <Square className={iconSizes.sm} />
          Περιοχές Επικάλυψης
        </h3>
        <div className={`flex items-center ${PANEL_LAYOUT.GAP.XS} ${PANEL_LAYOUT.BUTTON.TEXT_SIZE_XS} ${semanticColors.text.muted}`}>
          <span>Περιοχές: {visibleRegions.length}</span>
          <span>•</span>
          <span>Επιλεγμένες: {selectedRegionIds.length}</span>
        </div>
      </div>

      {/* Show/Hide Controls */}
      <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
        <label className={`flex items-center ${PANEL_LAYOUT.GAP.SM} ${PANEL_LAYOUT.BUTTON.TEXT_SIZE}`}>
          <Checkbox defaultChecked />
          <Eye className={iconSizes.sm} />
          <span className={semanticColors.text.tertiary}>Εμφάνιση Χερουλιών</span>
        </label>
        <label className={`flex items-center ${PANEL_LAYOUT.GAP.SM} ${PANEL_LAYOUT.BUTTON.TEXT_SIZE}`}>
          <Checkbox defaultChecked />
          <Palette className={iconSizes.sm} />
          <span className={semanticColors.text.tertiary}>Εμφάνιση Ετικετών</span>
        </label>
      </div>

      {/* Status Filter */}
      <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
        <h4 className={`${PANEL_LAYOUT.BUTTON.TEXT_SIZE_XS} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${semanticColors.text.muted} uppercase`}>Φίλτρο Κατάστασης</h4>
        {Object.entries(STATUS_COLORS_MAPPING).map(([status, statusColors]) => {
          const regions = regionsByStatus[status as RegionStatus] || [];

          // 🎨 ENTERPRISE DYNAMIC STYLING - NO INLINE STYLES (CLAUDE.md compliant)
          const colorBgClass = useDynamicBackgroundClass(statusColors.fill);

          return (
            <div key={status} className="flex items-center justify-between">
              <label className={`flex items-center ${PANEL_LAYOUT.GAP.SM} ${PANEL_LAYOUT.BUTTON.TEXT_SIZE}`}>
                <div
                  className={`${iconSizes.xs} ${quick.button} ${colorBgClass}`}
                />
                <span className={semanticColors.text.tertiary}>{REGION_STATUS_LABELS[status as RegionStatus]}</span>
              </label>
              <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
                <span className={`${PANEL_LAYOUT.BUTTON.TEXT_SIZE_XS} ${semanticColors.text.muted}`}>{regions.length}</span>
                <button className={`${semanticColors.text.muted} ${INTERACTIVE_PATTERNS.TEXT_HOVER}`}>
                  <Eye className={iconSizes.xs} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Instructions */}
      <div className={PANEL_TOKENS.OVERLAY_PANEL.INFO_SECTION.BASE}>
        <div className={`${PANEL_LAYOUT.BUTTON.TEXT_SIZE_XS} ${semanticColors.text.muted}`}>
          • Κλικ για επιλογή περιοχών
        </div>
        <div className={`${PANEL_LAYOUT.BUTTON.TEXT_SIZE_XS} ${semanticColors.text.muted}`}>
          • Δεξί κλικ κατά τη σχεδίαση για τέλος
        </div>
        <div className={`${PANEL_LAYOUT.BUTTON.TEXT_SIZE_XS} ${semanticColors.text.muted}`}>
          • Σύρετε χερούλια για επεξεργασία
        </div>
      </div>
    </div>
  );
}
