'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { useSpacingTokens } from '@/hooks/useSpacingTokens';

import { GeneralProjectHeader } from '../GeneralProjectHeader';
import { BasicProjectInfoTab } from '../BasicProjectInfoTab';
import { PermitsAndStatusTab } from '../PermitsAndStatusTab';

import { useAutosave } from './hooks/useAutosave';
import { ProjectCustomersTable } from './parts/ProjectCustomersTable';
import { ProjectBuildingsCard } from './parts/ProjectBuildingsCard';
import type { GeneralProjectTabProps, ProjectFormData } from './types';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
// 🏢 ENTERPRISE: Project update server action (SAP/Salesforce pattern)
import { updateProject } from '@/services/projects.service';
// 🏢 ENTERPRISE: Centralized real-time service for cross-page sync
import { RealtimeService } from '@/services/realtime';
import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('GeneralProjectTab');

export function GeneralProjectTab({ project }: GeneralProjectTabProps) {
  // 🏢 ENTERPRISE: Router for soft refresh after save
  const router = useRouter();
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('projects');
  // 🏢 ENTERPRISE: Centralized spacing tokens
  const spacing = useSpacingTokens();
  const [isEditing, setIsEditing] = useState(false);
  const [projectData, setProjectData] = useState<ProjectFormData>({
    // Βασικά πεδία
    name: project.name,
    licenseTitle: project.title,
    description: project.description || t('generalTab.defaultDescription'),
    buildingBlock: '10',
    protocolNumber: '',
    licenseNumber: '5142/24-10-2001',
    issuingAuthority: '',
    status: project.status,
    showOnWeb: false,
    mapPath: '\\\\Server\\shared\\6. erga\\Eterpis_Gen\\Eterp_Gen_Images\\Eterp_Xartis.jpg',
    floorPlanPath: '\\\\Server\\shared\\6. erga\\TEST\\SSSSSS.pdf',
    percentagesPath: '\\\\Server\\shared\\6. erga\\TEST\\SSSSSSSS.xls',
    companyName: project.companyName,
    // Λεπτομέρειες (from project entity)
    type: project.type || '',
    priority: project.priority || '',
    riskLevel: project.riskLevel || '',
    complexity: project.complexity || '',
    budget: project.budget || '',
    totalValue: project.totalValue || '',
    totalArea: project.totalArea || '',
    duration: project.duration || '',
    startDate: project.startDate || '',
    completionDate: project.completionDate || '',
    client: project.client || '',
    location: project.location || '',
  });

  const { autoSaving, lastSaved, setDirty } = useAutosave(projectData, isEditing);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setProjectData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setDirty();
  };

  useEffect(() => {
    setProjectData(prev => ({
      ...prev,
      name: project.name,
      licenseTitle: project.title,
      status: project.status,
      companyName: project.companyName,
      description: project.description || prev.description,
      type: project.type || '',
      priority: project.priority || '',
      riskLevel: project.riskLevel || '',
      complexity: project.complexity || '',
      budget: project.budget || '',
      totalValue: project.totalValue || '',
      totalArea: project.totalArea || '',
      duration: project.duration || '',
      startDate: project.startDate || '',
      completionDate: project.completionDate || '',
      client: project.client || '',
      location: project.location || '',
    }));
  }, [project]);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  /**
   * 🏢 ENTERPRISE: Handle project save using Server Action
   *
   * Pattern: SAP/Salesforce/Microsoft Dynamics
   * - Client calls Server Action (not direct database access)
   * - Server validates and writes to database
   * - Returns success/error to client
   */
  const handleSave = async () => {
    try {
      setIsSaving(true);
      setSaveError(null);
      logger.info('Saving project via Server Action...', { data: projectData });

      // 🏢 ENTERPRISE: Build update payload with ALL modified fields
      const updatePayload: Parameters<typeof updateProject>[1] = {
        name: projectData.name,
        title: projectData.licenseTitle,
        status: projectData.status,
        description: projectData.description,
        client: projectData.client || undefined,
        location: projectData.location || undefined,
        type: projectData.type || undefined,
        priority: projectData.priority || undefined,
        riskLevel: projectData.riskLevel || undefined,
        complexity: projectData.complexity || undefined,
        budget: typeof projectData.budget === 'number' ? projectData.budget : undefined,
        totalValue: typeof projectData.totalValue === 'number' ? projectData.totalValue : undefined,
        totalArea: typeof projectData.totalArea === 'number' ? projectData.totalArea : undefined,
        duration: typeof projectData.duration === 'number' ? projectData.duration : undefined,
        startDate: projectData.startDate || undefined,
        completionDate: projectData.completionDate || undefined,
      };

      const result = await updateProject(project.id, updatePayload);

      if (!result.success) {
        throw new Error(result.error || 'Failed to save project');
      }

      logger.info('Project saved successfully via Server Action');
      setIsEditing(false);

      // 🏢 ENTERPRISE: Centralized Real-time Service (ZERO DUPLICATES)
      RealtimeService.dispatch('PROJECT_UPDATED', {
        projectId: project.id,
        updates: {
          name: projectData.name,
          title: projectData.licenseTitle,
          status: projectData.status,
        },
        timestamp: Date.now()
      });

    } catch (error) {
      logger.error('Error saving project:', { error: error });
      setSaveError(error instanceof Error ? error.message : 'Failed to save project');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <GeneralProjectHeader
        isEditing={isEditing}
        setIsEditing={setIsEditing}
        autoSaving={autoSaving}
        lastSaved={lastSaved}
        handleSave={handleSave}
        projectCode={project.projectCode}
        projectId={project.id}
        isSaving={isSaving}
        saveError={saveError}
      />

      <section className={cn(spacing.spaceBetween.md, spacing.margin.top.md)}>
        <BasicProjectInfoTab
          data={projectData}
          setData={setProjectData}
          isEditing={isEditing}
        />

        <PermitsAndStatusTab
          data={projectData}
          setData={setProjectData}
          isEditing={isEditing}
        />

        <ProjectBuildingsCard projectId={project.id} />
        <ProjectCustomersTable projectId={project.id} />
      </section>
    </>
  );
}
