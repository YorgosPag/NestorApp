/**
 * ADR-176: Mobile Toolbar Layout
 *
 * Compact toolbar for mobile/tablet viewports.
 * Shows primary tools inline + overflow "More" button that opens
 * a bottom sheet with all remaining tools in a grid.
 *
 * @since 2026-02-12
 */

'use client';

import React, { useState, useCallback } from 'react';
import { Menu, MoreHorizontal, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useTranslation } from '@/i18n';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import type { ToolType, ToolDefinition, ActionDefinition } from './types';
import { toolGroups, createActionButtons } from './toolDefinitions';
import { isMobileDisabledTool, isMobilePrimaryTool } from './toolbar-responsive-config';
import { ToolButton, ActionButton } from './ToolButton';

interface MobileToolbarLayoutProps {
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
  onAction: (action: string, data?: number | string | Record<string, unknown>) => void;
  showGrid: boolean;
  autoCrop: boolean;
  canUndo: boolean;
  canRedo: boolean;
  snapEnabled: boolean;
  currentZoom: number;
  commandCount?: number;
  onSidebarToggle: () => void;
}

export const MobileToolbarLayout: React.FC<MobileToolbarLayoutProps> = ({
  activeTool,
  onToolChange,
  onAction,
  showGrid,
  autoCrop,
  canUndo,
  canRedo,
  snapEnabled,
  currentZoom,
  onSidebarToggle,
}) => {
  const [moreOpen, setMoreOpen] = useState(false);
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { quick, getStatusBorder } = useBorderTokens();
  const { t } = useTranslation('dxf-viewer');

  const handleToolSelect = useCallback((tool: ToolType) => {
    // Zoom actions route through onAction
    if (tool === 'zoom-in') { onAction('zoom-in'); return; }
    if (tool === 'zoom-out') { onAction('zoom-out'); return; }
    if (tool === 'zoom-extents') { onAction('fit-to-view'); return; }
    // 🔧 FIX (2026-02-13): Removed onAction('toggle-layers') — layer visibility independent of toolbar
    if (tool === 'layering') {
      if (activeTool === 'layering') {
        onToolChange('select');
      } else {
        onToolChange(tool);
      }
      return;
    }
    onToolChange(tool);
    setMoreOpen(false);
  }, [activeTool, onAction, onToolChange]);

  // Collect all tools from toolGroups for the overflow sheet
  const allTools: ToolDefinition[] = toolGroups.flatMap(g => g.tools);

  // Separate secondary tools (not in primary bar)
  const secondaryTools = allTools.filter(t => !isMobilePrimaryTool(t.id));

  // Action buttons for overflow — bridge boolean type from createActionButtons to onAction
  const actionButtons = createActionButtons({
    showGrid,
    autoCrop,
    canUndo,
    canRedo,
    snapEnabled,
    onAction: (action: string) => {
      onAction(action);
      setMoreOpen(false);
    },
  });

  return (
    <>
      {/* Primary mobile toolbar row */}
      <nav
        role="toolbar"
        aria-label="DXF Mobile Toolbar"
        className={`flex items-center ${PANEL_LAYOUT.GAP.HALF} ${PANEL_LAYOUT.SPACING.XS}`}
      >
        {/* Hamburger — opens sidebar drawer */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={onSidebarToggle} className={`${iconSizes.xl} p-0`}>
                <Menu className={iconSizes.md} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Sidebar</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className={`w-px h-5 ${colors.bg.active}`} />

        {/* Select */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={activeTool === 'select' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleToolSelect('select')}
                className={`${iconSizes.xl} p-0`}
              >
                <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.FONT_WEIGHT.BOLD}`}>S</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Select</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Pan */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={activeTool === 'pan' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleToolSelect('pan')}
                className={`${iconSizes.xl} p-0`}
              >
                <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.FONT_WEIGHT.BOLD}`}>P</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Pan</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className={`w-px h-5 ${colors.bg.active}`} />

        {/* Zoom In */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={() => handleToolSelect('zoom-in')} className={`${iconSizes.xl} p-0`}>
                <ZoomIn className={iconSizes.sm} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom In</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Zoom Out */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={() => handleToolSelect('zoom-out')} className={`${iconSizes.xl} p-0`}>
                <ZoomOut className={iconSizes.sm} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom Out</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Fit / Zoom Extents */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={() => handleToolSelect('zoom-extents')} className={`${iconSizes.xl} p-0`}>
                <Maximize2 className={iconSizes.sm} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Fit to View</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Spacer */}
        <div className="flex-1" />

        {/* More (overflow) */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={() => setMoreOpen(true)} className={`${iconSizes.xl} p-0`}>
                <MoreHorizontal className={iconSizes.md} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('entitiesSettings.moreOptions')}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </nav>

      {/* Bottom sheet with all remaining tools */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="max-h-[60vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t('toolbarStatus.tool')}</SheetTitle>
            <SheetDescription className="sr-only">All available drawing tools</SheetDescription>
          </SheetHeader>

          {/* Tool grid — 3 columns */}
          <section className={`grid grid-cols-3 ${PANEL_LAYOUT.GAP.SM} ${PANEL_LAYOUT.MARGIN.TOP_MD}`}>
            {secondaryTools.map(tool => {
              const isDisabled = isMobileDisabledTool(tool.id);
              return (
                <ToolButton
                  key={tool.id}
                  tool={tool}
                  isActive={activeTool === tool.id}
                  onClick={() => handleToolSelect(tool.id)}
                  disabled={isDisabled}
                  activeTool={activeTool}
                />
              );
            })}
          </section>

          {/* Action buttons */}
          <section className={`grid grid-cols-3 ${PANEL_LAYOUT.GAP.SM} ${PANEL_LAYOUT.MARGIN.TOP_MD}`}>
            {actionButtons.map(action => (
              <ActionButton key={action.id} action={action} />
            ))}
          </section>
        </SheetContent>
      </Sheet>
    </>
  );
};

MobileToolbarLayout.displayName = 'MobileToolbarLayout';
