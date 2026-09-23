/* eslint-disable design-system/prefer-design-system-imports, design-system/enforce-semantic-colors, custom/no-hardcoded-strings */
/**
 * =============================================================================
 * 🏢 ENTERPRISE: Property Fields Detail Cards (Row 1 + Row 2)
 * =============================================================================
 *
 * Layout, Orientation, Condition/Energy, Systems, Finishes, Features cards.
 * Extracted from PropertyFieldsEditForm.tsx for SRP compliance.
 *
 * @module features/property-details/components/PropertyFieldsDetailCards
 * @since 2026-03-27
 */

import React from 'react';
import { ToggleButton } from '@/components/ui/toggle-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { PropertyAutoComputedNote, PropertyDetailCardHeader, levelAggregateOf } from './PropertyDetailCardHeader';
import { SelectItem } from '@/components/ui/select';
import { ClearableSelect } from '@/components/ui/clearable-select';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { Bed, Bath, Compass, Wrench, Zap } from 'lucide-react';
import type { OrientationType } from '@/constants/property-features-enterprise';
import {
  ORIENTATION_OPTIONS, CONDITION_OPTIONS, ENERGY_CLASS_OPTIONS,
  PROPERTY_CARD_COLORS,
} from './property-fields-constants';
import { OrientationPlausibilityWarning } from '@/components/properties/shared/OrientationPlausibilityWarning';
import { ConditionPlausibilityWarning } from '@/components/properties/shared/ConditionPlausibilityWarning';
import { PropertyFieldsDetailCardsRow2 } from './PropertyFieldsDetailCardsRow2';
import type { PropertyFieldsEditFormProps } from './property-fields-form-types';

type DetailCardsProps = Pick<PropertyFieldsEditFormProps,
  'formData' | 'setFormData' | 'isEditing' | 'isSoldOrRented' |
  'isMultiLevel' | 'activeLevelId' | 'currentLevelData' | 'aggregatedTotals' |
  'toggleArrayItem' | 'updateLevelField' | 't' | 'iconSizes' | 'quick'
>;

