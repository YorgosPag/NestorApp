/** 🏢 ENTERPRISE: Property Fields Block — Displays and edits property fields */
/* eslint-disable design-system/prefer-design-system-imports, design-system/enforce-semantic-colors, custom/no-hardcoded-strings */
'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNotifications } from '@/providers/NotificationProvider';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useTypography } from '@/hooks/useTypography';
import { useTranslation } from '@/i18n/hooks/useTranslation';

import type { Property } from '@/types/property-viewer';
import type { CommercialStatus, OperationalStatus, LevelData, PropertyLevel } from '@/types/property';
import { aggregateLevelData } from '@/services/multi-level.service';
import { useAutoLevelCreation } from '../hooks/useAutoLevelCreation';
import { AutoLevelDialogs } from './AutoLevelDialogs';
import { createModuleLogger } from '@/lib/telemetry';
import { useEntityCodeSuggestion } from '@/hooks/useEntityCodeSuggestion';
import { ReadOnlyCompactView } from './PropertyFieldsReadOnly';
import { PropertyFieldsEditForm } from './PropertyFieldsEditForm';
import type { PropertyFieldsFormData } from './property-fields-form-types';
import { buildPropertyUpdatesFromForm } from './property-fields-form-mapper';
import { buildCreationPayload } from './property-fields-save-handler';
import type { PropertyType } from '@/types/property';
import { PROPERTY_TYPE_I18N_KEYS } from '@/constants/property-types';
import { createPropertyWithPolicy } from '@/services/property/property-mutation-gateway';
import { useGuardedPropertyMutation } from '@/hooks/useGuardedPropertyMutation';
import { translatePropertyMutationError } from '@/services/property/property-mutation-feedback';
import { translatePolicyError, isKnownPolicyErrorCode } from '@/lib/policy';
// ADR-284 Batch 7: SSoT hierarchy validation + inline new-unit UI
import { NewUnitHierarchySection } from '@/components/properties/shared/NewUnitHierarchySection';
import { validatePropertyCreationFields, isStandaloneUnitType } from '@/hooks/properties/usePropertyCreateValidation';
const logger = createModuleLogger('PropertyFieldsBlock');

interface PropertyFieldsBlockProps {
  property: Property;
  isReadOnly?: boolean;
  isEditMode?: boolean;
  onExitEditMode?: () => void;
  /** Whether we are creating a new unit (inline form) */
  isCreatingNewUnit?: boolean;
  /** Callback when new unit is successfully created */
  onPropertyCreated?: (propertyId: string) => void;
  /** Controlled active level — synchronized with MultiLevelNavigation */
  activeLevelId?: string | null;
  /** Callback when user selects a level tab — updates shared state in parent */
  onActiveLevelChange?: (levelId: string | null) => void;
  /** ADR-233: Auto-save fields to Firestore on floor/type change (code, name, type) */
  onAutoSaveFields?: (fields: Partial<Record<string, unknown>>) => void;
}

