/**
 * 🏢 ENTERPRISE: Property Fields Block Component
 * Displays and edits extended property fields (layout, areas, orientations, etc.)
 */

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
import type { CommercialStatus, OperationalStatus, LevelData } from '@/types/property';
import { aggregateLevelData } from '@/services/multi-level.service';
import { createModuleLogger } from '@/lib/telemetry';
import { useEntityCodeSuggestion } from '@/hooks/useEntityCodeSuggestion';
import { ReadOnlyCompactView } from './PropertyFieldsReadOnly';
import { PropertyFieldsEditForm } from './PropertyFieldsEditForm';
import type { PropertyFieldsFormData } from './property-fields-form-types';
import { buildPropertyUpdatesFromForm } from './property-fields-form-mapper';
import type { PropertyType } from '@/types/property';
import { PROPERTY_TYPE_I18N_KEYS } from '@/constants/property-types';
import { createPropertyWithPolicy } from '@/services/property/property-mutation-gateway';
import { useGuardedPropertyMutation } from '@/hooks/useGuardedPropertyMutation';
import { translatePropertyMutationError } from '@/services/property/property-mutation-feedback';
import { translatePolicyError, isKnownPolicyErrorCode } from '@/lib/policy';
// ADR-284 Batch 7: SSoT hierarchy validation + inline new-unit UI
import { NewUnitHierarchySection } from '@/components/properties/shared/NewUnitHierarchySection';
import {
  validatePropertyCreationFields,
  isStandaloneUnitType,
} from '@/hooks/properties/usePropertyCreateValidation';
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
}

// =============================================================================
// COMPONENT
// =============================================================================

