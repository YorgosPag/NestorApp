'use client';
import React, { useState, useRef } from 'react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useDraggable } from '../../../hooks/useDraggable';
// import { Separator } from '../../../components/ui/separator';
// Προσωρινή λύση - αντικατάσταση με div
const Separator = ({ orientation, className }: { orientation?: string; className?: string }) => (
  <div className={className} />
);
import { MousePointer, Pen, X, Copy, Grid, Square, Circle, Triangle, Edit, RotateCcw, RotateCw } from 'lucide-react';
import { STATUS_COLORS, STATUS_LABELS, KIND_LABELS, type Status, type OverlayKind, type OverlayEditorMode } from '../overlays/types';
import type { PropertyStatus } from '../../../constants/property-statuses-enterprise';
import { useUnifiedOverlayCreation } from '../hooks/overlay/useUnifiedOverlayCreation';
import { toolStyleStore } from '../stores/ToolStyleStore';
import { STATUS_COLORS_MAPPING, BUTTON_STATUS_COLORS, getKindFromLabel } from '../config/color-mapping';
import { useOverlayStore } from '../overlays/overlay-store';
import { INTERACTIVE_PATTERNS, HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import {
  getStatusColorButtonStyles,
  type ToolbarButtonVariant
} from './DxfViewerComponents.styles';

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
  const iconSizes = useIconSizes();
  const { quick, radius, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const { startOverlayCreation } = useUnifiedOverlayCreation();
  const overlayStore = useOverlayStore();

  // Συγχρονισμός toolbar με επιλεγμένο overlay
  React.useEffect(() => {
    if (selectedOverlayId) {
      const selectedOverlay = overlayStore.getSelectedOverlay();
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
  }, [selectedOverlayId, overlayStore, currentStatus, currentKind, onStatusChange, onKindChange]);

  const modeButtons = [
    { mode: 'draw' as OverlayEditorMode, icon: Pen, label: 'Σχεδίαση', key: 'N' },
    { mode: 'edit' as OverlayEditorMode, icon: Edit, label: 'Επεξεργασία', key: 'E' },
  ];

  const kindIcons = { unit: Square, parking: Circle, storage: Triangle, footprint: Grid };

  const handleModeChange = (newMode: OverlayEditorMode) => {
    if (newMode === 'draw') {
      // Ενημέρωση του overlayMode state πρώτα για toolbar visibility
      onModeChange(newMode);
      
      // Χρήση ενιαίου STATUS_COLORS_MAPPING
      const validStatus = Object.keys(STATUS_COLORS_MAPPING).includes(currentStatus as string) 
        ? currentStatus as PropertyStatus 
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
      
      // Αποθήκευση του stop callback για double-click handling
      if (polylineControl?.stop) {
        toolStyleStore.setOverlayCompletionCallback(() => {
          polylineControl.stop();
        });
      }
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

  const draggableStyles = disableFloating ? {} : {
    left: dragPosition.x,
    top: dragPosition.y,
    transform: 'none', // Override center transform when dragging
    cursor: isDragging ? 'grabbing' : 'auto'
  };

  return (
    <div
      ref={elementRef}
      style={draggableStyles}
      className={`${disableFloating ? 'relative' : 'fixed z-[80]'} flex items-center gap-2 p-2 ${colors.bg.secondary} ${quick.card} flex-wrap shadow-xl select-none pointer-events-auto`}
      onMouseEnter={(e) => e.stopPropagation()}
      onMouseMove={(e) => e.stopPropagation()}
      onMouseLeave={(e) => e.stopPropagation()}
    >
      {/* Drag Handle */}
      {!disableFloating && (
        <div
          onMouseDown={handleMouseDown}
          className={`cursor-grab active:cursor-grabbing p-1 ${colors.bg.hover} ${radius.md}`}
          title="Drag to move toolbar"
        >
          <div className={`${iconSizes.xs} ${iconSizes.sm} ${colors.bg.active} ${quick.button}`}></div>
        </div>
      )}
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
              ${mode === btnMode
                ? `${colors.bg.info} ${colors.text.inverted} ${getStatusBorder('info')} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER}`
                : `${colors.bg.secondary} ${colors.text.secondary} ${getStatusBorder('default')} ${HOVER_BACKGROUND_EFFECTS.MUTED}`
              }
            `}
          >
            {Icon ? <Icon className={iconSizes.sm} /> : <span className="text-xs">?</span>}
            <span className="hidden sm:inline text-xs">{label}</span>
          </button>
        ))}
      </div>

      <Separator orientation="vertical" className={`${iconSizes.lg} ${quick.separatorV}`} />

      {/* Status Palette */}
      <div className="flex items-center gap-2">
        <span className={`text-xs font-medium ${colors.text.muted}`}>Status:</span>
        <div className="flex items-center gap-1">
          {(Object.keys(STATUS_COLORS) as Status[]).map(status => (
            <button
              key={status}
              onClick={() => onStatusChange(status)}
              title={STATUS_LABELS[status]}
              className={`${iconSizes.lg} ${quick.button} ${quick.card} transition-all duration-150`}
              style={getStatusColorButtonStyles(
                status as PropertyStatus,
                currentStatus === status
              )}
            />
          ))}
        </div>
      </div>

      <Separator orientation="vertical" className={`${iconSizes.lg} ${quick.separatorV}`} />

      {/* Kind Selection */}
      <div className="flex items-center gap-2">
        <span className={`text-xs font-medium ${colors.text.muted}`}>Τύπος:</span>
        <div className="flex items-center gap-1">
          {(Object.keys(KIND_LABELS) as OverlayKind[]).map(kind => {
            const Icon = kindIcons[kind];
            return (
              <button
                key={kind}
                onClick={() => onKindChange(kind)}
                title={KIND_LABELS[kind]}
                className={`
                  ${iconSizes.xl} p-0 ${quick.button} transition-colors duration-150
                  flex items-center justify-center
                  ${currentKind === kind
                    ? `${colors.bg.info} ${colors.text.inverted} ${getStatusBorder('info')} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER}`
                    : `${colors.bg.secondary} ${colors.text.secondary} ${getStatusBorder('default')} ${HOVER_BACKGROUND_EFFECTS.MUTED}`
                  }
                `}
              >
                {Icon ? <Icon className={iconSizes.sm} /> : <span className="text-xs">?</span>}
              </button>
            );
          })}
        </div>
      </div>

      <Separator orientation="vertical" className={`${iconSizes.lg} ${quick.separatorV}`} />

      {/* Actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={onDuplicate}
          disabled={!selectedOverlayId}
          title="Αντιγραφή (D)"
          className={`
            ${iconSizes.xl} p-0 ${quick.button} transition-colors duration-150
            flex items-center justify-center
            ${colors.bg.secondary} ${colors.text.secondary} ${getStatusBorder('default')}
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          <Copy className={iconSizes.sm} />
        </button>
        
        <button
          onClick={onDelete}
          disabled={!selectedOverlayId}
          title="Διαγραφή (Del)"
          className={`
            ${iconSizes.xl} p-0 ${quick.button} transition-colors duration-150
            flex items-center justify-center
            ${colors.bg.secondary} ${colors.text.error} ${getStatusBorder('default')}
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          <X className={iconSizes.sm} />
        </button>
      </div>

      <Separator orientation="vertical" className={`${iconSizes.lg} ${quick.separatorV}`} />

      {/* Undo/Redo */}
      <div className="flex items-center gap-1">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          title="Αναίρεση (Ctrl+Z)"
          className={`
            ${iconSizes.xl} p-0 ${quick.button} transition-colors duration-150
            flex items-center justify-center
            ${colors.bg.secondary} ${colors.text.secondary} ${getStatusBorder('default')}
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          <RotateCcw className={iconSizes.sm} />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          title="Επανάληψη (Ctrl+Y)"
          className={`
            ${iconSizes.xl} p-0 ${quick.button} transition-colors duration-150
            flex items-center justify-center
            ${colors.bg.secondary} ${colors.text.secondary} ${getStatusBorder('default')}
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          <RotateCw className={iconSizes.sm} />
        </button>
      </div>
    </div>
  );
};
