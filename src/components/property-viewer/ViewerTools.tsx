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
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createModuleLogger } from '@/lib/telemetry';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useNotifications } from '@/providers/NotificationProvider';
import '@/lib/design-system';

const logger = createModuleLogger('ViewerTools');

type ViewMode = 'view' | 'create' | 'measure' | 'edit';
type ToolId = 'select' | 'create' | 'measure' | 'move' | 'connect' | 'rectangle' | 'circle' | 'polygon' | 'delete';

interface Tool {
  id: ToolId;
  icon: LucideIcon;
  label: string;
  shortcut?: string;
}

interface ConnectionPair {
  from: string;
  to: string;
}

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
  onDuplicateSelected?: (propertyId: string) => Promise<void> | void;
  onDeleteSelected?: (propertyId: string) => Promise<void> | void;
  isReadOnly?: boolean;
  className?: string;
}

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
  connectionPairs: _connectionPairs = [],
  onConnectionPairsChange: _onConnectionPairsChange,
  properties: _properties = [],
  onDuplicateSelected,
  onDeleteSelected,
  isReadOnly = false,
  className
}: ViewerToolsProps) {
  const { t } = useTranslation('properties');
  const { confirm, dialogProps } = useConfirmDialog();
  const { warning } = useNotifications();
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();

  const TOOLS: Tool[] = TOOL_DEFINITIONS.map(def => ({
    ...def,
    label: t(`viewer.tools.${def.id}`)
  }));

  const [activeTool, setActiveTool] = useState<ToolId>('select');

  const handleToolChange = (toolId: ToolId) => {
    if (isReadOnly) {
      logger.warn('Cannot change tool in read-only mode');
      return;
    }

    setActiveTool(toolId);

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

    logger.info('Tool changed', { toolId, viewMode });
  };

  const handleDeleteSelected = async () => {
    if (!selectedPropertyId || isReadOnly) return;

    const confirmed = await confirm({
      title: t('viewer.actions.deleteSelected'),
      description: t('viewer.confirm.deleteProperty'),
      variant: 'destructive',
    });
    if (!confirmed) return;

    if (!onDeleteSelected) {
      warning(t('viewer.messages.deleteUseGuardedFlow'));
      logger.info('Blocked viewer delete because canonical delete handler is not wired.', { selectedPropertyId });
      return;
    }

    await onDeleteSelected(selectedPropertyId);
  };

  const handleCopySelected = async () => {
    if (!selectedPropertyId || isReadOnly) return;

    if (!onDuplicateSelected) {
      warning(t('viewer.messages.duplicateBlocked'));
      logger.info('Blocked viewer copy because canonical duplicate handler is not wired.', { selectedPropertyId });
      return;
    }

    await onDuplicateSelected(selectedPropertyId);
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
    <Tooltip>
      <TooltipTrigger asChild>
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
        >
          <tool.icon className={iconSizes.sm} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{`${tool.label} ${tool.shortcut ? `(${tool.shortcut})` : ''}`}</TooltipContent>
    </Tooltip>
  );

  return (
    <div className={cn(
      `flex items-center gap-2 p-2 ${colors.bg.primary} ${quick.separatorH}`,
      className
    )}>
      <div className="flex items-center gap-1">
        {TOOLS.slice(0, 5).map(tool => (
          <ToolButton key={tool.id} tool={tool} />
        ))}
      </div>

      <Separator orientation="vertical" className="h-6" />

      <div className="flex items-center gap-1">
        {TOOLS.slice(5).map(tool => (
          <ToolButton key={tool.id} tool={tool} />
        ))}
      </div>

      <Separator orientation="vertical" className="h-6" />

      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={`${iconSizes.xl} p-0`}
              onClick={() => {
                void handleCopySelected();
              }}
              disabled={!selectedPropertyId || isReadOnly}
            >
              <Copy className={iconSizes.sm} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('viewer.actions.copySelected')}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(`${iconSizes.xl} p-0`, HOVER_TEXT_EFFECTS.RED)}
              onClick={() => {
                void handleDeleteSelected();
              }}
              disabled={!selectedPropertyId || isReadOnly}
            >
              <Trash2 className={iconSizes.sm} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('viewer.actions.deleteSelected')}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={`${iconSizes.xl} p-0`}
              onClick={handleResetView}
            >
              <RotateCcw className={iconSizes.sm} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('viewer.actions.reset')}</TooltipContent>
        </Tooltip>
      </div>

      <div className={`ml-auto flex items-center gap-4 text-xs ${colors.text.muted}`}>
        <span>{t('viewer.status.tool')}: {TOOLS.find(tool => tool.id === activeTool)?.label}</span>
        <span>{t('viewer.status.mode')}: {viewMode}</span>
        {isConnecting && <span className={colors.text.info}>• {t('viewer.status.connecting')}</span>}
        {selectedPropertyId && <span className={colors.text.success}>• {t('viewer.status.selected')}: {selectedPropertyId}</span>}
        {isReadOnly && <span className={colors.text.warning}>• {t('viewer.status.readOnly')}</span>}
      </div>
      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
