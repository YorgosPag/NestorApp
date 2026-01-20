'use client';

import React, { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type { Project } from '@/types/project';
import { ProjectDetailsHeader } from './ProjectDetailsHeader';
import { Briefcase } from 'lucide-react';
import { useProjectFloorplans } from '../../hooks/useProjectFloorplans';
// 🏢 ENTERPRISE: Direct imports to avoid barrel (reduces module graph)
// UniversalTabsRenderer from generic (renderer only, no mappings)
import { UniversalTabsRenderer, convertToUniversalConfig } from '@/components/generic/UniversalTabsRenderer';
// PROJECT_COMPONENT_MAPPING from domain-scoped file (not master barrel)
import { PROJECT_COMPONENT_MAPPING } from '@/components/generic/mappings/projectMappings';
import { getSortedProjectTabs } from '@/config/project-tabs-config';
import { DetailsContainer } from '@/core/containers';
import { FloorplanService, type FloorplanData } from '@/services/floorplans/FloorplanService';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

// 🏢 ENTERPRISE: Dynamic import for DXF Modal - loads only on user interaction
// This removes DXF module graph from /audit critical path
const DxfImportModal = dynamic(
  () => import('@/subapps/dxf-viewer/components/DxfImportModal'),
  { ssr: false }
);

/** Type-safe floorplan types */
type FloorplanType = 'project' | 'parking';

interface ProjectDetailsProps {
    project: Project & { companyName: string };
}

export function ProjectDetails({ project }: ProjectDetailsProps) {
    // 🏢 ENTERPRISE: i18n hook
    const { t } = useTranslation('projects');

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

            // 🏢 ENTERPRISE: Dynamic import service only when needed (user clicked Import)
            // This removes DXF IO graph from initial bundle
            const { dxfImportService } = await import('@/subapps/dxf-viewer/io/dxf-import');

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
                        // 🏢 ENTERPRISE: i18n - Use building namespace for tab labels
                        translationNamespace="building"
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
                    title: t('emptyState.title'),
                    description: t('emptyState.description')
                }}
            />

            {/* 🏢 ENTERPRISE: DXF Import Modal - renders only when open
                This ensures the modal component is loaded only on user interaction,
                not on initial page load. Combined with dynamic import above,
                this completely removes DXF module graph from /audit critical path. */}
            {isImportModalOpen && (
                <DxfImportModal
                    isOpen={isImportModalOpen}
                    onClose={handleCloseImportModal}
                    onImport={handleDxfImport}
                />
            )}
        </>
    );
}
