// 🌐 i18n: All labels converted to i18n keys - 2026-01-24
'use client';

/**
 * 🏢 ENTERPRISE: LinkedSpacesCard Component
 *
 * Επιτρέπει τη σύνδεση/αποσύνδεση Parking και Storage χώρων με μια μονάδα (unit).
 * Ακολουθεί το ίδιο pattern με το BuildingSelectorCard.
 *
 * @author Claude AI Assistant
 * @created 2026-01-24
 * @pattern Phase 2 - LinkedSpaces implementation
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Save, Loader2, CheckCircle, AlertCircle, Plus, X, Car, Package } from 'lucide-react';
// 🏢 ENTERPRISE: Using centralized entity config for consistent icons/colors
// 🏢 ENTERPRISE: Centralized API client with automatic authentication
import { apiClient, ApiClientError } from '@/lib/api/enterprise-api-client';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useTypography } from '@/hooks/useTypography';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
// 🏢 ENTERPRISE: Domain constants for space types + Select clear value
import { ALLOCATION_SPACE_TYPES, SPACE_INCLUSION_TYPES, SELECT_CLEAR_VALUE, isSelectClearValue } from '@/config/domain-constants';
import type { LinkedSpace } from '@/types/unit';
import type { SpaceInclusionType } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('LinkedSpacesCard');

// ============================================================================
// 🏢 ENTERPRISE: Type definitions (ZERO any)
// ============================================================================

interface ParkingOption {
  id: string;
  number: string;
  type?: string;
  status?: string;
  floor?: string;
}

interface StorageOption {
  id: string;
  name: string;
  type?: string;
  status?: string;
  floor?: string;
  area?: number;
}

interface LinkedSpacesCardProps {
  /** Unit ID για update */
  unitId: string;
  /** Building ID για φιλτράρισμα διαθέσιμων spaces */
  buildingId?: string;
  /** Τρέχοντα linkedSpaces (αν υπάρχουν) */
  currentLinkedSpaces?: LinkedSpace[];
  /** Callback μετά από επιτυχές update */
  onLinkedSpacesChanged?: (newLinkedSpaces: LinkedSpace[]) => void;
  /** Αν είναι σε edit mode */
  isEditing?: boolean;
}

// ============================================================================
// 🏢 ENTERPRISE: Component
// ============================================================================

/**
 * LinkedSpacesCard Component
 *
 * Επιτρέπει τη σύνδεση Parking/Storage με μια μονάδα.
 * Χρησιμοποιεί Radix Select (ADR-001 canonical) και Firestore για persistence.
 */
