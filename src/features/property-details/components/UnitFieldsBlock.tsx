/**
 * =============================================================================
 * 🏢 ENTERPRISE: Unit Fields Block Component
 * =============================================================================
 *
 * Displays and edits extended unit fields (layout, areas, orientations, etc.)
 * Each section wrapped in Card for visual separation (consistent with Parking/Building).
 *
 * @module features/property-details/components/UnitFieldsBlock
 * @enterprise Fortune 500 compliant - ZERO hardcoded values
 * @since 2026-01-24
 * @updated 2026-02-17 — Card containers for visual consistency
 *
 * Features:
 * - i18n support (EL/EN)
 * - Centralized design tokens
 * - Semantic HTML structure
 * - Radix Select for dropdowns (ADR-001)
 * - Inline editing capability
 * - Phase 1-5 Unit Fields complete
 * - Card containers per section (Google Material pattern)
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
import { cn } from '@/lib/utils';

// 🏢 ENTERPRISE: Icons from lucide + centralized entity colors
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
import {
  Bed, Bath, Compass, Wrench, Zap,
  Ruler, Thermometer, Snowflake, Home, Shield, Flame, FileText
} from 'lucide-react';

// 🏢 ENTERPRISE: Centralized tokens
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useTypography } from '@/hooks/useTypography';

// 🏢 ENTERPRISE: i18n
import { useTranslation } from '@/i18n/hooks/useTranslation';

// 🏢 ENTERPRISE: Types
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
// 🏢 TYPES
// =============================================================================

interface UnitFieldsBlockProps {
  /** Property data with extended fields */
  property: Property;
  /** Callback for property updates */
  onUpdateProperty: (propertyId: string, updates: Partial<Property>) => void;
  /** Read-only mode */
  isReadOnly?: boolean;
  /** 🏢 ENTERPRISE: Edit mode controlled by parent (lifting state pattern) */
  isEditMode?: boolean;
  /** 🏢 ENTERPRISE: Callback to exit edit mode */
  onExitEditMode?: () => void;
}

