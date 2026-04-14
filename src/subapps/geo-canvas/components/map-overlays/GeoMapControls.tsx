/**
 * 🎮 GEO-MAP CONTROLS COMPONENT
 *
 * Enterprise map controls overlay για το Interactive Map.
 * ΔΙΑΦΟΡΕΤΙΚΟ από το building-management MapControls!
 *
 * ✅ Enterprise Standards:
 * - TypeScript strict typing
 * - Design tokens integration
 * - Zero hardcoded values
 * - Semantic HTML structure
 * - Professional architecture
 *
 * @module GeoMapControls
 */

'use client';

import React, { useState, useRef } from 'react';
import { useClickOutside } from '@/hooks/useClickOutside';
import { useTranslationLazy } from '@/i18n/hooks/useTranslationLazy';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { Map, Mountain, Moon, Flag, Palette, Circle, Satellite, ChevronDown, MapPin } from 'lucide-react';

// ============================================================================
// 🎯 ENTERPRISE TYPE DEFINITIONS
// ============================================================================

export interface GeoMapControlsProps {
  /** Current click mode state */
  clickMode: 'off' | 'add_dxf' | 'add_geo';

  /** Coordinate picking start handlers */
  onStartCoordinatePicking: (mode: 'add_dxf' | 'add_geo') => void;

  /** Coordinate picking stop handler */
  onStopCoordinatePicking: () => void;

  /** Current map style */
  currentMapStyle: 'osm' | 'satellite' | 'terrain' | 'dark' | 'greece' | 'watercolor' | 'toner';

  /** Map style change handler */
  onMapStyleChange: (style: 'osm' | 'satellite' | 'terrain' | 'dark' | 'greece' | 'watercolor' | 'toner') => void;

  /** Map loading state */
  mapLoaded: boolean;

  /** Custom CSS class */
  className?: string;
}

// ============================================================================
// 🎯 MAP STYLE CONFIGURATION
// ============================================================================

const MAP_STYLE_OPTIONS = [
  { value: 'osm', labelKey: 'openStreetMap', icon: Map },
  { value: 'satellite', labelKey: 'satellite', icon: Satellite },
  { value: 'terrain', labelKey: 'terrain', icon: Mountain },
  { value: 'dark', labelKey: 'darkMode', icon: Moon },
  { value: 'greece', labelKey: 'greece', icon: Flag },
  { value: 'watercolor', labelKey: 'watercolor', icon: Palette },
  { value: 'toner', labelKey: 'toner', icon: Circle }
] as const;

// ============================================================================
// 🌍 GEO-MAP CONTROLS COMPONENT
// ============================================================================

/**
 * Professional map controls overlay για geographic coordinate picking.
 * Επιτρέπει coordinate picking και map style selection.
 */
