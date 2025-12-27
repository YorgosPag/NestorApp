'use client';

// DEBUG FLAG - Set to false to disable performance-heavy logging
const DEBUG_ENHANCED_DXF_TOOLBAR = true;

import React from 'react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/hooks/useSemanticColors';  // ✅ ENTERPRISE: Background centralization
import type { ToolType } from './types';
import type { Point2D } from '../../rendering/types/Types';
import { toolGroups, createActionButtons } from './toolDefinitions';
import { useProSnapIntegration } from '../../hooks/common/useProSnapIntegration';
import { ZoomControls } from './ZoomControls';
import { ScaleControls } from './ScaleControls';
import { ToolButton, ActionButton } from './ToolButton';
import { ToolbarStatusBar } from './ToolbarStatusBar';
import { ProSnapToolbar } from '../components/ProSnapToolbar';
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
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
  showLayers?: boolean;
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
  showLayers = false,
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

  // ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Tool shortcuts (inline - local functionality)
  // Zoom shortcuts μετακόμισαν στο hooks/useKeyboardShortcuts.ts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
        return;
      }

      // Tool shortcuts (S, P, L, R, C, M, D, W, G, F, F9, Delete, Escape)
      if (e.ctrlKey || e.metaKey) {
        // Ctrl shortcuts
        switch (e.key.toLowerCase()) {
          case 'z':
            e.preventDefault();
            onAction(e.shiftKey ? 'redo' : 'undo');
            break;
          case 'y':
            e.preventDefault();
            onAction('redo');
            break;
          case 'c':
            if (activeTool === 'select') {
              e.preventDefault();
              onAction('copy-selected');
            }
            break;
          case 'a':
            e.preventDefault();
            onAction('select-all');
            break;
          case 'l':
            e.preventDefault();
            onAction('toggle-layers');
            break;
          case 'p':
            e.preventDefault();
            onAction('toggle-properties');
            break;
          case 'e':
            e.preventDefault();
            onAction('export');
            break;
        }
      } else {
        // Normal shortcuts
        switch (e.key.toLowerCase()) {
          case 's':
            e.preventDefault();
            onToolChange('select');
            break;
          case 'p':
            e.preventDefault();
            onToolChange('pan');
            break;
          case 'l':
            e.preventDefault();
            onToolChange('line');
            break;
          case 'r':
            e.preventDefault();
            onToolChange('rectangle');
            break;
          case 'c':
            e.preventDefault();
            onToolChange('circle');
            break;
          case 'm':
            e.preventDefault();
            onToolChange('move');
            break;
          case 'd':
            e.preventDefault();
            onToolChange('measure');
            break;
          case 'w':
            e.preventDefault();
            onToolChange('zoom-window' as ToolType);
            break;
          case 'g':
            e.preventDefault();
            onAction('grid');
            break;
          case 'f':
            e.preventDefault();
            onAction('fit');
            break;
          case 'f9':
            e.preventDefault();
            onAction('toggle-snap');
            break;
          case 'delete':
            e.preventDefault();
            onAction('delete-selected');
            break;
          case 'escape':
            e.preventDefault();
            onToolChange('select');
            onAction('clear-selection');
            break;
        }
      }
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
  } = useProSnapIntegration(snapEnabled);
  
  const actionButtons = createActionButtons({
    canUndo,
    canRedo,
    snapEnabled: contextSnapEnabled,
    showGrid,
    showLayers,
    autoCrop,
    showCursorSettings,
    onAction: (action, data) => {
      console.log('🎯 EnhancedDXFToolbar onAction called:', action, data); // DEBUG - shows actual values
      onAction(action, data);
    }
  });

  const handleZoomIn = () => onAction('zoom-in-action');
  const handleZoomOut = () => onAction('zoom-out-action');
  const handleSetZoom = (zoom: number) => onAction('set-zoom', zoom);
  
  const handleToolChange = (tool: ToolType) => {
    console.log('🖐️ EnhancedDXFToolbar handleToolChange called:', { tool, activeTool }); // DEBUG

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
      console.log('🖐️ Calling onToolChange for tool:', tool); // DEBUG
      onToolChange(tool);
    }
  };

  return (
    <div className={`border ${getStatusBorder('muted')} ${quick.card} ${colors.bg.secondary} shadow-lg ${className}`}>  {/* ✅ ENTERPRISE: bg-gray-800 → CSS variable */}
      <div className="flex flex-wrap gap-1 p-2">
        <div className="flex gap-1 flex-1">
          <UploadDxfButton 
            className={`${iconSizes.xl} p-0 ${radius.md} border transition-colors duration-150 flex items-center justify-center ${colors.bg.hover} ${HOVER_BACKGROUND_EFFECTS.MUTED_DARK} ${colors.text.secondary} ${getStatusBorder('default')}`}  // ✅ ENTERPRISE: bg-gray-700 → CSS variable
            title="Upload DXF File (Legacy)"
            onFileSelect={onSceneImported}
          />

          <button
            onClick={() => setShowSimpleDialog(true)}
            className={`${iconSizes.xl} p-0 ${radius.md} border transition-colors duration-150 flex items-center justify-center ${colors.bg.info} ${HOVER_BACKGROUND_EFFECTS.PRIMARY} ${colors.text.inverted} ${getStatusBorder('info')}`}  // ✅ ENTERPRISE: bg-blue-700 → CSS variable
            title="Enhanced DXF Import with Project Management"
          >
            🔺
          </button>
          
          <div className={`w-px ${colors.bg.active} mx-1 my-1`} />

          {toolGroups.map((group, groupIndex) => (
            <div key={group.name} className="flex gap-1">
              {group.tools.map((tool) => (
                <ToolButton
                  key={tool.id}
                  tool={tool}
                  isActive={activeTool === tool.id || (tool.dropdownOptions && tool.dropdownOptions.some(option => option.id === activeTool))}
                  onClick={() => handleToolChange(tool.id)}
                  onDropdownSelect={(toolId) => handleToolChange(toolId as string)}
                  activeTool={activeTool}
                />
              ))}
              {groupIndex < toolGroups.length - 1 && (
                <div className={`w-px ${colors.bg.active} mx-1 my-1`} />
              )}
            </div>
          ))}
          
          <div className={`w-px ${colors.bg.active} mx-1 my-1`} />
          
          <ZoomControls
            currentZoom={currentZoom}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onSetZoom={handleSetZoom}
          />

          <div className={`w-px ${colors.bg.active} mx-1 my-1`} />
          
          {actionButtons.map((action) => (
            <ActionButton key={action.id} action={action} />
          ))}
        </div>

        <div className="flex-shrink-0">
          <div className={`w-px ${colors.bg.active} mx-2 my-1`} />
          <ProSnapToolbar
            enabledModes={enabledModes}
            onToggleMode={toggleMode}
            snapEnabled={contextSnapEnabled}
            onToggleSnap={toggleSnap}
            compact={true}
            className="flex-shrink-0"
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
        onFileImport={onSceneImported}
      />
    </div>
  );
};