export function PropertyFieldsBlock({
  property,
  isReadOnly = false,
  isEditMode = false,
  onExitEditMode,
  isCreatingNewUnit = false,
  onPropertyCreated,
  activeLevelId: controlledLevelId,
  onActiveLevelChange,
}: PropertyFieldsBlockProps) {
  const { t } = useTranslation('properties');
  // ADR-284: policy errors live in the shared `building` i18n namespace
  const { t: tPolicy } = useTranslation('building');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- reserved for future spacing tokens
  const _spacing = useSpacingTokens();
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const typography = useTypography();

  const { success, error: notifyError } = useNotifications();
  const { runExistingPropertyUpdate, ImpactDialog } = useGuardedPropertyMutation(property);
  const [localEditing, setLocalEditing] = useState(false);
  const isEditing = isEditMode || localEditing;
  const [, setIsSaving] = useState(false);
  const [codeOverridden, setCodeOverridden] = useState(!!property.code);

  // ADR-233: Track type locally — responds instantly to form dropdown changes
  // (property.type only updates after Firestore save, but code suggestion needs immediate response)
  const [localType, setLocalType] = useState(property.type ?? '');
  useEffect(() => {
    setLocalType(property.type ?? '');
  }, [property.type]);

  // ── Auto-suggest name based on type + area ──
  // Tracks whether user manually edited the name field.
  const nameUserEdited = useRef(!isCreatingNewUnit); // Existing units: don't auto-overwrite

  const buildSuggestedName = useCallback((unitType: string, areaNet: number): string => {
    const typeKey = PROPERTY_TYPE_I18N_KEYS[unitType as keyof typeof PROPERTY_TYPE_I18N_KEYS];
    const typeLabel = typeKey ? t(typeKey) : unitType;
    if (areaNet > 0) {
      return `${typeLabel} ${areaNet} ${t('units.sqm')}`;
    }
    return typeLabel;
  }, [t]);

  // ADR-233: Track building/floor/type to detect changes requiring code regeneration
  const prevCodeInputsRef = useRef({
    buildingId: property.buildingId,
    floor: property.floor,
    type: localType,
  });

  // ── Field locking based on commercialStatus ──
  // reserved: identity fields locked (code, name, type)
  // sold/rented: identity + physical fields locked (areas, layout, floor, commercialStatus)
  const currentCommercialStatus = (property.commercialStatus ?? 'unavailable') as CommercialStatus;
  const isReservedOrSold = (['reserved', 'sold', 'rented'] as CommercialStatus[]).includes(currentCommercialStatus);
  const isSoldOrRented = (['sold', 'rented'] as CommercialStatus[]).includes(currentCommercialStatus);

  const [formData, setFormData] = useState<PropertyFieldsFormData>({
    name: property.name ?? '',
    code: property.code ?? '',
    type: property.type ?? '',
    // ADR-284 Batch 7: Hierarchy fields
    projectId: (property as unknown as Record<string, unknown>).projectId as string ?? '',
    buildingId: property.buildingId ?? '',
    floorId: property.floorId ?? '',
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
    askingPrice: property.commercial?.askingPrice?.toString() ?? '',
  });

  // ADR-233 + ADR-284 Batch 7: Code suggestion inputs
  // Create mode: live inputs from formData (user editing via NewUnitHierarchySection)
  // Edit mode: from property prop (Firestore state)
  const codeBuildingId = isCreatingNewUnit ? formData.buildingId : (property.buildingId ?? '');
  const codeFloorId = isCreatingNewUnit ? formData.floorId : (property.floorId ?? '');
  const codeFloorLevel = isCreatingNewUnit ? formData.floor : (property.floor ?? 0);

  // ADR-233: Reset code when building, floor, or type changes — request new suggestion
  useEffect(() => {
    const prev = prevCodeInputsRef.current;
    const changed =
      codeBuildingId !== prev.buildingId ||
      codeFloorLevel !== prev.floor ||
      localType !== prev.type;
    if (changed) {
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

  // ── ADR-236 Phase 2: Active level tab (null = "Totals" tab) ──
  const isMultiLevel = property.isMultiLevel && (property.levels?.length ?? 0) >= 2;
  // Use controlled state from parent (bidirectional sync with MultiLevelNavigation)
  const activeLevelId = controlledLevelId ?? null;
  const setActiveLevelId = useCallback((id: string | null) => {
    onActiveLevelChange?.(id);
  }, [onActiveLevelChange]);

  // ── Computed: current level's data OR aggregated totals ──
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

  // ── Sync form data when property changes externally (e.g. floor via FloorSelectField) ──
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      name: property.name ?? '',
      code: property.code ?? '',
      type: property.type ?? '',
      projectId: (property as unknown as Record<string, unknown>).projectId as string ?? '',
      buildingId: property.buildingId ?? '',
      floorId: property.floorId ?? '',
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
      askingPrice: property.commercial?.askingPrice?.toString() ?? '',
    }));
  }, [property]);

  // ADR-233: Auto-populate code when suggestion arrives and code is empty
  // Runs regardless of isEditing so the code is visible immediately
  useEffect(() => {
    if (suggestedCode && !codeOverridden && !formData.code) {
      setFormData(prev => ({ ...prev, code: suggestedCode }));
    }
  }, [suggestedCode, codeOverridden, formData.code]);

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
        // Client-side setDoc blocked by Firestore rules — must use API endpoint
        const standalone = isStandaloneUnitType(formData.type as import('@/types/property').PropertyType | '');
        const propertyData = {
          ...updates,
          name: formData.name || t('navigation.actions.newUnit.defaultName'),
          code: formData.code || suggestedCode || '',
          type: formData.type || 'apartment',
          status: 'reserved' as const,
          operationalStatus: 'draft' as const,
          floor: standalone ? 0 : formData.floor,
          area: formData.areaGross,
          // ADR-284: Hierarchy fields — Family-discriminated
          projectId: formData.projectId,
          ...(standalone
            ? {}
            : { buildingId: formData.buildingId, floorId: formData.floorId }),
        };
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
  }, [
    buildUpdatesFromForm,
    formData.areaGross,
    formData.floor,
    formData.name,
    formData.type,
    formData.projectId,
    formData.buildingId,
    formData.floorId,
    isCreatingNewUnit,
    onExitEditMode,
    onPropertyCreated,
    property.id,
    property.buildingId,
    property.commercialStatus,
    property.floorId,
    runExistingPropertyUpdate,
    suggestedCode,
    success,
    notifyError,
    t,
  ]);

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

  // ADR-284 Batch 7: Handler για hierarchy changes από το NewUnitHierarchySection.
  // Συγχρονίζει projectId/buildingId/floorId/type στο formData.
  const handleHierarchyChange = useCallback(
    (patch: Partial<{ type: PropertyType | ''; projectId: string; buildingId: string; floorId: string; floor: number }>) => {
      // Auto-suggest name when type changes via hierarchy section (new unit creation)
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
    },
    [buildSuggestedName],
  );

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
        isSoldOrRented={isSoldOrRented}
        isMultiLevel={!!isMultiLevel}
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
        onTypeChange={(newType) => {
          setLocalType(newType);
          if (!nameUserEdited.current) {
            const area = formData.areaGross;
            setFormData(prev => ({ ...prev, name: buildSuggestedName(newType, area) }));
          }
        }}
        onNameManualEdit={(value) => {
          nameUserEdited.current = true;
          setFormData(prev => ({ ...prev, name: value }));
        }}
        onAreaChange={(areaKey, value) => {
          if (areaKey === 'gross' && !nameUserEdited.current) {
            setFormData(prev => ({ ...prev, name: buildSuggestedName(localType, value) }));
          }
        }}
        t={t}
        typography={typography}
        iconSizes={iconSizes}
        quick={quick}
      />
      {ImpactDialog}
    </>
  );
}

export default PropertyFieldsBlock;

