'use client';

import * as React from 'react';
const { useState, useCallback } = React;
import { Tag, Palette, Eye, EyeOff, Settings, Info } from 'lucide-react';
// 🏢 ENTERPRISE: Centralized navigation entities for building icon
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { useTranslationLazy } from '../../../i18n/hooks/useTranslationLazy';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
// ✅ ENTERPRISE: Mock effects για compilation - θα συνδεθεί με πραγματικό effects system
const INTERACTIVE_PATTERNS = {
  PRIMARY_HOVER: 'hover:bg-blue-700',
  SUBTLE_HOVER: 'hover:bg-gray-100'
};

const HOVER_TEXT_EFFECTS = {
  DARKER: 'hover:text-opacity-80'
};

const HOVER_BACKGROUND_EFFECTS = {
  LIGHT: 'hover:bg-opacity-10'
};
import {
  EnhancedPropertyStatus as PropertyStatus,
  ENHANCED_STATUS_LABELS as PROPERTY_STATUS_LABELS,
  ENHANCED_STATUS_COLORS as PROPERTY_STATUS_COLORS,
  getAllEnhancedStatuses as getAllStatuses
} from '../../../constants/property-statuses-enterprise';
// STATUS_COLORS_MAPPING removed - not used in component
// layoutUtilities removed - not used in component
import { useIconSizes } from '../../../hooks/useIconSizes';
import { useSemanticColors } from '../../../ui-adapters/react/useSemanticColors';
import { useBorderTokens } from '../../../hooks/useBorderTokens';

interface PropertyStatusManagerProps {
  onStatusChange?: (newStatus: PropertyStatus) => void;
  onColorSchemeChange?: (scheme: 'status' | 'price' | 'type') => void;
  onLayerVisibilityChange?: (statusList: PropertyStatus[], visible: boolean) => void;
  className?: string;
}

/**
 * 🏠 Property Status Manager - Phase 2.5 Real Estate Innovation
 *
 * Enterprise component για property status management και color-coded visualization.
 * Supports:
 * - Status selection and filtering
 * - Color scheme management
 * - Layer visibility controls
 * - Real-time preview
 *
 * Integration με το centralized STATUS_COLORS_MAPPING system.
 */
