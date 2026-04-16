/** 🏢 ENTERPRISE: Extracted field-change handlers for PropertyFieldsBlock (Google SRP) */
import { useCallback } from 'react';
import type { PropertyType } from '@/types/property';
import type { PropertyFieldsFormData } from './property-fields-form-types';
import { isMultiLevelCapableType } from '@/config/domain-constants';
import {
  reconcileLevelsForType,
  type FlatLevelFields,
  type ReconcileLevelsResult,
} from '@/services/property/level-reconciliation';

interface UsePropertyFieldHandlersParams {
  formData: PropertyFieldsFormData;
  setFormData: React.Dispatch<React.SetStateAction<PropertyFieldsFormData>>;
  setLocalType: (type: string) => void;
  localType: string;
  nameUserEdited: React.MutableRefObject<boolean>;
  buildSuggestedName: (unitType: string, areaNet: number) => string;
  onActiveLevelChange?: ((id: string | null) => void) | undefined;
  onAutoSaveFields?: ((fields: Partial<Record<string, unknown>>) => void) | undefined;
  autoLevel: { triggerAutoLevelCreation: (type: string, floorId: string, floor: number) => void };
}

function snapshotFlatFields(form: PropertyFieldsFormData): FlatLevelFields {
  return {
    areaGross: form.areaGross,
    areaNet: form.areaNet,
    areaBalcony: form.areaBalcony,
    areaTerrace: form.areaTerrace,
    areaGarden: form.areaGarden,
    bedrooms: form.bedrooms,
    bathrooms: form.bathrooms,
    wc: form.wc,
    orientations: form.orientations,
  };
}

function applyReconciliation(
  prev: PropertyFieldsFormData,
  result: ReconcileLevelsResult,
): PropertyFieldsFormData {
  if (result.transition === 'none') return prev;
  return {
    ...prev,
    levels: result.newLevels,
    levelData: result.newLevelData,
    ...(result.flatPatch.areaGross !== undefined ? { areaGross: result.flatPatch.areaGross } : {}),
    ...(result.flatPatch.areaNet !== undefined ? { areaNet: result.flatPatch.areaNet } : {}),
    ...(result.flatPatch.areaBalcony !== undefined ? { areaBalcony: result.flatPatch.areaBalcony } : {}),
    ...(result.flatPatch.areaTerrace !== undefined ? { areaTerrace: result.flatPatch.areaTerrace } : {}),
    ...(result.flatPatch.areaGarden !== undefined ? { areaGarden: result.flatPatch.areaGarden } : {}),
    ...(result.flatPatch.bedrooms !== undefined ? { bedrooms: result.flatPatch.bedrooms } : {}),
    ...(result.flatPatch.bathrooms !== undefined ? { bathrooms: result.flatPatch.bathrooms } : {}),
    ...(result.flatPatch.wc !== undefined ? { wc: result.flatPatch.wc } : {}),
    ...(result.flatPatch.orientations !== undefined ? { orientations: result.flatPatch.orientations } : {}),
  };
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
  autoLevel,
}: UsePropertyFieldHandlersParams) {
  const handleHierarchyChange = useCallback(
    (patch: Partial<{ type: PropertyType | ''; projectId: string; buildingId: string; floorId: string; floor: number }>) => {
      const shouldSuggestName = patch.type !== undefined && patch.type && !nameUserEdited.current;
      const newType = patch.type !== undefined ? (patch.type as string) : localType;

      const reconcile = patch.type !== undefined
        ? reconcileLevelsForType({
            oldType: localType,
            newType,
            currentLevels: formData.levels,
            currentLevelData: formData.levelData,
            flatFields: snapshotFlatFields(formData),
          })
        : null;

      setFormData((prev) => {
        const merged = applyReconciliation(prev, reconcile ?? { transition: 'none', newLevels: prev.levels, newLevelData: prev.levelData, flatPatch: {}, clearActiveLevel: false, shouldAutoCreate: false, autoSavePayload: null });
        const updated: PropertyFieldsFormData = {
          ...merged,
          ...(patch.type !== undefined ? { type: patch.type as string } : {}),
          ...(patch.projectId !== undefined ? { projectId: patch.projectId } : {}),
          ...(patch.buildingId !== undefined ? { buildingId: patch.buildingId } : {}),
          ...(patch.floorId !== undefined ? { floorId: patch.floorId } : {}),
          ...(patch.floor !== undefined ? { floor: patch.floor } : {}),
        };
        if (shouldSuggestName) {
          updated.name = buildSuggestedName(patch.type as string, updated.areaGross);
        }
        return updated;
      });

      if (patch.type !== undefined) {
        setLocalType(patch.type);
        if (reconcile?.clearActiveLevel) onActiveLevelChange?.(null);
      }
      // ADR-236 Phase 4: Trigger auto-level with FRESH values (avoids stale closures)
      if (formData.levels.length < 2) {
        const effectiveType = (patch.type as string) ?? localType;
        const effectiveFloorId = patch.floorId ?? (formData.floorId || null);
        const effectiveFloor = patch.floor ?? formData.floor;
        if (effectiveType && effectiveFloorId && isMultiLevelCapableType(effectiveType)) {
          autoLevel.triggerAutoLevelCreation(effectiveType, effectiveFloorId, effectiveFloor);
        }
      }
    },
    [autoLevel, buildSuggestedName, formData, localType, onActiveLevelChange, setFormData, setLocalType, nameUserEdited],
  );

  const handleTypeChange = useCallback((newType: string) => {
    const reconcile = reconcileLevelsForType({
      oldType: localType,
      newType,
      currentLevels: formData.levels,
      currentLevelData: formData.levelData,
      flatFields: snapshotFlatFields(formData),
    });

    setLocalType(newType);
    nameUserEdited.current = false;

    setFormData((prev) => {
      const merged = applyReconciliation(prev, reconcile);
      const newName = buildSuggestedName(
        newType,
        // Use post-reconciliation areaGross so the suggested name reflects
        // aggregated totals on multi→single (no stale single-level value).
        reconcile.flatPatch.areaGross ?? prev.areaGross,
      );
      return { ...merged, type: newType, name: newName };
    });

    if (reconcile.clearActiveLevel) onActiveLevelChange?.(null);

    // Auto-save (edit mode): persist type + name + level cleanup payload in one shot
    if (onAutoSaveFields) {
      const newName = buildSuggestedName(
        newType,
        reconcile.flatPatch.areaGross ?? formData.areaGross,
      );
      const payload: Record<string, unknown> = { type: newType, name: newName };
      if (reconcile.autoSavePayload) Object.assign(payload, reconcile.autoSavePayload);
      onAutoSaveFields(payload);
    }

    // Reverse-direction symmetry: single→multi auto-create (was gated to
    // creation only — now also fires in edit mode per ADR-236 Phase 5).
    if (reconcile.shouldAutoCreate && formData.floorId) {
      autoLevel.triggerAutoLevelCreation(newType, formData.floorId, formData.floor);
    }
  }, [autoLevel, buildSuggestedName, formData, localType, onActiveLevelChange, onAutoSaveFields, setFormData, setLocalType, nameUserEdited]);

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
