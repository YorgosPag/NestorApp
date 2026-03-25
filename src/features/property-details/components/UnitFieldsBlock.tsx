/**
 * =============================================================================
 * 🏢 ENTERPRISE: Unit Fields Block Component
 * =============================================================================
 *
 * Displays and edits extended unit fields (layout, areas, orientations, etc.)
 * View mode: clean text values. Edit mode: inputs/selects.
 * Consistent with Parking/Building Card pattern.
 *
 * @module features/property-details/components/UnitFieldsBlock
 * @enterprise Fortune 500 compliant - ZERO hardcoded values
 * @since 2026-01-24
 * @updated 2026-02-17 — View/Edit mode split + Card containers
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useNotifications } from '@/providers/NotificationProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Bed, Bath, Compass, Wrench, Zap,
  Ruler, Thermometer, Snowflake, Home, Shield, Flame, FileText, Info, Lock, Layers
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useTypography } from '@/hooks/useTypography';
import { useTranslation } from '@/i18n/hooks/useTranslation';

import type { Property } from '@/types/property-viewer';
import type { UnitType, CommercialStatus, OperationalStatus, LevelData } from '@/types/unit';
import { aggregateLevelData } from '@/services/multi-level.service';
import type {
  ConditionType,
  OrientationType,
  EnergyClassType,
  HeatingType,
  CoolingType,
  FlooringType,
  FrameType,
  GlazingType,
  InteriorFeatureCodeType,
  SecurityFeatureCodeType
} from '@/constants/unit-features-enterprise';
import { createModuleLogger } from '@/lib/telemetry';
import { useEntityCodeSuggestion } from '@/hooks/useEntityCodeSuggestion';
import { isValidEntityCodeFormat } from '@/services/entity-code.service';
import type { UnitType as UnitTypeImport } from '@/types/unit';
const logger = createModuleLogger('UnitFieldsBlock');

// =============================================================================
// TYPES
// =============================================================================

interface UnitFieldsBlockProps {
  property: Property;
  onUpdateProperty: (propertyId: string, updates: Partial<Property>) => void;
  isReadOnly?: boolean;
  isEditMode?: boolean;
  onExitEditMode?: () => void;
  /** Whether we are creating a new unit (inline form) */
  isCreatingNewUnit?: boolean;
  /** Callback when new unit is successfully created */
  onUnitCreated?: (unitId: string) => void;
  /** Controlled active level — synchronized with MultiLevelNavigation */
  activeLevelId?: string | null;
  /** Callback when user selects a level tab — updates shared state in parent */
  onActiveLevelChange?: (levelId: string | null) => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const ORIENTATION_OPTIONS: OrientationType[] = [
  'north', 'northeast', 'east', 'southeast',
  'south', 'southwest', 'west', 'northwest'
];

const CONDITION_OPTIONS: ConditionType[] = [
  'new', 'excellent', 'good', 'needs-renovation'
];

const ENERGY_CLASS_OPTIONS: EnergyClassType[] = [
  'A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G'
];

const HEATING_OPTIONS: HeatingType[] = [
  'central', 'autonomous', 'heat-pump', 'solar', 'none'
];

const COOLING_OPTIONS: CoolingType[] = [
  'central-air', 'split-units', 'fan-coil', 'none'
];

const FLOORING_OPTIONS: FlooringType[] = [
  'tiles', 'wood', 'laminate', 'marble', 'carpet'
];

const FRAME_OPTIONS: FrameType[] = [
  'aluminum', 'pvc', 'wood'
];

const GLAZING_OPTIONS: GlazingType[] = [
  'single', 'double', 'triple', 'energy'
];

const INTERIOR_FEATURE_OPTIONS: InteriorFeatureCodeType[] = [
  'fireplace', 'jacuzzi', 'sauna', 'smart-home', 'solar-panels',
  'underfloor-heating', 'air-conditioning', 'alarm-system'
];

const SECURITY_FEATURE_OPTIONS: SecurityFeatureCodeType[] = [
  'alarm', 'security-door', 'cctv', 'access-control', 'intercom', 'motion-sensors'
];

const UNIT_TYPE_OPTIONS: UnitType[] = [
  'studio', 'apartment_1br', 'apartment', 'apartment_2br',
  'apartment_3br', 'maisonette', 'penthouse', 'loft',
  'detached_house', 'villa', 'shop', 'office', 'hall', 'storage'
];

// Transaction statuses (reserved, sold, rented) require buyer/tenant selection
// and can ONLY be set through SalesActionDialogs (ReserveDialog/SellDialog).
// See: Sentry fix 2026-03-24 — ApiClientError "Buyer contact is required"
const COMMERCIAL_STATUS_OPTIONS: CommercialStatus[] = [
  'unavailable', 'for-sale', 'for-rent', 'for-sale-and-rent',
];

const OPERATIONAL_STATUS_OPTIONS: OperationalStatus[] = [
  'draft', 'under-construction', 'inspection', 'ready', 'maintenance'
];

// =============================================================================
// COMPONENT
// =============================================================================

