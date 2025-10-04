'use client';

// DEBUG FLAG - Set to false to disable performance-heavy logging
const DEBUG_ENHANCED_DXF_TOOLBAR = false;

import React from 'react';
import type { ToolType } from './types';
import { toolGroups, createActionButtons } from './toolDefinitions';
import { useKeyboardShortcuts } from '../../keyboard/useKeyboardShortcuts';
import { useProSnapIntegration } from '../../hooks/common/useProSnapIntegration';
import { ZoomControls } from './ZoomControls';
import { ScaleControls } from './ScaleControls';
import { ToolButton, ActionButton } from './ToolButton';
import { ToolbarStatusBar } from './ToolbarStatusBar';
import { ProSnapToolbar } from '../components/ProSnapToolbar';
import UploadDxfButton from '../UploadDxfButton';
import { SimpleProjectDialog } from '../../components/SimpleProjectDialog';
import type { SceneModel } from '../../types/scene';

interface EnhancedDXFToolbarProps {
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
  onAction: (action: string, data?: any) => void;
  showGrid: boolean;
  autoCrop: boolean;
  canUndo: boolean;
  canRedo: boolean;
  snapEnabled: boolean;
  showLayers: boolean;
  showCalibration?: boolean;
  showCursorSettings?: boolean;
  currentZoom: number;
  commandCount?: number;
  className?: string;
  onSceneImported?: (file: File, encoding?: string) => void;
  mouseCoordinates?: { x: number; y: number } | null;
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
  showLayers,
  showCalibration = false,
  showCursorSettings = false,
  currentZoom,
  commandCount,
  className = '',
  onSceneImported,
  mouseCoordinates,
  showCoordinates = false,
}) => {
  const [showSimpleDialog, setShowSimpleDialog] = React.useState(false);
  
  useKeyboardShortcuts({ activeTool, onToolChange, onAction });
  
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
    showCalibration,
    showCursorSettings,
    onAction
  });

  const handleZoomIn = () => onAction('zoom-in-action');
  const handleZoomOut = () => onAction('zoom-out-action');
  const handleSetZoom = (zoom: number) => onAction('set-zoom', zoom);
  
  const handleToolChange = (tool: ToolType) => {
    if (DEBUG_ENHANCED_DXF_TOOLBAR) console.log('🔧 [EnhancedDXFToolbar] Tool clicked:', tool);
    if (DEBUG_ENHANCED_DXF_TOOLBAR) console.log('🔧 [EnhancedDXFToolbar] Current activeTool:', activeTool);
    if (tool === 'zoom-window') {
      onAction('zoom-window');
    } else if (tool === 'layering') {
      // UPDATED: Layering tool now uses Unified Grips System (UGS)
      console.log('🎯 [EnhancedDXFToolbar] Layering tool clicked');
      console.log('🎯 [EnhancedDXFToolbar] Current activeTool is:', activeTool);
      
      if (activeTool === 'layering') {
        console.log('🎯 [EnhancedDXFToolbar] Layering already active - toggling to select');
        onToolChange('select'); // Toggle off to select mode
      } else {
        console.log('🎯 [EnhancedDXFToolbar] Activating layering tool with UGS');
        onToolChange(tool); // Activate layering tool with UGS
        onAction('toggle-layers'); // Show layers panel
      }
    } else if (tool === 'grip-edit') {
      // Custom handling για το grip editing tool
      console.log('🎯 [EnhancedDXFToolbar] Grip Edit tool activated');
      onToolChange(tool);
      onAction('grip-edit');
    } else {
      onToolChange(tool);
    }
  };

  return (
    <div className={`border border-gray-600 rounded-lg bg-gray-800 shadow-lg ${className}`}>
      <div className="flex flex-wrap gap-1 p-2">
        <div className="flex gap-1 flex-1">
          <UploadDxfButton 
            className="h-8 w-8 p-0 rounded-md border transition-colors duration-150 flex items-center justify-center bg-gray-700 hover:bg-gray-600 text-gray-200 border-gray-500"
            title="Upload DXF File (Legacy)"
            onFileSelect={onSceneImported}
          />

          <button
            onClick={() => setShowSimpleDialog(true)}
            className="h-8 w-8 p-0 rounded-md border transition-colors duration-150 flex items-center justify-center bg-blue-700 hover:bg-blue-600 text-white border-blue-500"
            title="Enhanced DXF Import with Project Management"
          >
            🎯
          </button>
          
          <div className="w-px bg-gray-600 mx-1 my-1" />
          
          
          {toolGroups.map((group, groupIndex) => (
            <div key={group.name} className="flex gap-1">
              {group.tools.map((tool) => (
                <ToolButton
                  key={tool.id}
                  tool={tool}
                  isActive={activeTool === tool.id || (tool.dropdownOptions && tool.dropdownOptions.some(option => option.id === activeTool))}
                  onClick={() => handleToolChange(tool.id)}
                  onDropdownSelect={(toolId) => handleToolChange(toolId as any)}
                  activeTool={activeTool}
                />
              ))}
              {groupIndex < toolGroups.length - 1 && (
                <div className="w-px bg-gray-600 mx-1 my-1" />
              )}
            </div>
          ))}
          
          <div className="w-px bg-gray-600 mx-1 my-1" />
          
          <ZoomControls
            currentZoom={currentZoom}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onSetZoom={handleSetZoom}
          />
          
          <div className="w-px bg-gray-600 mx-1 my-1" />
          
          {actionButtons.map((action) => (
            <ActionButton key={action.id} action={action} />
          ))}
        </div>

        <div className="flex-shrink-0">
          <div className="w-px bg-gray-600 mx-2 my-1" />
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
