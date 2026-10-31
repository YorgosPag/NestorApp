'use client';

import React, { useState, useCallback } from 'react';
import { ENTITY_LIST_TOKENS } from '@/styles/design-tokens';
import type { Project } from '@/types/project';
import type { ProjectStatus } from '@/constants/project-statuses';
import type { NavigationCompany } from '@/components/navigation/core/types';
import { ProjectsList } from './projects-list';
import { ProjectDetails } from './project-details';
import { useProjectDraftAddresses } from './draft/useProjectDraftAddresses';
import { useProjectActiveTab } from './hooks/useProjectActiveTab';
import type { CreatedProjectFields } from './general-tab/created-project';
import { DESKTOP_SPLIT, ListDetailsSplit, MobileDetailsSlideIn } from '@/core/layouts';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { toggleSelect } from '@/lib/toggle-select';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
// 🏢 ENTERPRISE: Grid view imports - Using proper GridCard (PR: Enterprise Grid System)
import { ScrollArea } from '@/components/ui/scroll-area';
import { ProjectGridCard } from '@/domain';
import '@/lib/design-system';
import { gridPatterns } from '@/styles/design-tokens';

// 🏢 ENTERPRISE: View mode type (matches useProjectsPageState)
type ProjectsViewMode = 'list' | 'grid' | 'byType' | 'byStatus';

interface ProjectViewSwitchProps {
  projects: Project[];
  selectedProject: Project | null;
  onSelectProject: (project: Project | null) => void;
  companies: NavigationCompany[];
  viewMode?: ProjectsViewMode;
  onNewProject?: () => void;
  onDeleteProject?: (project: Project) => void;
  /** Start in edit mode (for inline project creation) */
  startInEditMode?: boolean;
  /** 🏢 ENTERPRISE: "Fill then Create" — form is in create mode */
  isCreateMode?: boolean;
  /** Callback after successful creation — receives real Firestore project ID */
  onProjectCreated?: (projectId: string, created?: CreatedProjectFields) => void;
  /** Callback to cancel create mode */
  onCancelCreate?: () => void;
  /** ADR-300 §Addendum — draft-mode status pill persistence (Fill then Create) */
  onDraftStatusChange?: (next: ProjectStatus) => void;
  /** Trash mode — disables edit actions (items in trash are read-only) */
  isTrashMode?: boolean;
}