export function LinkedSpacesCard({
  unitId,
  buildingId,
  currentLinkedSpaces = [],
  onLinkedSpacesChanged,
  isEditing = true,
}: LinkedSpacesCardProps) {
  // 🏢 ENTERPRISE: Centralized hooks (ZERO inline styles)
  const { t } = useTranslation('units');
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const spacing = useSpacingTokens();
  const typography = useTypography();

  // 🏢 ENTERPRISE: State management - Available options
  const [parkingOptions, setParkingOptions] = useState<ParkingOption[]>([]);
  const [storageOptions, setStorageOptions] = useState<StorageOption[]>([]);
  const [loadingParking, setLoadingParking] = useState(false);
  const [loadingStorage, setLoadingStorage] = useState(false);

  // 🏢 ENTERPRISE: Draft state - initialized ONCE from props (no sync via useEffect)
  // This follows the "edit session" pattern where draft is independent until save
  const [draftLinkedSpaces, setDraftLinkedSpaces] = useState<LinkedSpace[]>(currentLinkedSpaces);

  // 🏢 ENTERPRISE: New space selection (for adding) - uses sentinel for no selection
  const [selectedParkingId, setSelectedParkingId] = useState<string>(SELECT_CLEAR_VALUE);
  const [selectedStorageId, setSelectedStorageId] = useState<string>(SELECT_CLEAR_VALUE);
  const [selectedInclusion, setSelectedInclusion] = useState<SpaceInclusionType>('included');

  // ============================================================================
  // 🏢 ENTERPRISE: Reset/Cancel Policy - Reset draft when exiting edit mode
  // ============================================================================
  // When isEditing changes from true → false (user cancels/exits edit mode),
  // reset draft values to current props (discard unsaved changes).
  // This is deterministic: exit without save = revert to original values.
  // ============================================================================
  const prevIsEditingRef = React.useRef(isEditing);
  useEffect(() => {
    // Detect transition: was editing → no longer editing (cancel/exit)
    if (prevIsEditingRef.current && !isEditing) {
      // Reset drafts to props (discard unsaved changes)
      setDraftLinkedSpaces(currentLinkedSpaces);
      setSelectedParkingId(SELECT_CLEAR_VALUE);
      setSelectedStorageId(SELECT_CLEAR_VALUE);
      setSelectedInclusion('included');
      setSaveStatus('idle');
      logger.info('[LinkedSpacesCard] Edit cancelled - draft reset to props');
    }
    prevIsEditingRef.current = isEditing;
  }, [isEditing, currentLinkedSpaces]);

  // 🏢 ENTERPRISE: Loading & Saving states
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // 🏢 ENTERPRISE: Load parking options when buildingId changes
  useEffect(() => {
    const loadParking = async () => {
      if (!buildingId) {
        setParkingOptions([]);
        return;
      }

      setLoadingParking(true);
      try {
        interface ParkingApiResponse {
          parkingSpots?: Array<{ id: string; number: string; type?: string; status?: string; floor?: string }>;
        }

        // apiClient.get() unwraps { success, data } → returns data directly
        const result = await apiClient.get<ParkingApiResponse>(`/api/parking?buildingId=${buildingId}`);
        const parkingData = result?.parkingSpots || [];

        setParkingOptions(parkingData);
        logger.info(`[LinkedSpacesCard] Loaded ${parkingData.length} parking spots for building`);
      } catch (error) {
        // 🏢 ENTERPRISE: 403/404 are expected (tenant isolation / no parking configured)
        if (ApiClientError.isApiClientError(error) && (error.statusCode === 403 || error.statusCode === 404)) {
          logger.info(`ℹ[LinkedSpacesCard] No parking data for building (${error.statusCode})`);
        } else {
          logger.warn('[LinkedSpacesCard] Unexpected error loading parking:', { data: error });
        }
        setParkingOptions([]);
      } finally {
        setLoadingParking(false);
      }
    };

    loadParking();
  }, [buildingId]);

  // 🏢 ENTERPRISE: Load storage options when buildingId changes
  useEffect(() => {
    const loadStorage = async () => {
      if (!buildingId) {
        setStorageOptions([]);
        return;
      }

      setLoadingStorage(true);
      try {
        interface StorageApiResponse {
          storages?: Array<{ id: string; name: string; buildingId?: string; type?: string; status?: string; floor?: string; area?: number }>;
        }

        // apiClient.get() unwraps { success, data } → returns data directly
        // Storages API supports buildingId filter
        const result = await apiClient.get<StorageApiResponse>(`/api/storages?buildingId=${buildingId}`);
        const storageData = result?.storages || [];

        setStorageOptions(storageData);
        logger.info(`[LinkedSpacesCard] Loaded ${storageData.length} storages for building`);
      } catch (error) {
        // 🏢 ENTERPRISE: 403/404 are expected (tenant isolation / no storages configured)
        if (ApiClientError.isApiClientError(error) && (error.statusCode === 403 || error.statusCode === 404)) {
          logger.info(`ℹ[LinkedSpacesCard] No storage data for building (${error.statusCode})`);
        } else {
          logger.warn('[LinkedSpacesCard] Unexpected error loading storages:', { data: error });
        }
        setStorageOptions([]);
      } finally {
        setLoadingStorage(false);
      }
    };

    loadStorage();
  }, [buildingId]);

  // ============================================================================
  // 🏢 ENTERPRISE: NO STATE MIRRORING - Draft initialized once, not synced
  // ============================================================================
  // ❌ REMOVED: useEffect(() => setLinkedSpaces(currentLinkedSpaces), [currentLinkedSpaces])
  // ✅ PATTERN: Draft state initialized in useState, updated only by user action
  // ============================================================================

  // 🏢 ENTERPRISE: Add parking space to draft list (user action only)
  const handleAddParking = useCallback(() => {
    if (!selectedParkingId || isSelectClearValue(selectedParkingId)) return;

    const parking = parkingOptions.find(p => p.id === selectedParkingId);
    if (!parking) return;

    // Check if already linked
    if (draftLinkedSpaces.some(ls => ls.spaceId === selectedParkingId)) {
      logger.warn('[LinkedSpacesCard] Parking already linked');
      return;
    }

    const newLinkedSpace: LinkedSpace = {
      spaceId: selectedParkingId,
      spaceType: ALLOCATION_SPACE_TYPES.PARKING,
      quantity: 1,
      inclusion: selectedInclusion,
      allocationCode: parking.number,
    };

    setDraftLinkedSpaces(prev => [...prev, newLinkedSpace]);
    setSelectedParkingId(SELECT_CLEAR_VALUE);
    setSaveStatus('idle');
  }, [selectedParkingId, parkingOptions, draftLinkedSpaces, selectedInclusion]);

  // 🏢 ENTERPRISE: Add storage space to draft list (user action only)
  const handleAddStorage = useCallback(() => {
    if (!selectedStorageId || isSelectClearValue(selectedStorageId)) return;

    const storage = storageOptions.find(s => s.id === selectedStorageId);
    if (!storage) return;

    // Check if already linked
    if (draftLinkedSpaces.some(ls => ls.spaceId === selectedStorageId)) {
      logger.warn('[LinkedSpacesCard] Storage already linked');
      return;
    }

    const newLinkedSpace: LinkedSpace = {
      spaceId: selectedStorageId,
      spaceType: ALLOCATION_SPACE_TYPES.STORAGE,
      quantity: 1,
      inclusion: selectedInclusion,
      allocationCode: storage.name,
    };

    setDraftLinkedSpaces(prev => [...prev, newLinkedSpace]);
    setSelectedStorageId(SELECT_CLEAR_VALUE);
    setSaveStatus('idle');
  }, [selectedStorageId, storageOptions, draftLinkedSpaces, selectedInclusion]);

  // 🏢 ENTERPRISE: Remove space from draft (user action only)
  const handleRemoveSpace = useCallback((spaceId: string) => {
    setDraftLinkedSpaces(prev => prev.filter(ls => ls.spaceId !== spaceId));
    setSaveStatus('idle');
  }, []);

  // 🏢 ENTERPRISE: Save draft to Firestore
  const handleSave = useCallback(async () => {
    if (!unitId) {
      logger.error('[LinkedSpacesCard] No unitId provided');
      return;
    }

    setSaving(true);
    setSaveStatus('idle');

    try {
      const unitRef = doc(db, COLLECTIONS.UNITS, unitId);

      // 🏢 ENTERPRISE: Update linkedSpaces array with draft values
      await updateDoc(unitRef, {
        linkedSpaces: draftLinkedSpaces,
        updatedAt: new Date().toISOString(),
      });

      logger.info(`[LinkedSpacesCard] Unit ${unitId} linkedSpaces updated with ${draftLinkedSpaces.length} spaces`);
      setSaveStatus('success');

      if (onLinkedSpacesChanged) {
        onLinkedSpacesChanged(draftLinkedSpaces);
      }

      // Reset success status after 3 seconds
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      logger.error('[LinkedSpacesCard] Error saving:', { error: error });
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  }, [unitId, draftLinkedSpaces, onLinkedSpacesChanged]);

  // 🏢 ENTERPRISE: Check if draft differs from props
  const hasChanges = JSON.stringify(draftLinkedSpaces) !== JSON.stringify(currentLinkedSpaces);

  // 🏢 ENTERPRISE: Get space name for display
  const getSpaceName = (space: LinkedSpace): string => {
    if (space.allocationCode) return space.allocationCode;
    if (space.spaceType === 'parking') {
      const parking = parkingOptions.find(p => p.id === space.spaceId);
      return parking?.number || space.spaceId;
    } else {
      const storage = storageOptions.find(s => s.id === space.spaceId);
      return storage?.name || space.spaceId;
    }
  };

  // 🏢 ENTERPRISE: Get inclusion label
  const getInclusionLabel = (inclusion: SpaceInclusionType): string => {
    return t(`linkedSpaces.inclusion.${inclusion}`, { defaultValue: inclusion });
  };

  // Don't render if no building is selected
  if (!buildingId) {
    return null;
  }

  return (
    <Card className={cn(quick.card, colors.bg.card)}>
      <CardHeader className="!p-2 flex flex-col space-y-2">
        <CardTitle className={cn('flex items-center', spacing.gap.sm, typography.card.titleCompact)}>
          <Package className={cn(iconSizes.md, 'text-purple-600')} />
          {t('linkedSpaces.title', { defaultValue: 'Συνδεδεμένοι Χώροι' })}
        </CardTitle>
      </CardHeader>
      <CardContent className="!p-2 !pt-2 space-y-3">
        {/* 🏢 ENTERPRISE: Currently linked spaces (from draft) */}
        {draftLinkedSpaces.length > 0 && (
          <section className={spacing.spaceBetween.sm}>
            <Label className="text-xs text-muted-foreground">
              {t('linkedSpaces.currentlyLinked', { defaultValue: 'Συνδεδεμένα' })}
            </Label>
            <ul className={`flex flex-wrap ${spacing.gap.sm}`}>
              {draftLinkedSpaces.map((space) => (
                <li key={space.spaceId}>
                  <Badge
                    variant="secondary"
                    className={`flex items-center ${spacing.gap.sm} pr-1`}
                  >
                    {space.spaceType === 'parking' ? (
                      <Car className={cn(iconSizes.xs, 'text-blue-600')} />
                    ) : (
                      <Package className={cn(iconSizes.xs, 'text-amber-600')} />
                    )}
                    <span>{getSpaceName(space)}</span>
                    <span className="text-xs text-muted-foreground">
                      ({getInclusionLabel(space.inclusion)})
                    </span>
                    {isEditing && (
                      <button
                        type="button"
                        onClick={() => handleRemoveSpace(space.spaceId)}
                        className={cn(
                          'ml-1 p-0.5 rounded-full hover:bg-destructive/20',
                          'text-muted-foreground hover:text-destructive',
                          'transition-colors'
                        )}
                        aria-label={t('linkedSpaces.remove', { defaultValue: 'Αφαίρεση' })}
                      >
                        <X className={iconSizes.xs} />
                      </button>
                    )}
                  </Badge>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 🏢 ENTERPRISE: Add new spaces (only in edit mode) */}
        {isEditing && (
          <>
            {/* Inclusion type selector */}
            <fieldset className={spacing.spaceBetween.sm}>
              <Label htmlFor="inclusion-selector" className="text-xs">
                {t('linkedSpaces.inclusionLabel', { defaultValue: 'Τύπος σύνδεσης' })}
              </Label>
              <Select
                value={selectedInclusion}
                onValueChange={(value: SpaceInclusionType) => setSelectedInclusion(value)}
              >
                <SelectTrigger id="inclusion-selector" className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SPACE_INCLUSION_TYPES.INCLUDED}>
                    {t('linkedSpaces.inclusion.included', { defaultValue: 'Συμπεριλαμβάνεται' })}
                  </SelectItem>
                  <SelectItem value={SPACE_INCLUSION_TYPES.OPTIONAL}>
                    {t('linkedSpaces.inclusion.optional', { defaultValue: 'Προαιρετικό' })}
                  </SelectItem>
                  <SelectItem value={SPACE_INCLUSION_TYPES.RENTED}>
                    {t('linkedSpaces.inclusion.rented', { defaultValue: 'Ενοικιαζόμενο' })}
                  </SelectItem>
                </SelectContent>
              </Select>
            </fieldset>

            {/* Parking selector */}
            <fieldset className={spacing.spaceBetween.sm}>
              <Label className="text-xs flex items-center gap-1">
                <Car className={cn(iconSizes.xs, 'text-blue-600')} />
                {t('linkedSpaces.addParking', { defaultValue: 'Προσθήκη Parking' })}
              </Label>
              {loadingParking ? (
                <section className={`flex items-center ${spacing.gap.sm} text-muted-foreground text-sm`}>
                  <Loader2 className={cn(iconSizes.sm, 'animate-spin')} />
                  <span>{t('linkedSpaces.loadingParking', { defaultValue: 'Φόρτωση...' })}</span>
                </section>
              ) : parkingOptions.length === 0 ? (
                <p className={cn('text-xs', colors.text.muted)}>
                  {t('linkedSpaces.noParkingAvailable', { defaultValue: 'Δεν υπάρχουν διαθέσιμες θέσεις parking' })}
                </p>
              ) : (
                <div className={`flex ${spacing.gap.sm}`}>
                  <Select
                    value={selectedParkingId}
                    onValueChange={setSelectedParkingId}
                  >
                    <SelectTrigger className="flex-1 h-8 text-sm">
                      <SelectValue placeholder={t('linkedSpaces.selectParking', { defaultValue: 'Επιλογή parking...' })} />
                    </SelectTrigger>
                    <SelectContent>
                      {/* 🏢 ENTERPRISE: Clear option - uses sentinel (Radix forbids empty string) */}
                      <SelectItem value={SELECT_CLEAR_VALUE}>
                        {t('linkedSpaces.selectParking', { defaultValue: '-- Επιλέξτε --' })}
                      </SelectItem>
                      {parkingOptions
                        .filter(p => !draftLinkedSpaces.some(ls => ls.spaceId === p.id))
                        .map((parking) => (
                          <SelectItem key={parking.id} value={parking.id}>
                            {parking.number} {parking.type && `(${parking.type})`}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleAddParking}
                    disabled={!selectedParkingId || isSelectClearValue(selectedParkingId)}
                    className="h-8"
                  >
                    <Plus className={iconSizes.xs} />
                  </Button>
                </div>
              )}
            </fieldset>

            {/* Storage selector */}
            <fieldset className={spacing.spaceBetween.sm}>
              <Label className="text-xs flex items-center gap-1">
                <Package className={cn(iconSizes.xs, 'text-amber-600')} />
                {t('linkedSpaces.addStorage', { defaultValue: 'Προσθήκη Αποθήκης' })}
              </Label>
              {loadingStorage ? (
                <section className={`flex items-center ${spacing.gap.sm} text-muted-foreground text-sm`}>
                  <Loader2 className={cn(iconSizes.sm, 'animate-spin')} />
                  <span>{t('linkedSpaces.loadingStorage', { defaultValue: 'Φόρτωση...' })}</span>
                </section>
              ) : storageOptions.length === 0 ? (
                <p className={cn('text-xs', colors.text.muted)}>
                  {t('linkedSpaces.noStorageAvailable', { defaultValue: 'Δεν υπάρχουν διαθέσιμες αποθήκες' })}
                </p>
              ) : (
                <div className={`flex ${spacing.gap.sm}`}>
                  <Select
                    value={selectedStorageId}
                    onValueChange={setSelectedStorageId}
                  >
                    <SelectTrigger className="flex-1 h-8 text-sm">
                      <SelectValue placeholder={t('linkedSpaces.selectStorage', { defaultValue: 'Επιλογή αποθήκης...' })} />
                    </SelectTrigger>
                    <SelectContent>
                      {/* 🏢 ENTERPRISE: Clear option - uses sentinel (Radix forbids empty string) */}
                      <SelectItem value={SELECT_CLEAR_VALUE}>
                        {t('linkedSpaces.selectStorage', { defaultValue: '-- Επιλέξτε --' })}
                      </SelectItem>
                      {storageOptions
                        .filter(s => !draftLinkedSpaces.some(ls => ls.spaceId === s.id))
                        .map((storage) => (
                          <SelectItem key={storage.id} value={storage.id}>
                            {storage.name} {storage.area && `(${storage.area} τ.μ.)`}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleAddStorage}
                    disabled={!selectedStorageId || isSelectClearValue(selectedStorageId)}
                    className="h-8"
                  >
                    <Plus className={iconSizes.xs} />
                  </Button>
                </div>
              )}
            </fieldset>

            {/* Save button */}
            <footer className={`flex items-center justify-between ${spacing.padding.top.sm}`}>
              <Button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                variant={hasChanges ? 'default' : 'outline'}
                size="sm"
              >
                {saving ? (
                  <>
                    <Loader2 className={cn(iconSizes.sm, spacing.margin.right.sm, 'animate-spin')} />
                    {t('linkedSpaces.saving', { defaultValue: 'Αποθήκευση...' })}
                  </>
                ) : (
                  <>
                    <Save className={cn(iconSizes.sm, spacing.margin.right.sm)} />
                    {t('linkedSpaces.save', { defaultValue: 'Αποθήκευση' })}
                  </>
                )}
              </Button>

              {/* Status indicators */}
              {saveStatus === 'success' && (
                <span className={`flex items-center ${spacing.gap.sm} text-sm text-green-600 dark:text-green-400`}>
                  <CheckCircle className={iconSizes.sm} />
                  {t('linkedSpaces.success', { defaultValue: 'Αποθηκεύτηκε!' })}
                </span>
              )}
              {saveStatus === 'error' && (
                <span className={`flex items-center ${spacing.gap.sm} text-sm text-red-600 dark:text-red-400`}>
                  <AlertCircle className={iconSizes.sm} />
                  {t('linkedSpaces.error', { defaultValue: 'Σφάλμα' })}
                </span>
              )}
            </footer>
          </>
        )}

        {/* Empty state */}
        {draftLinkedSpaces.length === 0 && !isEditing && (
          <p className={cn('text-sm', colors.text.muted)}>
            {t('linkedSpaces.noLinkedSpaces', { defaultValue: 'Δεν υπάρχουν συνδεδεμένοι χώροι' })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default LinkedSpacesCard;
