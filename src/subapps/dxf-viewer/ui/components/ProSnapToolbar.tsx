'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Target, ChevronDown, ChevronUp, Settings } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { ExtendedSnapType } from '../../snapping/extended-types';
import { HOVER_TEXT_EFFECTS } from '@/components/ui/effects';
// 🏢 ENTERPRISE: Centralized Shadcn Button (same as CompactToolbar)
import { Button } from '@/components/ui/button';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { PANEL_LAYOUT } from '../../config/panel-tokens';
// 🏢 ENTERPRISE: Shadcn Tooltip for accessible tooltips
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

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

// 🏢 ENTERPRISE: SnapButton using Shadcn Button (same pattern as CompactToolbar)
const SnapButton: React.FC<SnapButtonProps> = ({ mode, enabled, onClick, compact = false, t }) => {
  const label = getSnapLabel(mode, t);
  const tooltip = getSnapTooltip(mode, t);
  const iconSizes = useIconSizes();

  if (!label) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={enabled ? 'default' : 'ghost'}
          size="sm"
          onClick={onClick}
          className={`
            ${compact ? 'h-7 px-2 text-xs' : 'h-8 px-3 text-sm'}
            ${enabled ? HOVER_TEXT_EFFECTS.CYAN : ''}
          `}
        >
          <span className={`${PANEL_LAYOUT.SELECT.NONE} ${PANEL_LAYOUT.TEXT_OVERFLOW.TRUNCATE}`}>
            {label}
          </span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
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
  const { quick } = useBorderTokens();
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
      {/* 🏢 ENTERPRISE: Master SNAP toggle - Shadcn Button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={snapEnabled ? 'default' : 'ghost'}
            size="sm"
            onClick={handleMasterToggle}
            className={`${PANEL_LAYOUT.GAP.XS} ${snapEnabled ? HOVER_TEXT_EFFECTS.CYAN : ''}`}
          >
            <Target className={`${iconSizes.sm} ${HOVER_TEXT_EFFECTS.CYAN}`} />
            <span className={PANEL_LAYOUT.FONT_WEIGHT.BOLD}>SNAP</span>
            {enabledCount > 0 && (
              <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.OPACITY['80']}`}>
                ({enabledCount})
              </span>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('overlayToolbar.objectSnap')}</TooltipContent>
      </Tooltip>

      {/* 🏢 ENTERPRISE: Core snap modes */}
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

      {/* 🏢 ENTERPRISE: Advanced modes toggle */}
      {ADVANCED_MODES.length > 0 && (
        <>
          <div className={`w-px ${PANEL_LAYOUT.HEIGHT.LG} ${colors.bg.muted}`} />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleAdvanced}
                className={`${iconSizes.xl} p-0 ${showAdvanced || advancedEnabledCount > 0 ? HOVER_TEXT_EFFECTS.PURPLE : ''}`}
              >
                {showAdvanced ? (
                  <ChevronUp className={`${iconSizes.sm} ${HOVER_TEXT_EFFECTS.PURPLE}`} />
                ) : (
                  <ChevronDown className={`${iconSizes.sm} ${HOVER_TEXT_EFFECTS.INDIGO}`} />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {showAdvanced ? t('snapModes.ui.hideAdvanced') : t('snapModes.ui.showAdvanced')}
            </TooltipContent>
          </Tooltip>
        </>
      )}

      {/* 🏢 ENTERPRISE: Settings button */}
      <div className={`w-px ${PANEL_LAYOUT.HEIGHT.LG} ${colors.bg.muted}`} />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleQuickEnable}
            className={`${iconSizes.xl} p-0`}
          >
            <Settings className={`${iconSizes.sm} ${HOVER_TEXT_EFFECTS.VIOLET}`} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('overlayToolbar.basicFunctions')}</TooltipContent>
      </Tooltip>

      {/* 🏢 ENTERPRISE: Advanced modes panel */}
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