export function ProjectViewSwitch({
  projects, selectedProject, onSelectProject, companies, viewMode = 'list', onNewProject, onDeleteProject, startInEditMode, isCreateMode, onProjectCreated, onCancelCreate, onDraftStatusChange, isTrashMode = false }: ProjectViewSwitchProps) {
  // 🏢 ENTERPRISE: Hooks must be called inside component body
  // 🏢 ENTERPRISE: Centralized spacing tokens
  const spacing = useSpacingTokens();
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('projects');
  // 🏢 ENTERPRISE: Lifted edit state — shared between CompactToolbar and ProjectDetails
  const [isEditingProject, setIsEditingProject] = useState(false);

  const handleEditProject = useCallback(() => {
    setIsEditingProject(true);
  }, []);

  // Reset or activate edit mode when selected project changes
  React.useEffect(() => {
    setIsEditingProject(!!startInEditMode);
  }, [selectedProject?.id, startInEditMode]);

  // ADR-742: το `ProjectDetails` στήνεται με `key` ανά ταυτότητα έργου (βλ. `detailsIdentity`). Ό,τι
  // πρέπει να ΕΠΙΒΙΩΣΕΙ της αλλαγής ταυτότητας ζει εδώ: το πρόχειρο διευθύνσεων (μεταβιβάζεται από
  // την ψευδο-ταυτότητα στην πραγματική) και η ενεργή καρτέλα (ο άνθρωπος που ξεφυλλίζει έργα στην
  // «Κτίρια» δεν γυρίζει στη «Γενικά» σε κάθε κλικ) — η οποία ζει πλέον στη διεύθυνση (ADR-242 Βήμα 3).
  const draftAddresses = useProjectDraftAddresses(selectedProject?.id);
  const { activeTab, setActiveTab } = useProjectActiveTab({
    isCreateMode: isCreateMode === true,
    hasSelection: selectedProject !== null,
  });

  /**
   * 🔑 **Μία ταυτότητα = ένα στήσιμο.** Χωρίς `key`, το πέρασμα πρόχειρο → πραγματικό έργο κρατούσε
   * το ίδιο δέντρο: κάθε καρτέλα που είχε ανοίξει ως πρόχειρο (`forceMount`) έστηνε τότε το
   * πραγματικό της component **κρυμμένη** και ρωτούσε τον διακομιστή (`structure`, `customers`,
   * `buildings`, `parking`) χωρίς να τη δει κανείς (μετρημένο ζωντανά, 2026-10-04).
   */
  const detailsIdentity = selectedProject?.id ?? 'none';

  // 🏢 ENTERPRISE: Favorites state for grid view (PR: Projects Grid View)
  const [favorites, setFavorites] = useState<string[]>([]);

  const toggleFavorite = (projectId: string) => {
    setFavorites(prev =>
      prev.includes(projectId)
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    );
  };

  const getProjectWithCompanyName = (project: Project) => {
    const company = companies?.find(c => c.id === project.linkedCompanyId);
    return {
      ...project,
      companyName: company?.companyName || project.company,
    };
  };

  /**
   * 🔴 ADR-784 §10.7 / CHECK 3.28 — **ΤΟ ΣΥΡΤΑΡΙ ΤΟΥ ΚΙΝΗΤΟΥ ΓΡΑΦΟΤΑΝ ΔΥΟ ΦΟΡΕΣ.**
   *
   * Η προβολή πλέγματος και η προβολή λίστας κατέληγαν στο **ίδιο ακριβώς** συρτάρι με τις
   * λεπτομέρειες του έργου — δεκατέσσερις γραμμές props η καθεμία. Δύο αντίγραφα σημαίνει ότι
   * ένα prop μπορούσε να προστεθεί στο ένα και να **λείπει σιωπηλά** στο άλλο, δηλαδή η ίδια
   * οθόνη να συμπεριφέρεται αλλιώς ανάλογα με το πώς την άνοιξες.
   * Από το ADR-912 §12.19 το ίδιο στοιχείο ανοίγει και **δίπλα** στο πλέγμα (side peek) — πάλι **μία** δήλωση.
   */
  const projectDetails = selectedProject && (
    <ProjectDetails
      key={detailsIdentity}
      project={getProjectWithCompanyName(selectedProject)}
      activeTab={activeTab}
      onActiveTabChange={setActiveTab}
      draftAddresses={draftAddresses}
      onNewProject={onNewProject}
      onDeleteProject={onDeleteProject ? () => onDeleteProject(selectedProject) : undefined}
      isEditing={isEditingProject}
      onSetEditing={setIsEditingProject}
      isCreateMode={isCreateMode}
      onProjectCreated={onProjectCreated}
      onCancelCreate={onCancelCreate}
      onDraftStatusChange={onDraftStatusChange}
      isTrashMode={isTrashMode}
    />
  );
  const detailsTitle = selectedProject ? getProjectWithCompanyName(selectedProject).name : t('viewSwitch.detailsTitle');
  const closeDetails = () => onSelectProject(null);

  const mobileSlideIn = (
    <MobileDetailsSlideIn isOpen={!!selectedProject} onClose={closeDetails} title={detailsTitle}>
      {projectDetails}
    </MobileDetailsSlideIn>
  );

  /** Ο ίδιος κατάλογος σε δύο δοχεία (desktop split · κινητό πλήρους πλάτους) — **μία** δήλωση. */
  const projectsListPanel = (
    <ProjectsList
      projects={projects}
      selectedProject={selectedProject}
      onSelectProject={(p) => onSelectProject(toggleSelect(selectedProject, p))}
      companies={companies}
      onNewProject={onNewProject}
      onEditProject={selectedProject && !isTrashMode ? handleEditProject : undefined}
      onDeleteProject={selectedProject && onDeleteProject ? () => onDeleteProject(selectedProject) : undefined}
    />
  );

  // 🏢 ENTERPRISE: Grid View Rendering - Using proper GridCard (PR: Enterprise Grid System)
  // Uses ProjectGridCard (vertical layout) for grid view
  if (viewMode === 'grid') {
    // ADR-912 §12.19 — πλέγμα + side peek: η επιλογή ανοίγει τις λεπτομέρειες ΔΙΠΛΑ (desktop) ή ως φύλλο (κινητό).
    return (
      <ListDetailsSplit
        peek
        list={
          <ScrollArea className="flex-1 w-full">
            <section
              className={cn(spacing.padding.sm, "grid", gridPatterns.cards.tile, spacing.gap.sm)}
              aria-label={t('grid.ariaLabel')}
            >
              {projects.map((project: Project) => (
                <ProjectGridCard
                  key={project.id}
                  project={project}
                  isSelected={selectedProject?.id === project.id}
                  isFavorite={favorites.includes(project.id)}
                  onSelect={() => onSelectProject(toggleSelect(selectedProject, project))}
                  onToggleFavorite={() => toggleFavorite(project.id)}
                />
              ))}
            </section>
          </ScrollArea>
        }
        details={projectDetails}
        sheetOpen={!!selectedProject}
        sheetTitle={detailsTitle}
        onCloseSheet={closeDetails}
      />
    );
  }

  // 🏢 ENTERPRISE: List View (Original behavior)
  return (
    <>
      {/* 🖥️ DESKTOP: Standard split layout */}
      <div className={DESKTOP_SPLIT}>
        {projectsListPanel}
        <ProjectDetails
          key={detailsIdentity}
          project={selectedProject ? getProjectWithCompanyName(selectedProject) : null}
          activeTab={activeTab}
          onActiveTabChange={setActiveTab}
          draftAddresses={draftAddresses}
          onNewProject={onNewProject}
          onDeleteProject={selectedProject && onDeleteProject ? () => onDeleteProject(selectedProject) : undefined}
          isEditing={isEditingProject}
          onSetEditing={setIsEditingProject}
          isCreateMode={isCreateMode}
          onProjectCreated={onProjectCreated}
          onCancelCreate={onCancelCreate}
          onDraftStatusChange={onDraftStatusChange}
          isTrashMode={isTrashMode}
        />
      </div>

      {/* 📱 MOBILE: Show only ProjectsList when no project is selected */}
      <div className={selectedProject ? ENTITY_LIST_TOKENS.mobileRegion.hidden : ENTITY_LIST_TOKENS.mobileRegion.shown}>
        {projectsListPanel}
      </div>

      {mobileSlideIn}
    </>
  );
}
