'use client';

/**
 * Desktop Multi-Column Navigation Component
 * Finder-style multi-column layout for desktop navigation.
 *
 * Logic extracted to:
 * - useDesktopNavData.ts — memoized data, filtering, tab callbacks
 * - desktop-nav-handlers.ts — delete/unlink/connection handlers
 * - DesktopNavDialogs.tsx — all dialog & modal UI
 */

import { useState, useMemo } from 'react';
import { useNotifications } from '@/providers/NotificationProvider';
import { NavigationButton } from './NavigationButton';
import { ContextualNavigationService } from '@/services/navigation/ContextualNavigationService';
import { NavigationCardToolbar } from './NavigationCardToolbar';
import { BuildingSpacesTabs } from './BuildingSpacesTabs';
import { NAVIGATION_ENTITIES, NAVIGATION_ACTIONS } from '../config';
import { useNavigation } from '../core/NavigationContext';
import { getNavigationFilterCategories } from '@/subapps/dxf-viewer/config/modal-select/core/labels/navigation';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import '@/lib/design-system';

// Extracted modules
import {
  filterData,
  useDesktopNavData,
  AVAILABLE_PROJECTS,
  AVAILABLE_UNITS,
} from './useDesktopNavData';
import {
  canDeleteCompany,
  getDeleteWarningKey,
  executeCompanyDeletion,
  executeEntityUnlink,
  executeBuildingConnection,
  filterBuildings,
  type PendingCompany,
  type PendingEntity,
} from './desktop-nav-handlers';
import { DesktopNavDialogs } from './DesktopNavDialogs';

// Re-export for backward compatibility
export type { PendingCompany, PendingEntity } from './desktop-nav-handlers';

interface DesktopMultiColumnProps {
  onCompanySelect: (companyId: string) => void;
  onProjectSelect: (projectId: string) => void;
  onBuildingSelect: (buildingId: string) => void;
  /** @deprecated Floors removed from navigation (Option A) — kept for backward compat */
  onFloorSelect?: (floorId: string) => void;
  onNavigateToPage: (type: 'properties' | 'projects' | 'buildings' | 'floorplan') => void;
  onAddCompanyClick: () => void;
  navigationCompanyIds: string[];
}

