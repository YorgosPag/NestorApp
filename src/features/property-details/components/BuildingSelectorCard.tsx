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
import { Save, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
// 🏢 ENTERPRISE: Using centralized entity config for consistent icons/colors
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
// 🏢 ENTERPRISE: Centralized API client with automatic authentication
import { apiClient } from '@/lib/api/enterprise-api-client';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { RealtimeService } from '@/services/realtime';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { useSpacingTokens } from '@/hooks/useSpacingTokens';

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
  unitId: string;
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
// 🌐 i18n: Labels now use useTranslation hook (namespace: 'units')
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
  unitId,
  currentBuildingId,
  currentFloorId,
  onBuildingChanged,
  isEditing = true,
}: BuildingSelectorCardProps) {
  // 🏢 ENTERPRISE: Centralized hooks (ZERO inline styles)
  const { t } = useTranslation('units');
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const spacing = useSpacingTokens();

  // 🏢 ENTERPRISE: State management - Buildings
  const [buildings, setBuildings] = useState<BuildingOption[]>([]);
  // 🏢 ENTERPRISE: Initialize with '__none__' if no building (Radix requires non-empty value)
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>(currentBuildingId || '__none__');

  // 🏢 ENTERPRISE: State management - Floors (Phase 1.1)
  const [floors, setFloors] = useState<FloorOption[]>([]);
  const [selectedFloorId, setSelectedFloorId] = useState<string>(currentFloorId || '__none__');
  const [loadingFloors, setLoadingFloors] = useState(false);

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

        const result = await apiClient.get<BuildingsApiResponse>('/api/buildings');

        const buildingsData = result?.buildings || [];
        console.log(`🔍 [BuildingSelectorCard] API returned ${buildingsData.length} buildings`);

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
        console.log(`✅ [BuildingSelectorCard] Loaded ${buildingOptions.length} enterprise buildings`);
        console.log(`🏢 [BuildingSelectorCard] Building names:`, buildingOptions.map(b => b.name));
      } catch (error) {
        console.error('❌ [BuildingSelectorCard] Error loading buildings:', error);
      } finally {
        setLoading(false);
      }
    };

    loadBuildings();
  }, []);

  // 🏢 ENTERPRISE: Sync with external currentBuildingId changes
  useEffect(() => {
    if (currentBuildingId !== undefined) {
      // Convert empty/null to '__none__' for Radix Select compatibility
      setSelectedBuildingId(currentBuildingId || '__none__');
    }
  }, [currentBuildingId]);

  // 🏢 ENTERPRISE: Sync with external currentFloorId changes
  useEffect(() => {
    if (currentFloorId !== undefined) {
      setSelectedFloorId(currentFloorId || '__none__');
    }
  }, [currentFloorId]);

  // 🏢 ENTERPRISE: Load floors when building changes (Phase 1.1)
  useEffect(() => {
    const loadFloors = async () => {
      // Reset floors if no building selected
      if (!selectedBuildingId || selectedBuildingId === '__none__') {
        setFloors([]);
        setSelectedFloorId('__none__');
        return;
      }

      setLoadingFloors(true);
      try {
        // 🏢 ENTERPRISE: Fetch floors for selected building
        interface FloorsApiResponse {
          floors: Array<{ id: string; name?: string; number?: number; buildingId?: string }>;
        }

        const result = await apiClient.get<FloorsApiResponse>(`/api/floors?buildingId=${selectedBuildingId}`);
        const floorsData = result?.floors || [];

        // Filter floors that belong to this building and sort by floor number
        const buildingFloors = floorsData
          .filter(f => f.buildingId === selectedBuildingId)
          .sort((a, b) => (a.number || 0) - (b.number || 0));

        const floorOptions: FloorOption[] = buildingFloors.map(f => ({
          id: String(f.id),
          name: f.name || `${t('buildingSelector.floor')} ${f.number ?? 0}`,
          number: f.number ?? 0,
        }));

        setFloors(floorOptions);
        console.log(`✅ [BuildingSelectorCard] Loaded ${floorOptions.length} floors for building ${selectedBuildingId}`);

        // If current floor is not in the new building, reset to none
        if (currentFloorId && !floorOptions.find(f => f.id === currentFloorId)) {
          setSelectedFloorId('__none__');
        }
      } catch (error) {
        console.error('❌ [BuildingSelectorCard] Error loading floors:', error);
        setFloors([]);
      } finally {
        setLoadingFloors(false);
      }
    };

    loadFloors();
  }, [selectedBuildingId, currentFloorId, t]);

  // 🏢 ENTERPRISE: Handle building selection
  const handleBuildingChange = useCallback((value: string) => {
    setSelectedBuildingId(value);
    // Reset floor when building changes
    setSelectedFloorId('__none__');
    setSaveStatus('idle');
  }, []);

  // 🏢 ENTERPRISE: Handle floor selection (Phase 1.1)
  const handleFloorChange = useCallback((value: string) => {
    setSelectedFloorId(value);
    setSaveStatus('idle');
  }, []);

  // 🏢 ENTERPRISE: Save to Firestore (Building + Floor)
  const handleSave = useCallback(async () => {
    if (!unitId) {
      console.error('❌ [BuildingSelectorCard] No unitId provided');
      return;
    }

    setSaving(true);
    setSaveStatus('idle');

    try {
      const unitRef = doc(db, COLLECTIONS.UNITS, unitId);

      // 🏢 ENTERPRISE: Convert "__none__" back to null for Firestore
      const buildingIdToSave = selectedBuildingId === '__none__' ? null : selectedBuildingId || null;
      const floorIdToSave = selectedFloorId === '__none__' ? null : selectedFloorId || null;

      // 🏢 ENTERPRISE: Update both buildingId and floorId (Phase 1.1)
      await updateDoc(unitRef, {
        buildingId: buildingIdToSave,
        floorId: floorIdToSave,
        updatedAt: new Date().toISOString(),
      });

      console.log(`✅ [BuildingSelectorCard] Unit ${unitId} linked to building ${buildingIdToSave}, floor ${floorIdToSave}`);
      setSaveStatus('success');

      // 🏢 ENTERPRISE: Dispatch real-time event for Navigation updates
      RealtimeService.dispatchUnitBuildingLinked({
        unitId,
        previousBuildingId: currentBuildingId || null,
        newBuildingId: buildingIdToSave,
        timestamp: Date.now(),
      });

      if (onBuildingChanged && buildingIdToSave) {
        onBuildingChanged(buildingIdToSave, floorIdToSave || undefined);
      }

      // Reset success status after 3 seconds
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      console.error('❌ [BuildingSelectorCard] Error saving:', error);
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  }, [unitId, selectedBuildingId, selectedFloorId, currentBuildingId, onBuildingChanged]);

  // 🏢 ENTERPRISE: Check if value changed (using '__none__' for empty values)
  const hasBuildingChanges = selectedBuildingId !== (currentBuildingId || '__none__');
  const hasFloorChanges = selectedFloorId !== (currentFloorId || '__none__');
  const hasChanges = hasBuildingChanges || hasFloorChanges;

  // 🏢 ENTERPRISE: Get current building/floor names for display
  const currentBuildingName = buildings.find(b => b.id === currentBuildingId)?.name;
  const currentFloorName = floors.find(f => f.id === currentFloorId)?.name;

  return (
    <Card className={cn(quick.card, colors.bg.card)}>
      <CardHeader className="!p-2 flex flex-col space-y-2">
        <CardTitle className={`flex items-center ${spacing.gap.sm}`}>
          <NAVIGATION_ENTITIES.building.icon className={cn(iconSizes.md, NAVIGATION_ENTITIES.building.color)} />
          {t('buildingSelector.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="!p-2 !pt-2 space-y-2">
        {/* Building Selector */}
        <fieldset className={spacing.spaceBetween.sm}>
          <Label htmlFor="building-selector">{t('buildingSelector.selectLabel')}</Label>

          {loading ? (
            <section className={`flex items-center ${spacing.gap.sm} text-muted-foreground`}>
              <Loader2 className={cn(iconSizes.sm, 'animate-spin')} />
              <span>{t('buildingSelector.loading')}</span>
            </section>
          ) : (
            <Select
              value={selectedBuildingId}
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
                {/* Option for no building - Radix requires non-empty value */}
                <SelectItem value="__none__">
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

        {/* 🏢 ENTERPRISE: Floor Selector (Phase 1.1) */}
        {selectedBuildingId && selectedBuildingId !== '__none__' && (
          <fieldset className={spacing.spaceBetween.sm}>
            <Label htmlFor="floor-selector">
              <NAVIGATION_ENTITIES.floor.icon className={cn(iconSizes.xs, NAVIGATION_ENTITIES.floor.color, 'inline mr-1')} />
              {t('buildingSelector.floorLabel', { defaultValue: 'Όροφος' })}
            </Label>

            {loadingFloors ? (
              <section className={`flex items-center ${spacing.gap.sm} text-muted-foreground`}>
                <Loader2 className={cn(iconSizes.sm, 'animate-spin')} />
                <span>{t('buildingSelector.loadingFloors', { defaultValue: 'Φόρτωση ορόφων...' })}</span>
              </section>
            ) : floors.length === 0 ? (
              <p className={cn('text-sm', colors.text.muted)}>
                {t('buildingSelector.noFloors', { defaultValue: 'Δεν βρέθηκαν όροφοι για αυτό το κτίριο' })}
              </p>
            ) : (
              <Select
                value={selectedFloorId}
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
                  {/* Option for no floor */}
                  <SelectItem value="__none__">
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
              disabled={saving || !hasChanges}
              variant={hasChanges ? 'default' : 'outline'}
              size="sm"
            >
              {saving ? (
                <>
                  <Loader2 className={cn(iconSizes.sm, spacing.margin.right.sm, 'animate-spin')} />
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
      </CardContent>
    </Card>
  );
}

export default BuildingSelectorCard;
