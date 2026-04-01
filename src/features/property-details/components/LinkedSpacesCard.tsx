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
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, X, Car, Package } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
// 🏢 ENTERPRISE: Using centralized entity config for consistent icons/colors
// 🏢 ENTERPRISE: Centralized API client with automatic authentication
import { apiClient, ApiClientError } from '@/lib/api/enterprise-api-client';
// 🏢 ADR-238: linkedSpaces saved via Admin SDK API (client updateDoc blocked by security rules)
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useTypography } from '@/hooks/useTypography';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
// 🏢 ENTERPRISE: Domain constants for space types + Select clear value
import { API_ROUTES, ALLOCATION_SPACE_TYPES, SPACE_INCLUSION_TYPES, SELECT_CLEAR_VALUE, isSelectClearValue } from '@/config/domain-constants';
import type { LinkedSpace } from '@/types/property';
import type { SpaceInclusionType } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';
import '@/lib/design-system';
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
  propertyId: string;
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
  propertyId,
  buildingId,
  currentLinkedSpaces = [],
  onLinkedSpacesChanged,
  isEditing = true,
}: LinkedSpacesCardProps) {
  // 🏢 ENTERPRISE: Centralized hooks (ZERO inline styles)
  const { t } = useTranslation('properties');
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

  // 🏢 GOOGLE-LEVEL: Track occupied spaces — spaces already linked to OTHER units.
  // Prevents the same parking/storage from being linked to multiple units.
  const [occupiedSpaceIds, setOccupiedSpaceIds] = useState<Set<string>>(new Set());

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

  // 🏢 GOOGLE-LEVEL: Fetch ALL units for this building → collect spaces already
  // linked to OTHER units. These are excluded from the dropdowns so the same
  // parking/storage cannot be assigned to multiple units simultaneously.
  useEffect(() => {
    const loadOccupiedSpaces = async () => {
      if (!buildingId) {
        setOccupiedSpaceIds(new Set());
        return;
      }

      try {
        interface PropertiesApiResponse {
          units?: Array<{ id: string; linkedSpaces?: Array<{ spaceId: string }> }>;
        }
        const result = await apiClient.get<PropertiesApiResponse>(
          `${API_ROUTES.PROPERTIES.LIST}?buildingId=${buildingId}`
        );
        const occupied = new Set<string>();
        for (const unit of result?.units ?? []) {
          // Skip the CURRENT unit — its own spaces should remain selectable
          if (unit.id === propertyId) continue;
          for (const ls of unit.linkedSpaces ?? []) {
            occupied.add(ls.spaceId);
          }
        }
        setOccupiedSpaceIds(occupied);
        logger.info(`[LinkedSpacesCard] Found ${occupied.size} spaces occupied by other units`);
      } catch {
        setOccupiedSpaceIds(new Set());
      }
    };

    loadOccupiedSpaces();
  }, [buildingId, propertyId]);

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
        const result = await apiClient.get<ParkingApiResponse>(`${API_ROUTES.PARKING.LIST}?buildingId=${buildingId}`);
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
        const result = await apiClient.get<StorageApiResponse>(`${API_ROUTES.STORAGES.LIST}?buildingId=${buildingId}`);
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

  // ============================================================================
  // 🏢 GOOGLE-LEVEL: Optimistic Update Pattern
  //
  // 1. UI updates INSTANTLY (optimistic)
  // 2. PATCH fires in background
  // 3. On failure → rollback to previous state + show error
  // ============================================================================

  const persistLinkedSpaces = useCallback(async (
    newDraft: LinkedSpace[],
    rollback: LinkedSpace[],
  ) => {
    if (!propertyId) return;
    setSaving(true);
    try {
      await apiClient.patch(API_ROUTES.PROPERTIES.BY_ID(propertyId), {
        linkedSpaces: newDraft,
      });
      logger.info(`[LinkedSpacesCard] Saved ${newDraft.length} linked spaces`);
      setSaveStatus('success');
      onLinkedSpacesChanged?.(newDraft);
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      logger.error('[LinkedSpacesCard] Save failed — rolling back', { error });
      // ROLLBACK: restore previous state
      setDraftLinkedSpaces(rollback);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 5000);
    } finally {
      setSaving(false);
    }
  }, [propertyId, onLinkedSpacesChanged]);

  // 🏢 ENTERPRISE: Add parking — optimistic update + background save
  const handleParkingSelected = useCallback((parkingId: string) => {
    if (!parkingId || isSelectClearValue(parkingId)) {
      setSelectedParkingId(SELECT_CLEAR_VALUE);
      return;
    }

    const parking = parkingOptions.find(p => p.id === parkingId);
    if (!parking) return;

    if (draftLinkedSpaces.some(ls => ls.spaceId === parkingId)) {
      setSelectedParkingId(SELECT_CLEAR_VALUE);
      return;
    }

    const newLinkedSpace: LinkedSpace = {
      spaceId: parkingId,
      spaceType: ALLOCATION_SPACE_TYPES.PARKING,
      quantity: 1,
      inclusion: selectedInclusion,
      allocationCode: parking.number,
    };

    // Optimistic: update UI first, then save
    const previous = draftLinkedSpaces;
    const updated = [...previous, newLinkedSpace];
    setDraftLinkedSpaces(updated);
    setSelectedParkingId(SELECT_CLEAR_VALUE);
    persistLinkedSpaces(updated, previous);
  }, [parkingOptions, draftLinkedSpaces, selectedInclusion, persistLinkedSpaces]);

  // 🏢 ENTERPRISE: Add storage — optimistic update + background save
  const handleStorageSelected = useCallback((storageId: string) => {
    if (!storageId || isSelectClearValue(storageId)) {
      setSelectedStorageId(SELECT_CLEAR_VALUE);
      return;
    }

    const storage = storageOptions.find(s => s.id === storageId);
    if (!storage) return;

    if (draftLinkedSpaces.some(ls => ls.spaceId === storageId)) {
      setSelectedStorageId(SELECT_CLEAR_VALUE);
      return;
    }

    const newLinkedSpace: LinkedSpace = {
      spaceId: storageId,
      spaceType: ALLOCATION_SPACE_TYPES.STORAGE,
      quantity: 1,
      inclusion: selectedInclusion,
      allocationCode: storage.name,
    };

    // Optimistic: update UI first, then save
    const previous = draftLinkedSpaces;
    const updated = [...previous, newLinkedSpace];
    setDraftLinkedSpaces(updated);
    setSelectedStorageId(SELECT_CLEAR_VALUE);
    persistLinkedSpaces(updated, previous);
  }, [storageOptions, draftLinkedSpaces, selectedInclusion, persistLinkedSpaces]);

  // 🏢 ENTERPRISE: Remove space — optimistic update + background save
  const handleRemoveSpace = useCallback((spaceId: string) => {
    const previous = draftLinkedSpaces;
    const updated = previous.filter(ls => ls.spaceId !== spaceId);
    setDraftLinkedSpaces(updated);
    persistLinkedSpaces(updated, previous);
  }, [draftLinkedSpaces, persistLinkedSpaces]);

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
            <Label className={cn("text-xs", colors.text.muted)}>
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
                    <span className={cn("text-xs", colors.text.muted)}>
                      ({getInclusionLabel(space.inclusion)})
                    </span>
                    {isEditing && (
                      <button
                        type="button"
                        onClick={() => handleRemoveSpace(space.spaceId)}
                        className={cn(
                          'ml-1 p-0.5 rounded-full hover:bg-destructive/20',
                          `${colors.text.muted} hover:text-destructive`,
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
                <section className={cn(`flex items-center ${spacing.gap.sm} text-sm`, colors.text.muted)}>
                  <Spinner size="small" />
                  <span>{t('linkedSpaces.loadingParking', { defaultValue: 'Φόρτωση...' })}</span>
                </section>
              ) : parkingOptions.length === 0 ? (
                <p className={cn('text-xs', colors.text.muted)}>
                  {t('linkedSpaces.noParkingAvailable', { defaultValue: 'Δεν υπάρχουν διαθέσιμες θέσεις parking' })}
                </p>
              ) : (
                <Select
                  value={selectedParkingId}
                  onValueChange={handleParkingSelected}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder={t('linkedSpaces.selectParking', { defaultValue: 'Επιλογή parking...' })} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SELECT_CLEAR_VALUE}>
                      {t('linkedSpaces.selectParking', { defaultValue: '-- Επιλέξτε --' })}
                    </SelectItem>
                    {parkingOptions
                      .filter(p => !draftLinkedSpaces.some(ls => ls.spaceId === p.id) && !occupiedSpaceIds.has(p.id))
                      .map((parking) => (
                        <SelectItem key={parking.id} value={parking.id}>
                          {parking.number} {parking.type && `(${parking.type})`}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            </fieldset>

            {/* Storage selector */}
            <fieldset className={spacing.spaceBetween.sm}>
              <Label className="text-xs flex items-center gap-1">
                <Package className={cn(iconSizes.xs, 'text-amber-600')} />
                {t('linkedSpaces.addStorage', { defaultValue: 'Προσθήκη Αποθήκης' })}
              </Label>
              {loadingStorage ? (
                <section className={cn(`flex items-center ${spacing.gap.sm} text-sm`, colors.text.muted)}>
                  <Spinner size="small" />
                  <span>{t('linkedSpaces.loadingStorage', { defaultValue: 'Φόρτωση...' })}</span>
                </section>
              ) : storageOptions.length === 0 ? (
                <p className={cn('text-xs', colors.text.muted)}>
                  {t('linkedSpaces.noStorageAvailable', { defaultValue: 'Δεν υπάρχουν διαθέσιμες αποθήκες' })}
                </p>
              ) : (
                <Select
                  value={selectedStorageId}
                  onValueChange={handleStorageSelected}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder={t('linkedSpaces.selectStorage', { defaultValue: 'Επιλογή αποθήκης...' })} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SELECT_CLEAR_VALUE}>
                      {t('linkedSpaces.selectStorage', { defaultValue: '-- Επιλέξτε --' })}
                    </SelectItem>
                    {storageOptions
                      .filter(s => !draftLinkedSpaces.some(ls => ls.spaceId === s.id) && !occupiedSpaceIds.has(s.id))
                      .map((storage) => (
                        <SelectItem key={storage.id} value={storage.id}>
                          {storage.name} {storage.area && `(${storage.area} τ.μ.)`}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            </fieldset>

            {/* Auto-save status indicators (no manual save button needed) */}
            {(saving || saveStatus !== 'idle') && (
              <footer className={`flex items-center ${spacing.gap.sm} ${spacing.padding.top.sm}`}>
                {saving && (
                  <span className={cn(`flex items-center ${spacing.gap.sm} text-sm`, colors.text.muted)}>
                    <Spinner size="small" />
                    {t('linkedSpaces.saving', { defaultValue: 'Αποθήκευση...' })}
                  </span>
                )}
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
            )}
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
