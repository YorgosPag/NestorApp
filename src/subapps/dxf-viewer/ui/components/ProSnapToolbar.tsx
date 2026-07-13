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
import { useTranslation } from '@/i18n';
import type { TFunction } from 'i18next';

// 🏢 ENTERPRISE: Snap mode key mapping for i18n
// Key format for nested BIM labels: value "bim.foo" resolves to snapModes.labels.bim.foo
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
  [ExtendedSnapType.ORTHO_TRACK]: 'ortho',
  [ExtendedSnapType.GUIDE]: 'guide',              // ADR-189: Construction guide snap
  [ExtendedSnapType.CONSTRUCTION_POINT]: 'constructionPoint', // ADR-189 §3.7-3.16
  [ExtendedSnapType.DIM_DEF_POINT]: 'dimDefPoint', // ADR-362 I1
  [ExtendedSnapType.DIM_LINE]: 'dimLine',           // ADR-362 I1
  // ADR-597: generic BIM characteristic-point toggles (per-entity label «Γωνία/Μέσο/Κέντρο
  // τοίχου…» comes from the candidate description, not the toolbar toggle).
  [ExtendedSnapType.BIM_CORNER]:         'bim.corner',
  [ExtendedSnapType.BIM_MIDPOINT]:       'bim.midpoint',
  [ExtendedSnapType.BIM_CENTER]:         'bim.center',
  // ADR-363 Slice 2i: wall face-to-face magnetism snap — nested i18n path
  [ExtendedSnapType.BIM_WALL_FACE]:      'bim.wallFace',
  // ADR-408 Φ9: MEP connector attach-point snap — nested i18n path
  [ExtendedSnapType.BIM_MEP_CONNECTOR]:  'bim.mepConnector',
  // ADR-378 Phase 3: TEXT/MTEXT 8-point snap — flat label key (sub-keys for individual points in snapModes.labels.text.*)
  [ExtendedSnapType.TEXT]: 'text',
  // ADR-397: rotation snap modes — contextual (not shown in the toolbar lists), keyed for type completeness + future panel use.
  [ExtendedSnapType.ROTATION_PIVOT]: 'rotationPivot',
  [ExtendedSnapType.ROTATION_GRIP]: 'rotationGrip',
  // ADR-580: selected-object grips snap — contextual/always-on (not a toolbar toggle), keyed for type completeness.
  [ExtendedSnapType.SELECTED_GRIP]: 'selectedGrip',
  // ADR-642 §6.8: complex-linetype pattern-geometry snaps (railway rails + sleepers) — keyed
  // for type completeness (label keys exist under snapModes.labels.complex_*).
  [ExtendedSnapType.COMPLEX_ENDPOINT]: 'complex_endpoint',
  [ExtendedSnapType.COMPLEX_MIDPOINT]: 'complex_midpoint',
  [ExtendedSnapType.COMPLEX_INTERSECTION]: 'complex_intersection',
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
  ExtendedSnapType.TEXT,        // ADR-378: TEXT/MTEXT 8-point snap (visible toggle)
  ExtendedSnapType.NEAR,
  ExtendedSnapType.ORTHO_TRACK
];

// ADR-363 Phase 5.5i + ADR-597: BIM structural snap modes (column/wall/beam/slab/opening corners).
// Shown in the advanced panel when at least one BIM entity exists on the canvas.
const BIM_MODES = [
  ExtendedSnapType.BIM_MEP_CONNECTOR, // ADR-408 Φ9: MEP connector attach point
  // ADR-597: BIM_CORNER / BIM_MIDPOINT / BIM_CENTER are always-on structural snaps
  // (force-enabled with OSNAP, no per-mode toggle) — see SnapContext.ALWAYS_ON_BIM_SNAPS.
];

interface ProSnapToolbarProps {
  enabledModes: Set<ExtendedSnapType>;
  onToggleMode: (mode: ExtendedSnapType, enabled: boolean) => void;
  /** If omitted, the master SNAP toggle button is hidden (CadStatusBar OSNAP is the canonical toggle). */
  snapEnabled?: boolean;
  onToggleSnap?: (enabled: boolean) => void;
  /**
   * Κατ. 1β — εμφάνιση/απόκρυψη των κυανών «Αποστάσεων» (listening dimensions) του line-tool ghost
   * (ADR-508 §line-cyan). ΔΕΝ είναι snap-mode → ξεχωριστό κουμπί, όχι μέλος των CORE/ADVANCED/BIM.
   * Render μόνο όταν ο caller (CadStatusBar) περνά το `onToggleListeningDim`.
   */
  listeningDimOn?: boolean;
  onToggleListeningDim?: () => void;
  className?: string;
  compact?: boolean;
}


