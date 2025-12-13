
'use client';

import React from 'react';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Copy, Trash2, Palette } from "lucide-react";
import type { Property } from '@/types/property-viewer';
import type { LayerState } from '../useLayerStates';
import { PROPERTY_STATUS_CONFIG } from "@/lib/property-utils";
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useDynamicBackgroundClass } from '@/components/ui/utils/dynamic-styles';

interface PropertyLayerDetailsProps {
  property: Property;
  layerState: LayerState;
  onOpacityChange: (opacity: number) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function PropertyLayerDetails({
  property,
  layerState,
  onOpacityChange,
  onDuplicate,
  onDelete,
}: PropertyLayerDetailsProps) {
  const statusInfo = PROPERTY_STATUS_CONFIG[property.status] || PROPERTY_STATUS_CONFIG.default;

  // 🎨 ENTERPRISE DYNAMIC STYLING - NO INLINE STYLES (CLAUDE.md compliant)
  const statusColorBgClass = useDynamicBackgroundClass(statusInfo.color.split(' ')[0]);

  return (
    <div className="space-y-3 pt-2 border-t ml-7">
      <div className="flex items-center gap-2">
        <Label className="text-xs">Χρώμα:</Label>
        <div className={`w-6 h-4 rounded border ${statusColorBgClass}`} />
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
          <Palette className="h-3 w-3 mr-1" /> Αλλαγή
        </Button>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Διαφάνεια: {Math.round(layerState.opacity * 100)}%</Label>
        <Slider
          value={[layerState.opacity * 100]}
          onValueChange={([value]) => onOpacityChange(value / 100)}
          max={100}
          step={10}
        />
      </div>
      {(property.price || property.area) && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          {property.price && (
            <div>
              <span className="text-muted-foreground">Τιμή:</span>
              <div className="font-medium text-green-600">{property.price.toLocaleString('el-GR')}€</div>
            </div>
          )}
          {property.area && (
            <div>
              <span className="text-muted-foreground">Εμβαδόν:</span>
              <div className="font-medium">{property.area}τμ</div>
            </div>
          )}
        </div>
      )}
      <div className="text-xs text-muted-foreground">Κόμβοι: {property.vertices.length}</div>
      <div className="flex gap-1 pt-1">
        <Button variant="outline" size="sm" className="h-7 px-2 text-xs flex-1" onClick={onDuplicate}>
          <Copy className="h-3 w-3 mr-1" /> Διπλ.
        </Button>
        <Button variant="outline" size="sm" className={`h-7 w-7 p-0 text-destructive ${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER}`} onClick={onDelete}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
