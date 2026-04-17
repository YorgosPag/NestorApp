/* eslint-disable design-system/prefer-design-system-imports, design-system/enforce-semantic-colors, custom/no-hardcoded-strings */
/**
 * =============================================================================
 * 🏢 ENTERPRISE: Property Fields Detail Cards — Row 2 (Systems / Finishes / Features)
 * =============================================================================
 *
 * Extracted from PropertyFieldsDetailCards.tsx για SRP/N.7.1 compliance.
 * Contains: Systems, Finishes (level-aware), Features cards + 3 plausibility
 * warnings (systems, finishes, interior features).
 *
 * @module features/property-details/components/PropertyFieldsDetailCardsRow2
 * @since 2026-04-17
 * @enterprise ADR-287 Batch 24
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SelectItem } from '@/components/ui/select';
import { ClearableSelect } from '@/components/ui/clearable-select';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { Thermometer, Snowflake, Home, Shield, Flame } from 'lucide-react';
import type { FlooringType, FrameType, GlazingType } from '@/constants/property-features-enterprise';
import {
  HEATING_OPTIONS, COOLING_OPTIONS, FLOORING_OPTIONS, FRAME_OPTIONS,
  GLAZING_OPTIONS, INTERIOR_FEATURE_OPTIONS, SECURITY_FEATURE_OPTIONS,
  PROPERTY_CARD_COLORS, PROPERTY_MICRO_TEXT,
} from './property-fields-constants';
import { SystemsPlausibilityWarning } from '@/components/properties/shared/SystemsPlausibilityWarning';
import { FinishesPlausibilityWarning } from '@/components/properties/shared/FinishesPlausibilityWarning';
import { InteriorFeaturesPlausibilityWarning } from '@/components/properties/shared/InteriorFeaturesPlausibilityWarning';
import type { PropertyFieldsEditFormProps } from './property-fields-form-types';

type Row2Props = Pick<PropertyFieldsEditFormProps,
  'formData' | 'setFormData' | 'isEditing' | 'isSoldOrRented' |
  'isMultiLevel' | 'activeLevelId' | 'currentLevelData' | 'aggregatedTotals' |
  'toggleArrayItem' | 'updateLevelField' | 't' | 'typography' | 'iconSizes'
>;

export function PropertyFieldsDetailCardsRow2(props: Row2Props) {
  const {
    formData, setFormData, isEditing, isSoldOrRented,
    isMultiLevel, activeLevelId, currentLevelData, aggregatedTotals,
    toggleArrayItem, updateLevelField, t, typography, iconSizes,
  } = props;
  const colors = useSemanticColors();

  return (
    <section className="grid grid-cols-3 gap-3">
      {/* ─── Systems Card ─── */}
      <Card>
        <CardHeader className="p-2 pb-1">
          <CardTitle className={cn('flex items-center gap-1.5', typography.card.titleCompact)}>
            <Thermometer className={cn(iconSizes.sm, PROPERTY_CARD_COLORS.systems)} />
            {t('systems.sectionTitle')}
            {isMultiLevel && (
              <span className={cn("ml-auto font-normal", PROPERTY_MICRO_TEXT.micro, colors.text.muted)}>
                {t('multiLevel.perLevel.sharedHint')}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 pt-0">
          <div className="space-y-2">
            <fieldset className="space-y-1">
              <Label className={cn("text-xs flex items-center gap-1", colors.text.muted)}>
                <Flame className={cn(iconSizes.xs, PROPERTY_CARD_COLORS.heating)} />
                {t('systems.heating.label')}
              </Label>
              <ClearableSelect
                value={formData.heatingType}
                disabled={!isEditing || isSoldOrRented}
                onValueChange={(value) => setFormData(prev => ({ ...prev, heatingType: value }))}
                placeholder={t('clearSelection.heating')}
                clearLabel={t('clearSelection.heating')}
              >
                {HEATING_OPTIONS.map((h) => (
                  <SelectItem key={h} value={h} className="text-xs">{t(`systems.heating.${h}`)}</SelectItem>
                ))}
              </ClearableSelect>
            </fieldset>
            <fieldset className="space-y-1">
              <Label className={cn("text-xs flex items-center gap-1", colors.text.muted)}>
                <Snowflake className={cn(iconSizes.xs, PROPERTY_CARD_COLORS.cooling)} />
                {t('systems.cooling.label')}
              </Label>
              <ClearableSelect
                value={formData.coolingType}
                disabled={!isEditing || isSoldOrRented}
                onValueChange={(value) => setFormData(prev => ({ ...prev, coolingType: value }))}
                placeholder={t('clearSelection.cooling')}
                clearLabel={t('clearSelection.cooling')}
              >
                {COOLING_OPTIONS.map((c) => (
                  <SelectItem key={c} value={c} className="text-xs">{t(`systems.cooling.${c}`)}</SelectItem>
                ))}
              </ClearableSelect>
            </fieldset>
          </div>
          <SystemsPlausibilityWarning
            propertyType={formData.type}
            heatingType={formData.heatingType}
            coolingType={formData.coolingType}
            condition={formData.condition}
            areaGross={
              isMultiLevel && aggregatedTotals
                ? aggregatedTotals.areas.gross
                : formData.areaGross
            }
            className="py-2 px-3 mt-1"
          />
        </CardContent>
      </Card>
      {/* ─── Finishes Card (level-aware) ─── */}
      <Card>
        <CardHeader className="p-2 pb-1">
          <CardTitle className={cn('flex items-center gap-1.5', typography.card.titleCompact)}>
            <Home className={cn(iconSizes.sm, PROPERTY_CARD_COLORS.finishes)} />
            {t('finishes.sectionTitle')}
            {isMultiLevel && (
              <span className={cn("ml-auto font-normal", PROPERTY_MICRO_TEXT.micro, colors.text.success)}>
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
                <fieldset className="space-y-1">
                  <Label className={cn("text-xs", colors.text.muted)}>{t('finishes.flooring.label')}</Label>
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
                <div className="grid grid-cols-2 gap-2">
                  <fieldset className="space-y-1">
                    <Label className={cn("text-xs", colors.text.muted)}>{t('finishes.frames.label')}</Label>
                    <ClearableSelect
                      value={levelFrames}
                      disabled={!isEditing || isSoldOrRented}
                      onValueChange={(value) => {
                        if (isMultiLevel && activeLevelId) {
                          updateLevelField('finishes', {
                            ...(currentLevelData?.finishes ?? {}),
                            windowFrames: value ? (value as FrameType) : undefined,
                          });
                        } else {
                          setFormData(prev => ({ ...prev, windowFrames: value }));
                        }
                      }}
                      placeholder={t('clearSelection.frames')}
                      clearLabel={t('clearSelection.frames')}
                    >
                      {FRAME_OPTIONS.map((f) => (
                        <SelectItem key={f} value={f} className="text-xs">{t(`finishes.frames.${f}`)}</SelectItem>
                      ))}
                    </ClearableSelect>
                  </fieldset>
                  <fieldset className="space-y-1">
                    <Label className={cn("text-xs", colors.text.muted)}>{t('finishes.glazing.label')}</Label>
                    <ClearableSelect
                      value={levelGlazing}
                      disabled={!isEditing || isSoldOrRented}
                      onValueChange={(value) => {
                        if (isMultiLevel && activeLevelId) {
                          updateLevelField('finishes', {
                            ...(currentLevelData?.finishes ?? {}),
                            glazing: value ? (value as GlazingType) : undefined,
                          });
                        } else {
                          setFormData(prev => ({ ...prev, glazing: value }));
                        }
                      }}
                      placeholder={t('clearSelection.glazing')}
                      clearLabel={t('clearSelection.glazing')}
                    >
                      {GLAZING_OPTIONS.map((g) => (
                        <SelectItem key={g} value={g} className="text-xs">{t(`finishes.glazing.${g}`)}</SelectItem>
                      ))}
                    </ClearableSelect>
                  </fieldset>
                </div>
              </>
            );
          })()}
          <FinishesPlausibilityWarning
            propertyType={formData.type}
            flooring={
              isMultiLevel && activeLevelId
                ? (currentLevelData?.finishes?.flooring ?? [])
                : formData.flooring
            }
            windowFrames={
              isMultiLevel && activeLevelId
                ? (currentLevelData?.finishes?.windowFrames ?? '')
                : formData.windowFrames
            }
            glazing={
              isMultiLevel && activeLevelId
                ? (currentLevelData?.finishes?.glazing ?? '')
                : formData.glazing
            }
            energyClass={formData.energyClass}
            condition={formData.condition}
            interiorFeatures={formData.interiorFeatures}
            className="py-2 px-3 mt-1"
          />
        </CardContent>
      </Card>

      {/* ─── Features Card ─── */}
      <Card>
        <CardHeader className="p-2 pb-1">
          <CardTitle className={cn('flex items-center gap-1.5', typography.card.titleCompact)}>
            <Shield className={cn(iconSizes.sm, PROPERTY_CARD_COLORS.features)} />
            {t('features.sectionTitle')}
            {isMultiLevel && (
              <span className={cn("ml-auto font-normal", PROPERTY_MICRO_TEXT.micro, colors.text.muted)}>
                {t('multiLevel.perLevel.sharedHint')}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 pt-0 space-y-2">
          <fieldset className="space-y-1">
            <Label className={cn("text-xs", colors.text.muted)}>{t('features.interior.label')}</Label>
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
          <fieldset className="space-y-1">
            <Label className={cn("text-xs", colors.text.muted)}>{t('features.security.label')}</Label>
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
          <InteriorFeaturesPlausibilityWarning
            propertyType={formData.type}
            interiorFeatures={formData.interiorFeatures}
            securityFeatures={formData.securityFeatures}
            energyClass={formData.energyClass}
            heatingType={formData.heatingType}
            coolingType={formData.coolingType}
            areaGross={
              isMultiLevel && aggregatedTotals
                ? aggregatedTotals.areas.gross
                : formData.areaGross
            }
            className="py-2 px-3 mt-1"
          />
        </CardContent>
      </Card>
    </section>
  );
}
