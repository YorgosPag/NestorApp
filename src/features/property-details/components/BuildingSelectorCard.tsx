// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
'use client';

/**
 * 🏢 ENTERPRISE: BuildingSelectorCard Component
 *
 * Επιτρέπει τη σύνδεση μιας μονάδας (unit) με ένα κτίριο (building) και όροφο (floor).
 * Ακολουθεί το ίδιο pattern με το ProjectSelectorCard.
 *
 * @author Claude AI Assistant
 * @created 2026-01-07
 * @updated 2026-01-24 - Added Floor Selector (Phase 1.1)
 * @pattern Follows ProjectSelectorCard pattern exactly
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Save, CheckCircle, AlertCircle } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
// 🏢 ENTERPRISE: Using centralized entity config for consistent icons/colors
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
// 🏢 ENTERPRISE: Centralized API client with automatic authentication
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { RealtimeService } from '@/services/realtime';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
// 🏢 ENTERPRISE: Centralized Select clear value (Radix forbids empty string in SelectItem)
import { SELECT_CLEAR_VALUE, isSelectClearValue } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';
import { updatePropertyBuildingLinkWithPolicy } from '@/services/property/property-mutation-gateway';
import { useGuardedPropertyMutation } from '@/hooks/useGuardedPropertyMutation';
import { useNotifications } from '@/providers/NotificationProvider';
import { translatePropertyMutationError } from '@/services/property/property-mutation-feedback';
import '@/lib/design-system';
const logger = createModuleLogger('BuildingSelectorCard');

// ============================================================================
// 🏢 ENTERPRISE: Type definitions (ZERO any)
// ============================================================================

interface BuildingOption {
  id: string;
  name: string;
}

interface FloorOption {
  id: string;
  name: string;
  /** Floor number (API uses 'number' field) */
  number: number;
}

interface BuildingSelectorCardProps {
  /** Unit ID για update */
  propertyId: string;
  /** Τρέχον buildingId (αν υπάρχει) */
  currentBuildingId?: string;
  /** Τρέχον floorId (αν υπάρχει) */
  currentFloorId?: string;
  /** Callback μετά από επιτυχές update */
  onBuildingChanged?: (newBuildingId: string, newFloorId?: string) => void;
  /** Αν είναι σε edit mode */
  isEditing?: boolean;
}

// ============================================================================
// 🌐 i18n: Labels now use useTranslation hook (namespace: 'properties')
// ============================================================================

// ============================================================================
// 🏢 ENTERPRISE: Component
// ============================================================================

/**
 * BuildingSelectorCard Component
 *
 * Επιτρέπει τη σύνδεση μιας μονάδας με ένα κτίριο.
 * Χρησιμοποιεί Radix Select (ADR-001 canonical) και Firestore για persistence.
 */
