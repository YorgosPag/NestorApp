/* eslint-disable design-system/prefer-design-system-imports, design-system/enforce-semantic-colors, custom/no-hardcoded-strings */
/**
 * =============================================================================
 * 🏢 ENTERPRISE: Property Fields Edit Form
 * =============================================================================
 *
 * Form renderer for property fields (edit mode). Extracted from PropertyFieldsBlock.tsx
 * for SRP compliance (ADR N.7.1). The orchestrator (PropertyFieldsBlock) manages
 * state, effects, and handlers; this component renders the form cards.
 *
 * @module features/property-details/components/PropertyFieldsEditForm
 * @since 2026-03-27
 */

'use client';

import React from 'react';
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
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Ruler, FileText, Info, Lock, Layers
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

import type { CommercialStatus, OperationalStatus } from '@/types/property';
import { isValidEntityCodeFormat } from '@/services/entity-code.service';
import { LevelTabStrip } from './PropertyFieldsReadOnly';
import {
  PROPERTY_TYPE_OPTIONS, COMMERCIAL_STATUS_OPTIONS, OPERATIONAL_STATUS_OPTIONS,
  PROPERTY_CARD_COLORS, PROPERTY_MICRO_TEXT,
} from './property-fields-constants';
import type { PropertyFieldsEditFormProps } from './property-fields-form-types';
import { PropertyFieldsDetailCards } from './PropertyFieldsDetailCards';