export function PropertyStatusManager({
  onStatusChange,
  onColorSchemeChange,
  onLayerVisibilityChange,
  className = ''
}: PropertyStatusManagerProps) {
  // ✅ ENTERPRISE: All hooks must be declared BEFORE any conditional returns
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  const { t, isLoading } = useTranslationLazy('geo-canvas');
  const [selectedStatuses, setSelectedStatuses] = useState<PropertyStatus[]>(getAllStatuses());
  const [colorScheme, setColorScheme] = useState<'status' | 'price' | 'type'>('status');
  const [showLegend, setShowLegend] = useState(true);
  // 🏢 ENTERPRISE: Use centralized building icon
  const BuildingIcon = NAVIGATION_ENTITIES.building.icon;

  // Handle status visibility toggle
  const handleStatusToggle = useCallback((status: PropertyStatus) => {
    const newSelection = selectedStatuses.includes(status)
      ? selectedStatuses.filter(s => s !== status)
      : [...selectedStatuses, status];

    setSelectedStatuses(newSelection);
    onLayerVisibilityChange?.(newSelection, true);
  }, [selectedStatuses, onLayerVisibilityChange]);

  // Handle color scheme change
  const handleColorSchemeChange = useCallback((scheme: 'status' | 'price' | 'type') => {
    setColorScheme(scheme);
    onColorSchemeChange?.(scheme);
  }, [onColorSchemeChange]);

  // Handle select all/none
  const handleSelectAll = useCallback(() => {
    const newSelection = selectedStatuses.length === getAllStatuses().length ? [] : getAllStatuses();
    setSelectedStatuses(newSelection);
    onLayerVisibilityChange?.(newSelection, true);
  }, [selectedStatuses, onLayerVisibilityChange]);

  // ✅ ENTERPRISE: Get status color using centralized COLOR_BRIDGE system
  const getStatusColor = useCallback((status: PropertyStatus): string => {
    // Map EnhancedPropertyStatus to semantic color patterns via COLOR_BRIDGE
    switch (status) {
      case 'for-sale':
      case 'for-rent':
      case 'coming-soon':
        return colors.text.success; // Green available color
      case 'sold':
      case 'rented':
        return colors.text.info; // Blue completed color
      case 'reserved':
      case 'under-negotiation':
        return colors.text.warning; // Yellow pending color
      case 'unavailable':
      case 'off-market':
        return colors.text.error; // Red cancelled color
      default:
        return colors.text.muted; // Gray fallback
    }
  }, [colors]);

  // Check if status is visible
  const isStatusVisible = useCallback((status: PropertyStatus): boolean => {
    return selectedStatuses.includes(status);
  }, [selectedStatuses]);

  // ✅ ENTERPRISE: Return loading state while translations load (AFTER all hooks)
  if (isLoading) {
    return (
      <div className={`${colors.bg.card} p-4 ${className}`}>
        <div className="animate-pulse">
          <div className={`h-6 ${colors.bg.secondary} rounded mb-4`}></div>
          <div className={`h-32 ${colors.bg.secondary} rounded`}></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${colors.bg.card} p-4 ${className}`}>
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <h3 className={`text-lg font-semibold ${colors.text.primary} flex items-center gap-2`}>
            <BuildingIcon className={`${iconSizes.md} ${NAVIGATION_ENTITIES.building.color}`} />
            {t('propertyStatusManager.title')}
          </h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setShowLegend(!showLegend)}
                className={`p-2 ${colors.text.secondary} ${HOVER_TEXT_EFFECTS.DARKER} transition-colors`}
              >
                {showLegend ? <Eye className={iconSizes.sm} /> : <EyeOff className={iconSizes.sm} />}
              </button>
            </TooltipTrigger>
            <TooltipContent>Toggle Legend</TooltipContent>
          </Tooltip>
        </div>
        <p className={`text-sm ${colors.text.secondary} mt-1`}>
          {t('propertyStatusManager.subtitle')}
        </p>
      </div>

      {/* Color Scheme Selector */}
      <div className="mb-4">
        <label className={`text-sm font-medium ${colors.text.primary} mb-2 block flex items-center gap-2`}>
          <Palette className={iconSizes.sm} />
          {t('propertyStatusManager.colorScheme.title')}
        </label>
        <div className="flex gap-2">
          <button
            onClick={() => handleColorSchemeChange('status')}
            className={`px-3 py-2 text-sm rounded-md font-medium transition-colors ${
              colorScheme === 'status'
                ? `${colors.bg.infoSubtle} ${colors.text.info} ${quick.info}`
                : `${colors.bg.neutralSubtle} ${colors.text.secondary} ${HOVER_BACKGROUND_EFFECTS.LIGHT}`
            }`}
          >
            {t('propertyStatusManager.colorScheme.status')}
          </button>
          <button
            onClick={() => handleColorSchemeChange('price')}
            className={`px-3 py-2 text-sm rounded-md font-medium transition-colors ${
              colorScheme === 'price'
                ? `${colors.bg.infoSubtle} ${colors.text.info} ${quick.info}`
                : `${colors.bg.neutralSubtle} ${colors.text.secondary} ${HOVER_BACKGROUND_EFFECTS.LIGHT}`
            }`}
          >
            {t('propertyStatusManager.colorScheme.price')}
          </button>
          <button
            onClick={() => handleColorSchemeChange('type')}
            className={`px-3 py-2 text-sm rounded-md font-medium transition-colors ${
              colorScheme === 'type'
                ? `${colors.bg.infoSubtle} ${colors.text.info} ${quick.info}`
                : `${colors.bg.neutralSubtle} ${colors.text.secondary} ${HOVER_BACKGROUND_EFFECTS.LIGHT}`
            }`}
          >
            {t('propertyStatusManager.colorScheme.type')}
          </button>
        </div>
      </div>

      {/* Status Legend & Controls */}
      {showLegend && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <label className={`text-sm font-medium ${colors.text.primary} flex items-center gap-2`}>
              <Tag className={iconSizes.sm} />
              {t('propertyStatusManager.statusCategories')}
            </label>
            <button
              onClick={handleSelectAll}
              className={`text-xs ${colors.text.info} ${HOVER_TEXT_EFFECTS.DARKER} font-medium`}
            >
              {selectedStatuses.length === getAllStatuses().length
                ? t('propertyStatusManager.selectNone')
                : t('propertyStatusManager.selectAll')}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">
            {getAllStatuses().map((status) => {
              const isVisible = isStatusVisible(status);
              const statusColor = getStatusColor(status);

              return (
                <div
                  key={status}
                  className={`flex items-center gap-3 p-2 rounded-md ${colors.border.default} transition-all ${
                    isVisible
                      ? colors.bg.secondary
                      : `${colors.bg.secondary} opacity-60`
                  }`}
                >
                  {/* Color Indicator */}
                  <div
                    className={`${iconSizes.sm} rounded border border-white shadow-sm`}
                    style={{ backgroundColor: statusColor }}
                  />

                  {/* Status Label */}
                  <span className={`flex-1 text-sm font-medium ${isVisible ? colors.text.primary : colors.text.secondary}`}>
                    {PROPERTY_STATUS_LABELS[status]}
                  </span>

                  {/* Visibility Toggle */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => handleStatusToggle(status)}
                        className={`p-1 rounded transition-colors ${
                          isVisible
                            ? `${colors.text.info} ${HOVER_TEXT_EFFECTS.DARKER}`
                            : `${colors.text.muted} ${HOVER_TEXT_EFFECTS.DARKER}`
                        }`}
                      >
                        {isVisible ? <Eye className={iconSizes.sm} /> : <EyeOff className={iconSizes.sm} />}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{isVisible ? t('propertyStatusManager.hide') : t('propertyStatusManager.show')}</TooltipContent>
                  </Tooltip>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Statistics */}
      <div className={`${colors.bg.infoSubtle} ${colors.border.info} p-3`}>
        <div className="flex items-center gap-2 mb-2">
          <Info className={`${iconSizes.sm} ${colors.text.info}`} />
          <span className={`text-sm font-medium ${colors.text.info}`}>{t('propertyStatusManager.statistics.title')}</span>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className={colors.text.info}>{t('propertyStatusManager.statistics.visibleStatus')}</span>
            <span className={`ml-2 font-semibold ${colors.text.info}`}>{selectedStatuses.length}/{getAllStatuses().length}</span>
          </div>
          <div>
            <span className={colors.text.info}>{t('propertyStatusManager.statistics.scheme')}</span>
            <span className={`ml-2 font-semibold ${colors.text.info}`}>{t(`propertyStatusManager.colorScheme.${colorScheme}`)}</span>
          </div>
        </div>
      </div>

      {/* Usage Instructions */}
      <div className={`mt-4 p-3 ${colors.bg.secondary} rounded-md`}>
        <p className={`text-xs ${colors.text.secondary}`}>
          <strong>{t('propertyStatusManager.tips.title')}</strong> {t('propertyStatusManager.tips.description')}
        </p>
      </div>
    </div>
  );
}