'use client';

import React, { useState, useCallback } from 'react';
import { Building, Tag, Palette, Eye, EyeOff, Settings, Info } from 'lucide-react';
import { useTranslationLazy } from '@/i18n/hooks/useTranslationLazy';
import { INTERACTIVE_PATTERNS, HOVER_TEXT_EFFECTS, HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import {
  PropertyStatus,
  ENHANCED_STATUS_LABELS as PROPERTY_STATUS_LABELS,
  ENHANCED_STATUS_COLORS as PROPERTY_STATUS_COLORS,
  getAllEnhancedStatuses as getAllStatuses
} from '@/constants/property-statuses-enterprise';
import { STATUS_COLORS_MAPPING } from '@/subapps/dxf-viewer/config/color-mapping';
import { layoutUtilities } from '@/styles/design-tokens';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';

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

  // 🏢 ENTERPRISE: Get status color using centralized useSemanticColors system
  const getStatusColor = useCallback((status: PropertyStatus): string => {
    // Map PropertyStatus to semantic color patterns
    switch (status) {
      case 'available':
      case 'active':
        return colors.getStatusColor('active', 'text'); // Green active color
      case 'sold':
      case 'completed':
        return colors.getStatusColor('completed', 'text'); // Blue completed color
      case 'reserved':
      case 'pending':
        return colors.getStatusColor('pending', 'text'); // Yellow pending color
      case 'unavailable':
      case 'cancelled':
        return colors.getStatusColor('cancelled', 'text'); // Red cancelled color
      default:
        return colors.getStatusColor('inactive', 'text'); // Gray fallback
    }
  }, [colors]);

  // Check if status is visible
  const isStatusVisible = useCallback((status: PropertyStatus): boolean => {
    return selectedStatuses.includes(status);
  }, [selectedStatuses]);

  // ✅ ENTERPRISE: Return loading state while translations load (AFTER all hooks)
  if (isLoading) {
    return (
      <div className={`${colors.patterns.card.standard} p-4 ${className}`}>
        <div className="animate-pulse">
          <div className={`h-6 ${colors.bg.secondary} rounded mb-4`}></div>
          <div className={`h-32 ${colors.bg.secondary} rounded`}></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${colors.patterns.card.standard} p-4 ${className}`}>
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <h3 className={`text-lg font-semibold ${colors.text.primary} flex items-center gap-2`}>
            <Building className={`${iconSizes.md} ${colors.text.info}`} />
            {t('propertyStatusManager.title')}
          </h3>
          <button
            onClick={() => setShowLegend(!showLegend)}
            className={`p-2 ${colors.text.secondary} ${HOVER_TEXT_EFFECTS.DARKER} transition-colors`}
            title="Toggle Legend"
          >
            {showLegend ? <Eye className={iconSizes.sm} /> : <EyeOff className={iconSizes.sm} />}
          </button>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          {t('propertyStatusManager.subtitle')}
        </p>
      </div>

      {/* Color Scheme Selector */}
      <div className="mb-4">
        <label className="text-sm font-medium text-gray-700 mb-2 block flex items-center gap-2">
          <Palette className={iconSizes.sm} />
          {t('propertyStatusManager.colorScheme.title')}
        </label>
        <div className="flex gap-2">
          <button
            onClick={() => handleColorSchemeChange('status')}
            className={`px-3 py-2 text-sm rounded-md font-medium transition-colors ${
              colorScheme === 'status'
                ? 'bg-blue-100 text-blue-700 border border-blue-300'
                : `bg-gray-100 text-gray-600 ${HOVER_BACKGROUND_EFFECTS.LIGHT}`
            }`}
          >
            {t('propertyStatusManager.colorScheme.status')}
          </button>
          <button
            onClick={() => handleColorSchemeChange('price')}
            className={`px-3 py-2 text-sm rounded-md font-medium transition-colors ${
              colorScheme === 'price'
                ? 'bg-blue-100 text-blue-700 border border-blue-300'
                : `bg-gray-100 text-gray-600 ${HOVER_BACKGROUND_EFFECTS.LIGHT}`
            }`}
          >
            {t('propertyStatusManager.colorScheme.price')}
          </button>
          <button
            onClick={() => handleColorSchemeChange('type')}
            className={`px-3 py-2 text-sm rounded-md font-medium transition-colors ${
              colorScheme === 'type'
                ? 'bg-blue-100 text-blue-700 border border-blue-300'
                : `bg-gray-100 text-gray-600 ${HOVER_BACKGROUND_EFFECTS.LIGHT}`
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
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Tag className={iconSizes.sm} />
              {t('propertyStatusManager.statusCategories')}
            </label>
            <button
              onClick={handleSelectAll}
              className={`text-xs text-blue-600 ${HOVER_TEXT_EFFECTS.DARKER} font-medium`}
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
                  className={`flex items-center gap-3 p-2 rounded-md border transition-all ${
                    isVisible
                      ? 'bg-gray-50 border-gray-300'
                      : 'bg-gray-25 border-gray-200 opacity-60'
                  }`}
                >
                  {/* Color Indicator */}
                  <div
                    className={`${iconSizes.sm} rounded border-2 border-white shadow-sm`}
                    style={layoutUtilities.dxf.colors.backgroundColor(statusColor)}
                  />

                  {/* Status Label */}
                  <span className={`flex-1 text-sm font-medium ${isVisible ? 'text-gray-900' : 'text-gray-500'}`}>
                    {PROPERTY_STATUS_LABELS[status]}
                  </span>

                  {/* Visibility Toggle */}
                  <button
                    onClick={() => handleStatusToggle(status)}
                    className={`p-1 rounded transition-colors ${
                      isVisible
                        ? `text-blue-600 ${HOVER_TEXT_EFFECTS.DARKER}`
                        : `text-gray-400 ${HOVER_TEXT_EFFECTS.DARKER}`
                    }`}
                    title={isVisible ? t('propertyStatusManager.hide') : t('propertyStatusManager.show')}
                  >
                    {isVisible ? <Eye className={iconSizes.sm} /> : <EyeOff className={iconSizes.sm} />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Statistics */}
      <div className={`bg-blue-50 ${quick.card} border-blue-200 p-3`}>
        <div className="flex items-center gap-2 mb-2">
          <Info className={`${iconSizes.sm} text-blue-600`} />
          <span className="text-sm font-medium text-blue-900">{t('propertyStatusManager.statistics.title')}</span>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-blue-700">{t('propertyStatusManager.statistics.visibleStatus')}</span>
            <span className="ml-2 font-semibold text-blue-900">{selectedStatuses.length}/{getAllStatuses().length}</span>
          </div>
          <div>
            <span className="text-blue-700">{t('propertyStatusManager.statistics.scheme')}</span>
            <span className="ml-2 font-semibold text-blue-900">{t(`propertyStatusManager.colorScheme.${colorScheme}`)}</span>
          </div>
        </div>
      </div>

      {/* Usage Instructions */}
      <div className="mt-4 p-3 bg-gray-50 rounded-md">
        <p className="text-xs text-gray-600">
          <strong>{t('propertyStatusManager.tips.title')}</strong> {t('propertyStatusManager.tips.description')}
        </p>
      </div>
    </div>
  );
}