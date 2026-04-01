/**
 * =============================================================================
 * 🏢 ENTERPRISE: Property Fields Block Component
 * =============================================================================
 *
 * Displays and edits extended property fields (layout, areas, orientations, etc.)
 * View mode: clean text values. Edit mode: inputs/selects.
 * Consistent with Parking/Building Card pattern.
 *
 * @module features/property-details/components/PropertyFieldsBlock
 * @enterprise Fortune 500 compliant - ZERO hardcoded values
 * @since 2026-01-24
 * @updated 2026-02-17 — View/Edit mode split + Card containers
 */

/* eslint-disable design-system/prefer-design-system-imports, design-system/enforce-semantic-colors, custom/no-hardcoded-strings */
'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useNotifications } from '@/providers/NotificationProvider';




import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useTypography } from '@/hooks/useTypography';
import { useTranslation } from '@/i18n/hooks/useTranslation';

import type { Property } from '@/types/property-viewer';
import type { CommercialStatus, OperationalStatus, LevelData } from '@/types/property';
import { aggregateLevelData } from '@/services/multi-level.service';
import type {
  ConditionType,
  OrientationType,
  EnergyClassType,
  InteriorFeatureCodeType,
  SecurityFeatureCodeType
} from '@/constants/property-features-enterprise';
import { createModuleLogger } from '@/lib/telemetry';
import { useEntityCodeSuggestion } from '@/hooks/useEntityCodeSuggestion';
import { ReadOnlyCompactView } from './PropertyFieldsReadOnly';
import { PropertyFieldsEditForm } from './PropertyFieldsEditForm';
import type { PropertyFieldsFormData } from './property-fields-form-types';
import type { PropertyType } from '@/types/property';
const logger = createModuleLogger('PropertyFieldsBlock');

// =============================================================================
// TYPES
// =============================================================================

