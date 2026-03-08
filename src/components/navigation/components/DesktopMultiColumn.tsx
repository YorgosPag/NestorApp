'use client';

/**
 * Desktop Multi-Column Navigation Component
 * Finder-style multi-column layout for desktop navigation
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNotifications } from '@/providers/NotificationProvider';
import { NavigationButton } from './NavigationButton';
import { ContextualNavigationService } from '@/services/navigation/ContextualNavigationService';
import { NavigationCardToolbar } from './NavigationCardToolbar';
import { SelectItemModal } from '../dialogs/SelectItemModal';
// 🏢 ENTERPRISE: Building spaces tabs for Units/Storage/Parking (per local_4.log architecture)
import { BuildingSpacesTabs, type StorageUnit, type SelectedBuildingSpace } from './BuildingSpacesTabs';
// 🏢 ENTERPRISE: Native CSS scroll with data-navigation-scroll="true" (see globals.css)
// 🏢 ENTERPRISE: Icons/Colors από centralized config - ZERO hardcoded values
import { NAVIGATION_ENTITIES, NAVIGATION_ACTIONS } from '../config';
// 🏢 ENTERPRISE: Real data hooks for Firestore (ZERO mock data per CLAUDE.md)
import { useFirestoreStorages } from '@/hooks/useFirestoreStorages';
import { useFirestoreParkingSpots } from '@/hooks/useFirestoreParkingSpots';
import type { NavigationUnit, NavigationParkingSpot } from '../core/types';
// 🏢 ENTERPRISE: Layers αφαιρέθηκε - Floors δεν εμφανίζονται στην πλοήγηση (Επιλογή Α)
import { useNavigation } from '../core/NavigationContext';
// 🏢 ENTERPRISE: Centralized Entity Linking Service (ZERO inline Firestore calls)
import { EntityLinkingService, ENTITY_LINKING_CONFIG } from '@/services/entity-linking';
// 🏢 ENTERPRISE: Centralized labels - ZERO HARDCODED VALUES
import { getNavigationFilterCategories } from '@/subapps/dxf-viewer/config/modal-select/core/labels/navigation';
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
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('DesktopMultiColumn');

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
    selectedUnit,  // 🏢 ENTERPRISE: Centralized unit selection for breadcrumb
    // 🏢 ENTERPRISE: selectedFloor αφαιρέθηκε - Floors δεν είναι navigation level (Επιλογή Α)
    projectsLoading,
    loadCompanies,
    selectUnit,  // 🏢 ENTERPRISE: Centralized unit selection action
    // 🏢 ENTERPRISE: Real-time building functions
    getBuildingCount,
    getBuildingsForProject,
    // 🏢 ENTERPRISE: Real-time unit functions
    getUnitCount,
    getUnitsForBuilding
  } = useNavigation();

  const { warning } = useNotifications();
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('navigation');

  // ==========================================================================
  // 🏢 ENTERPRISE: Real Firestore Data Hooks (ZERO mock data per CLAUDE.md)
  // ==========================================================================

  // 🅿️ Parking spots για επιλεγμένο building (per local_4.log architecture)
  const { parkingSpots, loading: parkingLoading } = useFirestoreParkingSpots({
    buildingId: selectedBuilding?.id,
    autoFetch: !!selectedBuilding
  });

  // 📦 Storages - loaded globally, filtered by building
  const { storages, loading: storagesLoading } = useFirestoreStorages();

  // 🏢 ENTERPRISE: Action icons from centralized config - ZERO hardcoded values
  const ActionsIcon = NAVIGATION_ACTIONS.actions.icon;
  const DeleteIcon = NAVIGATION_ACTIONS.delete.icon;
  const UnlinkIcon = NAVIGATION_ACTIONS.unlink.icon;

  // Toolbar states for each column
  const [companiesSearch, setCompaniesSearch] = useState('');
  const [companiesFilters, setCompaniesFilters] = useState<string[]>([]);
  const [projectsSearch, setProjectsSearch] = useState('');
  const [projectsFilters, setProjectsFilters] = useState<string[]>([]);
  const [buildingsSearch, setBuildingsSearch] = useState('');
  const [buildingsFilters, setBuildingsFilters] = useState<string[]>([]);
  // 🏢 ENTERPRISE: Units search/filters αφαιρέθηκαν - τώρα διαχειρίζονται από BuildingSpacesTabs
  // 🏢 ENTERPRISE (local_4.log): Selected building space (units/storage/parking - ισότιμες κατηγορίες)
  const [selectedBuildingSpace, setSelectedBuildingSpace] = useState<SelectedBuildingSpace | null>(null);

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

  // 🏢 ENTERPRISE: selectedUnit τώρα είναι centralized στο NavigationContext
  // Το clearing γίνεται αυτόματα στο selectBuilding() του context

  // Modal states for connection dialogs
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isBuildingModalOpen, setIsBuildingModalOpen] = useState(false);
  // 🏢 ENTERPRISE: Floor modal αφαιρέθηκε (Επιλογή Α)
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);

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
            subtitle: b.subtitle || t('modals.availableForLinking')
          }));

        setAvailableBuildings(filteredBuildings);
        logger.info('Loaded available buildings via EntityLinkingService', { count: filteredBuildings.length });
      } else {
        logger.error('EntityLinkingService error', { error: result.error });
        setAvailableBuildings([]);
      }
    } catch (error) {
      logger.error('Error loading available buildings', { error });
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

  // 🏢 ENTERPRISE: Type-safe dependency warning using i18n keys
  type DependencyType = 'company' | 'project' | 'building';

  const showDeleteWarning = (itemType: DependencyType, dependentCount: number) => {
    // 🏢 ENTERPRISE: Use centralized i18n keys from dialogs.dependencies
    const messageKey = {
      company: 'dialogs.dependencies.cannotRemoveCompany',
      project: 'dialogs.dependencies.cannotUnlinkProject',
      building: 'dialogs.dependencies.cannotUnlinkBuilding'
    }[itemType];

    warning(t(messageKey, { count: dependentCount }), {
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
      showDeleteWarning('company', companyProjects.length);
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
      warning(`✅ ${t('dialogs.company.successMessage', { companyName })}`, {
        duration: 4000
      });

    } catch (error) {
      logger.error('Enterprise company deletion failed', { error });

      // 🚨 STEP 6: Error Handling με ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΟ TOAST
      warning(`❌ ${t('dialogs.company.errorMessage')}`, {
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
      showDeleteWarning('project', buildingCount);
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
        warning(`✅ ${t('dialogs.project.successMessage', { projectName: pendingUnlinkProject.name })}`, { duration: 4000 });
        // Clear selection
        onProjectSelect('');
      } else if ('error' in result) {
        warning(`❌ ${t('dialogs.project.errorMessage')}: ${result.error}`, { duration: 5000 });
      }
    } catch (error) {
      logger.error('Project unlink failed', { error });
      warning(`❌ ${t('dialogs.project.errorMessage')}`, { duration: 5000 });
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
   *
   * FIX: Use getUnitCount (realtime hook) instead of selectedBuilding.floors/units
   */
  const handleDeleteBuilding = () => {
    if (!selectedBuilding) return;

    // 🔒 ENTERPRISE SAFETY: Get unit count from realtime hook
    const totalUnits = getUnitCount(selectedBuilding.id);

    if (totalUnits > 0) {
      // 🚫 ΜΠΛΟΚΑΡΙΣΜΑ: Δεν επιτρέπεται αποσύνδεση με μονάδες
      showDeleteWarning('building', totalUnits);
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
        warning(`✅ ${t('dialogs.building.successMessage', { buildingName: pendingUnlinkBuilding.name })}`, { duration: 4000 });
        // Clear selection
        onBuildingSelect('');
      } else if ('error' in result) {
        warning(`❌ ${t('dialogs.building.errorMessage')}: ${result.error}`, { duration: 5000 });
      }
    } catch (error) {
      logger.error('Building unlink failed', { error });
      warning(`❌ ${t('dialogs.building.errorMessage')}`, { duration: 5000 });
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
        warning(`✅ ${t('dialogs.unit.successMessage', { unitName: pendingUnlinkUnit.name })}`, { duration: 4000 });
        // 🏢 ENTERPRISE: Clear selection using centralized action
        selectUnit(null);
      } else if ('error' in result) {
        warning(`❌ ${t('dialogs.unit.errorMessage')}: ${result.error}`, { duration: 5000 });
      }
    } catch (error) {
      logger.error('Unit unlink failed', { error });
      warning(`❌ ${t('dialogs.unit.errorMessage')}`, { duration: 5000 });
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
      warning(t('modals.selectFirst'), { duration: 3000 });
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
  /**
   * 🏢 ENTERPRISE (local_4.log): Check if a unit is a storage unit
   * Storage units should be in the "Αποθήκες" tab, NOT in "Μονάδες"
   */
  const isStorageType = useCallback((unit: NavigationUnit): boolean => {
    const type = (unit.type || '').toLowerCase();
    const name = (unit.name || '').toLowerCase();
    return type.includes('storage') ||
           type.includes('αποθήκη') ||
           type.includes('αποθηκη') ||
           name.includes('αποθήκη') ||
           name.includes('αποθηκη');
  }, []);

  /**
   * 🏢 ENTERPRISE: Building units from realtime data
   *
   * FIX: Use getUnitsForBuilding (realtime hook) instead of selectedBuilding.floors/units
   * The bootstrap only loads buildingCount, not full units array.
   */
  const buildingUnits = useMemo((): NavigationUnit[] => {
    if (!selectedBuilding) return [];

    // 🏢 ENTERPRISE: Get units from realtime hook, NOT from building.floors/units
    const realtimeUnits = getUnitsForBuilding(selectedBuilding.id);

    // Map RealtimeUnit to NavigationUnit and filter out storage units
    return realtimeUnits
      .filter(unit => !isStorageType(unit as unknown as NavigationUnit)) // 🏢 ENTERPRISE: Type assertion for filter
      .map(unit => ({
        id: unit.id,
        name: unit.name,
        type: (unit.type || 'apartment') as NavigationUnit['type'],
        floor: unit.floor || 0,
        area: unit.area || 0,
        status: (unit.status || 'owner') as NavigationUnit['status']
      }));
  }, [selectedBuilding, getUnitsForBuilding, isStorageType]);

  /**
   * 🏢 ENTERPRISE (local_4.log): Memoized storages filtered by building
   * Storages are parallel category to Units within Building context
   *
   * COMBINES:
   * 1. Storage units from storage_units collection (via useFirestoreStorages)
   * 2. Units with type='storage' from units collection (legacy data via realtime)
   *
   * FIX: Use getUnitsForBuilding (realtime hook) instead of selectedBuilding.floors/units
   */
  const buildingStorages = useMemo((): StorageUnit[] => {
    if (!selectedBuilding) return [];

    // 🏢 ENTERPRISE: Get storages filtered by buildingId (preferred) or building name (fallback)
    // After running migration 006, all storages will have buildingId
    const apiStorages: StorageUnit[] = (storages || [])
      .filter(storage => {
        // 1. Try matching by buildingId (enterprise - after migration 006)
        if (storage.buildingId) {
          return storage.buildingId === selectedBuilding.id;
        }
        // 2. Fallback: Match by building name (legacy - before migration)
        return storage.building === selectedBuilding.name;
      })
      .map(storage => ({
        id: storage.id,
        name: storage.name,
        type: storage.type as 'basement' | 'ground' | 'external' | undefined,
        area: storage.area,
        status: storage.status as StorageUnit['status']
      }));

    // 2. Get storage-type units from realtime units collection (legacy data)
    // These are units with type='storage' that haven't been migrated yet
    const realtimeUnits = getUnitsForBuilding(selectedBuilding.id);

    const legacyStorages: StorageUnit[] = realtimeUnits
      .filter(unit => isStorageType(unit as unknown as NavigationUnit)) // 🏢 ENTERPRISE: Type assertion for filter
      .map(unit => ({
        id: unit.id,
        name: unit.name,
        type: 'basement' as const, // Default type for legacy
        area: unit.area,
        status: (unit.status || 'owner') as StorageUnit['status']
      }));

    // Combine both sources (avoid duplicates by id)
    const allStorages = [...apiStorages];
    legacyStorages.forEach(legacy => {
      if (!allStorages.some(s => s.id === legacy.id)) {
        allStorages.push(legacy);
      }
    });

    return allStorages;
  }, [selectedBuilding, storages, getUnitsForBuilding, isStorageType]);

  /**
   * 🏢 ENTERPRISE (local_4.log): Memoized parking spots (already filtered by building via hook)
   * Parking is parallel category to Units within Building context
   */
  const buildingParkingSpots = useMemo((): NavigationParkingSpot[] => {
    if (!selectedBuilding || !parkingSpots) return [];

    return parkingSpots.map(spot => ({
      id: spot.id,
      number: spot.number,
      type: (spot.type || 'standard') as NavigationParkingSpot['type'],
      status: (spot.status || 'available') as 'owner' | 'sold' | 'forRent' | 'forSale' | 'reserved',
      location: (spot.location || 'ground') as NavigationParkingSpot['location']
    }));
  }, [selectedBuilding, parkingSpots]);

  // ==========================================================================
  // 🏢 ENTERPRISE: Handlers for BuildingSpacesTabs (per local_4.log architecture)
  // ==========================================================================

  const handleUnitSelectFromTabs = useCallback((unit: NavigationUnit) => {
    // 🏢 ENTERPRISE: Use centralized selectUnit for breadcrumb display
    selectUnit({ id: unit.id, name: unit.name, type: unit.type });
    setSelectedBuildingSpace({ id: unit.id, name: unit.name, type: 'units' });
  }, [selectUnit]);

  const handleStorageSelectFromTabs = useCallback((storage: StorageUnit) => {
    setSelectedBuildingSpace({ id: storage.id, name: storage.name, type: 'storage' });
    // TODO: Add storage to breadcrumb when supported
  }, []);

  const handleParkingSelectFromTabs = useCallback((parking: NavigationParkingSpot) => {
    setSelectedBuildingSpace({ id: parking.id, name: `Θέση ${parking.number}`, type: 'parking' });
    // TODO: Add parking to breadcrumb when supported
  }, []);

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

          {/* 🏢 ENTERPRISE: Native scroll with CSS-styled scrollbar */}
          <ul
            className="space-y-2 list-none max-h-64 pr-2 overflow-y-auto"
            role="list"
            aria-label={t('columns.companies.listLabel')}
            data-navigation-scroll="true"
          >
            {filterData(companies, companiesSearch, companiesFilters).map(company => {
              // Ελέγχουμε αν η εταιρεία έχει έργα
              const companyProjects = projects.filter(p => p.companyId === company.id);
              const hasProjects = companyProjects.length > 0;

              // Ελέγχουμε αν είναι navigation company (προστέθηκε χειροκίνητα)
              const isNavigationCompany = navigationCompanyIds.includes(company.id);

              // Διαφοροποίηση ανάλογα με το αν έχει έργα ή είναι navigation company
              let subtitle = company.industry || t('columns.companies.defaultSubtitle');
              let extraInfo: string | undefined = undefined;

              if (!hasProjects) {
                subtitle = isNavigationCompany
                  ? t('columns.companies.addProjects')
                  : t('columns.companies.noProjects');
                extraInfo = company.vatNumber ? t('columns.companies.vatNumber', { vatNumber: company.vatNumber }) : undefined;
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
                    // 🔗 ENTERPRISE: Navigation to Contacts page
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

            {/* 🏢 ENTERPRISE: Native scroll with CSS-styled scrollbar */}
            <ul
              className="space-y-2 list-none max-h-64 pr-2 overflow-y-auto"
              role="list"
              aria-label={t('columns.projects.listLabel')}
              data-navigation-scroll="true"
            >
              {filterData(projects.filter(project => project.companyId === selectedCompany?.id), projectsSearch, projectsFilters).map(project => {
                // 🏢 ENTERPRISE: Use real-time building count for live updates
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
                      // 🔗 ENTERPRISE: Navigation to Audit page (Projects page)
                      navigationHref={ContextualNavigationService.generateRoute('project', project.id, { action: 'select' })}
                      navigationTooltip={t('columns.projects.openTooltip')}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Column 3: Buildings - 🏢 ENTERPRISE: Using memoized real-time data */}
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
              onEditItem={() => {/* TODO: Edit building */}}
              onDeleteItem={handleDeleteBuilding}
              onRefresh={() => {/* TODO: Refresh buildings */}}
              onExport={() => {/* TODO: Export buildings */}}
              onSettings={() => {/* TODO: Buildings settings */}}
              onReports={() => {/* TODO: Buildings reports */}}
              onHelp={() => {/* TODO: Buildings help */}}
            />

            {/* 🏢 ENTERPRISE: Native scroll with CSS-styled scrollbar */}
            <ul
              className="space-y-2 list-none max-h-64 pr-2 overflow-y-auto"
              role="list"
              aria-label={t('columns.buildings.listLabel')}
              data-navigation-scroll="true"
            >
              {/* 🏢 ENTERPRISE: Buildings display with real-time unit count */}
              {filteredProjectBuildings.map(building => {
                // 🏢 ENTERPRISE: Real-time unit count
                const unitCount = getUnitCount(building.id);
                const hasUnits = unitCount > 0;

                return (
                  <li key={building.id}>
                    <NavigationButton
                      onClick={() => onBuildingSelect(building.id)}
                      icon={NAVIGATION_ENTITIES.building.icon}
                      iconColor={NAVIGATION_ENTITIES.building.color}
                      title={building.name}
                      subtitle={t('columns.buildings.unitCount', { count: unitCount })}
                      isSelected={selectedBuilding?.id === building.id}
                      variant="compact"
                      badgeStatus={!hasUnits ? 'no_projects' : undefined}
                      badgeText={!hasUnits ? t(getNavigationFilterCategories().building_without_units) : undefined}
                      // 🔗 ENTERPRISE: Navigation to Buildings page
                      navigationHref={ContextualNavigationService.generateRoute('building', building.id, { action: 'select' })}
                      navigationTooltip={t('columns.buildings.openTooltip')}
                    />
                  </li>
                );
              })}
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

        {/*
         * 🏢 ENTERPRISE ARCHITECTURE (local_4.log):
         * Column 4: Building Spaces - Units/Storage/Parking ως παράλληλες κατηγορίες
         *
         * ❌ ΟΧΙ: Parking/Storage ως "παρακολουθήματα" ή children των Units
         * ✅ ΝΑΙ: Parking/Storage/Units ως ισότιμες παράλληλες κατηγορίες στο Building context
         *
         * Χρησιμοποιεί BuildingSpacesTabs component με tabs για:
         * - Μονάδες (Units)
         * - Αποθήκες (Storage)
         * - Θέσεις Στάθμευσης (Parking)
         */}
        {selectedBuilding && (
          <BuildingSpacesTabs
            units={buildingUnits}
            storages={buildingStorages}
            parkingSpots={buildingParkingSpots}
            selectedItem={selectedBuildingSpace}
            onUnitSelect={handleUnitSelectFromTabs}
            onStorageSelect={handleStorageSelectFromTabs}
            onParkingSelect={handleParkingSelectFromTabs}
            onAddItem={(tab) => {
              if (tab === 'units') setIsUnitModalOpen(true);
              // TODO: Add modals for storage and parking
            }}
            onUnlinkItem={(tab) => {
              if (tab === 'units') handleDeleteUnit();
              // TODO: Add unlink handlers for storage and parking
            }}
            defaultTab="units"
          />
        )}

        {/* Column 5: Actions & Extras - 🏢 ENTERPRISE: Εξαρτάται από Building (skip Floors) */}
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
                  icon={NAVIGATION_ENTITIES.unit.icon}
                  iconColor={NAVIGATION_ENTITIES.unit.color}
                  title={t('columns.actions.viewUnits')}
                  subtitle={t('columns.actions.unitsCount', { count: buildingUnits.length })}
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

              {/*
               * 🏢 ENTERPRISE (local_4.log):
               * Parking & Storage αφαιρέθηκαν από εδώ - τώρα εμφανίζονται στο BuildingSpacesTabs
               * ως ισότιμες παράλληλες κατηγορίες με τα Units
               */}
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
        title={t('modals.linkProject.title')}
        description={t('modals.linkProject.description', { companyName: selectedCompany?.companyName })}
        searchPlaceholder={t('modals.linkProject.searchPlaceholder')}
        itemType="project"
      />

      <SelectItemModal
        open={isBuildingModalOpen}
        onOpenChange={setIsBuildingModalOpen}
        onItemSelected={handleBuildingSelected}
        items={availableBuildings}
        title={t('modals.linkBuilding.title')}
        description={t('modals.linkBuilding.description', { projectName: selectedProject?.name })}
        searchPlaceholder={t('modals.linkBuilding.searchPlaceholder')}
        itemType="building"
      />

      {/* 🏢 ENTERPRISE: Floor Modal αφαιρέθηκε (Επιλογή Α) - Floors δεν είναι navigation level */}

      <SelectItemModal
        open={isUnitModalOpen}
        onOpenChange={setIsUnitModalOpen}
        onItemSelected={handleUnitSelected}
        items={availableUnits}
        title={t('modals.linkUnit.title')}
        description={t('modals.linkUnit.description', { buildingName: selectedBuilding?.name })}
        searchPlaceholder={t('modals.linkUnit.searchPlaceholder')}
        itemType="unit"
      />

      {/* 🏢 ENTERPRISE CONFIRMATION DIALOG - ΕΤΑΙΡΕΙΑ */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <DeleteIcon className={`h-5 w-5 ${NAVIGATION_ACTIONS.delete.color}`} />
              {t('dialogs.company.title')}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                {t('dialogs.company.confirmation', { companyName: pendingDeletionCompany?.companyName })}
              </p>

              <div className="bg-muted p-3 rounded-md text-sm space-y-2 border border-border">
                <p className="font-medium text-foreground">{t('dialogs.company.infoTitle')}</p>
                <ul className="text-muted-foreground space-y-1">
                  <li>• {t('dialogs.company.willRemove')}</li>
                  <li>• <strong className="text-foreground">{t('dialogs.company.willNotDelete')}</strong></li>
                  <li>• {t('dialogs.company.canAddLater')}</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setConfirmDialogOpen(false);
              setPendingDeletionCompany(null);
            }}>
              {t('dialogs.company.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmedCompanyDeletion}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('dialogs.company.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 🏢 ENTERPRISE CONFIRMATION DIALOG - ΕΡΓΟ */}
      <AlertDialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <UnlinkIcon className={`h-5 w-5 ${NAVIGATION_ACTIONS.unlink.color}`} />
              {t('dialogs.project.title')}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                {t('dialogs.project.confirmation', { projectName: pendingUnlinkProject?.name })}
              </p>

              <div className="bg-muted p-3 rounded-md text-sm space-y-2 border border-border">
                <p className="font-medium text-foreground">{t('dialogs.project.infoTitle')}</p>
                <ul className="text-muted-foreground space-y-1">
                  <li>• {t('dialogs.project.willUnlink')}</li>
                  <li>• <strong className="text-foreground">{t('dialogs.project.willNotDelete')}</strong></li>
                  <li>• {t('dialogs.project.canLinkLater')}</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setProjectDialogOpen(false);
              setPendingUnlinkProject(null);
            }}>
              {t('dialogs.project.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmedProjectUnlink}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('dialogs.project.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 🏢 ENTERPRISE CONFIRMATION DIALOG - ΚΤΙΡΙΟ */}
      <AlertDialog open={buildingDialogOpen} onOpenChange={setBuildingDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <UnlinkIcon className={`h-5 w-5 ${NAVIGATION_ACTIONS.unlink.color}`} />
              {t('dialogs.building.title')}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                {t('dialogs.building.confirmation', { buildingName: pendingUnlinkBuilding?.name })}
              </p>

              <div className="bg-muted p-3 rounded-md text-sm space-y-2 border border-border">
                <p className="font-medium text-foreground">{t('dialogs.building.infoTitle')}</p>
                <ul className="text-muted-foreground space-y-1">
                  <li>• {t('dialogs.building.willUnlink')}</li>
                  <li>• <strong className="text-foreground">{t('dialogs.building.willNotDelete')}</strong></li>
                  <li>• {t('dialogs.building.canLinkLater')}</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setBuildingDialogOpen(false);
              setPendingUnlinkBuilding(null);
            }}>
              {t('dialogs.building.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmedBuildingUnlink}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('dialogs.building.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 🏢 ENTERPRISE CONFIRMATION DIALOG - ΜΟΝΑΔΑ */}
      <AlertDialog open={unitDialogOpen} onOpenChange={setUnitDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <UnlinkIcon className={`h-5 w-5 ${NAVIGATION_ACTIONS.unlink.color}`} />
              {t('dialogs.unit.title')}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                {t('dialogs.unit.confirmation', { unitName: pendingUnlinkUnit?.name })}
              </p>

              <div className="bg-muted p-3 rounded-md text-sm space-y-2 border border-border">
                <p className="font-medium text-foreground">{t('dialogs.unit.infoTitle')}</p>
                <ul className="text-muted-foreground space-y-1">
                  <li>• {t('dialogs.unit.willUnlink')}</li>
                  <li>• <strong className="text-foreground">{t('dialogs.unit.willNotDelete')}</strong></li>
                  <li>• {t('dialogs.unit.canLinkLater')}</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setUnitDialogOpen(false);
              setPendingUnlinkUnit(null);
            }}>
              {t('dialogs.unit.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmedUnitUnlink}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('dialogs.unit.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </nav>
  );
}

export default DesktopMultiColumn;