export function BuildingSelectorCard({
  propertyId,
  currentBuildingId,
  currentFloorId,
  onBuildingChanged,
  isEditing = true,
}: BuildingSelectorCardProps) {
  // 🏢 ENTERPRISE: Centralized hooks (ZERO inline styles)
  const { t } = useTranslation('properties');
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const spacing = useSpacingTokens();
  const typography = useTypography();
  const { error: notifyError } = useNotifications();
  const { checking: previewChecking, runPreviewedMutation, ImpactDialog } = useGuardedPropertyMutation({ id: propertyId });

  // 🏢 ENTERPRISE: State management - Buildings
  const [buildings, setBuildings] = useState<BuildingOption[]>([]);
  // 🏢 ENTERPRISE: Draft state - initialized ONCE from props (no sync via useEffect)
  // This follows the "edit session" pattern where draft is independent until save
  const [draftBuildingId, setDraftBuildingId] = useState<string | undefined>(currentBuildingId);

  // 🏢 ENTERPRISE: State management - Floors (Phase 1.1)
  const [floors, setFloors] = useState<FloorOption[]>([]);
  // 🏢 ENTERPRISE: Draft floor - initialized ONCE (no continuous sync)
  const [draftFloorId, setDraftFloorId] = useState<string | undefined>(currentFloorId);
  const [loadingFloors, setLoadingFloors] = useState(false);

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
      setDraftBuildingId(currentBuildingId);
      setDraftFloorId(currentFloorId);
      setSaveStatus('idle');
      logger.info('[BuildingSelectorCard] Edit cancelled - draft reset to props');
    }
    prevIsEditingRef.current = isEditing;
  }, [isEditing, currentBuildingId, currentFloorId]);

  // 🏢 ENTERPRISE: Loading & Saving states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // 🏢 ENTERPRISE: Load buildings on mount via API (more reliable than direct Firestore)
  useEffect(() => {
    const loadBuildings = async () => {
      setLoading(true);
      try {
        // 🏢 ENTERPRISE: Use centralized API client with automatic authentication
        interface BuildingsApiResponse {
          buildings: Array<{ id: string; name?: string }>;
        }

        const result = await apiClient.get<BuildingsApiResponse>(API_ROUTES.BUILDINGS.LIST);

        const buildingsData = result?.buildings || [];
        logger.info(`[BuildingSelectorCard] API returned ${buildingsData.length} buildings`);

        // 🏢 ENTERPRISE: Filter to only buildings that exist in Navigation hierarchy
        // Legacy buildings have IDs like "building_1_palaiologou_luxury_apartments"
        // Enterprise buildings have Firebase auto-generated IDs (20 chars, alphanumeric)
        const enterpriseBuildings = buildingsData.filter((b: { id: string }) => {
          const buildingId = String(b.id);
          // Legacy IDs start with "building_" prefix - filter them out
          const isLegacyId = buildingId.startsWith('building_');
          // Enterprise IDs are Firebase auto-generated (20 chars, no underscore prefix)
          return !isLegacyId && buildingId.length >= 20;
        });

        const buildingOptions: BuildingOption[] = enterpriseBuildings.map((b: { id: string; name?: string }) => ({
          id: String(b.id),
          name: b.name || t('buildingSelector.noName'),
        }));
        setBuildings(buildingOptions);
        logger.info(`[BuildingSelectorCard] Loaded ${buildingOptions.length} enterprise buildings`);
        logger.info(`[BuildingSelectorCard] Building names:`, { data: buildingOptions.map(b => b.name) });
      } catch (error) {
        logger.error('[BuildingSelectorCard] Error loading buildings:', { error: error });
      } finally {
        setLoading(false);
      }
    };

    loadBuildings();
  }, []);

  // ============================================================================
  // 🏢 ENTERPRISE: NO STATE MIRRORING - Draft initialized once, not synced
  // ============================================================================
  // ❌ REMOVED: useEffect(() => setState(prop), [prop]) - causes infinite loop
  // ✅ PATTERN: Draft state initialized in useState, updated only by user action
  // ============================================================================

  // 🏢 ENTERPRISE: Load floors when draft building changes (Phase 1.1)
  useEffect(() => {
    const loadFloors = async () => {
      // Reset floors if no building selected
      if (!draftBuildingId) {
        setFloors([]);
        setDraftFloorId(undefined);
        return;
      }

      setLoadingFloors(true);
      try {
        // 🏢 ENTERPRISE: Fetch floors for selected building
        interface FloorsApiResponse {
          floors: Array<{ id: string; name?: string; number?: number; buildingId?: string }>;
        }

        const result = await apiClient.get<FloorsApiResponse>(`${API_ROUTES.FLOORS.LIST}?buildingId=${draftBuildingId}`);
        const floorsData = result?.floors || [];

        // Filter floors that belong to this building and sort by floor number
        const buildingFloors = floorsData
          .filter(f => f.buildingId === draftBuildingId)
          .sort((a, b) => (a.number || 0) - (b.number || 0));

        const floorOptions: FloorOption[] = buildingFloors.map(f => ({
          id: String(f.id),
          name: f.name || `${t('buildingSelector.floor')} ${f.number ?? 0}`,
          number: f.number ?? 0,
        }));

        setFloors(floorOptions);
        logger.info(`[BuildingSelectorCard] Loaded ${floorOptions.length} floors for building ${draftBuildingId}`);

        // If draft floor is not in the new building, reset
        if (draftFloorId && !floorOptions.find(f => f.id === draftFloorId)) {
          setDraftFloorId(undefined);
        }
      } catch (error) {
        logger.error('[BuildingSelectorCard] Error loading floors:', { error: error });
        setFloors([]);
      } finally {
        setLoadingFloors(false);
      }
    };

    loadFloors();
    // 🏢 ENTERPRISE: Only react to draftBuildingId changes (user actions)
  }, [draftBuildingId, draftFloorId, t]);

  // 🏢 ENTERPRISE: Handle building selection (user action only)
  const handleBuildingChange = useCallback((value: string) => {
    // 🏢 ENTERPRISE: Handle "clear" option - sentinel means no selection
    const newBuildingId = isSelectClearValue(value) ? undefined : value;
    setDraftBuildingId(newBuildingId);
    // Reset floor when building changes
    setDraftFloorId(undefined);
    setSaveStatus('idle');
  }, []);

  // 🏢 ENTERPRISE: Handle floor selection (Phase 1.1) - user action only
  const handleFloorChange = useCallback((value: string) => {
    // 🏢 ENTERPRISE: Handle "clear" option - sentinel means no selection
    const newFloorId = isSelectClearValue(value) ? undefined : value;
    setDraftFloorId(newFloorId);
    setSaveStatus('idle');
  }, []);

  // 🏢 ENTERPRISE: Save to Firestore (Building + Floor)
  const handleSave = useCallback(async () => {
    if (!propertyId) {
      logger.error('[BuildingSelectorCard] No propertyId provided');
      return;
    }

    setSaving(true);
    setSaveStatus('idle');

    try {
      // 🏢 ENTERPRISE: Use draft values directly (undefined → null for Firestore)
      const buildingIdToSave = draftBuildingId || null;
      const floorIdToSave = draftFloorId || null;
      await runPreviewedMutation({
        buildingId: buildingIdToSave,
        floorId: floorIdToSave,
      }, async () => {
      // 🔒 ADR-232: Use Admin SDK PATCH (Client SDK blocked by Firestore rules
      // which treat buildingId/floorId as structural invariants)
      await updatePropertyBuildingLinkWithPolicy({
        propertyId,
        currentProperty: {
          buildingId: currentBuildingId,
          floorId: currentFloorId,
        },
        buildingId: buildingIdToSave,
        floorId: floorIdToSave,
      });

      logger.info(`[BuildingSelectorCard] Unit ${propertyId} linked to building ${buildingIdToSave}, floor ${floorIdToSave}`);
      setSaveStatus('success');

      // 🏢 ENTERPRISE: Dispatch real-time event for Navigation updates
      RealtimeService.dispatchPropertyBuildingLinked({
        propertyId: propertyId,
        previousBuildingId: currentBuildingId || null,
        newBuildingId: buildingIdToSave,
        timestamp: Date.now(),
      });

      if (onBuildingChanged && buildingIdToSave) {
        onBuildingChanged(buildingIdToSave, floorIdToSave || undefined);
      }

      // Reset success status after 3 seconds
      setTimeout(() => setSaveStatus('idle'), 3000);
      });
    } catch (error) {
      logger.error('[BuildingSelectorCard] Error saving:', { error: error });
      setSaveStatus('error');
      notifyError(translatePropertyMutationError(error, t));
    } finally {
      setSaving(false);
    }
  }, [
    propertyId,
    draftBuildingId,
    draftFloorId,
    currentBuildingId,
    currentFloorId,
    notifyError,
    onBuildingChanged,
    runPreviewedMutation,
    t,
  ]);

  // 🏢 ENTERPRISE: Check if draft differs from props (no magic strings)
  const hasBuildingChanges = draftBuildingId !== currentBuildingId;
  const hasFloorChanges = draftFloorId !== currentFloorId;
  const hasChanges = hasBuildingChanges || hasFloorChanges;

  // 🏢 ENTERPRISE: Get building/floor names for display
  const currentBuildingName = buildings.find(b => b.id === currentBuildingId)?.name;
  const currentFloorName = floors.find(f => f.id === currentFloorId)?.name;
  const draftBuildingName = buildings.find(b => b.id === draftBuildingId)?.name;

  return (
    <Card className={cn(quick.card, colors.bg.card)}>
      <CardHeader className="!p-2 flex flex-col space-y-2">
        <CardTitle className={cn('flex items-center', spacing.gap.sm, typography.card.titleCompact)}>
          <NAVIGATION_ENTITIES.building.icon className={cn(iconSizes.md, NAVIGATION_ENTITIES.building.color)} />
          {t('buildingSelector.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="!p-2 !pt-2 space-y-2">
        {/* Building Selector */}
        <fieldset className={spacing.spaceBetween.sm}>
          <Label htmlFor="building-selector">{t('buildingSelector.selectLabel')}</Label>

          {loading ? (
            <section className={cn(`flex items-center ${spacing.gap.sm}`, colors.text.muted)}>
              <Spinner size="small" />
              <span>{t('buildingSelector.loading')}</span>
            </section>
          ) : (
            <Select
              value={draftBuildingId ?? ''}
              onValueChange={handleBuildingChange}
              disabled={!isEditing}
            >
              <SelectTrigger
                id="building-selector"
                className={cn(
                  !isEditing && 'bg-muted',
                  saveStatus === 'success' && getStatusBorder('success'),
                  saveStatus === 'error' && getStatusBorder('error')
                )}
              >
                <SelectValue placeholder={t('buildingSelector.placeholder')} />
              </SelectTrigger>
              <SelectContent>
                {/* 🏢 ENTERPRISE: Clear option - uses sentinel (Radix forbids empty string) */}
                <SelectItem value={SELECT_CLEAR_VALUE}>
                  {t('buildingSelector.noBuilding')}
                </SelectItem>

                {/* Building options */}
                {buildings.map((building) => (
                  <SelectItem key={building.id} value={building.id}>
                    {building.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </fieldset>

        {/* 🏢 ENTERPRISE: Floor Selector (Phase 1.1) - only show when building selected */}
        {draftBuildingId && (
          <fieldset className={spacing.spaceBetween.sm}>
            <Label htmlFor="floor-selector">
              <NAVIGATION_ENTITIES.floor.icon className={cn(iconSizes.xs, NAVIGATION_ENTITIES.floor.color, 'inline mr-1')} />
              {t('buildingSelector.floorLabel', { defaultValue: 'Όροφος' })}
            </Label>

            {loadingFloors ? (
              <section className={cn(`flex items-center ${spacing.gap.sm}`, colors.text.muted)}>
                <Spinner size="small" />
                <span>{t('buildingSelector.loadingFloors', { defaultValue: 'Φόρτωση ορόφων...' })}</span>
              </section>
            ) : floors.length === 0 ? (
              <p className={cn('text-sm', colors.text.muted)}>
                {t('buildingSelector.noFloors', { defaultValue: 'Δεν βρέθηκαν όροφοι για αυτό το κτίριο' })}
              </p>
            ) : (
              <Select
                value={draftFloorId ?? ''}
                onValueChange={handleFloorChange}
                disabled={!isEditing}
              >
                <SelectTrigger
                  id="floor-selector"
                  className={cn(
                    !isEditing && 'bg-muted',
                    saveStatus === 'success' && getStatusBorder('success'),
                    saveStatus === 'error' && getStatusBorder('error')
                  )}
                >
                  <SelectValue placeholder={t('buildingSelector.floorPlaceholder', { defaultValue: 'Επιλέξτε όροφο' })} />
                </SelectTrigger>
                <SelectContent>
                  {/* 🏢 ENTERPRISE: Clear option - uses sentinel (Radix forbids empty string) */}
                  <SelectItem value={SELECT_CLEAR_VALUE}>
                    {t('buildingSelector.noFloor', { defaultValue: '-- Χωρίς όροφο --' })}
                  </SelectItem>

                  {/* Floor options sorted by level */}
                  {floors.map((floor) => (
                    <SelectItem key={floor.id} value={floor.id}>
                      {floor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </fieldset>
        )}

        {/* Current building/floor info (when not editing) */}
        {!isEditing && currentBuildingName && (
          <p className={cn('text-sm', colors.text.muted)}>
            {t('buildingSelector.currentBuilding')}: <strong>{currentBuildingName}</strong>
            {currentFloorName && (
              <> • {t('buildingSelector.floor', { defaultValue: 'Όροφος' })}: <strong>{currentFloorName}</strong></>
            )}
          </p>
        )}

        {/* Save button and status */}
        {isEditing && (
          <footer className={`flex items-center justify-between ${spacing.padding.top.sm}`}>
            <Button
              onClick={handleSave}
              disabled={saving || previewChecking || !hasChanges}
              variant={hasChanges ? 'default' : 'outline'}
              size="sm"
            >
              {saving ? (
                <>
                  <Spinner size="small" color="inherit" className={spacing.margin.right.sm} />
                  {t('buildingSelector.saving')}
                </>
              ) : (
                <>
                  <Save className={cn(iconSizes.sm, spacing.margin.right.sm)} />
                  {t('buildingSelector.save')}
                </>
              )}
            </Button>

            {/* Status indicators */}
            {saveStatus === 'success' && (
              <span className={`flex items-center ${spacing.gap.sm} text-sm text-green-600 dark:text-green-400`}>
                <CheckCircle className={iconSizes.sm} />
                {t('buildingSelector.success')}
              </span>
            )}
            {saveStatus === 'error' && (
              <span className={`flex items-center ${spacing.gap.sm} text-sm text-red-600 dark:text-red-400`}>
                <AlertCircle className={iconSizes.sm} />
                {t('buildingSelector.error')}
              </span>
            )}
          </footer>
        )}
        {ImpactDialog}
      </CardContent>
    </Card>
  );
}

export default BuildingSelectorCard;
