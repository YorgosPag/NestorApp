// 🌐 i18n: All labels converted to i18n keys - 2026-01-19
'use client';
import React from 'react';
import { useIconSizes } from '../../../hooks/useIconSizes';
import { useBorderTokens } from '../../../hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useDraggable } from '../../../hooks/useDraggable';
// 🏢 ENTERPRISE: Shadcn Tooltip (replaces native title attribute)
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n';
// import { Separator } from '../../../components/ui/separator';
// Προσωρινή λύση - αντικατάσταση με div
const Separator = ({ orientation, className }: { orientation?: string; className?: string }) => (
  <div className={className} />
);
import { Pen, X, Copy, Grid, Square, Circle, Triangle, Edit, RotateCcw, RotateCw } from 'lucide-react';
import { STATUS_LABELS, KIND_LABELS, OVERLAY_STATUS_KEYS, type Status, type OverlayKind, type OverlayEditorMode } from '../overlays/types';
import type { PropertyStatus } from '../../../constants/property-statuses-enterprise';
import { useUnifiedOverlayCreation } from '../hooks/overlay/useUnifiedOverlayCreation';
import { toolStyleStore, type ToolStyle } from '../stores/ToolStyleStore';
import { getKindFromLabel } from '../config/color-mapping';
import { UI_COLORS } from '../config/color-config';
import { useOverlayStore } from '../overlays/overlay-store';
import { INTERACTIVE_PATTERNS, HOVER_BACKGROUND_EFFECTS } from '../../../components/ui/effects';
import {
  getStatusColorButtonStyles
} from './DxfViewerComponents.styles';
// 🏢 ENTERPRISE: Import centralized panel spacing (Single Source of Truth)
import { PANEL_LAYOUT } from '../config/panel-tokens';
import { portalComponents } from '@/styles/design-tokens';  // ✅ ENTERPRISE: Centralized z-index hierarchy
// ⌨️ ENTERPRISE: Centralized keyboard shortcuts - Single source of truth
import { getShortcutDisplayLabel } from '../config/keyboard-shortcuts';

interface OverlayToolbarProps {
  mode: OverlayEditorMode;
  onModeChange: (mode: OverlayEditorMode) => void;
  currentStatus: Status;
  onStatusChange: (status: Status) => void;
  currentKind: OverlayKind;
  onKindChange: (kind: OverlayKind) => void;
  snapEnabled: boolean;
  onSnapToggle: () => void;
  selectedOverlayId: string | null;
  onDuplicate: () => void;
  onDelete: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onToolChange?: (tool: string) => void; // 🔺 NEW: Callback για να ενημερώσει το global activeTool
  disableFloating?: boolean; // 🔺 NEW: Disable floating positioning when used inside DraggableOverlayToolbar
}

