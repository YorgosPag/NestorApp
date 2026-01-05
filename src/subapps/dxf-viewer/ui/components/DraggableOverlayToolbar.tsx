'use client';

/**
 * 🏢 DRAGGABLE OVERLAY TOOLBAR
 *
 * Floating toolbar για overlay drawing και editing.
 * Χρησιμοποιεί:
 * - Centralized FloatingPanel compound component
 * - Centralized ToolButton/ActionButton components (ZERO inline styles)
 *
 * @version 4.0.0 - Enterprise Centralized Components Integration
 * @since 2026-01-02
 */

import React, { useEffect } from 'react';
import { Activity, Pen, Edit, Copy, RotateCcw, RotateCw, Square, Circle, Triangle, Grid, X } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { FloatingPanel } from '@/components/ui/floating';
import type { OverlayEditorMode, Status, OverlayKind } from '../../overlays/types';
import type { ToolType } from '../toolbar/types';
import type { PropertyStatus } from '../../../../constants/property-statuses-enterprise';
import { STATUS_COLORS, STATUS_LABELS, KIND_LABELS } from '../../overlays/types';
import { useUnifiedOverlayCreation } from '../../hooks/overlay/useUnifiedOverlayCreation';
import { toolStyleStore } from '../../stores/ToolStyleStore';
import { STATUS_COLORS_MAPPING, getKindFromLabel } from '../../config/color-mapping';
import { useOverlayStore } from '../../overlays/overlay-store';
import { getStatusColorButtonStyles } from '../DxfViewerComponents.styles';
// 🏢 ENTERPRISE: Centralized Button Components (ZERO inline styles)
import { ToolButton, ActionButton } from '../../components/shared/BaseButton';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { PANEL_LAYOUT } from '../../config/panel-tokens';

// ============================================================================
// CONSTANTS - Enterprise Design Tokens
// ============================================================================

const TOOLBAR_DIMENSIONS = {
  width: 300,
  height: 100
} as const;

const TOOLBAR_POSITION = {
  x: 450,
  y: 150
} as const;

// ============================================================================
// SEPARATOR COMPONENT - Semantic HTML
// ============================================================================

const Separator: React.FC<{ orientation?: 'horizontal' | 'vertical'; className?: string }> = ({
  orientation = 'horizontal',
  className
}) => (
  <div
    role="separator"
    aria-orientation={orientation}
    className={className}
  />
);

// ============================================================================
// TYPES
// ============================================================================

interface DraggableOverlayToolbarProps {
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
  onToolChange: (tool: ToolType) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const DraggableOverlayToolbar: React.FC<DraggableOverlayToolbarProps> = (props) => {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();

  // 🎯 OVERLAY CREATION & STORE HOOKS
  const { startOverlayCreation } = useUnifiedOverlayCreation();
  const overlayStore = useOverlayStore();

  // 🎯 TOOLBAR CONFIGURATION
  const modeButtons = [
    { mode: 'draw' as OverlayEditorMode, icon: Pen, label: 'Σχεδίαση', key: 'N' },
    { mode: 'edit' as OverlayEditorMode, icon: Edit, label: 'Επεξεργασία', key: 'E' },
  ];

  const kindIcons = { unit: Square, parking: Circle, storage: Triangle, footprint: Grid };

  // 🎯 MODE CHANGE HANDLER
  const handleModeChange = (newMode: OverlayEditorMode) => {
    if (newMode === 'draw') {
      props.onModeChange(newMode);

      const validStatus = Object.keys(STATUS_COLORS_MAPPING).includes(props.currentStatus as string)
        ? props.currentStatus as PropertyStatus
        : 'for-sale';
      const statusColors = STATUS_COLORS_MAPPING[validStatus];

      const toolStyle = {
        strokeColor: statusColors.stroke,
        fillColor: statusColors.fill,
        lineWidth: 2,
        opacity: 1,
        lineType: 'solid' as const
      };
      toolStyleStore.set(toolStyle);

      const polylineControlPromise = startOverlayCreation({
        status: props.currentStatus,
        kind: props.currentKind,
        onComplete: () => {
          props.onToolChange('layering');
          props.onModeChange('select');
        },
        onCancel: () => {
          props.onToolChange('layering');
          props.onModeChange('select');
        }
      });

      polylineControlPromise.then((polylineControl) => {
        if (polylineControl?.stop) {
          toolStyleStore.setOverlayCompletionCallback(() => {
            polylineControl.stop?.stop();
          });
        }
      }).catch((error) => {
        console.error('Error setting up overlay creation:', error);
      });
    } else {
      props.onToolChange('layering');
      props.onModeChange(newMode);
    }
  };

  // 🎯 SYNC TOOLBAR WITH SELECTED OVERLAY
  useEffect(() => {
    if (props.selectedOverlayId) {
      const selectedOverlay = overlayStore.getSelectedOverlay();
      if (selectedOverlay) {
        if (selectedOverlay.status && selectedOverlay.status !== props.currentStatus) {
          props.onStatusChange(selectedOverlay.status);
        }

        if (selectedOverlay.kind) {
          const mappedKind = getKindFromLabel(selectedOverlay.kind);
          if (mappedKind && mappedKind !== props.currentKind) {
            props.onKindChange(mappedKind);
          }
        }
      }
    }
  }, [props.selectedOverlayId, overlayStore, props.currentStatus, props.currentKind, props.onStatusChange, props.onKindChange]);

  return (
    <FloatingPanel
      defaultPosition={TOOLBAR_POSITION}
      dimensions={TOOLBAR_DIMENSIONS}
    >
      <FloatingPanel.Header
        title="Drawing Tools"
        icon={<Activity />}
        showClose={false}
      />
      <FloatingPanel.Content>
        {/* 🎯 TOOLBAR CONTROLS */}
        <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM} flex-wrap`}>
          {/* Drawing Modes - Using Centralized ToolButton */}
          <nav className={`flex items-center ${PANEL_LAYOUT.GAP.XS}`} aria-label="Drawing modes">
            {modeButtons.map(({ mode: btnMode, icon: Icon, label, key }) => (
              <ToolButton
                key={btnMode}
                onClick={() => handleModeChange(btnMode)}
                title={`${label} (${key})`}
                icon={Icon}
                isActive={props.mode === btnMode}
                size="sm"
              >
                <span className="hidden sm:inline">{label}</span>
              </ToolButton>
            ))}
          </nav>

          <Separator orientation="vertical" className={`${PANEL_LAYOUT.HEIGHT.LG} ${quick.separatorV}`} />

          {/* Status Palette */}
          <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
            <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} text-muted-foreground`}>Status:</span>
            <div className={`flex items-center ${PANEL_LAYOUT.GAP.XS}`}>
              {(Object.keys(STATUS_COLORS) as Status[]).map(status => (
                <button
                  key={status}
                  onClick={() => props.onStatusChange(status)}
                  title={STATUS_LABELS[status]}
                  className={`${iconSizes.lg} ${quick.button} ${quick.card} ${PANEL_LAYOUT.TRANSITION.ALL} ${PANEL_LAYOUT.DURATION['150']}`}
                  style={getStatusColorButtonStyles(
                    status as PropertyStatus,
                    props.currentStatus === status
                  )}
                />
              ))}
            </div>
          </div>

