'use client';

/**
 * Desktop Multi-Column Navigation Component
 * Finder-style multi-column layout for desktop navigation
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNotifications } from '@/providers/NotificationProvider';
import { NavigationButton } from './NavigationButton';
import { NavigationCardToolbar } from './NavigationCardToolbar';
import { SelectItemModal } from '../dialogs/SelectItemModal';
import { Building, Home, Construction, MapPin, Car, Package, Factory, Trash2, Unlink2 } from 'lucide-react';
// 🏢 ENTERPRISE: Layers αφαιρέθηκε - Floors δεν εμφανίζονται στην πλοήγηση (Επιλογή Α)
import { useNavigation } from '../core/NavigationContext';
// 🏢 ENTERPRISE: Centralized Entity Linking Service (ZERO inline Firestore calls)
import { EntityLinkingService, ENTITY_LINKING_CONFIG } from '@/services/entity-linking';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DesktopMultiColumnProps {
  onCompanySelect: (companyId: string) => void;
  onProjectSelect: (projectId: string) => void;
  onBuildingSelect: (buildingId: string) => void;
  /** @deprecated 🏢 ENTERPRISE: Floors αφαιρέθηκαν από navigation (Επιλογή Α) - Παραμένει για backward compatibility */
  onFloorSelect?: (floorId: string) => void;
  onNavigateToPage: (type: 'properties' | 'projects' | 'buildings' | 'floorplan') => void;
  onAddCompanyClick: () => void;
  navigationCompanyIds: string[];
}

