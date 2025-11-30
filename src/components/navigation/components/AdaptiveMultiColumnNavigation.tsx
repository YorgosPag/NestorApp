'use client';

/**
 * Adaptive Multi-Column Navigation Component
 * Desktop: Multi-column layout (Finder-style)
 * Mobile: Drill-down navigation with back stack
 */
import React, { useState, useEffect } from 'react';
import { useNavigation } from '../core/NavigationContext';
import { NavigationButton } from './NavigationButton';
import { ChevronLeft, ChevronRight, MapPin, Home, Building, Users, Package, Car, Factory, Construction, Layers, Map, FileText, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { SelectCompanyContactModal } from '../dialogs/SelectCompanyContactModal';
import type { Contact } from '@/types/contacts';
import { addCompanyToNavigation, getNavigationCompanyIds } from '@/services/navigation-companies.service';

interface AdaptiveMultiColumnNavigationProps {
  className?: string;
}

export function AdaptiveMultiColumnNavigation({ className }: AdaptiveMultiColumnNavigationProps) {
  const router = useRouter();
  const {
    companies,
    selectedCompany,
    projects,
    selectedProject,
    selectedBuilding,
    selectedFloor,
    currentLevel,
    loading,
    projectsLoading,
    error,
    selectCompany,
    selectProject,
    selectBuilding,
    selectFloor,
    navigateToLevel,
    navigateToExistingPages
  } = useNavigation();

  // Mobile navigation stack
  const [mobileLevel, setMobileLevel] = useState<'companies' | 'projects' | 'buildings' | 'floors' | 'units' | 'extras'>('companies');

  // Modal state για επαφές
  const [isContactsModalOpen, setIsContactsModalOpen] = useState(false);

  // State για να κρατούμε ποιες εταιρείες είναι navigation companies
  const [navigationCompanyIds, setNavigationCompanyIds] = useState<string[]>([]);

  // Φορτώνουμε τα navigation company IDs όταν φορτώνουν οι εταιρείες
  useEffect(() => {
    const loadNavigationIds = async () => {
      try {
        const ids = await getNavigationCompanyIds();
        setNavigationCompanyIds(ids);
        console.log('📍 Navigation company IDs loaded:', ids);
      } catch (error) {
        console.error('Error loading navigation company IDs:', error);
      }
    };

    if (companies.length > 0) {
      loadNavigationIds();
    }
  }, [companies]);

  // Handler για επιλογή εταιρείας από επαφές
  const handleCompanySelected = async (contact: Contact) => {
    console.log('Selected company contact:', contact);

    if (!contact.id) {
      console.error('Contact ID is missing');
      return;
    }

    try {
      // Προσθήκη εταιρείας στην πλοήγηση
      await addCompanyToNavigation(contact.id);

      // Ενημέρωση local state αντί για full refresh
      setNavigationCompanyIds(prev => [...prev, contact.id!]);

      // Απλά κλείνουμε το modal - το context θα ανανεωθεί αυτόματα
      // όταν χρησιμοποιηθεί το getNavigationCompanyIds στο companies.service

      console.log(`✅ Εταιρεία "${contact.companyName}" προστέθηκε στην πλοήγηση!`);
    } catch (error) {
      console.error('Error adding company to navigation:', error);

      // Αν αποτύχει, κάνουμε fallback στο refresh
      console.log('Falling back to page refresh...');
      window.location.reload();
    }
  };

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // Navigation handlers
  const handleCompanySelect = (companyId: string) => {
    selectCompany(companyId);
    if (isMobile) setMobileLevel('projects');
  };

  const handleProjectSelect = (projectId: string) => {
    selectProject(projectId);
    if (isMobile) setMobileLevel('buildings');
  };

  const handleBuildingSelect = (buildingId: string) => {
    selectBuilding(buildingId);
    if (isMobile) setMobileLevel('floors');
  };

  const handleFloorSelect = (floorId: string) => {
    selectFloor(floorId);
    if (isMobile) setMobileLevel('units');
  };

  const handleNavigateToPage = (type: 'properties' | 'projects' | 'buildings' | 'floorplan') => {
    navigateToExistingPages(type);
  };

  // Mobile back navigation
  const handleMobileBack = () => {
    switch (mobileLevel) {
      case 'projects':
        setMobileLevel('companies');
        break;
      case 'buildings':
        setMobileLevel('projects');
        break;
      case 'floors':
        setMobileLevel('buildings');
        break;
      case 'units':
        setMobileLevel('floors');
        break;
      case 'extras':
        setMobileLevel('units');
        break;
    }
  };

  // Get current title for mobile
  const getMobileTitle = () => {
    switch (mobileLevel) {
      case 'companies': return 'Εταιρείες';
      case 'projects': return selectedCompany?.companyName || 'Έργα';
      case 'buildings': return selectedProject?.name || 'Κτίρια';
      case 'floors': return selectedBuilding?.name || 'Όροφοι';
      case 'units': return selectedFloor?.name || 'Μονάδες';
      case 'extras': return 'Παρκινγκ & Αποθήκες';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500 dark:text-red-400 mb-4">Σφάλμα: {error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
        >
          Ξαναδοκιμή
        </button>
      </div>
    );
  }

  return (
    <div className={`${className || ''}`}>
      {/* Mobile Navigation */}
      <div className="md:hidden">
        {/* Mobile Header */}
        <div className="flex items-center justify-between mb-4">
          {mobileLevel !== 'companies' && (
            <button
              onClick={handleMobileBack}
              className="flex items-center gap-2 px-3 py-2 text-blue-600 hover:text-blue-700"
            >
              <ChevronLeft className="h-4 w-4" />
              Πίσω
            </button>
          )}
          <h3 className="text-lg font-semibold text-gray-900 dark:text-foreground">
            {getMobileTitle()}
          </h3>
          <div className="w-16"></div> {/* Spacer */}
        </div>

        {/* Mobile Content */}
        <div className="space-y-2">
          {/* Companies */}
          {mobileLevel === 'companies' && (
            <>
              {companies.map(company => {
                // Ελέγχουμε αν η εταιρεία έχει έργα
                const companyProjects = projects.filter(p => p.companyId === company.id);
                const hasProjects = companyProjects.length > 0;

                // Ελέγχουμε αν είναι navigation company (προστέθηκε χειροκίνητα)
                const isNavigationCompany = navigationCompanyIds.includes(company.id);

                // Διαφοροποίηση ανάλογα με το αν έχει έργα ή είναι navigation company
                let subtitle = company.industry || 'Εταιρεία';
                let extraInfo = company.vatNumber ? `ΑΦΜ: ${company.vatNumber}` : undefined;

                if (!hasProjects) {
                  subtitle = isNavigationCompany
                    ? 'Προσθέστε έργα για αυτή την εταιρεία'
                    : 'Εταιρεία χωρίς έργα';
                  extraInfo = company.vatNumber ? `ΑΦΜ: ${company.vatNumber}` : undefined;
                }

                return (
                  <NavigationButton
                    key={company.id}
                    onClick={() => handleCompanySelect(company.id)}
                    icon={Factory}
                    title={company.companyName}
                    subtitle={subtitle}
                    extraInfo={extraInfo}
                    hasWarning={!projectsLoading && !hasProjects}
                    warningText="Χωρίς έργα"
                  />
                );
              })}
            </>
          )}

          {/* Projects */}
          {mobileLevel === 'projects' && selectedCompany && (
            <>
              {projects.filter(project => project.companyId === selectedCompany.id).map(project => (
                <NavigationButton
                  key={project.id}
                  onClick={() => handleProjectSelect(project.id)}
                  icon={Construction}
                  title={project.name}
                  subtitle={`${project.buildings.length} κτίρια`}
                />
              ))}
            </>
          )}

          {/* Buildings */}
          {mobileLevel === 'buildings' && selectedProject && (
            <>
              {selectedProject.buildings.map(building => (
                <NavigationButton
                  key={building.id}
                  onClick={() => handleBuildingSelect(building.id)}
                  icon={Building}
                  title={building.name}
                  subtitle={`${building.floors.length} όροφοι`}
                />
              ))}
            </>
          )}

          {/* Floors */}
          {mobileLevel === 'floors' && selectedBuilding && (
            <>
              {selectedBuilding.floors.map(floor => (
                <NavigationButton
                  key={floor.id}
                  onClick={() => handleFloorSelect(floor.id)}
                  icon={Layers}
                  title={floor.name}
                  subtitle={`${floor.units.length} μονάδες`}
                />
              ))}
            </>
          )}

          {/* Units & Actions */}
          {mobileLevel === 'units' && selectedFloor && (
            <div className="space-y-3">
              <NavigationButton
                onClick={() => handleNavigateToPage('properties')}
                icon={Home}
                title="Προβολή Μονάδων"
                subtitle={`${selectedFloor.units.length} μονάδες σε αυτόν τον όροφο`}
                variant="compact"
              />

              <NavigationButton
                onClick={() => handleNavigateToPage('floorplan')}
                icon={Map}
                title="Κάτοψη Ορόφου"
                subtitle="Προβολή της κάτοψης με όλες τις μονάδες"
                variant="compact"
              />

              {selectedProject && (
                <NavigationButton
                  onClick={() => handleNavigateToPage('projects')}
                  icon={Construction}
                  title="Λεπτομέρειες Έργου"
                  subtitle={selectedProject.name}
                  variant="compact"
                />
              )}

              {selectedBuilding && (
                <NavigationButton
                  onClick={() => handleNavigateToPage('buildings')}
                  icon={Building}
                  title="Λεπτομέρειες Κτιρίου"
                  subtitle={selectedBuilding.name}
                  variant="compact"
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Desktop Multi-Column Navigation */}
      <div className="hidden md:block">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">

          {/* Column 1: Companies */}
          <div className="bg-white dark:bg-card border border-gray-200 dark:border-gray-700 rounded-lg p-3">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Building className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold text-gray-900 dark:text-foreground">Εταιρείες</h3>
              </div>
              <button
                onClick={() => setIsContactsModalOpen(true)}
                className="flex items-center gap-1 px-2 py-1 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                title="Προσθήκη νέας εταιρείας από επαφές"
              >
                <Plus className="h-4 w-4" />
                Προσθήκη
              </button>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {companies.map(company => {
                // Ελέγχουμε αν η εταιρεία έχει έργα
                const companyProjects = projects.filter(p => p.companyId === company.id);
                const hasProjects = companyProjects.length > 0;

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
                    onClick={() => handleCompanySelect(company.id)}
                    icon={Factory}
                    title={company.companyName}
                    subtitle={subtitle}
                    extraInfo={extraInfo}
                    isSelected={selectedCompany?.id === company.id}
                    variant="compact"
                    hasWarning={!projectsLoading && !hasProjects}
                    warningText="Χωρίς έργα"
                  />
                );
              })}
            </div>
          </div>

          {/* Column 2: Projects */}
          {selectedCompany && (
            <div className="bg-white dark:bg-card border border-gray-200 dark:border-gray-700 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-4">
                <Home className="h-5 w-5 text-green-600" />
                <h3 className="font-semibold text-gray-900 dark:text-foreground">Έργα</h3>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {projects.filter(project => project.companyId === selectedCompany?.id).map(project => (
                  <NavigationButton
                    key={project.id}
                    onClick={() => handleProjectSelect(project.id)}
                    icon={Construction}
                    title={project.name}
                    subtitle={`${project.buildings.length} κτίρια`}
                    isSelected={selectedProject?.id === project.id}
                    variant="compact"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Column 3: Buildings */}
          {selectedProject && (
            <div className="bg-white dark:bg-card border border-gray-200 dark:border-gray-700 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-4">
                <Building className="h-5 w-5 text-purple-600" />
                <h3 className="font-semibold text-gray-900 dark:text-foreground">Κτίρια</h3>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {selectedProject.buildings.map(building => (
                  <NavigationButton
                    key={building.id}
                    onClick={() => handleBuildingSelect(building.id)}
                    icon={Building}
                    title={building.name}
                    subtitle={`${building.floors.length} όροφοι`}
                    isSelected={selectedBuilding?.id === building.id}
                    variant="compact"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Column 4: Floors */}
          {selectedBuilding && (
            <div className="bg-white dark:bg-card border border-gray-200 dark:border-gray-700 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-4">
                <Users className="h-5 w-5 text-orange-600" />
                <h3 className="font-semibold text-gray-900 dark:text-foreground">Όροφοι</h3>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {selectedBuilding.floors.map(floor => (
                  <NavigationButton
                    key={floor.id}
                    onClick={() => handleFloorSelect(floor.id)}
                    icon={Layers}
                    title={floor.name}
                    subtitle={`${floor.units.length} μονάδες`}
                    isSelected={selectedFloor?.id === floor.id}
                    variant="compact"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Column 5: Actions & Extras */}
          {selectedFloor && (
            <div className="bg-white dark:bg-card border border-gray-200 dark:border-gray-700 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="h-5 w-5 text-red-600" />
                <h3 className="font-semibold text-gray-900 dark:text-foreground">Ενέργειες</h3>
              </div>
              <div className="space-y-2">
                <NavigationButton
                  onClick={() => handleNavigateToPage('properties')}
                  icon={Home}
                  title="Προβολή Μονάδων"
                  subtitle={`${selectedFloor.units.length} μονάδες`}
                  variant="compact"
                />

                <NavigationButton
                  onClick={() => handleNavigateToPage('floorplan')}
                  icon={Map}
                  title="Κάτοψη Ορόφου"
                  subtitle="Διαδραστική προβολή"
                  variant="compact"
                />

                {selectedProject && (
                  <NavigationButton
                    onClick={() => handleNavigateToPage('projects')}
                    icon={Construction}
                    title="Λεπτομέρειες Έργου"
                    subtitle={selectedProject.name}
                    variant="compact"
                  />
                )}

                {selectedBuilding && (
                  <NavigationButton
                    onClick={() => handleNavigateToPage('buildings')}
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
      </div>

      {/* Modal για επιλογή εταιρείας από επαφές */}
      <SelectCompanyContactModal
        open={isContactsModalOpen}
        onOpenChange={setIsContactsModalOpen}
        onCompanySelected={handleCompanySelected}
      />
    </div>
  );
}

export default AdaptiveMultiColumnNavigation;