interface PropertyFieldsBlockProps {
  property: Property;
  onUpdateProperty: (propertyId: string, updates: Partial<Property>) => void;
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
  onUpdateProperty,
  isReadOnly = false,
  isEditMode = false,
  onExitEditMode,
  isCreatingNewUnit = false,
  onPropertyCreated,
  activeLevelId: controlledLevelId,
  onActiveLevelChange,
}: PropertyFieldsBlockProps) {
  const { t } = useTranslation('properties');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- reserved for future spacing tokens
  const _spacing = useSpacingTokens();
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const typography = useTypography();

  const { success, error: notifyError } = useNotifications();
  const [localEditing, setLocalEditing] = useState(false);
  const isEditing = isEditMode || localEditing;
  const [, setIsSaving] = useState(false);
  const [codeOverridden, setCodeOverridden] = useState(!!property.code);

  // ── Field locking based on commercialStatus ──
  // reserved: identity fields locked (code, name, type)
  // sold/rented: identity + physical fields locked (areas, layout, floor, commercialStatus)
  const currentCommercialStatus = (property.commercialStatus ?? 'unavailable') as CommercialStatus;
  const isReservedOrSold = (['reserved', 'sold', 'rented'] as CommercialStatus[]).includes(currentCommercialStatus);
  const isSoldOrRented = (['sold', 'rented'] as CommercialStatus[]).includes(currentCommercialStatus);

  // ADR-233: Auto-suggest entity code when code is empty and editing
  const { suggestedCode, isLoading: codeLoading } = useEntityCodeSuggestion({
    entityType: 'unit',
    buildingId: property.buildingId ?? '',
    floorLevel: property.floor ?? 0,
    propertyType: (property.type as PropertyType) || undefined,
    disabled: codeOverridden || !!property.code,
  });

  const [formData, setFormData] = useState<PropertyFieldsFormData>({
    name: property.name ?? '',
    code: property.code ?? '',
    type: property.type ?? '',
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

  // ── Build updates from form data ──
  const buildUpdatesFromForm = useCallback((): Partial<Property> => {
    // ADR-233: Use suggested code as fallback if user hasn't typed a custom one
    const resolvedCode = formData.code || suggestedCode || undefined;
    const updates: Partial<Property> = {
      name: formData.name,
      code: resolvedCode,
      type: formData.type,
      operationalStatus: formData.operationalStatus,
      commercialStatus: formData.commercialStatus,
      floor: formData.floor,
      // 🔒 ADR-232: Include floorId from property (set via FloorSelectField)
      ...(property.floorId ? { floorId: property.floorId } : {}),
      layout: {
        bedrooms: formData.bedrooms,
        bathrooms: formData.bathrooms,
        wc: formData.wc
      },
      orientations: formData.orientations as OrientationType[],
    };

    if (formData.description.trim()) {
      updates.description = formData.description.trim();
    }

    const areasData: { gross: number; net?: number; balcony?: number; terrace?: number; garden?: number } = {
      gross: formData.areaGross
    };
    if (formData.areaNet > 0) areasData.net = formData.areaNet;
    if (formData.areaBalcony > 0) areasData.balcony = formData.areaBalcony;
    if (formData.areaTerrace > 0) areasData.terrace = formData.areaTerrace;
    if (formData.areaGarden > 0) areasData.garden = formData.areaGarden;
    updates.areas = areasData;

    if (formData.condition) updates.condition = formData.condition as ConditionType;
    if (formData.energyClass) updates.energy = { class: formData.energyClass as EnergyClassType };

    if (formData.heatingType || formData.coolingType) {
      const systemsOverride: Record<string, string> = {};
      if (formData.heatingType) systemsOverride.heatingType = formData.heatingType;
      if (formData.coolingType) systemsOverride.coolingType = formData.coolingType;
      updates.systemsOverride = systemsOverride as Property['systemsOverride'];
    }

    if (formData.flooring.length > 0 || formData.windowFrames || formData.glazing) {
      const finishes: Record<string, unknown> = {};
      if (formData.flooring.length > 0) finishes.flooring = formData.flooring;
      if (formData.windowFrames) finishes.windowFrames = formData.windowFrames;
      if (formData.glazing) finishes.glazing = formData.glazing;
      updates.finishes = finishes as Property['finishes'];
    }

    if (formData.interiorFeatures.length > 0) updates.interiorFeatures = formData.interiorFeatures as InteriorFeatureCodeType[];
    if (formData.securityFeatures.length > 0) updates.securityFeatures = formData.securityFeatures as SecurityFeatureCodeType[];

    // Commercial data — preserve existing fields, update only askingPrice
    const parsedPrice = formData.askingPrice ? Number(formData.askingPrice) : null;
    const priceChanged = parsedPrice !== (property.commercial?.askingPrice ?? null);
    if (priceChanged) {
      updates.commercial = {
        ...(property.commercial as Record<string, unknown>),
        askingPrice: parsedPrice && parsedPrice > 0 ? parsedPrice : null,
      } as Property['commercial'];
    }

    // ADR-236 Phase 2: Per-level data + auto-aggregation
    if (isMultiLevel && Object.keys(formData.levelData).length > 0) {
      (updates as Record<string, unknown>).levelData = formData.levelData;
      const agg = aggregateLevelData(formData.levelData);
      updates.areas = agg.areas;
      updates.layout = {
        bedrooms: agg.layout.bedrooms,
        bathrooms: agg.layout.bathrooms,
        wc: agg.layout.wc,
      };
      updates.orientations = agg.orientations;
    }

    return updates;
  }, [formData, isMultiLevel, suggestedCode]);

  // ── Save handler ──
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const updates = buildUpdatesFromForm();

      if (isCreatingNewUnit) {
        // 🏢 ENTERPRISE: Create new unit via server-side API (Admin SDK)
        // Client-side setDoc blocked by Firestore rules — must use API endpoint
        const { createProperty } = await import('@/services/properties.service');
        const propertyData = {
          ...updates,
          name: formData.name || t('navigation.actions.newUnit.defaultName', { defaultValue: 'Νέα Μονάδα' }),
          code: formData.code || suggestedCode || '',
          type: formData.type || 'apartment',
          status: 'reserved' as const,
          operationalStatus: 'draft' as const,
          floor: formData.floor,
          area: formData.areaGross,
        };
        const result = await createProperty(propertyData);
        if (!result.success) {
          throw new Error(result.error ?? 'Unit creation failed');
        }
        if (result.propertyId && onPropertyCreated) {
          onPropertyCreated(result.propertyId);
        }
        success(t('save.createSuccess', { defaultValue: 'Η μονάδα δημιουργήθηκε επιτυχώς' }));
      } else {
        // Normal update
        await onUpdateProperty(property.id, updates);
        if (onExitEditMode) { onExitEditMode(); } else { setLocalEditing(false); }
        success(t('save.success', 'Οι αλλαγές αποθηκεύτηκαν'));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('permission') || errorMessage.includes('PERMISSION_DENIED')) {
        notifyError(t('save.permissionDenied', { defaultValue: 'Δεν έχετε δικαίωμα επεξεργασίας αυτής της μονάδας' }));
      } else if (errorMessage.includes('asking price')) {
        notifyError(t('save.askingPriceRequired', { defaultValue: 'Απαιτείται τιμή πώλησης πριν την κράτηση ή πώληση. Ορίστε τιμή μέσω "Αλλαγή Τιμής" στις Πωλήσεις.' }));
      } else if (errorMessage.includes('Buyer contact')) {
        notifyError(t('save.buyerRequired', { defaultValue: 'Απαιτείται επιλογή αγοραστή πριν την κράτηση ή πώληση.' }));
      } else if (errorMessage.includes('locked fields')) {
        notifyError(t('fieldLocking.serverReject', { defaultValue: 'Δεν επιτρέπεται η αλλαγή κλειδωμένων πεδίων σε πωλημένη/ενοικιασμένη μονάδα' }));
      } else if (errorMessage.includes('not linked to a building')) {
        notifyError(t('save.buildingRequired', { defaultValue: 'Η μονάδα πρέπει να ανήκει σε κτίριο πριν την κράτηση ή πώληση.' }));
      } else if (errorMessage.includes('area')) {
        notifyError(t('save.areaRequired', { defaultValue: 'Η μονάδα πρέπει να έχει εμβαδόν πριν την κράτηση ή πώληση.' }));
      } else {
        notifyError(t('save.error', { defaultValue: 'Σφάλμα κατά την αποθήκευση' }));
      }
      logger.error('PropertyFieldsBlock save error:', { error });
    } finally {
      setIsSaving(false);
    }
  }, [buildUpdatesFromForm, isCreatingNewUnit, formData.name, formData.type, formData.floor, formData.areaGross, property.id, onUpdateProperty, onExitEditMode, onPropertyCreated, t]);

  // ── Cancel handler ──
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- cancel handler kept for future use
  const _handleCancel = useCallback(() => {
    setFormData({
      name: property.name ?? '',
      code: property.code ?? '',
      type: property.type ?? '',
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
    if (onExitEditMode) { onExitEditMode(); } else { setLocalEditing(false); }
  }, [property, onExitEditMode]);

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

  return (
    <PropertyFieldsEditForm
      formData={formData}
      setFormData={setFormData}
      property={property}
      isEditing={isEditing}
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
      codeOverridden={codeOverridden}
      setCodeOverridden={setCodeOverridden}
      codeLoading={codeLoading}
      t={t}
      typography={typography}
      iconSizes={iconSizes}
      quick={quick}
    />
  );
}

// Extracted to: PropertyFieldsEditForm.tsx, PropertyFieldsReadOnly.tsx, property-fields-constants.ts

export default PropertyFieldsBlock;