          <Separator orientation="vertical" className={`${PANEL_LAYOUT.HEIGHT.LG} ${quick.separatorV}`} />

          {/* Kind Selection - Using Centralized ToolButton */}
          <fieldset className={`flex items-center ${PANEL_LAYOUT.GAP.SM} border-none ${PANEL_LAYOUT.SPACING.NONE} ${PANEL_LAYOUT.MARGIN.NONE}`}>
            <legend className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} text-muted-foreground`}>Τύπος:</legend>
            <nav className={`flex items-center ${PANEL_LAYOUT.GAP.XS}`} aria-label="Overlay type">
              {(Object.keys(KIND_LABELS) as OverlayKind[]).map(kind => {
                const Icon = kindIcons[kind];
                return (
                  <ToolButton
                    key={kind}
                    onClick={() => props.onKindChange(kind)}
                    title={KIND_LABELS[kind]}
                    icon={Icon}
                    isActive={props.currentKind === kind}
                    size="xs"
                  />
                );
              })}
            </nav>
          </fieldset>

          <Separator orientation="vertical" className={`${PANEL_LAYOUT.HEIGHT.LG} ${quick.separatorV}`} />

          {/* Actions - Using Centralized ActionButton */}
          <nav className={`flex items-center ${PANEL_LAYOUT.GAP.XS}`} aria-label="Overlay actions">
            <ActionButton
              onClick={props.onDuplicate}
              disabled={!props.selectedOverlayId}
              title="Αντιγραφή (D)"
              icon={Copy}
              size="xs"
            />
            <ActionButton
              onClick={props.onDelete}
              disabled={!props.selectedOverlayId}
              title="Διαγραφή (Del)"
              icon={X}
              size="xs"
              className="text-destructive hover:text-destructive"
            />
          </nav>

          <Separator orientation="vertical" className={`${PANEL_LAYOUT.HEIGHT.LG} ${quick.separatorV}`} />

          {/* Undo/Redo - Using Centralized ActionButton */}
          <nav className={`flex items-center ${PANEL_LAYOUT.GAP.XS}`} aria-label="History controls">
            <ActionButton
              onClick={props.onUndo}
              disabled={!props.canUndo}
              title="Αναίρεση (Ctrl+Z)"
              icon={RotateCcw}
              size="xs"
            />
            <ActionButton
              onClick={props.onRedo}
              disabled={!props.canRedo}
              title="Επανάληψη (Ctrl+Y)"
              icon={RotateCw}
              size="xs"
            />
          </nav>
        </div>
      </FloatingPanel.Content>
    </FloatingPanel>
  );
};

export default DraggableOverlayToolbar;

/**
 * 🏢 ENTERPRISE COMPLIANCE:
 *
 * ✅ Uses centralized FloatingPanel compound component
 * ✅ Uses centralized ToolButton/ActionButton (ZERO inline styles)
 * ✅ Zero duplicate draggable logic
 * ✅ Proper TypeScript types
 * ✅ Semantic HTML (nav, fieldset, legend, role="separator")
 * ✅ ARIA labels for accessibility
 * ✅ Consistent with other floating panels
 * ✅ ~336 lines reduced to ~300 lines
 */
