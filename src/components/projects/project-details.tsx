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
import type { ProjectStatus } from '@/constants/project-statuses';
import { ProjectDetailsHeader } from './ProjectDetailsHeader';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { UniversalTabsRenderer, convertToUniversalConfig, type TabComponentProps } from '@/components/generic/UniversalTabsRenderer';
import { PROJECT_COMPONENT_MAPPING } from '@/components/generic/mappings/projectMappings';
import { getSortedProjectTabs } from '@/config/project-tabs-config';
import { DetailsContainer } from '@/core/containers';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useProjectDetail } from '@/hooks/useProjectDetail';
import { useAuth } from '@/auth/hooks/useAuth';
import { useIkaTabWarnings } from './ika/hooks/useIkaTabWarnings';
import { UnifiedShareDialog } from '@/components/sharing/UnifiedShareDialog';
import { createShowcasePdfPreSubmit } from '@/components/sharing/showcase-pdf-pre-submit';
import { useProjectDraftAddresses, type ProjectDraftAddresses } from './draft/useProjectDraftAddresses';
import type { CreatedProjectFields } from './general-tab/created-project';
import { DraftProjectTabPlaceholder } from './draft/DraftProjectTabPlaceholder';

/**
 * Οι καρτέλες που περιγράφουν **το ίδιο το έργο** και άρα γεμίζουν ΠΡΙΝ υπάρξει: γράφουν στο
 * πρόχειρο και αποθηκεύονται μαζί του. Κάθε άλλη δείχνει εγγραφές δεμένες στην ταυτότητά του.
 */
const DRAFT_CAPABLE_TAB_COMPONENTS: ReadonlySet<string> = new Set([
  'GeneralProjectTab',
  'ProjectLocationsTab',
]);

// ============================================================================
// TYPES
// ============================================================================

