'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { CommonBadge } from '@/core/badges';
// 🏢 ENTERPRISE: Import from canonical location
import { Spinner as AnimatedSpinner } from '@/components/ui/spinner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { DXF_LAYER_CATEGORY_LABELS } from '@/constants/property-statuses-enterprise';
import { 
  Layers, 
  Eye, 
  EyeOff, 
  Search, 
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Info,
  Grid,
  PenTool,
  Type,
  Ruler,
  Wifi,
  WifiOff
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { layoutUtilities } from '@/styles/design-tokens';

// Import types
import type { Property } from '@/types/property-viewer';
import { LAYER_CATEGORIES } from '@/types/layers';
import type { Layer, LayerCategory } from '@/types/layers';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';

// Helper function for safe LAYER_CATEGORIES access
const getCategoryInfo = (category: string) => {
  return LAYER_CATEGORIES[category as keyof typeof LAYER_CATEGORIES] || { color: '#gray', name: category };
};

interface ReadOnlyLayerViewerProps {
  floorId: string;
  buildingId: string;
  
  // Optional properties for fallback display
  properties?: Property[];
  
  // Display options
  className?: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onLayerVisibilityChange?: (layerId: string, isVisible: boolean) => void;
  onLayerOpacityChange?: (layerId: string, opacity: number) => void;
  
  // Styling options
  showSearch?: boolean;
  showCategoryFilter?: boolean;
  showStatistics?: boolean;
  maxHeight?: string;
}

interface ReadOnlyLayerState {
  layers: Layer[];
  isLoading: boolean;
  isConnected: boolean;
  error: string | null;
  lastUpdated: string | null;
}

interface LayerVisibilityState {
  [layerId: string]: {
    isVisible: boolean;
    opacity: number;
  };
}

interface ReadOnlyLayerItemProps {
  layer: Layer;
  isExpanded: boolean;
  onToggleExpand: () => void;
  visibilityState: { isVisible: boolean; opacity: number };
  onVisibilityChange: (isVisible: boolean) => void;
  onOpacityChange: (opacity: number) => void;
}

function ReadOnlyLayerItem({
  layer,
  isExpanded,
  onToggleExpand,
  visibilityState,
  onVisibilityChange,
  onOpacityChange
}: ReadOnlyLayerItemProps) {
  const iconSizes = useIconSizes();
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
              <TooltipProvider>
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
              </TooltipProvider>
            )}
            
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{layer.name}</p>
              {layer.description && (
                <p className="text-xs text-muted-foreground truncate">{layer.description}</p>
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
                  customLabel="Σύστημα"
                  variant="outline"
                  className="text-xs"
                />
              )}
            </div>
          </div>

          {/* Right side - Visibility control only */}
          <div className="flex items-center gap-1 ml-2">
            <TooltipProvider>
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
                  <p>{visibilityState.isVisible ? 'Απόκρυψη' : 'Εμφάνιση'} layer</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Opacity Slider - only if visible */}
        {visibilityState.isVisible && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-16">Διαφάνεια:</span>
            <Slider
              value={[visibilityState.opacity * 100]}
              onValueChange={([value]) => onOpacityChange(value / 100)}
              max={100}
              step={5}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground w-8">
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
                    <span className="text-muted-foreground flex items-center gap-2">
                      {element.type === 'property' && <Grid className={iconSizes.xs} />}
                      {element.type === 'annotation' && <Type className={iconSizes.xs} />}
                      {element.type === 'measurement' && <Ruler className={iconSizes.xs} />}
                      {element.type === 'line' && <PenTool className={iconSizes.xs} />}
                      {element.type} - {element.id.substring(0, 8)}...
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {element.isVisible ? 'Ορατό' : 'Κρυφό'}
                    </span>
                  </div>
                ))}
                {layer.elements.length > 5 && (
                  <p className="text-xs text-muted-foreground">
                    +{layer.elements.length - 5} περισσότερα στοιχεία
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

export function ReadOnlyLayerViewer({
  floorId,
  buildingId,
  properties = [],
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
  const { radius } = useBorderTokens();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedLayers, setExpandedLayers] = useState<Set<string>>(new Set());
  
  // Layer state from Firestore (real-time sync)
  const [layerState, setLayerState] = useState<ReadOnlyLayerState>({
    layers: [],
    isLoading: true,
    isConnected: false,
    error: null,
    lastUpdated: null
  });
  
  // Local visibility state (user can control what they see)
  const [visibilityState, setVisibilityState] = useState<LayerVisibilityState>({});

  // Real-time sync with Firestore
  useEffect(() => {
    if (!floorId) return;

    setLayerState(prev => ({ ...prev, isLoading: true }));

    const layersQuery = query(
      collection(db, COLLECTIONS.LAYERS),
      where('floorId', '==', floorId),
      orderBy('zIndex', 'asc')
    );

    const unsubscribe = onSnapshot(
      layersQuery,
      (snapshot) => {
        const layers: Layer[] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Layer));

        // Initialize visibility state for new layers
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
          lastUpdated: new Date().toISOString()
        });
        setVisibilityState(newVisibilityState);
      },
      (error) => {
        console.error('Error syncing layers:', error);
        setLayerState(prev => ({
          ...prev,
          isLoading: false,
          isConnected: false,
          error: 'Σφάλμα σύνδεσης με τη βάση δεδομένων'
        }));
      }
    );

    // Cleanup subscription
    return () => unsubscribe();
  }, [floorId]);

  // Filter layers based on search and category
  const filteredLayers = useMemo(() => {
    return layerState.layers.filter(layer => {
      // Search filter
      if (searchQuery && !layer.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      // Category filter
      if (selectedCategory !== 'all' && layer.metadata?.category !== selectedCategory) {
        return false;
      }
      
      return true;
    });
  }, [layerState.layers, searchQuery, selectedCategory]);

  // Group layers by category
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
      [layerId]: {
        ...prev[layerId],
        isVisible
      }
    }));
    
    // Notify parent component
    onLayerVisibilityChange?.(layerId, isVisible);
  };

  const handleOpacityChange = (layerId: string, opacity: number) => {
    setVisibilityState(prev => ({
      ...prev,
      [layerId]: {
        ...prev[layerId],
        opacity
      }
    }));
    
    // Notify parent component
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
            Layers
            {onToggleCollapse && (
              <Button variant="ghost" size="sm" onClick={onToggleCollapse} className={`${iconSizes.sm} p-0 ml-1`}>
                <ChevronUp className={iconSizes.xs} />
              </Button>
            )}
          </CardTitle>
          
          <div className="flex items-center gap-2">
            {/* Connection Status */}
            <TooltipProvider>
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
                      ? 'Συνδεδεμένο - Ενημερώσεις σε πραγματικό χρόνο' 
                      : 'Αποσυνδεδεμένο - Δεν υπάρχουν ενημερώσεις'
                    }
                  </p>
                  {layerState.lastUpdated && (
                    <p className="text-xs">
                      Τελευταία ενημέρωση: {new Date(layerState.lastUpdated).toLocaleTimeString('el-GR')}
                    </p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            {/* Info about read-only mode */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className={`${iconSizes.sm} text-muted-foreground`} />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Λειτουργία προβολής μόνο</p>
                  <p className="text-xs">Μπορείτε να αλλάξετε μόνο την ορατότητα</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-3 space-y-3">
        {/* Search and Filters */}
        {(showSearch || showCategoryFilter) && (
          <div className="space-y-2">
            {showSearch && (
              <div className="relative">
                <Search className={`absolute left-2 top-2.5 ${iconSizes.xs} text-muted-foreground`} />
                <Input
                  placeholder="Αναζήτηση layers..."
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
                  <SelectItem value="all">{DXF_LAYER_CATEGORY_LABELS.all}</SelectItem>
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

        {/* Error display */}
        {layerState.error && (
          <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
            {layerState.error}
          </div>
        )}

        {/* Layer Statistics */}
        {showStatistics && (
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Σύνολο: {layerState.layers.length}</span>
            <span>Ορατά: {visibleLayers.length}</span>
            <span>Στοιχεία: {layerState.layers.reduce((acc, l) => acc + l.elements.length, 0)}</span>
          </div>
        )}

        <Separator />

        {/* Loading state */}
        {layerState.isLoading && (
          <div className="text-center py-4 text-muted-foreground">
            <div className="flex items-center justify-center gap-2">
              <AnimatedSpinner size="small" />
              <span className="text-sm">Φόρτωση layers...</span>
            </div>
          </div>
        )}

        {/* Layers List */}
        {!layerState.isLoading && (
          <ScrollArea style={{ maxHeight: layoutUtilities.maxHeight(maxHeight) }}>
            <div className="space-y-2">
              {Object.entries(groupedLayers).map(([category, layers]) => (
                <div key={category}>
                  <h4 className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-2">
                    {category !== 'other' && getCategoryInfo(category) && (
                      <>
                        <div
                          className={`${iconSizes.xs} rounded-full`}
                          style={layoutUtilities.dxf.colors.backgroundColor(getCategoryInfo(category).color)}
                        />
                        {getCategoryInfo(category).name}
                      </>
                    )}
                    {category === 'other' && 'Άλλα'}
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
                <div className="text-center py-8 text-muted-foreground">
                  <Layers className={`${iconSizes.xl} mx-auto mb-2 opacity-50`} />
                  <p className="text-sm">Δεν βρέθηκαν layers</p>
                  {layerState.isConnected ? (
                    <p className="text-xs">Περιμένετε να δημιουργηθούν layers από τους διαχειριστές</p>
                  ) : (
                    <p className="text-xs">Ελέγξτε τη σύνδεσή σας</p>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {/* Last updated info */}
        {layerState.lastUpdated && layerState.isConnected && (
          <div className="text-xs text-muted-foreground text-center pt-2">
            Τελευταία ενημέρωση: {new Date(layerState.lastUpdated).toLocaleTimeString('el-GR')}
          </div>
        )}
      </CardContent>
    </Card>
  );
}