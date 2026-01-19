'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Target, ChevronDown, ChevronUp, Settings } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { ExtendedSnapType } from '../../snapping/extended-types';
import { HOVER_BACKGROUND_EFFECTS, HOVER_BORDER_EFFECTS, HOVER_TEXT_EFFECTS } from '@/components/ui/effects';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { PANEL_LAYOUT } from '../../config/panel-tokens';
// 🏢 ENTERPRISE: i18n support
import { useTranslation, TFunction } from 'react-i18next';

// 🏢 ENTERPRISE: Snap mode key mapping for i18n
const SNAP_MODE_KEYS: Record<ExtendedSnapType, string> = {
  [ExtendedSnapType.AUTO]: 'auto',
  [ExtendedSnapType.ENDPOINT]: 'endpoint',
  [ExtendedSnapType.MIDPOINT]: 'midpoint',
  [ExtendedSnapType.CENTER]: 'center',
  [ExtendedSnapType.INTERSECTION]: 'intersection',
  [ExtendedSnapType.GRID]: 'grid',
  [ExtendedSnapType.PERPENDICULAR]: 'perpendicular',
  [ExtendedSnapType.TANGENT]: 'tangent',
  [ExtendedSnapType.PARALLEL]: 'parallel',
  [ExtendedSnapType.QUADRANT]: 'quadrant',
  [ExtendedSnapType.NEAREST]: 'nearest',
  [ExtendedSnapType.EXTENSION]: 'extension',
  [ExtendedSnapType.NODE]: 'node',
  [ExtendedSnapType.INSERTION]: 'insertion',
  [ExtendedSnapType.NEAR]: 'near',
  [ExtendedSnapType.ORTHO]: 'ortho'
};

// 🏢 ENTERPRISE: Get translated snap label
const getSnapLabel = (mode: ExtendedSnapType, t: TFunction): string => {
  const key = SNAP_MODE_KEYS[mode];
  return t(`snapModes.labels.${key}`);
};

// 🏢 ENTERPRISE: Get translated snap tooltip
const getSnapTooltip = (mode: ExtendedSnapType, t: TFunction): string => {
  const key = SNAP_MODE_KEYS[mode];
  return t(`snapModes.tooltips.${key}`);
};

interface SnapButtonProps {
  mode: ExtendedSnapType;
  enabled: boolean;
  onClick: () => void;
  compact?: boolean;
  t: TFunction;
}

const SnapButton: React.FC<SnapButtonProps> = ({ mode, enabled, onClick, compact = false, t }) => {
  const label = getSnapLabel(mode, t);
  const tooltip = getSnapTooltip(mode, t);
  const { quick, getStatusBorder, radius } = useBorderTokens();
  const colors = useSemanticColors();

  if (!label) return null;

  return (
    <button
      onClick={onClick}
      title={tooltip}
      className={`
        ${compact ? `${PANEL_LAYOUT.HEIGHT.LG} ${PANEL_LAYOUT.WIDTH.VALUE_DISPLAY} ${PANEL_LAYOUT.TYPOGRAPHY.XS}` : `${PANEL_LAYOUT.HEIGHT.XL} ${PANEL_LAYOUT.WIDTH.MD} ${PANEL_LAYOUT.TYPOGRAPHY.SM}`}
        ${radius.md} border ${PANEL_LAYOUT.TRANSITION.ALL} ${PANEL_LAYOUT.DURATION['150']} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}
        flex items-center justify-center
        ${enabled
          ? `${colors.bg.primary} ${getStatusBorder('info')} ${colors.text.primary} ${PANEL_LAYOUT.SHADOW.MD} ${HOVER_BACKGROUND_EFFECTS.PRIMARY}`
          : `${colors.bg.secondary} ${getStatusBorder('default')} ${colors.text.secondary} ${HOVER_BACKGROUND_EFFECTS.MUTED_DARK} ${HOVER_BORDER_EFFECTS.MUTED}`
        }
      `}
    >
      <span className={`${PANEL_LAYOUT.SELECT.NONE} ${PANEL_LAYOUT.TEXT_OVERFLOW.TRUNCATE}`}>{label}</span>
    </button>
  );
};

const CORE_MODES = [
  ExtendedSnapType.AUTO,
  ExtendedSnapType.ENDPOINT,
  ExtendedSnapType.MIDPOINT,
  ExtendedSnapType.CENTER,
  ExtendedSnapType.INTERSECTION
];

const ADVANCED_MODES = [
  ExtendedSnapType.GRID,
  ExtendedSnapType.PERPENDICULAR,
  ExtendedSnapType.TANGENT,
  ExtendedSnapType.PARALLEL,
  ExtendedSnapType.QUADRANT,
  ExtendedSnapType.NEAREST,
  ExtendedSnapType.EXTENSION,
  ExtendedSnapType.NODE,
  ExtendedSnapType.INSERTION,
  ExtendedSnapType.NEAR,
  ExtendedSnapType.ORTHO
];

