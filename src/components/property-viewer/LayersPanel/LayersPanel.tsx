'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Eye,
  EyeOff,
  Plus,
  Edit,
  Trash2,
  Move,
  Copy,
  Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useDynamicBackgroundClass } from '@/components/ui/utils/dynamic-styles';

interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  color: string;
  type: 'properties' | 'measurements' | 'annotations' | 'pdf' | 'grid';
}

interface LayersPanelProps {
  layers?: Layer[];
  onLayersChange?: (layers: Layer[]) => void;
  className?: string;
}

const DEFAULT_LAYERS: Layer[] = [
  { id: 'pdf', name: 'PDF Background', visible: true, locked: false, opacity: 100, color: '#000000', type: 'pdf' },
  { id: 'grid', name: 'Grid', visible: true, locked: false, opacity: 50, color: '#cccccc', type: 'grid' },
  { id: 'properties', name: 'Properties', visible: true, locked: false, opacity: 100, color: '#3b82f6', type: 'properties' },
  { id: 'measurements', name: 'Measurements', visible: true, locked: false, opacity: 100, color: '#ef4444', type: 'measurements' },
  { id: 'annotations', name: 'Annotations', visible: true, locked: false, opacity: 100, color: '#10b981', type: 'annotations' }
];

export function LayersPanel({
  layers = DEFAULT_LAYERS,
  onLayersChange,
  className
}: LayersPanelProps) {
  const iconSizes = useIconSizes();
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);

  const updateLayer = (layerId: string, updates: Partial<Layer>) => {
    const newLayers = layers.map(layer =>
      layer.id === layerId ? { ...layer, ...updates } : layer
    );
    onLayersChange?.(newLayers);
  };

  const toggleVisibility = (layerId: string) => {
    const layer = layers.find(l => l.id === layerId);
    if (layer) {
      updateLayer(layerId, { visible: !layer.visible });
    }
  };

  const LayerItem = ({ layer }: { layer: Layer }) => {
    // 🎨 ENTERPRISE DYNAMIC STYLING - NO INLINE STYLES (CLAUDE.md compliant)
    const layerBgClass = useDynamicBackgroundClass(layer.color, layer.opacity / 100);

    return (
      <div
        className={cn(
          `flex items-center gap-2 p-2 rounded cursor-pointer ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`,
          selectedLayerId === layer.id && "bg-blue-50 border border-blue-200"
        )}
        onClick={() => setSelectedLayerId(layer.id)}
      >
      {/* Visibility Toggle */}
      <Button
        variant="ghost"
        size="sm"
        className={`${iconSizes.lg} p-0`}
        onClick={(e) => {
          e.stopPropagation();
          toggleVisibility(layer.id);
        }}
      >
        {layer.visible ? (
          <Eye className={`${iconSizes.sm} text-green-600`} />
        ) : (
          <EyeOff className={`${iconSizes.sm} text-gray-400`} />
        )}
      </Button>

      {/* Color Indicator */}
      <div
        className={`${iconSizes.sm} rounded border border-gray-300 ${layerBgClass}`}
      />

      {/* Layer Name */}
      <span className={cn(
        "flex-1 text-sm",
        !layer.visible && "text-gray-400"
      )}>
        {layer.name}
      </span>

      {/* Layer Type Icon */}
      <span className="text-xs text-gray-500 uppercase">
        {layer.type}
      </span>
    </div>
    );
  };

  return (
    <div className={cn("bg-white border border-gray-200 rounded-lg p-3", className)}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium">Layers</h3>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className={`${iconSizes.lg} p-0`}>
            <Plus className={iconSizes.sm} />
          </Button>
          <Button variant="ghost" size="sm" className={`${iconSizes.lg} p-0`}>
            <Settings className={iconSizes.sm} />
          </Button>
        </div>
      </div>

      <div className="space-y-1">
        {layers.map(layer => (
          <LayerItem key={layer.id} layer={layer} />
        ))}
      </div>

      {selectedLayerId && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="text-xs text-gray-600 mb-2">Layer Controls</div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className={`${iconSizes.lg} text-xs`}>
              <Edit className={`${iconSizes.xs} mr-1`} />
              Edit
            </Button>
            <Button variant="outline" size="sm" className={`${iconSizes.lg} text-xs`}>
              <Copy className={`${iconSizes.xs} mr-1`} />
              Copy
            </Button>
            <Button variant="outline" size="sm" className={`${iconSizes.lg} text-xs`}>
              <Move className={`${iconSizes.xs} mr-1`} />
              Move
            </Button>
            <Button variant="outline" size="sm" className="h-6 text-xs text-red-600">
              <Trash2 className={`${iconSizes.xs} mr-1`} />
              Delete
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
