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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import {
  Bed, Bath, Compass, Wrench, Zap,
  Thermometer, Snowflake, Home, Shield, Flame,
} from 'lucide-react';
import type { FlooringType, FrameType, GlazingType, OrientationType } from '@/constants/property-features-enterprise';
import {
  ORIENTATION_OPTIONS, CONDITION_OPTIONS, ENERGY_CLASS_OPTIONS,
  HEATING_OPTIONS, COOLING_OPTIONS, FLOORING_OPTIONS, FRAME_OPTIONS,
  GLAZING_OPTIONS, INTERIOR_FEATURE_OPTIONS, SECURITY_FEATURE_OPTIONS,
} from './property-fields-constants';
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
        <Card>
          <CardHeader className="p-2 pb-1">
            <CardTitle className={cn('flex items-center gap-1.5', typography.card.titleCompact)}>
              <Bed className={cn(iconSizes.sm, 'text-violet-500')} />
              {t('fields.layout.sectionTitle')}
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
                <p className={cn("text-[10px] italic", colors.text.muted)}>{t('multiLevel.perLevel.autoComputed')}</p>
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
                  ['bedrooms', 'card.stats.bedrooms', Bed, 'text-violet-600', 20],
                  ['bathrooms', 'card.stats.bathrooms', Bath, 'text-cyan-600', 10],
                  ['wc', 'fields.layout.wc', Bath, 'text-sky-500', 5],
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
                <p className={cn("text-[10px] italic", colors.text.muted)}>{t('multiLevel.perLevel.autoComputed')}</p>
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
                <span className="ml-auto text-[9px] font-normal ${colors.text.muted}">
                  {t('multiLevel.perLevel.sharedHint')}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 pt-0">
            <div className="space-y-2">
              <fieldset className="space-y-1">
                <Label className={cn("text-xs flex items-center gap-1", colors.text.muted)}>
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
                <Label className={cn("text-xs flex items-center gap-1", colors.text.muted)}>
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
                <span className="ml-auto text-[9px] font-normal ${colors.text.muted}">
                  {t('multiLevel.perLevel.sharedHint')}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 pt-0">
            <div className="space-y-2">
              <fieldset className="space-y-1">
                <Label className={cn("text-xs flex items-center gap-1", colors.text.muted)}>
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
                <Label className={cn("text-xs flex items-center gap-1", colors.text.muted)}>
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

                  {/* Frames & Glazing */}
                  <div className="grid grid-cols-2 gap-2">
                    <fieldset className="space-y-1">
                      <Label className={cn("text-xs", colors.text.muted)}>{t('finishes.frames.label')}</Label>
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
                      <Label className={cn("text-xs", colors.text.muted)}>{t('finishes.glazing.label')}</Label>
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
                <span className="ml-auto text-[9px] font-normal ${colors.text.muted}">
                  {t('multiLevel.perLevel.sharedHint')}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 pt-0 space-y-2">
            {/* Interior Features */}
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

            {/* Security Features */}
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
          </CardContent>
        </Card>
      </section>
    </>
  );
}
