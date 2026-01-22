// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
'use client';

/**
 * 🏢 ENTERPRISE: BuildingSelectorCard Component
 *
 * Επιτρέπει τη σύνδεση μιας μονάδας (unit) με ένα κτίριο (building).
 * Ακολουθεί το ίδιο pattern με το ProjectSelectorCard.
 *
 * @author Claude AI Assistant
 * @created 2026-01-07
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

interface BuildingSelectorCardProps {
  /** Unit ID για update */
  unitId: string;
  /** Τρέχον buildingId (αν υπάρχει) */
  currentBuildingId?: string;
  /** Callback μετά από επιτυχές update */
  onBuildingChanged?: (newBuildingId: string) => void;
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
  onBuildingChanged,
  isEditing = true,
}: BuildingSelectorCardProps) {
  // 🏢 ENTERPRISE: Centralized hooks (ZERO inline styles)
  const { t } = useTranslation('units');
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const spacing = useSpacingTokens();

  // 🏢 ENTERPRISE: State management
  const [buildings, setBuildings] = useState<BuildingOption[]>([]);
  // 🏢 ENTERPRISE: Initialize with '__none__' if no building (Radix requires non-empty value)
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>(currentBuildingId || '__none__');
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

  // 🏢 ENTERPRISE: Handle building selection
  const handleBuildingChange = useCallback((value: string) => {
    setSelectedBuildingId(value);
    setSaveStatus('idle');
  }, []);

  // 🏢 ENTERPRISE: Save to Firestore
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

      await updateDoc(unitRef, {
        buildingId: buildingIdToSave,
        updatedAt: new Date().toISOString(),
      });

      console.log(`✅ [BuildingSelectorCard] Unit ${unitId} linked to building ${buildingIdToSave}`);
      setSaveStatus('success');

      // 🏢 ENTERPRISE: Dispatch real-time event for Navigation updates
      RealtimeService.dispatchUnitBuildingLinked({
        unitId,
        previousBuildingId: currentBuildingId || null,
        newBuildingId: buildingIdToSave,
        timestamp: Date.now(),
      });

      if (onBuildingChanged && buildingIdToSave) {
        onBuildingChanged(buildingIdToSave);
      }

      // Reset success status after 3 seconds
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      console.error('❌ [BuildingSelectorCard] Error saving:', error);
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  }, [unitId, selectedBuildingId, currentBuildingId, onBuildingChanged]);

  // 🏢 ENTERPRISE: Check if value changed (using '__none__' for empty values)
  const hasChanges = selectedBuildingId !== (currentBuildingId || '__none__');

  // 🏢 ENTERPRISE: Get current building name for display
  const currentBuildingName = buildings.find(b => b.id === currentBuildingId)?.name;

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

        {/* Current building info (when not editing) */}
        {!isEditing && currentBuildingName && (
          <p className={cn('text-sm', colors.text.muted)}>
            {t('buildingSelector.currentBuilding')}: <strong>{currentBuildingName}</strong>
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
