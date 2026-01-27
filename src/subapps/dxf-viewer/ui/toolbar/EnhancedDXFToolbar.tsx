'use client';

// DEBUG FLAG - Set to false to disable performance-heavy logging
// 🏢 ENTERPRISE (2026-01-27): Disabled to reduce console noise and improve performance
const DEBUG_ENHANCED_DXF_TOOLBAR = false;

import React from 'react';
import { useIconSizes } from '../../../../hooks/useIconSizes';
import { useBorderTokens } from '../../../../hooks/useBorderTokens';
import { useSemanticColors } from '../../../../hooks/useSemanticColors';  // ✅ ENTERPRISE: Background centralization
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import type { ToolType } from './types';
import type { Point2D } from '../../rendering/types/Types';
import { toolGroups, createActionButtons } from './toolDefinitions';
import { useProSnapIntegration } from '../../hooks/common/useProSnapIntegration';
import { ZoomControls } from './ZoomControls';
import { ScaleControls } from './ScaleControls';
import { ToolButton, ActionButton } from './ToolButton';
import { ToolbarStatusBar } from './ToolbarStatusBar';
import { ProSnapToolbar } from '../components/ProSnapToolbar';
// 🏢 ENTERPRISE: Shadcn Button (same as CompactToolbar - NO BORDERS)
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { FolderUp } from 'lucide-react';
// 🎨 ENTERPRISE: Centralized DXF toolbar colors - Single source of truth
import { DXF_ACTION_COLORS } from '../../config/toolbar-colors';
// ⌨️ ENTERPRISE: Centralized keyboard shortcuts - Single source of truth
import { matchesShortcut, DXF_TOOL_SHORTCUTS, DXF_CTRL_SHORTCUTS, DXF_SPECIAL_SHORTCUTS, DXF_ACTION_SHORTCUTS } from '../../config/keyboard-shortcuts';
import UploadDxfButton from '../UploadDxfButton';
import { SimpleProjectDialog } from '../../components/SimpleProjectDialog';
import type { SceneModel } from '../../types/scene';

interface EnhancedDXFToolbarProps {
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
  onAction: (action: string, data?: number | string | Record<string, unknown>) => void;
  showGrid: boolean;
  autoCrop: boolean;
  canUndo: boolean;
  canRedo: boolean;
  snapEnabled: boolean;
  showCursorSettings?: boolean;
  currentZoom: number;
  commandCount?: number;
  className?: string;
  onSceneImported?: (file: File, encoding?: string) => void;
  mouseCoordinates?: Point2D | null;
  showCoordinates?: boolean;
}

