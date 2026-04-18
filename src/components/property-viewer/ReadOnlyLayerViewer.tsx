'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { CommonBadge } from '@/core/badges';
import { Spinner as AnimatedSpinner } from '@/components/ui/spinner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { DXF_LAYER_CATEGORY_LABELS } from '@/constants/property-statuses-enterprise';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('ReadOnlyLayerViewer');
import {
  Layers,
  Search,
  ChevronUp,
  Info,
  Wifi,
  WifiOff
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { layoutUtilities } from '@/styles/design-tokens';

import type { Property } from '@/types/property-viewer';
import { LAYER_CATEGORIES } from '@/types/layers';
import type { Layer } from '@/types/layers';
import { firestoreQueryService } from '@/services/firestore';
import type { QueryResult } from '@/services/firestore';
import { where, orderBy, type DocumentData } from 'firebase/firestore';

// 🏢 ENTERPRISE: Import extracted sub-component + types/helpers
import {
  ReadOnlyLayerItem,
  getCategoryInfo,
  type ReadOnlyLayerState,
  type LayerVisibilityState,
} from './ReadOnlyLayerItem';
import { nowISO } from '@/lib/date-local';

// Re-export for backward compatibility
export { ReadOnlyLayerItem } from './ReadOnlyLayerItem';
export type { ReadOnlyLayerItemProps, ReadOnlyLayerState, LayerVisibilityState } from './ReadOnlyLayerItem';

interface ReadOnlyLayerViewerProps {
  floorId: string;
  buildingId: string;
  properties?: Property[];
  className?: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onLayerVisibilityChange?: (layerId: string, isVisible: boolean) => void;
  onLayerOpacityChange?: (layerId: string, opacity: number) => void;
  showSearch?: boolean;
  showCategoryFilter?: boolean;
  showStatistics?: boolean;
  maxHeight?: string;
}

export function ReadOnlyLayerViewer({
  floorId,
  buildingId: _buildingId,
  properties: _properties = [],
  className,
  isCollapsed = false,
  onToggleCollapse,
  onLayerVisibilityChange,
  onLayerOpacityChange,
  showSearch = true,
  showCategoryFilter = true,
  showStatistics = true,
  maxHeight = "400px"
}: ReadOnlyLayerViewerProps) {
  const iconSizes = useIconSizes();
  const { radius: _radius } = useBorderTokens();
  const colors = useSemanticColors();
  const { t } = useTranslation(['dxf-viewer', 'dxf-viewer-settings', 'dxf-viewer-wizard', 'dxf-viewer-guides', 'dxf-viewer-panels', 'dxf-viewer-shell']);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedLayers, setExpandedLayers] = useState<Set<string>>(new Set());

  const [layerState, setLayerState] = useState<ReadOnlyLayerState>({
    layers: [],
    isLoading: true,
    isConnected: false,
    error: null,
    lastUpdated: null
  });

  const [visibilityState, setVisibilityState] = useState<LayerVisibilityState>({});

  useEffect(() => {
    if (!floorId) return;

    setLayerState(prev => ({ ...prev, isLoading: true }));

    const unsubscribe = firestoreQueryService.subscribe<DocumentData>(
      'LAYERS',
      (result: QueryResult<DocumentData>) => {
        const layers: Layer[] = result.documents.map(doc => ({
          id: doc.id,
          ...doc,
        } as Layer));

        const newVisibilityState = { ...visibilityState };
        layers.forEach(layer => {
          if (!newVisibilityState[layer.id]) {
            newVisibilityState[layer.id] = {
              isVisible: layer.isVisible,
              opacity: layer.opacity
            };
          }
        });

        setLayerState({
          layers,
          isLoading: false,
          isConnected: true,
          error: null,
          lastUpdated: nowISO()
        });
        setVisibilityState(newVisibilityState);
      },
      (error: Error) => {
        logger.error('Error syncing layers', { error: error.message });
        setLayerState(prev => ({
          ...prev,
          isLoading: false,
          isConnected: false,
          error: t('layerManager.readOnly.dbConnectionError')
        }));
      },
      {
        constraints: [
          where('floorId', '==', floorId),
          orderBy('zIndex', 'asc'),
        ],
      }
    );

    return () => unsubscribe();
  }, [floorId]);

  const filteredLayers = useMemo(() => {
    return layerState.layers.filter(layer => {
      if (searchQuery && !layer.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (selectedCategory !== 'all' && layer.metadata?.category !== selectedCategory) {
        return false;
      }
      return true;
    });
  }, [layerState.layers, searchQuery, selectedCategory]);

  const groupedLayers = useMemo(() => {
    const groups: Record<string, Layer[]> = {};
    filteredLayers.forEach(layer => {
      const category = layer.metadata?.category || 'other';
      if (!groups[category]) groups[category] = [];
      groups[category].push(layer);
    });
    return groups;
  }, [filteredLayers]);

  const handleToggleExpand = (layerId: string) => {
    setExpandedLayers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(layerId)) {
        newSet.delete(layerId);
      } else {
        newSet.add(layerId);
      }
      return newSet;
    });
  };

  const handleVisibilityChange = (layerId: string, isVisible: boolean) => {
    setVisibilityState(prev => ({
      ...prev,
      [layerId]: { ...prev[layerId], isVisible }
    }));
    onLayerVisibilityChange?.(layerId, isVisible);
  };

  const handleOpacityChange = (layerId: string, opacity: number) => {
    setVisibilityState(prev => ({
      ...prev,
      [layerId]: { ...prev[layerId], opacity }
    }));
    onLayerOpacityChange?.(layerId, opacity);
  };

  const categories = Object.keys(LAYER_CATEGORIES);
  const visibleLayers = layerState.layers.filter(l => visibilityState[l.id]?.isVisible);

  if (isCollapsed) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={onToggleCollapse}
        className={className}
      >
        <Layers className={iconSizes.sm} />
        {!layerState.isConnected && <WifiOff className={`${iconSizes.xs} ml-1 text-destructive`} />}
      </Button>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Layers className={iconSizes.sm} />
            {t('layerManager.readOnly.title')}
            {onToggleCollapse && (
              <Button variant="ghost" size="sm" onClick={onToggleCollapse} className={`${iconSizes.sm} p-0 ml-1`}>
                <ChevronUp className={iconSizes.xs} />
              </Button>
            )}
          </CardTitle>

          <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger>
                  {layerState.isConnected ? (
                    <Wifi className={`${iconSizes.sm} text-green-500`} />
                  ) : (
                    <WifiOff className={`${iconSizes.sm} text-destructive`} />
                  )}
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {layerState.isConnected
                      ? t('layerManager.readOnly.connectedRealtime')
                      : t('layerManager.readOnly.disconnectedNoUpdates')
                    }
                  </p>
                  {layerState.lastUpdated && (
                    <p className="text-xs">
                      {t('layerManager.readOnly.lastUpdate')} {new Date(layerState.lastUpdated).toLocaleTimeString('el-GR')}
                    </p>
                  )}
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger>
                  <Info className={`${iconSizes.sm} ${colors.text.muted}`} />
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t('layerManager.readOnly.viewModeOnly')}</p>
                  <p className="text-xs">{t('layerManager.readOnly.canOnlyChangeVisibility')}</p>
                </TooltipContent>
              </Tooltip>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-3 space-y-3">
        {(showSearch || showCategoryFilter) && (
          <div className="space-y-2">
            {showSearch && (
              <div className="relative">
                <Search className={cn(`absolute left-2 top-2.5 ${iconSizes.xs}`, colors.text.muted)} />
                <Input
                  placeholder={t('layerManager.labels.searchLayers')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-7 h-8 text-sm"
                />
              </div>
            )}

            {showCategoryFilter && (
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t(DXF_LAYER_CATEGORY_LABELS.all)}</SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>
                      <div className="flex items-center gap-2">
                        <div
                          className={`${iconSizes.xs} rounded-full`}
                          style={layoutUtilities.dxf.colors.backgroundColor(getCategoryInfo(category).color)}
                        />
                        {getCategoryInfo(category).name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {layerState.error && (
          <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
            {layerState.error}
          </div>
        )}

        {showStatistics && (
          <div className={cn("flex justify-between text-xs", colors.text.muted)}>
            <span>{t('layerManager.stats.total')} {layerState.layers.length}</span>
            <span>{t('layerManager.stats.visible')} {visibleLayers.length}</span>
            <span>{t('layerManager.stats.elements')} {layerState.layers.reduce((acc, l) => acc + l.elements.length, 0)}</span>
          </div>
        )}

        <Separator />

        {layerState.isLoading && (
          <div className={cn("text-center py-4", colors.text.muted)}>
            <div className="flex items-center justify-center gap-2">
              <AnimatedSpinner size="small" />
              <span className="text-sm">{t('layerManager.loading')}</span>
            </div>
          </div>
        )}

        {!layerState.isLoading && (
          <ScrollArea style={{ maxHeight: layoutUtilities.maxHeight(maxHeight) }}>
            <div className="space-y-2">
              {Object.entries(groupedLayers).map(([category, layers]) => (
                <div key={category}>
                  <h4 className={cn("text-xs font-medium mb-1 flex items-center gap-2", colors.text.muted)}>
                    {category !== 'other' && getCategoryInfo(category) && (
                      <>
                        <div
                          className={`${iconSizes.xs} rounded-full`}
                          style={layoutUtilities.dxf.colors.backgroundColor(getCategoryInfo(category).color)}
                        />
                        {getCategoryInfo(category).name}
                      </>
                    )}
                    {category === 'other' && t('layerManager.labels.other')}
                    <CommonBadge
                      status="company"
                      customLabel={layers.length}
                      variant="outline"
                      className="text-xs"
                    />
                  </h4>

                  {layers.map(layer => (
                    <ReadOnlyLayerItem
                      key={layer.id}
                      layer={layer}
                      isExpanded={expandedLayers.has(layer.id)}
                      onToggleExpand={() => handleToggleExpand(layer.id)}
                      visibilityState={visibilityState[layer.id] || { isVisible: layer.isVisible, opacity: layer.opacity }}
                      onVisibilityChange={(isVisible) => handleVisibilityChange(layer.id, isVisible)}
                      onOpacityChange={(opacity) => handleOpacityChange(layer.id, opacity)}
                    />
                  ))}
                </div>
              ))}

              {filteredLayers.length === 0 && !layerState.isLoading && (
                <div className={cn("text-center py-8", colors.text.muted)}>
                  <Layers className={`${iconSizes.xl} mx-auto mb-2 opacity-50`} />
                  <p className="text-sm">{t('layerManager.labels.noLayersFound')}</p>
                  {layerState.isConnected ? (
                    <p className="text-xs">{t('layerManager.readOnly.waitForAdmins')}</p>
                  ) : (
                    <p className="text-xs">{t('layerManager.readOnly.checkConnection')}</p>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {layerState.lastUpdated && layerState.isConnected && (
          <div className={cn("text-xs text-center pt-2", colors.text.muted)}>
            {t('layerManager.readOnly.lastUpdate')} {new Date(layerState.lastUpdated).toLocaleTimeString('el-GR')}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