export function UnitFieldsBlock({
  property,
  onUpdateProperty,
  isReadOnly = false,
  isEditMode = false,
  onExitEditMode,
  isCreatingNewUnit = false,
  onUnitCreated,
  activeLevelId: controlledLevelId,
  onActiveLevelChange,
}: UnitFieldsBlockProps) {
  const { t } = useTranslation('units');
  const spacing = useSpacingTokens();
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const typography = useTypography();

  const { success, error: notifyError } = useNotifications();
  const [localEditing, setLocalEditing] = useState(false);
  const isEditing = isEditMode || localEditing;
  const [isSaving, setIsSaving] = useState(false);
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
    unitType: (property.type as UnitTypeImport) || undefined,
    disabled: codeOverridden || !!property.code,
  });

  const [formData, setFormData] = useState({
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
        const { createUnit } = await import('@/services/units.service');
        const unitData = {
          ...updates,
          name: formData.name || t('navigation.actions.newUnit.defaultName', { defaultValue: 'Νέα Μονάδα' }),
          code: formData.code || suggestedCode || '',
          type: formData.type || 'apartment',
          status: 'reserved' as const,
          operationalStatus: 'draft' as const,
          floor: formData.floor,
          area: formData.areaGross,
        };
        const result = await createUnit(unitData);
        if (!result.success) {
          throw new Error(result.error ?? 'Unit creation failed');
        }
        if (result.unitId && onUnitCreated) {
          onUnitCreated(result.unitId);
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
      logger.error('UnitFieldsBlock save error:', { error });
    } finally {
      setIsSaving(false);
    }
  }, [buildUpdatesFromForm, isCreatingNewUnit, formData.name, formData.type, formData.floor, formData.areaGross, property.id, onUpdateProperty, onExitEditMode, onUnitCreated, t]);

  // ── Cancel handler ──
  const handleCancel = useCallback(() => {
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
    <form
      id={isEditing ? 'unit-fields-form' : undefined}
      className="space-y-4 p-1"
      onSubmit={(e) => { e.preventDefault(); if (isEditing) handleSave(); }}
    >
      {/* ─── Field Locking Banner ─── */}
      {isEditing && isReservedOrSold && (
        <Alert
          variant={isSoldOrRented ? 'destructive' : 'default'}
          className={cn(
            'py-2 px-3',
            !isSoldOrRented && 'border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-700'
          )}
        >
          <Lock className="h-4 w-4" />
          <AlertDescription className="text-xs">
            {isSoldOrRented
              ? t('fieldLocking.soldBanner', { defaultValue: 'Η μονάδα έχει πωληθεί/ενοικιαστεί — κρίσιμα πεδία κλειδωμένα (συμβόλαια, κτηματολόγιο)' })
              : t('fieldLocking.reservedBanner', { defaultValue: 'Η μονάδα είναι κρατημένη — βασικά πεδία ταυτότητας κλειδωμένα' })
            }
          </AlertDescription>
        </Alert>
      )}

      {/* ─── Level Tab Strip (ADR-236 Phase 2) ─── */}
      {isMultiLevel && property.levels && property.levels.length >= 2 && (
        <>
          <LevelTabStrip
            levels={property.levels}
            activeLevelId={activeLevelId}
            onSelectLevel={setActiveLevelId}
            t={t}
          />
          <aside className="flex items-center gap-3 text-[10px] text-muted-foreground px-1">
            <span className="flex items-center gap-1">
              <Layers className="h-3 w-3" />
              <span className="font-medium">{t('multiLevel.perLevel.perFloorHint')}</span>:
              {' '}{t('fields.areas.sectionTitle')}, {t('fields.layout.sectionTitle', { defaultValue: 'Διάταξη' })}, {t('orientation.sectionTitle')}, {t('finishes.sectionTitle')}
            </span>
            <span className="text-muted-foreground/60">|</span>
            <span>
              <span className="font-medium">{t('multiLevel.perLevel.sharedHint')}</span>:
              {' '}{t('condition.sectionTitle')}, {t('energy.class')}, {t('systems.sectionTitle')}, {t('features.interior.label')}, {t('features.security.label')}
            </span>
          </aside>
        </>
      )}

      {/* ─── Identity + Location Row ─── */}
      <section className="grid grid-cols-2 gap-3">
        {/* ─── Identity Card ─── */}
        <Card>
          <CardHeader className="p-2 pb-1">
            <CardTitle className={cn('flex items-center gap-1.5', typography.card.titleCompact)}>
              <FileText className={cn(iconSizes.sm, 'text-blue-500')} />
              {t('fields.identity.sectionTitle', { defaultValue: 'Ταυτότητα Μονάδας' })}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 pt-0 space-y-2">
            <fieldset className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                {t('fields.identity.name', { defaultValue: 'Όνομα Μονάδας' })}
              </Label>
              <Input
                id="unit-name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className={cn('h-7 text-xs', quick.input)}
                placeholder={t('fields.identity.namePlaceholder', { defaultValue: 'π.χ. Διαμέρισμα Α1' })}
                disabled={!isEditing || isReservedOrSold}
              />
            </fieldset>
            <fieldset className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                {t('fields.identity.code', { defaultValue: 'Κωδικός Μονάδας' })}
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button" className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Info">
                      <Info className="h-3 w-3" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 text-xs" side="right" align="start">
                    <h4 className="font-semibold mb-2">{t('entityCode.infoTitle', { defaultValue: 'Σύστημα Κωδικοποίησης' })}</h4>
                    <p className="text-muted-foreground mb-2">{t('entityCode.infoFormat', { defaultValue: 'Μορφή: {Κτίριο}-{Τύπος}-{Όροφος}.{ΑΑ}' })}</p>
                    <p className="text-muted-foreground mb-3">{t('entityCode.infoExample', { defaultValue: 'π.χ. A-DI-1.01' })}</p>
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-1 font-medium">{t('entityCode.infoResidential', { defaultValue: 'Κατοικίες' })}</th>
                          <th className="text-left py-1 font-medium">{t('entityCode.infoCommercial', { defaultValue: 'Εμπορικά' })}</th>
                          <th className="text-left py-1 font-medium">{t('entityCode.infoAuxiliary', { defaultValue: 'Βοηθητικά' })}</th>
                        </tr>
                      </thead>
                      <tbody className="text-muted-foreground">
                        <tr><td>DI = {t('types.apartment')}</td><td>KA = {t('types.shop')}</td><td>AP = {t('types.storage')}</td></tr>
                        <tr><td>GK = {t('types.apartment_1br')}</td><td>GR = {t('types.office')}</td><td>PK = Parking</td></tr>
                        <tr><td>ST = {t('types.studio')}</td><td>AI = {t('types.hall')}</td><td>PY = Υπαίθριο</td></tr>
                        <tr><td>ME = {t('types.maisonette')}</td><td colSpan={2} rowSpan={5} /></tr>
                        <tr><td>RE = {t('types.penthouse')}</td></tr>
                        <tr><td>LO = Loft</td></tr>
                        <tr><td>MO = {t('types.detached_house')}</td></tr>
                        <tr><td>BI = {t('types.villa')}</td></tr>
                      </tbody>
                    </table>
                    <p className="text-muted-foreground mt-2 text-[10px]">{t('entityCode.infoFloors', { defaultValue: 'Υπόγεια: Y1, Y2... | Ισόγειο: 0 | Όροφοι: 1, 2...' })}</p>
                  </PopoverContent>
                </Popover>
              </Label>
              <Input
                id="unit-code"
                value={formData.code}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, code: e.target.value }));
                  if (!codeOverridden && e.target.value !== suggestedCode) {
                    setCodeOverridden(true);
                  }
                  if (!e.target.value) setCodeOverridden(false);
                }}
                className={cn('h-7 text-xs', quick.input)}
                placeholder={suggestedCode || t('fields.identity.codePlaceholder', { defaultValue: 'π.χ. A-DI-1.01' })}
                disabled={!isEditing || isReservedOrSold}
              />
              {formData.code && isValidEntityCodeFormat(formData.code) && (
                <p className="text-[10px] text-emerald-600">{t('entityCode.autoGenerated', { defaultValue: 'Αυτόματη κωδικοποίηση ADR-233' })}</p>
              )}
              {codeLoading && isEditing && (
                <p className="text-[10px] text-muted-foreground">{t('entityCode.loading', { defaultValue: 'Υπολογισμός κωδικού...' })}</p>
              )}
              {suggestedCode && codeOverridden && formData.code !== suggestedCode && isEditing && (
                <p className="text-[10px] text-muted-foreground">{t('entityCode.suggested', { code: suggestedCode, defaultValue: `Προτεινόμενος: ${suggestedCode}` })}</p>
              )}
              {formData.code && !isValidEntityCodeFormat(formData.code) && isEditing && (
                <p className="text-[10px] text-amber-600">{t('entityCode.formatWarning', { defaultValue: 'Ο κωδικός δεν ακολουθεί το πρότυπο format' })}</p>
              )}
            </fieldset>
            <fieldset className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                {t('fields.identity.type', { defaultValue: 'Τύπος Μονάδας' })}
              </Label>
              <Select value={formData.type} disabled={!isEditing || isReservedOrSold}
                onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}>
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue placeholder={t('fields.identity.typePlaceholder', { defaultValue: 'Επιλέξτε τύπο...' })} />
                </SelectTrigger>
                <SelectContent>
                  {UNIT_TYPE_OPTIONS.map((unitType) => (
                    <SelectItem key={unitType} value={unitType} className="text-xs">
                      {t(`types.${unitType}`, { defaultValue: unitType })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </fieldset>
            <fieldset className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                {t('fields.identity.commercialStatus', { defaultValue: 'Εμπορική Κατάσταση' })}
              </Label>
              <Select value={formData.commercialStatus} disabled={!isEditing || isReservedOrSold}
                onValueChange={(value) => setFormData(prev => ({ ...prev, commercialStatus: value as CommercialStatus }))}>
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue placeholder={t('fields.identity.commercialStatusPlaceholder', { defaultValue: 'Επιλέξτε κατάσταση...' })} />
                </SelectTrigger>
                <SelectContent>
                  {COMMERCIAL_STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status} value={status} className="text-xs">
                      {t(`commercialStatus.${status}`, { defaultValue: status })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </fieldset>
            <fieldset className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                {t('dialog.addUnit.fields.status', { defaultValue: 'Λειτουργική Κατάσταση' })}
              </Label>
              <Select value={formData.operationalStatus} disabled={!isEditing}
                onValueChange={(value) => setFormData(prev => ({ ...prev, operationalStatus: value as OperationalStatus }))}>
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue placeholder={t('dialog.addUnit.placeholders.status', { defaultValue: 'Επιλέξτε...' })} />
                </SelectTrigger>
                <SelectContent>
                  {OPERATIONAL_STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status} value={status} className="text-xs">
                      {t(`dialog.addUnit.statusOptions.${status}`, { defaultValue: status })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </fieldset>
            <fieldset className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                {t('fields.identity.description', { defaultValue: 'Περιγραφή' })}
              </Label>
              <Textarea
                id="unit-description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="h-16 text-xs resize-none"
                placeholder={t('fields.identity.descriptionPlaceholder', { defaultValue: 'Προσθέστε περιγραφή για τη μονάδα...' })}
                disabled={!isEditing}
              />
            </fieldset>
          </CardContent>
        </Card>

        {/* ─── Areas Card (level-aware) ─── */}
        <Card>
          <CardHeader className="p-2 pb-1">
            <CardTitle className={cn('flex items-center gap-1.5', typography.card.titleCompact)}>
              <Ruler className={cn(iconSizes.sm, NAVIGATION_ENTITIES.area.color)} />
              {t('fields.areas.sectionTitle')}
              {isMultiLevel && (
                <span className="ml-auto text-[9px] font-normal text-emerald-600 dark:text-emerald-400">
                  {t('multiLevel.perLevel.perFloorHint')}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 pt-0">
            {isMultiLevel && activeLevelId === null && aggregatedTotals ? (
              /* Read-only aggregated totals */
              <div className="space-y-1.5">
                <p className="text-[10px] text-muted-foreground italic">{t('multiLevel.perLevel.autoComputed')}</p>
                {([
                  ['gross', 'fields.areas.gross'],
                  ['net', 'fields.areas.net'],
                  ['balcony', 'fields.areas.balcony'],
                  ['terrace', 'fields.areas.terrace'],
                  ['garden', 'fields.areas.garden'],
                ] as const).map(([key, labelKey]) => (
                  aggregatedTotals.areas[key] > 0 ? (
                    <dl key={key} className="flex items-baseline gap-1.5">
                      <dt className="text-xs text-muted-foreground">{t(labelKey)}:</dt>
                      <dd className="text-xs font-semibold">{aggregatedTotals.areas[key]} m²</dd>
                    </dl>
                  ) : null
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {([
                  ['gross', 'fields.areas.gross'],
                  ['net', 'fields.areas.net'],
                  ['balcony', 'fields.areas.balcony'],
                  ['terrace', 'fields.areas.terrace'],
                  ['garden', 'fields.areas.garden'],
                ] as const).map(([areaKey, labelKey]) => {
                  const value = isMultiLevel && activeLevelId
                    ? (currentLevelData?.areas?.[areaKey] ?? 0)
                    : formData[`area${areaKey.charAt(0).toUpperCase()}${areaKey.slice(1)}` as keyof typeof formData] as number;
                  return (
                    <fieldset key={areaKey} className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{t(labelKey)}</Label>
                      <Input
                        type="number" min={0} step={0.1}
                        value={value}
                        onChange={(e) => {
                          const num = parseFloat(e.target.value) || 0;
                          if (isMultiLevel && activeLevelId) {
                            updateLevelField('areas', {
                              ...(currentLevelData?.areas ?? { gross: 0 }),
                              [areaKey]: num,
                            });
                          } else {
                            const flatKey = `area${areaKey.charAt(0).toUpperCase()}${areaKey.slice(1)}`;
                            setFormData(prev => ({ ...prev, [flatKey]: num }));
                          }
                        }}
                        className={cn('h-7 text-xs', quick.input)}
                        disabled={!isEditing || isSoldOrRented}
                      />
                    </fieldset>
                  );
                })}
              </div>
            )}
            {/* Millesimal shares — read-only, from ownership table */}
            {property.millesimalShares != null && property.millesimalShares > 0 && (
              <dl className="flex items-baseline gap-1.5 mt-2 pt-2 border-t border-border">
                <dt className="text-xs text-muted-foreground flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  {t('fields.millesimalShares', { defaultValue: 'Χιλιοστά (‰)' })}:
                </dt>
                <dd className="text-xs font-semibold">{property.millesimalShares}‰</dd>
              </dl>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          ROW 1: Διάταξη, Εμβαδά, Κατάσταση/Ενέργεια
      ═══════════════════════════════════════════════════════════════ */}
      <section className="grid grid-cols-3 gap-3">
        {/* ─── Layout Card (level-aware) ─── */}
        <Card>
          <CardHeader className="p-2 pb-1">
            <CardTitle className={cn('flex items-center gap-1.5', typography.card.titleCompact)}>
              <Bed className={cn(iconSizes.sm, 'text-violet-500')} />
              {t('fields.layout.sectionTitle', { defaultValue: 'Διάταξη' })}
              {isMultiLevel && (
                <span className="ml-auto text-[9px] font-normal text-emerald-600 dark:text-emerald-400">
                  {t('multiLevel.perLevel.perFloorHint')}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 pt-0">
            {isMultiLevel && activeLevelId === null && aggregatedTotals ? (
              <div className="space-y-1.5">
                <p className="text-[10px] text-muted-foreground italic">{t('multiLevel.perLevel.autoComputed')}</p>
                {aggregatedTotals.layout.bedrooms > 0 && (
                  <dl className="flex items-baseline gap-1.5">
                    <dt className="text-xs text-muted-foreground">{t('card.stats.bedrooms')}:</dt>
                    <dd className="text-xs font-semibold">{aggregatedTotals.layout.bedrooms}</dd>
                  </dl>
                )}
                {aggregatedTotals.layout.bathrooms > 0 && (
                  <dl className="flex items-baseline gap-1.5">
                    <dt className="text-xs text-muted-foreground">{t('card.stats.bathrooms')}:</dt>
                    <dd className="text-xs font-semibold">{aggregatedTotals.layout.bathrooms}</dd>
                  </dl>
                )}
                {aggregatedTotals.layout.wc > 0 && (
                  <dl className="flex items-baseline gap-1.5">
                    <dt className="text-xs text-muted-foreground">{t('fields.layout.wc')}:</dt>
                    <dd className="text-xs font-semibold">{aggregatedTotals.layout.wc}</dd>
                  </dl>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {([
                  ['bedrooms', 'card.stats.bedrooms', Bed, 'text-violet-600', 20],
                  ['bathrooms', 'card.stats.bathrooms', Bath, 'text-cyan-600', 10],
                  ['wc', 'fields.layout.wc', Bath, 'text-sky-500', 5],
                ] as const).map(([layoutKey, labelKey, Icon, iconColor, max]) => {
                  const value = isMultiLevel && activeLevelId
                    ? (currentLevelData?.layout?.[layoutKey] ?? 0)
                    : formData[layoutKey];
                  return (
                    <fieldset key={layoutKey} className="space-y-1">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Icon className={cn(iconSizes.xs, iconColor)} />
                        {t(labelKey)}
                      </Label>
                      <Input type="number" min={0} max={max} value={value}
                        onChange={(e) => {
                          const num = parseInt(e.target.value) || 0;
                          if (isMultiLevel && activeLevelId) {
                            updateLevelField('layout', {
                              ...(currentLevelData?.layout ?? {}),
                              [layoutKey]: num,
                            });
                          } else {
                            setFormData(prev => ({ ...prev, [layoutKey]: num }));
                          }
                        }}
                        className={cn('h-7 text-xs', quick.input)} disabled={!isEditing || isSoldOrRented} />
                    </fieldset>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ─── Orientation Card (level-aware) ─── */}
        <Card>
          <CardHeader className="p-2 pb-1">
            <CardTitle className={cn('flex items-center gap-1.5', typography.card.titleCompact)}>
              <Compass className={cn(iconSizes.sm, 'text-amber-500')} />
              {t('orientation.sectionTitle')}
              {isMultiLevel && (
                <span className="ml-auto text-[9px] font-normal text-emerald-600 dark:text-emerald-400">
                  {t('multiLevel.perLevel.perFloorHint')}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 pt-0 space-y-2">
            {isMultiLevel && activeLevelId === null && aggregatedTotals ? (
              <div className="space-y-1.5">
                <p className="text-[10px] text-muted-foreground italic">{t('multiLevel.perLevel.autoComputed')}</p>
                {aggregatedTotals.orientations.length > 0 && (
                  <p className="text-xs font-medium">
                    {aggregatedTotals.orientations.map(o => t(`orientation.short.${o}`, { defaultValue: o })).join(', ')}
                  </p>
                )}
              </div>
            ) : (
              <fieldset className="space-y-1">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  {t('orientation.sectionTitle')}
                </Label>
                <div className="flex flex-wrap gap-1">
                  {ORIENTATION_OPTIONS.map((orientation) => {
                    const levelOrientations = isMultiLevel && activeLevelId
                      ? (currentLevelData?.orientations ?? [])
                      : formData.orientations;
                    const isSelected = levelOrientations.includes(orientation);
                    return (
                      <Button key={orientation} type="button"
                        variant={isSelected ? 'default' : 'outline'} size="sm"
                        className="h-6 px-1.5 text-xs"
                        disabled={!isEditing || isSoldOrRented}
                        onClick={() => {
                          if (isMultiLevel && activeLevelId) {
                            const current = currentLevelData?.orientations ?? [];
                            const updated = current.includes(orientation)
                              ? current.filter(o => o !== orientation)
                              : [...current, orientation];
                            updateLevelField('orientations', updated as OrientationType[]);
                          } else {
                            toggleArrayItem('orientations', orientation);
                          }
                        }}>
                        {t(`orientation.short.${orientation}`)}
                      </Button>
                    );
                  })}
                </div>
              </fieldset>
            )}
          </CardContent>
        </Card>

        {/* ─── Condition & Energy Card ─── */}
        <Card>
          <CardHeader className="p-2 pb-1">
            <CardTitle className={cn('flex items-center gap-1.5', typography.card.titleCompact)}>
              <Wrench className={cn(iconSizes.sm, 'text-orange-500')} />
              {t('condition.sectionTitle')}
              <Zap className={cn(iconSizes.sm, 'text-green-500')} />
              {isMultiLevel && (
                <span className="ml-auto text-[9px] font-normal text-muted-foreground">
                  {t('multiLevel.perLevel.sharedHint')}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 pt-0">
            <div className="space-y-2">
              <fieldset className="space-y-1">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Wrench className={cn(iconSizes.xs, 'text-orange-600')} />
                  {t('condition.sectionTitle')}
                </Label>
                <Select value={formData.condition} disabled={!isEditing || isSoldOrRented}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, condition: value }))}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue placeholder={t('condition.sectionTitle')} /></SelectTrigger>
                  <SelectContent>
                    {CONDITION_OPTIONS.map((c) => (
                      <SelectItem key={c} value={c} className="text-xs">{t(`condition.${c}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </fieldset>
              <fieldset className="space-y-1">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Zap className={cn(iconSizes.xs, 'text-green-600')} />
                  {t('energy.class')}
                </Label>
                <Select value={formData.energyClass} disabled={!isEditing || isSoldOrRented}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, energyClass: value }))}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue placeholder={t('energy.class')} /></SelectTrigger>
                  <SelectContent>
                    {ENERGY_CLASS_OPTIONS.map((e) => (
                      <SelectItem key={e} value={e} className="text-xs">{e}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </fieldset>
            </div>
          </CardContent>
        </Card>

      </section>

      {/* ═══════════════════════════════════════════════════════════════
          ROW 2: Συστήματα, Φινιρίσματα, Χαρακτηριστικά
      ═══════════════════════════════════════════════════════════════ */}
      <section className="grid grid-cols-3 gap-3">
        {/* ─── Systems Card ─── */}
        <Card>
          <CardHeader className="p-2 pb-1">
            <CardTitle className={cn('flex items-center gap-1.5', typography.card.titleCompact)}>
              <Thermometer className={cn(iconSizes.sm, 'text-red-500')} />
              {t('systems.sectionTitle')}
              {isMultiLevel && (
                <span className="ml-auto text-[9px] font-normal text-muted-foreground">
                  {t('multiLevel.perLevel.sharedHint')}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 pt-0">
            <div className="space-y-2">
              <fieldset className="space-y-1">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Flame className={cn(iconSizes.xs, 'text-orange-500')} />
                  {t('systems.heating.label')}
                </Label>
                <Select value={formData.heatingType} disabled={!isEditing || isSoldOrRented}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, heatingType: value }))}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue placeholder={t('systems.heating.label')} /></SelectTrigger>
                  <SelectContent>
                    {HEATING_OPTIONS.map((h) => (
                      <SelectItem key={h} value={h} className="text-xs">{t(`systems.heating.${h}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </fieldset>
              <fieldset className="space-y-1">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Snowflake className={cn(iconSizes.xs, 'text-blue-500')} />
                  {t('systems.cooling.label')}
                </Label>
                <Select value={formData.coolingType} disabled={!isEditing || isSoldOrRented}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, coolingType: value }))}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue placeholder={t('systems.cooling.label')} /></SelectTrigger>
                  <SelectContent>
                    {COOLING_OPTIONS.map((c) => (
                      <SelectItem key={c} value={c} className="text-xs">{t(`systems.cooling.${c}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </fieldset>
            </div>
          </CardContent>
        </Card>
        {/* ─── Finishes Card (level-aware) ─── */}
        <Card>
          <CardHeader className="p-2 pb-1">
            <CardTitle className={cn('flex items-center gap-1.5', typography.card.titleCompact)}>
              <Home className={cn(iconSizes.sm, 'text-teal-500')} />
              {t('finishes.sectionTitle')}
              {isMultiLevel && (
                <span className="ml-auto text-[9px] font-normal text-emerald-600 dark:text-emerald-400">
                  {t('multiLevel.perLevel.perFloorHint')}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 pt-0 space-y-2">
            {(() => {
              const levelFlooring = isMultiLevel && activeLevelId
                ? (currentLevelData?.finishes?.flooring ?? [])
                : formData.flooring;
              const levelFrames = isMultiLevel && activeLevelId
                ? (currentLevelData?.finishes?.windowFrames ?? '')
                : formData.windowFrames;
              const levelGlazing = isMultiLevel && activeLevelId
                ? (currentLevelData?.finishes?.glazing ?? '')
                : formData.glazing;

              return (
                <>
                  {/* Flooring */}
                  <fieldset className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{t('finishes.flooring.label')}</Label>
                    <div className="flex flex-wrap gap-1">
                      {FLOORING_OPTIONS.map((floor) => {
                        const isSelected = levelFlooring.includes(floor);
                        return (
                          <Button key={floor} type="button"
                            variant={isSelected ? 'default' : 'outline'} size="sm"
                            className="h-6 px-1.5 text-xs"
                            disabled={!isEditing || isSoldOrRented}
                            onClick={() => {
                              if (isMultiLevel && activeLevelId) {
                                const updated = isSelected
                                  ? levelFlooring.filter(f => f !== floor)
                                  : [...levelFlooring, floor];
                                updateLevelField('finishes', {
                                  ...(currentLevelData?.finishes ?? {}),
                                  flooring: updated as FlooringType[],
                                });
                              } else {
                                toggleArrayItem('flooring', floor);
                              }
                            }}>
                            {t(`finishes.flooring.${floor}`)}
                          </Button>
                        );
                      })}
                    </div>
                  </fieldset>

                  {/* Frames & Glazing */}
                  <div className="grid grid-cols-2 gap-2">
                    <fieldset className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{t('finishes.frames.label')}</Label>
                      <Select value={levelFrames} disabled={!isEditing || isSoldOrRented}
                        onValueChange={(value) => {
                          if (isMultiLevel && activeLevelId) {
                            updateLevelField('finishes', {
                              ...(currentLevelData?.finishes ?? {}),
                              windowFrames: value as FrameType,
                            });
                          } else {
                            setFormData(prev => ({ ...prev, windowFrames: value }));
                          }
                        }}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue placeholder={t('finishes.frames.label')} /></SelectTrigger>
                        <SelectContent>
                          {FRAME_OPTIONS.map((f) => (
                            <SelectItem key={f} value={f} className="text-xs">{t(`finishes.frames.${f}`)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </fieldset>
                    <fieldset className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{t('finishes.glazing.label')}</Label>
                      <Select value={levelGlazing} disabled={!isEditing || isSoldOrRented}
                        onValueChange={(value) => {
                          if (isMultiLevel && activeLevelId) {
                            updateLevelField('finishes', {
                              ...(currentLevelData?.finishes ?? {}),
                              glazing: value as GlazingType,
                            });
                          } else {
                            setFormData(prev => ({ ...prev, glazing: value }));
                          }
                        }}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue placeholder={t('finishes.glazing.label')} /></SelectTrigger>
                        <SelectContent>
                          {GLAZING_OPTIONS.map((g) => (
                            <SelectItem key={g} value={g} className="text-xs">{t(`finishes.glazing.${g}`)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </fieldset>
                  </div>
                </>
              );
            })()}
          </CardContent>
        </Card>

        {/* ─── Features Card ─── */}
        <Card>
          <CardHeader className="p-2 pb-1">
            <CardTitle className={cn('flex items-center gap-1.5', typography.card.titleCompact)}>
              <Shield className={cn(iconSizes.sm, 'text-purple-500')} />
              {t('features.sectionTitle')}
              {isMultiLevel && (
                <span className="ml-auto text-[9px] font-normal text-muted-foreground">
                  {t('multiLevel.perLevel.sharedHint')}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 pt-0 space-y-2">
            {/* Interior Features */}
            <fieldset className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t('features.interior.label')}</Label>
              <div className="flex flex-wrap gap-1">
                {INTERIOR_FEATURE_OPTIONS.map((feature) => {
                  const isSelected = formData.interiorFeatures.includes(feature);
                  return (
                    <Button key={feature} type="button"
                      variant={isSelected ? 'default' : 'outline'} size="sm"
                      className="h-6 px-1.5 text-xs"
                      disabled={!isEditing || isSoldOrRented}
                      onClick={() => toggleArrayItem('interiorFeatures', feature)}>
                      {t(`features.interior.${feature}`)}
                    </Button>
                  );
                })}
              </div>
            </fieldset>

            {/* Security Features */}
            <fieldset className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t('features.security.label')}</Label>
              <div className="flex flex-wrap gap-1">
                {SECURITY_FEATURE_OPTIONS.map((feature) => {
                  const isSelected = formData.securityFeatures.includes(feature);
                  return (
                    <Button key={feature} type="button"
                      variant={isSelected ? 'default' : 'outline'} size="sm"
                      className="h-6 px-1.5 text-xs"
                      disabled={!isEditing || isSoldOrRented}
                      onClick={() => toggleArrayItem('securityFeatures', feature)}>
                      {t(`features.security.${feature}`)}
                    </Button>
                  );
                })}
              </div>
            </fieldset>
          </CardContent>
        </Card>
      </section>
    </form>
  );
}

// =============================================================================
// 🏢 ADR-236 Phase 2: Level Tab Strip (multi-level units)
// =============================================================================

import type { TFunction } from 'i18next';
import type { UnitLevel } from '@/types/unit';

/** Tab bar showing one button per level + a "Totals" button */
function LevelTabStrip({
  levels,
  activeLevelId,
  onSelectLevel,
  t,
}: {
  levels: UnitLevel[];
  activeLevelId: string | null;
  onSelectLevel: (id: string | null) => void;
  t: TFunction;
}) {
  const sorted = [...levels].sort((a, b) => a.floorNumber - b.floorNumber);

  return (
    <nav aria-label="Level tabs" className="flex items-center gap-1 rounded-md bg-muted/50 p-1">
      <Layers className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      {sorted.map((level) => (
        <Button
          key={level.floorId}
          type="button"
          variant={activeLevelId === level.floorId ? 'default' : 'ghost'}
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={() => onSelectLevel(level.floorId)}
        >
          {level.name}
        </Button>
      ))}
      <Button
        type="button"
        variant={activeLevelId === null ? 'default' : 'ghost'}
        size="sm"
        className="h-6 px-2 text-xs"
        onClick={() => onSelectLevel(null)}
      >
        {t('multiLevel.perLevel.tabTotals', { defaultValue: 'Σύνολα' })} ✓
      </Button>
    </nav>
  );
}

// =============================================================================
// 🏢 ENTERPRISE: Read-Only Compact View (Ευρετήριο Ακινήτων)
// =============================================================================

/** Single label:value row for compact view */
function CompactField({ label, value }: { label: string; value: string | number | undefined }) {
  if (!value && value !== 0) return null;
  return (
    <dl className="flex items-baseline gap-1.5">
      <dt className="text-xs text-muted-foreground whitespace-nowrap">{label}:</dt>
      <dd className="text-xs font-medium truncate">{String(value)}</dd>
    </dl>
  );
}

/** Compact plain-text view for read-only mode (Ευρετήριο) */
function ReadOnlyCompactView({ property, t }: { property: Property; t: TFunction }) {
  const orientationLabels = (property.orientations ?? [])
    .map((o) => t(`orientation.short.${o}`, { defaultValue: o }))
    .join(', ');

  const flooringLabels = (property.finishes?.flooring ?? [])
    .map((f) => t(`finishes.flooring.${f}`, { defaultValue: f }))
    .join(', ');

  const interiorLabels = (property.interiorFeatures ?? [])
    .map((f) => t(`features.interior.${f}`, { defaultValue: f }))
    .join(', ');

  const securityLabels = (property.securityFeatures ?? [])
    .map((f) => t(`features.security.${f}`, { defaultValue: f }))
    .join(', ');

  return (
    <section className="flex flex-col gap-1 p-2">
      {/* Identity */}
      <CompactField label={t('fields.identity.name', { defaultValue: 'Όνομα' })} value={property.name} />
      <CompactField label={t('fields.identity.code', { defaultValue: 'Κωδικός' })} value={property.code} />
      <CompactField
        label={t('fields.identity.type', { defaultValue: 'Τύπος' })}
        value={property.type ? t(`types.${property.type}`, { defaultValue: property.type }) : undefined}
      />
      <CompactField
        label={t('fields.identity.commercialStatus', { defaultValue: 'Εμπορική Κατάσταση' })}
        value={property.commercialStatus ? t(`commercialStatus.${property.commercialStatus}`, { defaultValue: property.commercialStatus }) : undefined}
      />
      <CompactField
        label={t('dialog.addUnit.fields.status', { defaultValue: 'Λειτουργική' })}
        value={(() => {
          const opStatus = (property as unknown as Record<string, unknown>).operationalStatus;
          return opStatus
            ? t(`dialog.addUnit.statusOptions.${opStatus}`, { defaultValue: String(opStatus) })
            : undefined;
        })()}
      />

      {/* Areas */}
      {property.areas?.gross ? (
        <CompactField label={t('fields.areas.gross')} value={`${property.areas.gross} m²`} />
      ) : null}
      {property.areas?.net ? (
        <CompactField label={t('fields.areas.net')} value={`${property.areas.net} m²`} />
      ) : null}
      {property.areas?.balcony ? (
        <CompactField label={t('fields.areas.balcony')} value={`${property.areas.balcony} m²`} />
      ) : null}

      {/* Layout */}
      {property.layout?.bedrooms ? (
        <CompactField label={t('card.stats.bedrooms')} value={property.layout.bedrooms} />
      ) : null}
      {property.layout?.bathrooms ? (
        <CompactField label={t('card.stats.bathrooms')} value={property.layout.bathrooms} />
      ) : null}

      {/* Orientation */}
      {orientationLabels && (
        <CompactField label={t('orientation.sectionTitle')} value={orientationLabels} />
      )}

      {/* Condition & Energy */}
      {property.condition && (
        <CompactField label={t('condition.sectionTitle')} value={t(`condition.${property.condition}`, { defaultValue: property.condition })} />
      )}
      {property.energy?.class && (
        <CompactField label={t('energy.class')} value={property.energy.class} />
      )}

      {/* Systems */}
      {property.systemsOverride?.heatingType && (
        <CompactField label={t('systems.heating.label')} value={t(`systems.heating.${property.systemsOverride.heatingType}`, { defaultValue: property.systemsOverride.heatingType })} />
      )}
      {property.systemsOverride?.coolingType && (
        <CompactField label={t('systems.cooling.label')} value={t(`systems.cooling.${property.systemsOverride.coolingType}`, { defaultValue: property.systemsOverride.coolingType })} />
      )}

      {/* Finishes */}
      {flooringLabels && (
        <CompactField label={t('finishes.flooring.label')} value={flooringLabels} />
      )}
      {property.finishes?.windowFrames && (
        <CompactField label={t('finishes.frames.label')} value={t(`finishes.frames.${property.finishes.windowFrames}`, { defaultValue: property.finishes.windowFrames })} />
      )}

      {/* Features */}
      {interiorLabels && (
        <CompactField label={t('features.interior.label')} value={interiorLabels} />
      )}
      {securityLabels && (
        <CompactField label={t('features.security.label')} value={securityLabels} />
      )}

      {/* Description — full width */}
      {property.description && (
        <dl className="mt-1">
          <dt className="text-xs text-muted-foreground">{t('fields.identity.description', { defaultValue: 'Περιγραφή' })}</dt>
          <dd className="text-xs mt-0.5">{property.description}</dd>
        </dl>
      )}
    </section>
  );
}

export default UnitFieldsBlock;
