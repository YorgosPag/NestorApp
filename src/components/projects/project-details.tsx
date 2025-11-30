'use client';

import React from 'react';
import type { Project } from '@/types/project';
import { ProjectDetailsHeader } from './ProjectDetailsHeader';
import { Briefcase } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useProjectFloorplans } from '../../hooks/useProjectFloorplans';
import { GenericProjectTabsRenderer } from '@/components/generic';
import { getSortedProjectTabs } from '@/config/project-tabs-config';

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


    if (!project) return (
        <div className="flex-1 p-4 flex items-center justify-center bg-card border rounded-lg">
            <div className="text-center text-muted-foreground">
                <Briefcase className="w-12 h-12 mx-auto mb-4" />
                <h2 className="text-xl font-semibold">Επιλέξτε ένα έργο</h2>
                <p>Επιλέξτε ένα έργο από τη λίστα για να δείτε τις λεπτομέρειές του.</p>
            </div>
        </div>
    );
    // Get project tabs from centralized config
    const projectTabs = getSortedProjectTabs();

    return (
        <div className="flex-1 flex flex-col bg-card border rounded-lg min-w-0 shadow-sm">
            <ProjectDetailsHeader project={project} />
            <ScrollArea className="flex-1">
                <div className="p-4 overflow-x-auto">
                    <GenericProjectTabsRenderer
                        tabs={projectTabs}
                        project={project}
                        defaultTab="general"
                        additionalData={{
                            projectFloorplan,
                            parkingFloorplan,
                            floorplansLoading,
                            floorplansError,
                            refetchFloorplans
                        }}
                        globalProps={{
                            projectId: project.id
                        }}
                    />
                </div>
            </ScrollArea>
        </div>
    );
}
