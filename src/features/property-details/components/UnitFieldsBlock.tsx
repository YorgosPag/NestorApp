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
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
import {
  Bed, Bath, Compass, Wrench, Zap,
  Ruler, Thermometer, Snowflake, Home, Shield, Flame, FileText
} from 'lucide-react';

import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useTypography } from '@/hooks/useTypography';
import { useTranslation } from '@/i18n/hooks/useTranslation';

import type { Property } from '@/types/property-viewer';
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

// =============================================================================
// COMPONENT
// =============================================================================

export function UnitFieldsBlock({
  property,
  onUpdateProperty,
  isReadOnly = false,
  isEditMode = false,
  onExitEditMode
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
    description: property.description ?? '',
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

  // ── Save handler ──
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const updates: Partial<Property> = {
        name: formData.name,
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

      await onUpdateProperty(property.id, updates);
      if (onExitEditMode) { onExitEditMode(); } else { setLocalEditing(false); }
      toast.success(t('save.success', 'Οι αλλαγές αποθηκεύτηκαν'));
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
  }, [formData, property.id, onUpdateProperty, onExitEditMode, t]);

  // ── Cancel handler ──
  const handleCancel = useCallback(() => {
    setFormData({
      name: property.name ?? '',
      description: property.description ?? '',
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

  // ── View helper: format number or show dash ──
  const displayNum = (val: number) => val > 0 ? String(val) : '—';
  const displayArea = (val: number) => val > 0 ? `${val} m²` : '—';

  return (
    <form
      id={isEditing ? 'unit-fields-form' : undefined}
      className="space-y-4 p-1"
      onSubmit={(e) => { e.preventDefault(); if (isEditing) handleSave(); }}
    >
      {/* ─── Identity Card ─── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className={cn('flex items-center gap-2', typography.card.titleCompact)}>
            <FileText className={cn(iconSizes.md, 'text-blue-500')} />
            {t('fields.identity.sectionTitle', { defaultValue: 'Ταυτότητα Μονάδας' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <fieldset className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">
              {t('fields.identity.name', { defaultValue: 'Όνομα Μονάδας' })}
            </Label>
            {isEditing ? (
              <Input
                id="unit-name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="h-8 text-sm"
                placeholder={t('fields.identity.namePlaceholder', { defaultValue: 'π.χ. Διαμέρισμα Α1' })}
              />
            ) : (
              <p className="text-sm font-medium">{property.name || '—'}</p>
            )}
          </fieldset>
          <fieldset className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">
              {t('fields.identity.description', { defaultValue: 'Περιγραφή' })}
            </Label>
            {isEditing ? (
              <Textarea
                id="unit-description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="h-20 text-sm resize-none"
                placeholder={t('fields.identity.descriptionPlaceholder', { defaultValue: 'Προσθέστε περιγραφή για τη μονάδα...' })}
              />
            ) : (
              property.description ? (
                <p className="text-sm bg-muted/50 p-3 rounded-md">{property.description}</p>
              ) : (
                <p className="text-sm text-muted-foreground">—</p>
              )
            )}
          </fieldset>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════
          ROW 1: Διάταξη, Εμβαδά, Προσανατολισμός, Κατάσταση/Ενέργεια, Συστήματα
      ═══════════════════════════════════════════════════════════════ */}
      <section className="grid grid-cols-5 gap-3">
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
                {isEditing ? (
                  <Input type="number" min={0} max={20} value={formData.bedrooms}
                    onChange={(e) => setFormData(prev => ({ ...prev, bedrooms: parseInt(e.target.value) || 0 }))}
                    className={cn('h-7 text-xs', quick.input)} />
                ) : (
                  <p className="text-sm font-medium">{displayNum(property.layout?.bedrooms ?? 0)}</p>
                )}
              </fieldset>
              <fieldset className="space-y-1">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Bath className={cn(iconSizes.xs, 'text-cyan-600')} />
                  {t('card.stats.bathrooms')}
                </Label>
                {isEditing ? (
                  <Input type="number" min={0} max={10} value={formData.bathrooms}
                    onChange={(e) => setFormData(prev => ({ ...prev, bathrooms: parseInt(e.target.value) || 0 }))}
                    className={cn('h-7 text-xs', quick.input)} />
                ) : (
                  <p className="text-sm font-medium">{displayNum(property.layout?.bathrooms ?? 0)}</p>
                )}
              </fieldset>
              <fieldset className="space-y-1">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Bath className={cn(iconSizes.xs, 'text-sky-500')} />
                  {t('fields.layout.wc')}
                </Label>
                {isEditing ? (
                  <Input type="number" min={0} max={5} value={formData.wc}
                    onChange={(e) => setFormData(prev => ({ ...prev, wc: parseInt(e.target.value) || 0 }))}
                    className={cn('h-7 text-xs', quick.input)} />
                ) : (
                  <p className="text-sm font-medium">{displayNum(property.layout?.wc ?? 0)}</p>
                )}
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
                ['areaGross', 'fields.areas.gross', property.areas?.gross],
                ['areaNet', 'fields.areas.net', property.areas?.net],
                ['areaBalcony', 'fields.areas.balcony', property.areas?.balcony],
                ['areaTerrace', 'fields.areas.terrace', property.areas?.terrace],
                ['areaGarden', 'fields.areas.garden', property.areas?.garden],
              ] as const).map(([field, labelKey, viewValue]) => (
                <fieldset key={field} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t(labelKey)}</Label>
                  {isEditing ? (
                    <Input
                      type="number" min={0} step={0.1}
                      value={formData[field]}
                      onChange={(e) => setFormData(prev => ({ ...prev, [field]: parseFloat(e.target.value) || 0 }))}
                      className={cn('h-7 text-xs', quick.input)}
                    />
                  ) : (
                    <p className="text-sm font-medium">{displayArea(viewValue ?? 0)}</p>
                  )}
                </fieldset>
              ))}
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
          <CardContent className="p-2 pt-0">
            {isEditing ? (
              <div className="flex flex-wrap gap-1">
                {ORIENTATION_OPTIONS.map((orientation) => {
                  const isSelected = formData.orientations.includes(orientation);
                  return (
                    <Button key={orientation} type="button"
                      variant={isSelected ? 'default' : 'outline'} size="sm"
                      className="h-6 px-1.5 text-xs"
                      onClick={() => toggleArrayItem('orientations', orientation)}>
                      {t(`orientation.short.${orientation}`)}
                    </Button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-wrap gap-1">
                {(property.orientations?.length ?? 0) > 0 ? (
                  property.orientations!.map((o) => (
                    <Badge key={o} variant="secondary" className="text-xs">
                      {t(`orientation.short.${o}`)}
                    </Badge>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">—</p>
                )}
              </div>
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
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 pt-0">
            <div className="space-y-2">
              <fieldset className="space-y-1">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Wrench className={cn(iconSizes.xs, 'text-orange-600')} />
                  {t('condition.sectionTitle')}
                </Label>
                {isEditing ? (
                  <Select value={formData.condition}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, condition: value }))}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue placeholder={t('condition.sectionTitle')} /></SelectTrigger>
                    <SelectContent>
                      {CONDITION_OPTIONS.map((c) => (
                        <SelectItem key={c} value={c} className="text-xs">{t(`condition.${c}`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm font-medium">
                    {property.condition ? t(`condition.${property.condition}`) : '—'}
                  </p>
                )}
              </fieldset>
              <fieldset className="space-y-1">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Zap className={cn(iconSizes.xs, 'text-green-600')} />
                  {t('energy.class')}
                </Label>
                {isEditing ? (
                  <Select value={formData.energyClass}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, energyClass: value }))}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue placeholder={t('energy.class')} /></SelectTrigger>
                    <SelectContent>
                      {ENERGY_CLASS_OPTIONS.map((e) => (
                        <SelectItem key={e} value={e} className="text-xs">{e}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm font-medium">{property.energy?.class || '—'}</p>
                )}
              </fieldset>
            </div>
          </CardContent>
        </Card>

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
                {isEditing ? (
                  <Select value={formData.heatingType}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, heatingType: value }))}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue placeholder={t('systems.heating.label')} /></SelectTrigger>
                    <SelectContent>
                      {HEATING_OPTIONS.map((h) => (
                        <SelectItem key={h} value={h} className="text-xs">{t(`systems.heating.${h}`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm font-medium">
                    {property.systemsOverride?.heatingType ? t(`systems.heating.${property.systemsOverride.heatingType}`) : '—'}
                  </p>
                )}
              </fieldset>
              <fieldset className="space-y-1">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Snowflake className={cn(iconSizes.xs, 'text-blue-500')} />
                  {t('systems.cooling.label')}
                </Label>
                {isEditing ? (
                  <Select value={formData.coolingType}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, coolingType: value }))}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue placeholder={t('systems.cooling.label')} /></SelectTrigger>
                    <SelectContent>
                      {COOLING_OPTIONS.map((c) => (
                        <SelectItem key={c} value={c} className="text-xs">{t(`systems.cooling.${c}`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm font-medium">
                    {property.systemsOverride?.coolingType ? t(`systems.cooling.${property.systemsOverride.coolingType}`) : '—'}
                  </p>
                )}
              </fieldset>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          ROW 2: Φινιρίσματα, Χαρακτηριστικά
      ═══════════════════════════════════════════════════════════════ */}
      <section className="grid grid-cols-2 gap-3">
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
              {isEditing ? (
                <div className="flex flex-wrap gap-1">
                  {FLOORING_OPTIONS.map((floor) => {
                    const isSelected = formData.flooring.includes(floor);
                    return (
                      <Button key={floor} type="button"
                        variant={isSelected ? 'default' : 'outline'} size="sm"
                        className="h-6 px-1.5 text-xs"
                        onClick={() => toggleArrayItem('flooring', floor)}>
                        {t(`finishes.flooring.${floor}`)}
                      </Button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {(property.finishes?.flooring?.length ?? 0) > 0 ? (
                    property.finishes!.flooring!.map((f) => (
                      <Badge key={f} variant="secondary" className="text-xs">
                        {t(`finishes.flooring.${f}`)}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">—</p>
                  )}
                </div>
              )}
            </fieldset>

            {/* Frames & Glazing */}
            <div className="grid grid-cols-2 gap-2">
              <fieldset className="space-y-1">
                <Label className="text-xs text-muted-foreground">{t('finishes.frames.label')}</Label>
                {isEditing ? (
                  <Select value={formData.windowFrames}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, windowFrames: value }))}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue placeholder={t('finishes.frames.label')} /></SelectTrigger>
                    <SelectContent>
                      {FRAME_OPTIONS.map((f) => (
                        <SelectItem key={f} value={f} className="text-xs">{t(`finishes.frames.${f}`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm font-medium">
                    {property.finishes?.windowFrames ? t(`finishes.frames.${property.finishes.windowFrames}`) : '—'}
                  </p>
                )}
              </fieldset>
              <fieldset className="space-y-1">
                <Label className="text-xs text-muted-foreground">{t('finishes.glazing.label')}</Label>
                {isEditing ? (
                  <Select value={formData.glazing}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, glazing: value }))}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue placeholder={t('finishes.glazing.label')} /></SelectTrigger>
                    <SelectContent>
                      {GLAZING_OPTIONS.map((g) => (
                        <SelectItem key={g} value={g} className="text-xs">{t(`finishes.glazing.${g}`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm font-medium">
                    {property.finishes?.glazing ? t(`finishes.glazing.${property.finishes.glazing}`) : '—'}
                  </p>
                )}
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
              {isEditing ? (
                <div className="flex flex-wrap gap-1">
                  {INTERIOR_FEATURE_OPTIONS.map((feature) => {
                    const isSelected = formData.interiorFeatures.includes(feature);
                    return (
                      <Button key={feature} type="button"
                        variant={isSelected ? 'default' : 'outline'} size="sm"
                        className="h-6 px-1.5 text-xs"
                        onClick={() => toggleArrayItem('interiorFeatures', feature)}>
                        {t(`features.interior.${feature}`)}
                      </Button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {(property.interiorFeatures?.length ?? 0) > 0 ? (
                    property.interiorFeatures!.map((f) => (
                      <Badge key={f} variant="secondary" className="text-xs">
                        {t(`features.interior.${f}`)}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">—</p>
                  )}
                </div>
              )}
            </fieldset>

            {/* Security Features */}
            <fieldset className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t('features.security.label')}</Label>
              {isEditing ? (
                <div className="flex flex-wrap gap-1">
                  {SECURITY_FEATURE_OPTIONS.map((feature) => {
                    const isSelected = formData.securityFeatures.includes(feature);
                    return (
                      <Button key={feature} type="button"
                        variant={isSelected ? 'default' : 'outline'} size="sm"
                        className="h-6 px-1.5 text-xs"
                        onClick={() => toggleArrayItem('securityFeatures', feature)}>
                        {t(`features.security.${feature}`)}
                      </Button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {(property.securityFeatures?.length ?? 0) > 0 ? (
                    property.securityFeatures!.map((f) => (
                      <Badge key={f} variant="secondary" className="text-xs">
                        {t(`features.security.${f}`)}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">—</p>
                  )}
                </div>
              )}
            </fieldset>
          </CardContent>
        </Card>
      </section>
    </form>
  );
}

export default UnitFieldsBlock;
