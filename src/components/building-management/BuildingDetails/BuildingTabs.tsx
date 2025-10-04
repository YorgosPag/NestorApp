'use client';

import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Home, 
  Clock, 
  Map,
  TrendingUp, 
  Archive,
  FileText,
  Settings,
  Camera,
  Video
} from 'lucide-react';
import type { Building } from '../BuildingsPageContent';
import { StorageTab } from '../StorageTab';
import { GeneralTabContent } from '../tabs/GeneralTabContent';
import TimelineTabContent from '../tabs/TimelineTabContent';
import AnalyticsTabContent from '../tabs/AnalyticsTabContent';
import PhotosTabContent from '../tabs/PhotosTabContent';
import VideosTabContent from '../tabs/VideosTabContent';
import PlaceholderTab from '../tabs/PlaceholderTab';
import { FloorplanViewerTab } from '../../projects/tabs/FloorplanViewerTab';
import { useBuildingFloorplans } from '../../../hooks/useBuildingFloorplans';

interface BuildingTabsProps {
    building: Building;
}

export function BuildingTabs({ building }: BuildingTabsProps) {
    // Load building floorplans from Firestore
    const {
        buildingFloorplan,
        storageFloorplan,
        loading: floorplansLoading,
        error: floorplansError,
        refetch: refetchFloorplans
    } = useBuildingFloorplans(building?.id || 0);

    // Debug logging
    console.log('🏗️ BuildingTabs Debug:', {
        buildingId: building?.id,
        hasBuildingFloorplan: !!buildingFloorplan,
        hasStorageFloorplan: !!storageFloorplan,
        floorplansLoading,
        floorplansError,
        buildingFloorplan,
        storageFloorplan
    });

    return (
        <Tabs defaultValue="general" className="h-full">
            <TabsList className="grid w-full grid-cols-10 mb-6">
                <TabsTrigger value="general" className="flex items-center gap-2">
                    <Home className="w-4 h-4" />
                    Γενικά
                </TabsTrigger>
                <TabsTrigger value="floorplan" className="flex items-center gap-2">
                    <Map className="w-4 h-4" />
                    Κάτοψη Κτιρίου
                </TabsTrigger>
                <TabsTrigger value="timeline" className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Timeline
                </TabsTrigger>
                <TabsTrigger value="analytics" className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Analytics
                </TabsTrigger>
                <TabsTrigger value="storage" className="flex items-center gap-2">
                    <Archive className="w-4 h-4" />
                    Αποθήκες
                </TabsTrigger>
                <TabsTrigger value="storage-floorplans" className="flex items-center gap-2">
                    <Map className="w-4 h-4" />
                    Κατόψεις Αποθηκών
                </TabsTrigger>
                <TabsTrigger value="contracts" className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Συμβόλαια
                </TabsTrigger>
                <TabsTrigger value="protocols" className="flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    Πρωτόκολλα
                </TabsTrigger>
                <TabsTrigger value="photos" className="flex items-center gap-2">
                    <Camera className="w-4 h-4" />
                    Φωτογραφίες
                </TabsTrigger>
                <TabsTrigger value="videos" className="flex items-center gap-2">
                    <Video className="w-4 h-4" />
                    Videos
                </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="mt-0">
                <GeneralTabContent building={building} />
            </TabsContent>

            <TabsContent value="floorplan" className="mt-0">
                <FloorplanViewerTab 
                    title="Κάτοψη Κτιρίου"
                    floorplanData={buildingFloorplan?.scene}
                    onAddFloorplan={() => {
                        console.log('Add building floorplan for building:', building.id);
                        // TODO: Implement add building floorplan functionality
                    }}
                    onEditFloorplan={() => {
                        console.log('Edit building floorplan for building:', building.id);
                        // TODO: Implement edit building floorplan functionality
                    }}
                />
            </TabsContent>

            <TabsContent value="timeline" className="mt-0">
                <TimelineTabContent building={building} />
            </TabsContent>

            <TabsContent value="analytics" className="mt-0">
                <AnalyticsTabContent building={building} />
            </TabsContent>

            <TabsContent value="storage" className="mt-0">
                <StorageTab building={building} />
            </TabsContent>

            <TabsContent value="storage-floorplans" className="mt-0">
                <FloorplanViewerTab 
                    title="Κατόψεις Αποθηκών"
                    floorplanData={storageFloorplan?.scene}
                    onAddFloorplan={() => {
                        console.log('Add storage floorplan for building:', building.id);
                        // TODO: Implement add storage floorplan functionality
                    }}
                    onEditFloorplan={() => {
                        console.log('Edit storage floorplan for building:', building.id);
                        // TODO: Implement edit storage floorplan functionality
                    }}
                />
            </TabsContent>

            <TabsContent value="contracts" className="mt-0">
                <PlaceholderTab title="Συμβόλαια Πελατών" icon={FileText} building={building} />
            </TabsContent>

            <TabsContent value="protocols" className="mt-0">
                <PlaceholderTab title="Υ.Δ.Τοιχοποιίας & Πρωτόκολλα" icon={Settings} building={building} />
            </TabsContent>

            <TabsContent value="photos" className="mt-0">
                <PhotosTabContent building={building} />
            </TabsContent>

            <TabsContent value="videos" className="mt-0">
                <VideosTabContent building={building} />
            </TabsContent>
        </Tabs>
    );
}
