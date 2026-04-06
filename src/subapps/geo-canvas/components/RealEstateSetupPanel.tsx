/**
 * REAL ESTATE SETUP PANEL
 *
 * Dialog for configuring real estate alerts (price range, property type)
 *
 * @module geo-canvas/components/RealEstateSetupPanel
 * Extracted from CitizenDrawingInterface.tsx (ADR-065 Phase 3, #16)
 */

import * as React from 'react';
import { MapPin, X, Bell } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslationLazy } from '@/i18n/hooks/useTranslationLazy';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { HOVER_BACKGROUND_EFFECTS, TRANSITION_PRESETS } from './citizen-drawing-types';

export interface RealEstateSettings {
  priceRange: { min: number; max: number };
  propertyTypes: string[];
  includeExclude: 'include' | 'exclude';
}

interface RealEstateSetupPanelProps {
  settings: RealEstateSettings;
  onSettingsChange: React.Dispatch<React.SetStateAction<RealEstateSettings>>;
  onStartDrawing: () => void;
  onClose: () => void;
}

export const RealEstateSetupPanel: React.FC<RealEstateSetupPanelProps> = ({
  settings,
  onSettingsChange,
  onStartDrawing,
  onClose
}) => {
  const { t } = useTranslationLazy('geo-canvas');
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();

  return (
    <div className={`mb-4 p-4 ${colors.bg.warning} ${quick.card}`}>
      <div className="flex items-center justify-between mb-3">
        <h4 className={`text-lg font-semibold ${colors.text.warning} flex items-center gap-2`}>
          <Bell className={iconSizes.md} />
          {t('drawingInterfaces.citizen.realEstateSetup.title')}
        </h4>
        <button onClick={onClose} className={`${colors.text.warning} ${HOVER_BACKGROUND_EFFECTS.WARNING_BUTTON}`}>
          <X className={iconSizes.md} />
        </button>
      </div>

      {/* Price Range */}
      <div className="mb-4">
        <label className={`block text-sm font-medium ${colors.text.warning} mb-2`}>
          {t('citizenDrawingInterface.priceRange.label')}
        </label>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            placeholder={t('drawingInterfaces.common.from')}
            value={settings.priceRange.min?.toString() || ''}
            onChange={(e) => onSettingsChange(prev => ({
              ...prev,
              priceRange: { ...prev.priceRange, min: Number(e.target.value) || 0 }
            }))}
            className={`px-3 py-2 ${quick.input} text-sm`}
          />
          <input
            type="number"
            placeholder={t('drawingInterfaces.common.to')}
            value={settings.priceRange.max?.toString() || ''}
            onChange={(e) => onSettingsChange(prev => ({
              ...prev,
              priceRange: { ...prev.priceRange, max: Number(e.target.value) || 500000 }
            }))}
            className={`px-3 py-2 ${quick.input} text-sm`}
          />
        </div>
      </div>

      {/* Property Type */}
      <div className="mb-4">
        <label className={`block text-sm font-medium ${colors.text.warning} mb-2`}>
          {t('drawingInterfaces.citizen.realEstateSetup.propertyType')}
        </label>
        <Select
          value={settings.propertyTypes[0] || 'apartment'}
          onValueChange={(val) => onSettingsChange(prev => ({ ...prev, propertyTypes: [val] }))}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="apartment">{t('drawingInterfaces.citizen.realEstateSetup.propertyTypes.apartment')}</SelectItem>
            <SelectItem value="house">{t('drawingInterfaces.citizen.realEstateSetup.propertyTypes.house')}</SelectItem>
            <SelectItem value="land">{t('drawingInterfaces.citizen.realEstateSetup.propertyTypes.land')}</SelectItem>
            <SelectItem value="commercial">{t('drawingInterfaces.citizen.realEstateSetup.propertyTypes.commercial')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={onStartDrawing}
          className={`flex-1 flex items-center justify-center gap-2 ${colors.bg.warning} ${colors.text.foreground} py-2 px-4 rounded-lg ${HOVER_BACKGROUND_EFFECTS.WARNING_BUTTON} ${TRANSITION_PRESETS.STANDARD_COLORS}`}
        >
          <MapPin className={iconSizes.sm} />
          <span className="text-sm font-medium">{t('drawingInterfaces.citizen.actions.drawArea')}</span>
        </button>
        <button
          onClick={onClose}
          className={`flex-1 flex items-center justify-center gap-2 ${colors.bg.muted} ${colors.text.muted} py-2 px-4 rounded-lg ${HOVER_BACKGROUND_EFFECTS.MUTED} ${TRANSITION_PRESETS.STANDARD_COLORS}`}
        >
          <X className={iconSizes.sm} />
          <span className="text-sm font-medium">{t('drawingInterfaces.citizen.actions.cancel')}</span>
        </button>
      </div>
    </div>
  );
};
