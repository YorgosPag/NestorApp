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
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { UniversalTabsRenderer, convertToUniversalConfig, type TabComponentProps } from '@/components/generic/UniversalTabsRenderer';
import { PROJECT_COMPONENT_MAPPING } from '@/components/generic/mappings/projectMappings';
import { getSortedProjectTabs } from '@/config/project-tabs-config';
import { DetailsContainer } from '@/core/containers';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useProjectDetail } from '@/hooks/useProjectDetail';

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

  // 🏢 ADR-256 read-path: hydrate the full Firestore document on select. The
  // list API only projects ~19 lean fields for tile perf — the detail view
  // needs the remaining 22+ (permits, description, budget, client, etc.).
  // Until this resolves, `project` still renders (tile-level fields paint
  // immediately), then the hydrated doc takes over as SSoT.
  const {
    project: hydratedProject,
    error: hydrationError,
    refetch: refetchProject,
  } = useProjectDetail(project?.id ?? null, {
    skip: isCreateMode === true,
    pauseRefetch: isEditing,
  });

  // Merge order matters: hydrated wins over summary, then `companyName` is
  // re-spread last because it's added by the `getProjectWithCompanyName`
  // wrapper in `ProjectViewSwitch` and does NOT exist on the raw Firestore
  // doc — we must not drop it during hydration.
  const effectiveProject = useMemo<(Project & { companyName: string }) | null>(() => {
    if (!project) return null;
    if (isCreateMode) return project;
    if (!hydratedProject) return project;
    return { ...project, ...hydratedProject, companyName: project.companyName };
  }, [project, hydratedProject, isCreateMode]);

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

  // Memoize globalProps to prevent re-render cascade on ALL tabs.
  // `refetchProject` is additive and optional — only `GeneralProjectTab` uses
  // it today (post-save canonicalization), the other 16 tabs ignore it.
  const globalProps = useMemo(() => ({
    projectId: effectiveProject?.id ?? project?.id ?? '',
    isEditing,
    onSetEditing: setIsEditing,
    registerSaveCallback,
    isCreateMode,
    onProjectCreated,
    refetchProject,
  }), [effectiveProject?.id, project?.id, isEditing, setIsEditing, registerSaveCallback, isCreateMode, onProjectCreated, refetchProject]);

  // 404 handling: if the hydrated GET returned "project not found" (deleted
  // mid-navigation), fall back to the empty state instead of rendering the
  // tabs against a stale summary.
  const is404 = hydrationError !== null
    && !isCreateMode
    && /not found|404/i.test(hydrationError.message);
  const displayProject = is404 ? null : effectiveProject;

  return (
    <DetailsContainer
      selectedItem={displayProject}
      header={
        displayProject ? (
          <ProjectDetailsHeader
            project={displayProject}
            isEditing={isEditing}
            onStartEdit={handleStartEdit}
            onSaveEdit={handleSaveEdit}
            onCancelEdit={handleCancelEdit}
            onNewProject={onNewProject}
            onDeleteProject={onDeleteProject}
            onStatusChange={refetchProject}
          />
        ) : null
      }
      tabsRenderer={
        displayProject ? (
          <UniversalTabsRenderer
            tabs={projectTabs.map(convertToUniversalConfig)}
            data={displayProject}
            componentMapping={PROJECT_COMPONENT_MAPPING as unknown as Record<string, React.ComponentType<TabComponentProps>>}
            defaultTab={initialTab || "general"}
            theme="default"
            translationNamespace="building"
            globalProps={globalProps}
          />
        ) : null
      }
      onCreateAction={onNewProject}
      emptyStateProps={{
        icon: NAVIGATION_ENTITIES.project.icon,
        title: t('emptyState.title'),
        description: t('emptyState.description')
      }}
    />
  );
}

export default ProjectDetails;
