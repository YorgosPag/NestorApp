// 🌐 i18n: All labels converted to i18n keys - 2026-01-24
'use client';

/**
 * 🏢 ENTERPRISE: LinkedSpacesCard Component
 *
 * Επιτρέπει τη σύνδεση/αποσύνδεση Parking και Storage χώρων με μια μονάδα (unit).
 * Data fetching extracted to useLinkedSpacesData hook (ADR-065)
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
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useTypography } from '@/hooks/useTypography';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PROPERTY_CARD_COLORS } from './property-fields-constants';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { ALLOCATION_SPACE_TYPES, SPACE_INCLUSION_TYPES, SELECT_CLEAR_VALUE, isSelectClearValue } from '@/config/domain-constants';
import type { LinkedSpace } from '@/types/property';
import type { SpaceInclusionType } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';
import { updatePropertyLinkedSpacesWithPolicy } from '@/services/property/property-mutation-gateway';
import { useGuardedPropertyMutation } from '@/hooks/useGuardedPropertyMutation';
import { useNotifications } from '@/providers/NotificationProvider';
import { translatePropertyMutationError } from '@/services/property/property-mutation-feedback';
import { useLinkedSpacesData } from './useLinkedSpacesData';
import '@/lib/design-system';

const logger = createModuleLogger('LinkedSpacesCard');

// ============================================================================
// 🏢 ENTERPRISE: Type definitions (ZERO any)
// ============================================================================

interface LinkedSpacesCardProps {
  propertyId: string;
  buildingId?: string;
  currentLinkedSpaces?: LinkedSpace[];
  onLinkedSpacesChanged?: (newLinkedSpaces: LinkedSpace[]) => void;
  isEditing?: boolean;
}

// ============================================================================
// 🏢 ENTERPRISE: Component
// ============================================================================

export function LinkedSpacesCard({
  propertyId,
  buildingId,
  currentLinkedSpaces = [],
  onLinkedSpacesChanged,
  isEditing = true,
}: LinkedSpacesCardProps) {
  const { t } = useTranslation(['properties', 'properties-detail', 'properties-enums', 'properties-viewer']);
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  const spacing = useSpacingTokens();
  const typography = useTypography();
  const { error: notifyError } = useNotifications();
  const { checking: previewChecking, runPreviewedMutation, ImpactDialog } = useGuardedPropertyMutation({ id: propertyId });

  // 🏢 ENTERPRISE: Data loading (extracted hook)
  const {
    parkingOptions,
    storageOptions,
    occupiedSpaceIds,
    loadingParking,
    loadingStorage,
  } = useLinkedSpacesData(buildingId, propertyId);

  // 🏢 ENTERPRISE: Draft state - initialized ONCE from props
  const [draftLinkedSpaces, setDraftLinkedSpaces] = useState<LinkedSpace[]>(currentLinkedSpaces);
  const [selectedParkingId, setSelectedParkingId] = useState<string>(SELECT_CLEAR_VALUE);
  const [selectedStorageId, setSelectedStorageId] = useState<string>(SELECT_CLEAR_VALUE);
  const [selectedInclusion, setSelectedInclusion] = useState<SpaceInclusionType>('included');
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Reset draft when exiting edit mode (cancel policy)
  const prevIsEditingRef = React.useRef(isEditing);
  useEffect(() => {
    if (prevIsEditingRef.current && !isEditing) {
      setDraftLinkedSpaces(currentLinkedSpaces);
      setSelectedParkingId(SELECT_CLEAR_VALUE);
      setSelectedStorageId(SELECT_CLEAR_VALUE);
      setSelectedInclusion('included');
      setSaveStatus('idle');
    }
    prevIsEditingRef.current = isEditing;
  }, [isEditing, currentLinkedSpaces]);

  // Optimistic update + background save
  const persistLinkedSpaces = useCallback(async (
    newDraft: LinkedSpace[],
    rollback: LinkedSpace[],
  ) => {
    if (!propertyId) return;
    setSaving(true);
    try {
      const completed = await runPreviewedMutation({ linkedSpaces: newDraft }, async () => {
        await updatePropertyLinkedSpacesWithPolicy({
          propertyId,
          currentProperty: { buildingId },
          linkedSpaces: newDraft,
        });
        logger.info(`[LinkedSpacesCard] Saved ${newDraft.length} linked spaces`);
        setSaveStatus('success');
        onLinkedSpacesChanged?.(newDraft);
        setTimeout(() => setSaveStatus('idle'), 3000);
      });
      if (!completed) {
        setDraftLinkedSpaces(rollback);
      }
    } catch (error) {
      logger.error('[LinkedSpacesCard] Save failed — rolling back', { error });
      setDraftLinkedSpaces(rollback);
      setSaveStatus('error');
      notifyError(translatePropertyMutationError(error, t));
      setTimeout(() => setSaveStatus('idle'), 5000);
    } finally {
      setSaving(false);
    }
  }, [buildingId, notifyError, onLinkedSpacesChanged, propertyId, runPreviewedMutation, t]);

  const handleParkingSelected = useCallback((parkingId: string) => {
    if (!parkingId || isSelectClearValue(parkingId)) {
      setSelectedParkingId(SELECT_CLEAR_VALUE);
      return;
    }
    const parking = parkingOptions.find(p => p.id === parkingId);
    if (!parking || draftLinkedSpaces.some(ls => ls.spaceId === parkingId)) {
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
    const previous = draftLinkedSpaces;
    const updated = [...previous, newLinkedSpace];
    setDraftLinkedSpaces(updated);
    setSelectedParkingId(SELECT_CLEAR_VALUE);
    persistLinkedSpaces(updated, previous);
  }, [parkingOptions, draftLinkedSpaces, selectedInclusion, persistLinkedSpaces]);

  const handleStorageSelected = useCallback((storageId: string) => {
    if (!storageId || isSelectClearValue(storageId)) {
      setSelectedStorageId(SELECT_CLEAR_VALUE);
      return;
    }
    const storage = storageOptions.find(s => s.id === storageId);
    if (!storage || draftLinkedSpaces.some(ls => ls.spaceId === storageId)) {
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
    const previous = draftLinkedSpaces;
    const updated = [...previous, newLinkedSpace];
    setDraftLinkedSpaces(updated);
    setSelectedStorageId(SELECT_CLEAR_VALUE);
    persistLinkedSpaces(updated, previous);
  }, [storageOptions, draftLinkedSpaces, selectedInclusion, persistLinkedSpaces]);

  const handleRemoveSpace = useCallback((spaceId: string) => {
    const previous = draftLinkedSpaces;
    const updated = previous.filter(ls => ls.spaceId !== spaceId);
    setDraftLinkedSpaces(updated);
    persistLinkedSpaces(updated, previous);
  }, [draftLinkedSpaces, persistLinkedSpaces]);

  const getSpaceName = (space: LinkedSpace): string => {
    if (space.allocationCode) return space.allocationCode;
    if (space.spaceType === 'parking') {
      const parking = parkingOptions.find(p => p.id === space.spaceId);
      return parking?.number || space.spaceId;
    }
    const storage = storageOptions.find(s => s.id === space.spaceId);
    return storage?.name || space.spaceId;
  };

  const getInclusionLabel = (inclusion: SpaceInclusionType): string => {
    return t(`linkedSpaces.inclusion.${inclusion}`);
  };

  if (!buildingId) return null;

  return (
    <Card className={cn(quick.card, colors.bg.card)}>
      <CardHeader className="!p-2 flex flex-col space-y-2">
        <CardTitle className={cn('flex items-center', spacing.gap.sm, typography.card.titleCompact)}>
          <Package className={cn(iconSizes.md, PROPERTY_CARD_COLORS.linkedSpaces)} />
          {t('linkedSpaces.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="!p-2 !pt-2 space-y-3">
        {/* Currently linked spaces */}
        {draftLinkedSpaces.length > 0 && (
          <section className={spacing.spaceBetween.sm}>
            <Label className={cn("text-xs", colors.text.muted)}>
              {t('linkedSpaces.currentlyLinked')}
            </Label>
            <ul className={`flex flex-wrap ${spacing.gap.sm}`}>
              {draftLinkedSpaces.map((space) => (
                <li key={space.spaceId}>
                  <Badge variant="secondary" className={`flex items-center ${spacing.gap.sm} pr-1`}>
                    {space.spaceType === 'parking' ? (
                      <Car className={cn(iconSizes.xs, PROPERTY_CARD_COLORS.parking)} />
                    ) : (
                      <Package className={cn(iconSizes.xs, PROPERTY_CARD_COLORS.storage)} />
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
                        aria-label={t('linkedSpaces.remove')}
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

        {/* Add new spaces (edit mode only) */}
        {isEditing && (
          <>
            <fieldset className={spacing.spaceBetween.sm}>
              <Label htmlFor="inclusion-selector" className="text-xs">
                {t('linkedSpaces.inclusionLabel')}
              </Label>
              <Select value={selectedInclusion} onValueChange={(value: SpaceInclusionType) => setSelectedInclusion(value)}>
                <SelectTrigger id="inclusion-selector" size="sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={SPACE_INCLUSION_TYPES.INCLUDED}>{t('linkedSpaces.inclusion.included')}</SelectItem>
                  <SelectItem value={SPACE_INCLUSION_TYPES.OPTIONAL}>{t('linkedSpaces.inclusion.optional')}</SelectItem>
                  <SelectItem value={SPACE_INCLUSION_TYPES.RENTED}>{t('linkedSpaces.inclusion.rented')}</SelectItem>
                </SelectContent>
              </Select>
            </fieldset>

            {/* Parking selector */}
            <fieldset className={spacing.spaceBetween.sm}>
              <Label className="text-xs flex items-center gap-1">
                <Car className={cn(iconSizes.xs, PROPERTY_CARD_COLORS.parking)} />
                {t('linkedSpaces.addParking')}
              </Label>
              {loadingParking ? (
                <section className={cn(`flex items-center ${spacing.gap.sm} text-sm`, colors.text.muted)}>
                  <Spinner size="small" />
                  <span>{t('linkedSpaces.loadingParking')}</span>
                </section>
              ) : parkingOptions.length === 0 ? (
                <p className={cn('text-xs', colors.text.muted)}>{t('linkedSpaces.noParkingAvailable')}</p>
              ) : (
                <Select value={selectedParkingId} onValueChange={handleParkingSelected}>
                  <SelectTrigger size="sm"><SelectValue placeholder={t('linkedSpaces.selectParking')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SELECT_CLEAR_VALUE}>{t('linkedSpaces.selectParking')}</SelectItem>
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
                <Package className={cn(iconSizes.xs, PROPERTY_CARD_COLORS.storage)} />
                {t('linkedSpaces.addStorage')}
              </Label>
              {loadingStorage ? (
                <section className={cn(`flex items-center ${spacing.gap.sm} text-sm`, colors.text.muted)}>
                  <Spinner size="small" />
                  <span>{t('linkedSpaces.loadingStorage')}</span>
                </section>
              ) : storageOptions.length === 0 ? (
                <p className={cn('text-xs', colors.text.muted)}>{t('linkedSpaces.noStorageAvailable')}</p>
              ) : (
                <Select value={selectedStorageId} onValueChange={handleStorageSelected}>
                  <SelectTrigger size="sm"><SelectValue placeholder={t('linkedSpaces.selectStorage')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SELECT_CLEAR_VALUE}>{t('linkedSpaces.selectStorage')}</SelectItem>
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

            {/* Auto-save status */}
            {(saving || saveStatus !== 'idle') && (
              <footer className={`flex items-center ${spacing.gap.sm} ${spacing.padding.top.sm}`}>
                {(saving || previewChecking) && (
                  <span className={cn(`flex items-center ${spacing.gap.sm} text-sm`, colors.text.muted)}>
                    <Spinner size="small" />
                    {t('linkedSpaces.saving')}
                  </span>
                )}
                {saveStatus === 'success' && (
                  <span className={cn("flex items-center text-sm", spacing.gap.sm, colors.text.success)}>
                    <CheckCircle className={iconSizes.sm} />
                    {t('linkedSpaces.success')}
                  </span>
                )}
                {saveStatus === 'error' && (
                  <span className={cn("flex items-center text-sm", spacing.gap.sm, colors.text.error)}>
                    <AlertCircle className={iconSizes.sm} />
                    {t('linkedSpaces.error')}
                  </span>
                )}
              </footer>
            )}
          </>
        )}

        {/* Empty state */}
        {draftLinkedSpaces.length === 0 && !isEditing && (
          <p className={cn('text-sm', colors.text.muted)}>{t('linkedSpaces.noLinkedSpaces')}</p>
        )}
      </CardContent>
      {ImpactDialog}
    </Card>
  );
}

export default LinkedSpacesCard;