// =============================================================================
// 🏢 CONSTANTS (from centralized enterprise constants)
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
// 🏢 COMPONENT
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

  // 🏢 ENTERPRISE: Use parent-controlled edit mode (lifting state pattern)
  // Fallback to local state only for backwards compatibility
  const [localEditing, setLocalEditing] = useState(false);
  const isEditing = isEditMode || localEditing;
  const [isSaving, setIsSaving] = useState(false);

  // Form state (initialized from property)
  const [formData, setFormData] = useState({
    // 🏢 ENTERPRISE: Name & Description (editable unit identity)
    name: property.name ?? '',
    description: property.description ?? '',
    // Phase 1: Layout
    bedrooms: property.layout?.bedrooms ?? 0,
    bathrooms: property.layout?.bathrooms ?? 0,
    wc: property.layout?.wc ?? 0,
    // Phase 2: Areas
    areaGross: property.areas?.gross ?? 0,
    areaNet: property.areas?.net ?? 0,
    areaBalcony: property.areas?.balcony ?? 0,
    areaTerrace: property.areas?.terrace ?? 0,
    areaGarden: property.areas?.garden ?? 0,
    // Phase 3: Orientation
    orientations: property.orientations ?? [],
    // Phase 4: Condition & Energy
    condition: property.condition ?? '',
    energyClass: property.energy?.class ?? '',
    // Phase 5: Systems
    heatingType: property.systemsOverride?.heatingType ?? '',
    coolingType: property.systemsOverride?.coolingType ?? '',
    // Phase 5: Finishes
    flooring: property.finishes?.flooring ?? [],
    windowFrames: property.finishes?.windowFrames ?? '',
    glazing: property.finishes?.glazing ?? '',
    // Phase 5: Features
    interiorFeatures: property.interiorFeatures ?? [],
    securityFeatures: property.securityFeatures ?? []
  });

  // Handle save
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      // 🏢 ENTERPRISE: Build updates object without undefined values (Firestore doesn't accept undefined)
      const updates: Partial<Property> = {
        // 🏢 ENTERPRISE: Name & Description (editable unit identity)
        name: formData.name,
        // Phase 1: Layout - always include (numbers default to 0)
        layout: {
          bedrooms: formData.bedrooms,
          bathrooms: formData.bathrooms,
          wc: formData.wc
        },
        // Phase 3: Orientation - always include (empty array is valid)
        orientations: formData.orientations as OrientationType[],
      };

      // Description - only include if not empty
      if (formData.description.trim()) {
        updates.description = formData.description.trim();
      }

      // Phase 2: Areas - only include non-zero values (Firestore doesn't accept undefined)
      const areasData: { gross: number; net?: number; balcony?: number; terrace?: number; garden?: number } = {
        gross: formData.areaGross
      };
      if (formData.areaNet > 0) areasData.net = formData.areaNet;
      if (formData.areaBalcony > 0) areasData.balcony = formData.areaBalcony;
      if (formData.areaTerrace > 0) areasData.terrace = formData.areaTerrace;
      if (formData.areaGarden > 0) areasData.garden = formData.areaGarden;
      updates.areas = areasData;

      // Phase 4: Condition - only include if set
      if (formData.condition) {
        updates.condition = formData.condition as ConditionType;
      }

      // Phase 4: Energy - only include if set
      if (formData.energyClass) {
        updates.energy = { class: formData.energyClass as EnergyClassType };
      }

      // Phase 5: Systems - only include if at least one is set
      if (formData.heatingType || formData.coolingType) {
        const systemsOverride: Record<string, string> = {};
        if (formData.heatingType) systemsOverride.heatingType = formData.heatingType;
        if (formData.coolingType) systemsOverride.coolingType = formData.coolingType;
        updates.systemsOverride = systemsOverride as Property['systemsOverride'];
      }

      // Phase 5: Finishes - only include if at least one is set
      if (formData.flooring.length > 0 || formData.windowFrames || formData.glazing) {
        const finishes: Record<string, unknown> = {};
        if (formData.flooring.length > 0) finishes.flooring = formData.flooring;
        if (formData.windowFrames) finishes.windowFrames = formData.windowFrames;
        if (formData.glazing) finishes.glazing = formData.glazing;
        updates.finishes = finishes as Property['finishes'];
      }

      // Phase 5: Features - only include if not empty
      if (formData.interiorFeatures.length > 0) {
        updates.interiorFeatures = formData.interiorFeatures as InteriorFeatureCodeType[];
      }
      if (formData.securityFeatures.length > 0) {
        updates.securityFeatures = formData.securityFeatures as SecurityFeatureCodeType[];
      }

      await onUpdateProperty(property.id, updates);
      // 🏢 ENTERPRISE: Exit edit mode via parent callback or local state
      if (onExitEditMode) {
        onExitEditMode();
      } else {
        setLocalEditing(false);
      }
      toast.success(t('save.success', 'Οι αλλαγές αποθηκεύτηκαν'));
    } catch (error) {
      // 🏢 ENTERPRISE: Proper error handling for permission denied
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('permission') || errorMessage.includes('PERMISSION_DENIED')) {
        toast.error(t('save.permissionDenied', 'Δεν έχετε δικαίωμα επεξεργασίας αυτής της μονάδας'));
      } else {
        toast.error(t('save.error', 'Σφάλμα κατά την αποθήκευση'));
      }
      logger.error('UnitFieldsBlock save error:', { error: error });
    } finally {
      setIsSaving(false);
    }
  }, [formData, property.id, onUpdateProperty, onExitEditMode, t]);

  // Handle cancel
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
    if (onExitEditMode) {
      onExitEditMode();
    } else {
      setLocalEditing(false);
    }
  }, [property, onExitEditMode]);

  // Toggle multi-select arrays
  const toggleArrayItem = useCallback(<T extends string>(
    field: 'orientations' | 'flooring' | 'interiorFeatures' | 'securityFeatures',
    value: T
  ) => {
    setFormData(prev => {
      const current = prev[field] as T[];
      const isSelected = current.includes(value);
      return {
        ...prev,
        [field]: isSelected
          ? current.filter(item => item !== value)
          : [...current, value]
      };
    });
  }, []);

  return (
    <form
      id={isEditing ? 'unit-fields-form' : undefined}
      className="space-y-4 p-1"
      onSubmit={(e) => { e.preventDefault(); if (isEditing) handleSave(); }}
    >
      {/* ─── Identity Card (Name + Description) ─── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className={cn('flex items-center gap-2', typography.card.titleCompact)}>
            <FileText className={cn(iconSizes.md, 'text-blue-500')} />
            {t('fields.identity.sectionTitle', { defaultValue: 'Ταυτότητα Μονάδας' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <fieldset className="space-y-1.5">
            <Label htmlFor="unit-name" className="text-xs font-medium">
              {t('fields.identity.name', { defaultValue: 'Όνομα Μονάδας' })}
            </Label>
            <Input
              id="unit-name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              disabled={!isEditing}
              className="h-8 text-sm"
              placeholder={t('fields.identity.namePlaceholder', { defaultValue: 'π.χ. Διαμέρισμα Α1' })}
            />
          </fieldset>
          <fieldset className="space-y-1.5">
            <Label htmlFor="unit-description" className="text-xs font-medium">
              {t('fields.identity.description', { defaultValue: 'Περιγραφή' })}
            </Label>
            <textarea
              id="unit-description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              disabled={!isEditing}
              className={cn(
                'w-full h-20 text-sm px-3 py-2 rounded-md border border-input bg-background resize-none',
                !isEditing && 'disabled:cursor-default disabled:opacity-70'
              )}
              placeholder={t('fields.identity.descriptionPlaceholder', { defaultValue: 'Προσθέστε περιγραφή για τη μονάδα...' })}
            />
          </fieldset>
        </CardContent>
      </Card>

      {/* ─── Layout Card (Bedrooms, Bathrooms, WC) ─── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className={cn('flex items-center gap-2', typography.card.titleCompact)}>
            <Bed className={cn(iconSizes.md, 'text-violet-500')} />
            {t('fields.layout.sectionTitle', { defaultValue: 'Διάταξη' })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`grid grid-cols-3 ${spacing.gap.sm}`}>
            <fieldset className="space-y-1.5">
              <Label htmlFor="bedrooms" className="text-xs flex items-center gap-1">
                <Bed className={cn(iconSizes.xs, 'text-violet-600')} />
                {t('card.stats.bedrooms')}
              </Label>
              <Input
                id="bedrooms"
                type="number"
                min={0}
                max={20}
                value={formData.bedrooms}
                onChange={(e) => setFormData(prev => ({ ...prev, bedrooms: parseInt(e.target.value) || 0 }))}
                disabled={!isEditing}
                className={cn('h-8 text-xs', quick.input)}
              />
            </fieldset>
            <fieldset className="space-y-1.5">
              <Label htmlFor="bathrooms" className="text-xs flex items-center gap-1">
                <Bath className={cn(iconSizes.xs, 'text-cyan-600')} />
                {t('card.stats.bathrooms')}
              </Label>
              <Input
                id="bathrooms"
                type="number"
                min={0}
                max={10}
                value={formData.bathrooms}
                onChange={(e) => setFormData(prev => ({ ...prev, bathrooms: parseInt(e.target.value) || 0 }))}
                disabled={!isEditing}
                className={cn('h-8 text-xs', quick.input)}
              />
            </fieldset>
            <fieldset className="space-y-1.5">
              <Label htmlFor="wc" className="text-xs flex items-center gap-1">
                <Bath className={cn(iconSizes.xs, 'text-sky-500')} />
                {t('fields.layout.wc')}
              </Label>
              <Input
                id="wc"
                type="number"
                min={0}
                max={5}
                value={formData.wc}
                onChange={(e) => setFormData(prev => ({ ...prev, wc: parseInt(e.target.value) || 0 }))}
                disabled={!isEditing}
                className={cn('h-8 text-xs', quick.input)}
              />
            </fieldset>
          </div>
        </CardContent>
      </Card>

      {/* ─── Areas Card ─── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className={cn('flex items-center gap-2', typography.card.titleCompact)}>
            <Ruler className={cn(iconSizes.md, NAVIGATION_ENTITIES.area.color)} />
            {t('fields.areas.sectionTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`grid grid-cols-5 ${spacing.gap.sm}`}>
            <fieldset className="space-y-1.5">
              <Label htmlFor="areaGross" className="text-xs">{t('fields.areas.gross')}</Label>
              <Input
                id="areaGross"
                type="number"
                min={0}
                step={0.1}
                value={formData.areaGross}
                onChange={(e) => setFormData(prev => ({ ...prev, areaGross: parseFloat(e.target.value) || 0 }))}
                disabled={!isEditing}
                className={cn('h-8 text-xs', quick.input)}
              />
            </fieldset>
            <fieldset className="space-y-1.5">
              <Label htmlFor="areaNet" className="text-xs">{t('fields.areas.net')}</Label>
              <Input
                id="areaNet"
                type="number"
                min={0}
                step={0.1}
                value={formData.areaNet}
                onChange={(e) => setFormData(prev => ({ ...prev, areaNet: parseFloat(e.target.value) || 0 }))}
                disabled={!isEditing}
                className={cn('h-8 text-xs', quick.input)}
              />
            </fieldset>
            <fieldset className="space-y-1.5">
              <Label htmlFor="areaBalcony" className="text-xs">{t('fields.areas.balcony')}</Label>
              <Input
                id="areaBalcony"
                type="number"
                min={0}
                step={0.1}
                value={formData.areaBalcony}
                onChange={(e) => setFormData(prev => ({ ...prev, areaBalcony: parseFloat(e.target.value) || 0 }))}
                disabled={!isEditing}
                className={cn('h-8 text-xs', quick.input)}
              />
            </fieldset>
            <fieldset className="space-y-1.5">
              <Label htmlFor="areaTerrace" className="text-xs">{t('fields.areas.terrace')}</Label>
              <Input
                id="areaTerrace"
                type="number"
                min={0}
                step={0.1}
                value={formData.areaTerrace}
                onChange={(e) => setFormData(prev => ({ ...prev, areaTerrace: parseFloat(e.target.value) || 0 }))}
                disabled={!isEditing}
                className={cn('h-8 text-xs', quick.input)}
              />
            </fieldset>
            <fieldset className="space-y-1.5">
              <Label htmlFor="areaGarden" className="text-xs">{t('fields.areas.garden')}</Label>
              <Input
                id="areaGarden"
                type="number"
                min={0}
                step={0.1}
                value={formData.areaGarden}
                onChange={(e) => setFormData(prev => ({ ...prev, areaGarden: parseFloat(e.target.value) || 0 }))}
                disabled={!isEditing}
                className={cn('h-8 text-xs', quick.input)}
              />
            </fieldset>
          </div>
        </CardContent>
      </Card>

      {/* ─── Orientation Card ─── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className={cn('flex items-center gap-2', typography.card.titleCompact)}>
            <Compass className={cn(iconSizes.md, 'text-amber-500')} />
            {t('orientation.sectionTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`flex flex-wrap ${spacing.gap.sm}`}>
            {ORIENTATION_OPTIONS.map((orientation) => {
              const isSelected = formData.orientations.includes(orientation);
              return (
                <Button
                  key={orientation}
                  type="button"
                  variant={isSelected ? 'default' : 'outline'}
                  size="sm"
                  disabled={!isEditing}
                  className="h-7 px-2 text-xs"
                  onClick={() => toggleArrayItem('orientations', orientation)}
                >
                  {t(`orientation.short.${orientation}`)}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ─── Condition & Energy Card ─── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className={cn('flex items-center gap-2', typography.card.titleCompact)}>
            <Wrench className={cn(iconSizes.md, 'text-orange-500')} />
            {t('condition.sectionTitle')}
            <span className="text-muted-foreground">&</span>
            <Zap className={cn(iconSizes.md, 'text-green-500')} />
            {t('energy.class')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`grid grid-cols-2 ${spacing.gap.sm}`}>
            <fieldset className="space-y-1.5">
              <Label htmlFor="condition" className="text-xs flex items-center gap-1">
                <Wrench className={cn(iconSizes.xs, 'text-orange-600')} />
                {t('condition.sectionTitle')}
              </Label>
              <Select
                value={formData.condition}
                onValueChange={(value) => setFormData(prev => ({ ...prev, condition: value }))}
                disabled={!isEditing}
              >
                <SelectTrigger id="condition" className="h-8 text-xs">
                  <SelectValue placeholder={t('condition.sectionTitle')} />
                </SelectTrigger>
                <SelectContent>
                  {CONDITION_OPTIONS.map((condition) => (
                    <SelectItem key={condition} value={condition} className="text-xs">
                      {t(`condition.${condition}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </fieldset>
            <fieldset className="space-y-1.5">
              <Label htmlFor="energyClass" className="text-xs flex items-center gap-1">
                <Zap className={cn(iconSizes.xs, 'text-green-600')} />
                {t('energy.class')}
              </Label>
              <Select
                value={formData.energyClass}
                onValueChange={(value) => setFormData(prev => ({ ...prev, energyClass: value }))}
                disabled={!isEditing}
              >
                <SelectTrigger id="energyClass" className="h-8 text-xs">
                  <SelectValue placeholder={t('energy.class')} />
                </SelectTrigger>
                <SelectContent>
                  {ENERGY_CLASS_OPTIONS.map((energyClass) => (
                    <SelectItem key={energyClass} value={energyClass} className="text-xs">
                      {energyClass}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </fieldset>
          </div>
        </CardContent>
      </Card>

      {/* ─── Systems Card (Heating + Cooling) ─── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className={cn('flex items-center gap-2', typography.card.titleCompact)}>
            <Thermometer className={cn(iconSizes.md, 'text-red-500')} />
            {t('systems.sectionTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`grid grid-cols-2 ${spacing.gap.sm}`}>
            <fieldset className="space-y-1.5">
              <Label htmlFor="heatingType" className="text-xs flex items-center gap-1">
                <Flame className={cn(iconSizes.xs, 'text-orange-500')} />
                {t('systems.heating.label')}
              </Label>
              <Select
                value={formData.heatingType}
                onValueChange={(value) => setFormData(prev => ({ ...prev, heatingType: value }))}
                disabled={!isEditing}
              >
                <SelectTrigger id="heatingType" className="h-8 text-xs">
                  <SelectValue placeholder={t('systems.heating.label')} />
                </SelectTrigger>
                <SelectContent>
                  {HEATING_OPTIONS.map((heating) => (
                    <SelectItem key={heating} value={heating} className="text-xs">
                      {t(`systems.heating.${heating}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </fieldset>
            <fieldset className="space-y-1.5">
              <Label htmlFor="coolingType" className="text-xs flex items-center gap-1">
                <Snowflake className={cn(iconSizes.xs, 'text-blue-500')} />
                {t('systems.cooling.label')}
              </Label>
              <Select
                value={formData.coolingType}
                onValueChange={(value) => setFormData(prev => ({ ...prev, coolingType: value }))}
                disabled={!isEditing}
              >
                <SelectTrigger id="coolingType" className="h-8 text-xs">
                  <SelectValue placeholder={t('systems.cooling.label')} />
                </SelectTrigger>
                <SelectContent>
                  {COOLING_OPTIONS.map((cooling) => (
                    <SelectItem key={cooling} value={cooling} className="text-xs">
                      {t(`systems.cooling.${cooling}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </fieldset>
          </div>
        </CardContent>
      </Card>

      {/* ─── Finishes Card (Flooring, Frames, Glazing) ─── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className={cn('flex items-center gap-2', typography.card.titleCompact)}>
            <Home className={cn(iconSizes.md, 'text-teal-500')} />
            {t('finishes.sectionTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Flooring - Multi-select buttons */}
          <fieldset>
            <Label className="text-xs mb-1.5 block">{t('finishes.flooring.label')}</Label>
            <div className={`flex flex-wrap ${spacing.gap.sm}`}>
              {FLOORING_OPTIONS.map((floor) => {
                const isSelected = formData.flooring.includes(floor);
                return (
                  <Button
                    key={floor}
                    type="button"
                    variant={isSelected ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 px-2 text-xs"
                    disabled={!isEditing}
                    onClick={() => toggleArrayItem('flooring', floor)}
                  >
                    {t(`finishes.flooring.${floor}`)}
                  </Button>
                );
              })}
            </div>
          </fieldset>

          {/* Frames & Glazing */}
          <div className={`grid grid-cols-2 ${spacing.gap.sm}`}>
            <fieldset className="space-y-1.5">
              <Label htmlFor="windowFrames" className="text-xs">{t('finishes.frames.label')}</Label>
              <Select
                value={formData.windowFrames}
                onValueChange={(value) => setFormData(prev => ({ ...prev, windowFrames: value }))}
                disabled={!isEditing}
              >
                <SelectTrigger id="windowFrames" className="h-8 text-xs">
                  <SelectValue placeholder={t('finishes.frames.label')} />
                </SelectTrigger>
                <SelectContent>
                  {FRAME_OPTIONS.map((frame) => (
                    <SelectItem key={frame} value={frame} className="text-xs">
                      {t(`finishes.frames.${frame}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </fieldset>
            <fieldset className="space-y-1.5">
              <Label htmlFor="glazing" className="text-xs">{t('finishes.glazing.label')}</Label>
              <Select
                value={formData.glazing}
                onValueChange={(value) => setFormData(prev => ({ ...prev, glazing: value }))}
                disabled={!isEditing}
              >
                <SelectTrigger id="glazing" className="h-8 text-xs">
                  <SelectValue placeholder={t('finishes.glazing.label')} />
                </SelectTrigger>
                <SelectContent>
                  {GLAZING_OPTIONS.map((glaze) => (
                    <SelectItem key={glaze} value={glaze} className="text-xs">
                      {t(`finishes.glazing.${glaze}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </fieldset>
          </div>
        </CardContent>
      </Card>

      {/* ─── Features Card (Interior & Security) ─── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className={cn('flex items-center gap-2', typography.card.titleCompact)}>
            <Shield className={cn(iconSizes.md, 'text-purple-500')} />
            {t('features.sectionTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Interior Features */}
          <fieldset>
            <Label className="text-xs mb-1.5 block">{t('features.interior.label')}</Label>
            <div className={`flex flex-wrap ${spacing.gap.sm}`}>
              {INTERIOR_FEATURE_OPTIONS.map((feature) => {
                const isSelected = formData.interiorFeatures.includes(feature);
                return (
                  <Button
                    key={feature}
                    type="button"
                    variant={isSelected ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 px-2 text-xs"
                    disabled={!isEditing}
                    onClick={() => toggleArrayItem('interiorFeatures', feature)}
                  >
                    {t(`features.interior.${feature}`)}
                  </Button>
                );
              })}
            </div>
          </fieldset>

          {/* Security Features */}
          <fieldset>
            <Label className="text-xs mb-1.5 block">{t('features.security.label')}</Label>
            <div className={`flex flex-wrap ${spacing.gap.sm}`}>
              {SECURITY_FEATURE_OPTIONS.map((feature) => {
                const isSelected = formData.securityFeatures.includes(feature);
                return (
                  <Button
                    key={feature}
                    type="button"
                    variant={isSelected ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 px-2 text-xs"
                    disabled={!isEditing}
                    onClick={() => toggleArrayItem('securityFeatures', feature)}
                  >
                    {t(`features.security.${feature}`)}
                  </Button>
                );
              })}
            </div>
          </fieldset>
        </CardContent>
      </Card>
    </form>
  );
}

export default UnitFieldsBlock;