interface ProSnapToolbarProps {
  enabledModes: Set<ExtendedSnapType>;
  onToggleMode: (mode: ExtendedSnapType, enabled: boolean) => void;
  snapEnabled: boolean;
  onToggleSnap: (enabled: boolean) => void;
  className?: string;
  compact?: boolean;
}


export const ProSnapToolbar: React.FC<ProSnapToolbarProps> = ({
  enabledModes,
  onToggleMode,
  snapEnabled,
  onToggleSnap,
  className = '',
  compact = false,
}) => {
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder, radius } = useBorderTokens();
  const colors = useSemanticColors();
  // 🌐 i18n
  const { t } = useTranslation('dxf-viewer');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleMasterToggle = useCallback(() => {
    onToggleSnap(!snapEnabled);
  }, [snapEnabled, onToggleSnap]);

  const handleModeToggle = useCallback((mode: ExtendedSnapType) => {
    onToggleMode(mode, !(enabledModes?.has(mode) || false));
  }, [enabledModes, onToggleMode]);

  const handleToggleAdvanced = useCallback(() => {
    setShowAdvanced(prev => !prev);
  }, []);

  const handleQuickEnable = useCallback(() => {
    CORE_MODES.forEach(mode => {
      if (!(enabledModes?.has(mode) || false)) {
        onToggleMode(mode, true);
      }
    });
  }, [enabledModes, onToggleMode]);

  const enabledCount = useMemo(() => enabledModes?.size || 0, [enabledModes]);
  const advancedEnabledCount = useMemo(() => ADVANCED_MODES.filter(mode => enabledModes?.has(mode)).length, [enabledModes]);
  
  return (
    <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM} ${PANEL_LAYOUT.SPACING.SM} ${colors.bg.primary} ${quick.card} ${className}`}>
      <button
        onClick={handleMasterToggle}
        className={`${PANEL_LAYOUT.SPACING.COMPACT} ${radius.md} ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.BOLD} ${PANEL_LAYOUT.TRANSITION.COLORS} border flex items-center ${PANEL_LAYOUT.GAP.XS} ${
          snapEnabled ? `${colors.bg.primary} ${colors.text.primary} ${getStatusBorder('info')} ${PANEL_LAYOUT.SHADOW.MD}` : `${colors.bg.secondary} ${colors.text.secondary} ${getStatusBorder('default')} ${HOVER_BACKGROUND_EFFECTS.MUTED_DARK}`
        }`}
        title={t('overlayToolbar.objectSnap')}
      >
        <Target size={14} />
        <span>SNAP</span>
        {enabledCount > 0 && <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.OPACITY['80']}`}>({enabledCount})</span>}
      </button>

      <div className={`flex ${PANEL_LAYOUT.GAP.XS}`}>
        {CORE_MODES.map(mode => (
          <SnapButton
            key={mode}
            mode={mode}
            enabled={enabledModes?.has(mode) || false}
            onClick={() => handleModeToggle(mode)}
            compact={compact}
            t={t}
          />
        ))}
      </div>

      {ADVANCED_MODES.length > 0 && (
        <>
          <div className={`w-px ${PANEL_LAYOUT.HEIGHT.LG} ${colors.bg.muted}`} />
          <button
            onClick={handleToggleAdvanced}
            className={`${iconSizes.xl} ${radius.md} border ${PANEL_LAYOUT.TRANSITION.ALL} ${PANEL_LAYOUT.DURATION['150']} flex items-center justify-center ${
              showAdvanced || advancedEnabledCount > 0 ? `${colors.bg.muted} ${getStatusBorder('subtle')} ${colors.text.primary}` : `${colors.bg.secondary} ${getStatusBorder('default')} ${colors.text.muted} ${HOVER_BACKGROUND_EFFECTS.MUTED_DARK}`
            }`}
            title={showAdvanced ? t('snapModes.ui.hideAdvanced') : t('snapModes.ui.showAdvanced')}
          >
            {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </>
      )}

      <div className={`w-px ${PANEL_LAYOUT.HEIGHT.LG} ${colors.bg.muted}`} />
      <button
        onClick={handleQuickEnable}
        className={`${iconSizes.xl} ${radius.md} border ${PANEL_LAYOUT.TRANSITION.ALL} ${PANEL_LAYOUT.DURATION['150']} flex items-center justify-center ${colors.text.muted} ${HOVER_TEXT_EFFECTS.WHITE} ${colors.bg.secondary} ${getStatusBorder('default')} ${HOVER_BACKGROUND_EFFECTS.MUTED_DARK}`}
        title={t('overlayToolbar.basicFunctions')}
      >
        <Settings size={14} />
      </button>

      {showAdvanced && (
        <div className={`flex ${PANEL_LAYOUT.GAP.XS} ${PANEL_LAYOUT.MARGIN.LEFT_XS} ${PANEL_LAYOUT.INPUT.PADDING_X} ${quick.separatorV}`}>
          {ADVANCED_MODES.map(mode => (
            <SnapButton
              key={mode}
              mode={mode}
              enabled={enabledModes?.has(mode) || false}
              onClick={() => handleModeToggle(mode)}
              compact={true}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ProSnapToolbar;