export function PropertyFieldsBlock({
  property,
  isReadOnly = false,
  isEditMode = false,
  onExitEditMode,
  isCreatingNewUnit = false,
  onPropertyCreated,
  activeLevelId: controlledLevelId,
  onActiveLevelChange,
  onAutoSaveFields,
}: PropertyFieldsBlockProps) {
  const { t } = useTranslation('properties');
  // ADR-284: policy errors live in the shared `building` i18n namespace
  const { t: tPolicy } = useTranslation('building');
  useSpacingTokens(); // reserved — hook must be called for React consistency
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const typography = useTypography();

  const { success, error: notifyError } = useNotifications();
  const { runExistingPropertyUpdate, ImpactDialog } = useGuardedPropertyMutation(property);
  const [localEditing, setLocalEditing] = useState(false);
  const isEditing = isEditMode || localEditing;
  const [, setIsSaving] = useState(false);
  const [codeOverridden, setCodeOverridden] = useState(!!property.code);

  // ADR-233: Track type locally for instant code suggestion response
  const [localType, setLocalType] = useState(property.type ?? '');
  useEffect(() => {
    setLocalType(property.type ?? '');
  }, [property.type]);

  const nameUserEdited = useRef(!isCreatingNewUnit);
  const buildSuggestedName = useCallback((unitType: string, areaNet: number): string => {
    const typeKey = PROPERTY_TYPE_I18N_KEYS[unitType as keyof typeof PROPERTY_TYPE_I18N_KEYS];
    const typeLabel = typeKey ? t(typeKey) : unitType;
    if (areaNet > 0) {
      return `${typeLabel} ${areaNet} ${t('units.sqm')}`;
    }
    return typeLabel;
  }, [t]);

  const prevCodeInputsRef = useRef({
    buildingId: property.buildingId,
    floor: property.floor,
    type: localType,
  });

  const prevServerCodeRef = useRef(property.code);
  const prevServerNameRef = useRef(property.name);
  const prevServerTypeRef = useRef(property.type);
  const codeRegenerationPending = useRef(false);

  // Field locking based on commercialStatus
  const currentCommercialStatus = (property.commercialStatus ?? 'unavailable') as CommercialStatus;
  const isReservedOrSold = (['reserved', 'sold', 'rented'] as CommercialStatus[]).includes(currentCommercialStatus);
  const isSoldOrRented = (['sold', 'rented'] as CommercialStatus[]).includes(currentCommercialStatus);

  const [formData, setFormData] = useState<PropertyFieldsFormData>({
    name: property.name ?? '', code: property.code ?? '', type: property.type ?? '',
    projectId: (property as unknown as Record<string, unknown>).projectId as string ?? '',
    buildingId: property.buildingId ?? '', floorId: property.floorId ?? '',
    operationalStatus: ((property as unknown as Record<string, unknown>).operationalStatus as OperationalStatus) ?? 'draft',
    commercialStatus: (property.commercialStatus ?? 'unavailable') as CommercialStatus,
    description: property.description ?? '',
    floor: property.floor ?? 0,
    bedrooms: property.layout?.bedrooms ?? 0,
    bathrooms: property.layout?.bathrooms ?? 0,
    wc: property.layout?.wc ?? 0,
    areaGross: property.areas?.gross ?? 0,
    areaNet: property.areas?.net ?? 0,
    areaBalcony: property.areas?.balcony ?? 0,
    areaTerrace: property.areas?.terrace ?? 0,
    areaGarden: property.areas?.garden ?? 0,
    orientations: property.orientations ?? [],
    condition: property.condition ?? '',
    energyClass: property.energy?.class ?? '',
    heatingType: property.systemsOverride?.heatingType ?? '',
    coolingType: property.systemsOverride?.coolingType ?? '',
    flooring: property.finishes?.flooring ?? [],
    windowFrames: property.finishes?.windowFrames ?? '',
    glazing: property.finishes?.glazing ?? '',
    interiorFeatures: property.interiorFeatures ?? [],
    securityFeatures: property.securityFeatures ?? [],
    levelData: property.levelData ?? {} as Record<string, LevelData>,
    levels: property.levels ?? [],
    askingPrice: property.commercial?.askingPrice?.toString() ?? '',
  });

  // ADR-233 + ADR-284 Batch 7: Code suggestion inputs
  // Create mode: live inputs from formData (user editing via NewUnitHierarchySection)
  // Edit mode: from property prop (Firestore state)
  const codeBuildingId = isCreatingNewUnit ? formData.buildingId : (property.buildingId ?? '');
  const codeFloorId = isCreatingNewUnit ? formData.floorId : (property.floorId ?? '');
  const codeFloorLevel = isCreatingNewUnit ? formData.floor : (property.floor ?? 0);

  useEffect(() => {
    const prev = prevCodeInputsRef.current;
    const changed =
      codeBuildingId !== prev.buildingId ||
      codeFloorLevel !== prev.floor ||
      localType !== prev.type;
    if (changed) {
      codeRegenerationPending.current = true;
      setCodeOverridden(false);
      setFormData(p => ({ ...p, code: '' }));
      prevCodeInputsRef.current = {
        buildingId: codeBuildingId,
        floor: codeFloorLevel,
        type: localType,
      };
    }
  }, [codeBuildingId, codeFloorLevel, localType]);

  const hasAllCodeInputs = !!codeBuildingId && !!localType && !!codeFloorId;

  const { suggestedCode, isLoading: codeLoading } = useEntityCodeSuggestion({
    entityType: 'property',
    buildingId: codeBuildingId,
    floorLevel: codeFloorLevel,
    propertyType: (localType as PropertyType) || undefined,
    disabled: codeOverridden || !hasAllCodeInputs,
  });

  // ADR-233: Contextual placeholder — tells user what's missing before code can be generated
  const codePlaceholderHint = !codeBuildingId
    ? t('entityCode.needBuilding')
    : !localType
      ? t('entityCode.needType')
      : !codeFloorId
        ? t('entityCode.needFloor')
        : suggestedCode || t('fields.identity.codePlaceholder');

  // ADR-236 Phase 4: Auto-create levels during creation mode
  const autoLevel = useAutoLevelCreation({
    buildingId: isCreatingNewUnit ? (formData.buildingId || null) : null,
    currentFloorId: isCreatingNewUnit ? (formData.floorId || null) : null,
    currentFloorNumber: isCreatingNewUnit ? formData.floor : null,
    hasExistingLevels: formData.levels.length >= 2,
    onUpdateProperty: (updates) => {
      if (updates.levels) {
        const newLevels = updates.levels as PropertyLevel[];
        setFormData(prev => ({
          ...prev,
          levels: newLevels,
          levelData: Object.fromEntries(
            newLevels.map(l => [l.floorId, prev.levelData[l.floorId] ?? {}])
          ),
        }));
        // Auto-select first level tab
        onActiveLevelChange?.(newLevels[0]?.floorId ?? null);
      }
    },
  });

  // ADR-236: Hierarchy lock (creation) + multi-level detection
  const isStandalone = isStandaloneUnitType(formData.type as PropertyType | '');
  const isHierarchyComplete = isStandalone ? !!formData.type : !!(formData.type && formData.buildingId && formData.floorId);
  const isHierarchyLocked = !!isCreatingNewUnit && !isHierarchyComplete;
  const isMultiLevel = isCreatingNewUnit ? formData.levels.length >= 2 : !!(property.isMultiLevel && (property.levels?.length ?? 0) >= 2);
  const effectiveLevels: PropertyLevel[] = isCreatingNewUnit ? formData.levels : (property.levels ?? []);

  const activeLevelId = controlledLevelId ?? null;
  const setActiveLevelId = useCallback((id: string | null) => {
    onActiveLevelChange?.(id);
  }, [onActiveLevelChange]);

  const currentLevelData: LevelData | null = activeLevelId
    ? (formData.levelData[activeLevelId] ?? {})
    : null;
  const aggregatedTotals = isMultiLevel && Object.keys(formData.levelData).length > 0
    ? aggregateLevelData(formData.levelData)
    : null;

  // ── Update a specific level's data ──
  const updateLevelField = useCallback(<K extends keyof LevelData>(
    field: K,
    value: LevelData[K]
  ) => {
    if (!activeLevelId) return; // Totals tab is read-only
    setFormData(prev => ({
      ...prev,
      levelData: {
        ...prev.levelData,
        [activeLevelId]: {
          ...prev.levelData[activeLevelId],
          [field]: value,
        },
      },
    }));
  }, [activeLevelId]);

  useEffect(() => {
    const serverCodeChanged = property.code !== prevServerCodeRef.current;
    const serverNameChanged = property.name !== prevServerNameRef.current;
    const serverTypeChanged = property.type !== prevServerTypeRef.current;
    prevServerCodeRef.current = property.code;
    prevServerNameRef.current = property.name;
    prevServerTypeRef.current = property.type;

    setFormData(prev => ({
      ...prev,
      ...(serverNameChanged ? { name: property.name ?? '' } : {}),
      ...(serverCodeChanged ? { code: property.code ?? '' } : {}),
      ...(serverTypeChanged ? { type: property.type ?? '' } : {}),
      projectId: (property as unknown as Record<string, unknown>).projectId as string ?? '',
      buildingId: property.buildingId ?? '',
      floorId: property.floorId ?? '',
      operationalStatus: ((property as unknown as Record<string, unknown>).operationalStatus as OperationalStatus) ?? 'draft',
      commercialStatus: (property.commercialStatus ?? 'unavailable') as CommercialStatus,
      description: property.description ?? '',
      floor: property.floor ?? 0,
      bedrooms: property.layout?.bedrooms ?? 0, bathrooms: property.layout?.bathrooms ?? 0, wc: property.layout?.wc ?? 0,
      areaGross: property.areas?.gross ?? 0, areaNet: property.areas?.net ?? 0,
      areaBalcony: property.areas?.balcony ?? 0, areaTerrace: property.areas?.terrace ?? 0, areaGarden: property.areas?.garden ?? 0,
      orientations: property.orientations ?? [], condition: property.condition ?? '',
      energyClass: property.energy?.class ?? '',
      heatingType: property.systemsOverride?.heatingType ?? '', coolingType: property.systemsOverride?.coolingType ?? '',
      flooring: property.finishes?.flooring ?? [], windowFrames: property.finishes?.windowFrames ?? '', glazing: property.finishes?.glazing ?? '',
      interiorFeatures: property.interiorFeatures ?? [], securityFeatures: property.securityFeatures ?? [],
      levelData: property.levelData ?? {} as Record<string, LevelData>,
      levels: property.levels ?? [],
      askingPrice: property.commercial?.askingPrice?.toString() ?? '',
    }));
  }, [property]);

  useEffect(() => {
    if (suggestedCode && !codeOverridden && !formData.code) {
      setFormData(prev => ({ ...prev, code: suggestedCode }));
      if (codeRegenerationPending.current && onAutoSaveFields) {
        codeRegenerationPending.current = false;
        onAutoSaveFields({ code: suggestedCode });
      }
    }
  }, [suggestedCode, codeOverridden, formData.code, onAutoSaveFields]);

  // ── Build updates from form data (delegated to SSoT mapper) ──
  const buildUpdatesFromForm = useCallback(
    (): Partial<Property> =>
      buildPropertyUpdatesFromForm({ formData, property, suggestedCode, isMultiLevel }),
    [formData, property, suggestedCode, isMultiLevel],
  );

  // ── Save handler ──
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const updates = buildUpdatesFromForm();

      if (isCreatingNewUnit) {
        // 🏢 ENTERPRISE ADR-284 Batch 7: Client-side discriminated validation
        // via shared SSoT hook (mirrors server policy — fail-fast UX).
        const hierarchy = validatePropertyCreationFields({
          name: formData.name,
          type: formData.type as import('@/types/property').PropertyType | '',
          projectId: formData.projectId,
          buildingId: formData.buildingId,
          floorId: formData.floorId,
        });
        if (!hierarchy.isValid) {
          // Surface first error to user — shared i18n keys
          const firstKey = Object.values(hierarchy.errors)[0];
          notifyError(t(firstKey ?? 'dialog.addUnit.validation.typeRequired'));
          return;
        }

        // 🏢 ENTERPRISE: Create new unit via server-side API (Admin SDK)
        const propertyData = buildCreationPayload({
          formData, updates, suggestedCode: suggestedCode || '',
          defaultName: t('navigation.actions.newUnit.defaultName'),
        });
        const result = await createPropertyWithPolicy({ propertyData });
        if (!result.success) {
          // 🏢 ADR-284: If the server returned a known policy error code,
          // show the localized message from the central translator.
          if (isKnownPolicyErrorCode(result.errorCode)) {
            notifyError(
              translatePolicyError(
                result.errorCode,
                tPolicy,
                result.error ?? 'Unit creation failed',
                { type: String(propertyData.type ?? '') },
              ),
            );
            return;
          }
          throw new Error(result.error ?? 'Unit creation failed');
        }
        if (result.propertyId && onPropertyCreated) {
          onPropertyCreated(result.propertyId);
        }
        success(t('save.createSuccess'));
      } else {
        // Normal update
        await runExistingPropertyUpdate({
          commercialStatus: property.commercialStatus,
          buildingId: property.buildingId,
          floorId: property.floorId,
        }, updates as Partial<Property> & Record<string, unknown>, async () => {
          if (onExitEditMode) { onExitEditMode(); } else { setLocalEditing(false); }
          success(t('save.success'));
        });
      }
    } catch (error) {
      notifyError(translatePropertyMutationError(error, t));
      logger.error('PropertyFieldsBlock save error:', { error });
    } finally {
      setIsSaving(false);
    }
  }, [buildUpdatesFromForm, formData.areaGross, formData.floor, formData.name, formData.type,
    formData.projectId, formData.buildingId, formData.floorId, formData.levels.length,
    isCreatingNewUnit, onExitEditMode, onPropertyCreated, property.id, property.buildingId,
    property.commercialStatus, property.floorId, runExistingPropertyUpdate, suggestedCode,
    success, notifyError, t]);

  // ── Toggle multi-select ──
  const toggleArrayItem = useCallback(<T extends string>(
    field: 'orientations' | 'flooring' | 'interiorFeatures' | 'securityFeatures',
    value: T
  ) => {
    setFormData(prev => {
      const current = prev[field] as T[];
      const isSelected = current.includes(value);
      return {
        ...prev,
        [field]: isSelected ? current.filter(item => item !== value) : [...current, value]
      };
    });
  }, []);

  // ── Read-Only Compact Mode (Ευρετήριο Ακινήτων) ──
  // Plain text, 2-column grid, no form fields — all hooks above are called unconditionally
  if (isReadOnly) {
    return <ReadOnlyCompactView property={property} t={t} />;
  }

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
          const area = prev.areaGross;
          updated.name = buildSuggestedName(patch.type as string, area);
        }
        return updated;
      });
      if (patch.type !== undefined) {
        setLocalType(patch.type);
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
    [autoLevel, buildSuggestedName, formData.levels.length, formData.floorId, formData.floor, isCreatingNewUnit, localType],
  );

  const handleTypeChange = useCallback((newType: string) => {
    setLocalType(newType);
    nameUserEdited.current = false;
    const newName = buildSuggestedName(newType, formData.areaGross);
    setFormData(prev => ({ ...prev, name: newName }));
    if (onAutoSaveFields) onAutoSaveFields({ type: newType, name: newName });
    if (isCreatingNewUnit && formData.floorId) {
      autoLevel.triggerAutoLevelCreation(newType, formData.floorId, formData.floor);
    }
  }, [autoLevel, buildSuggestedName, formData.areaGross, formData.floor, formData.floorId, isCreatingNewUnit, onAutoSaveFields]);

  const handleNameManualEdit = useCallback((value: string) => {
    nameUserEdited.current = true;
    setFormData(prev => ({ ...prev, name: value }));
  }, []);

  const handleAreaChange = useCallback((areaKey: 'net' | 'gross', value: number) => {
    if (areaKey === 'gross' && !nameUserEdited.current) {
      setFormData(prev => ({ ...prev, name: buildSuggestedName(localType, value) }));
    }
  }, [buildSuggestedName, localType]);

  return (
    <>
      {isCreatingNewUnit && (
        <NewUnitHierarchySection
          selection={{
            type: formData.type as PropertyType | '',
            projectId: formData.projectId,
            buildingId: formData.buildingId,
            floorId: formData.floorId,
            floor: formData.floor,
          }}
          onChange={handleHierarchyChange}
        />
      )}
      <PropertyFieldsEditForm
        formData={formData}
        setFormData={setFormData}
        property={property}
        isEditing={isEditing}
        isCreatingNewUnit={isCreatingNewUnit}
        isReservedOrSold={isReservedOrSold}
        isHierarchyLocked={isHierarchyLocked}
        isSoldOrRented={isSoldOrRented}
        isMultiLevel={!!isMultiLevel}
        effectiveLevels={effectiveLevels}
        activeLevelId={activeLevelId}
        setActiveLevelId={setActiveLevelId}
        currentLevelData={currentLevelData}
        aggregatedTotals={aggregatedTotals}
        toggleArrayItem={toggleArrayItem}
        updateLevelField={updateLevelField}
        handleSave={handleSave}
        suggestedCode={suggestedCode || ''}
        codePlaceholderHint={codePlaceholderHint}
        codeOverridden={codeOverridden}
        setCodeOverridden={setCodeOverridden}
        codeLoading={codeLoading}
        onTypeChange={handleTypeChange}
        onNameManualEdit={handleNameManualEdit}
        onAreaChange={handleAreaChange}
        t={t}
        typography={typography}
        iconSizes={iconSizes}
        quick={quick}
      />
      {ImpactDialog}

      <AutoLevelDialogs dialogState={autoLevel.dialogState} onConfirm={autoLevel.handleDialogConfirm} onDismiss={autoLevel.handleDialogDismiss} />
    </>
  );
}

export default PropertyFieldsBlock;
