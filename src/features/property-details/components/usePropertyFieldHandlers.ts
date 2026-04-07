/** 🏢 ENTERPRISE: Extracted field-change handlers for PropertyFieldsBlock (Google SRP) */
import { useCallback } from 'react';
import type { PropertyType } from '@/types/property';
import type { PropertyFieldsFormData } from './property-fields-form-types';
import { isMultiLevelCapableType } from '@/config/domain-constants';

interface UsePropertyFieldHandlersParams {
  formData: PropertyFieldsFormData;
  setFormData: React.Dispatch<React.SetStateAction<PropertyFieldsFormData>>;
  setLocalType: (type: string) => void;
  localType: string;
  nameUserEdited: React.MutableRefObject<boolean>;
  buildSuggestedName: (unitType: string, areaNet: number) => string;
  onActiveLevelChange?: ((id: string | null) => void) | undefined;
  onAutoSaveFields?: ((fields: Partial<Record<string, unknown>>) => void) | undefined;
  isCreatingNewUnit: boolean;
  autoLevel: { triggerAutoLevelCreation: (type: string, floorId: string, floor: number) => void };
}

export function usePropertyFieldHandlers({
  formData,
  setFormData,
  setLocalType,
  localType,
  nameUserEdited,
  buildSuggestedName,
  onActiveLevelChange,
  onAutoSaveFields,
  isCreatingNewUnit,
  autoLevel,
}: UsePropertyFieldHandlersParams) {
  const handleHierarchyChange = useCallback(
    (patch: Partial<{ type: PropertyType | ''; projectId: string; buildingId: string; floorId: string; floor: number }>) => {
      const shouldSuggestName = patch.type !== undefined && patch.type && !nameUserEdited.current;

      setFormData((prev) => {
        const updated = {
          ...prev,
          ...(patch.type !== undefined ? { type: patch.type as string } : {}),
          ...(patch.projectId !== undefined ? { projectId: patch.projectId } : {}),
          ...(patch.buildingId !== undefined ? { buildingId: patch.buildingId } : {}),
          ...(patch.floorId !== undefined ? { floorId: patch.floorId } : {}),
          ...(patch.floor !== undefined ? { floor: patch.floor } : {}),
        };
        if (shouldSuggestName) {
          updated.name = buildSuggestedName(patch.type as string, prev.areaGross);
        }
        // ADR-236: Clear levels when switching to non-multi-level type
        if (patch.type !== undefined && !isMultiLevelCapableType(patch.type)) {
          updated.levels = [];
          updated.levelData = {};
        }
        return updated;
      });
      if (patch.type !== undefined) {
        setLocalType(patch.type);
        if (!isMultiLevelCapableType(patch.type)) onActiveLevelChange?.(null);
      }
      // ADR-236 Phase 4: Trigger auto-level with FRESH values (avoids stale closures)
      if (isCreatingNewUnit && formData.levels.length < 2) {
        const effectiveType = (patch.type as string) ?? localType;
        const effectiveFloorId = patch.floorId ?? (formData.floorId || null);
        const effectiveFloor = patch.floor ?? formData.floor;
        if (effectiveType && effectiveFloorId) {
          autoLevel.triggerAutoLevelCreation(effectiveType, effectiveFloorId, effectiveFloor);
        }
      }
    },
    [autoLevel, buildSuggestedName, formData.levels.length, formData.floorId, formData.floor, isCreatingNewUnit, localType, onActiveLevelChange, setFormData, setLocalType, nameUserEdited],
  );

  const handleTypeChange = useCallback((newType: string) => {
    setLocalType(newType);
    nameUserEdited.current = false;
    const newName = buildSuggestedName(newType, formData.areaGross);
    // ADR-236: Clear levels when switching to non-multi-level type
    if (!isMultiLevelCapableType(newType)) {
      setFormData(prev => ({ ...prev, name: newName, levels: [], levelData: {} }));
      onActiveLevelChange?.(null);
    } else {
      setFormData(prev => ({ ...prev, name: newName }));
    }
    if (onAutoSaveFields) onAutoSaveFields({ type: newType, name: newName });
    if (isCreatingNewUnit && formData.floorId) {
      autoLevel.triggerAutoLevelCreation(newType, formData.floorId, formData.floor);
    }
  }, [autoLevel, buildSuggestedName, formData.areaGross, formData.floor, formData.floorId, isCreatingNewUnit, onActiveLevelChange, onAutoSaveFields, setFormData, setLocalType, nameUserEdited]);

  const handleNameManualEdit = useCallback((value: string) => {
    nameUserEdited.current = true;
    setFormData(prev => ({ ...prev, name: value }));
  }, [setFormData, nameUserEdited]);

  const handleAreaChange = useCallback((areaKey: 'net' | 'gross', value: number) => {
    if (areaKey === 'gross' && !nameUserEdited.current) {
      setFormData(prev => ({ ...prev, name: buildSuggestedName(localType, value) }));
    }
  }, [buildSuggestedName, localType, setFormData, nameUserEdited]);

  return { handleHierarchyChange, handleTypeChange, handleNameManualEdit, handleAreaChange };
}
