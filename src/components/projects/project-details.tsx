'use client';

import React from 'react';
import type { Project } from '@/types/project';
import { ProjectDetailsHeader } from './ProjectDetailsHeader';
import { Briefcase } from 'lucide-react';
import { useProjectFloorplans } from '../../hooks/useProjectFloorplans';
import { GenericProjectTabsRenderer } from '@/components/generic';
import { getSortedProjectTabs } from '@/config/project-tabs-config';
import { DetailsContainer } from '@/core/containers';

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


    // Get project tabs from centralized config
    const projectTabs = getSortedProjectTabs();

    return (
        <DetailsContainer
            selectedItem={project}
            header={<ProjectDetailsHeader project={project!} />}
            tabsRenderer={
                <GenericProjectTabsRenderer
                    tabs={projectTabs}
                    project={project!}
                    defaultTab="general"
                    additionalData={{
                        projectFloorplan,
                        parkingFloorplan,
                        floorplansLoading,
                        floorplansError,
                        refetchFloorplans
                    }}
                    globalProps={{
                        projectId: project!.id
                    }}
                />
            }
            emptyStateProps={{
                icon: Briefcase,
                title: "Επιλέξτε ένα έργο",
                description: "Επιλέξτε ένα έργο από τη λίστα για να δείτε τις λεπτομέρειές του."
            }}
        />
    );
}