export const OverlayToolbar: React.FC<OverlayToolbarProps> = ({
  mode, onModeChange, currentStatus, onStatusChange, currentKind, onKindChange,
  snapEnabled, onSnapToggle, selectedOverlayId, onDuplicate, onDelete,
  canUndo, canRedo, onUndo, onRedo, onToolChange, disableFloating = false,
}) => {
  const { t } = useTranslation(['dxf-viewer', 'dxf-viewer-settings', 'dxf-viewer-wizard', 'dxf-viewer-guides', 'dxf-viewer-panels', 'dxf-viewer-shell']);
  const iconSizes = useIconSizes();
  const { quick, radius, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const { startOverlayCreation } = useUnifiedOverlayCreation();
  const overlayStore = useOverlayStore();

  // Συγχρονισμός toolbar με επιλεγμένο overlay
  // 🏢 ENTERPRISE (2026-01-26): Use overlayStore.overlays directly instead of deprecated getSelectedOverlay() - ADR-030
  React.useEffect(() => {
    if (selectedOverlayId) {
      const selectedOverlay = overlayStore.overlays[selectedOverlayId];
      if (selectedOverlay) {
        // Ενημέρωση εργαλειοθήκης με status του επιλεγμένου overlay
        if (selectedOverlay.status && selectedOverlay.status !== currentStatus) {
          onStatusChange(selectedOverlay.status);
        }

        // Ενημέρωση kind με getKindFromLabel για να χειριστούμε ελληνικά labels
        if (selectedOverlay.kind) {
          const mappedKind = getKindFromLabel(selectedOverlay.kind);
          if (mappedKind && mappedKind !== currentKind) {
            onKindChange(mappedKind);
          }
        }
      }
    }
  }, [selectedOverlayId, overlayStore.overlays, currentStatus, currentKind, onStatusChange, onKindChange]);

  // 🏢 ENTERPRISE: i18n-enabled mode buttons
  // ⌨️ ENTERPRISE: Hotkeys from centralized keyboard-shortcuts.ts
  const modeButtons = [
    { mode: 'draw' as OverlayEditorMode, icon: Pen, label: t('toolbar.draw'), key: getShortcutDisplayLabel('overlayDraw') },
    { mode: 'edit' as OverlayEditorMode, icon: Edit, label: t('toolbar.edit'), key: getShortcutDisplayLabel('overlayEdit') },
  ];

  const kindIcons = { property: Square, parking: Circle, storage: Triangle, footprint: Grid };

  const handleModeChange = (newMode: OverlayEditorMode) => {
    if (newMode === 'draw') {
      // 🎯 ENTERPRISE: Set activeTool to 'polygon' so DrawingContextMenu appears (right-click → Close)
      onToolChange?.('polygon');
      // Ενημέρωση του overlayMode state πρώτα για toolbar visibility
      onModeChange(newMode);
      
      // 🎨 ADR-258: drawing color is status-neutral until the layer is linked
      // to an entity. After linking, useOverlayLayers repaints with the live
      // commercialStatus color (ADR-340 part 10). Avoids clash with for-rent blue.
      const toolStyle = {
        strokeColor: UI_COLORS.LAYER_DRAFT_STROKE,
        fillColor: UI_COLORS.LAYER_DRAFT_FILL,
        lineWidth: 2,
        opacity: 1,
        lineType: 'solid'
      };
      toolStyleStore.set(toolStyle as Partial<ToolStyle>);

      const polylineControlPromise = startOverlayCreation({
        status: currentStatus,        // Μεταβίβαση επιλεγμένου status
        kind: currentKind,           // Μεταβίβαση επιλεγμένου kind
        onComplete: (overlayId) => {
          onToolChange?.('layering'); // Επιστροφή σε layering mode
          onModeChange('select'); // επιστροφή σε select
        },
        onCancel: () => {
          onToolChange?.('layering'); // Επιστροφή σε layering mode
          onModeChange('select');
        }
      });

      // Αποθήκευση του stop callback για double-click handling (async)
      // 🏢 ENTERPRISE: Type-safe callback using inferred type from startOverlayCreation
      polylineControlPromise?.then((polylineControl) => {
        if (polylineControl && 'stop' in polylineControl && typeof polylineControl.stop === 'function') {
          toolStyleStore.setOverlayCompletionCallback(() => {
            polylineControl.stop();
          });
        }
      });
    } else {
      // Για select/edit modes, επιστροφή σε layering mode
      onToolChange?.('layering');
      onModeChange(newMode);
    }
  };

  // 🎯 DRAGGABLE FUNCTIONALITY
  const {
    position: dragPosition,
    isDragging,
    elementRef,
    handleMouseDown
  } = useDraggable(!disableFloating, {
    elementWidth: 400,
    elementHeight: 60,
    autoCenter: true
  });

  const draggableStyles: React.CSSProperties = disableFloating ? {} : {
    left: dragPosition.x,
    top: dragPosition.y,
    transform: 'none', // Override center transform when dragging
    cursor: isDragging ? 'grabbing' : 'auto',
    zIndex: portalComponents.overlay.controls.zIndex()  // ✅ ENTERPRISE: Centralized z-index (80)
  };

  return (
    <TooltipProvider>
      <div
        ref={elementRef}
        style={draggableStyles}
        className={`${disableFloating ? 'relative' : 'fixed'} flex items-center ${PANEL_LAYOUT.GAP.SM} ${PANEL_LAYOUT.SPACING.SM} ${colors.bg.secondary} ${quick.card} flex-wrap ${PANEL_LAYOUT.SHADOW.XL} ${PANEL_LAYOUT.SELECT.NONE} ${PANEL_LAYOUT.POINTER_EVENTS.AUTO}`}
        onMouseEnter={(e) => e.stopPropagation()}
        onMouseMove={(e) => e.stopPropagation()}
        onMouseLeave={(e) => e.stopPropagation()}
      >
        {/* Drag Handle */}
        {!disableFloating && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                onMouseDown={handleMouseDown}
                className={`${PANEL_LAYOUT.CURSOR.GRAB} active:${PANEL_LAYOUT.CURSOR.GRABBING} ${PANEL_LAYOUT.SPACING.XS} ${colors.bg.hover} ${radius.md}`}
              >
                <div className={`${iconSizes.xs} ${iconSizes.sm} ${colors.bg.active} ${quick.button}`} />
              </div>
            </TooltipTrigger>
            <TooltipContent>{t('toolbar.dragToMove')}</TooltipContent>
          </Tooltip>
        )}
        {/* Drawing Modes */}
        <div className={`flex items-center ${PANEL_LAYOUT.GAP.XS}`}>
          {modeButtons.map(({ mode: btnMode, icon: Icon, label, key }) => (
            <Tooltip key={btnMode}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleModeChange(btnMode)}
                  className={`
                    ${PANEL_LAYOUT.HEIGHT.XL} ${PANEL_LAYOUT.SPACING.HORIZONTAL_SM} ${quick.button} ${PANEL_LAYOUT.TRANSITION.COLORS} ${PANEL_LAYOUT.DURATION['150']}
                    flex items-center justify-center ${PANEL_LAYOUT.GAP.XS}
                    ${mode === btnMode
                      ? `${colors.bg.info} ${colors.text.inverted} ${getStatusBorder('info')} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER}`
                      : `${colors.bg.secondary} ${colors.text.secondary} ${getStatusBorder('default')} ${HOVER_BACKGROUND_EFFECTS.MUTED}`
                    }
                  `}
                >
                  {Icon ? <Icon className={iconSizes.sm} /> : <span className={PANEL_LAYOUT.TYPOGRAPHY.XS}>?</span>}
                  <span className={`hidden sm:inline ${PANEL_LAYOUT.TYPOGRAPHY.XS}`}>{label}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>{`${label} (${key})`}</TooltipContent>
            </Tooltip>
          ))}
        </div>

      <Separator orientation="vertical" className={`${iconSizes.lg} ${quick.separatorV}`} />

        {/* Status Palette */}
        <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
          <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.muted}`}>{t('toolbar.status')}</span>
          <div className={`flex items-center ${PANEL_LAYOUT.GAP.XS}`}>
            {OVERLAY_STATUS_KEYS.map(status => (
              <Tooltip key={status}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onStatusChange(status)}
                    className={`${iconSizes.lg} ${quick.button} ${quick.card} ${PANEL_LAYOUT.TRANSITION.ALL} ${PANEL_LAYOUT.DURATION['150']}`}
                    style={getStatusColorButtonStyles(
                      status as PropertyStatus,
                      currentStatus === status
                    )}
                  />
                </TooltipTrigger>
                <TooltipContent>{t(STATUS_LABELS[status])}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>

      <Separator orientation="vertical" className={`${iconSizes.lg} ${quick.separatorV}`} />

        {/* Kind Selection */}
        <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
          <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.muted}`}>{t('toolbar.type')}</span>
          <div className={`flex items-center ${PANEL_LAYOUT.GAP.XS}`}>
            {(Object.keys(KIND_LABELS) as OverlayKind[]).map(kind => {
              const Icon = kindIcons[kind];
              return (
                <Tooltip key={kind}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => onKindChange(kind)}
                      className={`
                        ${iconSizes.xl} ${PANEL_LAYOUT.SPACING.NONE} ${quick.button} ${PANEL_LAYOUT.TRANSITION.COLORS} ${PANEL_LAYOUT.DURATION['150']}
                        flex items-center justify-center
                        ${currentKind === kind
                          ? `${colors.bg.info} ${colors.text.inverted} ${getStatusBorder('info')} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER}`
                          : `${colors.bg.secondary} ${colors.text.secondary} ${getStatusBorder('default')} ${HOVER_BACKGROUND_EFFECTS.MUTED}`
                        }
                      `}
                    >
                      {Icon ? <Icon className={iconSizes.sm} /> : <span className={PANEL_LAYOUT.TYPOGRAPHY.XS}>?</span>}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{t(KIND_LABELS[kind])}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>

      <Separator orientation="vertical" className={`${iconSizes.lg} ${quick.separatorV}`} />

        {/* Actions */}
        <div className={`flex items-center ${PANEL_LAYOUT.GAP.XS}`}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onDuplicate}
                disabled={!selectedOverlayId}
                className={`
                  ${iconSizes.xl} ${PANEL_LAYOUT.SPACING.NONE} ${quick.button} ${PANEL_LAYOUT.TRANSITION.COLORS} ${PANEL_LAYOUT.DURATION['150']}
                  flex items-center justify-center
                  ${colors.bg.secondary} ${colors.text.secondary} ${getStatusBorder('default')}
                  disabled:${PANEL_LAYOUT.OPACITY['50']} disabled:${PANEL_LAYOUT.CURSOR.NOT_ALLOWED}
                `}
              >
                <Copy className={iconSizes.sm} />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t('toolbar.duplicate', { key: getShortcutDisplayLabel('overlayDuplicate') })}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onDelete}
                disabled={!selectedOverlayId}
                className={`
                  ${iconSizes.xl} ${PANEL_LAYOUT.SPACING.NONE} ${quick.button} ${PANEL_LAYOUT.TRANSITION.COLORS} ${PANEL_LAYOUT.DURATION['150']}
                  flex items-center justify-center
                  ${colors.bg.secondary} ${colors.text.error} ${getStatusBorder('default')}
                  disabled:${PANEL_LAYOUT.OPACITY['50']} disabled:${PANEL_LAYOUT.CURSOR.NOT_ALLOWED}
                `}
              >
                <X className={iconSizes.sm} />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t('toolbar.delete', { key: getShortcutDisplayLabel('delete') })}</TooltipContent>
          </Tooltip>
        </div>

      <Separator orientation="vertical" className={`${iconSizes.lg} ${quick.separatorV}`} />

        {/* Undo/Redo */}
        <div className={`flex items-center ${PANEL_LAYOUT.GAP.XS}`}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onUndo}
                disabled={!canUndo}
                className={`
                  ${iconSizes.xl} ${PANEL_LAYOUT.SPACING.NONE} ${quick.button} ${PANEL_LAYOUT.TRANSITION.COLORS} ${PANEL_LAYOUT.DURATION['150']}
                  flex items-center justify-center
                  ${colors.bg.secondary} ${colors.text.secondary} ${getStatusBorder('default')}
                  disabled:${PANEL_LAYOUT.OPACITY['50']} disabled:${PANEL_LAYOUT.CURSOR.NOT_ALLOWED}
                `}
              >
                <RotateCcw className={iconSizes.sm} />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t('toolbar.undo', { key: getShortcutDisplayLabel('undo') })}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onRedo}
                disabled={!canRedo}
                className={`
                  ${iconSizes.xl} ${PANEL_LAYOUT.SPACING.NONE} ${quick.button} ${PANEL_LAYOUT.TRANSITION.COLORS} ${PANEL_LAYOUT.DURATION['150']}
                  flex items-center justify-center
                  ${colors.bg.secondary} ${colors.text.secondary} ${getStatusBorder('default')}
                  disabled:${PANEL_LAYOUT.OPACITY['50']} disabled:${PANEL_LAYOUT.CURSOR.NOT_ALLOWED}
                `}
              >
                <RotateCw className={iconSizes.sm} />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t('toolbar.redo', { key: getShortcutDisplayLabel('redo') })}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
};