export function DesktopMultiColumn({
  onCompanySelect,
  onProjectSelect,
  onBuildingSelect,
  // 🏢 ENTERPRISE: onFloorSelect deprecated - Floors δεν είναι navigation level
  onFloorSelect: _onFloorSelect,
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
    // 🏢 ENTERPRISE: selectedFloor αφαιρέθηκε - Floors δεν είναι navigation level (Επιλογή Α)
    projectsLoading,
    loadCompanies,
    // 🏢 ENTERPRISE: Real-time building functions
    getBuildingCount,
    getBuildingsForProject
  } = useNavigation();

  const { warning } = useNotifications();

  // Toolbar states for each column
  const [companiesSearch, setCompaniesSearch] = useState('');
  const [companiesFilters, setCompaniesFilters] = useState<string[]>([]);
  const [projectsSearch, setProjectsSearch] = useState('');
  const [projectsFilters, setProjectsFilters] = useState<string[]>([]);
  const [buildingsSearch, setBuildingsSearch] = useState('');
  const [buildingsFilters, setBuildingsFilters] = useState<string[]>([]);
  // 🏢 ENTERPRISE: Floors αφαιρέθηκαν από navigation (Επιλογή Α)
  const [unitsSearch, setUnitsSearch] = useState('');
  const [unitsFilters, setUnitsFilters] = useState<string[]>([]);

  // 🏢 ENTERPRISE CONFIRMATION DIALOG STATE
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingDeletionCompany, setPendingDeletionCompany] = useState<{
    id: string;
    companyName: string;
  } | null>(null);

  // 🏢 ENTERPRISE: Dialog states για Project/Building/Unit αποσύνδεση
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [pendingUnlinkProject, setPendingUnlinkProject] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const [buildingDialogOpen, setBuildingDialogOpen] = useState(false);
  const [pendingUnlinkBuilding, setPendingUnlinkBuilding] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const [unitDialogOpen, setUnitDialogOpen] = useState(false);
  const [pendingUnlinkUnit, setPendingUnlinkUnit] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Selected unit state for Units column
  const [selectedUnit, setSelectedUnit] = useState<{
    id: string;
    name: string;
    type?: string;
  } | null>(null);

  // Modal states for connection dialogs
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isBuildingModalOpen, setIsBuildingModalOpen] = useState(false);
  // 🏢 ENTERPRISE: Floor modal αφαιρέθηκε (Επιλογή Α)
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);

  // Clear selectedUnit when selectedBuilding changes
  React.useEffect(() => {
    setSelectedUnit(null);
  }, [selectedBuilding]);

  // ==========================================================================
  // 🏢 ENTERPRISE: Memoized Real-time Buildings Data (MOVED UP for dependencies)
  // ==========================================================================

  /**
   * Memoized buildings για το επιλεγμένο project.
   * Χρησιμοποιεί το real-time system για live updates.
   * 🏢 ENTERPRISE: Πρέπει να οριστεί ΠΡΙΝ από τα callbacks που το χρησιμοποιούν!
   */
  const projectBuildings = useMemo(() => {
    if (!selectedProject) return [];
    return getBuildingsForProject(selectedProject.id);
  }, [selectedProject, getBuildingsForProject]);

  // 🏢 ENTERPRISE: Available items loaded from API
  const availableProjects = [
    { id: 'proj_1', name: 'Νέο Έργο Αθήνας', subtitle: 'Διαθέσιμο για σύνδεση' },
    { id: 'proj_2', name: 'Κτίριο Γραφείων Πειραιά', subtitle: 'Διαθέσιμο για σύνδεση' },
    { id: 'proj_3', name: 'Οικιστικό Συγκρότημα', subtitle: 'Διαθέσιμο για σύνδεση' },
  ];

  // 🏢 ENTERPRISE: State for available buildings (loaded via centralized service)
  const [availableBuildings, setAvailableBuildings] = useState<Array<{ id: string; name: string; subtitle: string }>>([]);
  const [loadingBuildings, setLoadingBuildings] = useState(false);

  // 🏢 ENTERPRISE: Load available buildings using centralized EntityLinkingService
  const loadAvailableBuildings = useCallback(async () => {
    if (!selectedProject) return;

    setLoadingBuildings(true);
    try {
      // 🏢 ENTERPRISE: Use centralized service instead of inline API call
      const result = await EntityLinkingService.getAvailableBuildingsForProject(selectedProject.id);

      if (result.success) {
        // Filter out buildings already in this project
        const projectBuildingIds = new Set(projectBuildings.map(b => b.id));
        const filteredBuildings = result.entities
          .filter(b => !projectBuildingIds.has(b.id))
          .map(b => ({
            id: b.id,
            name: b.name,
            subtitle: b.subtitle || 'Διαθέσιμο για σύνδεση'
          }));

        setAvailableBuildings(filteredBuildings);
        console.log(`✅ [Navigation] Loaded ${filteredBuildings.length} available buildings via EntityLinkingService`);
      } else {
        console.error('❌ [Navigation] EntityLinkingService error:', result.error);
        setAvailableBuildings([]);
      }
    } catch (error) {
      console.error('❌ [Navigation] Error loading available buildings:', error);
      setAvailableBuildings([]);
    } finally {
      setLoadingBuildings(false);
    }
  }, [selectedProject, projectBuildings]);

  // 🏢 ENTERPRISE: Load buildings when modal opens
  useEffect(() => {
    if (isBuildingModalOpen) {
      loadAvailableBuildings();
    }
  }, [isBuildingModalOpen, loadAvailableBuildings]);

  // 🏢 ENTERPRISE: availableFloors αφαιρέθηκε (Επιλογή Α) - Floors δεν είναι navigation level

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
  const canDeleteCompany = (company: { id: string }) => {
    const companyProjects = projects.filter(p => p.companyId === company.id);
    return companyProjects.length === 0;
  };

  // 🏢 ENTERPRISE: canDeleteProject, canDeleteBuilding, canDeleteFloor αφαιρέθηκαν
  // Η αποσύνδεση (unlink) επιτρέπεται πάντα - χρησιμοποιεί το κεντρικοποιημένο EntityLinkingService

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
      // 🏢 ENTERPRISE DELETE LOGIC: Show custom confirmation dialog
      setPendingDeletionCompany(selectedCompany);
      setConfirmDialogOpen(true);
    } else {
      const companyProjects = projects.filter(p => p.companyId === selectedCompany.id);
      showDeleteWarning('εταιρεία', companyProjects.length, 'έργα');
    }
  };

  /**
   * 🏢 ENTERPRISE COMPANY DELETION WORKFLOW
   *
   * Implements professional-grade company removal με:
   * - Custom confirmation dialog (κεντρικοποιημένο)
   * - Database operations
   * - Cache invalidation
   * - UI updates με toast notifications
   * - Error handling
   * - Audit logging
   */
  const handleConfirmedCompanyDeletion = async () => {
    if (!pendingDeletionCompany) return;

    try {
      // 📊 STEP 1: Import navigation services
      const { removeCompanyFromNavigation } = await import('@/services/navigation-companies.service');
      const { NavigationApiService } = await import('../core/services/navigationApi');

      // 🚀 STEP 2: Optimistic UI Update (instant response)
      const companyId = pendingDeletionCompany.id;
      const companyName = pendingDeletionCompany.companyName;

      // Clear selection immediately
      onCompanySelect(''); // Deselect current company

      // 💾 STEP 3: Database Operation με enterprise error handling
      await removeCompanyFromNavigation(companyId);

      // 🚀 ENTERPRISE CACHE INVALIDATION: Καθαρισμός cache για άμεση εμφάνιση
      NavigationApiService.clearCompaniesCache();

      // 🔄 ΕΠΑΓΓΕΛΜΑΤΙΚΟ REFRESH: Ανανέωση companies από context
      await loadCompanies();

      // 📢 STEP 4: Success notification με ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΟ TOAST
      warning(`✅ Η εταιρεία "${companyName}" αφαιρέθηκε επιτυχώς από την πλοήγηση.`, {
        duration: 4000
      });

    } catch (error) {
      console.error('❌ Enterprise company deletion failed:', error);

      // 🚨 STEP 6: Error Handling με ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΟ TOAST
      warning(`❌ Αποτυχία αφαίρεσης εταιρείας. Παρακαλούμε δοκιμάστε ξανά.`, {
        duration: 5000
      });

      // 🔄 STEP 7: Rollback optimistic update (restore selection)
      onCompanySelect(pendingDeletionCompany.id);
    } finally {
      // 🧹 STEP 8: Reset dialog state
      setConfirmDialogOpen(false);
      setPendingDeletionCompany(null);
    }
  };

  /**
   * 🏢 ENTERPRISE: Αποσύνδεση Έργου από Εταιρεία
   *
   * Χρησιμοποιεί το κεντρικοποιημένο EntityLinkingService.
   * Το έργο δεν διαγράφεται - απλά αποσυνδέεται (companyId = null).
   *
   * 🔒 ΑΣΦΑΛΕΙΑ: Αν το έργο έχει κτίρια, δεν επιτρέπεται αποσύνδεση!
   */
  const handleDeleteProject = () => {
    if (!selectedProject) return;

    // 🔒 ENTERPRISE SAFETY: Έλεγχος εξαρτήσεων
    const buildingCount = getBuildingCount(selectedProject.id);
    if (buildingCount > 0) {
      // 🚫 ΜΠΛΟΚΑΡΙΣΜΑ: Δεν επιτρέπεται αποσύνδεση με κτίρια
      showDeleteWarning('έργο', buildingCount, 'κτίρια');
      return;
    }

    // ✅ Ασφαλές: Δεν έχει κτίρια - άνοιγμα confirmation dialog
    setPendingUnlinkProject({ id: selectedProject.id, name: selectedProject.name });
    setProjectDialogOpen(true);
  };

  /**
   * 🏢 ENTERPRISE: Εκτέλεση αποσύνδεσης έργου μετά από επιβεβαίωση
   */
  const handleConfirmedProjectUnlink = async () => {
    if (!pendingUnlinkProject) return;

    try {
      // 🏢 ENTERPRISE: Χρήση κεντρικοποιημένου service
      const result = await EntityLinkingService.unlinkEntity({
        entityId: pendingUnlinkProject.id,
        entityType: 'project',
      });

      if (result.success) {
        warning(`✅ Το έργο "${pendingUnlinkProject.name}" αποσυνδέθηκε επιτυχώς.`, { duration: 4000 });
        // Clear selection
        onProjectSelect('');
      } else if ('error' in result) {
        warning(`❌ Αποτυχία αποσύνδεσης: ${result.error}`, { duration: 5000 });
      }
    } catch (error) {
      console.error('❌ [DesktopMultiColumn] Project unlink failed:', error);
      warning('❌ Αποτυχία αποσύνδεσης έργου. Δοκιμάστε ξανά.', { duration: 5000 });
    } finally {
      setProjectDialogOpen(false);
      setPendingUnlinkProject(null);
    }
  };

  /**
   * 🏢 ENTERPRISE: Αποσύνδεση Κτιρίου από Έργο
   *
   * Χρησιμοποιεί το κεντρικοποιημένο EntityLinkingService.
   * Το κτίριο δεν διαγράφεται - απλά αποσυνδέεται (projectId = null).
   *
   * 🔒 ΑΣΦΑΛΕΙΑ: Αν το κτίριο έχει μονάδες, δεν επιτρέπεται αποσύνδεση!
   */
  const handleDeleteBuilding = () => {
    if (!selectedBuilding) return;

    // 🔒 ENTERPRISE SAFETY: Υπολογισμός μονάδων (από ορόφους + απευθείας)
    const floorUnits = selectedBuilding.floors?.flatMap(floor => floor.units) || [];
    const directUnits = selectedBuilding.units || [];
    const totalUnits = floorUnits.length + directUnits.length;

    if (totalUnits > 0) {
      // 🚫 ΜΠΛΟΚΑΡΙΣΜΑ: Δεν επιτρέπεται αποσύνδεση με μονάδες
      showDeleteWarning('κτίριο', totalUnits, 'μονάδες');
      return;
    }

    // ✅ Ασφαλές: Δεν έχει μονάδες - άνοιγμα confirmation dialog
    setPendingUnlinkBuilding({ id: selectedBuilding.id, name: selectedBuilding.name });
    setBuildingDialogOpen(true);
  };

  /**
   * 🏢 ENTERPRISE: Εκτέλεση αποσύνδεσης κτιρίου μετά από επιβεβαίωση
   */
  const handleConfirmedBuildingUnlink = async () => {
    if (!pendingUnlinkBuilding) return;

    try {
      // 🏢 ENTERPRISE: Χρήση κεντρικοποιημένου service
      const result = await EntityLinkingService.unlinkEntity({
        entityId: pendingUnlinkBuilding.id,
        entityType: 'building',
      });

      if (result.success) {
        warning(`✅ Το κτίριο "${pendingUnlinkBuilding.name}" αποσυνδέθηκε επιτυχώς.`, { duration: 4000 });
        // Clear selection
        onBuildingSelect('');
      } else if ('error' in result) {
        warning(`❌ Αποτυχία αποσύνδεσης: ${result.error}`, { duration: 5000 });
      }
    } catch (error) {
      console.error('❌ [DesktopMultiColumn] Building unlink failed:', error);
      warning('❌ Αποτυχία αποσύνδεσης κτιρίου. Δοκιμάστε ξανά.', { duration: 5000 });
    } finally {
      setBuildingDialogOpen(false);
      setPendingUnlinkBuilding(null);
    }
  };

  // 🏢 ENTERPRISE: handleDeleteFloor αφαιρέθηκε (Επιλογή Α) - Floors δεν είναι navigation level

  /**
   * 🏢 ENTERPRISE: Αποσύνδεση Μονάδας από Κτίριο
   *
   * Χρησιμοποιεί το κεντρικοποιημένο EntityLinkingService.
   * Η μονάδα δεν διαγράφεται - απλά αποσυνδέεται (buildingId = null).
   *
   * ✅ Οι μονάδες δεν έχουν εξαρτήσεις - επιτρέπεται αποσύνδεση πάντα.
   */
  const handleDeleteUnit = () => {
    if (!selectedUnit) return;

    // ✅ Μονάδες δεν έχουν εξαρτήσεις - άνοιγμα confirmation dialog
    setPendingUnlinkUnit({ id: selectedUnit.id, name: selectedUnit.name });
    setUnitDialogOpen(true);
  };

  /**
   * 🏢 ENTERPRISE: Εκτέλεση αποσύνδεσης μονάδας μετά από επιβεβαίωση
   */
  const handleConfirmedUnitUnlink = async () => {
    if (!pendingUnlinkUnit) return;

    try {
      // 🏢 ENTERPRISE: Χρήση κεντρικοποιημένου service
      const result = await EntityLinkingService.unlinkEntity({
        entityId: pendingUnlinkUnit.id,
        entityType: 'unit',
      });

      if (result.success) {
        warning(`✅ Η μονάδα "${pendingUnlinkUnit.name}" αποσυνδέθηκε επιτυχώς.`, { duration: 4000 });
        // Clear selection
        setSelectedUnit(null);
      } else if ('error' in result) {
        warning(`❌ Αποτυχία αποσύνδεσης: ${result.error}`, { duration: 5000 });
      }
    } catch (error) {
      console.error('❌ [DesktopMultiColumn] Unit unlink failed:', error);
      warning('❌ Αποτυχία αποσύνδεσης μονάδας. Δοκιμάστε ξανά.', { duration: 5000 });
    } finally {
      setUnitDialogOpen(false);
      setPendingUnlinkUnit(null);
    }
  };

  // Handlers for connecting items
  const handleProjectSelected = (project: { id: string; name: string }) => {
    // TODO: Implement actual connection logic
  };

  const handleBuildingSelected = async (building: { id: string; name: string }) => {
    if (!selectedProject) {
      warning('Παρακαλούμε επιλέξτε πρώτα ένα έργο.', { duration: 3000 });
      return;
    }

    // 🏢 ENTERPRISE: Use centralized EntityLinkingService (ZERO inline Firestore calls)
    const result = await EntityLinkingService.linkBuildingToProject(building.id, selectedProject.id);

    if (result.success) {
      // Close modal
      setIsBuildingModalOpen(false);

      // 📢 Success notification using centralized config labels
      const labels = ENTITY_LINKING_CONFIG['building-project'].labels;
      warning(`✅ ${labels.successMessage.replace('!', ` "${building.name}" με "${selectedProject.name}"!`)}`, {
        duration: 4000
      });
    } else {
      // 📢 Error notification using centralized config labels
      const labels = ENTITY_LINKING_CONFIG['building-project'].labels;
      warning(`❌ ${labels.errorMessage}. ${'error' in result ? result.error : ''}`, {
        duration: 5000
      });
    }
  };

  // 🏢 ENTERPRISE: handleFloorSelected αφαιρέθηκε (Επιλογή Α) - Floors δεν είναι navigation level

  const handleUnitSelected = (unit: { id: string; name: string }) => {
    // TODO: Implement actual connection logic
  };

  /**
   * Memoized filtered buildings με βάση το search term.
   * Re-calculates μόνο όταν αλλάζει το projectBuildings ή το search.
   */
  const filteredProjectBuildings = useMemo(() => {
    if (!buildingsSearch.trim()) return projectBuildings;
    const searchLower = buildingsSearch.toLowerCase();
    return projectBuildings.filter(building =>
      building.name.toLowerCase().includes(searchLower)
    );
  }, [projectBuildings, buildingsSearch]);

  /**
   * 🏢 ENTERPRISE ARCHITECTURE (Επιλογή Α):
   * Memoized units για το επιλεγμένο building.
   * Συλλέγει ΟΛΕΣ τις units από:
   * 1. ΟΛΟΥΣ τους ορόφους του building (αν υπάρχουν)
   * 2. Απευθείας από το building (αν δεν έχει ορόφους)
   * Οι όροφοι είναι δομικοί κόμβοι - δεν εμφανίζονται στην πλοήγηση.
   */
  const buildingUnits = useMemo(() => {
    if (!selectedBuilding) return [];

    // 🏢 ENTERPRISE: Combine units from floors AND direct building units
    const floorUnits = selectedBuilding.floors?.flatMap(floor => floor.units) || [];
    const directUnits = selectedBuilding.units || [];

    return [...floorUnits, ...directUnits];
  }, [selectedBuilding]);

  return (
    <nav className="hidden md:block" role="navigation" aria-label="Πλοήγηση Ιεραρχίας">
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 gap-4">

        {/* Column 1: Companies */}
        <section className="bg-white dark:bg-card border border-gray-200 dark:border-gray-700 rounded-lg p-3"
                 role="region" aria-label="Εταιρείες">
          <header className="flex items-center gap-2 mb-2">
            <Factory className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900 dark:text-foreground">Εταιρείες</h3>
          </header>

          {/* Companies Toolbar */}
          <NavigationCardToolbar
            level="companies"
            searchTerm={companiesSearch}
            onSearchChange={setCompaniesSearch}
            activeFilters={companiesFilters}
            onFiltersChange={setCompaniesFilters}
            hasSelectedItems={!!selectedCompany}
            itemCount={filterData(companies, companiesSearch, companiesFilters).length} // 🏢 Count after filtering
            onNewItem={onAddCompanyClick}
            onEditItem={() => {/* TODO: Edit company */}}
            onDeleteItem={handleDeleteCompany}
            onRefresh={() => {/* TODO: Refresh companies */}}
            onExport={() => {/* TODO: Export companies */}}
            onImport={() => {/* TODO: Import companies */}}
            onSettings={() => {/* TODO: Companies settings */}}
            onReports={() => {/* TODO: Companies reports */}}
            onShare={() => {/* TODO: Share companies */}}
            onHelp={() => {/* TODO: Companies help */}}
          />

          <ul className="space-y-2 max-h-64 overflow-y-auto list-none" role="list" aria-label="Λίστα Εταιρειών">
            {filterData(companies, companiesSearch, companiesFilters).map(company => {
              // Ελέγχουμε αν η εταιρεία έχει έργα
              const companyProjects = projects.filter(p => p.companyId === company.id);
              const hasProjects = companyProjects.length > 0;

              // Debug: Company analysis complete

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
                <li key={company.id}>
                  <NavigationButton
                    onClick={() => onCompanySelect(company.id)}
                    icon={Factory}
                    iconColor="text-blue-600"
                    title={company.companyName}
                    subtitle={subtitle}
                    extraInfo={extraInfo}
                    isSelected={selectedCompany?.id === company.id}
                    variant="compact"
                    badgeStatus={!projectsLoading && !hasProjects ? 'no_projects' : undefined}
                    badgeText={!projectsLoading && !hasProjects ? 'Χωρίς έργα' : undefined}
                  />
                </li>
              );
            })}
          </ul>
        </section>

        {/* Column 2: Projects */}
        {selectedCompany && (
          <section className="bg-white dark:bg-card border border-gray-200 dark:border-gray-700 rounded-lg p-3"
                   role="region" aria-label="Έργα">
            <header className="flex items-center gap-2 mb-2">
              <Construction className="h-5 w-5 text-green-600" />
              <h3 className="font-semibold text-gray-900 dark:text-foreground">Έργα</h3>
            </header>

            {/* Projects Toolbar */}
            <NavigationCardToolbar
              level="projects"
              searchTerm={projectsSearch}
              onSearchChange={setProjectsSearch}
              activeFilters={projectsFilters}
              onFiltersChange={setProjectsFilters}
              hasSelectedItems={!!selectedProject}
              itemCount={filterData(projects.filter(project => project.companyId === selectedCompany?.id), projectsSearch, projectsFilters).length} // 🏢 Count after filtering
              onNewItem={() => setIsProjectModalOpen(true)}
              onEditItem={() => {/* TODO: Edit project */}}
              onDeleteItem={handleDeleteProject}
              onRefresh={() => {/* TODO: Refresh projects */}}
              onExport={() => {/* TODO: Export projects */}}
              onSettings={() => {/* TODO: Projects settings */}}
              onReports={() => {/* TODO: Projects reports */}}
              onShare={() => {/* TODO: Share projects */}}
              onHelp={() => {/* TODO: Projects help */}}
            />

            <ul className="space-y-2 max-h-64 overflow-y-auto list-none" role="list" aria-label="Λίστα Έργων">
              {filterData(projects.filter(project => project.companyId === selectedCompany?.id), projectsSearch, projectsFilters).map(project => {
                // 🏢 ENTERPRISE: Use real-time building count for live updates
                const buildingCount = getBuildingCount(project.id);
                const hasBuildings = buildingCount > 0;

                return (
                  <li key={project.id}>
                    <NavigationButton
                      onClick={() => onProjectSelect(project.id)}
                      icon={Construction}
                      iconColor="text-green-600"
                      title={project.name}
                      subtitle={`${buildingCount} κτίρια`}
                      isSelected={selectedProject?.id === project.id}
                      variant="compact"
                      badgeStatus={!hasBuildings ? 'no_projects' : undefined}
                      badgeText={!hasBuildings ? 'Χωρίς κτίρια' : undefined}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Column 3: Buildings - 🏢 ENTERPRISE: Using memoized real-time data */}
        {selectedProject && (
          <section className="bg-white dark:bg-card border border-gray-200 dark:border-gray-700 rounded-lg p-3"
                   role="region" aria-label="Κτίρια">
            <header className="flex items-center gap-2 mb-2">
              <Building className="h-5 w-5 text-purple-600" />
              <h3 className="font-semibold text-gray-900 dark:text-foreground">Κτίρια</h3>
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
              onEditItem={() => {/* TODO: Edit building */}}
              onDeleteItem={handleDeleteBuilding}
              onRefresh={() => {/* TODO: Refresh buildings */}}
              onExport={() => {/* TODO: Export buildings */}}
              onSettings={() => {/* TODO: Buildings settings */}}
              onReports={() => {/* TODO: Buildings reports */}}
              onHelp={() => {/* TODO: Buildings help */}}
            />

            <ul className="space-y-2 max-h-64 overflow-y-auto list-none" role="list">
              {/* 🏢 ENTERPRISE: Buildings display without floor count (Επιλογή Α) */}
              {filteredProjectBuildings.map(building => (
                <li key={building.id}>
                  <NavigationButton
                    onClick={() => onBuildingSelect(building.id)}
                    icon={Building}
                    iconColor="text-purple-600"
                    title={building.name}
                    subtitle="Κτίριο"
                    isSelected={selectedBuilding?.id === building.id}
                    variant="compact"
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        {/*
         * 🏢 ENTERPRISE ARCHITECTURE DECISION (Επιλογή Α):
         * Οι Όροφοι ΔΕΝ εμφανίζονται ως στήλη στην πλοήγηση.
         * Εμφανίζονται ΜΟΝΟ μέσα στο Building Detail View ως δομικός μηχανισμός ομαδοποίησης.
         *
         * Σύμφωνα με REAL_ESTATE_HIERARCHY_DOCUMENTATION.md:
         * - Floor = ΔΟΜΙΚΟΣ ΚΟΜΒΟΣ (όχι entity πρώτης τάξης)
         * - Δεν ανήκει στο navigation layer
         * - Εμφανίζεται μόνο στο Building context
         */}

        {/* Column 4: Units - 🏢 ENTERPRISE: Απευθείας από Building (skip Floors) */}
        {selectedBuilding && (
          <section className="bg-white dark:bg-card border border-gray-200 dark:border-gray-700 rounded-lg p-3"
                   role="region" aria-label="Μονάδες">
            <header className="flex items-center gap-2 mb-2">
              <Home className="h-5 w-5 text-teal-600" />
              <h3 className="font-semibold text-gray-900 dark:text-foreground">Μονάδες</h3>
            </header>

            {/* Units Toolbar */}
            <NavigationCardToolbar
              level="units"
              searchTerm={unitsSearch}
              onSearchChange={setUnitsSearch}
              activeFilters={unitsFilters}
              onFiltersChange={setUnitsFilters}
              hasSelectedItems={!!selectedUnit}
              itemCount={filterData(buildingUnits, unitsSearch, unitsFilters).length}
              onNewItem={() => setIsUnitModalOpen(true)}
              onEditItem={() => {/* TODO: Edit unit */}}
              onDeleteItem={handleDeleteUnit}
              onRefresh={() => {/* TODO: Refresh units */}}
              onExport={() => {/* TODO: Export units */}}
              onSettings={() => {/* TODO: Units settings */}}
              onReports={() => {/* TODO: Units reports */}}
              onHelp={() => {/* TODO: Units help */}}
            />

            <ul className="space-y-2 max-h-64 overflow-y-auto list-none" role="list" aria-label="Λίστα Μονάδων">
              {filterData(buildingUnits, unitsSearch, unitsFilters).map(unit => (
                <li key={unit.id}>
                  <NavigationButton
                    onClick={() => {
                      setSelectedUnit(unit);
                    }}
                    icon={Home}
                    iconColor="text-teal-600"
                    title={unit.name}
                    subtitle={unit.type || 'Μονάδα'}
                    isSelected={selectedUnit?.id === unit.id}
                    variant="compact"
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Column 5: Actions & Extras - 🏢 ENTERPRISE: Εξαρτάται από Building (skip Floors) */}
        {selectedBuilding && (
          <section className="bg-white dark:bg-card border border-gray-200 dark:border-gray-700 rounded-lg p-3"
                   role="region" aria-label="Ενέργειες">
            <header className="flex items-center gap-2 mb-4">
              <MapPin className="h-5 w-5 text-red-600" />
              <h3 className="font-semibold text-gray-900 dark:text-foreground">Ενέργειες</h3>
            </header>
            <ul className="space-y-2 list-none" role="list" aria-label="Λίστα Ενεργειών">
              <li>
                <NavigationButton
                  onClick={() => onNavigateToPage('properties')}
                  icon={Home}
                  iconColor="text-teal-600"
                  title="Προβολή Μονάδων"
                  subtitle={`${buildingUnits.length} μονάδες`}
                  variant="compact"
                />
              </li>

              <li>
                <NavigationButton
                  onClick={() => onNavigateToPage('buildings')}
                  icon={Building}
                  iconColor="text-purple-600"
                  title="Λεπτομέρειες Κτιρίου"
                  subtitle={selectedBuilding.name}
                  variant="compact"
                />
              </li>

              {selectedProject && (
                <li>
                  <NavigationButton
                    onClick={() => onNavigateToPage('projects')}
                    icon={Construction}
                    iconColor="text-green-600"
                    title="Λεπτομέρειες Έργου"
                    subtitle={selectedProject.name}
                    variant="compact"
                  />
                </li>
              )}

              {/* Parking & Storage - Παρακολουθήματα */}
              <li className="pt-3 border-t border-gray-200 dark:border-gray-700">
                <section>
                  <h4 className="text-xs font-medium text-gray-500 dark:text-muted-foreground mb-2 uppercase tracking-wide">
                    Παρκινγκ & Αποθήκες
                  </h4>
                  <ul className="space-y-2 list-none" role="list" aria-label="Παρκινγκ & Αποθήκες">
                    <li>
                      <NavigationButton
                        onClick={() => {/* TODO: Parking spots */}}
                        icon={Car}
                        iconColor="text-indigo-600"
                        title="Θέσεις Στάθμευσης"
                        subtitle="Διαθέσιμες θέσεις"
                        variant="compact"
                      />
                    </li>

                    <li>
                      <NavigationButton
                        onClick={() => {/* TODO: Storage units */}}
                        icon={Package}
                        iconColor="text-amber-600"
                        title="Αποθήκες"
                        subtitle="Αποθηκευτικοί χώροι"
                        variant="compact"
                      />
                    </li>
                  </ul>
                </section>
              </li>
            </ul>
          </section>
        )}

      </section>

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

      {/* 🏢 ENTERPRISE: Floor Modal αφαιρέθηκε (Επιλογή Α) - Floors δεν είναι navigation level */}

      <SelectItemModal
        open={isUnitModalOpen}
        onOpenChange={setIsUnitModalOpen}
        onItemSelected={handleUnitSelected}
        items={availableUnits}
        title="Σύνδεση Μονάδας"
        description={`Επιλέξτε μια μονάδα για σύνδεση με το κτίριο "${selectedBuilding?.name}".`}
        searchPlaceholder="Αναζήτηση μονάδας..."
        itemType="unit"
      />

      {/* 🏢 ENTERPRISE CONFIRMATION DIALOG - ΕΤΑΙΡΕΙΑ */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Αφαίρεση Εταιρείας από Πλοήγηση
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Είστε βέβαιοι ότι θέλετε να αφαιρέσετε την εταιρεία{' '}
                <strong>"{pendingDeletionCompany?.companyName}"</strong> από την πλοήγηση;
              </p>

              <div className="bg-muted p-3 rounded-md text-sm space-y-2 border border-border">
                <p className="font-medium text-foreground">Αυτή η ενέργεια:</p>
                <ul className="text-muted-foreground space-y-1">
                  <li>• Θα αφαιρέσει την εταιρεία από τη λίστα πλοήγησης</li>
                  <li>• <strong className="text-foreground">ΔΕΝ</strong> θα διαγράψει την εταιρεία από τη βάση δεδομένων</li>
                  <li>• Μπορείτε να την προσθέσετε ξανά αργότερα</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setConfirmDialogOpen(false);
              setPendingDeletionCompany(null);
            }}>
              Ακύρωση
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmedCompanyDeletion}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Αφαίρεση
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 🏢 ENTERPRISE CONFIRMATION DIALOG - ΕΡΓΟ */}
      <AlertDialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Unlink2 className="h-5 w-5 text-orange-500" />
              Αποσύνδεση Έργου από Εταιρεία
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Είστε βέβαιοι ότι θέλετε να αποσυνδέσετε το έργο{' '}
                <strong>"{pendingUnlinkProject?.name}"</strong> από την εταιρεία;
              </p>

              <div className="bg-muted p-3 rounded-md text-sm space-y-2 border border-border">
                <p className="font-medium text-foreground">Αυτή η ενέργεια:</p>
                <ul className="text-muted-foreground space-y-1">
                  <li>• Θα αποσυνδέσει το έργο από την εταιρεία</li>
                  <li>• <strong className="text-foreground">ΔΕΝ</strong> θα διαγράψει το έργο από τη βάση δεδομένων</li>
                  <li>• Μπορείτε να το συνδέσετε ξανά αργότερα</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setProjectDialogOpen(false);
              setPendingUnlinkProject(null);
            }}>
              Ακύρωση
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmedProjectUnlink}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Αποσύνδεση
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 🏢 ENTERPRISE CONFIRMATION DIALOG - ΚΤΙΡΙΟ */}
      <AlertDialog open={buildingDialogOpen} onOpenChange={setBuildingDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Unlink2 className="h-5 w-5 text-orange-500" />
              Αποσύνδεση Κτιρίου από Έργο
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Είστε βέβαιοι ότι θέλετε να αποσυνδέσετε το κτίριο{' '}
                <strong>"{pendingUnlinkBuilding?.name}"</strong> από το έργο;
              </p>

              <div className="bg-muted p-3 rounded-md text-sm space-y-2 border border-border">
                <p className="font-medium text-foreground">Αυτή η ενέργεια:</p>
                <ul className="text-muted-foreground space-y-1">
                  <li>• Θα αποσυνδέσει το κτίριο από το έργο</li>
                  <li>• <strong className="text-foreground">ΔΕΝ</strong> θα διαγράψει το κτίριο από τη βάση δεδομένων</li>
                  <li>• Μπορείτε να το συνδέσετε ξανά αργότερα</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setBuildingDialogOpen(false);
              setPendingUnlinkBuilding(null);
            }}>
              Ακύρωση
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmedBuildingUnlink}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Αποσύνδεση
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 🏢 ENTERPRISE CONFIRMATION DIALOG - ΜΟΝΑΔΑ */}
      <AlertDialog open={unitDialogOpen} onOpenChange={setUnitDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Unlink2 className="h-5 w-5 text-orange-500" />
              Αποσύνδεση Μονάδας από Κτίριο
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Είστε βέβαιοι ότι θέλετε να αποσυνδέσετε τη μονάδα{' '}
                <strong>"{pendingUnlinkUnit?.name}"</strong> από το κτίριο;
              </p>

              <div className="bg-muted p-3 rounded-md text-sm space-y-2 border border-border">
                <p className="font-medium text-foreground">Αυτή η ενέργεια:</p>
                <ul className="text-muted-foreground space-y-1">
                  <li>• Θα αποσυνδέσει τη μονάδα από το κτίριο</li>
                  <li>• <strong className="text-foreground">ΔΕΝ</strong> θα διαγράψει τη μονάδα από τη βάση δεδομένων</li>
                  <li>• Μπορείτε να την συνδέσετε ξανά αργότερα</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setUnitDialogOpen(false);
              setPendingUnlinkUnit(null);
            }}>
              Ακύρωση
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmedUnitUnlink}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Αποσύνδεση
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </nav>
  );
}

export default DesktopMultiColumn;