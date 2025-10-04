'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Layers, 
  Eye, 
  EyeOff, 
  Lock, 
  Unlock, 
  Search, 
  Plus, 
  Trash2, 
  Copy, 
  Download,
  Upload,
  Settings,
  ChevronDown,
  ChevronRight,
  MoreVertical,
  Grid,
  PenTool,
  Type,
  Ruler
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

// Import types
import type { Property } from '@/types/property-viewer';
import type { LayerState } from './useLayerStates';
import type { Layer, LayerGroup, LayerCategory } from '@/types/layers';
import { LAYER_CATEGORIES } from '@/types/layers';
import { useLayerManagement } from '@/hooks/useLayerManagement';
import { useLayerSync } from '@/lib/layer-sync';

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

// Helper function for safe LAYER_CATEGORIES access
const getCategoryInfo = (category: string) => {
  return LAYER_CATEGORIES[category as keyof typeof LAYER_CATEGORIES] || { color: '#gray', name: category };
};

interface CreateLayerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateLayer: (layerData: {
    name: string;
    description: string;
    category: LayerCategory;
    color: string;
  }) => void;
}

function CreateLayerDialog({ open, onOpenChange, onCreateLayer }: CreateLayerDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<LayerCategory>('annotations');
  const [color, setColor] = useState('#3b82f6');

  const handleSubmit = () => {
    if (!name.trim()) return;
    
    onCreateLayer({
      name: name.trim(),
      description: description.trim(),
      category,
      color
    });
    
    // Reset form
    setName('');
    setDescription('');
    setCategory('annotations');
    setColor('#3b82f6');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Δημιουργία νέου Layer</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="layer-name">Όνομα Layer</Label>
            <Input
              id="layer-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="π.χ. Ηλεκτρολογικά στοιχεία"
            />
          </div>
          
          <div>
            <Label htmlFor="layer-description">Περιγραφή (προαιρετικό)</Label>
            <Textarea
              id="layer-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Περιγραφή του layer..."
              rows={2}
            />
          </div>
          
          <div>
            <Label htmlFor="layer-category">Κατηγορία</Label>
            <Select value={category} onValueChange={(value) => setCategory(value as LayerCategory)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(LAYER_CATEGORIES).map(([key, info]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: info.color }}
                      />
                      {info.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="layer-color">Χρώμα</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                id="layer-color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-10 h-8 rounded border"
              />
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#3b82f6"
                className="flex-1"
              />
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Ακύρωση
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim()}>
            Δημιουργία
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface LayerItemProps {
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

function LayerItem({
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
                className="h-4 w-4 p-0"
                onClick={onToggleExpand}
              >
                {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </Button>
            )}
            
            {categoryInfo && (
              <div 
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: categoryInfo.color }}
                title={categoryInfo.name}
              />
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
                    <p className="text-xs text-muted-foreground truncate">{layer.description}</p>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-1">
              <Badge variant="secondary" className="text-xs">
                {layer.elements.length}
              </Badge>
              {layer.isSystem && (
                <Badge variant="outline" className="text-xs">
                  System
                </Badge>
              )}
            </div>
          </div>

          {/* Right side - Controls */}
          <div className="flex items-center gap-1 ml-2">
            {/* Visibility */}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={onToggleVisibility}
              title={layer.isVisible ? 'Απόκρυψη' : 'Εμφάνιση'}
            >
              {layer.isVisible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            </Button>
            
            {/* Lock */}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={onToggleLock}
              disabled={layer.isSystem}
              title={layer.isLocked ? 'Ξεκλείδωμα' : 'Κλείδωμα'}
            >
              {layer.isLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
            </Button>
            
            {/* More options */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  <MoreVertical className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {!layer.isSystem && (
                  <>
                    <DropdownMenuItem onClick={() => setIsRenaming(true)}>
                      <Type className="h-3 w-3 mr-2" />
                      Μετονομασία
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onDuplicate}>
                      <Copy className="h-3 w-3 mr-2" />
                      Αντιγραφή
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem>
                  <Download className="h-3 w-3 mr-2" />
                  Export Layer
                </DropdownMenuItem>
                {!layer.isSystem && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onDelete} className="text-destructive">
                      <Trash2 className="h-3 w-3 mr-2" />
                      Διαγραφή
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Opacity Slider */}
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-16">Διαφάνεια:</span>
          <Slider
            value={[layer.opacity * 100]}
            onValueChange={([value]) => onOpacityChange(value / 100)}
            max={100}
            step={5}
            className="flex-1"
            disabled={layer.isLocked}
          />
          <span className="text-xs text-muted-foreground w-8">
            {Math.round(layer.opacity * 100)}%
          </span>
        </div>

        {/* Expanded content - Elements preview */}
        {isExpanded && layer.elements.length > 0 && (
          <Collapsible open={isExpanded}>
            <CollapsibleContent className="mt-3">
              <div className="space-y-1 pl-4 border-l-2 border-muted">
                {layer.elements.slice(0, 5).map((element) => (
                  <div key={element.id} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-2">
                      {element.type === 'property' && <Grid className="h-3 w-3" />}
                      {element.type === 'annotation' && <Type className="h-3 w-3" />}
                      {element.type === 'measurement' && <Ruler className="h-3 w-3" />}
                      {element.type === 'line' && <PenTool className="h-3 w-3" />}
                      {element.type} - {element.id.substring(0, 8)}...
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0"
                      onClick={() => {/* Toggle element visibility */}}
                    >
                      {element.isVisible ? <Eye className="h-2 w-2" /> : <EyeOff className="h-2 w-2" />}
                    </Button>
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

export function AdminLayerManager({
  floorId,
  buildingId,
  userId,
  properties = [],
  selectedPropertyIds = [],
  layerStates = {},
  onPropertySelect,
  onPropertyUpdate,
  className,
  isCollapsed = false,
  onToggleCollapse,
  enableRealTimeSync = true,
  showSyncStatus = true
}: AdminLayerManagerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedLayers, setExpandedLayers] = useState<Set<string>>(new Set());
  const [showSystemLayers, setShowSystemLayers] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  
  // Real-time sync with Properties (θυγατρικό)
  const { syncState, syncManager } = useLayerSync(
    floorId, 
    buildingId, 
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
      console.error('Error creating layer:', error);
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
      console.error('Error renaming layer:', error);
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
        <Layers className="h-4 w-4" />
      </Button>
    );
  }

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="flex items-center justify-center">
            <span className="text-sm text-muted-foreground">Φόρτωση layers...</span>
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
              <Layers className="h-4 w-4" />
              Layer Manager
              {showSyncStatus && (
                <div className="flex items-center gap-1">
                  {syncState.isConnected ? (
                    <div className="w-2 h-2 bg-green-500 rounded-full" title="Συνδεδεμένο - Real-time sync ενεργό" />
                  ) : (
                    <div className="w-2 h-2 bg-red-500 rounded-full" title="Αποσυνδεδεμένο" />
                  )}
                  {syncState.pendingOperations > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {syncState.pendingOperations}
                    </Badge>
                  )}
                </div>
              )}
              {onToggleCollapse && (
                <Button variant="ghost" size="sm" onClick={onToggleCollapse} className="h-4 w-4 p-0 ml-1">
                  <ChevronDown className="h-3 w-3" />
                </Button>
              )}
            </CardTitle>
            
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-3 w-3" />
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Settings className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    <Download className="h-3 w-3 mr-2" />
                    Export όλα τα Layers
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Upload className="h-3 w-3 mr-2" />
                    Import Layers
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShowSystemLayers(!showSystemLayers)}>
                    {showSystemLayers ? 'Απόκρυψη' : 'Εμφάνιση'} System Layers
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
              <Search className="absolute left-2 top-2.5 h-3 w-3 text-muted-foreground" />
              <Input
                placeholder="Αναζήτηση layers..."
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
                <SelectItem value="all">Όλες οι κατηγορίες</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: getCategoryInfo(category).color }}
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
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Σύνολο: {state.layers.length}</span>
            <span>Ορατά: {state.layers.filter(l => l.isVisible).length}</span>
            <span>Στοιχεία: {state.layers.reduce((acc, l) => acc + l.elements.length, 0)}</span>
          </div>
          
          {/* Sync Status Info */}
          {showSyncStatus && enableRealTimeSync && (
            <div className="text-xs text-muted-foreground">
              <div className="flex justify-between items-center">
                <span>Sync Status:</span>
                <span className={syncState.isConnected ? 'text-green-600' : 'text-red-600'}>
                  {syncState.isConnected ? 'Συνδεδεμένο' : 'Αποσυνδεδεμένο'}
                </span>
              </div>
              {syncState.lastSyncTime && (
                <div className="flex justify-between items-center">
                  <span>Τελευταία Sync:</span>
                  <span>{new Date(syncState.lastSyncTime).toLocaleTimeString('el-GR')}</span>
                </div>
              )}
              {syncState.errors.length > 0 && (
                <div className="text-destructive text-xs mt-1">
                  Σφάλματα: {syncState.errors.length}
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
                  <h4 className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-2">
                    {category !== 'other' && getCategoryInfo(category) && (
                      <>
                        <div 
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: getCategoryInfo(category).color }}
                        />
                        {getCategoryInfo(category).name}
                      </>
                    )}
                    {category === 'other' && 'Άλλα'}
                    <Badge variant="outline" className="text-xs">
                      {layers.length}
                    </Badge>
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
                <div className="text-center py-8 text-muted-foreground">
                  <Layers className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Δεν βρέθηκαν layers</p>
                  <p className="text-xs">Δημιουργήστε ένα νέο layer ή αλλάξτε τα φίλτρα</p>
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