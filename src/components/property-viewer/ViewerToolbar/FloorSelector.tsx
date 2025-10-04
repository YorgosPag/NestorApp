
'use client';

import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Property } from '@/types/property-viewer';

interface FloorData {
    id: string;
    name: string;
    level: number;
    buildingId: string;
    floorPlanUrl?: string;
    properties: Property[];
}

interface FloorSelectorProps {
  currentFloor: FloorData | null;
  floors: FloorData[];
  onSelectFloor: (floorId: string | null) => void;
}

export function FloorSelector({ currentFloor, floors, onSelectFloor }: FloorSelectorProps) {
  if (!currentFloor) {
    return (
      <div className="flex items-center gap-4">
        <Select onValueChange={onSelectFloor}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Επιλογή ορόφου..." />
          </SelectTrigger>
          <SelectContent>
            {(floors || []).map((floor) => (
              <SelectItem key={floor.id} value={floor.id}>
                {floor.name} ({floor.level >= 0 ? '+' : ''}{floor.level})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
        <Select 
        value={currentFloor.id} 
        onValueChange={onSelectFloor}
        >
        <SelectTrigger className="w-48">
            <SelectValue />
        </SelectTrigger>
        <SelectContent>
            {(floors || []).map((floor) => (
            <SelectItem key={floor.id} value={floor.id}>
                {floor.name} ({floor.level >= 0 ? '+' : ''}{floor.level})
            </SelectItem>
            ))}
        </SelectContent>
        </Select>
        
        <Badge variant="outline" className="text-xs">
        {currentFloor.properties.length} ακίνητα
        </Badge>
    </div>
  );
}
