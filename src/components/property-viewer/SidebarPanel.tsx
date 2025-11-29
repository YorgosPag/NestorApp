"use client";

import React from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CommonBadge } from '@/core/badges';
import type { Property } from '@/types/property-viewer';
import type { Connection, PropertyGroup } from '@/types/connections';

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
  layerStates = {},
  setLayerStates,
  onPolygonSelect,
  onDuplicate,
  onDelete,
  connections = [],
  setConnections,
  groups = [],
  setGroups,
  isConnecting = false,
  setIsConnecting,
}: SidebarPanelProps) {
  
  const safeFloorData = floorData || { id: '', name: '', level: 0, buildingId: '', properties: [] };
  const safeSelectedPolygonIds = Array.isArray(selectedPolygonIds) ? selectedPolygonIds : [];
  const selectedProperties = safeFloorData.properties.filter(p => safeSelectedPolygonIds.includes(p.id));

  return (
    <div className="w-80 border-l bg-card flex flex-col">
      <Card className="border-none shadow-none">
        <CardHeader className="pb-2">
          <h3 className="text-lg font-semibold">Επεξεργασία Κόμβων</h3>
          <p className="text-sm text-muted-foreground">
            {safeSelectedPolygonIds.length} επιλεγμένα ακίνητα
          </p>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {selectedProperties.length > 0 ? (
            <div className="space-y-2">
              {selectedProperties.map((property) => (
                <div key={property.id} className="p-3 border rounded-lg">
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
                      Αντιγραφή
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={onDelete}
                    >
                      Διαγραφή
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              <p>Επιλέξτε ακίνητα για επεξεργασία κόμβων</p>
            </div>
          )}

          {/* Layer Controls */}
          <div className="space-y-2">
            <h4 className="font-medium">Επίπεδα</h4>
            <div className="text-sm text-muted-foreground">
              Έλεγχος ορατότητας επιπέδων
            </div>
          </div>

          {/* Connection Controls */}
          {isConnecting && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <p className="text-sm">Επιλέξτε δύο ακίνητα για να τα συνδέσετε</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsConnecting(false)}
                className="mt-2"
              >
                Ακύρωση
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}