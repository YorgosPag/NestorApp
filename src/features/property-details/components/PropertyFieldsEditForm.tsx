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
import { InfoLabel } from '@/components/sales/payments/financial-intelligence/InfoLabel';
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
import { SalesDashboardRequirementsAlert } from '@/components/properties/shared/SalesDashboardRequirementsAlert';
import { PricePlausibilityWarning } from '@/components/properties/shared/PricePlausibilityWarning';
import { FloorTypePlausibilityWarning } from '@/components/properties/shared/FloorTypePlausibilityWarning';
import { LayoutPlausibilityWarning } from '@/components/properties/shared/LayoutPlausibilityWarning';
import { AreaPlausibilityWarning } from '@/components/properties/shared/AreaPlausibilityWarning';
import { resolveAreaValues } from './area-values-resolver';
import {
  Ruler, FileText, Lock, Layers
} from 'lucide-react';

import type { CommercialStatus, OperationalStatus } from '@/types/property';
import { EntityCodeField } from '@/components/shared/EntityCodeField';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { LevelTabStrip } from './PropertyFieldsReadOnly';
import { FloorMultiSelectField } from '@/components/shared/FloorMultiSelectField';
import { isMultiLevelCapableType } from '@/config/domain-constants';
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
  isHierarchyLocked,
  onLevelsChange,
  creationBuildingId,
  creationProjectId,
  needsFloorCreation,
  isMultiLevel,
  effectiveLevels,
  activeLevelId,
  setActiveLevelId,
  currentLevelData,
  aggregatedTotals,
  toggleArrayItem,
  updateLevelField,
  handleSave,
  codeBuildingId,
  codeFloorLevel,
  codePropertyType,
  onCodeChange,
  onCodeAutoApply,
  onSuggestionChange,
  onTypeChange,
  onNameManualEdit,
  onAreaChange,
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

      {/* ─── Hierarchy Lock Banner (creation mode) ─── */}
      {isHierarchyLocked && (
        <Alert className="py-2 px-3 border-blue-500 bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-700">
          <Lock className={iconSizes.sm} />
          <AlertDescription className="text-xs">
            {t('multiLevel.selectHierarchyFirst', { ns: 'properties-detail' })}
          </AlertDescription>
        </Alert>
      )}

      {/* ─── Level Tab Strip (ADR-236 Phase 2) ─── */}
      {isMultiLevel && effectiveLevels.length >= 2 && (
        <>
          <LevelTabStrip
            levels={effectiveLevels}
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

      {/* ─── Floor selector for multi-level creation (ADR-236) ─── */}
      {isCreatingNewUnit && isMultiLevelCapableType(formData.type) && onLevelsChange && (
        <FloorMultiSelectField
          buildingId={creationBuildingId}
          projectId={creationProjectId}
          value={effectiveLevels}
          onChange={onLevelsChange}
          label={t('multiLevel.floors', { ns: 'properties-detail' })}
          noBuildingHint={t('multiLevel.noFloorHint', { ns: 'properties-detail' })}
          initiallyOpen={needsFloorCreation}
        />
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
                disabled={!isEditing || isReservedOrSold || isHierarchyLocked}
              />
            </fieldset>
            <EntityCodeField
              value={formData.code}
              onChange={onCodeChange}
              entityType={ENTITY_TYPES.PROPERTY}
              buildingId={codeBuildingId}
              floorLevel={codeFloorLevel}
              propertyType={codePropertyType}
              onAutoApply={onCodeAutoApply}
              onSuggestionChange={onSuggestionChange}
              infoContent={
                <>
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
                </>
              }
              label={t('fields.identity.code')}
              placeholderFallback="A-DI-1.01"
              disabled={!isEditing || isReservedOrSold || isHierarchyLocked}
              variant="form"
            />
            {!isCreatingNewUnit && (
              <fieldset className="space-y-1">
                <Label className={cn("text-xs", colors.text.muted)}>
                  {t('fields.identity.type')}
                </Label>
                <Select value={formData.type} disabled={!isEditing || isReservedOrSold || isHierarchyLocked}
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
              <Select value={formData.commercialStatus} disabled={!isEditing || isReservedOrSold || isHierarchyLocked}
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
                type="text"
                inputMode="decimal"
                value={formData.askingPrice ? Number(formData.askingPrice).toLocaleString('el-GR') : ''}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\./g, '').replace(/,/g, '.');
                  if (raw === '' || /^\d+\.?\d*$/.test(raw)) {
                    setFormData(prev => ({ ...prev, askingPrice: raw }));
                  }
                }}
                size="sm" className="text-xs text-right"
                placeholder={t('placeholders.priceExample')}
                disabled={!isEditing || isSoldOrRented || isHierarchyLocked}
              />
              <SalesDashboardRequirementsAlert
                commercialStatus={formData.commercialStatus}
                askingPrice={formData.askingPrice ?? null}
                grossArea={
                  isMultiLevel && aggregatedTotals
                    ? aggregatedTotals.areas.gross
                    : formData.areaGross
                }
                className="py-2 px-3 mt-1"
              />
              <PricePlausibilityWarning
                commercialStatus={formData.commercialStatus}
                propertyType={formData.type}
                askingPrice={formData.askingPrice ?? null}
                grossArea={
                  isMultiLevel && aggregatedTotals
                    ? aggregatedTotals.areas.gross
                    : formData.areaGross
                }
                className="py-2 px-3 mt-1"
              />
              <FloorTypePlausibilityWarning
                propertyType={formData.type}
                floor={formData.floor}
                className="py-2 px-3 mt-1"
              />
              <LayoutPlausibilityWarning
                propertyType={formData.type}
                bedrooms={formData.bedrooms}
                bathrooms={formData.bathrooms}
                wc={formData.wc}
                className="py-2 px-3 mt-1"
              />
            </fieldset>
            <fieldset className="space-y-1">
              <Label className={cn("text-xs", colors.text.muted)}>
                {t('dialog.addUnit.fields.status')}
              </Label>
              <Select value={formData.operationalStatus} disabled={!isEditing || isHierarchyLocked}
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
                disabled={!isEditing || isHierarchyLocked}
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
                  const grossValue = isMultiLevel && activeLevelId
                    ? (currentLevelData?.areas?.gross ?? 0)
                    : formData.areaGross;
                  const netExceedsGross =
                    areaKey === 'net' &&
                    value > 0 &&
                    grossValue > 0 &&
                    value > grossValue;
                  const hasTooltip = areaKey === 'balcony' || areaKey === 'terrace';
                  return (
                    <fieldset key={areaKey} className="space-y-1">
                      {hasTooltip ? (
                        <InfoLabel
                          label={t(labelKey)}
                          tooltip={t(`fields.areas.${areaKey}Tooltip`)}
                          className={cn("text-xs", colors.text.muted)}
                        />
                      ) : (
                        <Label className={cn("text-xs", colors.text.muted)}>{t(labelKey)}</Label>
                      )}
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
                          if (areaKey === 'net' || areaKey === 'gross') onAreaChange(areaKey, num);
                        }}
                        size="sm" className={cn("text-xs", netExceedsGross && "border-amber-500")}
                        disabled={!isEditing || isSoldOrRented || isHierarchyLocked}
                      />
                      {netExceedsGross && (
                        <p className="text-xs text-amber-600 mt-0.5">{t('fields.areas.netExceedsGross')}</p>
                      )}
                    </fieldset>
                  );
                })}
              </div>
            )}
            <AreaPlausibilityWarning
              propertyType={formData.type}
              className="py-2 px-3 mt-2"
              {...resolveAreaValues({ formData, currentLevelData, aggregatedTotals, isMultiLevel, activeLevelId })}
            />
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