export function DesktopMultiColumn({
  onCompanySelect,
  onProjectSelect,
  onBuildingSelect,
  onFloorSelect: _onFloorSelect,
  onNavigateToPage,
  onAddCompanyClick,
  navigationCompanyIds,
}: DesktopMultiColumnProps) {
  const {
    companies,
    projects,
    selectedCompany,
    selectedProject,
    selectedBuilding,
    selectedProperty,
    projectsLoading,
    loadCompanies,
    selectProperty,
    getBuildingCount,
    getPropertyCount,
  } = useNavigation();

  const { warning } = useNotifications();
  const { t } = useTranslation('navigation');

  // ── Local UI state ──
  const [companiesSearch, setCompaniesSearch] = useState('');
  const [companiesFilters, setCompaniesFilters] = useState<string[]>([]);
  const [projectsSearch, setProjectsSearch] = useState('');
  const [projectsFilters, setProjectsFilters] = useState<string[]>([]);
  const [buildingsSearch, setBuildingsSearch] = useState('');
  const [buildingsFilters, setBuildingsFilters] = useState<string[]>([]);

  // Dialog states
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingDeletionCompany, setPendingDeletionCompany] = useState<PendingCompany | null>(null);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [pendingUnlinkProject, setPendingUnlinkProject] = useState<PendingEntity | null>(null);
  const [buildingDialogOpen, setBuildingDialogOpen] = useState(false);
  const [pendingUnlinkBuilding, setPendingUnlinkBuilding] = useState<PendingEntity | null>(null);
  const [propertyDialogOpen, setPropertyDialogOpen] = useState(false);
  const [pendingUnlinkProperty, setPendingUnlinkProperty] = useState<PendingEntity | null>(null);

  // Modal states
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isBuildingModalOpen, setIsBuildingModalOpen] = useState(false);
  const [isPropertyModalOpen, setIsPropertyModalOpen] = useState(false);

  // ── Extracted data hook ──
  const {
    projectBuildings,
    availableBuildings,
    buildingProperties,
    buildingStorages,
    buildingParkingSpots,
    selectedBuildingSpace,
    handlePropertySelectFromTabs,
    handleStorageSelectFromTabs,
    handleParkingSelectFromTabs,
  } = useDesktopNavData(isBuildingModalOpen);

  const filteredProjectBuildings = useMemo(
    () => filterBuildings(projectBuildings, buildingsSearch),
    [projectBuildings, buildingsSearch]
  );

  const ActionsIcon = NAVIGATION_ACTIONS.actions.icon;

  // ── Handler wrappers ──

  const showDeleteWarning = (itemType: 'company' | 'project' | 'building', count: number) => {
    warning(t(getDeleteWarningKey(itemType), { count }), { duration: 5000 });
  };

  const handleDeleteCompany = () => {
    if (!selectedCompany) return;
    if (canDeleteCompany(selectedCompany, projects)) {
      setPendingDeletionCompany(selectedCompany);
      setConfirmDialogOpen(true);
    } else {
      const count = projects.filter(p => p.companyId === selectedCompany.id).length;
      showDeleteWarning('company', count);
    }
  };

  const handleConfirmedCompanyDeletion = async () => {
    if (!pendingDeletionCompany) return;
    await executeCompanyDeletion({
      pendingDeletionCompany,
      onCompanySelect,
      loadCompanies,
      warning,
      t,
    });
    setConfirmDialogOpen(false);
    setPendingDeletionCompany(null);
  };

  const handleDeleteProject = () => {
    if (!selectedProject) return;
    const buildingCount = getBuildingCount(selectedProject.id);
    if (buildingCount > 0) { showDeleteWarning('project', buildingCount); return; }
    setPendingUnlinkProject({ id: selectedProject.id, name: selectedProject.name });
    setProjectDialogOpen(true);
  };

  const handleConfirmedProjectUnlink = async () => {
    if (!pendingUnlinkProject) return;
    await executeEntityUnlink({
      pending: pendingUnlinkProject, entityType: 'project',
      clearSelection: () => onProjectSelect(''),
      warning, t, dialogKey: 'dialogs.project', nameParam: 'projectName',
    });
    setProjectDialogOpen(false);
    setPendingUnlinkProject(null);
  };

  const handleDeleteBuilding = () => {
    if (!selectedBuilding) return;
    const totalProperties = getPropertyCount(selectedBuilding.id);
    if (totalProperties > 0) { showDeleteWarning('building', totalProperties); return; }
    setPendingUnlinkBuilding({ id: selectedBuilding.id, name: selectedBuilding.name });
    setBuildingDialogOpen(true);
  };

  const handleConfirmedBuildingUnlink = async () => {
    if (!pendingUnlinkBuilding) return;
    await executeEntityUnlink({
      pending: pendingUnlinkBuilding, entityType: 'building',
      clearSelection: () => onBuildingSelect(''),
      warning, t, dialogKey: 'dialogs.building', nameParam: 'buildingName',
    });
    setBuildingDialogOpen(false);
    setPendingUnlinkBuilding(null);
  };

  const handleDeleteProperty = () => {
    if (!selectedProperty) return;
    setPendingUnlinkProperty({ id: selectedProperty.id, name: selectedProperty.name });
    setPropertyDialogOpen(true);
  };

  const handleConfirmedPropertyUnlink = async () => {
    if (!pendingUnlinkProperty) return;
    await executeEntityUnlink({
      pending: pendingUnlinkProperty, entityType: 'property',
      clearSelection: () => selectProperty(null),
      warning, t, dialogKey: 'dialogs.property', nameParam: 'propertyName',
    });
    setPropertyDialogOpen(false);
    setPendingUnlinkProperty(null);
  };

  const handleProjectSelected = (_project: { id: string; name: string }) => {
    // TODO: Implement actual connection logic
  };

  const handleBuildingSelected = async (building: { id: string; name: string }) => {
    if (!selectedProject) { warning(t('modals.selectFirst'), { duration: 3000 }); return; }
    await executeBuildingConnection({
      building,
      selectedProjectId: selectedProject.id,
      selectedProjectName: selectedProject.name,
      warning,
      closeModal: () => setIsBuildingModalOpen(false),
    });
  };

  const handlePropertySelected = (_unit: { id: string; name: string }) => {
    // TODO: Implement actual connection logic
  };

  // ── Render ──

  return (
    <nav className="hidden md:block" role="navigation" aria-label={t('page.hierarchyLabel')}>
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 gap-4">

        {/* Column 1: Companies */}
        <section className="bg-white dark:bg-card border border-border rounded-lg p-3 overflow-hidden"
                 role="region" aria-label={t('columns.companies.sectionLabel')}>
          <header className="flex items-center gap-2 mb-2">
            <NAVIGATION_ENTITIES.company.icon className={`h-5 w-5 ${NAVIGATION_ENTITIES.company.color}`} />
            <h3 className="font-semibold text-gray-900 dark:text-foreground">{t('columns.companies.title')}</h3>
          </header>
          <NavigationCardToolbar
            level="companies"
            searchTerm={companiesSearch}
            onSearchChange={setCompaniesSearch}
            activeFilters={companiesFilters}
            onFiltersChange={setCompaniesFilters}
            hasSelectedItems={!!selectedCompany}
            itemCount={filterData(companies, companiesSearch, companiesFilters).length}
            onNewItem={onAddCompanyClick}
            onDeleteItem={handleDeleteCompany}
          />
          <ul className="space-y-2 list-none max-h-64 pr-2 overflow-y-auto" role="list"
              aria-label={t('columns.companies.listLabel')} data-navigation-scroll="true">
            {filterData(companies, companiesSearch, companiesFilters).map(company => {
              const companyProjects = projects.filter(p => p.companyId === company.id);
              const hasProjects = companyProjects.length > 0;
              const isNavigationCompany = navigationCompanyIds.includes(company.id);
              let subtitle = company.industry || t('columns.companies.defaultSubtitle');
              let extraInfo: string | undefined;
              if (!hasProjects) {
                subtitle = isNavigationCompany
                  ? t('columns.companies.addProjects')
                  : t('columns.companies.noProjects');
                extraInfo = company.vatNumber
                  ? t('columns.companies.vatNumber', { vatNumber: company.vatNumber })
                  : undefined;
              }
              return (
                <li key={company.id}>
                  <NavigationButton
                    onClick={() => onCompanySelect(company.id)}
                    icon={NAVIGATION_ENTITIES.company.icon}
                    iconColor={NAVIGATION_ENTITIES.company.color}
                    title={company.companyName}
                    subtitle={subtitle}
                    extraInfo={extraInfo}
                    isSelected={selectedCompany?.id === company.id}
                    variant="compact"
                    badgeStatus={!projectsLoading && !hasProjects ? 'no_projects' : undefined}
                    badgeText={!projectsLoading && !hasProjects ? t(getNavigationFilterCategories().company_without_projects) : undefined}
                    navigationHref={ContextualNavigationService.generateRoute('company', company.id, { action: 'select' })}
                    navigationTooltip={t('columns.companies.openTooltip')}
                  />
                </li>
              );
            })}
          </ul>
        </section>

        {/* Column 2: Projects */}
        {selectedCompany && (
          <section className="bg-white dark:bg-card border border-border rounded-lg p-3 overflow-hidden"
                   role="region" aria-label={t('columns.projects.sectionLabel')}>
            <header className="flex items-center gap-2 mb-2">
              <NAVIGATION_ENTITIES.project.icon className={`h-5 w-5 ${NAVIGATION_ENTITIES.project.color}`} />
              <h3 className="font-semibold text-gray-900 dark:text-foreground">{t('columns.projects.title')}</h3>
            </header>
            <NavigationCardToolbar
              level="projects"
              searchTerm={projectsSearch}
              onSearchChange={setProjectsSearch}
              activeFilters={projectsFilters}
              onFiltersChange={setProjectsFilters}
              hasSelectedItems={!!selectedProject}
              itemCount={filterData(projects.filter(p => p.linkedCompanyId === selectedCompany?.id), projectsSearch, projectsFilters).length}
              onNewItem={() => setIsProjectModalOpen(true)}
              onDeleteItem={handleDeleteProject}
            />
            <ul className="space-y-2 list-none max-h-64 pr-2 overflow-y-auto" role="list"
                aria-label={t('columns.projects.listLabel')} data-navigation-scroll="true">
              {filterData(projects.filter(p => p.linkedCompanyId === selectedCompany?.id), projectsSearch, projectsFilters).map(project => {
                const buildingCount = getBuildingCount(project.id);
                const hasBuildings = buildingCount > 0;
                return (
                  <li key={project.id}>
                    <NavigationButton
                      onClick={() => onProjectSelect(project.id)}
                      icon={NAVIGATION_ENTITIES.project.icon}
                      iconColor={NAVIGATION_ENTITIES.project.color}
                      title={project.name}
                      subtitle={t('columns.projects.buildingCount', { count: buildingCount })}
                      isSelected={selectedProject?.id === project.id}
                      variant="compact"
                      badgeStatus={!hasBuildings ? 'no_projects' : undefined}
                      badgeText={!hasBuildings ? t(getNavigationFilterCategories().project_without_buildings) : undefined}
                      navigationHref={ContextualNavigationService.generateRoute('project', project.id, { action: 'select' })}
                      navigationTooltip={t('columns.projects.openTooltip')}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Column 3: Buildings */}
        {selectedProject && (
          <section className="bg-white dark:bg-card border border-border rounded-lg p-3 overflow-hidden"
                   role="region" aria-label={t('columns.buildings.sectionLabel')}>
            <header className="flex items-center gap-2 mb-2">
              <NAVIGATION_ENTITIES.building.icon className={`h-5 w-5 ${NAVIGATION_ENTITIES.building.color}`} />
              <h3 className="font-semibold text-gray-900 dark:text-foreground">{t('columns.buildings.title')}</h3>
            </header>
            <NavigationCardToolbar
              level="buildings"
              searchTerm={buildingsSearch}
              onSearchChange={setBuildingsSearch}
              activeFilters={buildingsFilters}
              onFiltersChange={setBuildingsFilters}
              hasSelectedItems={!!selectedBuilding}
              itemCount={filteredProjectBuildings.length}
              onNewItem={() => setIsBuildingModalOpen(true)}
              onDeleteItem={handleDeleteBuilding}
            />
            <ul className="space-y-2 list-none max-h-64 pr-2 overflow-y-auto" role="list"
                aria-label={t('columns.buildings.listLabel')} data-navigation-scroll="true">
              {filteredProjectBuildings.map(building => {
                const propertyCount = getPropertyCount(building.id);
                const hasProperties = propertyCount > 0;
                return (
                  <li key={building.id}>
                    <NavigationButton
                      onClick={() => onBuildingSelect(building.id)}
                      icon={NAVIGATION_ENTITIES.building.icon}
                      iconColor={NAVIGATION_ENTITIES.building.color}
                      title={building.name}
                      subtitle={t('columns.buildings.propertyCount', { count: propertyCount })}
                      isSelected={selectedBuilding?.id === building.id}
                      variant="compact"
                      badgeStatus={!hasProperties ? 'no_projects' : undefined}
                      badgeText={!hasProperties ? t(getNavigationFilterCategories().building_without_units) : undefined}
                      navigationHref={ContextualNavigationService.generateRoute('building', building.id, { action: 'select' })}
                      navigationTooltip={t('columns.buildings.openTooltip')}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Column 4: Building Spaces (Units / Storage / Parking) */}
        {selectedBuilding && (
          <BuildingSpacesTabs
            units={buildingProperties}
            storages={buildingStorages}
            parkingSpots={buildingParkingSpots}
            selectedItem={selectedBuildingSpace}
            onPropertySelect={handlePropertySelectFromTabs}
            onStorageSelect={handleStorageSelectFromTabs}
            onParkingSelect={handleParkingSelectFromTabs}
            onAddItem={(tab) => {
              if (tab === 'properties') setIsPropertyModalOpen(true);
            }}
            onUnlinkItem={(tab) => {
              if (tab === 'properties') handleDeleteProperty();
            }}
            defaultTab="properties"
          />
        )}

        {/* Column 5: Actions */}
        {selectedBuilding && (
          <section className="bg-white dark:bg-card border border-border rounded-lg p-3"
                   role="region" aria-label={t('columns.actions.sectionLabel')}>
            <header className="flex items-center gap-2 mb-4">
              <ActionsIcon className={`h-5 w-5 ${NAVIGATION_ACTIONS.actions.color}`} />
              <h3 className="font-semibold text-gray-900 dark:text-foreground">{t('columns.actions.title')}</h3>
            </header>
            <ul className="space-y-2 list-none" role="list" aria-label={t('columns.actions.listLabel')}>
              <li>
                <NavigationButton
                  onClick={() => onNavigateToPage('properties')}
                  icon={NAVIGATION_ENTITIES.property.icon}
                  iconColor={NAVIGATION_ENTITIES.property.color}
                  title={t('columns.actions.viewProperties')}
                  subtitle={t('columns.actions.propertiesCount', { count: buildingProperties.length })}
                  variant="compact"
                />
              </li>
              <li>
                <NavigationButton
                  onClick={() => onNavigateToPage('buildings')}
                  icon={NAVIGATION_ENTITIES.building.icon}
                  iconColor={NAVIGATION_ENTITIES.building.color}
                  title={t('columns.actions.buildingDetails')}
                  subtitle={selectedBuilding.name}
                  variant="compact"
                />
              </li>
              {selectedProject && (
                <li>
                  <NavigationButton
                    onClick={() => onNavigateToPage('projects')}
                    icon={NAVIGATION_ENTITIES.project.icon}
                    iconColor={NAVIGATION_ENTITIES.project.color}
                    title={t('columns.actions.projectDetails')}
                    subtitle={selectedProject.name}
                    variant="compact"
                  />
                </li>
              )}
            </ul>
          </section>
        )}

      </section>

      {/* All dialogs and modals */}
      <DesktopNavDialogs
        confirmDialogOpen={confirmDialogOpen}
        onConfirmDialogChange={setConfirmDialogOpen}
        pendingDeletionCompany={pendingDeletionCompany}
        onClearPendingCompany={() => setPendingDeletionCompany(null)}
        onConfirmCompanyDeletion={handleConfirmedCompanyDeletion}
        projectDialogOpen={projectDialogOpen}
        onProjectDialogChange={setProjectDialogOpen}
        pendingUnlinkProject={pendingUnlinkProject}
        onClearPendingProject={() => setPendingUnlinkProject(null)}
        onConfirmProjectUnlink={handleConfirmedProjectUnlink}
        buildingDialogOpen={buildingDialogOpen}
        onBuildingDialogChange={setBuildingDialogOpen}
        pendingUnlinkBuilding={pendingUnlinkBuilding}
        onClearPendingBuilding={() => setPendingUnlinkBuilding(null)}
        onConfirmBuildingUnlink={handleConfirmedBuildingUnlink}
        propertyDialogOpen={propertyDialogOpen}
        onPropertyDialogChange={setPropertyDialogOpen}
        pendingUnlinkProperty={pendingUnlinkProperty}
        onClearPendingProperty={() => setPendingUnlinkProperty(null)}
        onConfirmPropertyUnlink={handleConfirmedPropertyUnlink}
        isProjectModalOpen={isProjectModalOpen}
        onProjectModalChange={setIsProjectModalOpen}
        onProjectSelected={handleProjectSelected}
        availableProjects={AVAILABLE_PROJECTS}
        selectedCompanyName={selectedCompany?.companyName}
        isBuildingModalOpen={isBuildingModalOpen}
        onBuildingModalChange={setIsBuildingModalOpen}
        onBuildingSelected={handleBuildingSelected}
        availableBuildings={availableBuildings}
        selectedProjectName={selectedProject?.name}
        isPropertyModalOpen={isPropertyModalOpen}
        onPropertyModalChange={setIsPropertyModalOpen}
        onPropertySelected={handlePropertySelected}
        availableUnits={AVAILABLE_UNITS}
        selectedBuildingName={selectedBuilding?.name}
      />
    </nav>
  );
}
