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
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { HOVER_BACKGROUND_EFFECTS, HOVER_TEXT_EFFECTS } from '@/components/ui/effects';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { LucideIcon } from 'lucide-react';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

type ViewMode = 'view' | 'create' | 'measure' | 'edit';
type ToolId = 'select' | 'create' | 'measure' | 'move' | 'connect' | 'rectangle' | 'circle' | 'polygon' | 'delete';

interface Tool {
  id: ToolId;
  icon: LucideIcon;
  label: string;
  shortcut?: string;
}

/** Connection pair between two property IDs */
interface ConnectionPair {
  from: string;
  to: string;
}

/** Property data for viewer */
interface ViewerProperty {
  id: string;
  name?: string;
  [key: string]: unknown;
}

interface ViewerToolsProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  selectedPropertyId?: string | null;
  onPropertySelect?: (id: string | null) => void;
  isConnecting?: boolean;
  onConnectingChange?: (connecting: boolean) => void;
  connectionPairs?: ConnectionPair[];
  onConnectionPairsChange?: (pairs: ConnectionPair[]) => void;
  properties?: ViewerProperty[];
  isReadOnly?: boolean;
  className?: string;
}

// 🏢 ENTERPRISE: Tool definitions (labels come from i18n)
const TOOL_DEFINITIONS: Array<{ id: ToolId; icon: LucideIcon; shortcut: string }> = [
  { id: 'select', icon: MousePointer, shortcut: 'V' },
  { id: 'create', icon: Plus, shortcut: 'C' },
  { id: 'measure', icon: Ruler, shortcut: 'M' },
  { id: 'move', icon: Move, shortcut: 'G' },
  { id: 'connect', icon: Link, shortcut: 'L' },
  { id: 'rectangle', icon: Square, shortcut: 'R' },
  { id: 'circle', icon: Circle, shortcut: 'O' },
  { id: 'polygon', icon: Triangle, shortcut: 'P' },
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
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('properties');
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();

  // 🏢 ENTERPRISE: Build tools with translated labels
  const TOOLS: Tool[] = TOOL_DEFINITIONS.map(def => ({
    ...def,
    label: t(`viewer.tools.${def.id}`)
  }));

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
    
    if (confirm(t('viewer.confirm.deleteProperty'))) {
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
        activeTool === tool.id && cn(`${colors.bg.info} text-white`, HOVER_BACKGROUND_EFFECTS.BLUE)
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
      `flex items-center gap-2 p-2 ${colors.bg.primary} ${quick.separatorH}`,
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
          title={t('viewer.actions.copySelected')}
        >
          <Copy className={iconSizes.sm} />
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          className={cn(`${iconSizes.xl} p-0`, HOVER_TEXT_EFFECTS.RED)}
          onClick={handleDeleteSelected}
          disabled={!selectedPropertyId || isReadOnly}
          title={t('viewer.actions.deleteSelected')}
        >
          <Trash2 className={iconSizes.sm} />
        </Button>

        <Button
          variant="outline"
          size="sm"
          className={`${iconSizes.xl} p-0`}
          onClick={handleResetView}
          title={t('viewer.actions.reset')}
        >
          <RotateCcw className={iconSizes.sm} />
        </Button>
      </div>

      {/* STATUS INFO */}
      <div className={`ml-auto flex items-center gap-4 text-xs ${colors.text.muted}`}>
        <span>{t('viewer.status.tool')}: {TOOLS.find(tool => tool.id === activeTool)?.label}</span>
        <span>{t('viewer.status.mode')}: {viewMode}</span>
        {isConnecting && <span className={colors.text.info}>• {t('viewer.status.connecting')}</span>}
        {selectedPropertyId && <span className={colors.text.success}>• {t('viewer.status.selected')}: {selectedPropertyId}</span>}
        {isReadOnly && <span className={colors.text.warning}>• {t('viewer.status.readOnly')}</span>}
      </div>
    </div>
  );
}