interface ProjectDetailsProps {
  project: (Project & { companyName: string }) | null;
  /**
   * Η ενεργή καρτέλα, όταν την κρατά **ο γονέας** (η σελίδα έργου: στη διεύθυνση, ADR-242 Βήμα 3). Μαζί με το
   * `onActiveTabChange` το στοιχείο γίνεται **ελεγχόμενο** — μία πηγή, ώστε π.χ. το `hideEditButton` να μη διαφωνεί
   * ποτέ με το URL. Απόν ⇒ δική του τοπική καρτέλα (π.χ. το φύλλο γρήγορης δημιουργίας, που δεν έχει διεύθυνση).
   */
  activeTab?: string;
  onNewProject?: () => void;
  onDeleteProject?: () => void;
  /** Lifted edit state from parent (e.g., CompactToolbar triggers edit) */
  isEditing?: boolean;
  /** Callback to update lifted edit state */
  onSetEditing?: (editing: boolean) => void;
  /** 🏢 ENTERPRISE: "Fill then Create" — project not yet in Firestore */
  isCreateMode?: boolean;
  /** Callback after successful creation — receives real Firestore project ID */
  onProjectCreated?: (projectId: string, created?: CreatedProjectFields) => void;
  /**
   * Το πρόχειρο διευθύνσεων όταν το κρατά **ο γονέας**. Όποιος στήνει το `ProjectDetails` με
   * `key` ανά ταυτότητα έργου ΠΡΕΠΕΙ να το δώσει: το πρόχειρο μεταβιβάζεται από την ψευδο-ταυτότητα
   * στην πραγματική (`commit`), άρα οφείλει να **επιβιώσει** του ξαναστησίματος. Απόν ⇒ δικό του.
   */
  draftAddresses?: ProjectDraftAddresses;
  /** Ζητά από τον γονέα αλλαγή καρτέλας (ελεγχόμενη λειτουργία, βλ. `activeTab`). */
  onActiveTabChange?: (tabId: string) => void;
  /** Callback to cancel create mode */
  onCancelCreate?: () => void;
  /**
   * 🏢 ADR-300 §Addendum — Fill-then-Create status pill. When the draft
   * project (id = `__new__`) is still in the "fill" phase, the status pill
   * delegates persistence to the page-level draft store via this callback
   * so the selected status flows back down into `GeneralProjectTab`'s form
   * state through the standard props sync effect.
   */
  onDraftStatusChange?: (next: ProjectStatus) => void;
  /** Trash mode — hides edit/delete controls (items in trash are read-only) */
  isTrashMode?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ProjectDetails({
  project,
  activeTab: controlledTab,
  onNewProject,
  onDeleteProject,
  isEditing: externalIsEditing,
  onSetEditing,
  isCreateMode,
  onProjectCreated,
  draftAddresses: sharedDraftAddresses,
  onActiveTabChange,
  onCancelCreate,
  onDraftStatusChange,
  isTrashMode = false,
}: ProjectDetailsProps) {
  const { t } = useTranslation(['projects', 'projects-data', 'projects-ika']);
  const { user } = useAuth();

  // Active tab — Edit button visible only on tabs that own editable fields.
  // 'locations' is excluded: that tab uses inline-only editing (always-visible
  // "New Address" button + per-card actions), so the global header Edit toggle
  // is redundant and confusing.
  const [localTab, setLocalTab] = useState('general');
  const isTabControlled = controlledTab !== undefined && onActiveTabChange !== undefined;
  const activeTab = controlledTab !== undefined && isTabControlled ? controlledTab : localTab;
  const EDIT_TABS = new Set(['general', 'measurements']);
  const hideEditButton = !EDIT_TABS.has(activeTab);

  // Use lifted state if available, otherwise fallback to local state.
  // In create mode there is no "view" phase — start directly in edit mode.
  const [localIsEditing, setLocalIsEditing] = useState(isCreateMode === true);
  const [showcaseDialogOpen, setShowcaseDialogOpen] = useState(false);
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

  // IKA tab warning: amber dot when ≥1 worker has no insurance class.
  // undefined in create mode → hook returns empty workers (no query).
  const warningProjectId = isCreateMode ? undefined : (project?.id ?? undefined);
  const { hasWorkersWithoutClass } = useIkaTabWarnings(warningProjectId);

  // Get project tabs from centralized config
  const projectTabs = getSortedProjectTabs();

  // 🏢 «Fill then Create»: οι διευθύνσεις του πρόχειρου — τις γράφει η «Διευθύνσεις», τις
  // διαβάζει η «Γενικά» στη δημιουργία (βλ. `useProjectDraftAddresses`).
  const ownDraftAddresses = useProjectDraftAddresses(project?.id);
  const draftAddresses = sharedDraftAddresses ?? ownDraftAddresses;

  const handleTabChange = useCallback((tabId: string) => {
    if (isTabControlled) onActiveTabChange?.(tabId);
    else setLocalTab(tabId);
  }, [isTabControlled, onActiveTabChange]);

  // Όσο το έργο δεν έχει ταυτότητα, οι καρτέλες που δείχνουν ΑΛΛΕΣ εγγραφές δεμένες σε αυτήν
  // δεν έχουν τι να ρωτήσουν — λένε τι λείπει αντί να ζητήσουν την ψευδο-ταυτότητα.
  const draftTabOverrides = useMemo(() => {
    if (!isCreateMode) return undefined;
    // Οι καρτέλες-σύνδεσμοι δεν έχουν component: στο πρόχειρο φαίνονται ανενεργές (το `href` τους δίνει `null`).
    const locked = getSortedProjectTabs()
      .flatMap((tab) => (tab.component ? [tab.component] : []))
      .filter((component) => !DRAFT_CAPABLE_TAB_COMPONENTS.has(component))
      .map((component) => [component, DraftProjectTabPlaceholder] as const);
    return Object.fromEntries(locked) as Record<string, React.ComponentType<TabComponentProps>>;
  }, [isCreateMode]);

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
    draftAddresses,
  }), [effectiveProject?.id, project?.id, isEditing, setIsEditing, registerSaveCallback, isCreateMode, onProjectCreated, refetchProject, draftAddresses]);

  // 404 handling: if the hydrated GET returned "project not found" (deleted
  // mid-navigation), fall back to the empty state instead of rendering the
  // tabs against a stale summary.
  const is404 = hydrationError !== null
    && !isCreateMode
    && /not found|404/i.test(hydrationError.message);
  const displayProject = is404 ? null : effectiveProject;

  const projectShowcasePdfPreSubmit = useMemo(
    () => createShowcasePdfPreSubmit(`/api/projects/${displayProject?.id}/showcase/pdf`),
    [displayProject?.id],
  );

  return (
    <>
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
            isCreateMode={isCreateMode}
            onStatusChange={isCreateMode ? onDraftStatusChange : refetchProject}
            hideEditControls={isTrashMode}
            hideEditButton={hideEditButton}
            onShowcaseProject={displayProject?.id && !isCreateMode ? () => setShowcaseDialogOpen(true) : undefined}
          />
        ) : null
      }
      tabsRenderer={
        displayProject ? (
          <UniversalTabsRenderer
            tabs={projectTabs.map(convertToUniversalConfig)}
            data={displayProject}
            componentMapping={PROJECT_COMPONENT_MAPPING as unknown as Record<string, React.ComponentType<TabComponentProps>>}
            customComponents={draftTabOverrides}
            defaultTab={activeTab}
            theme="default"
            translationNamespace="building"
            globalProps={globalProps}
            onTabChange={handleTabChange}
            tabWarnings={{ ika: hasWorkersWithoutClass }}
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

    {displayProject?.id && user?.companyId && user?.uid && (
      <UnifiedShareDialog
        open={showcaseDialogOpen}
        onOpenChange={setShowcaseDialogOpen}
        entityType="project_showcase"
        entityId={displayProject.id}
        entityTitle={displayProject.name}
        companyId={user.companyId}
        preSubmit={projectShowcasePdfPreSubmit}
      />
    )}
    </>
  );
}

export default ProjectDetails;
