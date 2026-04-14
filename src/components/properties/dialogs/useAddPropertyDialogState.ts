/**
 * =============================================================================
 * AddPropertyDialog — State Hook
 * =============================================================================
 *
 * All state, effects, and constants for the AddPropertyDialog.
 *
 * @module components/properties/dialogs/useAddPropertyDialogState
 * @enterprise ADR-034
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { useAuth } from '@/auth/contexts/AuthContext';
import { usePropertyForm, isStandaloneUnitType } from '../hooks/usePropertyForm';
import { useEntityCodeSuggestion } from '@/hooks/useEntityCodeSuggestion';
import { isMultiLevelCapableType, ENTITY_TYPES } from '@/config/domain-constants';
import { getProjectsList, type ProjectListItem } from '@/components/building-management/building-services';
import { createModuleLogger } from '@/lib/telemetry';
import type { PropertyType, OperationalStatus, CommercialStatus } from '@/types/property';
import {
  PROPERTY_TYPES,
  PROPERTY_TYPE_LABELS_EL,
  isPropertyType,
  normalizePropertyType,
  arePropertyTypesEquivalent,
} from '@/constants/property-types';
import type { Building } from '@/types/building/contracts';

const logger = createModuleLogger('AddPropertyDialogState');

// =============================================================================
// CONSTANTS
// =============================================================================

// ADR-145: Derived από canonical SSoT (@/constants/property-types).
// Previously: hardcoded 14-item list που ήταν εύκολο να βγει εκτός sync.
export const PROPERTY_TYPE_OPTIONS: PropertyType[] = [...PROPERTY_TYPES];

export const OPERATIONAL_STATUS_OPTIONS: OperationalStatus[] = [
  'draft',
  'under-construction',
  'inspection',
  'ready',
  'maintenance',
];

// ADR-197: Κατά τη ΔΗΜΙΟΥΡΓΙΑ μόνο αυτές οι τιμές
export const CREATION_COMMERCIAL_STATUS_OPTIONS: CommercialStatus[] = [
  'unavailable',
  'for-sale',
  'for-rent',
  'for-sale-and-rent',
];

// =============================================================================
// TYPES
// =============================================================================

export interface AddPropertyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPropertyAdded?: () => void;
  buildings: Building[];
  buildingsLoading?: boolean;
}

interface FloorOption {
  id: string;
  number: number;
  name: string;
}

// =============================================================================
// HOOK
// =============================================================================

export function useAddPropertyDialogState({
  open,
  onPropertyAdded,
  onOpenChange,
  buildings,
}: Pick<AddPropertyDialogProps, 'open' | 'onPropertyAdded' | 'onOpenChange'> & {
  buildings: Building[];
}) {
  // Form state management
  const form = usePropertyForm({ onPropertyAdded, onOpenChange });
  const { formData, errors, handleSelectChange, handleNumberChange, handleLevelsChange, resetForm } = form;

  // ADR-284: Projects list for Project selector (required for both families)
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);

  const reloadProjects = useCallback(() => {
    setProjectsLoading(true);
    getProjectsList()
      .then(setProjects)
      .catch((err: unknown) => logger.error('Failed to load projects', { error: err }))
      .finally(() => setProjectsLoading(false));
  }, []);

  useEffect(() => {
    if (!open) return;
    reloadProjects();
  }, [open, reloadProjects]);

  // ADR-284 §3.3 (Phase 3a): Nested dialog state for inline CTAs
  const [showAddProjectDialog, setShowAddProjectDialog] = useState(false);
  const [showAddFloorDialog, setShowAddFloorDialog] = useState(false);
  // ADR-284 §3.3 (Phase 3b): Inline fix modal for orphan Buildings
  const [showLinkBuildingDialog, setShowLinkBuildingDialog] = useState(false);

  // ADR-284: Discriminator between Family A (in-building) and Family B (standalone)
  const isStandalone = isStandaloneUnitType(formData.type);

  // ADR-284 §3.3 (Phase 3a): Buildings filtered by selected Project for empty-state detection
  const filteredBuildings = useMemo<Building[]>(() => {
    if (!formData.projectId) return buildings;
    return buildings.filter((b) => b.projectId === formData.projectId);
  }, [buildings, formData.projectId]);

  // ADR-284 §3.3 (Phase 3b): Orphan Building detection — Building selected but has no projectId
  const selectedBuilding = useMemo<Building | undefined>(
    () => buildings.find((b) => b.id === formData.buildingId),
    [buildings, formData.buildingId],
  );
  const isOrphanBuilding = useMemo(
    () =>
      !isStandalone &&
      !!formData.buildingId &&
      !!selectedBuilding &&
      !selectedBuilding.projectId,
    [isStandalone, formData.buildingId, selectedBuilding],
  );

  // ADR-284 §3.3 (Phase 3a+3b): Empty state flags — drive inline CTAs in AddPropertyDialog
  const emptyStates = useMemo(() => ({
    noProjects: projects.length === 0,
    noBuildings:
      !isStandalone &&
      !!formData.projectId &&
      filteredBuildings.length === 0,
    orphanBuilding: isOrphanBuilding,
  }), [projectsLoading, projects.length, isStandalone, formData.projectId, filteredBuildings.length, isOrphanBuilding]);

  // Real-time floor subscription
  const [floorOptions, setFloorOptions] = useState<FloorOption[]>([]);
  const [floorsLoading, setFloorsLoading] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!formData.buildingId || !user) {
      setFloorOptions([]);
      setFloorsLoading(false);
      return;
    }

    setFloorsLoading(true);

    const floorsCol = collection(db, COLLECTIONS.FLOORS);
    const constraints = [
      where('buildingId', '==', formData.buildingId),
      ...(user.companyId ? [where('companyId', '==', user.companyId)] : []),
    ];
    const q = query(floorsCol, ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const floors = snapshot.docs
          .map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              number: typeof data.number === 'number' ? data.number : 0,
              name: (data.name as string) || '',
            };
          })
          .sort((a, b) => a.number - b.number);

        setFloorOptions(floors);
        setFloorsLoading(false);
      },
      () => {
        setFloorOptions([]);
        setFloorsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [formData.buildingId, user]);

  // Name suggestion: tracks whether user has manually edited the name field.
  // If false → auto-fill on type select. If true → show hint only.
  const [nameOverridden, setNameOverridden] = useState(false);

  // ADR-233: Code suggestion
  const [codeOverridden, setCodeOverridden] = useState(false);

  const { suggestedCode, isLoading: codeLoading } = useEntityCodeSuggestion({
    entityType: ENTITY_TYPES.PROPERTY,
    buildingId: formData.buildingId,
    floorLevel: formData.floor,
    propertyType: formData.type || undefined,
    disabled: codeOverridden,
  });

  useEffect(() => {
    if (suggestedCode && !codeOverridden) {
      handleSelectChange('code', suggestedCode);
    }
  }, [suggestedCode, codeOverridden, handleSelectChange]);

  // ADR-236: Multi-level detection
  const isMultiLevelType = isMultiLevelCapableType(formData.type);

  // Tab state
  const [activeTab, setActiveTab] = useState('basic');

  // Auto-navigate to tab with validation errors
  useEffect(() => {
    const errorFields = Object.keys(errors);
    if (errorFields.length === 0) return;

    const detailsFields: Array<keyof typeof formData> = ['area', 'bedrooms', 'bathrooms', 'description'];
    const hasBasicError = errorFields.some(f => !detailsFields.includes(f as keyof typeof formData));

    setActiveTab(hasBasicError ? 'basic' : 'details');
  }, [errors, formData]);

  // Reset on dialog open
  useEffect(() => {
    if (open) {
      resetForm();
      setActiveTab('basic');
      setCodeOverridden(false);
      setNameOverridden(false);
    }
  }, [open, resetForm]);

  // Building change handler (resets floor + levels)
  const handleBuildingChange = (value: string) => {
    handleSelectChange('buildingId', value);
    handleSelectChange('floorId', '');
    handleNumberChange('floor', '');
    handleLevelsChange([]);
  };

  // Derived: suggested name for the currently selected type.
  const suggestedName = isPropertyType(formData.type)
    ? PROPERTY_TYPE_LABELS_EL[formData.type]
    : '';

  // ADR-284: Type change handler — when switching to standalone, clear building/floor.
  // Auto-fills name if user hasn't manually edited it (nameOverridden = false).
  const handleTypeChange = (value: string) => {
    handleSelectChange('type', value);
    if (isStandaloneUnitType(value as PropertyType | '')) {
      handleSelectChange('buildingId', '');
      handleSelectChange('floorId', '');
      handleNumberChange('floor', '');
      handleLevelsChange([]);
    }
    if (!nameOverridden && isPropertyType(value)) {
      handleSelectChange('name', PROPERTY_TYPE_LABELS_EL[value]);
    }
  };

  // Derived: detect conflict between manually entered name and selected type.
  // Fires only when the name resolves to a *different* canonical type via alias map.
  const nameInferredType = useMemo(
    () => normalizePropertyType(formData.name),
    [formData.name],
  );

  const nameTypeConflict = useMemo(() => {
    if (!formData.name || !formData.type || !nameInferredType) return false;
    return !arePropertyTypesEquivalent(nameInferredType, formData.type);
  }, [formData.name, formData.type, nameInferredType]);

  // Floor selection handler
  const handleFloorSelection = (value: string) => {
    const selectedFloor = floorOptions.find(f => f.id === value);
    handleSelectChange('floorId', value);
    if (selectedFloor) {
      handleNumberChange('floor', String(selectedFloor.number));
    }
  };

  return {
    ...form,
    floorOptions,
    floorsLoading,
    codeOverridden,
    setCodeOverridden,
    suggestedCode,
    codeLoading,
    isMultiLevelType,
    activeTab,
    setActiveTab,
    handleBuildingChange,
    handleFloorSelection,
    // ADR-284
    projects,
    projectsLoading,
    reloadProjects,
    isStandalone,
    handleTypeChange,
    // ADR-284 §3.3 (Phase 3a): Empty states + inline CTAs
    filteredBuildings,
    emptyStates,
    showAddProjectDialog,
    setShowAddProjectDialog,
    showAddFloorDialog,
    setShowAddFloorDialog,
    // ADR-284 §3.3 (Phase 3b): Orphan Building inline fix modal
    showLinkBuildingDialog,
    setShowLinkBuildingDialog,
    selectedBuilding,
    // Name suggestion / conflict
    nameTypeConflict,
    nameInferredType,
    nameOverridden,
    setNameOverridden,
    suggestedName,
  };
}
