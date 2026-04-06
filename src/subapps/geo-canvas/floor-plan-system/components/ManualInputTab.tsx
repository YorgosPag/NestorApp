/**
 * MANUAL INPUT TAB - Control Point Manual Entry
 *
 * Sub-component of FloorPlanControlPointPicker
 * Provides manual coordinate input form for DXF + Geo coordinates
 *
 * @module floor-plan-system/components/ManualInputTab
 * Extracted from FloorPlanControlPointPicker.tsx (ADR-065 Phase 3, #13)
 */

import React from 'react';
import { CheckCircle } from 'lucide-react';
import { useTranslationLazy } from '@/i18n/hooks/useTranslationLazy';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useIconSizes } from '@/hooks/useIconSizes';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { GEOGRAPHIC_CONFIG } from '@/config/geographic-config';

/**
 * Manual input form state
 */
export interface ManualInputState {
  dxfX: string;
  dxfY: string;
  geoLng: string;
  geoLat: string;
  accuracy: string;
  description: string;
}

export const MANUAL_INPUT_INITIAL: ManualInputState = {
  dxfX: '',
  dxfY: '',
  geoLng: '',
  geoLat: '',
  accuracy: '1.0',
  description: ''
};

interface ManualInputTabProps {
  manualInput: ManualInputState;
  onInputChange: (updater: (prev: ManualInputState) => ManualInputState) => void;
  onAddManualPoint: () => void;
}

export const ManualInputTab: React.FC<ManualInputTabProps> = ({
  manualInput,
  onInputChange,
  onAddManualPoint
}) => {
  const { t } = useTranslationLazy('geo-canvas');
  const { quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();

  const isFormValid = !!(manualInput.dxfX && manualInput.dxfY && manualInput.geoLng && manualInput.geoLat);

  return (
    <div className="mb-4">
      <p className={`text-sm ${colors.text.muted} mb-4`}>
        {t('floorPlanControlPoints.manualInput.description')}
      </p>

      {/* DXF Coordinates */}
      <div className={`mb-4 p-3 ${quick.card} ${getStatusBorder('default')}`}>
        <h4 className={`text-sm font-semibold mb-2 ${colors.text.muted}`}>
          {t('floorPlanControlPoints.manualInput.dxfCoordinates')}
        </h4>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={`block text-xs ${colors.text.muted} mb-1`}>DXF X:</label>
            <input
              type="number"
              step="any"
              value={manualInput.dxfX}
              onChange={(e) => onInputChange(prev => ({ ...prev, dxfX: e.target.value }))}
              className={`w-full px-2 py-1 text-sm ${quick.input} ${getStatusBorder('default')} focus:${getStatusBorder('info')} focus:outline-none`}
              placeholder="0.00"
            />
          </div>
          <div>
            <label className={`block text-xs ${colors.text.muted} mb-1`}>DXF Y:</label>
            <input
              type="number"
              step="any"
              value={manualInput.dxfY}
              onChange={(e) => onInputChange(prev => ({ ...prev, dxfY: e.target.value }))}
              className={`w-full px-2 py-1 text-sm ${quick.input} ${getStatusBorder('default')} focus:${getStatusBorder('info')} focus:outline-none`}
              placeholder="0.00"
            />
          </div>
        </div>
      </div>

      {/* Geo Coordinates */}
      <div className={`mb-4 p-3 ${quick.card} ${getStatusBorder('default')}`}>
        <h4 className={`text-sm font-semibold mb-2 ${colors.text.muted}`}>
          {t('floorPlanControlPoints.manualInput.geoCoordinates')}
        </h4>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={`block text-xs ${colors.text.muted} mb-1`}>
              {t('floorPlanControlPoints.manualInput.longitude')}:
            </label>
            <input
              type="number"
              step="any"
              value={manualInput.geoLng}
              onChange={(e) => onInputChange(prev => ({ ...prev, geoLng: e.target.value }))}
              className={`w-full px-2 py-1 text-sm ${quick.input} ${getStatusBorder('default')} focus:${getStatusBorder('info')} focus:outline-none`}
              placeholder={GEOGRAPHIC_CONFIG.DEFAULT_LONGITUDE.toString()}
            />
          </div>
          <div>
            <label className={`block text-xs ${colors.text.muted} mb-1`}>
              {t('floorPlanControlPoints.manualInput.latitude')}:
            </label>
            <input
              type="number"
              step="any"
              value={manualInput.geoLat}
              onChange={(e) => onInputChange(prev => ({ ...prev, geoLat: e.target.value }))}
              className={`w-full px-2 py-1 text-sm ${quick.input} ${getStatusBorder('default')} focus:${getStatusBorder('info')} focus:outline-none`}
              placeholder={GEOGRAPHIC_CONFIG.DEFAULT_LATITUDE.toString()}
            />
          </div>
        </div>
      </div>

      {/* Accuracy & Description */}
      <div className="mb-4 grid grid-cols-2 gap-2">
        <div>
          <label className={`block text-xs ${colors.text.muted} mb-1`}>Accuracy (m):</label>
          <input
            type="number"
            step="0.1"
            value={manualInput.accuracy}
            onChange={(e) => onInputChange(prev => ({ ...prev, accuracy: e.target.value }))}
            className={`w-full px-2 py-1 text-sm ${quick.input} ${getStatusBorder('default')} focus:${getStatusBorder('info')} focus:outline-none`}
            placeholder="1.0"
          />
        </div>
        <div>
          <label className={`block text-xs ${colors.text.muted} mb-1`}>Description:</label>
          <input
            type="text"
            value={manualInput.description}
            onChange={(e) => onInputChange(prev => ({ ...prev, description: e.target.value }))}
            className={`w-full px-2 py-1 text-sm ${quick.input} ${getStatusBorder('default')} focus:${getStatusBorder('info')} focus:outline-none`}
            placeholder="Optional description"
          />
        </div>
      </div>

      {/* Manual Add Button */}
      <button
        onClick={onAddManualPoint}
        className={`w-full px-4 py-2 ${colors.bg.success} text-white rounded ${INTERACTIVE_PATTERNS.SUCCESS_HOVER} transition-colors text-sm font-medium`}
        disabled={!isFormValid}
      >
        <CheckCircle className={`${iconSizes.xs} inline-block mr-1.5`} />
        {t('floorPlanControlPoints.manualInput.addPoint')}
      </button>
    </div>
  );
};
