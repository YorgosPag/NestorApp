'use client';

/**
 * 🅿️ ENTERPRISE PARKING TABS COMPONENT
 *
 * Tabs για τις λεπτομέρειες θέσης στάθμευσης
 * Simplified version - can be migrated to unified-tabs-factory later
 */

import React from 'react';
import type { ParkingSpot } from '@/hooks/useFirestoreParkingSpots';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Info, BarChart3, FileText, Camera, History } from 'lucide-react';
import { ParkingGeneralTab } from './tabs/ParkingGeneralTab';

interface ParkingTabsProps {
  parking: ParkingSpot;
}

interface TabConfig {
  id: string;
  value: string;
  label: string;
  icon: React.ReactNode;
  enabled: boolean;
}

const PARKING_TABS: TabConfig[] = [
  {
    id: 'general',
    value: 'general',
    label: 'Γενικά',
    icon: <Info className="h-4 w-4" />,
    enabled: true
  },
  {
    id: 'statistics',
    value: 'statistics',
    label: 'Στατιστικά',
    icon: <BarChart3 className="h-4 w-4" />,
    enabled: true
  },
  {
    id: 'documents',
    value: 'documents',
    label: 'Έγγραφα',
    icon: <FileText className="h-4 w-4" />,
    enabled: true
  },
  {
    id: 'photos',
    value: 'photos',
    label: 'Φωτογραφίες',
    icon: <Camera className="h-4 w-4" />,
    enabled: true
  },
  {
    id: 'history',
    value: 'history',
    label: 'Ιστορικό',
    icon: <History className="h-4 w-4" />,
    enabled: true
  }
];

export function ParkingTabs({ parking }: ParkingTabsProps) {
  const enabledTabs = PARKING_TABS.filter(tab => tab.enabled);

  return (
    <Tabs defaultValue="general" className="w-full">
      <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${enabledTabs.length}, 1fr)` }}>
        {enabledTabs.map(tab => (
          <TabsTrigger key={tab.id} value={tab.value} className="flex items-center gap-2">
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="general" className="mt-4">
        <ParkingGeneralTab parking={parking} />
      </TabsContent>

      <TabsContent value="statistics" className="mt-4">
        <div className="p-4 text-center text-muted-foreground">
          <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>Στατιστικά θέσης στάθμευσης</p>
          <p className="text-sm">Coming soon...</p>
        </div>
      </TabsContent>

      <TabsContent value="documents" className="mt-4">
        <div className="p-4 text-center text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>Έγγραφα θέσης στάθμευσης</p>
          <p className="text-sm">Coming soon...</p>
        </div>
      </TabsContent>

      <TabsContent value="photos" className="mt-4">
        <div className="p-4 text-center text-muted-foreground">
          <Camera className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>Φωτογραφίες θέσης στάθμευσης</p>
          <p className="text-sm">Coming soon...</p>
        </div>
      </TabsContent>

      <TabsContent value="history" className="mt-4">
        <div className="p-4 text-center text-muted-foreground">
          <History className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>Ιστορικό θέσης στάθμευσης</p>
          <p className="text-sm">Coming soon...</p>
        </div>
      </TabsContent>
    </Tabs>
  );
}
