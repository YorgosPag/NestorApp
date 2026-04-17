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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SelectItem } from '@/components/ui/select';
import { ClearableSelect } from '@/components/ui/clearable-select';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { Bed, Bath, Compass, Wrench, Zap } from 'lucide-react';
import type { OrientationType } from '@/constants/property-features-enterprise';
import {
  ORIENTATION_OPTIONS, CONDITION_OPTIONS, ENERGY_CLASS_OPTIONS,
  PROPERTY_CARD_COLORS, PROPERTY_MICRO_TEXT,
} from './property-fields-constants';
import { OrientationPlausibilityWarning } from '@/components/properties/shared/OrientationPlausibilityWarning';
import { ConditionPlausibilityWarning } from '@/components/properties/shared/ConditionPlausibilityWarning';
import { PropertyFieldsDetailCardsRow2 } from './PropertyFieldsDetailCardsRow2';
import type { PropertyFieldsEditFormProps } from './property-fields-form-types';

type DetailCardsProps = Pick<PropertyFieldsEditFormProps,
  'formData' | 'setFormData' | 'isEditing' | 'isSoldOrRented' |
  'isMultiLevel' | 'activeLevelId' | 'currentLevelData' | 'aggregatedTotals' |
  'toggleArrayItem' | 'updateLevelField' | 't' | 'typography' | 'iconSizes' | 'quick'
>;

export function PropertyFieldsDetailCards(props: DetailCardsProps) {
  const {
    formData, setFormData, isEditing, isSoldOrRented,
    isMultiLevel, activeLevelId, currentLevelData, aggregatedTotals,
    toggleArrayItem, updateLevelField, t, typography, iconSizes, quick,
  } = props;
  const colors = useSemanticColors();

  return (
    <>
      <section className="grid grid-cols-3 gap-3">
        {/* ─── Layout Card (level-aware) ─── */}
        {/* ADR-287 Batch 28: id anchor for completion-meter click-to-jump. */}
        <Card id="field-layout" tabIndex={-1}>
          <CardHeader className="p-2 pb-1">
            <CardTitle className={cn('flex items-center gap-1.5', typography.card.titleCompact)}>
              <Bed className={cn(iconSizes.sm, PROPERTY_CARD_COLORS.layout)} />
              {t('fields.layout.sectionTitle')}
              {isMultiLevel && (
                <span className={cn("ml-auto font-normal", PROPERTY_MICRO_TEXT.micro, colors.text.success)}>
                  {t('multiLevel.perLevel.perFloorHint')}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 pt-0">
            {isMultiLevel && activeLevelId === null && aggregatedTotals ? (
              <div className="space-y-1.5">
                <p className={cn("italic", PROPERTY_MICRO_TEXT.helper, colors.text.muted)}>{t('multiLevel.perLevel.autoComputed')}</p>
                {aggregatedTotals.layout.bedrooms > 0 && (
                  <dl className="flex items-baseline gap-1.5">
                    <dt className={cn("text-xs", colors.text.muted)}>{t('card.stats.bedrooms')}:</dt>
                    <dd className="text-xs font-semibold">{aggregatedTotals.layout.bedrooms}</dd>
                  </dl>
                )}
                {aggregatedTotals.layout.bathrooms > 0 && (
                  <dl className="flex items-baseline gap-1.5">
                    <dt className={cn("text-xs", colors.text.muted)}>{t('card.stats.bathrooms')}:</dt>
                    <dd className="text-xs font-semibold">{aggregatedTotals.layout.bathrooms}</dd>
                  </dl>
                )}
                {aggregatedTotals.layout.wc > 0 && (
                  <dl className="flex items-baseline gap-1.5">
                    <dt className={cn("text-xs", colors.text.muted)}>{t('fields.layout.wc')}:</dt>
                    <dd className="text-xs font-semibold">{aggregatedTotals.layout.wc}</dd>
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
          <CardHeader className="p-2 pb-1">
            <CardTitle className={cn('flex items-center gap-1.5', typography.card.titleCompact)}>
              <Compass className={cn(iconSizes.sm, PROPERTY_CARD_COLORS.orientation)} />
              {t('orientation.sectionTitle')}
              {isMultiLevel && (
                <span className={cn("ml-auto font-normal", PROPERTY_MICRO_TEXT.micro, colors.text.success)}>
                  {t('multiLevel.perLevel.perFloorHint')}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 pt-0 space-y-2">
            {isMultiLevel && activeLevelId === null && aggregatedTotals ? (
              <div className="space-y-1.5">
                <p className={cn("italic", PROPERTY_MICRO_TEXT.helper, colors.text.muted)}>{t('multiLevel.perLevel.autoComputed')}</p>
                {aggregatedTotals.orientations.length > 0 && (
                  <p className="text-xs font-medium">
                    {aggregatedTotals.orientations.map(o => t(`orientation.short.${o}`, { defaultValue: o })).join(', ')}
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
          <CardHeader className="p-2 pb-1">
            <CardTitle className={cn('flex items-center gap-1.5', typography.card.titleCompact)}>
              <Wrench className={cn(iconSizes.sm, PROPERTY_CARD_COLORS.condition)} />
              {t('condition.sectionTitle')}
              <Zap className={cn(iconSizes.sm, PROPERTY_CARD_COLORS.energy)} />
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

      <PropertyFieldsDetailCardsRow2
        formData={formData}
        setFormData={setFormData}
        isEditing={isEditing}
        isSoldOrRented={isSoldOrRented}
        isMultiLevel={isMultiLevel}
        activeLevelId={activeLevelId}
        currentLevelData={currentLevelData}
        aggregatedTotals={aggregatedTotals}
        toggleArrayItem={toggleArrayItem}
        updateLevelField={updateLevelField}
        t={t}
        typography={typography}
        iconSizes={iconSizes}
      />
    </>
  );
}
