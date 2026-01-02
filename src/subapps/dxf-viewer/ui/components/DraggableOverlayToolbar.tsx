'use client';

import React, { useState, useEffect } from 'react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { OverlayEditorMode, Status, OverlayKind } from '../../overlays/types';
import type { ToolType } from '../toolbar/types';
import type { PropertyStatus } from '../../../../constants/property-statuses-enterprise';
import { useDraggable } from '../../../../hooks/useDraggable';
import { Card, CardHeader, CardContent } from '../../../../components/ui/card';
import { Activity, X, Pen, Edit, Copy, RotateCcw, RotateCw, Square, Circle, Triangle, Grid } from 'lucide-react';
import { performanceMonitorUtilities } from '@/styles/design-tokens';
import { STATUS_COLORS, STATUS_LABELS, KIND_LABELS } from '../../overlays/types';
import { useUnifiedOverlayCreation } from '../../hooks/overlay/useUnifiedOverlayCreation';
import { toolStyleStore } from '../../stores/ToolStyleStore';
import { STATUS_COLORS_MAPPING, getKindFromLabel } from '../../config/color-mapping';
import { useOverlayStore } from '../../overlays/overlay-store';
import { INTERACTIVE_PATTERNS, HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { getStatusColorButtonStyles } from '../DxfViewerComponents.styles';

// ============================================================================
// CONSTANTS - Enterprise Design Tokens
// ============================================================================

const TOOLBAR_DIMENSIONS = {
  width: 300,
  height: 100,
  initialX: 450,  // Offset to avoid sidebar (assuming ~400px sidebar)
  initialY: 150
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

export const DraggableOverlayToolbar: React.FC<DraggableOverlayToolbarProps> = (props) => {
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();

  // ✅ ENTERPRISE: Hydration safety (same pattern as GlobalPerformanceDashboard)
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
      // Ενημέρωση του overlayMode state πρώτα για toolbar visibility
      props.onModeChange(newMode);

      // Χρήση ενιαίου STATUS_COLORS_MAPPING
      const validStatus = Object.keys(STATUS_COLORS_MAPPING).includes(props.currentStatus as string)
        ? props.currentStatus as PropertyStatus
        : 'for-sale';
      const statusColors = STATUS_COLORS_MAPPING[validStatus];

      // Ρύθμιση ToolStyleStore με ενιαίο mapping
      const toolStyle = {
        strokeColor: statusColors.stroke,  // Status stroke color
        fillColor: statusColors.fill,      // Status fill color (με διαφάνεια)
        lineWidth: 2,                      // Διακριτή γραμμή
        opacity: 1,
        lineType: 'solid' as const         // Overlay γραμμές solid για καθαρότητα
      };
      toolStyleStore.set(toolStyle);

      const polylineControlPromise = startOverlayCreation({
        status: props.currentStatus,        // Μεταβίβαση επιλεγμένου status
        kind: props.currentKind,           // Μεταβίβαση επιλεγμένου kind
        onComplete: (overlayId) => {
          props.onToolChange('layering'); // Επιστροφή σε layering mode
          props.onModeChange('select'); // επιστροφή σε select
        },
        onCancel: () => {
          props.onToolChange('layering'); // Επιστροφή σε layering mode
          props.onModeChange('select');
        }
      });

      // Αποθήκευση του stop callback για double-click handling
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
      // Για select/edit modes, επιστροφή σε layering mode
      props.onToolChange('layering');
      props.onModeChange(newMode);
    }
  };

  // 🎯 SYNC TOOLBAR WITH SELECTED OVERLAY
  React.useEffect(() => {
    if (props.selectedOverlayId) {
      const selectedOverlay = overlayStore.getSelectedOverlay();
      if (selectedOverlay) {
        // Ενημέρωση εργαλειοθήκης με status του επιλεγμένου overlay
        if (selectedOverlay.status && selectedOverlay.status !== props.currentStatus) {
          props.onStatusChange(selectedOverlay.status);
        }

        // Ενημέρωση kind με getKindFromLabel για να χειριστούμε ελληνικά labels
        if (selectedOverlay.kind) {
          const mappedKind = getKindFromLabel(selectedOverlay.kind);
          if (mappedKind && mappedKind !== props.currentKind) {
            props.onKindChange(mappedKind);
          }
        }
      }
    }
  }, [props.selectedOverlayId, overlayStore, props.currentStatus, props.currentKind, props.onStatusChange, props.onKindChange]);

  // ✅ ENTERPRISE CENTRALIZED DRAGGING SYSTEM
  // Destructure exactly like GlobalPerformanceDashboard
  const {
    position,
    isDragging,
    elementRef,
    handleMouseDown
  } = useDraggable(true, {
    initialPosition: { x: TOOLBAR_DIMENSIONS.initialX, y: TOOLBAR_DIMENSIONS.initialY },
    autoCenter: false,
    elementWidth: TOOLBAR_DIMENSIONS.width,
    elementHeight: TOOLBAR_DIMENSIONS.height,
    minPosition: { x: 0, y: 0 },
    maxPosition: {
      x: typeof window !== 'undefined' ? window.innerWidth - TOOLBAR_DIMENSIONS.width : 1000,
      y: typeof window !== 'undefined' ? window.innerHeight - TOOLBAR_DIMENSIONS.height : 600
    }
  });

  // ✅ ENTERPRISE: Draggable styles with smooth transition (same as GlobalPerformanceDashboard)
  const draggableStyles = mounted ? {
    left: position.x,
    top: position.y,
    transition: isDragging ? 'none' : 'left 0.2s ease, top 0.2s ease',
    ...performanceMonitorUtilities.getOverlayContainerStyles()
  } : undefined;

  // ✅ ENTERPRISE: Prevent hydration mismatch
  if (!mounted) {
    return null;
  }

  return (
    <Card
      ref={elementRef}
      className={`${performanceMonitorUtilities.getOverlayContainerClasses()} ${isDragging ? 'cursor-grabbing select-none' : ''}`}
      style={draggableStyles}
    >
      <CardHeader
        className={performanceMonitorUtilities.getOverlayHeaderClasses()}
        onMouseDown={handleMouseDown}
      >
        {/* 🎯 HEADER ROW: Title, Drag Handle, Close */}
        <div className="flex items-center gap-3 flex-1">
          <Activity className={`${iconSizes.sm} text-primary`} />
          <h3 className="text-sm font-semibold text-foreground">Drawing Tools</h3>

          {/* ✅ ENTERPRISE: Dedicated drag handle */}
          <div
            className="ml-auto cursor-grab transition-colors text-xs select-none text-muted-foreground hover:text-foreground"
            title="Drag to move"
            data-drag-handle="true"
            onMouseDown={handleMouseDown}
          >
            ⋮⋮
          </div>

          <button
            className="p-1 rounded transition-colors hover:bg-muted text-muted-foreground hover:text-foreground"
            title="Hide toolbar"
          >
            <X className={iconSizes.xs} />
          </button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 🎯 TOOLBAR CONTROLS - ΣΚΟΥΡΟ BACKGROUND ΟΠΩΣ ΤΑ ΑΛΛΑ PANELS */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Drawing Modes */}
          <div className="flex items-center gap-1">
            {modeButtons.map(({ mode: btnMode, icon: Icon, label, key }) => (
              <button
                key={btnMode}
                onClick={() => handleModeChange(btnMode)}
                title={`${label} (${key})`}
                className={`
                  h-8 px-2 ${quick.button} transition-colors duration-150
                  flex items-center justify-center gap-1
                  ${props.mode === btnMode
                    ? `bg-blue-600 text-white ${getStatusBorder('info')} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER}`
                    : `${colors.bg.hover} ${colors.text.primary} ${getStatusBorder('default')} ${HOVER_BACKGROUND_EFFECTS.MUTED}`
                  }
                `}
              >
                {Icon ? <Icon className={iconSizes.sm} /> : <span className="text-xs">?</span>}
                <span className="hidden sm:inline text-xs">{label}</span>
              </button>
            ))}
          </div>

          <Separator orientation="vertical" className={`h-6 ${quick.separatorV}`} />

          {/* Status Palette */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Status:</span>
            <div className="flex items-center gap-1">
              {(Object.keys(STATUS_COLORS) as Status[]).map(status => (
                <button
                  key={status}
                  onClick={() => props.onStatusChange(status)}
                  title={STATUS_LABELS[status]}
                  className={`${iconSizes.lg} ${quick.button} ${quick.card} transition-all duration-150`}
                  style={getStatusColorButtonStyles(
                    status as PropertyStatus,
                    props.currentStatus === status
                  )}
                />
              ))}
            </div>
          </div>

          <Separator orientation="vertical" className={`h-6 ${quick.separatorV}`} />

          {/* Kind Selection */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Τύπος:</span>
            <div className="flex items-center gap-1">
              {(Object.keys(KIND_LABELS) as OverlayKind[]).map(kind => {
                const Icon = kindIcons[kind];
                return (
                  <button
                    key={kind}
                    onClick={() => props.onKindChange(kind)}
                    title={KIND_LABELS[kind]}
                    className={`
                      ${iconSizes.xl} p-0 ${quick.button} transition-colors duration-150
                      flex items-center justify-center
                      ${props.currentKind === kind
                        ? `bg-blue-600 text-white ${getStatusBorder('info')} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER}`
                        : `${colors.bg.hover} ${colors.text.primary} ${getStatusBorder('default')} ${HOVER_BACKGROUND_EFFECTS.MUTED}`
                      }
                    `}
                  >
                    {Icon ? <Icon className={iconSizes.sm} /> : <span className="text-xs">?</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <Separator orientation="vertical" className={`h-6 ${quick.separatorV}`} />

          {/* Actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={props.onDuplicate}
              disabled={!props.selectedOverlayId}
              title="Αντιγραφή (D)"
              className={`
                ${iconSizes.xl} p-0 ${quick.button} transition-colors duration-150
                flex items-center justify-center
                ${colors.bg.hover} ${colors.text.primary} ${getStatusBorder('default')}
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              <Copy className={iconSizes.sm} />
            </button>

            <button
              onClick={props.onDelete}
              disabled={!props.selectedOverlayId}
              title="Διαγραφή (Del)"
              className={`
                ${iconSizes.xl} p-0 ${quick.button} transition-colors duration-150
                flex items-center justify-center
                ${colors.bg.hover} ${colors.text.danger} ${getStatusBorder('default')}
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              <X className={iconSizes.sm} />
            </button>
          </div>

          <Separator orientation="vertical" className={`h-6 ${quick.separatorV}`} />

          {/* Undo/Redo */}
          <div className="flex items-center gap-1">
            <button
              onClick={props.onUndo}
              disabled={!props.canUndo}
              title="Αναίρεση (Ctrl+Z)"
              className={`
                ${iconSizes.xl} p-0 ${quick.button} transition-colors duration-150
                flex items-center justify-center
                ${colors.bg.hover} ${colors.text.primary} ${getStatusBorder('default')}
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              <RotateCcw className={iconSizes.sm} />
            </button>
            <button
              onClick={props.onRedo}
              disabled={!props.canRedo}
              title="Επανάληψη (Ctrl+Y)"
              className={`
                ${iconSizes.xl} p-0 ${quick.button} transition-colors duration-150
                flex items-center justify-center
                ${colors.bg.hover} ${colors.text.primary} ${getStatusBorder('default')}
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              <RotateCw className={iconSizes.sm} />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};