export function PropertyFieldsDetailCards(props: DetailCardsProps) {
  const { quick, ...row2Props } = props;
  const {
    formData, setFormData, isEditing, isSoldOrRented,
    isMultiLevel, activeLevelId, currentLevelData, aggregatedTotals,
    toggleArrayItem, updateLevelField, t, iconSizes,
  } = row2Props;
  const aggregate = levelAggregateOf(isMultiLevel, activeLevelId, aggregatedTotals);
  const colors = useSemanticColors();

  return (
    <>
      <section className="grid grid-cols-3 gap-3">
        {/* ─── Layout Card (level-aware) ─── */}
        {/* ADR-287 Batch 28: id anchor for completion-meter click-to-jump. */}
        <Card id="field-layout" tabIndex={-1}>
          <PropertyDetailCardHeader
            icon={{ icon: Bed, tone: PROPERTY_CARD_COLORS.layout }}
            title={t('fields.layout.sectionTitle')}
            scope="perFloor"
            isMultiLevel={isMultiLevel}
            t={t}
          />
          <CardContent className="p-2 pt-0">
            {aggregate ? (
              <div className="space-y-1.5">
                <PropertyAutoComputedNote t={t} />
                {aggregate.layout.bedrooms > 0 && (
                  <dl className="flex items-baseline gap-1.5">
                    <dt className={cn("text-xs", colors.text.muted)}>{t('card.stats.bedrooms')}:</dt>
                    <dd className="text-xs font-semibold">{aggregate.layout.bedrooms}</dd>
                  </dl>
                )}
                {aggregate.layout.bathrooms > 0 && (
                  <dl className="flex items-baseline gap-1.5">
                    <dt className={cn("text-xs", colors.text.muted)}>{t('card.stats.bathrooms')}:</dt>
                    <dd className="text-xs font-semibold">{aggregate.layout.bathrooms}</dd>
                  </dl>
                )}
                {aggregate.layout.wc > 0 && (
                  <dl className="flex items-baseline gap-1.5">
                    <dt className={cn("text-xs", colors.text.muted)}>{t('fields.layout.wc')}:</dt>
                    <dd className="text-xs font-semibold">{aggregate.layout.wc}</dd>
                  </dl>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {([
                  ['bedrooms', 'card.stats.bedrooms', Bed, PROPERTY_CARD_COLORS.bedrooms, 20],
                  ['bathrooms', 'card.stats.bathrooms', Bath, PROPERTY_CARD_COLORS.bathrooms, 10],
                  ['wc', 'fields.layout.wc', Bath, PROPERTY_CARD_COLORS.wc, 5],
                ] as const).map(([layoutKey, labelKey, Icon, iconColor, max]) => {
                  const value = isMultiLevel && activeLevelId
                    ? (currentLevelData?.layout?.[layoutKey] ?? 0)
                    : formData[layoutKey];
                  return (
                    <fieldset key={layoutKey} className="space-y-1">
                      <Label className={cn("text-xs flex items-center gap-1", colors.text.muted)}>
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
                        size="sm" className="text-xs" disabled={!isEditing || isSoldOrRented} />
                    </fieldset>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ─── Orientation Card (level-aware) ─── */}
        <Card id="field-orientation" tabIndex={-1}>
          <PropertyDetailCardHeader
            icon={{ icon: Compass, tone: PROPERTY_CARD_COLORS.orientation }}
            title={t('orientation.sectionTitle')}
            scope="perFloor"
            isMultiLevel={isMultiLevel}
            t={t}
          />
          <CardContent className="p-2 pt-0 space-y-2">
            {aggregate ? (
              <div className="space-y-1.5">
                <PropertyAutoComputedNote t={t} />
                {aggregate.orientations.length > 0 && (
                  <p className="text-xs font-medium">
                    {aggregate.orientations.map(o => t(`orientation.short.${o}`, { defaultValue: o })).join(', ')}
                  </p>
                )}
              </div>
            ) : (
              <fieldset className="space-y-1">
                <Label className={cn("text-xs flex items-center gap-1", colors.text.muted)}>
                  {t('orientation.sectionTitle')}
                </Label>
                <div className="flex flex-wrap gap-1">
                  {ORIENTATION_OPTIONS.map((orientation) => {
                    const levelOrientations = isMultiLevel && activeLevelId
                      ? (currentLevelData?.orientations ?? [])
                      : formData.orientations;
                    const isSelected = levelOrientations.includes(orientation);
                    return (
                      <ToggleButton key={orientation} type="button"
                        pressed={isSelected} variant="outline" size="sm"
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
                      </ToggleButton>
                    );
                  })}
                </div>
              </fieldset>
            )}
            <OrientationPlausibilityWarning
              propertyType={formData.type}
              orientations={
                isMultiLevel && activeLevelId
                  ? (currentLevelData?.orientations ?? [])
                  : isMultiLevel && aggregatedTotals
                    ? aggregatedTotals.orientations
                    : formData.orientations
              }
              className="py-2 px-3 mt-1"
            />
          </CardContent>
        </Card>

        {/* ─── Condition & Energy Card ─── */}
        <Card id="field-condition-energy" tabIndex={-1}>
          <PropertyDetailCardHeader
            icon={{ icon: Wrench, tone: PROPERTY_CARD_COLORS.condition }}
            trailingIcon={{ icon: Zap, tone: PROPERTY_CARD_COLORS.energy }}
            title={t('condition.sectionTitle')}
            scope="shared"
            isMultiLevel={isMultiLevel}
            t={t}
          />
          <CardContent className="p-2 pt-0">
            <div className="space-y-2">
              <fieldset className="space-y-1">
                <Label className={cn("text-xs flex items-center gap-1", colors.text.muted)}>
                  <Wrench className={cn(iconSizes.xs, PROPERTY_CARD_COLORS.conditionIcon)} />
                  {t('condition.sectionTitle')}
                </Label>
                <ClearableSelect
                  value={formData.condition}
                  disabled={!isEditing || isSoldOrRented}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, condition: value }))}
                  placeholder={t('clearSelection.condition')}
                  clearLabel={t('clearSelection.condition')}
                >
                  {CONDITION_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c} className="text-xs">{t(`condition.${c}`)}</SelectItem>
                  ))}
                </ClearableSelect>
              </fieldset>
              <fieldset className="space-y-1">
                <Label className={cn("text-xs flex items-center gap-1", colors.text.muted)}>
                  <Zap className={cn(iconSizes.xs, PROPERTY_CARD_COLORS.energyIcon)} />
                  {t('energy.class')}
                </Label>
                <ClearableSelect
                  value={formData.energyClass}
                  disabled={!isEditing || isSoldOrRented}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, energyClass: value }))}
                  placeholder={t('clearSelection.energyClass')}
                  clearLabel={t('clearSelection.energyClass')}
                >
                  {ENERGY_CLASS_OPTIONS.map((e) => (
                    <SelectItem key={e} value={e} className="text-xs">{e}</SelectItem>
                  ))}
                </ClearableSelect>
              </fieldset>
            </div>
            <ConditionPlausibilityWarning
              propertyType={formData.type}
              condition={formData.condition}
              operationalStatus={formData.operationalStatus}
              heatingType={formData.heatingType}
              energyClass={formData.energyClass}
              className="py-2 px-3 mt-1"
            />
          </CardContent>
        </Card>

      </section>

      {/* Row2 takes exactly our props minus `quick` — passed through, not re-listed (CHECK 3.28). */}
      <PropertyFieldsDetailCardsRow2 {...row2Props} />
    </>
  );
}
