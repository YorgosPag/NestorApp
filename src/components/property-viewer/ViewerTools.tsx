'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  MousePointer, 
  Plus, 
  Ruler, 
  Move, 
  Link, 
  Square,
  Circle,
  Triangle,
  Trash2,
  Copy,
  RotateCcw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { HOVER_BACKGROUND_EFFECTS, HOVER_TEXT_EFFECTS } from '@/components/ui/effects';

type ViewMode = 'view' | 'create' | 'measure' | 'edit';
type ToolId = 'select' | 'create' | 'measure' | 'move' | 'connect' | 'rectangle' | 'circle' | 'polygon' | 'delete';

interface Tool {
  id: ToolId;
  icon: any;
  label: string;
  shortcut?: string;
}

interface ViewerToolsProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  selectedPropertyId?: string | null;
  onPropertySelect?: (id: string | null) => void;
  isConnecting?: boolean;
  onConnectingChange?: (connecting: boolean) => void;
  connectionPairs?: any[];
  onConnectionPairsChange?: (pairs: any[]) => void;
  properties?: any[];
  isReadOnly?: boolean;
  className?: string;
}

const TOOLS: Tool[] = [
  { id: 'select', icon: MousePointer, label: 'Επιλογή', shortcut: 'V' },
  { id: 'create', icon: Plus, label: 'Δημιουργία', shortcut: 'C' },
  { id: 'measure', icon: Ruler, label: 'Μέτρηση', shortcut: 'M' },
  { id: 'move', icon: Move, label: 'Μετακίνηση', shortcut: 'G' },
  { id: 'connect', icon: Link, label: 'Σύνδεση', shortcut: 'L' },
  { id: 'rectangle', icon: Square, label: 'Ορθογώνιο', shortcut: 'R' },
  { id: 'circle', icon: Circle, label: 'Κύκλος', shortcut: 'O' },
  { id: 'polygon', icon: Triangle, label: 'Πολύγωνο', shortcut: 'P' },
];

export function ViewerTools({
  viewMode,
  onViewModeChange,
  selectedPropertyId,
  onPropertySelect,
  isConnecting = false,
  onConnectingChange,
  connectionPairs = [],
  onConnectionPairsChange,
  properties = [],
  isReadOnly = false,
  className
}: ViewerToolsProps) {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();

  // Local state για active tool
  const [activeTool, setActiveTool] = useState<ToolId>('select');

  // Handle tool change
  const handleToolChange = (toolId: ToolId) => {
    if (isReadOnly) {
      console.warn('Cannot change tool in read-only mode');
      return;
    }

    setActiveTool(toolId);

    // Map tools to view modes
    switch (toolId) {
      case 'select':
        onViewModeChange('view');
        break;
      case 'create':
      case 'rectangle':
      case 'circle':
      case 'polygon':
        onViewModeChange('create');
        break;
      case 'measure':
        onViewModeChange('measure');
        break;
      case 'move':
        onViewModeChange('edit');
        break;
      case 'connect':
        onViewModeChange('view');
        if (onConnectingChange) {
          onConnectingChange(!isConnecting);
        }
        break;
      default:
        onViewModeChange('view');
    }

    console.log('🛠️ Tool changed:', toolId, '→ Mode:', viewMode);
  };

  // Handle property actions
  const handleDeleteSelected = () => {
    if (!selectedPropertyId || isReadOnly) return;
    
    if (confirm('Είστε σίγουροι ότι θέλετε να διαγράψετε το επιλεγμένο ακίνητο;')) {
      onPropertySelect?.(null);
      // TODO: Implement actual deletion
      console.log('🗑️ Delete property:', selectedPropertyId);
    }
  };

  const handleCopySelected = () => {
    if (!selectedPropertyId || isReadOnly) return;
    
    // TODO: Implement property copying
    console.log('📋 Copy property:', selectedPropertyId);
  };

  const handleResetView = () => {
    setActiveTool('select');
    onViewModeChange('view');
    onPropertySelect?.(null);
    if (onConnectingChange) {
      onConnectingChange(false);
    }
  };

  const ToolButton = ({ tool }: { tool: Tool }) => (
    <Button
      variant={activeTool === tool.id ? 'default' : 'outline'}
      size="sm"
      className={cn(
        `${iconSizes.xl} p-0`,
        activeTool === tool.id && cn("bg-blue-600 text-white", HOVER_BACKGROUND_EFFECTS.BLUE)
      )}
      onClick={() => handleToolChange(tool.id)}
      disabled={isReadOnly && tool.id !== 'select'}
      aria-label={tool.label}
      title={`${tool.label} ${tool.shortcut ? `(${tool.shortcut})` : ''}`}
    >
      <tool.icon className={iconSizes.sm} />
    </Button>
  );

  return (
    <div className={cn(
      `flex items-center gap-2 p-2 bg-white ${quick.separatorH}`,
      className
    )}>
      
      {/* BASIC TOOLS */}
      <div className="flex items-center gap-1">
        {TOOLS.slice(0, 5).map(tool => (
          <ToolButton key={tool.id} tool={tool} />
        ))}
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* SHAPE TOOLS */}
      <div className="flex items-center gap-1">
        {TOOLS.slice(5).map(tool => (
          <ToolButton key={tool.id} tool={tool} />
        ))}
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* PROPERTY ACTIONS */}
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className={`${iconSizes.xl} p-0`}
          onClick={handleCopySelected}
          disabled={!selectedPropertyId || isReadOnly}
          title="Αντιγραφή επιλεγμένου"
        >
          <Copy className={iconSizes.sm} />
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          className={cn(`${iconSizes.xl} p-0`, HOVER_TEXT_EFFECTS.RED)}
          onClick={handleDeleteSelected}
          disabled={!selectedPropertyId || isReadOnly}
          title="Διαγραφή επιλεγμένου"
        >
          <Trash2 className={iconSizes.sm} />
        </Button>

        <Button
          variant="outline"
          size="sm"
          className={`${iconSizes.xl} p-0`}
          onClick={handleResetView}
          title="Επαναφορά"
        >
          <RotateCcw className={iconSizes.sm} />
        </Button>
      </div>

      {/* STATUS INFO */}
      <div className="ml-auto flex items-center gap-4 text-xs text-gray-600">
        <span>Tool: {TOOLS.find(t => t.id === activeTool)?.label}</span>
        <span>Mode: {viewMode}</span>
        {isConnecting && <span className="text-blue-600">• Connecting</span>}
        {selectedPropertyId && <span className="text-green-600">• Selected: {selectedPropertyId}</span>}
        {isReadOnly && <span className="text-amber-600">• Read-Only</span>}
      </div>
    </div>
  );
}
