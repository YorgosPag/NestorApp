'use client';

import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GeneralProjectTab } from './general-project-tab';
import { BuildingDataTab } from './BuildingDataTab';
import { ParkingTab } from './parking/ParkingTab';
import { ContributorsTab } from './contributors-tab';
import { DocumentsProjectTab } from './documents-project-tab';
import { IkaTab } from './ika-tab';
import { PhotosTab } from './PhotosTab';
import { VideosTab } from './VideosTab';
import type { Project } from '@/types/project';
import { ProjectDetailsHeader } from './ProjectDetailsHeader';
import { ProjectTimelineTab } from './ProjectTimelineTab';
import { ProjectCustomersTab } from './customers-tab';
import { Briefcase, Users, GitMerge, Map } from 'lucide-react'; // Added Map icon
import { ScrollArea } from '@/components/ui/scroll-area';
import { ProjectStructureTab } from './tabs/ProjectStructureTab';
import PlaceholderTab from '../building-management/tabs/PlaceholderTab'; // Added placeholder import
import { FloorplanViewerTab } from './tabs/FloorplanViewerTab';
import { useProjectFloorplans } from '../../hooks/useProjectFloorplans';

interface ProjectDetailsProps {
    project: Project & { companyName: string };
}

export function ProjectDetails({ project }: ProjectDetailsProps) {
    // Load floorplan data from Firestore
    const {
        projectFloorplan,
        parkingFloorplan,
        loading: floorplansLoading,
        error: floorplansError,
        refetch: refetchFloorplans
    } = useProjectFloorplans(project?.id || 0);

    // Debug logging
    console.log('🏗️ ProjectDetails Debug:', {
        projectId: project?.id,
        hasProjectFloorplan: !!projectFloorplan,
        hasParkingFloorplan: !!parkingFloorplan,
        floorplansLoading,
        floorplansError,
        projectFloorplan,
        parkingFloorplan
    });

    if (!project) return (
        <div className="flex-1 p-4 flex items-center justify-center bg-card border rounded-lg">
            <div className="text-center text-muted-foreground">
                <Briefcase className="w-12 h-12 mx-auto mb-4" />
                <h2 className="text-xl font-semibold">Επιλέξτε ένα έργο</h2>
                <p>Επιλέξτε ένα έργο από τη λίστα για να δείτε τις λεπτομέρειές του.</p>
            </div>
        </div>
    );
    return (
        <div className="flex-1 flex flex-col bg-card border rounded-lg min-w-0 shadow-sm overflow-hidden">
            <ProjectDetailsHeader project={project} />
            <ScrollArea className="flex-1">
                <div className="p-4">
                    <Tabs defaultValue="general" className="w-full">
                        <TabsList className="shrink-0 flex-wrap h-auto justify-start">
                            <TabsTrigger value="general">Γενικά Έργου</TabsTrigger>
                            <TabsTrigger value="floorplan">Κάτοψη Έργου</TabsTrigger>
                            <TabsTrigger value="parking-floorplan">Κάτοψη Θ.Σ.</TabsTrigger>
                            <TabsTrigger value="structure">Δομή Έργου</TabsTrigger>
                            <TabsTrigger value="timeline">Timeline</TabsTrigger>
                            <TabsTrigger value="customers">Πελάτες</TabsTrigger>
                            <TabsTrigger value="building-data">Στοιχεία Δόμησης</TabsTrigger>
                            <TabsTrigger value="parking">Θέσεις Στάθμευσης</TabsTrigger>
                            <TabsTrigger value="contributors">Συντελεστές</TabsTrigger>
                            <TabsTrigger value="documents">Έγγραφα Έργου</TabsTrigger>
                            <TabsTrigger value="ika">IKA</TabsTrigger>
                            <TabsTrigger value="photos">Φωτογραφίες</TabsTrigger>
                            <TabsTrigger value="videos">Βίντεο</TabsTrigger>
                        </TabsList>
                        <TabsContent value="general" className="flex-grow overflow-auto mt-4">
                            <GeneralProjectTab project={project} />
                        </TabsContent>
                        <TabsContent value="floorplan" className="flex-grow overflow-auto mt-4">
                            <FloorplanViewerTab 
                                title="Κάτοψη Έργου"
                                floorplanData={projectFloorplan?.scene}
                                onAddFloorplan={() => {
                                    console.log('Add project floorplan for project:', project.id);
                                    // TODO: Implement add floorplan functionality
                                }}
                                onEditFloorplan={() => {
                                    console.log('Edit project floorplan for project:', project.id);
                                    // TODO: Implement edit floorplan functionality
                                }}
                            />
                        </TabsContent>
                        <TabsContent value="parking-floorplan" className="flex-grow overflow-auto mt-4">
                            <FloorplanViewerTab 
                                title="Κάτοψη Θέσεων Στάθμευσης"
                                floorplanData={parkingFloorplan?.scene}
                                onAddFloorplan={() => {
                                    console.log('Add parking floorplan for project:', project.id);
                                    // TODO: Implement add parking floorplan functionality
                                }}
                                onEditFloorplan={() => {
                                    console.log('Edit parking floorplan for project:', project.id);
                                    // TODO: Implement edit parking floorplan functionality
                                }}
                            />
                        </TabsContent>
                         <TabsContent value="structure" className="flex-grow overflow-auto mt-4">
                            <ProjectStructureTab projectId={project.id} />
                        </TabsContent>
                         <TabsContent value="timeline" className="flex-grow overflow-auto mt-4">
                            <ProjectTimelineTab project={project} />
                        </TabsContent>
                        <TabsContent value="customers" className="flex-grow overflow-auto mt-4">
                            <ProjectCustomersTab projectId={project.id} />
                        </TabsContent>
                        <TabsContent value="building-data" className="flex-grow overflow-auto mt-4">
                            <BuildingDataTab />
                        </TabsContent>
                        <TabsContent value="parking" className="flex-grow overflow-auto mt-4">
                             <ParkingTab />
                        </TabsContent>
                        <TabsContent value="contributors" className="flex-grow overflow-auto mt-4">
                            <ContributorsTab />
                        </TabsContent>
                        <TabsContent value="documents" className="flex-grow overflow-auto mt-4">
                            <DocumentsProjectTab />
                        </TabsContent>
                        <TabsContent value="ika" className="flex-grow overflow-auto mt-4">
                            <IkaTab />
                        </TabsContent>
                        <TabsContent value="photos" className="flex-grow overflow-auto mt-4">
                            <PhotosTab />
                        </TabsContent>
                        <TabsContent value="videos" className="flex-grow overflow-auto mt-4">
                            <VideosTab />
                        </TabsContent>
                    </Tabs>
                </div>
            </ScrollArea>
        </div>
    );
}