export const ProSnapToolbar: React.FC<ProSnapToolbarProps> = ({
  enabledModes,
  onToggleMode,
  snapEnabled,
  onToggleSnap,
  listeningDimOn,
  onToggleListeningDim,
  className = '',
  compact = false,
}) => {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  // 🌐 i18n
  const { t } = useTranslation(['dxf-viewer', 'dxf-viewer-settings', 'dxf-viewer-wizard', 'dxf-viewer-guides', 'dxf-viewer-panels', 'dxf-viewer-shell']);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleMasterToggle = useCallback(() => {
    if (onToggleSnap !== undefined) onToggleSnap(!(snapEnabled ?? false));
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
  const advancedEnabledCount = useMemo(
    () => [...ADVANCED_MODES, ...BIM_MODES].filter(mode => enabledModes?.has(mode)).length,
    [enabledModes],
  );

  // SSoT for a SnapButton row — CORE / ADVANCED / BIM groups all render the SAME button
  // (enabled = membership in `enabledModes`, onClick = toggle). ADR-583 (N.18): one place,
  // no per-group copy-paste. `compactBtn` differs only between the core row (follows the
  // toolbar `compact` prop) and the advanced/BIM rows (always compact).
  const renderSnapButtons = useCallback(
    (modes: ExtendedSnapType[], compactBtn: boolean) =>
      modes.map(mode => (
        <SnapButton
          key={mode}
          mode={mode}
          enabled={enabledModes?.has(mode) || false}
          onClick={() => handleModeToggle(mode)}
          compact={compactBtn}
          t={t}
        />
      )),
    [enabledModes, handleModeToggle, t],
  );

  return (
    <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM} ${PANEL_LAYOUT.SPACING.SM} ${colors.bg.primary} ${quick.card} ${className}`}>
      {/* Master SNAP toggle — shown only when caller passes snapEnabled/onToggleSnap (e.g. CadDock panel) */}
      {onToggleSnap !== undefined && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={(snapEnabled ?? false) ? 'default' : 'ghost'}
              size="sm"
              onClick={handleMasterToggle}
              className={`${PANEL_LAYOUT.GAP.XS} ${(snapEnabled ?? false) ? HOVER_TEXT_EFFECTS.CYAN : ''}`}
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
      )}

      {/* 🏢 ENTERPRISE: Core snap modes */}
      <div className={`flex ${PANEL_LAYOUT.GAP.XS}`}>
        {renderSnapButtons(CORE_MODES, compact)}
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

      {/* Κατ. 1β — κυανές «Αποστάσεις» (listening dims) visibility toggle. Ξεχωριστό
          κουμπί (όχι snap-mode) — ADR-508 §line-cyan. */}
      {onToggleListeningDim !== undefined && (
        <>
          <div className={`w-px ${PANEL_LAYOUT.HEIGHT.LG} ${colors.bg.muted}`} />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={listeningDimOn ? 'default' : 'ghost'}
                size="sm"
                onClick={onToggleListeningDim}
                className={`${compact ? 'h-7 px-2 text-xs' : 'h-8 px-3 text-sm'} ${listeningDimOn ? HOVER_TEXT_EFFECTS.CYAN : ''}`}
              >
                <span className={`${PANEL_LAYOUT.SELECT.NONE} ${PANEL_LAYOUT.TEXT_OVERFLOW.TRUNCATE}`}>
                  {t('dxf-viewer-panels:cadDock.statusBar.listeningDim')}
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('dxf-viewer-panels:cadDock.statusBar.listeningDimDesc')}</TooltipContent>
          </Tooltip>
        </>
      )}

      {/* 🏢 ENTERPRISE: Advanced modes panel */}
      {showAdvanced && (
        <div className={`flex ${PANEL_LAYOUT.GAP.XS} ${PANEL_LAYOUT.MARGIN.LEFT_XS} ${PANEL_LAYOUT.INPUT.PADDING_X} ${quick.separatorV}`}>
          {renderSnapButtons(ADVANCED_MODES, true)}
          {/* ADR-363 + ADR-597: BIM structural corner snaps — separator + BIM group */}
          <div className={`w-px ${PANEL_LAYOUT.HEIGHT.LG} ${colors.bg.muted}`} />
          {renderSnapButtons(BIM_MODES, true)}
        </div>
      )}
    </div>
  );
};

export default ProSnapToolbar;

