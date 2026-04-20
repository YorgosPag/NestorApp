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
import type { CommercialStatus, LevelData, PropertyLevel } from '@/types/property';
import { aggregateLevelData } from '@/services/multi-level.service';
import { useAutoLevelCreation } from '../hooks/useAutoLevelCreation';
import { AutoLevelDialogs } from './AutoLevelDialogs';
import { createModuleLogger } from '@/lib/telemetry';
import { ReadOnlyCompactView } from './PropertyFieldsReadOnly';
import { PropertyFieldsEditForm } from './PropertyFieldsEditForm';
import type { PropertyFieldsFormData } from './property-fields-form-types';
import { buildPropertyUpdatesFromForm } from './property-fields-form-mapper';
import { buildCreationPayload } from './property-fields-save-handler';
import type { PropertyType } from '@/types/property';
import { PROPERTY_TYPE_I18N_KEYS } from '@/constants/property-types';
import { usePropertyFieldHandlers } from './usePropertyFieldHandlers';
import { usePropertyFormSync } from '@/hooks/properties/usePropertyFormSync';
import { buildFormDataFromProperty } from '@/services/property/property-form-sync';
import { createPropertyWithPolicy } from '@/services/property/property-mutation-gateway';
import { useGuardedPropertyMutation } from '@/hooks/useGuardedPropertyMutation';
import { translatePropertyMutationError } from '@/services/property/property-mutation-feedback';
import { translatePolicyError, isKnownPolicyErrorCode } from '@/lib/policy';
// ADR-284 Batch 7: SSoT hierarchy validation + inline new-unit UI
import { NewUnitHierarchySection } from '@/components/properties/shared/NewUnitHierarchySection';
import { validatePropertyCreationFields, isStandaloneUnitType } from '@/hooks/properties/usePropertyCreateValidation';
import { isMultiLevelCapableType, ENTITY_TYPES } from '@/config/domain-constants';
// ADR-287 Batch 28: completion meter
import { PropertyCompletionMeter } from './PropertyCompletionMeter';
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
  const { t } = useTranslation(['properties', 'properties-detail', 'properties-enums', 'properties-viewer']);
  const { t: tPolicy } = useTranslation(['building', 'building-address', 'building-filters', 'building-storage', 'building-tabs', 'building-timeline']);
  useSpacingTokens();
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const typography = useTypography();
  const { success, error: notifyError } = useNotifications();
  const { runExistingPropertyUpdate, ImpactDialog } = useGuardedPropertyMutation(property);
  const [localEditing, setLocalEditing] = useState(false);
  const isEditing = isEditMode || localEditing;
  const [, setIsSaving] = useState(false);
  // Latest suggestion received from EntityCodeField — used as fallback in save payloads (ADR-233)
  const [latestSuggestion, setLatestSuggestion] = useState<string | null>(null);

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
    buildingId: property.buildingId ?? '',
    floor: property.floor ?? 0,
    type: localType,
  });
  // Track property ID to distinguish card-switch vs in-place field edit
  const prevPropertyIdRef = useRef(property.id);

  const codeRegenerationPending = useRef(false);
  // Distinguishes save-exit from cancel-exit so form resets correctly on cancel
  const editExitWasSaveRef = useRef(false);
  const currentCommercialStatus = (property.commercialStatus ?? 'unavailable') as CommercialStatus;
  const isReservedOrSold = (['reserved', 'sold', 'rented'] as CommercialStatus[]).includes(currentCommercialStatus);
  const isSoldOrRented = (['sold', 'rented'] as CommercialStatus[]).includes(currentCommercialStatus);
  const [formData, setFormData] = useState<PropertyFieldsFormData>(() => buildFormDataFromProperty(property));
  // ADR-287 Batch 23: per-field server↔form reconciliation (preserves unsaved user edits)
  usePropertyFormSync(property, setFormData);

  // ADR-233 + ADR-284 Batch 7: Code suggestion inputs
  // Create mode: live inputs from formData (user editing via NewUnitHierarchySection)
  // Edit mode: from property prop (Firestore state)
  const codeBuildingId = isCreatingNewUnit ? formData.buildingId : (property.buildingId ?? '');
  const codeFloorId = isCreatingNewUnit ? formData.floorId : (property.floorId ?? '');
  const codeFloorLevel = isCreatingNewUnit ? formData.floor : (property.floor ?? 0);

  useEffect(() => {
    const propertyChanged = property.id !== prevPropertyIdRef.current;
    if (propertyChanged) {
      // Card switch: sync refs, reset code state, but do NOT mark regeneration pending
      // — auto-save should never fire from simply clicking a different card
      prevPropertyIdRef.current = property.id;
      prevCodeInputsRef.current = {
        buildingId: codeBuildingId,
        floor: codeFloorLevel,
        type: localType,
      };
      setFormData(p => ({ ...p, code: property.code ?? '' }));
      return;
    }
    const prev = prevCodeInputsRef.current;
    const changed =
      codeBuildingId !== prev.buildingId ||
      codeFloorLevel !== prev.floor ||
      localType !== prev.type;
    if (changed) {
      codeRegenerationPending.current = true;
      // Clear code — EntityCodeField detects empty value and resets its override state,
      // allowing the next auto-suggestion to be applied automatically.
      setFormData(p => ({ ...p, code: '' }));
      prevCodeInputsRef.current = {
        buildingId: codeBuildingId,
        floor: codeFloorLevel,
        type: localType,
      };
    }
  }, [codeBuildingId, codeFloorLevel, localType, property.id, property.code]);

  // Reset form state on cancel (isEditing false after a non-save exit).
  // Prevents stale formData from showing edited values in view mode and next edit session.
  const prevIsEditingRef = useRef(isEditing);
  useEffect(() => {
    const wasEditing = prevIsEditingRef.current;
    prevIsEditingRef.current = isEditing;
    if (wasEditing && !isEditing) {
      if (!editExitWasSaveRef.current) {
        setFormData(buildFormDataFromProperty(property));
        setLocalType(property.type ?? '');
        codeRegenerationPending.current = false;
        prevCodeInputsRef.current = {
          buildingId: property.buildingId ?? '',
          floor: property.floor ?? 0,
          type: property.type ?? '',
        };
      }
      editExitWasSaveRef.current = false;
    }
  }, [isEditing, property]);

  // ADR-233: Gate suggestion — EntityCodeField receives empty buildingId when
  // hierarchy is incomplete, which naturally disables the auto-suggest hook.
  const hasAllCodeInputs = !!codeBuildingId && !!localType && !!codeFloorId;
  const handleLevelsChange = useCallback((newLevels: PropertyLevel[]) => {
    setFormData(prev => ({
      ...prev,
      levels: newLevels,
      levelData: Object.fromEntries(newLevels.map(l => [l.floorId, prev.levelData[l.floorId] ?? {}])),
    }));
    onActiveLevelChange?.(newLevels[0]?.floorId ?? null);
  }, [onActiveLevelChange]);
  // ADR-236: Clear floor + levels when "no next floor" warning cancel is pressed
  const handleWarningDismiss = useCallback(() => {
    setFormData(prev => ({ ...prev, floorId: '', floor: 0, levels: [], levelData: {} }));
    onActiveLevelChange?.(null);
  }, [onActiveLevelChange]);
  // ADR-236 Phase 5 (Batch 22): Auto-level creation runs in BOTH create and edit modes
  // for bidirectional symmetry. In edit mode, derived field changes are persisted
  // immediately via `onAutoSaveFields` (no need to wait for Save).
  const autoLevel = useAutoLevelCreation({
    buildingId: formData.buildingId || null,
    currentFloorId: formData.floorId || null,
    currentFloorNumber: formData.floor,
    hasExistingLevels: formData.levels.length >= 2,
    onUpdateProperty: (updates) => {
      if (updates.levels) handleLevelsChange(updates.levels as PropertyLevel[]);
      if (!isCreatingNewUnit && onAutoSaveFields) {
        const payload: Record<string, unknown> = {};
        if (updates.levels !== undefined) payload.levels = updates.levels;
        if (updates.isMultiLevel !== undefined) payload.isMultiLevel = updates.isMultiLevel;
        if (updates.floor !== undefined) payload.floor = updates.floor;
        if (updates.floorId !== undefined) payload.floorId = updates.floorId;
        if (Object.keys(payload).length > 0) onAutoSaveFields(payload);
      }
    },
    onWarningDismiss: isCreatingNewUnit ? handleWarningDismiss : undefined,
  });

  const isStandalone = isStandaloneUnitType(formData.type as PropertyType | '');
  const isHierarchyComplete = isStandalone ? !!formData.type : !!(formData.type && formData.buildingId && formData.floorId);
  const isHierarchyLocked = !!isCreatingNewUnit && !isHierarchyComplete;
  // ADR-236 Phase 5 (Batch 22): SSoT derive from formData in BOTH modes.
  // Previously edit-mode read property.* — orphan tabs survived type changes.
  const isMultiLevel = isMultiLevelCapableType(formData.type) && formData.levels.length >= 2;
  const effectiveLevels: PropertyLevel[] = formData.levels;

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

  const buildUpdatesFromForm = useCallback(
    (): Partial<Property> =>
      buildPropertyUpdatesFromForm({ formData, property, suggestedCode: latestSuggestion, isMultiLevel }),
    [formData, property, latestSuggestion, isMultiLevel],
  );

  // ADR-233: Called by EntityCodeField.onChange — keeps formData.code in sync
  const handleCodeChange = useCallback((code: string) => {
    setFormData(prev => ({ ...prev, code }));
  }, []);

  // ADR-233: Called by EntityCodeField.onAutoApply — triggers auto-save after input change
  const handleCodeAutoApply = useCallback((code: string) => {
    if (codeRegenerationPending.current && onAutoSaveFields) {
      codeRegenerationPending.current = false;
      onAutoSaveFields({ code });
    }
  }, [onAutoSaveFields]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const updates = buildUpdatesFromForm();

      if (isCreatingNewUnit) {
        // ADR-284 Batch 7: Client-side discriminated validation (mirrors server policy)
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

        const propertyData = buildCreationPayload({
          formData, updates, suggestedCode: latestSuggestion || '',
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
        await runExistingPropertyUpdate({
          commercialStatus: property.commercialStatus,
          buildingId: property.buildingId,
          floorId: property.floorId,
        }, updates as Partial<Property> & Record<string, unknown>, async () => {
          editExitWasSaveRef.current = true;
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
    property.commercialStatus, property.floorId, runExistingPropertyUpdate, latestSuggestion,
    success, notifyError, t]);

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

  const { handleHierarchyChange, handleTypeChange, handleNameManualEdit, handleAreaChange } =
    usePropertyFieldHandlers({
      formData, setFormData, setLocalType, localType,
      nameUserEdited, buildSuggestedName,
      onActiveLevelChange, onAutoSaveFields,
      autoLevel,
    });

  if (isReadOnly) {
    return <ReadOnlyCompactView property={property} t={t} />;
  }

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
      {/* ADR-287 Batch 28: completion meter — Google profile-strength pattern. */}
      {/* Hidden during creation (nothing to measure) + read-only branch unreachable here. */}
      {!isCreatingNewUnit && !isReadOnly && (
        <PropertyCompletionMeter
          property={property}
          formData={formData}
          effectiveLevels={effectiveLevels}
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
        onLevelsChange={isCreatingNewUnit ? handleLevelsChange : undefined}
        creationBuildingId={isCreatingNewUnit ? (formData.buildingId || null) : null}
        creationProjectId={isCreatingNewUnit ? (formData.projectId || null) : null}
        needsFloorCreation={autoLevel.needsFloorCreation}
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
        codeBuildingId={hasAllCodeInputs ? codeBuildingId : ''}
        codeFloorLevel={codeFloorLevel}
        codePropertyType={(localType as PropertyType) || undefined}
        onCodeChange={handleCodeChange}
        onCodeAutoApply={handleCodeAutoApply}
        onSuggestionChange={setLatestSuggestion}
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
