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
  Ruler, Thermometer, Snowflake, Home, Shield, Flame, FileText, Info, Lock
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
import type { UnitType, CommercialStatus, OperationalStatus } from '@/types/unit';
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

const COMMERCIAL_STATUS_OPTIONS: CommercialStatus[] = [
  'unavailable', 'for-sale', 'for-rent', 'for-sale-and-rent',
  'reserved', 'sold', 'rented'
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
    disabled: codeOverridden || !isEditing,
  });

  const [formData, setFormData] = useState({
    name: property.name ?? '',
    code: property.code ?? '',
    type: property.type ?? '',
    operationalStatus: ((property as Record<string, unknown>).operationalStatus as OperationalStatus) ?? 'draft',
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
    securityFeatures: property.securityFeatures ?? []
  });

  // ── Sync form data when property changes externally (e.g. floor via FloorSelectField) ──
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      name: property.name ?? '',
      code: property.code ?? '',
      type: property.type ?? '',
      operationalStatus: ((property as Record<string, unknown>).operationalStatus as OperationalStatus) ?? 'draft',
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
    }));
  }, [property]);

  // ADR-233: Auto-populate code when suggestion arrives and code is empty
  useEffect(() => {
    if (suggestedCode && !codeOverridden && !formData.code && isEditing) {
      setFormData(prev => ({ ...prev, code: suggestedCode }));
    }
  }, [suggestedCode, codeOverridden, formData.code, isEditing]);

  // ── Build updates from form data ──
  const buildUpdatesFromForm = useCallback((): Partial<Property> => {
    const updates: Partial<Property> = {
      name: formData.name,
      code: formData.code || undefined,
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

    return updates;
  }, [formData]);

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
          code: formData.code || '',
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
      operationalStatus: ((property as Record<string, unknown>).operationalStatus as OperationalStatus) ?? 'draft',
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
      securityFeatures: property.securityFeatures ?? []
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
              <Select value={formData.commercialStatus} disabled={!isEditing || isSoldOrRented}
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

        {/* ─── Areas Card ─── */}
        <Card>
          <CardHeader className="p-2 pb-1">
            <CardTitle className={cn('flex items-center gap-1.5', typography.card.titleCompact)}>
              <Ruler className={cn(iconSizes.sm, NAVIGATION_ENTITIES.area.color)} />
              {t('fields.areas.sectionTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 pt-0">
            <div className="space-y-2">
              {([
                ['areaGross', 'fields.areas.gross'],
                ['areaNet', 'fields.areas.net'],
                ['areaBalcony', 'fields.areas.balcony'],
                ['areaTerrace', 'fields.areas.terrace'],
                ['areaGarden', 'fields.areas.garden'],
              ] as const).map(([field, labelKey]) => (
                <fieldset key={field} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t(labelKey)}</Label>
                  <Input
                    type="number" min={0} step={0.1}
                    value={formData[field]}
                    onChange={(e) => setFormData(prev => ({ ...prev, [field]: parseFloat(e.target.value) || 0 }))}
                    className={cn('h-7 text-xs', quick.input)}
                    disabled={!isEditing || isSoldOrRented}
                  />
                </fieldset>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          ROW 1: Διάταξη, Εμβαδά, Κατάσταση/Ενέργεια
      ═══════════════════════════════════════════════════════════════ */}
      <section className="grid grid-cols-3 gap-3">
        {/* ─── Layout Card ─── */}
        <Card>
          <CardHeader className="p-2 pb-1">
            <CardTitle className={cn('flex items-center gap-1.5', typography.card.titleCompact)}>
              <Bed className={cn(iconSizes.sm, 'text-violet-500')} />
              {t('fields.layout.sectionTitle', { defaultValue: 'Διάταξη' })}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 pt-0">
            <div className="space-y-2">
              <fieldset className="space-y-1">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Bed className={cn(iconSizes.xs, 'text-violet-600')} />
                  {t('card.stats.bedrooms')}
                </Label>
                <Input type="number" min={0} max={20} value={formData.bedrooms}
                  onChange={(e) => setFormData(prev => ({ ...prev, bedrooms: parseInt(e.target.value) || 0 }))}
                  className={cn('h-7 text-xs', quick.input)} disabled={!isEditing || isSoldOrRented} />
              </fieldset>
              <fieldset className="space-y-1">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Bath className={cn(iconSizes.xs, 'text-cyan-600')} />
                  {t('card.stats.bathrooms')}
                </Label>
                <Input type="number" min={0} max={10} value={formData.bathrooms}
                  onChange={(e) => setFormData(prev => ({ ...prev, bathrooms: parseInt(e.target.value) || 0 }))}
                  className={cn('h-7 text-xs', quick.input)} disabled={!isEditing || isSoldOrRented} />
              </fieldset>
              <fieldset className="space-y-1">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Bath className={cn(iconSizes.xs, 'text-sky-500')} />
                  {t('fields.layout.wc')}
                </Label>
                <Input type="number" min={0} max={5} value={formData.wc}
                  onChange={(e) => setFormData(prev => ({ ...prev, wc: parseInt(e.target.value) || 0 }))}
                  className={cn('h-7 text-xs', quick.input)} disabled={!isEditing || isSoldOrRented} />
              </fieldset>
            </div>
          </CardContent>
        </Card>

        {/* ─── Orientation Card ─── */}
        <Card>
          <CardHeader className="p-2 pb-1">
            <CardTitle className={cn('flex items-center gap-1.5', typography.card.titleCompact)}>
              <Compass className={cn(iconSizes.sm, 'text-amber-500')} />
              {t('orientation.sectionTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 pt-0 space-y-2">
            <fieldset className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                {t('orientation.sectionTitle')}
              </Label>
              <div className="flex flex-wrap gap-1">
                {ORIENTATION_OPTIONS.map((orientation) => {
                  const isSelected = formData.orientations.includes(orientation);
                  return (
                    <Button key={orientation} type="button"
                      variant={isSelected ? 'default' : 'outline'} size="sm"
                      className="h-6 px-1.5 text-xs"
                      disabled={!isEditing}
                      onClick={() => toggleArrayItem('orientations', orientation)}>
                      {t(`orientation.short.${orientation}`)}
                    </Button>
                  );
                })}
              </div>
            </fieldset>
          </CardContent>
        </Card>

        {/* ─── Condition & Energy Card ─── */}
        <Card>
          <CardHeader className="p-2 pb-1">
            <CardTitle className={cn('flex items-center gap-1.5', typography.card.titleCompact)}>
              <Wrench className={cn(iconSizes.sm, 'text-orange-500')} />
              {t('condition.sectionTitle')}
              <Zap className={cn(iconSizes.sm, 'text-green-500')} />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 pt-0">
            <div className="space-y-2">
              <fieldset className="space-y-1">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Wrench className={cn(iconSizes.xs, 'text-orange-600')} />
                  {t('condition.sectionTitle')}
                </Label>
                <Select value={formData.condition} disabled={!isEditing}
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
                <Select value={formData.energyClass} disabled={!isEditing}
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
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 pt-0">
            <div className="space-y-2">
              <fieldset className="space-y-1">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Flame className={cn(iconSizes.xs, 'text-orange-500')} />
                  {t('systems.heating.label')}
                </Label>
                <Select value={formData.heatingType} disabled={!isEditing}
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
                <Select value={formData.coolingType} disabled={!isEditing}
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
        {/* ─── Finishes Card ─── */}
        <Card>
          <CardHeader className="p-2 pb-1">
            <CardTitle className={cn('flex items-center gap-1.5', typography.card.titleCompact)}>
              <Home className={cn(iconSizes.sm, 'text-teal-500')} />
              {t('finishes.sectionTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 pt-0 space-y-2">
            {/* Flooring */}
            <fieldset className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t('finishes.flooring.label')}</Label>
              <div className="flex flex-wrap gap-1">
                {FLOORING_OPTIONS.map((floor) => {
                  const isSelected = formData.flooring.includes(floor);
                  return (
                    <Button key={floor} type="button"
                      variant={isSelected ? 'default' : 'outline'} size="sm"
                      className="h-6 px-1.5 text-xs"
                      disabled={!isEditing}
                      onClick={() => toggleArrayItem('flooring', floor)}>
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
                <Select value={formData.windowFrames} disabled={!isEditing}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, windowFrames: value }))}>
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
                <Select value={formData.glazing} disabled={!isEditing}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, glazing: value }))}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue placeholder={t('finishes.glazing.label')} /></SelectTrigger>
                  <SelectContent>
                    {GLAZING_OPTIONS.map((g) => (
                      <SelectItem key={g} value={g} className="text-xs">{t(`finishes.glazing.${g}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </fieldset>
            </div>
          </CardContent>
        </Card>

        {/* ─── Features Card ─── */}
        <Card>
          <CardHeader className="p-2 pb-1">
            <CardTitle className={cn('flex items-center gap-1.5', typography.card.titleCompact)}>
              <Shield className={cn(iconSizes.sm, 'text-purple-500')} />
              {t('features.sectionTitle')}
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
                      disabled={!isEditing}
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
                      disabled={!isEditing}
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

export default UnitFieldsBlock;
