'use client';

/**
 * =============================================================================
 * ENTERPRISE: AddUnitDialog Component
 * =============================================================================
 *
 * Enterprise-grade dialog for creating new units.
 * Follows AddBuildingDialog pattern for consistency.
 *
 * Features:
 * - 2-tab layout (Basic, Details)
 * - Full i18n support
 * - Radix Select for dropdowns (ADR-001)
 * - Centralized design tokens
 * - Type-safe form handling via useUnitForm
 * - Building selector via prop injection (zero duplicate API calls)
 * - RealtimeService auto-dispatches via createUnit() (ADR-078)
 *
 * @enterprise Fortune 500-grade dialog implementation
 * @created 2026-02-06
 * @see ADR-034
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormGrid, FormField, FormInput } from '@/components/ui/form/FormComponents';
import { SaveButton, CancelButton } from '@/components/ui/form/ActionButtons';
import { Home, ClipboardList } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
// ENTERPRISE: Centralized dialog sizing tokens (ADR-031)
import { cn } from '@/lib/utils';
import { DIALOG_SIZES, DIALOG_HEIGHT, DIALOG_SCROLL } from '@/styles/design-tokens';
// ENTERPRISE: Centralized hooks
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
// ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
// ENTERPRISE: Form state management hook
import { useUnitForm } from '../hooks/useUnitForm';
// ENTERPRISE: ADR-233 auto-code suggestion
import { useEntityCodeSuggestion } from '@/hooks/useEntityCodeSuggestion';
import { isValidEntityCodeFormat } from '@/services/entity-code.service';
// ENTERPRISE: Real-time floor subscription (Firestore onSnapshot)
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { useAuth } from '@/auth/contexts/AuthContext';
// ENTERPRISE: Navigation entities for icon
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import type { UnitType, OperationalStatus, CommercialStatus } from '@/types/unit';
import type { Building } from '@/types/building/contracts';
import { isMultiLevelCapableType } from '@/config/domain-constants';
import { FloorMultiSelectField } from '@/components/shared/FloorMultiSelectField';

// =============================================================================
// TYPES
// =============================================================================

interface AddUnitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUnitAdded?: () => void;
  /** Pre-fetched buildings from parent (eliminates duplicate API call) */
  buildings: Building[];
  /** Whether buildings are still loading */
  buildingsLoading?: boolean;
}

// =============================================================================
// CONSTANTS - Type-safe dropdown options
// =============================================================================

const UNIT_TYPE_OPTIONS: UnitType[] = [
  'studio',
  'apartment_1br',
  'apartment',
  'apartment_2br',
  'apartment_3br',
  'maisonette',
  'penthouse',
  'loft',
  'detached_house',
  'villa',
  'shop',
  'office',
  'hall',
  'storage',
];

const OPERATIONAL_STATUS_OPTIONS: OperationalStatus[] = [
  'draft',
  'under-construction',
  'inspection',
  'ready',
  'maintenance',
];

// ADR-197: Κατά τη ΔΗΜΙΟΥΡΓΙΑ μόνο αυτές οι τιμές (reserved/sold/rented γίνονται μέσω sales flow)
const CREATION_COMMERCIAL_STATUS_OPTIONS: CommercialStatus[] = [
  'unavailable',
  'for-sale',
  'for-rent',
  'for-sale-and-rent',
];

// =============================================================================
// COMPONENT
// =============================================================================

