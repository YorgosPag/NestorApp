"use client";

import React from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CommonBadge } from '@/core/badges';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { Property } from '@/types/property-viewer';
import type { Connection, PropertyGroup } from '@/types/connections';
import '@/lib/design-system';

export interface LayerState {
  visible: boolean;
  locked: boolean;
  opacity: number;
}

interface FloorData {
  id: string;
  name: string;
  level: number;
  buildingId: string;
  floorPlanUrl?: string;
  properties: Property[];
}

interface SidebarPanelProps {
  floorData: FloorData;
  selectedPolygonIds: string[];
  layerStates: Record<string, LayerState>;
  setLayerStates: React.Dispatch<React.SetStateAction<Record<string, LayerState>>>;
  onPolygonSelect: (propertyId: string, isShiftClick: boolean) => void;
  onDuplicate: (propertyId: string) => void;
  onDelete: () => void;
  connections: Connection[];
  setConnections: React.Dispatch<React.SetStateAction<Connection[]>>;
  groups: PropertyGroup[];
  setGroups: React.Dispatch<React.SetStateAction<PropertyGroup[]>>;
  isConnecting: boolean;
  setIsConnecting: React.Dispatch<React.SetStateAction<boolean>>;
}

export function SidebarPanel({
  floorData,
  selectedPolygonIds = [],
  layerStates: _layerStates = {},
  setLayerStates: _setLayerStates,
  onPolygonSelect: _onPolygonSelect,
  onDuplicate,
  onDelete,
  connections: _connections = [],
  setConnections: _setConnections,
  groups: _groups = [],
  setGroups: _setGroups,
  isConnecting = false,
  setIsConnecting,
}: SidebarPanelProps) {
  const { radius } = useBorderTokens();
  const colors = useSemanticColors();
  // 🏢 ENTERPRISE: i18n support
  const { t } = useTranslation('common');

  const safeFloorData = floorData || { id: '', name: '', level: 0, buildingId: '', properties: [] };
  const safeSelectedPolygonIds = Array.isArray(selectedPolygonIds) ? selectedPolygonIds : [];
  const selectedProperties = safeFloorData.properties.filter(p => safeSelectedPolygonIds.includes(p.id));

  return (
    <div className="w-80 border-l bg-card flex flex-col">
      <Card className="border-none shadow-none">
        <CardHeader className="pb-2">
          <h3 className="text-lg font-semibold">{t('propertyEditor.nodeEditing')}</h3>
          <p className={cn("text-sm", colors.text.muted)}>
            {t('propertyEditor.selectedProperties', { count: safeSelectedPolygonIds.length })}
          </p>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {selectedProperties.length > 0 ? (
            <div className="space-y-2">
              {selectedProperties.map((property) => (
                <div key={property.id} className={`p-3 ${useBorderTokens().quick.card}`}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">{property.name}</h4>
                    <CommonBadge
                      status="property"
                      customLabel={property.type}
                      variant="secondary"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onDuplicate(property.id)}
                    >
                      {t('propertyEditor.copy')}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={onDelete}
                    >
                      {t('buttons.delete')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={cn("text-center py-8", colors.text.muted)}>
              <p>{t('propertyEditor.selectPropertiesToEdit')}</p>
            </div>
          )}

          {/* Layer Controls */}
          <div className="space-y-2">
            <h4 className="font-medium">{t('propertyEditor.layers')}</h4>
            <div className={cn("text-sm", colors.text.muted)}>
              {t('propertyEditor.layerVisibilityControl')}
            </div>
          </div>

          {/* Connection Controls */}
          {isConnecting && (
            <div className={`p-3 bg-blue-50 dark:bg-blue-950 ${radius.lg}`}>
              <p className="text-sm">{t('propertyEditor.selectTwoToConnect')}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsConnecting(false)}
                className="mt-2"
              >
                {t('buttons.cancel')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}