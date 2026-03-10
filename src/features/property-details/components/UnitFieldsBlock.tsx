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

import React, { useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
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
import {
  Bed, Bath, Compass, Wrench, Zap,
  Ruler, Thermometer, Snowflake, Home, Shield, Flame, FileText, MapPin
} from 'lucide-react';

import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useTypography } from '@/hooks/useTypography';
import { useTranslation } from '@/i18n/hooks/useTranslation';

import type { Property } from '@/types/property-viewer';
import type { UnitType } from '@/types/unit';
import { formatFloorLabel } from '@/lib/intl-utils';
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
  'apartment_3br', 'maisonette', 'shop', 'office', 'storage'
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

  const [localEditing, setLocalEditing] = useState(false);
  const isEditing = isEditMode || localEditing;
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: property.name ?? '',
    code: property.code ?? '',
    type: property.type ?? '',
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

  // ── Build updates from form data ──
  const buildUpdatesFromForm = useCallback((): Partial<Property> => {
    const updates: Partial<Property> = {
      name: formData.name,
      code: formData.code || undefined,
      type: formData.type,
      floor: formData.floor,
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
        // 🏢 ENTERPRISE: Create new unit via addUnit service
        const { addUnit } = await import('@/services/units.service');
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
        const result = await addUnit(unitData as Omit<Property, 'id'>);
        if (result.success && onUnitCreated) {
          onUnitCreated(result.id);
        }
        toast.success(t('save.createSuccess', { defaultValue: 'Η μονάδα δημιουργήθηκε επιτυχώς' }));
      } else {
        // Normal update
        await onUpdateProperty(property.id, updates);
        if (onExitEditMode) { onExitEditMode(); } else { setLocalEditing(false); }
        toast.success(t('save.success', 'Οι αλλαγές αποθηκεύτηκαν'));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('permission') || errorMessage.includes('PERMISSION_DENIED')) {
        toast.error(t('save.permissionDenied', 'Δεν έχετε δικαίωμα επεξεργασίας αυτής της μονάδας'));
      } else {
        toast.error(t('save.error', 'Σφάλμα κατά την αποθήκευση'));
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
                disabled={!isEditing}
              />
            </fieldset>
            <fieldset className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                {t('fields.identity.code', { defaultValue: 'Κωδικός Μονάδας' })}
              </Label>
              <Input
                id="unit-code"
                value={formData.code}
                onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                className={cn('h-7 text-xs', quick.input)}
                placeholder={t('fields.identity.codePlaceholder', { defaultValue: 'π.χ. A_D0.1' })}
                disabled={!isEditing}
              />
            </fieldset>
            <fieldset className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                {t('fields.identity.type', { defaultValue: 'Τύπος Μονάδας' })}
              </Label>
              <Select value={formData.type} disabled={!isEditing}
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

        {/* ─── Location Card ─── */}
        <Card>
          <CardHeader className="p-2 pb-1">
            <CardTitle className={cn('flex items-center gap-1.5', typography.card.titleCompact)}>
              <MapPin className={cn(iconSizes.sm, 'text-rose-500')} />
              {t('fields.location.sectionTitle', { defaultValue: 'Θέση' })}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 pt-0 space-y-2">
            <fieldset className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <NAVIGATION_ENTITIES.floor.icon className={cn(iconSizes.xs, NAVIGATION_ENTITIES.floor.color)} />
                {t('fields.location.floor', { defaultValue: 'Όροφος' })}
              </Label>
              {isEditing ? (
                <Input
                  id="unit-floor"
                  type="number"
                  min={-5}
                  max={100}
                  value={formData.floor}
                  onChange={(e) => setFormData(prev => ({ ...prev, floor: parseInt(e.target.value) || 0 }))}
                  className={cn('h-7 text-xs', quick.input)}
                />
              ) : (
                <p className="text-xs">{formatFloorLabel(formData.floor)}</p>
              )}
            </fieldset>
            <fieldset className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Compass className={cn(iconSizes.xs, 'text-amber-500')} />
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
                  className={cn('h-7 text-xs', quick.input)} disabled={!isEditing} />
              </fieldset>
              <fieldset className="space-y-1">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Bath className={cn(iconSizes.xs, 'text-cyan-600')} />
                  {t('card.stats.bathrooms')}
                </Label>
                <Input type="number" min={0} max={10} value={formData.bathrooms}
                  onChange={(e) => setFormData(prev => ({ ...prev, bathrooms: parseInt(e.target.value) || 0 }))}
                  className={cn('h-7 text-xs', quick.input)} disabled={!isEditing} />
              </fieldset>
              <fieldset className="space-y-1">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Bath className={cn(iconSizes.xs, 'text-sky-500')} />
                  {t('fields.layout.wc')}
                </Label>
                <Input type="number" min={0} max={5} value={formData.wc}
                  onChange={(e) => setFormData(prev => ({ ...prev, wc: parseInt(e.target.value) || 0 }))}
                  className={cn('h-7 text-xs', quick.input)} disabled={!isEditing} />
              </fieldset>
            </div>
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
                    disabled={!isEditing}
                  />
                </fieldset>
              ))}
            </div>
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
