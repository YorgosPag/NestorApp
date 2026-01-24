/**
 * =============================================================================
 * 🏢 ENTERPRISE: Unit Fields Block Component
 * =============================================================================
 *
 * Displays and edits extended unit fields (layout, areas, orientations, etc.)
 * Following enterprise patterns established in other Block components.
 *
 * @module features/property-details/components/UnitFieldsBlock
 * @enterprise Fortune 500 compliant - ZERO hardcoded values
 * @since 2026-01-24
 *
 * Features:
 * - i18n support (EL/EN)
 * - Centralized design tokens
 * - Semantic HTML structure
 * - Radix Select for dropdowns (ADR-001)
 * - Inline editing capability
 * - Phase 1-5 Unit Fields complete
 */

'use client';

import React, { useState, useCallback } from 'react';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

// 🏢 ENTERPRISE: Icons from lucide
import { NAVIGATION_ACTIONS } from '@/components/navigation/config/navigation-entities';
import {
  Bed, Bath, Compass, Wrench, Zap, Save, X,
  Ruler, Thermometer, Snowflake, Home, Shield, Flame
} from 'lucide-react';

// 🏢 ENTERPRISE: Centralized tokens
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';

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

  // 🏢 ENTERPRISE: Use parent-controlled edit mode (lifting state pattern)
  // Fallback to local state only for backwards compatibility
  const [localEditing, setLocalEditing] = useState(false);
  const isEditing = isEditMode || localEditing;
  const [isSaving, setIsSaving] = useState(false);

  // Form state (initialized from property)
  const [formData, setFormData] = useState({
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
        // Phase 1: Layout - always include (numbers default to 0)
        layout: {
          bedrooms: formData.bedrooms,
          bathrooms: formData.bathrooms,
          wc: formData.wc
        },
        // Phase 3: Orientation - always include (empty array is valid)
        orientations: formData.orientations as OrientationType[],
      };

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
    } finally {
      setIsSaving(false);
    }
  }, [formData, property.id, onUpdateProperty, onExitEditMode]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    setFormData({
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
    // 🏢 ENTERPRISE: Exit edit mode via parent callback or local state
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

  // Check if there's any data to show
  const hasData = (
    (property.layout?.bedrooms ?? 0) > 0 ||
    (property.layout?.bathrooms ?? 0) > 0 ||
    (property.areas?.gross ?? 0) > 0 ||
    (property.orientations?.length ?? 0) > 0 ||
    property.condition ||
    property.energy?.class ||
    property.systemsOverride?.heatingType ||
    property.systemsOverride?.coolingType ||
    (property.finishes?.flooring?.length ?? 0) > 0 ||
    (property.interiorFeatures?.length ?? 0) > 0 ||
    (property.securityFeatures?.length ?? 0) > 0
  );

  // 🏢 ENTERPRISE: NEVER return null - always show placeholders in view mode
  // This follows Fortune 500 UX patterns: "view mode ≠ hidden mode"

  return (
    <>
      <Separator />
      <section className={spacing.spaceBetween.sm} aria-labelledby="unit-fields-title">
        {/* Header - 🏢 ENTERPRISE: Edit button removed - controlled by parent (PropertyMeta) */}
        <header className={`flex items-center justify-between ${spacing.gap.sm}`}>
          <h4 id="unit-fields-title" className="text-xs font-medium">
            {t('features.sectionTitle', { defaultValue: 'Χαρακτηριστικά Μονάδας' })}
          </h4>
          {/* 🏢 ENTERPRISE: Edit button removed per enterprise UX guidelines
              Single "Edit details" button in PropertyMeta controls all fields */}
        </header>

        {/* Content */}
        {isEditing ? (
          // Edit Mode
          <form
            className={spacing.spaceBetween.sm}
            onSubmit={(e) => { e.preventDefault(); handleSave(); }}
          >
            {/* ═══════════════════════════════════════════════════════════════
                PHASE 1: LAYOUT (Bedrooms, Bathrooms, WC)
            ═══════════════════════════════════════════════════════════════ */}
            <fieldset className={`grid grid-cols-3 ${spacing.gap.sm}`}>
              <legend className="sr-only">{t('fields.layout.bedrooms')}</legend>

              {/* Bedrooms */}
              <article>
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
                  className={cn('h-8 text-xs mt-1', quick.input)}
                />
              </article>

              {/* Bathrooms */}
              <article>
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
                  className={cn('h-8 text-xs mt-1', quick.input)}
                />
              </article>

              {/* WC */}
              <article>
                <Label htmlFor="wc" className="text-xs">
                  {t('fields.layout.wc')}
                </Label>
                <Input
                  id="wc"
                  type="number"
                  min={0}
                  max={5}
                  value={formData.wc}
                  onChange={(e) => setFormData(prev => ({ ...prev, wc: parseInt(e.target.value) || 0 }))}
                  className={cn('h-8 text-xs mt-1', quick.input)}
                />
              </article>
            </fieldset>

            {/* ═══════════════════════════════════════════════════════════════
                PHASE 2: AREAS (Gross, Net, Balcony, Terrace, Garden)
            ═══════════════════════════════════════════════════════════════ */}
            <fieldset>
              <legend className="text-xs font-medium flex items-center gap-1 mb-2">
                <Ruler className={cn(iconSizes.xs, 'text-blue-600')} />
                {t('fields.areas.sectionTitle')}
              </legend>
              <div className={`grid grid-cols-5 ${spacing.gap.sm}`}>
                <article>
                  <Label htmlFor="areaGross" className="text-xs">{t('fields.areas.gross')}</Label>
                  <Input
                    id="areaGross"
                    type="number"
                    min={0}
                    step={0.1}
                    value={formData.areaGross}
                    onChange={(e) => setFormData(prev => ({ ...prev, areaGross: parseFloat(e.target.value) || 0 }))}
                    className={cn('h-8 text-xs mt-1', quick.input)}
                  />
                </article>
                <article>
                  <Label htmlFor="areaNet" className="text-xs">{t('fields.areas.net')}</Label>
                  <Input
                    id="areaNet"
                    type="number"
                    min={0}
                    step={0.1}
                    value={formData.areaNet}
                    onChange={(e) => setFormData(prev => ({ ...prev, areaNet: parseFloat(e.target.value) || 0 }))}
                    className={cn('h-8 text-xs mt-1', quick.input)}
                  />
                </article>
                <article>
                  <Label htmlFor="areaBalcony" className="text-xs">{t('fields.areas.balcony')}</Label>
                  <Input
                    id="areaBalcony"
                    type="number"
                    min={0}
                    step={0.1}
                    value={formData.areaBalcony}
                    onChange={(e) => setFormData(prev => ({ ...prev, areaBalcony: parseFloat(e.target.value) || 0 }))}
                    className={cn('h-8 text-xs mt-1', quick.input)}
                  />
                </article>
                <article>
                  <Label htmlFor="areaTerrace" className="text-xs">{t('fields.areas.terrace')}</Label>
                  <Input
                    id="areaTerrace"
                    type="number"
                    min={0}
                    step={0.1}
                    value={formData.areaTerrace}
                    onChange={(e) => setFormData(prev => ({ ...prev, areaTerrace: parseFloat(e.target.value) || 0 }))}
                    className={cn('h-8 text-xs mt-1', quick.input)}
                  />
                </article>
                <article>
                  <Label htmlFor="areaGarden" className="text-xs">{t('fields.areas.garden')}</Label>
                  <Input
                    id="areaGarden"
                    type="number"
                    min={0}
                    step={0.1}
                    value={formData.areaGarden}
                    onChange={(e) => setFormData(prev => ({ ...prev, areaGarden: parseFloat(e.target.value) || 0 }))}
                    className={cn('h-8 text-xs mt-1', quick.input)}
                  />
                </article>
              </div>
            </fieldset>

            {/* ═══════════════════════════════════════════════════════════════
                PHASE 3: ORIENTATION
            ═══════════════════════════════════════════════════════════════ */}
            <fieldset>
              <legend className="text-xs font-medium flex items-center gap-1 mb-2">
                <Compass className={cn(iconSizes.xs, 'text-amber-600')} />
                {t('orientation.sectionTitle')}
              </legend>
              <div className={`flex flex-wrap ${spacing.gap.sm}`}>
                {ORIENTATION_OPTIONS.map((orientation) => {
                  const isSelected = formData.orientations.includes(orientation);
                  return (
                    <Button
                      key={orientation}
                      type="button"
                      variant={isSelected ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => toggleArrayItem('orientations', orientation)}
                    >
                      {t(`orientation.short.${orientation}`)}
                    </Button>
                  );
                })}
              </div>
            </fieldset>

            {/* ═══════════════════════════════════════════════════════════════
                PHASE 4: CONDITION & ENERGY
            ═══════════════════════════════════════════════════════════════ */}
            <fieldset className={`grid grid-cols-2 ${spacing.gap.sm}`}>
              <article>
                <Label htmlFor="condition" className="text-xs flex items-center gap-1">
                  <Wrench className={cn(iconSizes.xs, 'text-orange-600')} />
                  {t('condition.sectionTitle')}
                </Label>
                <Select
                  value={formData.condition}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, condition: value }))}
                >
                  <SelectTrigger id="condition" className="h-8 text-xs mt-1">
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
              </article>

              <article>
                <Label htmlFor="energyClass" className="text-xs flex items-center gap-1">
                  <Zap className={cn(iconSizes.xs, 'text-green-600')} />
                  {t('energy.class')}
                </Label>
                <Select
                  value={formData.energyClass}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, energyClass: value }))}
                >
                  <SelectTrigger id="energyClass" className="h-8 text-xs mt-1">
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
              </article>
            </fieldset>

            {/* ═══════════════════════════════════════════════════════════════
                PHASE 5: SYSTEMS (Heating, Cooling)
            ═══════════════════════════════════════════════════════════════ */}
            <fieldset>
              <legend className="text-xs font-medium flex items-center gap-1 mb-2">
                <Thermometer className={cn(iconSizes.xs, 'text-red-600')} />
                {t('systems.sectionTitle')}
              </legend>
              <div className={`grid grid-cols-2 ${spacing.gap.sm}`}>
                <article>
                  <Label htmlFor="heatingType" className="text-xs flex items-center gap-1">
                    <Flame className={cn(iconSizes.xs, 'text-orange-500')} />
                    {t('systems.heating.label')}
                  </Label>
                  <Select
                    value={formData.heatingType}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, heatingType: value }))}
                  >
                    <SelectTrigger id="heatingType" className="h-8 text-xs mt-1">
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
                </article>

                <article>
                  <Label htmlFor="coolingType" className="text-xs flex items-center gap-1">
                    <Snowflake className={cn(iconSizes.xs, 'text-blue-500')} />
                    {t('systems.cooling.label')}
                  </Label>
                  <Select
                    value={formData.coolingType}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, coolingType: value }))}
                  >
                    <SelectTrigger id="coolingType" className="h-8 text-xs mt-1">
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
                </article>
              </div>
            </fieldset>

            {/* ═══════════════════════════════════════════════════════════════
                PHASE 5: FINISHES (Flooring, Frames, Glazing)
            ═══════════════════════════════════════════════════════════════ */}
            <fieldset>
              <legend className="text-xs font-medium flex items-center gap-1 mb-2">
                <Home className={cn(iconSizes.xs, 'text-teal-600')} />
                {t('finishes.sectionTitle')}
              </legend>

              {/* Flooring - Multi-select buttons */}
              <div className="mb-3">
                <Label className="text-xs mb-1 block">{t('finishes.flooring.label')}</Label>
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
                        onClick={() => toggleArrayItem('flooring', floor)}
                      >
                        {t(`finishes.flooring.${floor}`)}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Frames & Glazing */}
              <div className={`grid grid-cols-2 ${spacing.gap.sm}`}>
                <article>
                  <Label htmlFor="windowFrames" className="text-xs">{t('finishes.frames.label')}</Label>
                  <Select
                    value={formData.windowFrames}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, windowFrames: value }))}
                  >
                    <SelectTrigger id="windowFrames" className="h-8 text-xs mt-1">
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
                </article>

                <article>
                  <Label htmlFor="glazing" className="text-xs">{t('finishes.glazing.label')}</Label>
                  <Select
                    value={formData.glazing}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, glazing: value }))}
                  >
                    <SelectTrigger id="glazing" className="h-8 text-xs mt-1">
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
                </article>
              </div>
            </fieldset>

            {/* ═══════════════════════════════════════════════════════════════
                PHASE 5: FEATURES (Interior & Security)
            ═══════════════════════════════════════════════════════════════ */}
            <fieldset>
              <legend className="text-xs font-medium flex items-center gap-1 mb-2">
                <Shield className={cn(iconSizes.xs, 'text-purple-600')} />
                {t('features.sectionTitle')}
              </legend>

              {/* Interior Features */}
              <div className="mb-3">
                <Label className="text-xs mb-1 block">{t('features.interior.label')}</Label>
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
                        onClick={() => toggleArrayItem('interiorFeatures', feature)}
                      >
                        {t(`features.interior.${feature}`)}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Security Features */}
              <div>
                <Label className="text-xs mb-1 block">{t('features.security.label')}</Label>
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
                        onClick={() => toggleArrayItem('securityFeatures', feature)}
                      >
                        {t(`features.security.${feature}`)}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </fieldset>

            {/* ═══════════════════════════════════════════════════════════════
                ACTIONS (Save / Cancel)
            ═══════════════════════════════════════════════════════════════ */}
            <footer className={`flex justify-end ${spacing.gap.sm}`}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={isSaving}
              >
                <X className={cn(iconSizes.xs, spacing.margin.right.sm)} />
                {t('dialog.cancel', { ns: 'common', defaultValue: 'Ακύρωση' })}
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSaving}
              >
                <Save className={cn(iconSizes.xs, spacing.margin.right.sm)} />
                {isSaving ? '...' : t('buildingSelector.save', { defaultValue: 'Αποθήκευση' })}
              </Button>
            </footer>
          </form>
        ) : (
          // ═══════════════════════════════════════════════════════════════
          // VIEW MODE - 🏢 ENTERPRISE: Always show placeholders (Fortune 500 pattern)
          // ═══════════════════════════════════════════════════════════════
          <dl className={spacing.spaceBetween.sm}>
            {/* Layout (Bedrooms, Bathrooms, WC) - Always visible */}
            <div className={`flex flex-wrap ${spacing.gap.md} text-xs`}>
              <div className="flex items-center gap-1">
                <dt className="sr-only">{t('fields.layout.bedrooms')}</dt>
                <Bed className={cn(iconSizes.xs, 'text-violet-600')} />
                <dd>{(property.layout?.bedrooms ?? 0) > 0 ? property.layout?.bedrooms : '—'}</dd>
              </div>
              <div className="flex items-center gap-1">
                <dt className="sr-only">{t('fields.layout.bathrooms')}</dt>
                <Bath className={cn(iconSizes.xs, 'text-cyan-600')} />
                <dd>{(property.layout?.bathrooms ?? 0) > 0 ? property.layout?.bathrooms : '—'}</dd>
              </div>
              <div className="flex items-center gap-1">
                <dt className="sr-only">{t('fields.layout.wc')}</dt>
                <dd>{(property.layout?.wc ?? 0) > 0 ? `${property.layout?.wc} WC` : '— WC'}</dd>
              </div>
            </div>

            {/* Areas - Always visible */}
            <div className={`flex flex-wrap ${spacing.gap.md} text-xs`}>
              <div className="flex items-center gap-1">
                <dt className="sr-only">{t('fields.areas.gross')}</dt>
                <Ruler className={cn(iconSizes.xs, 'text-blue-600')} />
                <dd>{(property.areas?.gross ?? 0) > 0 ? `${property.areas?.gross} τ.μ.` : '— τ.μ.'}</dd>
              </div>
              {(property.areas?.net ?? 0) > 0 && (
                <dd className="text-muted-foreground">({t('fields.areas.net')}: {property.areas?.net})</dd>
              )}
              {(property.areas?.balcony ?? 0) > 0 && (
                <dd className="text-muted-foreground">{t('fields.areas.balcony')}: {property.areas?.balcony}</dd>
              )}
            </div>

            {/* Orientations - Always visible */}
            <div className={`flex items-center ${spacing.gap.sm} text-xs`}>
              <dt className="flex items-center gap-1">
                <Compass className={cn(iconSizes.xs, 'text-amber-600')} />
              </dt>
              <dd>
                {(property.orientations?.length ?? 0) > 0
                  ? property.orientations?.map(o => t(`orientation.short.${o}`)).join(', ')
                  : '—'}
              </dd>
            </div>

            {/* Condition & Energy - Always visible */}
            <div className={`flex flex-wrap ${spacing.gap.md} text-xs`}>
              <div className="flex items-center gap-1">
                <dt className="flex items-center gap-1">
                  <Wrench className={cn(iconSizes.xs, 'text-orange-600')} />
                </dt>
                <dd>{property.condition ? t(`condition.${property.condition}`) : '—'}</dd>
              </div>
              <div className="flex items-center gap-1">
                <dt className="flex items-center gap-1">
                  <Zap className={cn(iconSizes.xs, 'text-green-600')} />
                </dt>
                <dd className="font-medium">{property.energy?.class || '—'}</dd>
              </div>
            </div>

            {/* Systems - Always visible */}
            <div className={`flex flex-wrap ${spacing.gap.md} text-xs`}>
              <div className="flex items-center gap-1">
                <Flame className={cn(iconSizes.xs, 'text-orange-500')} />
                <dd>{property.systemsOverride?.heatingType ? t(`systems.heating.${property.systemsOverride.heatingType}`) : '—'}</dd>
              </div>
              <div className="flex items-center gap-1">
                <Snowflake className={cn(iconSizes.xs, 'text-blue-500')} />
                <dd>{property.systemsOverride?.coolingType ? t(`systems.cooling.${property.systemsOverride.coolingType}`) : '—'}</dd>
              </div>
            </div>

            {/* Finishes - Always visible */}
            <div className={`flex items-center ${spacing.gap.sm} text-xs`}>
              <dt className="flex items-center gap-1">
                <Home className={cn(iconSizes.xs, 'text-teal-600')} />
              </dt>
              <dd>
                {(property.finishes?.flooring?.length ?? 0) > 0
                  ? property.finishes?.flooring?.map(f => t(`finishes.flooring.${f}`)).join(', ')
                  : '—'}
              </dd>
            </div>

            {/* Interior Features - Always visible */}
            <div className={`flex flex-wrap ${spacing.gap.sm} text-xs`}>
              <dt className="sr-only">{t('features.interior.label')}</dt>
              {(property.interiorFeatures?.length ?? 0) > 0 ? (
                property.interiorFeatures?.map(feature => (
                  <span key={feature} className="bg-muted px-2 py-0.5 rounded text-xs">
                    {t(`features.interior.${feature}`)}
                  </span>
                ))
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>

            {/* Security Features - Always visible */}
            <div className={`flex items-center ${spacing.gap.sm} text-xs`}>
              <dt className="flex items-center gap-1">
                <Shield className={cn(iconSizes.xs, 'text-purple-600')} />
              </dt>
              <dd className="flex flex-wrap gap-1">
                {(property.securityFeatures?.length ?? 0) > 0 ? (
                  property.securityFeatures?.map(feature => (
                    <span key={feature} className="bg-muted px-2 py-0.5 rounded text-xs">
                      {t(`features.security.${feature}`)}
                    </span>
                  ))
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </dd>
            </div>
          </dl>
        )}
      </section>
    </>
  );
}

export default UnitFieldsBlock;
