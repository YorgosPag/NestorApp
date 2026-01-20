
'use client';

import { CommonBadge } from "@/core/badges";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Property } from '@/types/property-viewer';
import { DROPDOWN_PLACEHOLDERS } from '@/constants/property-statuses-enterprise';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

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
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('properties');

  if (!currentFloor) {
    return (
      <div className="flex items-center gap-4">
        <Select onValueChange={onSelectFloor}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder={DROPDOWN_PLACEHOLDERS.SELECT_FLOOR} />
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
        
        <CommonBadge
          status="property"
          customLabel={t('floorSelector.propertiesCount', { count: currentFloor.properties.length })}
          variant="outline"
          className="text-xs"
        />
    </div>
  );
}
