/**
 * @fileoverview LayerItem — Individual layer card with visibility toggle, opacity slider,
 * lock/unlock, dropdown menu, inline rename, elements preview, and badges.
 * Extracted from AdminLayerManager.tsx for SRP compliance (ADR N.7.1).
 *
 * @module property-viewer/LayerItem
 */

'use client';

import '@/lib/design-system';
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { CommonBadge } from '@/core/badges';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { getDynamicBackgroundClass } from '@/components/ui/utils/dynamic-styles';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  ChevronDown,
  ChevronRight,
  MoreVertical,
  Grid,
  PenTool,
  Type,
  Ruler,
  Copy,
  Download,
  Trash2
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';

import type { Layer } from '@/types/layers';
import { LAYER_CATEGORIES } from '@/types/layers';

export interface LayerItemProps {
  layer: Layer;
  isSelected: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onToggleVisibility: () => void;
  onToggleLock: () => void;
  onOpacityChange: (opacity: number) => void;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onRename: (newName: string) => void;
}

/** Maximum elements shown in the preview before "and X more" */
const MAX_PREVIEW_ELEMENTS = 5;

export function LayerItem({
  layer,
  isSelected,
  isExpanded,
  onToggleExpand,
  onToggleVisibility,
  onToggleLock,
  onOpacityChange,
  onSelect,
  onDuplicate,
  onDelete,
  onRename
}: LayerItemProps) {
  const iconSizes = useIconSizes();
  const { radius } = useBorderTokens();
  const colors = useSemanticColors();
  const { t } = useTranslation(['dxf-viewer', 'dxf-viewer-settings', 'dxf-viewer-wizard', 'dxf-viewer-guides', 'dxf-viewer-panels', 'dxf-viewer-shell']);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameName, setRenameName] = useState(layer.name);

  const categoryInfo = layer.metadata?.category ? LAYER_CATEGORIES[layer.metadata.category] : null;

  const handleRename = () => {
    if (renameName.trim() && renameName !== layer.name) {
      onRename(renameName.trim());
    }
    setIsRenaming(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRename();
    } else if (e.key === 'Escape') {
      setRenameName(layer.name);
      setIsRenaming(false);
    }
  };

  return (
    <Card className={`mb-2 transition-all ${isSelected ? 'ring-2 ring-primary' : ''} ${layer.isVisible ? '' : 'opacity-60'}`}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          {/* Left side - Layer info */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {layer.elements.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className={`${iconSizes.sm} p-0`}
                onClick={onToggleExpand}
              >
                {isExpanded ? <ChevronDown className={iconSizes.xs} /> : <ChevronRight className={iconSizes.xs} />}
              </Button>
            )}

            {categoryInfo && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={`${iconSizes.xs} ${radius.full} flex-shrink-0 ${getDynamicBackgroundClass(categoryInfo.color)}`}
                  />
                </TooltipTrigger>
                <TooltipContent>{categoryInfo.name}</TooltipContent>
              </Tooltip>
            )}

            <div className="flex-1 min-w-0" onClick={onSelect}>
              {isRenaming ? (
                <Input
                  value={renameName}
                  onChange={(e) => setRenameName(e.target.value)}
                  onBlur={handleRename}
                  onKeyDown={handleKeyPress}
                  className="h-6 text-sm"
                  autoFocus
                />
              ) : (
                <div className="cursor-pointer">
                  <p className="text-sm font-medium truncate">{layer.name}</p>
                  {layer.description && (
                    <p className={cn("text-xs truncate", colors.text.muted)}>{layer.description}</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1">
              <CommonBadge
                status="company"
                customLabel={layer.elements.length.toString()}
                variant="secondary"
                className="text-xs"
              />
              {layer.isSystem && (
                <CommonBadge
                  status="company"
                  customLabel="System"
                  variant="outline"
                  className="text-xs"
                />
              )}
            </div>
          </div>

          {/* Right side - Controls */}
          <div className="flex items-center gap-1 ml-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`${iconSizes.md} p-0`}
                  onClick={onToggleVisibility}
                >
                  {layer.isVisible ? <Eye className={iconSizes.xs} /> : <EyeOff className={iconSizes.xs} />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{layer.isVisible ? t('layerManager.actions.hide') : t('layerManager.actions.show')}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`${iconSizes.md} p-0`}
                  onClick={onToggleLock}
                  disabled={layer.isSystem}
                >
                  {layer.isLocked ? <Lock className={iconSizes.xs} /> : <Unlock className={iconSizes.xs} />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{layer.isLocked ? t('layerManager.actions.unlock') : t('layerManager.actions.lock')}</TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className={`${iconSizes.md} p-0`}>
                  <MoreVertical className={iconSizes.xs} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {!layer.isSystem && (
                  <>
                    <DropdownMenuItem onClick={() => setIsRenaming(true)}>
                      <Type className={`${iconSizes.xs} mr-2`} />
                      {t('layerManager.actions.rename')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onDuplicate}>
                      <Copy className={`${iconSizes.xs} mr-2`} />
                      {t('layerManager.actions.duplicate')}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem>
                  <Download className={`${iconSizes.xs} mr-2`} />
                  {t('layerManager.actions.exportLayer')}
                </DropdownMenuItem>
                {!layer.isSystem && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onDelete} className="text-destructive">
                      <Trash2 className={`${iconSizes.xs} mr-2`} />
                      {t('layerManager.actions.delete')}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Opacity Slider */}
        <div className="mt-2 flex items-center gap-2">
          <span className={cn("text-xs w-16", colors.text.muted)}>{t('layerManager.labels.opacity')}</span>
          <Slider
            value={[layer.opacity * 100]}
            onValueChange={([value]) => onOpacityChange(value / 100)}
            max={100}
            step={5}
            className="flex-1"
            disabled={layer.isLocked}
          />
          <span className={cn("text-xs w-8", colors.text.muted)}>
            {Math.round(layer.opacity * 100)}%
          </span>
        </div>

        {/* Expanded content - Elements preview */}
        {isExpanded && layer.elements.length > 0 && (
          <Collapsible open={isExpanded}>
            <CollapsibleContent className="mt-3">
              <div className="space-y-1 pl-4 border-l-2 border-muted">
                {layer.elements.slice(0, MAX_PREVIEW_ELEMENTS).map((element) => (
                  <div key={element.id} className="flex items-center justify-between text-xs">
                    <span className={cn("flex items-center gap-2", colors.text.muted)}>
                      {element.type === 'property' && <Grid className={iconSizes.xs} />}
                      {element.type === 'annotation' && <Type className={iconSizes.xs} />}
                      {element.type === 'measurement' && <Ruler className={iconSizes.xs} />}
                      {element.type === 'line' && <PenTool className={iconSizes.xs} />}
                      {element.type} - {element.id.substring(0, 8)}...
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`${iconSizes.sm} p-0`}
                      onClick={() => {/* Toggle element visibility */}}
                    >
                      {element.isVisible ? <Eye className={iconSizes.xs} /> : <EyeOff className={iconSizes.xs} />}
                    </Button>
                  </div>
                ))}
                {layer.elements.length > MAX_PREVIEW_ELEMENTS && (
                  <p className={cn("text-xs", colors.text.muted)}>
                    {t('layerManager.labels.moreElements', { count: layer.elements.length - MAX_PREVIEW_ELEMENTS })}
                  </p>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
