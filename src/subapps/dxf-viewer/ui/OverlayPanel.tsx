'use client';

import React from 'react';
import { Square, Eye, EyeOff, Palette, MousePointer2 } from 'lucide-react';
import { useOverlayManager } from '../state/overlay-manager';
import type { RegionStatus } from '../types/overlay';
import { STATUS_COLORS_MAPPING, getStatusColors } from '../config/color-mapping';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { PANEL_TOKENS } from '../config/panel-tokens';
import { useDynamicBackgroundClass } from '@/components/ui/utils/dynamic-styles';
import { REGION_STATUS_LABELS } from '../../../constants/statuses';

interface OverlayPanelProps {
  isDrawingMode: boolean;
  drawingStatus: RegionStatus;
  onStartDrawing: (status: RegionStatus) => void;
  onStopDrawing: () => void;
}

// 🎯 ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΟ: Χρησιμοποιούμε τα centralized constants αντί για διάσπαρτα
// Τα STATUS_LABELS τώρα έρχονται από REGION_STATUS_LABELS στο constants/statuses.ts

export function OverlayPanel({ isDrawingMode, drawingStatus, onStartDrawing, onStopDrawing }: OverlayPanelProps) {
  const { 
    visibleRegions, 
    selectedRegionIds,
    toggleRegionVisibility,
    selectRegion,
    clearSelection 
  } = useOverlayManager();

  const regionsByStatus = visibleRegions.reduce((acc, region) => {
    if (!acc[region.status]) acc[region.status] = [];
    acc[region.status].push(region);
    return acc;
  }, {} as Record<RegionStatus, typeof visibleRegions>);

  return (
    <div className="space-y-4 p-4 border-t border-gray-700">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white flex items-center gap-2">
          <Square className="w-4 h-4" />
          Περιοχές Επικάλυψης
        </h3>
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <span>Περιοχές: {visibleRegions.length}</span>
          <span>•</span>
          <span>Επιλεγμένες: {selectedRegionIds.length}</span>
        </div>
      </div>

      {/* Show/Hide Controls */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" defaultChecked className="rounded" />
          <Eye className="w-4 h-4" />
          <span className="text-gray-300">Εμφάνιση Χερουλιών</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" defaultChecked className="rounded" />
          <Palette className="w-4 h-4" />
          <span className="text-gray-300">Εμφάνιση Ετικετών</span>
        </label>
      </div>

      {/* Status Filter */}
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-gray-400 uppercase">Φίλτρο Κατάστασης</h4>
        {Object.entries(STATUS_COLORS_MAPPING).map(([status, colors]) => {
          const regions = regionsByStatus[status as RegionStatus] || [];

          // 🎨 ENTERPRISE DYNAMIC STYLING - NO INLINE STYLES (CLAUDE.md compliant)
          const colorBgClass = useDynamicBackgroundClass(colors.fill);

          return (
            <div key={status} className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm">
                <div
                  className={`w-3 h-3 rounded-full ${colorBgClass}`}
                />
                <span className="text-gray-300">{REGION_STATUS_LABELS[status as RegionStatus]}</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{regions.length}</span>
                <button className={`text-gray-400 ${INTERACTIVE_PATTERNS.TEXT_HOVER}`}>
                  <Eye className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Instructions */}
      <div className={PANEL_TOKENS.OVERLAY_PANEL.INFO_SECTION.BASE}>
        <div className="text-xs text-gray-300">
          • Κλικ για επιλογή περιοχών
        </div>
        <div className="text-xs text-gray-300">
          • Δεξί κλικ κατά τη σχεδίαση για τέλος
        </div>
        <div className="text-xs text-gray-300">
          • Σύρετε χερούλια για επεξεργασία
        </div>
      </div>
    </div>
  );
}