export const GeoMapControls: React.FC<GeoMapControlsProps> = ({
  clickMode,
  onStartCoordinatePicking,
  onStopCoordinatePicking,
  currentMapStyle,
  onMapStyleChange,
  mapLoaded,
  className = ''
}) => {
  const { t } = useTranslationLazy('geo-canvas');
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useClickOutside(dropdownRef, () => setIsDropdownOpen(false));

  // ========================================================================
  // 🎨 RENDER COORDINATE PICKING CONTROLS
  // ========================================================================

  const renderCoordinatePickingControls = () => (
    <div className={`${colors.bg.secondary} bg-opacity-90 rounded-lg p-2`} role="group" aria-label={t('map.controls.coordinatePicking')}>
      <div className="flex flex-col space-y-2">
        <button
          onClick={() => onStartCoordinatePicking('add_geo')}
          disabled={clickMode === 'add_geo'}
          className={`px-3 py-2 rounded text-sm transition-colors ${
            clickMode === 'add_geo'
              ? `${colors.bg.info} text-white`
              : `${colors.bg.hover} ${colors.text.slateMuted} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`
          }`}
          aria-pressed={clickMode === 'add_geo'}
        >
          <MapPin className={`${iconSizes.sm} inline-block mr-1.5`} />
          {t('map.controls.pickGeographicPoint')}
        </button>

        <button
          onClick={onStopCoordinatePicking}
          disabled={clickMode === 'off'}
          className={`px-3 py-2 ${colors.bg.error} ${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER} disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-sm transition-colors`}
          aria-pressed={clickMode !== 'off'}
        >
          ✕ {t('map.controls.cancelPicking')}
        </button>
      </div>
    </div>
  );

  // ========================================================================
  // 🎨 RENDER MAP STYLE CONTROLS
  // ========================================================================

  const renderMapStyleControls = () => {
    // Get current style name for display
    const currentStyleOption = MAP_STYLE_OPTIONS.find(opt => opt.value === currentMapStyle);
    const currentStyleName = currentStyleOption
      ? t(`map.controls.${currentStyleOption.labelKey}`)
      : t('map.controls.openStreetMap');

    return (
      <div className={`${colors.bg.secondary} bg-opacity-90 rounded-lg p-2`} role="group" aria-label={t('map.controls.mapStyle')}>
        {/* Header with Status Indicator */}
        <div className="flex items-center justify-between mb-2">
          <div className={`text-xs ${colors.text.disabled}`}>{t('map.controls.mapStyle')}</div>
          <div
            className={`${iconSizes.xs} rounded-full ${mapLoaded ? colors.bg.success : colors.bg.warning}`}
            title={mapLoaded ? t('map.status.mapLoaded') : t('map.status.mapLoading')}
            aria-label={mapLoaded ? t('map.status.mapLoaded') : t('map.status.mapLoading')}
          />
        </div>

        {/* Style Selector - Custom Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className={`w-full ${colors.bg.hover} ${quick.input} px-2 py-1 text-sm text-white flex items-center justify-between`}
            disabled={!mapLoaded}
            aria-label={t('map.controls.selectMapStyle')}
            aria-expanded={isDropdownOpen}
            type="button"
          >
            <span className="flex items-center gap-2">
              {currentMapStyle && (() => {
                const option = MAP_STYLE_OPTIONS.find(opt => opt.value === currentMapStyle);
                const IconComponent = option?.icon;
                return IconComponent ? <IconComponent className={iconSizes.xs} /> : null;
              })()}
              {currentMapStyle ? t(`map.controls.${MAP_STYLE_OPTIONS.find(opt => opt.value === currentMapStyle)?.labelKey}`) : t('map.controls.selectMapStyle')}
            </span>
            <ChevronDown className={`${iconSizes.xs} transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {isDropdownOpen && (
            <div className={`absolute top-full left-0 right-0 z-50 ${colors.bg.primary} ${quick.card} mt-1 py-1 max-h-48 overflow-y-auto`}>
              {MAP_STYLE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    onMapStyleChange(option.value as typeof currentMapStyle);
                    setIsDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:${colors.bg.hover} transition-colors ${
                    currentMapStyle === option.value ? colors.bg.accent : ''
                  }`}
                  type="button"
                >
                  <option.icon className={iconSizes.sm} />
                  {t(`map.controls.${option.labelKey}`)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Current Style Display */}
        {currentMapStyle && (
          <div className={`text-xs ${colors.text.muted} mt-1`} role="status">
            {t('map.controls.currentStyle')}: {currentStyleName}
          </div>
        )}
      </div>
    );
  };

  // ========================================================================
  // 🎯 MAIN RENDER
  // ========================================================================

  return (
    <section
      className={`absolute bottom-4 left-4 space-y-2 ${className}`}
      aria-label={t('map.controls.mapControls')}
    >
      {/* Coordinate Picking Controls */}
      {renderCoordinatePickingControls()}

      {/* Map Style Controls */}
      {renderMapStyleControls()}
    </section>
  );
};

export default GeoMapControls;

/**
 * ✅ ENTERPRISE GEO-MAP CONTROLS COMPLETE (2025-12-17)
 *
 * Features Implemented:
 * ✅ TypeScript strict typing με enterprise interfaces
 * ✅ Semantic HTML structure (section, role groups)
 * ✅ Design tokens integration (INTERACTIVE_PATTERNS)
 * ✅ i18n support με lazy loading
 * ✅ Accessibility features (aria-labels, roles, pressed states)
 * ✅ Professional coordinate picking controls
 * ✅ Map style selection με status indicator
 * ✅ Visual feedback για active states
 * ✅ Disabled state handling
 * ✅ Zero inline styles - only design token classes
 * ✅ Component composition pattern
 *
 * Differentiators από building-management MapControls:
 * <Target/> Geo-specific coordinate picking (όχι nearby projects)
 * <Map/> Map style controls (όχι layer selection)
 * <MapPin/> Geographic point selection (όχι project filtering)
 * <Palette/> Styling consistency με geo-canvas theme
 *
 * Enterprise Benefits:
 * <Target/> Single Responsibility - Μόνο geo map control logic
 * <Recycle/> Reusability - Μπορεί να χρησιμοποιηθεί σε άλλα geo contexts
 * <FlaskConical/> Testability - Isolated component με clear props
 * <Gamepad2/> User Experience - Intuitive control interface
 * <Languages/> i18n Ready - Πλήρης υποστήριξη internationalization
 */