export const EnhancedDXFToolbar: React.FC<EnhancedDXFToolbarProps> = ({
  activeTool,
  onToolChange,
  onAction,
  showGrid,
  autoCrop,
  canUndo,
  canRedo,
  snapEnabled,
  showCursorSettings = false,
  currentZoom,
  commandCount,
  className = '',
  onSceneImported,
  mouseCoordinates,
  showCoordinates = false,
}) => {
  // 🏢 ENTERPRISE HOOKS: Design system integration
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder, radius } = useBorderTokens();
  const colors = useSemanticColors();  // ✅ ENTERPRISE: Centralized background management
  const [showSimpleDialog, setShowSimpleDialog] = React.useState(false);

  // ⌨️ ENTERPRISE: Centralized keyboard shortcuts - Single source of truth
  // Uses matchesShortcut() from keyboard-shortcuts.ts for ALL shortcut matching
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
        return;
      }

      // ⌨️ CTRL SHORTCUTS - Actions with Ctrl/Cmd modifier
      if (matchesShortcut(e, 'undo')) { e.preventDefault(); onAction('undo'); return; }
      if (matchesShortcut(e, 'redo')) { e.preventDefault(); onAction('redo'); return; }
      if (matchesShortcut(e, 'redoAlt')) { e.preventDefault(); onAction('redo'); return; }
      if (matchesShortcut(e, 'copy') && activeTool === 'select') { e.preventDefault(); onAction('copy-selected'); return; }
      if (matchesShortcut(e, 'selectAll')) { e.preventDefault(); onAction('select-all'); return; }
      if (matchesShortcut(e, 'toggleLayers')) { e.preventDefault(); onAction('toggle-layers'); return; }
      if (matchesShortcut(e, 'toggleProperties')) { e.preventDefault(); onAction('toggle-properties'); return; }
      if (matchesShortcut(e, 'export')) { e.preventDefault(); onAction('export'); return; }

      // ⌨️ TOOL SHORTCUTS - Single letter tool activation
      if (matchesShortcut(e, 'select')) { e.preventDefault(); onToolChange('select'); return; }
      if (matchesShortcut(e, 'pan')) { e.preventDefault(); onToolChange('pan'); return; }
      if (matchesShortcut(e, 'line')) { e.preventDefault(); onToolChange('line'); return; }
      if (matchesShortcut(e, 'rectangle')) { e.preventDefault(); onToolChange('rectangle'); return; }
      if (matchesShortcut(e, 'circle')) { e.preventDefault(); onToolChange('circle'); return; }
      if (matchesShortcut(e, 'polyline')) { e.preventDefault(); onToolChange('polyline'); return; }
      if (matchesShortcut(e, 'polygon')) { e.preventDefault(); onToolChange('polygon'); return; }
      if (matchesShortcut(e, 'move')) { e.preventDefault(); onToolChange('move'); return; }
      if (matchesShortcut(e, 'measureDistance')) { e.preventDefault(); onToolChange('measure-distance'); return; }
      if (matchesShortcut(e, 'measureArea')) { e.preventDefault(); onToolChange('measure-area'); return; }
      if (matchesShortcut(e, 'measureAngle')) { e.preventDefault(); onToolChange('measure-angle'); return; }
      if (matchesShortcut(e, 'zoomWindow')) { e.preventDefault(); onToolChange('zoom-window' as ToolType); return; }
      if (matchesShortcut(e, 'gripEdit')) { e.preventDefault(); onToolChange('grip-edit'); return; }
      if (matchesShortcut(e, 'layering')) { e.preventDefault(); onToolChange('layering'); return; }

      // ⌨️ ACTION SHORTCUTS - View toggles (no modifier)
      if (matchesShortcut(e, 'grid')) { e.preventDefault(); onAction('grid'); return; }
      if (matchesShortcut(e, 'fit')) { e.preventDefault(); onAction('fit'); return; }
      if (matchesShortcut(e, 'autocrop')) { e.preventDefault(); onAction('autocrop'); return; }

      // ⌨️ SPECIAL SHORTCUTS - Escape, Delete, etc.
      if (matchesShortcut(e, 'escape')) {
        e.preventDefault();
        onToolChange('select');
        onAction('clear-selection');
        return;
      }
      // 🏢 ENTERPRISE (2026-01-26): Delete/Backspace handling MOVED to CanvasSection - ADR-032
      // CanvasSection has access to selectedGrips and handles smart delete:
      // - If grips selected → delete vertices
      // - Else if overlay selected → delete overlay
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTool, onToolChange, onAction]);

  // Χρήση του ενοποιημένου snap system
  const {
    enabledModes,
    toggleMode,
    snapEnabled: contextSnapEnabled,
    toggleSnap
  } = useProSnapIntegration(snapEnabled ?? false);
  
  const actionButtons = createActionButtons({
    canUndo,
    canRedo,
    snapEnabled: contextSnapEnabled,
    showGrid,
    autoCrop,
    showCursorSettings: showCursorSettings || false,
    onAction: (action, data) => {
      onAction(action, data as string | number | Record<string, unknown>);
    }
  });

  const handleZoomIn = () => onAction('zoom-in-action');
  const handleZoomOut = () => onAction('zoom-out-action');
  const handleSetZoom = (zoom: number) => onAction('set-zoom', zoom);
  
  const handleToolChange = (tool: ToolType) => {
    if (tool === 'zoom-window') {
      onAction('zoom-window');
    } else if (tool === 'layering') {
      // UPDATED: Layering tool now uses Unified Grips System (UGS)

      if (activeTool === 'layering') {

        onToolChange('select'); // Toggle off to select mode
        onAction('toggle-layers'); // ✅ ΔΙΟΡΘΩΣΗ: Hide layers panel όταν απενεργοποιείται
      } else {

        onToolChange(tool); // Activate layering tool with UGS
        onAction('toggle-layers'); // Show layers panel
      }
    } else if (tool === 'grip-edit') {
      // Custom handling για το grip editing tool

      onToolChange(tool);
      onAction('grip-edit');
    } else {
      onToolChange(tool);
    }
  };

  // 🎨 ENTERPRISE: bg-card for consistency with FloatingPanel (Εργαλεία Σχεδίασης)
  return (
    <div
      data-testid="dxf-main-toolbar"
      className={`border ${getStatusBorder('muted')} ${quick.card} bg-card ${PANEL_LAYOUT.SHADOW.LG} ${className}`}
    >
      <div className={`flex flex-wrap ${PANEL_LAYOUT.GAP.XS} ${PANEL_LAYOUT.SPACING.SM}`}>
        <div className={`flex ${PANEL_LAYOUT.GAP.XS} flex-1`}>
          {/* 🏢 ENTERPRISE: Upload DXF - Shadcn Button (NO BORDERS) */}
          <UploadDxfButton
            title="Upload DXF File (Legacy)"
            onFileSelect={onSceneImported}
          />

          {/* 🏢 ENTERPRISE: Enhanced Import - Shadcn Button (NO BORDERS) */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSimpleDialog(true)}
                  className={`${iconSizes.xl} p-0`}
                >
                  {/* 🎨 ENTERPRISE: Auto-assigned from DXF_ACTION_COLORS.importEnhanced */}
                  <FolderUp className={`${iconSizes.sm} ${DXF_ACTION_COLORS.importEnhanced}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Enhanced DXF Import with Project Management</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className={`w-px ${colors.bg.active} ${PANEL_LAYOUT.MARGIN.X_XS} ${PANEL_LAYOUT.MARGIN.Y_XS}`} />

          {toolGroups.map((group, groupIndex) => (
            <div key={group.name} className={`flex ${PANEL_LAYOUT.GAP.XS}`}>
              {group.tools.map((tool) => (
                <ToolButton
                  key={tool.id}
                  tool={tool}
                  isActive={activeTool === tool.id || (tool.dropdownOptions?.some(option => option.id === activeTool) ?? false)}
                  onClick={() => handleToolChange(tool.id)}
                  onDropdownSelect={(toolId) => handleToolChange(toolId as ToolType)}
                  activeTool={activeTool ?? 'select'}
                />
              ))}
              {groupIndex < toolGroups.length - 1 && (
                <div className={`w-px ${colors.bg.active} ${PANEL_LAYOUT.MARGIN.X_XS} ${PANEL_LAYOUT.MARGIN.Y_XS}`} />
              )}
            </div>
          ))}
          
          <div className={`w-px ${colors.bg.active} ${PANEL_LAYOUT.MARGIN.X_XS} ${PANEL_LAYOUT.MARGIN.Y_XS}`} />

          <ZoomControls
            currentZoom={currentZoom}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onSetZoom={handleSetZoom}
          />

          <div className={`w-px ${colors.bg.active} ${PANEL_LAYOUT.MARGIN.X_XS} ${PANEL_LAYOUT.MARGIN.Y_XS}`} />

          {actionButtons.map((action) => (
            <ActionButton key={action.id} action={action} />
          ))}
        </div>

        <div className={PANEL_LAYOUT.FLEX_SHRINK.NONE}>
          <div className={`w-px ${colors.bg.active} ${PANEL_LAYOUT.MARGIN.X_SM} ${PANEL_LAYOUT.MARGIN.Y_XS}`} />
          <ProSnapToolbar
            enabledModes={enabledModes}
            onToggleMode={toggleMode}
            snapEnabled={contextSnapEnabled}
            onToggleSnap={toggleSnap}
            compact={true}
            className={PANEL_LAYOUT.FLEX_SHRINK.NONE}
          />
        </div>
      </div>
      
      <ToolbarStatusBar
        activeTool={activeTool}
        currentZoom={currentZoom}
        snapEnabled={contextSnapEnabled}
        commandCount={commandCount}
        mouseCoordinates={mouseCoordinates}
        showCoordinates={showCoordinates}
      />

      {/* Simple Project Dialog */}
      <SimpleProjectDialog
        isOpen={showSimpleDialog}
        onClose={() => setShowSimpleDialog(false)}
        onFileImport={onSceneImported ? async (file: File, encoding?: string) => {
          onSceneImported(file, encoding);
          return Promise.resolve();
        } : undefined}
      />
    </div>
  );
};
