'use client';

import React from 'react';
import { useIconSizes } from '@/hooks/useIconSizes';
import type { OverlayEditorMode, Status, OverlayKind } from '../../overlays/types';
import type { ToolType } from '../toolbar/types';
import type { PropertyStatus } from '../../../../constants/property-statuses-enterprise';
import { usePrecisionPositioning } from '../../utils/precision-positioning';
import { useDraggable } from '../../../../hooks/useDraggable';
import { Card, CardHeader, CardContent } from '../../../../components/ui/card';
import { Activity, X, Pen, Edit, Copy, RotateCcw, RotateCw, Square, Circle, Triangle, Grid } from 'lucide-react';
import { performanceMonitorUtilities } from '../../../../styles/design-tokens/components/performance-tokens';
import { STATUS_COLORS, STATUS_LABELS, KIND_LABELS } from '../../overlays/types';
import { useUnifiedOverlayCreation } from '../../hooks/overlay/useUnifiedOverlayCreation';
import { toolStyleStore } from '../../stores/ToolStyleStore';
import { STATUS_COLORS_MAPPING, BUTTON_STATUS_COLORS, getKindFromLabel } from '../../config/color-mapping';
import { useOverlayStore } from '../../overlays/overlay-store';
import { INTERACTIVE_PATTERNS, HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { getStatusColorButtonStyles } from '../DxfViewerComponents.styles';

// Separator component (same as in OverlayToolbar)
const Separator = ({ orientation, className }: { orientation?: string; className?: string }) => (
  <div className={className} />
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
        lineType: 'solid'                  // Overlay γραμμές solid για καθαρότητα
      };
      toolStyleStore.set(toolStyle);

      const polylineControl = startOverlayCreation({
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
      if (polylineControl?.stop) {
        toolStyleStore.setOverlayCompletionCallback(() => {
          polylineControl.stop();
        });
      }
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

  // CENTRALIZED PRECISION POSITIONING for initial placement
  const toolbarRef = React.useRef<HTMLDivElement>(null);
  const { position: initialPosition, hasInitialized } = usePrecisionPositioning(toolbarRef, {
    targetPoint: { x: 20, y: 200 }, // Target coordinates: X=20, Y=200 for left side
    alignment: 'top-left' // Top-left alignment
  });

  // ✅ ENTERPRISE CENTRALIZED DRAGGING SYSTEM
  const draggable = useDraggable(true, {
    initialPosition: initialPosition || { x: 20, y: 200 },
    autoCenter: false, // Use precision positioning instead
    elementWidth: 300, // Approximate toolbar width
    elementHeight: 100, // Approximate toolbar height
    minPosition: { x: 0, y: 0 },
    maxPosition: {
      x: window.innerWidth - 300,
      y: window.innerHeight - 100
    }
  });

  // Update position when precision positioning changes (initial only)
  const [hasSetInitialPosition, setHasSetInitialPosition] = React.useState(false);

  React.useEffect(() => {
    if (hasInitialized && !hasSetInitialPosition && initialPosition) {
      draggable.setPosition(initialPosition);
      setHasSetInitialPosition(true);
    }
  }, [hasInitialized, hasSetInitialPosition, initialPosition, draggable.setPosition]);

  // Sync refs for precision positioning compatibility
  React.useEffect(() => {
    if (draggable.elementRef.current) {
      toolbarRef.current = draggable.elementRef.current;
    }
  }, [draggable.elementRef.current]);

  return (
    <Card
      ref={draggable.elementRef}
      className={performanceMonitorUtilities.getOverlayContainerClasses()}
      style={{
        left: draggable.position?.x || 20,
        top: draggable.position?.y || 200,
        ...performanceMonitorUtilities.getOverlayContainerStyles()
      }}
    >
      <CardHeader
        className={performanceMonitorUtilities.getOverlayHeaderClasses()}
        style={performanceMonitorUtilities.getOverlayHeaderStyles()}
        onMouseDown={draggable.handleMouseDown}
      >
        {/* 🎯 HEADER ROW: Title, Drag Handle, Close */}
        <div className="flex items-center gap-3 flex-1">
          <Activity className={iconSizes.sm} style={performanceMonitorUtilities.getOverlayIconStyles('primary')} />
          <h3 className="text-sm font-semibold" style={performanceMonitorUtilities.getOverlayTitleStyles()}>Drawing Tools</h3>

          <div
            className="ml-auto cursor-grab transition-colors text-xs select-none"
            style={performanceMonitorUtilities.getOverlayIconStyles('secondary')}
            title="Drag to move"
            onMouseDown={draggable.handleMouseDown}
          >
            ⋮⋮
          </div>

          <button
            className="p-1 rounded transition-colors"
            style={performanceMonitorUtilities.getOverlayButtonStyles()}
            title="Hide toolbar"
          >
            <X className={iconSizes.xs} />
          </button>
        </div>
      </CardHeader>

      <CardContent
        className="space-y-4"
        style={performanceMonitorUtilities.getOverlayContentStyles()}
      >
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
                  h-8 px-2 rounded-md border transition-colors duration-150
                  flex items-center justify-center gap-1
                  ${props.mode === btnMode
                    ? `bg-blue-600 text-white border-blue-500 ${INTERACTIVE_PATTERNS.PRIMARY_HOVER}`
                    : `bg-gray-700 text-gray-200 border-gray-500 ${HOVER_BACKGROUND_EFFECTS.MUTED}`
                  }
                `}
              >
                {Icon ? <Icon className={iconSizes.sm} /> : <span className="text-xs">?</span>}
                <span className="hidden sm:inline text-xs">{label}</span>
              </button>
            ))}
          </div>

          <Separator orientation="vertical" className="h-6 bg-gray-500" />

          {/* Status Palette */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-400">Status:</span>
            <div className="flex items-center gap-1">
              {(Object.keys(STATUS_COLORS) as Status[]).map(status => (
                <button
                  key={status}
                  onClick={() => props.onStatusChange(status)}
                  title={STATUS_LABELS[status]}
                  className={`${iconSizes.lg} rounded-md border-2 transition-all duration-150`}
                  style={getStatusColorButtonStyles(
                    status as PropertyStatus,
                    props.currentStatus === status
                  )}
                />
              ))}
            </div>
          </div>

          <Separator orientation="vertical" className="h-6 bg-gray-500" />

          {/* Kind Selection */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-400">Τύπος:</span>
            <div className="flex items-center gap-1">
              {(Object.keys(KIND_LABELS) as OverlayKind[]).map(kind => {
                const Icon = kindIcons[kind];
                return (
                  <button
                    key={kind}
                    onClick={() => props.onKindChange(kind)}
                    title={KIND_LABELS[kind]}
                    className={`
                      ${iconSizes.xl} p-0 rounded-md border transition-colors duration-150
                      flex items-center justify-center
                      ${props.currentKind === kind
                        ? `bg-blue-600 text-white border-blue-500 ${INTERACTIVE_PATTERNS.PRIMARY_HOVER}`
                        : `bg-gray-700 text-gray-200 border-gray-500 ${HOVER_BACKGROUND_EFFECTS.MUTED}`
                      }
                    `}
                  >
                    {Icon ? <Icon className={iconSizes.sm} /> : <span className="text-xs">?</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <Separator orientation="vertical" className="h-6 bg-gray-500" />

          {/* Actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={props.onDuplicate}
              disabled={!props.selectedOverlayId}
              title="Αντιγραφή (D)"
              className={`
                ${iconSizes.xl} p-0 rounded-md border transition-colors duration-150
                flex items-center justify-center
                bg-gray-700 text-gray-200 border-gray-500
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
                ${iconSizes.xl} p-0 rounded-md border transition-colors duration-150
                flex items-center justify-center
                bg-gray-700 text-red-400 border-gray-500
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              <X className={iconSizes.sm} />
            </button>
          </div>

          <Separator orientation="vertical" className="h-6 bg-gray-500" />

          {/* Undo/Redo */}
          <div className="flex items-center gap-1">
            <button
              onClick={props.onUndo}
              disabled={!props.canUndo}
              title="Αναίρεση (Ctrl+Z)"
              className={`
                ${iconSizes.xl} p-0 rounded-md border transition-colors duration-150
                flex items-center justify-center
                bg-gray-700 text-gray-200 border-gray-500
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
                ${iconSizes.xl} p-0 rounded-md border transition-colors duration-150
                flex items-center justify-center
                bg-gray-700 text-gray-200 border-gray-500
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