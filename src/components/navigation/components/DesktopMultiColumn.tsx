'use client';

/**
 * Desktop Multi-Column Navigation Component
 * Finder-style multi-column layout for desktop navigation
 */

import React, { useState } from 'react';
import { useNotifications } from '@/providers/NotificationProvider';
import { NavigationButton } from './NavigationButton';
import { NavigationCardToolbar } from './NavigationCardToolbar';
import { SelectItemModal } from '../dialogs/SelectItemModal';
import { Building, Home, Construction, Users, MapPin, Map, Car, Package, Layers, Factory } from 'lucide-react';
import { useNavigation } from '../core/NavigationContext';

interface DesktopMultiColumnProps {
  onCompanySelect: (companyId: string) => void;
  onProjectSelect: (projectId: string) => void;
  onBuildingSelect: (buildingId: string) => void;
  onFloorSelect: (floorId: string) => void;
  onNavigateToPage: (type: 'properties' | 'projects' | 'buildings' | 'floorplan') => void;
  onAddCompanyClick: () => void;
  navigationCompanyIds: string[];
}

export function DesktopMultiColumn({
  onCompanySelect,
  onProjectSelect,
  onBuildingSelect,
  onFloorSelect,
  onNavigateToPage,
  onAddCompanyClick,
  navigationCompanyIds
}: DesktopMultiColumnProps) {
  const {
    companies,
    projects,
    selectedCompany,
    selectedProject,
    selectedBuilding,
    selectedFloor,
    projectsLoading
  } = useNavigation();

  const { warning } = useNotifications();

  // Toolbar states for each column
  const [companiesSearch, setCompaniesSearch] = useState('');
  const [companiesFilters, setCompaniesFilters] = useState<string[]>([]);
  const [projectsSearch, setProjectsSearch] = useState('');
  const [projectsFilters, setProjectsFilters] = useState<string[]>([]);
  const [buildingsSearch, setBuildingsSearch] = useState('');
  const [buildingsFilters, setBuildingsFilters] = useState<string[]>([]);
  const [floorsSearch, setFloorsSearch] = useState('');
  const [floorsFilters, setFloorsFilters] = useState<string[]>([]);
  const [unitsSearch, setUnitsSearch] = useState('');
  const [unitsFilters, setUnitsFilters] = useState<string[]>([]);

  // Selected unit state for Units column
  const [selectedUnit, setSelectedUnit] = useState<any>(null);

  // Modal states for connection dialogs
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isBuildingModalOpen, setIsBuildingModalOpen] = useState(false);
  const [isFloorModalOpen, setIsFloorModalOpen] = useState(false);
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);

  // Clear selectedUnit when selectedFloor changes
  React.useEffect(() => {
    setSelectedUnit(null);
  }, [selectedFloor]);

  // Mock data for available items to connect (in real app, this would come from APIs)
  const availableProjects = [
    { id: 'proj_1', name: 'Νέο Έργο Αθήνας', subtitle: 'Διαθέσιμο για σύνδεση' },
    { id: 'proj_2', name: 'Κτίριο Γραφείων Πειραιά', subtitle: 'Διαθέσιμο για σύνδεση' },
    { id: 'proj_3', name: 'Οικιστικό Συγκρότημα', subtitle: 'Διαθέσιμο για σύνδεση' },
  ];

  const availableBuildings = [
    { id: 'build_1', name: 'Κτίριο A', subtitle: 'Διαθέσιμο για σύνδεση' },
    { id: 'build_2', name: 'Κτίριο B', subtitle: 'Διαθέσιμο για σύνδεση' },
    { id: 'build_3', name: 'Κεντρικό Κτίριο', subtitle: 'Διαθέσιμο για σύνδεση' },
  ];

  const availableFloors = [
    { id: 'floor_1', name: 'Ισόγειο', subtitle: 'Διαθέσιμο για σύνδεση' },
    { id: 'floor_2', name: '1ος Όροφος', subtitle: 'Διαθέσιμο για σύνδεση' },
    { id: 'floor_3', name: '2ος Όροφος', subtitle: 'Διαθέσιμο για σύνδεση' },
    { id: 'floor_4', name: 'Υπόγειο', subtitle: 'Διαθέσιμο για σύνδεση' },
  ];

  const availableUnits = [
    { id: 'unit_1', name: 'Διαμέρισμα 1.1', subtitle: 'Διαθέσιμο για σύνδεση' },
    { id: 'unit_2', name: 'Διαμέρισμα 1.2', subtitle: 'Διαθέσιμο για σύνδεση' },
    { id: 'unit_3', name: 'Γραφείο Α1', subtitle: 'Διαθέσιμο για σύνδεση' },
    { id: 'unit_4', name: 'Αποθήκη', subtitle: 'Διαθέσιμο για σύνδεση' },
  ];

  // Helper function to filter data based on search and filters
  const filterData = <T extends { companyName?: string; name?: string; industry?: string }>(
    data: T[],
    searchTerm: string,
    activeFilters: string[]
  ): T[] => {
    return data.filter(item => {
      // Search filter
      const searchMatch = !searchTerm ||
        (item.companyName?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.name?.toLowerCase().includes(searchTerm.toLowerCase()));

      // Active filters - simplified for now
      const filterMatch = activeFilters.length === 0 || true; // TODO: implement proper filtering

      return searchMatch && filterMatch;
    });
  };

  // Helper functions for dependency checking and deletion
  const canDeleteCompany = (company: any) => {
    const companyProjects = projects.filter(p => p.companyId === company.id);
    return companyProjects.length === 0;
  };

  const canDeleteProject = (project: any) => {
    return project.buildings.length === 0;
  };

  const canDeleteBuilding = (building: any) => {
    return building.floors.length === 0;
  };

  const canDeleteFloor = (floor: any) => {
    return floor.units.length === 0;
  };

  const showDeleteWarning = (itemType: string, dependentCount: number, dependentType: string) => {
    let action: string;
    let dependentAction: string;

    // Για την κύρια ενέργεια (τι θέλω να κάνω)
    if (itemType === 'εταιρεία') {
      action = 'αφαιρέσετε';
    } else {
      action = 'αποσυνδέσετε';
    }

    // Για την ενέργεια στα εξαρτημένα στοιχεία (τι πρέπει να κάνω πρώτα)
    if (dependentType === 'έργα') {
      // Τα έργα αποσυνδέονται από την εταιρεία
      dependentAction = 'αποσυνδέσετε';
    } else if (dependentType === 'κτίρια') {
      // Τα κτίρια αποσυνδέονται από το έργο
      dependentAction = 'αποσυνδέσετε';
    } else if (dependentType === 'όροφοι') {
      // Οι όροφοι αποσυνδέονται από το κτίριο
      dependentAction = 'αποσυνδέσετε';
    } else if (dependentType === 'μονάδες') {
      // Οι μονάδες αποσυνδέονται από τον όροφο
      dependentAction = 'αποσυνδέσετε';
    } else {
      dependentAction = 'αποσυνδέσετε';
    }

    // Κλίνω το gender για την/το/τον
    let article: string;
    if (itemType === 'εταιρεία') {
      article = 'αυτή την';
    } else if (itemType === 'έργο') {
      article = 'αυτό το';
    } else if (itemType === 'κτίριο') {
      article = 'αυτό το';
    } else if (itemType === 'όροφο') {
      article = 'αυτόν τον';
    } else {
      article = 'αυτή τη';
    }

    warning(`Δεν μπορείτε να ${action} ${article} ${itemType} γιατί έχει ${dependentCount} ${dependentType}. Παρακαλούμε ${dependentAction} πρώτα τα ${dependentType}.`, {
      duration: 5000
    });
  };

  const handleDeleteCompany = () => {
    if (!selectedCompany) return;

    if (canDeleteCompany(selectedCompany)) {
      console.log('🗑️ Deleting company:', selectedCompany.companyName);
      // TODO: Implement actual deletion logic
    } else {
      const companyProjects = projects.filter(p => p.companyId === selectedCompany.id);
      showDeleteWarning('εταιρεία', companyProjects.length, 'έργα');
    }
  };

  const handleDeleteProject = () => {
    if (!selectedProject) return;

    if (canDeleteProject(selectedProject)) {
      console.log('🗑️ Deleting project:', selectedProject.name);
      // TODO: Implement actual deletion logic
    } else {
      showDeleteWarning('έργο', selectedProject.buildings.length, 'κτίρια');
    }
  };

  const handleDeleteBuilding = () => {
    if (!selectedBuilding) return;

    if (canDeleteBuilding(selectedBuilding)) {
      console.log('🗑️ Deleting building:', selectedBuilding.name);
      // TODO: Implement actual deletion logic
    } else {
      showDeleteWarning('κτίριο', selectedBuilding.floors.length, 'όροφοι');
    }
  };

  const handleDeleteFloor = () => {
    if (!selectedFloor) return;

    if (canDeleteFloor(selectedFloor)) {
      console.log('🗑️ Deleting floor:', selectedFloor.name);
      // TODO: Implement actual deletion logic
    } else {
      showDeleteWarning('όροφο', selectedFloor.units.length, 'μονάδες');
    }
  };

  const handleDeleteUnit = () => {
    if (!selectedUnit) return;

    console.log('🗑️ Deleting unit:', selectedUnit.name);
    // Units can always be deleted as they have no dependencies
    // TODO: Implement actual deletion logic

    // Clear selection after deletion
    setSelectedUnit(null);
  };

  // Handlers for connecting items
  const handleProjectSelected = (project: any) => {
    console.log('🔗 Connecting project to company:', project.name, 'to', selectedCompany?.companyName);
    // TODO: Implement actual connection logic
  };

  const handleBuildingSelected = (building: any) => {
    console.log('🔗 Connecting building to project:', building.name, 'to', selectedProject?.name);
    // TODO: Implement actual connection logic
  };

  const handleFloorSelected = (floor: any) => {
    console.log('🔗 Connecting floor to building:', floor.name, 'to', selectedBuilding?.name);
    // TODO: Implement actual connection logic
  };

  const handleUnitSelected = (unit: any) => {
    console.log('🔗 Connecting unit to floor:', unit.name, 'to', selectedFloor?.name);
    // TODO: Implement actual connection logic
  };

  return (
    <div className="hidden md:block">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 gap-4">

        {/* Column 1: Companies */}
        <div className="bg-white dark:bg-card border border-gray-200 dark:border-gray-700 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Building className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900 dark:text-foreground">Εταιρείες</h3>
          </div>

          {/* Companies Toolbar */}
          <NavigationCardToolbar
            level="companies"
            searchTerm={companiesSearch}
            onSearchChange={setCompaniesSearch}
            activeFilters={companiesFilters}
            onFiltersChange={setCompaniesFilters}
            hasSelectedItems={!!selectedCompany}
            onNewItem={onAddCompanyClick}
            onEditItem={() => console.log('Edit company')}
            onDeleteItem={handleDeleteCompany}
            onRefresh={() => console.log('Refresh companies')}
            onExport={() => console.log('Export companies')}
            onImport={() => console.log('Import companies')}
            onSettings={() => console.log('Companies settings')}
            onReports={() => console.log('Companies reports')}
            onShare={() => console.log('Share companies')}
            onHelp={() => console.log('Companies help')}
          />

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {filterData(companies, companiesSearch, companiesFilters).map(company => {
              // Ελέγχουμε αν η εταιρεία έχει έργα
              const companyProjects = projects.filter(p => p.companyId === company.id);
              const hasProjects = companyProjects.length > 0;

              console.log(`🔍 Company "${company.companyName}" (ID: ${company.id}):`,
                `Total projects available: ${projects.length}`,
                `Company projects: ${companyProjects.length}`,
                `Has projects: ${hasProjects}`);

              // Ελέγχουμε αν είναι navigation company (προστέθηκε χειροκίνητα)
              const isNavigationCompany = navigationCompanyIds.includes(company.id);

              // Διαφοροποίηση ανάλογα με το αν έχει έργα ή είναι navigation company
              let subtitle = company.industry || 'Εταιρεία';
              let extraInfo: string | undefined = undefined;

              if (!hasProjects) {
                subtitle = isNavigationCompany
                  ? 'Προσθέστε έργα για αυτή την εταιρεία'
                  : 'Εταιρεία χωρίς έργα';
                extraInfo = company.vatNumber ? `ΑΦΜ: ${company.vatNumber}` : undefined;
              }

              return (
                <NavigationButton
                  key={company.id}
                  onClick={() => onCompanySelect(company.id)}
                  icon={Factory}
                  title={company.companyName}
                  subtitle={subtitle}
                  extraInfo={extraInfo}
                  isSelected={selectedCompany?.id === company.id}
                  variant="compact"
                  badgeStatus={!projectsLoading && !hasProjects ? 'no_projects' : undefined}
                  badgeText={!projectsLoading && !hasProjects ? 'Χωρίς έργα' : undefined}
                />
              );
            })}
          </div>
        </div>

        {/* Column 2: Projects */}
        {selectedCompany && (
          <div className="bg-white dark:bg-card border border-gray-200 dark:border-gray-700 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Home className="h-5 w-5 text-green-600" />
              <h3 className="font-semibold text-gray-900 dark:text-foreground">Έργα</h3>
            </div>

            {/* Projects Toolbar */}
            <NavigationCardToolbar
              level="projects"
              searchTerm={projectsSearch}
              onSearchChange={setProjectsSearch}
              activeFilters={projectsFilters}
              onFiltersChange={setProjectsFilters}
              hasSelectedItems={!!selectedProject}
              onNewItem={() => setIsProjectModalOpen(true)}
              onEditItem={() => console.log('Edit project')}
              onDeleteItem={handleDeleteProject}
              onRefresh={() => console.log('Refresh projects')}
              onExport={() => console.log('Export projects')}
              onSettings={() => console.log('Projects settings')}
              onReports={() => console.log('Projects reports')}
              onShare={() => console.log('Share projects')}
              onHelp={() => console.log('Projects help')}
            />

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filterData(projects.filter(project => project.companyId === selectedCompany?.id), projectsSearch, projectsFilters).map(project => {
                // Ελέγχουμε αν το έργο έχει κτίρια
                const hasBuildings = project.buildings.length > 0;

                return (
                  <NavigationButton
                    key={project.id}
                    onClick={() => onProjectSelect(project.id)}
                    icon={Construction}
                    title={project.name}
                    subtitle={`${project.buildings.length} κτίρια`}
                    isSelected={selectedProject?.id === project.id}
                    variant="compact"
                    badgeStatus={!hasBuildings ? 'no_projects' : undefined}
                    badgeText={!hasBuildings ? 'Χωρίς κτίρια' : undefined}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Column 3: Buildings */}
        {selectedProject && (
          <div className="bg-white dark:bg-card border border-gray-200 dark:border-gray-700 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Building className="h-5 w-5 text-purple-600" />
              <h3 className="font-semibold text-gray-900 dark:text-foreground">Κτίρια</h3>
            </div>

            {/* Buildings Toolbar */}
            <NavigationCardToolbar
              level="buildings"
              searchTerm={buildingsSearch}
              onSearchChange={setBuildingsSearch}
              activeFilters={buildingsFilters}
              onFiltersChange={setBuildingsFilters}
              hasSelectedItems={!!selectedBuilding}
              onNewItem={() => setIsBuildingModalOpen(true)}
              onEditItem={() => console.log('Edit building')}
              onDeleteItem={handleDeleteBuilding}
              onRefresh={() => console.log('Refresh buildings')}
              onExport={() => console.log('Export buildings')}
              onSettings={() => console.log('Buildings settings')}
              onReports={() => console.log('Buildings reports')}
              onHelp={() => console.log('Buildings help')}
            />

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filterData(selectedProject.buildings, buildingsSearch, buildingsFilters).map(building => {
                // Ελέγχουμε αν το κτίριο έχει ορόφους
                const hasFloors = building.floors.length > 0;

                return (
                  <NavigationButton
                    key={building.id}
                    onClick={() => onBuildingSelect(building.id)}
                    icon={Building}
                    title={building.name}
                    subtitle={`${building.floors.length} όροφοι`}
                    isSelected={selectedBuilding?.id === building.id}
                    variant="compact"
                    badgeStatus={!hasFloors ? 'no_projects' : undefined}
                    badgeText={!hasFloors ? 'Χωρίς ορόφους' : undefined}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Column 4: Floors */}
        {selectedBuilding && (
          <div className="bg-white dark:bg-card border border-gray-200 dark:border-gray-700 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-5 w-5 text-orange-600" />
              <h3 className="font-semibold text-gray-900 dark:text-foreground">Όροφοι</h3>
            </div>

            {/* Floors Toolbar */}
            <NavigationCardToolbar
              level="floors"
              searchTerm={floorsSearch}
              onSearchChange={setFloorsSearch}
              activeFilters={floorsFilters}
              onFiltersChange={setFloorsFilters}
              hasSelectedItems={!!selectedFloor}
              onNewItem={() => setIsFloorModalOpen(true)}
              onEditItem={() => console.log('Edit floor')}
              onDeleteItem={handleDeleteFloor}
              onRefresh={() => console.log('Refresh floors')}
              onExport={() => console.log('Export floors')}
              onSettings={() => console.log('Floors settings')}
              onReports={() => console.log('Floors reports')}
              onHelp={() => console.log('Floors help')}
            />

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filterData(selectedBuilding.floors, floorsSearch, floorsFilters).map(floor => {
                // Ελέγχουμε αν ο όροφος έχει μονάδες
                const hasUnits = floor.units.length > 0;

                return (
                  <NavigationButton
                    key={floor.id}
                    onClick={() => onFloorSelect(floor.id)}
                    icon={Layers}
                    title={floor.name}
                    subtitle={`${floor.units.length} μονάδες`}
                    isSelected={selectedFloor?.id === floor.id}
                    variant="compact"
                    badgeStatus={!hasUnits ? 'no_projects' : undefined}
                    badgeText={!hasUnits ? 'Χωρίς μονάδες' : undefined}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Column 5: Units */}
        {selectedFloor && (
          <div className="bg-white dark:bg-card border border-gray-200 dark:border-gray-700 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Home className="h-5 w-5 text-teal-600" />
              <h3 className="font-semibold text-gray-900 dark:text-foreground">Μονάδες</h3>
            </div>

            {/* Units Toolbar */}
            <NavigationCardToolbar
              level="units"
              searchTerm={unitsSearch}
              onSearchChange={setUnitsSearch}
              activeFilters={unitsFilters}
              onFiltersChange={setUnitsFilters}
              hasSelectedItems={!!selectedUnit}
              onNewItem={() => setIsUnitModalOpen(true)}
              onEditItem={() => console.log('Edit unit')}
              onDeleteItem={handleDeleteUnit}
              onRefresh={() => console.log('Refresh units')}
              onExport={() => console.log('Export units')}
              onSettings={() => console.log('Units settings')}
              onReports={() => console.log('Units reports')}
              onHelp={() => console.log('Units help')}
            />

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filterData(selectedFloor.units, unitsSearch, unitsFilters).map(unit => (
                <NavigationButton
                  key={unit.id}
                  onClick={() => {
                    console.log('Unit selected:', unit.id);
                    setSelectedUnit(unit);
                  }}
                  icon={Home}
                  title={unit.name}
                  subtitle={unit.type || 'Μονάδα'}
                  isSelected={selectedUnit?.id === unit.id}
                  variant="compact"
                />
              ))}
            </div>
          </div>
        )}

        {/* Column 6: Actions & Extras */}
        {selectedFloor && (
          <div className="bg-white dark:bg-card border border-gray-200 dark:border-gray-700 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="h-5 w-5 text-red-600" />
              <h3 className="font-semibold text-gray-900 dark:text-foreground">Ενέργειες</h3>
            </div>
            <div className="space-y-2">
              <NavigationButton
                onClick={() => onNavigateToPage('properties')}
                icon={Home}
                title="Προβολή Μονάδων"
                subtitle={`${selectedFloor.units.length} μονάδες`}
                variant="compact"
              />

              <NavigationButton
                onClick={() => onNavigateToPage('floorplan')}
                icon={Map}
                title="Κάτοψη Ορόφου"
                subtitle="Διαδραστική προβολή"
                variant="compact"
              />

              {selectedProject && (
                <NavigationButton
                  onClick={() => onNavigateToPage('projects')}
                  icon={Construction}
                  title="Λεπτομέρειες Έργου"
                  subtitle={selectedProject.name}
                  variant="compact"
                />
              )}

              {selectedBuilding && (
                <NavigationButton
                  onClick={() => onNavigateToPage('buildings')}
                  icon={Building}
                  title="Λεπτομέρειες Κτιρίου"
                  subtitle={selectedBuilding.name}
                  variant="compact"
                />
              )}

              {/* Parking & Storage */}
              <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="text-xs font-medium text-gray-500 dark:text-muted-foreground mb-2 uppercase tracking-wide">
                  Παρκινγκ & Αποθήκες
                </div>
                <NavigationButton
                  onClick={() => console.log('Parking spots')}
                  icon={Car}
                  title="Θέσεις Στάθμευσης"
                  subtitle="Διαθέσιμες θέσεις"
                  variant="compact"
                />

                <NavigationButton
                  onClick={() => console.log('Storage units')}
                  icon={Package}
                  title="Αποθήκες"
                  subtitle="Αποθηκευτικοί χώροι"
                  variant="compact"
                />
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Connection Modals */}
      <SelectItemModal
        open={isProjectModalOpen}
        onOpenChange={setIsProjectModalOpen}
        onItemSelected={handleProjectSelected}
        items={availableProjects}
        title="Σύνδεση Έργου"
        description={`Επιλέξτε ένα έργο για σύνδεση με την εταιρεία "${selectedCompany?.companyName}".`}
        searchPlaceholder="Αναζήτηση έργου..."
        itemType="project"
      />

      <SelectItemModal
        open={isBuildingModalOpen}
        onOpenChange={setIsBuildingModalOpen}
        onItemSelected={handleBuildingSelected}
        items={availableBuildings}
        title="Σύνδεση Κτιρίου"
        description={`Επιλέξτε ένα κτίριο για σύνδεση με το έργο "${selectedProject?.name}".`}
        searchPlaceholder="Αναζήτηση κτιρίου..."
        itemType="building"
      />

      <SelectItemModal
        open={isFloorModalOpen}
        onOpenChange={setIsFloorModalOpen}
        onItemSelected={handleFloorSelected}
        items={availableFloors}
        title="Σύνδεση Ορόφου"
        description={`Επιλέξτε έναν όροφο για σύνδεση με το κτίριο "${selectedBuilding?.name}".`}
        searchPlaceholder="Αναζήτηση ορόφου..."
        itemType="floor"
      />

      <SelectItemModal
        open={isUnitModalOpen}
        onOpenChange={setIsUnitModalOpen}
        onItemSelected={handleUnitSelected}
        items={availableUnits}
        title="Σύνδεση Μονάδας"
        description={`Επιλέξτε μια μονάδα για σύνδεση με τον όροφο "${selectedFloor?.name}".`}
        searchPlaceholder="Αναζήτηση μονάδας..."
        itemType="unit"
      />

    </div>
  );
}

export default DesktopMultiColumn;