export function PropertyFieldsEditForm({
  formData,
  setFormData,
  property,
  isEditing,
  isCreatingNewUnit = false,
  isReservedOrSold,
  isSoldOrRented,
  isMultiLevel,
  activeLevelId,
  setActiveLevelId,
  currentLevelData,
  aggregatedTotals,
  toggleArrayItem,
  updateLevelField,
  handleSave,
  suggestedCode,
  codePlaceholderHint,
  codeOverridden,
  setCodeOverridden,
  codeLoading,
  onTypeChange,
  onNameManualEdit,
  onAreaNetChange,
  t,
  typography,
  iconSizes,
  quick,
}: PropertyFieldsEditFormProps) {
  const colors = useSemanticColors();
  return (
    <form
      id={isEditing ? 'property-fields-form' : undefined}
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
          <Lock className={iconSizes.sm} />
          <AlertDescription className="text-xs">
            {isSoldOrRented
              ? t('fieldLocking.soldBanner')
              : t('fieldLocking.reservedBanner')
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
          <aside className={cn("flex items-center gap-3 px-1", PROPERTY_MICRO_TEXT.helper, colors.text.muted)}>
            <span className="flex items-center gap-1">
              <Layers className={iconSizes.xs} />
              <span className="font-medium">{t('multiLevel.perLevel.perFloorHint')}</span>:
              {' '}{t('fields.areas.sectionTitle')}, {t('fields.layout.sectionTitle')}, {t('orientation.sectionTitle')}, {t('finishes.sectionTitle')}
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
              <FileText className={cn(iconSizes.sm, PROPERTY_CARD_COLORS.identity)} />
              {t('fields.identity.sectionTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 pt-0 space-y-2">
            <fieldset className="space-y-1">
              <Label className={cn("text-xs", colors.text.muted)}>
                {t('fields.identity.name')}
              </Label>
              <Input
                id="unit-name"
                value={formData.name}
                onChange={(e) => onNameManualEdit(e.target.value)}
                size="sm" className="text-xs"
                placeholder={t('fields.identity.namePlaceholder')}
                disabled={!isEditing || isReservedOrSold}
              />
            </fieldset>
            <fieldset className="space-y-1">
              <Label className={cn("text-xs flex items-center gap-1", colors.text.muted)}>
                {t('fields.identity.code')}
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button" className={`${colors.text.muted} hover:text-foreground transition-colors`} aria-label="Info">
                      <Info className={iconSizes.xs} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 text-xs" side="right" align="start">
                    <h4 className="font-semibold mb-2">{t('entityCode.infoTitle')}</h4>
                    <p className={cn("mb-2", colors.text.muted)}>{t('entityCode.infoFormat')}</p>
                    <p className={cn("mb-3", colors.text.muted)}>{t('entityCode.infoExample')}</p>
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-1 font-medium">{t('entityCode.infoResidential')}</th>
                          <th className="text-left py-1 font-medium">{t('entityCode.infoCommercial')}</th>
                          <th className="text-left py-1 font-medium">{t('entityCode.infoAuxiliary')}</th>
                        </tr>
                      </thead>
                      <tbody className={colors.text.muted}>
                        <tr><td>DI = {t('types.apartment')}</td><td>KA = {t('types.shop')}</td><td>AP = {t('types.storage')}</td></tr>
                        <tr><td>GK = {t('types.apartment_1br')}</td><td>GR = {t('types.office')}</td><td>PK = Parking</td></tr>
                        <tr><td>ST = {t('types.studio')}</td><td>AI = {t('types.hall')}</td><td>PY = {t('types.outdoor')}</td></tr>
                        <tr><td>ME = {t('types.maisonette')}</td><td colSpan={2} rowSpan={5} /></tr>
                        <tr><td>RE = {t('types.penthouse')}</td></tr>
                        <tr><td>LO = Loft</td></tr>
                        <tr><td>MO = {t('types.detached_house')}</td></tr>
                        <tr><td>BI = {t('types.villa')}</td></tr>
                      </tbody>
                    </table>
                    <p className={cn("mt-2", PROPERTY_MICRO_TEXT.helper, colors.text.muted)}>{t('entityCode.infoFloors')}</p>
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
                size="sm" className="text-xs"
                placeholder={codePlaceholderHint}
                disabled={!isEditing || isReservedOrSold}
              />
              {formData.code && isValidEntityCodeFormat(formData.code) && (
                <p className={cn(PROPERTY_MICRO_TEXT.helper, colors.text.success)}>{t('entityCode.autoGenerated')}</p>
              )}
              {codeLoading && isEditing && (
                <p className={cn(PROPERTY_MICRO_TEXT.helper, colors.text.muted)}>{t('entityCode.loading')}</p>
              )}
              {suggestedCode && codeOverridden && formData.code !== suggestedCode && isEditing && (
                <p className={cn(PROPERTY_MICRO_TEXT.helper, colors.text.muted)}>{t('entityCode.suggested', { code: suggestedCode, defaultValue: `Προτεινόμενος: ${suggestedCode}` })}</p>
              )}
              {formData.code && !isValidEntityCodeFormat(formData.code) && isEditing && (
                <p className={cn(PROPERTY_MICRO_TEXT.helper, colors.text.warning)}>{t('entityCode.formatWarning')}</p>
              )}
            </fieldset>
            {!isCreatingNewUnit && (
              <fieldset className="space-y-1">
                <Label className={cn("text-xs", colors.text.muted)}>
                  {t('fields.identity.type')}
                </Label>
                <Select value={formData.type} disabled={!isEditing || isReservedOrSold}
                  onValueChange={(value) => {
                    setFormData(prev => ({ ...prev, type: value }));
                    onTypeChange(value);
                  }}>
                  <SelectTrigger size="sm">
                    <SelectValue placeholder={t('fields.identity.typePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {PROPERTY_TYPE_OPTIONS.map((propertyType) => (
                      <SelectItem key={propertyType} value={propertyType} className="text-xs">
                        {t(`types.${propertyType}`, { defaultValue: propertyType })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </fieldset>
            )}
            <fieldset className="space-y-1">
              <Label className={cn("text-xs", colors.text.muted)}>
                {t('fields.identity.commercialStatus')}
              </Label>
              <Select value={formData.commercialStatus} disabled={!isEditing || isReservedOrSold}
                onValueChange={(value) => setFormData(prev => ({ ...prev, commercialStatus: value as CommercialStatus }))}>
                <SelectTrigger size="sm">
                  <SelectValue placeholder={t('fields.identity.commercialStatusPlaceholder')} />
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
              <Label className={cn("text-xs", colors.text.muted)}>
                {t('fields.commercial.askingPrice')}
              </Label>
              <Input
                id="unit-asking-price"
                type="number"
                min={0}
                step={1000}
                value={formData.askingPrice}
                onChange={(e) => setFormData(prev => ({ ...prev, askingPrice: e.target.value }))}
                size="sm" className="text-xs text-right"
                placeholder={t('placeholders.priceExample')}
                disabled={!isEditing || isSoldOrRented}
              />
            </fieldset>
            <fieldset className="space-y-1">
              <Label className={cn("text-xs", colors.text.muted)}>
                {t('dialog.addUnit.fields.status')}
              </Label>
              <Select value={formData.operationalStatus} disabled={!isEditing}
                onValueChange={(value) => setFormData(prev => ({ ...prev, operationalStatus: value as OperationalStatus }))}>
                <SelectTrigger size="sm">
                  <SelectValue placeholder={t('dialog.addUnit.placeholders.status')} />
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
              <Label className={cn("text-xs", colors.text.muted)}>
                {t('fields.identity.description')}
              </Label>
              <Textarea
                id="unit-description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="h-16 text-xs resize-none"
                placeholder={t('fields.identity.descriptionPlaceholder')}
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
                <span className={cn("ml-auto font-normal", PROPERTY_MICRO_TEXT.micro, colors.text.success)}>
                  {t('multiLevel.perLevel.perFloorHint')}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 pt-0">
            {isMultiLevel && activeLevelId === null && aggregatedTotals ? (
              /* Read-only aggregated totals */
              <div className="space-y-1.5">
                <p className={cn("italic", PROPERTY_MICRO_TEXT.helper, colors.text.muted)}>{t('multiLevel.perLevel.autoComputed')}</p>
                {([
                  ['gross', 'fields.areas.gross'],
                  ['net', 'fields.areas.net'],
                  ['balcony', 'fields.areas.balcony'],
                  ['terrace', 'fields.areas.terrace'],
                  ['garden', 'fields.areas.garden'],
                ] as const).map(([key, labelKey]) => (
                  aggregatedTotals.areas[key] > 0 ? (
                    <dl key={key} className="flex items-baseline gap-1.5">
                      <dt className={cn("text-xs", colors.text.muted)}>{t(labelKey)}:</dt>
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
                      <Label className={cn("text-xs", colors.text.muted)}>{t(labelKey)}</Label>
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
                          if (areaKey === 'net') onAreaNetChange(num);
                        }}
                        size="sm" className="text-xs"
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
                <dt className={cn("text-xs flex items-center gap-1", colors.text.muted)}>
                  <Lock className={iconSizes.xs} />
                  {t('fields.millesimalShares')}:
                </dt>
                <dd className="text-xs font-semibold">{property.millesimalShares}‰</dd>
              </dl>
            )}
          </CardContent>
        </Card>
      </section>


      <PropertyFieldsDetailCards
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
        quick={quick}
      />
    </form>
  );
}
