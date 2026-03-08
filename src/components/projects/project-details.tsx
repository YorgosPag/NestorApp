/**
 * =============================================================================
 * Project Details Component
 * =============================================================================
 *
 * Main container for project details display with tabbed interface.
 *
 * @module components/projects/project-details
 * @enterprise ADR-033 - Floorplan Processing Pipeline
 *
 * Architecture:
 * - Uses UniversalTabsRenderer for flexible tab rendering
 * - Floorplan tabs use centralized file storage (same as Photos/Videos)
 * - Each tab component is self-contained (no props drilling for floorplans)
 * - Edit state is lifted here and passed to header + tabs via globalProps
 */

'use client';

import React, { useState, useCallback, useRef } from 'react';
import type { Project } from '@/types/project';
import { ProjectDetailsHeader } from './ProjectDetailsHeader';
import { Briefcase } from 'lucide-react';
import { UniversalTabsRenderer, convertToUniversalConfig, type TabComponentProps } from '@/components/generic/UniversalTabsRenderer';
import { PROJECT_COMPONENT_MAPPING } from '@/components/generic/mappings/projectMappings';
import { getSortedProjectTabs } from '@/config/project-tabs-config';
import { DetailsContainer } from '@/core/containers';
import { useTranslation } from '@/i18n/hooks/useTranslation';

// ============================================================================
// TYPES
// ============================================================================

interface ProjectDetailsProps {
  project: Project & { companyName: string };
  /** Deep-link initial tab — overrides default "general" tab */
  initialTab?: string;
  onNewProject?: () => void;
  onDeleteProject?: () => void;
  /** Ref that parent can use to trigger edit mode externally (e.g., from CompactToolbar) */
  editTriggerRef?: React.MutableRefObject<(() => void) | null>;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ProjectDetails({
  project,
  initialTab,
  onNewProject,
  onDeleteProject,
  editTriggerRef
}: ProjectDetailsProps) {
  const { t } = useTranslation('projects');

  // Lifted edit state — shared between header buttons and GeneralProjectTab
  const [isEditing, setIsEditing] = useState(false);

  // Ref for save callback registered by GeneralProjectTab
  const saveCallbackRef = useRef<(() => void) | null>(null);

  const handleStartEdit = useCallback(() => {
    setIsEditing(true);
  }, []);

  // Expose handleStartEdit to parent via editTriggerRef
  React.useEffect(() => {
    if (editTriggerRef) {
      editTriggerRef.current = handleStartEdit;
    }
    return () => {
      if (editTriggerRef) {
        editTriggerRef.current = null;
      }
    };
  }, [editTriggerRef, handleStartEdit]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleSaveEdit = useCallback(() => {
    // Delegate to the tab's save function if registered
    if (saveCallbackRef.current) {
      saveCallbackRef.current();
    }
  }, []);

  // Callback for GeneralProjectTab to register its save function
  const registerSaveCallback = useCallback((saveFn: () => void) => {
    saveCallbackRef.current = saveFn;
  }, []);

  // Get project tabs from centralized config
  const projectTabs = getSortedProjectTabs();

  return (
    <DetailsContainer
      selectedItem={project}
      header={
        <ProjectDetailsHeader
          project={project!}
          isEditing={isEditing}
          onStartEdit={handleStartEdit}
          onSaveEdit={handleSaveEdit}
          onCancelEdit={handleCancelEdit}
          onNewProject={onNewProject}
          onDeleteProject={onDeleteProject}
        />
      }
      tabsRenderer={
        <UniversalTabsRenderer
          tabs={projectTabs.map(convertToUniversalConfig)}
          data={project!}
          componentMapping={PROJECT_COMPONENT_MAPPING as unknown as Record<string, React.ComponentType<TabComponentProps>>}
          defaultTab={initialTab || "general"}
          theme="default"
          translationNamespace="building"
          globalProps={{
            projectId: project!.id,
            isEditing,
            onSetEditing: setIsEditing,
            registerSaveCallback,
          }}
        />
      }
      emptyStateProps={{
        icon: Briefcase,
        title: t('emptyState.title'),
        description: t('emptyState.description')
      }}
    />
  );
}

export default ProjectDetails;
