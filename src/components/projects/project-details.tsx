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

import React, { useState, useCallback, useRef, useMemo } from 'react';
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
  project: (Project & { companyName: string }) | null;
  /** Deep-link initial tab — overrides default "general" tab */
  initialTab?: string;
  onNewProject?: () => void;
  onDeleteProject?: () => void;
  /** Lifted edit state from parent (e.g., CompactToolbar triggers edit) */
  isEditing?: boolean;
  /** Callback to update lifted edit state */
  onSetEditing?: (editing: boolean) => void;
  /** 🏢 ENTERPRISE: "Fill then Create" — project not yet in Firestore */
  isCreateMode?: boolean;
  /** Callback after successful creation — receives real Firestore project ID */
  onProjectCreated?: (projectId: string) => void;
  /** Callback to cancel create mode */
  onCancelCreate?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ProjectDetails({
  project,
  initialTab,
  onNewProject,
  onDeleteProject,
  isEditing: externalIsEditing,
  onSetEditing,
  isCreateMode,
  onProjectCreated,
  onCancelCreate,
}: ProjectDetailsProps) {
  const { t } = useTranslation('projects');

  // Use lifted state if available, otherwise fallback to local state
  const [localIsEditing, setLocalIsEditing] = useState(false);
  const isEditing = externalIsEditing ?? localIsEditing;
  const setIsEditing = onSetEditing ?? setLocalIsEditing;

  // Ref for save callback registered by GeneralProjectTab
  const saveCallbackRef = useRef<(() => void) | null>(null);

  const handleStartEdit = useCallback(() => {
    setIsEditing(true);
  }, [setIsEditing]);

  const handleCancelEdit = useCallback(() => {
    if (isCreateMode) {
      onCancelCreate?.();
    } else {
      setIsEditing(false);
    }
  }, [setIsEditing, isCreateMode, onCancelCreate]);

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

  // Memoize globalProps to prevent re-render cascade on ALL tabs
  const globalProps = useMemo(() => ({
    projectId: project?.id ?? '',
    isEditing,
    onSetEditing: setIsEditing,
    registerSaveCallback,
    isCreateMode,
    onProjectCreated,
  }), [project?.id, isEditing, setIsEditing, registerSaveCallback, isCreateMode, onProjectCreated]);

  return (
    <DetailsContainer
      selectedItem={project}
      header={
        project ? (
          <ProjectDetailsHeader
            project={project}
            isEditing={isEditing}
            onStartEdit={handleStartEdit}
            onSaveEdit={handleSaveEdit}
            onCancelEdit={handleCancelEdit}
            onNewProject={onNewProject}
            onDeleteProject={onDeleteProject}
          />
        ) : null
      }
      tabsRenderer={
        project ? (
          <UniversalTabsRenderer
            tabs={projectTabs.map(convertToUniversalConfig)}
            data={project}
            componentMapping={PROJECT_COMPONENT_MAPPING as unknown as Record<string, React.ComponentType<TabComponentProps>>}
            defaultTab={initialTab || "general"}
            theme="default"
            translationNamespace="building"
            globalProps={globalProps}
          />
        ) : null
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
