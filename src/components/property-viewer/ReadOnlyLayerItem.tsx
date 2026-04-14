'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { CommonBadge } from '@/core/badges';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  Grid,
  PenTool,
  Type,
  Ruler,
} from 'lucide-react';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { layoutUtilities } from '@/styles/design-tokens';
import { LAYER_CATEGORIES } from '@/types/layers';
import type { Layer, LayerCategory } from '@/types/layers';

// ============================================================================
// Types
// ============================================================================

export type LayerCategoryKey = Exclude<LayerCategory, undefined>;

export interface ReadOnlyLayerItemProps {
  layer: Layer;
  isExpanded: boolean;
  onToggleExpand: () => void;
  visibilityState: { isVisible: boolean; opacity: number };
  onVisibilityChange: (isVisible: boolean) => void;
  onOpacityChange: (opacity: number) => void;
}

export interface LayerVisibilityState {
  [layerId: string]: {
    isVisible: boolean;
    opacity: number;
  };
}

export interface ReadOnlyLayerState {
  layers: Layer[];
  isLoading: boolean;
  isConnected: boolean;
  error: string | null;
  lastUpdated: string | null;
}

// ============================================================================
// Helpers
// ============================================================================

export const isLayerCategory = (value: string | undefined): value is LayerCategoryKey => {
  return !!value && Object.hasOwn(LAYER_CATEGORIES, value);
};

const DEFAULT_LAYER_CATEGORY = LAYER_CATEGORIES.structural;

export const getCategoryInfo = (category?: string): { color: string; name: string } => {
  if (isLayerCategory(category)) {
    return LAYER_CATEGORIES[category];
  }
  return {
    color: DEFAULT_LAYER_CATEGORY.color,
    name: category ?? DEFAULT_LAYER_CATEGORY.name
  };
};

// ============================================================================
// Component
// ============================================================================

export function ReadOnlyLayerItem({
  layer,
  isExpanded,
  onToggleExpand,
  visibilityState,
  onVisibilityChange,
  onOpacityChange
}: ReadOnlyLayerItemProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { t } = useTranslation(['dxf-viewer', 'dxf-viewer-settings', 'dxf-viewer-wizard', 'dxf-viewer-guides', 'dxf-viewer-panels', 'dxf-viewer-shell']);
  const categoryInfo = layer.metadata?.category ? getCategoryInfo(layer.metadata.category) : null;

  return (
    <Card className={`mb-2 transition-all ${visibilityState.isVisible ? '' : 'opacity-60'}`}>
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
                  <TooltipTrigger>
                    <div
                      className={`${iconSizes.xs} flex-shrink-0 rounded-full`}
                      style={layoutUtilities.dxf.colors.backgroundColor(categoryInfo.color)}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{categoryInfo.name}</p>
                  </TooltipContent>
                </Tooltip>
            )}

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{layer.name}</p>
              {layer.description && (
                <p className={cn("text-xs truncate", colors.text.muted)}>{layer.description}</p>
              )}
            </div>

            <div className="flex items-center gap-1">
              <CommonBadge
                status="company"
                customLabel={layer.elements.length}
                variant="secondary"
                className="text-xs"
              />
              {layer.isSystem && (
                <CommonBadge
                  status="company"
                  customLabel={t('layerManager.badges.system')}
                  variant="outline"
                  className="text-xs"
                />
              )}
            </div>
          </div>

          {/* Right side - Visibility control only */}
          <div className="flex items-center gap-1 ml-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`${iconSizes.md} p-0`}
                    onClick={() => onVisibilityChange(!visibilityState.isVisible)}
                  >
                    {visibilityState.isVisible ? <Eye className={iconSizes.xs} /> : <EyeOff className={iconSizes.xs} />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{visibilityState.isVisible ? t('layerManager.actions.hide') : t('layerManager.actions.show')} layer</p> {/* eslint-disable-line custom/no-hardcoded-strings */}
                </TooltipContent>
              </Tooltip>
          </div>
        </div>

        {/* Opacity Slider - only if visible */}
        {visibilityState.isVisible && (
          <div className="mt-2 flex items-center gap-2">
            <span className={cn("text-xs w-16", colors.text.muted)}>{t('layerManager.labels.opacity')}</span>
            <Slider
              value={[visibilityState.opacity * 100]}
              onValueChange={([value]) => onOpacityChange(value / 100)}
              max={100}
              step={5}
              className="flex-1"
            />
            <span className={cn("text-xs w-8", colors.text.muted)}>
              {Math.round(visibilityState.opacity * 100)}%
            </span>
          </div>
        )}

        {/* Expanded content - Elements preview (read-only) */}
        {isExpanded && layer.elements.length > 0 && (
          <Collapsible open={isExpanded}>
            <CollapsibleContent className="mt-3">
              <div className="space-y-1 pl-4 border-l-2 border-muted">
                {layer.elements.slice(0, 5).map((element) => (
                  <div key={element.id} className="flex items-center justify-between text-xs">
                    <span className={cn("flex items-center gap-2", colors.text.muted)}>
                      {element.type === 'property' && <Grid className={iconSizes.xs} />}
                      {element.type === 'annotation' && <Type className={iconSizes.xs} />}
                      {element.type === 'measurement' && <Ruler className={iconSizes.xs} />}
                      {element.type === 'line' && <PenTool className={iconSizes.xs} />}
                      {element.type} - {element.id.substring(0, 8)}...
                    </span>
                    <span className={cn("text-xs", colors.text.muted)}>
                      {element.isVisible ? t('layerManager.actions.show') : t('layerManager.actions.hide')}
                    </span>
                  </div>
                ))}
                {layer.elements.length > 5 && (
                  <p className={cn("text-xs", colors.text.muted)}>
                    {t('layerManager.labels.moreElements', { count: layer.elements.length - 5 })}
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
