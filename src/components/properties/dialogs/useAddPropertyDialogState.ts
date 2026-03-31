/**
 * =============================================================================
 * AddPropertyDialog — State Hook
 * =============================================================================
 *
 * All state, effects, and constants for the AddPropertyDialog.
 *
 * @module components/units/dialogs/useAddPropertyDialogState
 * @enterprise ADR-034
 */

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { useAuth } from '@/auth/contexts/AuthContext';
import { usePropertyForm } from '../hooks/usePropertyForm';
import { useEntityCodeSuggestion } from '@/hooks/useEntityCodeSuggestion';
import { isMultiLevelCapableType } from '@/config/domain-constants';
import type { PropertyType, OperationalStatus, CommercialStatus } from '@/types/property';
import type { Building } from '@/types/building/contracts';

// =============================================================================
// CONSTANTS
// =============================================================================

export const PROPERTY_TYPE_OPTIONS: PropertyType[] = [
  'studio',
  'apartment_1br',
  'apartment',
  'apartment_2br',
  'apartment_3br',
  'maisonette',
  'penthouse',
  'loft',
  'detached_house',
  'villa',
  'shop',
  'office',
  'hall',
  'storage',
];

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
}: Pick<AddPropertyDialogProps, 'open' | 'onPropertyAdded' | 'onOpenChange'>) {
  // Form state management
  const form = usePropertyForm({ onPropertyAdded, onOpenChange });
  const { formData, errors, handleSelectChange, handleNumberChange, handleLevelsChange, resetForm } = form;

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

  // ADR-233: Code suggestion
  const [codeOverridden, setCodeOverridden] = useState(false);

  const { suggestedCode, isLoading: codeLoading } = useEntityCodeSuggestion({
    entityType: 'unit',
    buildingId: formData.buildingId,
    floorLevel: formData.floor,
    unitType: formData.type || undefined,
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
    }
  }, [open, resetForm]);

  // Building change handler (resets floor + levels)
  const handleBuildingChange = (value: string) => {
    handleSelectChange('buildingId', value);
    handleSelectChange('floorId', '');
    handleNumberChange('floor', '');
    handleLevelsChange([]);
  };

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
  };
}