export function AddUnitDialog({
  open,
  onOpenChange,
  onUnitAdded,
  buildings,
  buildingsLoading = false,
}: AddUnitDialogProps) {
  // ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('units');
  // ENTERPRISE: Centralized design hooks
  const iconSizes = useIconSizes();
  const spacing = useSpacingTokens();

  // ENTERPRISE: Form state management
  const {
    formData,
    loading,
    errors,
    handleSubmit,
    handleChange,
    handleSelectChange,
    handleNumberChange,
    handleLevelsChange,
    resetForm,
  } = useUnitForm({ onUnitAdded, onOpenChange });

  // ENTERPRISE: Real-time floor subscription via Firestore onSnapshot
  const [floorOptions, setFloorOptions] = useState<Array<{ id: string; number: number; name: string }>>([]);
  const [floorsLoading, setFloorsLoading] = useState(false);
  const { user } = useAuth();

  // Real-time floors subscription when buildingId changes
  useEffect(() => {
    if (!formData.buildingId || !user) {
      setFloorOptions([]);
      setFloorsLoading(false);
      return;
    }

    setFloorsLoading(true);

    const floorsCol = collection(db, COLLECTIONS.FLOORS);
    const constraints = [
      where('buildingId', '==', formData.buildingId),
      ...(user.companyId ? [where('companyId', '==', user.companyId)] : []),
    ];
    const q = query(floorsCol, ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const floors = snapshot.docs
          .map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              number: typeof data.number === 'number' ? data.number : 0,
              name: (data.name as string) || '',
            };
          })
          .sort((a, b) => a.number - b.number);

        setFloorOptions(floors);
        setFloorsLoading(false);
      },
      () => {
        setFloorOptions([]);
        setFloorsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [formData.buildingId, user]);

  // ENTERPRISE: ADR-233 — Track whether user has manually overridden the code
  const [codeOverridden, setCodeOverridden] = useState(false);

  // ENTERPRISE: ADR-233 — Auto-suggest entity code
  const { suggestedCode, isLoading: codeLoading } = useEntityCodeSuggestion({
    entityType: 'unit',
    buildingId: formData.buildingId,
    floorLevel: formData.floor,
    unitType: formData.type || undefined,
    disabled: codeOverridden,
  });

  // Auto-populate code when suggestion arrives and user hasn't overridden
  useEffect(() => {
    if (suggestedCode && !codeOverridden) {
      handleSelectChange('code', suggestedCode);
    }
  }, [suggestedCode, codeOverridden, handleSelectChange]);

  // ADR-236: Multi-level detection based on selected type
  const isMultiLevelType = isMultiLevelCapableType(formData.type);

  // ENTERPRISE: Active tab state
  const [activeTab, setActiveTab] = useState('basic');

  // ENTERPRISE: Auto-navigate to tab with validation errors
  useEffect(() => {
    const errorFields = Object.keys(errors);
    if (errorFields.length === 0) return;

    const detailsFields: Array<keyof typeof formData> = [
      'area', 'bedrooms', 'bathrooms', 'description',
    ];

    const hasBasicError = errorFields.some(
      f => !detailsFields.includes(f as keyof typeof formData)
    );

    if (hasBasicError) {
      setActiveTab('basic');
    } else {
      setActiveTab('details');
    }
  }, [errors, formData]);

  // Reset form and tab when dialog opens
  useEffect(() => {
    if (open) {
      resetForm();
      setActiveTab('basic');
      setCodeOverridden(false);
    }
  }, [open, resetForm]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(DIALOG_SIZES.xl, DIALOG_HEIGHT.standard, DIALOG_SCROLL.scrollable)}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <NAVIGATION_ENTITIES.unit.icon className={iconSizes.md} />
            {t('dialog.addUnit.title')}
          </DialogTitle>
          <DialogDescription>{t('dialog.addUnit.description')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="basic" className="flex items-center gap-1">
                <Home className="h-3 w-3" />
                {t('dialog.addUnit.tabs.basic')}
              </TabsTrigger>
              <TabsTrigger value="details" className="flex items-center gap-1">
                <ClipboardList className="h-3 w-3" />
                {t('dialog.addUnit.tabs.details')}
              </TabsTrigger>
            </TabsList>

            {/* ================================================================
                TAB 1: BASIC INFO
            ================================================================ */}
            <TabsContent value="basic" className={spacing.margin.top.md}>
              <FormGrid>
                {/* Unit Name (required) */}
                <FormField
                  label={t('dialog.addUnit.fields.name')}
                  htmlFor="name"
                  required
                >
                  <FormInput>
                    <Input
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder={t('dialog.addUnit.placeholders.name')}
                      disabled={loading}
                      className={errors.name ? 'border-destructive' : ''}
                    />
                    {errors.name && (
                      <p className="text-xs text-destructive mt-1">{errors.name}</p>
                    )}
                  </FormInput>
                </FormField>

                {/* Unit Code — ADR-233: Auto-suggestion with manual override */}
                <FormField
                  label={t('dialog.addUnit.fields.code')}
                  htmlFor="code"
                >
                  <FormInput>
                    <Input
                      id="code"
                      name="code"
                      value={formData.code}
                      onChange={(e) => {
                        handleChange(e);
                        // Mark as overridden if user manually types
                        if (!codeOverridden && e.target.value !== suggestedCode) {
                          setCodeOverridden(true);
                        }
                        // Reset override if user clears the field
                        if (!e.target.value) {
                          setCodeOverridden(false);
                        }
                      }}
                      placeholder={t('dialog.addUnit.placeholders.code')}
                      disabled={loading}
                    />
                    {codeLoading && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {t('entityCode.loading')}
                      </p>
                    )}
                    {suggestedCode && codeOverridden && formData.code !== suggestedCode && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {t('entityCode.suggested', { code: suggestedCode })}
                      </p>
                    )}
                    {formData.code && !isValidEntityCodeFormat(formData.code) && (
                      <p className="text-xs text-amber-600 mt-1">
                        {t('entityCode.formatWarning')}
                      </p>
                    )}
                  </FormInput>
                </FormField>

                {/* Unit Type */}
                <FormField
                  label={t('dialog.addUnit.fields.type')}
                  htmlFor="type"
                >
                  <FormInput>
                    <Select
                      value={formData.type}
                      onValueChange={(value) => handleSelectChange('type', value)}
                      disabled={loading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('dialog.addUnit.placeholders.type')} />
                      </SelectTrigger>
                      <SelectContent>
                        {UNIT_TYPE_OPTIONS.map((unitType) => (
                          <SelectItem key={unitType} value={unitType}>
                            {t(`types.${unitType}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormInput>
                </FormField>

                {/* Building (required) */}
                <FormField
                  label={t('dialog.addUnit.fields.building')}
                  htmlFor="buildingId"
                  required
                >
                  <FormInput>
                    <Select
                      value={formData.buildingId}
                      onValueChange={(value) => {
                        handleSelectChange('buildingId', value);
                        // Reset floor selection when building changes
                        handleSelectChange('floorId', '');
                        handleNumberChange('floor', '');
                        // ADR-236: Reset multi-level selection
                        handleLevelsChange([]);
                      }}
                      disabled={loading || buildingsLoading}
                    >
                      <SelectTrigger className={errors.buildingId ? 'border-destructive' : ''}>
                        <SelectValue placeholder={t('dialog.addUnit.placeholders.building')} />
                      </SelectTrigger>
                      <SelectContent>
                        {buildings.map((building) => (
                          <SelectItem key={building.id} value={building.id}>
                            {building.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.buildingId && (
                      <p className="text-xs text-destructive mt-1">{errors.buildingId}</p>
                    )}
                  </FormInput>
                </FormField>

                {/* Floor — ADR-236: Multi-floor for multi-level types, single for others */}
                <FormField
                  label={isMultiLevelType
                    ? t('multiLevel.floors', { defaultValue: 'Όροφοι' })
                    : t('dialog.addUnit.fields.floor')}
                  htmlFor="floorId"
                >
                  <FormInput>
                    {isMultiLevelType ? (
                      <FloorMultiSelectField
                        buildingId={formData.buildingId || null}
                        value={formData.levels}
                        onChange={handleLevelsChange}
                        label=""
                        noBuildingHint={t('dialog.addUnit.placeholders.floor')}
                        disabled={loading}
                      />
                    ) : floorsLoading ? (
                      <section className="flex items-center gap-2 h-10 text-muted-foreground text-sm">
                        <Spinner size="small" />
                        <span>{t('dialog.addUnit.loadingFloors')}</span>
                      </section>
                    ) : floorOptions.length > 0 ? (
                      <Select
                        value={formData.floorId}
                        onValueChange={(value) => {
                          const selectedFloor = floorOptions.find(f => f.id === value);
                          handleSelectChange('floorId', value);
                          if (selectedFloor) {
                            handleNumberChange('floor', String(selectedFloor.number));
                          }
                        }}
                        disabled={loading || !formData.buildingId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('dialog.addUnit.placeholders.floor')} />
                        </SelectTrigger>
                        <SelectContent>
                          {floorOptions.map((floor) => (
                            <SelectItem key={floor.id} value={floor.id}>
                              {floor.name} ({t('dialog.addUnit.floorLevel')} {floor.number})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id="floor"
                        name="floor"
                        type="number"
                        value={formData.floor}
                        onChange={(e) => handleNumberChange('floor', e.target.value)}
                        placeholder={formData.buildingId
                          ? t('dialog.addUnit.noFloors')
                          : t('dialog.addUnit.placeholders.floor')
                        }
                        disabled={loading}
                      />
                    )}
                  </FormInput>
                </FormField>

                {/* Operational Status */}
                <FormField
                  label={t('dialog.addUnit.fields.status')}
                  htmlFor="operationalStatus"
                >
                  <FormInput>
                    <Select
                      value={formData.operationalStatus}
                      onValueChange={(value) => handleSelectChange('operationalStatus', value)}
                      disabled={loading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('dialog.addUnit.placeholders.status')} />
                      </SelectTrigger>
                      <SelectContent>
                        {OPERATIONAL_STATUS_OPTIONS.map((status) => (
                          <SelectItem key={status} value={status}>
                            {t(`dialog.addUnit.statusOptions.${status}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormInput>
                </FormField>

                {/* Commercial Status (ADR-197) */}
                <FormField
                  label={t('dialog.addUnit.fields.commercialStatus')}
                  htmlFor="commercialStatus"
                >
                  <FormInput>
                    <Select
                      value={formData.commercialStatus}
                      onValueChange={(value) => handleSelectChange('commercialStatus', value)}
                      disabled={loading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('dialog.addUnit.placeholders.commercialStatus')} />
                      </SelectTrigger>
                      <SelectContent>
                        {CREATION_COMMERCIAL_STATUS_OPTIONS.map((status) => (
                          <SelectItem key={status} value={status}>
                            {t(`dialog.addUnit.commercialStatusOptions.${status}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormInput>
                </FormField>
              </FormGrid>
            </TabsContent>

            {/* ================================================================
                TAB 2: DETAILS
            ================================================================ */}
            <TabsContent value="details" className={spacing.margin.top.md}>
              <FormGrid>
                {/* Area */}
                <FormField
                  label={t('dialog.addUnit.fields.area')}
                  htmlFor="area"
                >
                  <FormInput>
                    <Input
                      id="area"
                      name="area"
                      type="number"
                      value={formData.area}
                      onChange={(e) => handleNumberChange('area', e.target.value)}
                      placeholder={t('dialog.addUnit.placeholders.area')}
                      disabled={loading}
                      className={errors.area ? 'border-destructive' : ''}
                    />
                    {errors.area && (
                      <p className="text-xs text-destructive mt-1">{errors.area}</p>
                    )}
                  </FormInput>
                </FormField>

                {/* Bedrooms */}
                <FormField
                  label={t('dialog.addUnit.fields.bedrooms')}
                  htmlFor="bedrooms"
                >
                  <FormInput>
                    <Input
                      id="bedrooms"
                      name="bedrooms"
                      type="number"
                      value={formData.bedrooms}
                      onChange={(e) => handleNumberChange('bedrooms', e.target.value)}
                      placeholder={t('dialog.addUnit.placeholders.bedrooms')}
                      disabled={loading}
                      min={0}
                    />
                  </FormInput>
                </FormField>

                {/* Bathrooms */}
                <FormField
                  label={t('dialog.addUnit.fields.bathrooms')}
                  htmlFor="bathrooms"
                >
                  <FormInput>
                    <Input
                      id="bathrooms"
                      name="bathrooms"
                      type="number"
                      value={formData.bathrooms}
                      onChange={(e) => handleNumberChange('bathrooms', e.target.value)}
                      placeholder={t('dialog.addUnit.placeholders.bathrooms')}
                      disabled={loading}
                      min={0}
                    />
                  </FormInput>
                </FormField>

                {/* Description */}
                <FormField
                  label={t('dialog.addUnit.fields.description')}
                  htmlFor="description"
                >
                  <FormInput>
                    <Textarea
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      placeholder={t('dialog.addUnit.placeholders.description')}
                      disabled={loading}
                      rows={3}
                    />
                  </FormInput>
                </FormField>
              </FormGrid>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6">
            <CancelButton onClick={() => onOpenChange(false)} disabled={loading} />
            <SaveButton loading={loading} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default AddUnitDialog;
