'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { CommonBadge } from '@/core/badges';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { DXF_LAYER_CATEGORY_LABELS } from '@/constants/property-statuses-enterprise';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createModuleLogger } from '@/lib/telemetry';

const adminLayerLogger = createModuleLogger('AdminLayerManager');

import {
  Layers,
  Search,
  Plus,
  Download,
  Upload,
  Settings,
  ChevronDown,
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { getDynamicBackgroundClass } from '@/components/ui/utils/dynamic-styles';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';

// 🏢 ENTERPRISE: SRP — extracted sub-components (ADR N.7.1)
import { CreateLayerDialog } from '@/components/property-viewer/CreateLayerDialog';
import { LayerItem } from '@/components/property-viewer/LayerItem';

// Re-export for backward compatibility
export { CreateLayerDialog } from '@/components/property-viewer/CreateLayerDialog';
export { LayerItem } from '@/components/property-viewer/LayerItem';
export type { CreateLayerDialogProps } from '@/components/property-viewer/CreateLayerDialog';
export type { LayerItemProps } from '@/components/property-viewer/LayerItem';

// Import types
import type { Property } from '@/types/property-viewer';
import type { LayerState } from './useLayerStates';
import type { Layer, LayerCategory } from '@/types/layers';
import { LAYER_CATEGORIES } from '@/types/layers';
import { useLayerManagement } from '@/hooks/useLayerManagement';
import { useCompanyId } from '@/hooks/useCompanyId';
import { useLayerSync } from '@/lib/layer-sync';
import '@/lib/design-system';

interface AdminLayerManagerProps {
  floorId: string;
  buildingId: string;
  userId: string;
  
  // Legacy compatibility for existing property management
  properties?: Property[];
  selectedPropertyIds?: string[];
  layerStates?: Record<string, LayerState>;
  onPropertySelect?: (propertyId: string, isShift: boolean) => void;
  onPropertyUpdate?: (propertyId: string, updates: Partial<Property>) => void;
  
  // Optional sync options
  className?: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  enableRealTimeSync?: boolean;
  showSyncStatus?: boolean;
}

// 🏢 ENTERPRISE: Type-safe LAYER_CATEGORIES access using Object.hasOwn
const getCategoryInfo = (category: string | undefined): { color: string; name: string } => {
  const fallback = { color: '#9ca3af', name: 'Unknown' }; // eslint-disable-line design-system/no-hardcoded-colors
  if (!category) return fallback;

  // Type-safe check using Object.hasOwn (ES2022+, polyfilled in modern TS)
  if (Object.hasOwn(LAYER_CATEGORIES, category)) {
    const categoryData = LAYER_CATEGORIES[category as Exclude<keyof typeof LAYER_CATEGORIES, undefined>];
    return { color: categoryData.color, name: categoryData.name };
  }

  return { ...fallback, name: category };
};


export function AdminLayerManager({
  floorId,
  buildingId,
  userId,
  properties: _properties = [],
  selectedPropertyIds: _selectedPropertyIds = [],
  layerStates: _layerStates = {},
  onPropertySelect: _onPropertySelect,
  onPropertyUpdate: _onPropertyUpdate,
  className,
  isCollapsed = false,
  onToggleCollapse,
  enableRealTimeSync = true,
  showSyncStatus = true
}: AdminLayerManagerProps) {
  const iconSizes = useIconSizes();
  const { radius } = useBorderTokens();
  const colors = useSemanticColors();
  // 🏢 ENTERPRISE: i18n support
  const { t } = useTranslation(['dxf-viewer', 'dxf-viewer-settings', 'dxf-viewer-wizard', 'dxf-viewer-guides', 'dxf-viewer-panels', 'dxf-viewer-shell']);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedLayers, setExpandedLayers] = useState<Set<string>>(new Set());
  const [showSystemLayers, setShowSystemLayers] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const companyId = useCompanyId()?.companyId ?? '';

  // Real-time sync with Properties (θυγατρικό)
  const { syncState, syncManager } = useLayerSync(
    floorId,
    buildingId,
    companyId,
    {
      enableRealtime: enableRealTimeSync,
      enableLogging: true
    }
  );
  
  // Use the enhanced layer management hook
  const {
    state,
    isLoading,
    error,
    createLayer,
    updateLayer,
    deleteLayer,
    duplicateLayer,
    toggleLayerVisibility,
    toggleLayerLock,
    setLayerOpacity,
    selectLayer,
  } = useLayerManagement({
    floorId,
    buildingId,
    userId,
    companyId,
    autoSave: true,
    enableRealtime: true
  });

  // Filter layers based on search and category
  const filteredLayers = useMemo(() => {
    return state.layers.filter(layer => {
      // Search filter
      if (searchQuery && !layer.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      // Category filter
      if (selectedCategory !== 'all' && layer.metadata?.category !== selectedCategory) {
        return false;
      }
      
      // System layers filter
      if (!showSystemLayers && layer.isSystem) {
        return false;
      }
      
      return true;
    });
  }, [state.layers, searchQuery, selectedCategory, showSystemLayers]);

  // Group layers by category for better organization
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

  const handleCreateLayer = async (layerData: {
    name: string;
    description: string;
    category: LayerCategory;
    color: string;
  }) => {
    try {
      const newLayerId = await createLayer({
        name: layerData.name,
        description: layerData.description,
        isVisible: true,
        isLocked: false,
        isSystem: false,
        opacity: 1,
        zIndex: state.layers.length + 1,
        color: { primary: layerData.color, opacity: 0.3 },
        defaultStyle: {
          strokeColor: layerData.color,
          fillColor: layerData.color,
          strokeWidth: 2,
          opacity: 0.3
        },
        elements: [],
        metadata: { 
          category: layerData.category,
          version: 1
        }
      });
      
      selectLayer(newLayerId);
      
      // Log the creation event for sync
      if (enableRealTimeSync) {
        syncManager.logEvent({
          type: 'layer:created',
          layerId: newLayerId,
          data: { name: layerData.name, category: layerData.category }
        });
      }
    } catch (error) {
      adminLayerLogger.error('Error creating layer', { error });
    }
  };

  const handleRenameLayer = async (layerId: string, newName: string) => {
    try {
      await updateLayer(layerId, { name: newName });
      
      // Log the update event for sync
      if (enableRealTimeSync) {
        syncManager.logEvent({
          type: 'layer:updated',
          layerId,
          data: { newName }
        });
      }
    } catch (error) {
      adminLayerLogger.error('Error renaming layer', { error });
    }
  };

  const categories = Object.keys(LAYER_CATEGORIES);

  if (isCollapsed) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={onToggleCollapse}
        className={className}
      >
        <Layers className={iconSizes.sm} />
      </Button>
    );
  }

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="flex items-center justify-center">
            <span className={cn("text-sm", colors.text.muted)}>{t('layerManager.loading')}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={className}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Layers className={iconSizes.sm} />
              {t('layerManager.title')}
              {showSyncStatus && (
                <div className="flex items-center gap-1">
                  {syncState.isConnected ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className={`${iconSizes.xs} bg-green-500 ${radius.full}`} />
                      </TooltipTrigger>
                      <TooltipContent>{t('layerManager.sync.connectedTooltip')}</TooltipContent>
                    </Tooltip>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className={`${iconSizes.xs} bg-red-500 ${radius.full}`} />
                      </TooltipTrigger>
                      <TooltipContent>{t('layerManager.sync.disconnectedTooltip')}</TooltipContent>
                    </Tooltip>
                  )}
                  {syncState.pendingOperations > 0 && (
                    <CommonBadge
                      status="company"
                      customLabel={syncState.pendingOperations.toString()}
                      variant="secondary"
                      className="text-xs"
                    />
                  )}
                </div>
              )}
              {onToggleCollapse && (
                <Button variant="ghost" size="sm" onClick={onToggleCollapse} className={`${iconSizes.sm} p-0 ml-1`}>
                  <ChevronDown className={iconSizes.xs} />
                </Button>
              )}
            </CardTitle>
            
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => setShowCreateDialog(true)}>
                <Plus className={iconSizes.xs} />
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Settings className={iconSizes.xs} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    <Download className={`${iconSizes.xs} mr-2`} />
                    {t('layerManager.actions.exportAll')}
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Upload className={`${iconSizes.xs} mr-2`} />
                    {t('layerManager.actions.importLayers')}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShowSystemLayers(!showSystemLayers)}>
                    {showSystemLayers ? t('layerManager.actions.hideSystemLayers') : t('layerManager.actions.showSystemLayers')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-3 space-y-3">
          {/* Search and Filters */}
          <div className="space-y-2">
            <div className="relative">
              <Search className={cn(`absolute left-2 top-2.5 ${iconSizes.xs}`, colors.text.muted)} />
              <Input
                placeholder={t('layerManager.labels.searchLayers')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-7 h-8 text-sm"
              />
            </div>
            
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
                        className={`${iconSizes.xs} ${radius.full} ${getDynamicBackgroundClass(getCategoryInfo(category).color)}`}
                      />
                      {getCategoryInfo(category).name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Error display */}
          {error && (
            <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
              {error}
            </div>
          )}

          {/* Layer Statistics with Sync Info */}
          <div className={cn("flex justify-between text-xs", colors.text.muted)}>
            <span>{t('layerManager.stats.total')} {state.layers.length}</span>
            <span>{t('layerManager.stats.visible')} {state.layers.filter(l => l.isVisible).length}</span>
            <span>{t('layerManager.stats.elements')} {state.layers.reduce((acc, l) => acc + l.elements.length, 0)}</span>
          </div>
          
          {/* Sync Status Info */}
          {showSyncStatus && enableRealTimeSync && (
            <div className={cn("text-xs", colors.text.muted)}>
              <div className="flex justify-between items-center">
                <span>{t('layerManager.sync.status')}</span>
                <span className={syncState.isConnected ? 'text-green-600' : 'text-red-600'}> {/* eslint-disable-line design-system/enforce-semantic-colors */}
                  {syncState.isConnected ? t('layerManager.sync.connected') : t('layerManager.sync.disconnected')}
                </span>
              </div>
              {syncState.lastSyncTime && (
                <div className="flex justify-between items-center">
                  <span>{t('layerManager.sync.lastSync')}</span>
                  <span>{new Date(syncState.lastSyncTime).toLocaleTimeString('el-GR')}</span>
                </div>
              )}
              {syncState.errors.length > 0 && (
                <div className="text-destructive text-xs mt-1">
                  {t('layerManager.sync.errors')} {syncState.errors.length}
                </div>
              )}
            </div>
          )}

          <Separator />

          {/* Layers List */}
          <ScrollArea className="max-h-96">
            <div className="space-y-2">
              {Object.entries(groupedLayers).map(([category, layers]) => (
                <div key={category}>
                  <h4 className={cn("text-xs font-medium mb-1 flex items-center gap-2", colors.text.muted)}>
                    {category !== 'other' && getCategoryInfo(category) && (
                      <>
                        <div
                          className={`${iconSizes.xs} ${radius.full} ${getDynamicBackgroundClass(getCategoryInfo(category).color)}`}
                        />
                        {getCategoryInfo(category).name}
                      </>
                    )}
                    {category === 'other' && t('layerManager.labels.other')}
                    <CommonBadge
                      status="company"
                      customLabel={layers.length.toString()}
                      variant="outline"
                      className="text-xs"
                    />
                  </h4>
                  
                  {layers.map(layer => (
                    <LayerItem
                      key={layer.id}
                      layer={layer}
                      isSelected={state.activeLayerId === layer.id}
                      isExpanded={expandedLayers.has(layer.id)}
                      onToggleExpand={() => handleToggleExpand(layer.id)}
                      onToggleVisibility={() => toggleLayerVisibility(layer.id)}
                      onToggleLock={() => toggleLayerLock(layer.id)}
                      onOpacityChange={(opacity) => setLayerOpacity(layer.id, opacity)}
                      onSelect={() => selectLayer(layer.id)}
                      onDuplicate={() => duplicateLayer(layer.id)}
                      onDelete={() => deleteLayer(layer.id)}
                      onRename={(newName) => handleRenameLayer(layer.id, newName)}
                    />
                  ))}
                </div>
              ))}
              
              {filteredLayers.length === 0 && (
                <div className={cn("text-center py-8", colors.text.muted)}>
                  <Layers className={`${iconSizes.xl} mx-auto mb-2 opacity-50`} />
                  <p className="text-sm">{t('layerManager.labels.noLayersFound')}</p>
                  <p className="text-xs">{t('layerManager.labels.createNewOrChangeFilters')}</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Create Layer Dialog */}
      <CreateLayerDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreateLayer={handleCreateLayer}
      />
    </>
  );
}
