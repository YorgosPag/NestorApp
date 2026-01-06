'use client';

import React, { useState, useCallback } from 'react';
import type { Project } from '@/types/project';
import { ProjectDetailsHeader } from './ProjectDetailsHeader';
import { Briefcase } from 'lucide-react';
import { useProjectFloorplans } from '../../hooks/useProjectFloorplans';
import { UniversalTabsRenderer, PROJECT_COMPONENT_MAPPING, convertToUniversalConfig } from '@/components/generic';
import { getSortedProjectTabs } from '@/config/project-tabs-config';
import { DetailsContainer } from '@/core/containers';
// ✅ ENTERPRISE: DXF Import integration
import DxfImportModal from '@/subapps/dxf-viewer/components/DxfImportModal';
import { dxfImportService } from '@/subapps/dxf-viewer/io/dxf-import';
import { FloorplanService, type FloorplanData } from '@/services/floorplans/FloorplanService';

/** Type-safe floorplan types */
type FloorplanType = 'project' | 'parking';

interface ProjectDetailsProps {
    project: Project & { companyName: string };
}

export function ProjectDetails({ project }: ProjectDetailsProps) {
    // ✅ ENTERPRISE: Modal state for DXF import
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importFloorplanType, setImportFloorplanType] = useState<FloorplanType>('project');
    const [isImporting, setIsImporting] = useState(false);

    // Load floorplan data from Firestore
    const {
        projectFloorplan,
        parkingFloorplan,
        loading: floorplansLoading,
        error: floorplansError,
        refetch: refetchFloorplans
    } = useProjectFloorplans(project?.id || 0);

    /**
     * ✅ ENTERPRISE: Handle DXF file import
     * Parses DXF file and saves to Firestore
     */
    const handleDxfImport = useCallback(async (file: File, encoding: string): Promise<void> => {
        if (!project?.id) {
            console.error('❌ Cannot import floorplan: No project ID');
            return;
        }

        setIsImporting(true);

        try {
            console.log('📁 Starting DXF import for project:', project.id, 'type:', importFloorplanType);

            // Parse DXF file using centralized service
            const result = await dxfImportService.importDxfFile(file, encoding);

            if (!result.success || !result.scene) {
                console.error('❌ DXF parsing failed:', result.error);
                throw new Error(result.error || 'DXF parsing failed');
            }

            console.log('✅ DXF parsed successfully:', {
                entities: result.scene.entities.length,
                layers: Object.keys(result.scene.layers).length
            });

            // Prepare floorplan data for Firestore
            const floorplanData: FloorplanData = {
                projectId: String(project.id),
                type: importFloorplanType,
                scene: result.scene,
                fileName: file.name,
                timestamp: Date.now()
            };

            // Save to Firestore using centralized service
            const saveSuccess = await FloorplanService.saveFloorplan(
                String(project.id),
                importFloorplanType,
                floorplanData
            );

            if (!saveSuccess) {
                throw new Error('Failed to save floorplan to Firestore');
            }

            console.log('✅ Floorplan saved successfully to Firestore');

            // Refresh floorplan data to show the new floorplan
            await refetchFloorplans();

            console.log('✅ Floorplan data refreshed');

        } catch (error) {
            console.error('❌ DXF import error:', error);
            throw error;
        } finally {
            setIsImporting(false);
        }
    }, [project?.id, importFloorplanType, refetchFloorplans]);

    /**
     * ✅ ENTERPRISE: Open import modal for project floorplan
     */
    const handleAddProjectFloorplan = useCallback(() => {
        setImportFloorplanType('project');
        setIsImportModalOpen(true);
    }, []);

    /**
     * ✅ ENTERPRISE: Open import modal for parking floorplan
     */
    const handleAddParkingFloorplan = useCallback(() => {
        setImportFloorplanType('parking');
        setIsImportModalOpen(true);
    }, []);

    /**
     * ✅ ENTERPRISE: Close import modal
     */
    const handleCloseImportModal = useCallback(() => {
        setIsImportModalOpen(false);
    }, []);


    // Get project tabs from centralized config
    const projectTabs = getSortedProjectTabs();

    return (
        <>
            <DetailsContainer
                selectedItem={project}
                header={<ProjectDetailsHeader project={project!} />}
                tabsRenderer={
                    <UniversalTabsRenderer
                        tabs={projectTabs.map(convertToUniversalConfig)}
                        data={project!}
                        componentMapping={PROJECT_COMPONENT_MAPPING}
                        defaultTab="general"
                        theme="default"
                        additionalData={{
                            projectFloorplan,
                            parkingFloorplan,
                            floorplansLoading,
                            floorplansError,
                            refetchFloorplans,
                            // ✅ ENTERPRISE: Floorplan action callbacks
                            onAddProjectFloorplan: handleAddProjectFloorplan,
                            onAddParkingFloorplan: handleAddParkingFloorplan,
                            onEditProjectFloorplan: handleAddProjectFloorplan, // Same modal, replaces existing
                            onEditParkingFloorplan: handleAddParkingFloorplan
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

            {/* ✅ ENTERPRISE: DXF Import Modal */}
            <DxfImportModal
                isOpen={isImportModalOpen}
                onClose={handleCloseImportModal}
                onImport={handleDxfImport}
            />
        </>
    );
}
