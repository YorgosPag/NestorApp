
'use client';

import React from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Building } from './BuildingsPageContent';
import { BuildingDetailsHeader } from './BuildingDetails/BuildingDetailsHeader';
import { BuildingTabs } from './BuildingDetails/BuildingTabs';
import { EmptyState } from './BuildingDetails/EmptyState';


interface BuildingDetailsProps {
  building: Building | null;
}

export function BuildingDetails({ building }: BuildingDetailsProps) {
    if (!building) {
        return <EmptyState />;
    }

  return (
    <div className="flex-1 flex flex-col bg-card border rounded-lg min-w-0 shadow-sm">
      <BuildingDetailsHeader building={building} />
      <ScrollArea className="flex-1">
        <div className="p-4">
          <BuildingTabs building={building} />
        </div>
      </ScrollArea>
    </div>
  );
}
