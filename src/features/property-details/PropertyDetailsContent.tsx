// 🌐 i18n: All labels converted to i18n keys - 2026-01-19
'use client';

import React, { useState, useCallback, useEffect } from 'react';
import type { Property, ExtendedPropertyDetails } from '@/types/property-viewer';
import type { PropertyDetailsContentProps } from './types';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

import { MultiLevelNavigation } from '@/components/property-viewer/details/MultiLevelNavigation';

import { ReadOnlyBanner } from './components/ReadOnlyBanner';
import { BuyerMismatchAlert } from './components/BuyerMismatchAlert';
import { UnifiedCustomerCard } from '@/components/shared/customer-info';
import { LimitedInfoNotice } from './components/LimitedInfoNotice';
import { PropertyQuickView } from '@/features/property-hover/components/PropertyQuickView';
import { AttachmentsBlock } from './components/AttachmentsBlock';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { ContactsBlock } from './components/ContactsBlock';
import { DocumentsBlock } from './components/DocumentsBlock';
import { DatesBlock } from './components/DatesBlock';
import { PropertyFieldsBlock } from './components/PropertyFieldsBlock';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { resolveAttachments } from './utils/attachments';
import { createModuleLogger } from '@/lib/telemetry';
import { updatePropertyBuildingLinkWithPolicy } from '@/services/property/property-mutation-gateway';
const logger = createModuleLogger('PropertyDetailsContent');

import { PropertyEntityLinks } from './components/PropertyEntityLinks';
import { LinkedSpacesCard } from './components/LinkedSpacesCard';
import { FloorSelectField } from '@/components/shared/FloorSelectField';
import type { FloorChangePayload } from '@/components/shared/FloorSelectField';
import { isMultiLevelCapableType } from '@/config/domain-constants';
import { useAutoLevelCreation } from './hooks/useAutoLevelCreation';
import { isStandaloneUnitType } from '@/hooks/properties/usePropertyCreateValidation';
import type { PropertyLevel } from '@/types/property';
import { deriveMultiLevelFields } from '@/services/multi-level.service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { cn } from '@/lib/utils';
import { useGuardedPropertyMutation } from '@/hooks/useGuardedPropertyMutation';
import { useNotifications } from '@/providers/NotificationProvider';
import { translatePropertyMutationError } from '@/services/property/property-mutation-feedback';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { evaluateFloorTypeCompatibility } from '@/services/property/property-field-rules';
import { PROPERTY_CARD_COLORS } from './components/property-fields-constants';
import '@/lib/design-system';

export function PropertyDetailsContent({
  property,
  unit, // Support for UniversalTabsRenderer compatibility
  data, // Support for UniversalTabsRenderer compatibility
  onSelectFloor,
  isReadOnly = false,
  // 🏢 ENTERPRISE: Edit mode props from parent (UnitsSidebar) - Pattern A
  isEditMode: externalEditMode,
  onToggleEditMode: externalToggleEditMode,
  onExitEditMode: externalExitEditMode,
  // 🏢 ENTERPRISE: Inline new unit creation props
  isCreatingNewUnit,
  onPropertyCreated,
}: Partial<PropertyDetailsContentProps> & {
  property?: ExtendedPropertyDetails & { buyerMismatch?: boolean };
  unit?: ExtendedPropertyDetails;
  data?: ExtendedPropertyDetails;
  onSelectFloor?: (floorId: string | null) => void;
  onUpdateProperty?: (propertyId: string, updates: Partial<Property>) => void;
  isReadOnly?: boolean;
  // 🏢 ENTERPRISE: Edit mode props from parent
  isEditMode?: boolean;
  onToggleEditMode?: () => void;
  onExitEditMode?: () => void;
  // 🏢 ENTERPRISE: Inline new unit creation
  isCreatingNewUnit?: boolean;
  onPropertyCreated?: (propertyId: string) => void;
}) {
  const { t } = useTranslation(['common', 'properties']);
  const { quick } = useBorderTokens();
  const spacing = useSpacingTokens();
  const iconSizes = useIconSizes();
  const typography = useTypography();
  const { error: notifyError } = useNotifications();
  const { confirm: confirmWarning, dialogProps: floorWarningDialogProps } = useConfirmDialog();

  // 🏢 ENTERPRISE: Edit mode - prefer external props (from UnitsSidebar), fallback to local state
  const [localEditMode, setLocalEditMode] = useState(false);

  // Use external edit mode if provided, otherwise local
  const isEditMode = externalEditMode !== undefined ? externalEditMode : localEditMode;

  // 🏢 ENTERPRISE: Toggle edit mode callback - use external if provided
  const _handleToggleEditMode = useCallback(() => {
    if (externalToggleEditMode) {
      externalToggleEditMode();
    } else {
      setLocalEditMode(prev => !prev);
    }
  }, [externalToggleEditMode]);

  // 🏢 ENTERPRISE: Exit edit mode callback (for save/cancel)
  const handleExitEditMode = useCallback(() => {
    if (externalExitEditMode) {
      externalExitEditMode();
    } else {
      setLocalEditMode(false);
    }
  }, [externalExitEditMode]);

  // Resolve the actual property from all possible sources (enterprise pattern)
  const resolvedProperty = property || unit || data;

  // ── Field locking: sold/rented units cannot change building, floor, linked spaces ──
  const commercialStatus = resolvedProperty?.commercialStatus ?? 'unavailable';
  const isSoldOrRented = commercialStatus === 'sold' || commercialStatus === 'rented';

  // ADR-236: Track type locally so multi-floor selector responds instantly to type changes
  // (property prop updates async via Firestore, but we need immediate UI response)
  const [localType, setLocalType] = useState(resolvedProperty?.type ?? '');
  useEffect(() => {
    if (resolvedProperty?.type) setLocalType(resolvedProperty.type);
  }, [resolvedProperty?.type]);

  // Early return if no property data available
  if (!resolvedProperty) {
    logger.warn('PropertyDetailsContent: No property data provided');
    return null;
  }

  const {
    runExistingPropertyUpdate,
    runPreviewedMutation,
    ImpactDialog,
  } = useGuardedPropertyMutation(resolvedProperty);

  // Type guard για buyerMismatch property
  const hasPropertyWithMismatch = (prop: unknown): prop is ExtendedPropertyDetails & { buyerMismatch: boolean } => {
    return typeof prop === 'object' && prop !== null && 'buyerMismatch' in prop;
  };

  // ADR-236: Determine if property is multi-level capable (SSoT detection)
  const effectiveType = localType || resolvedProperty.type;
  const isMultiLevel = resolvedProperty.isMultiLevel || isMultiLevelCapableType(effectiveType);
  const showMultiFloorSelector = isMultiLevelCapableType(effectiveType);
  // ADR-284 Family B: Standalone units (villa, detached_house) have no building/floor parent.
  const isStandalone = isStandaloneUnitType(effectiveType as import('@/types/property').PropertyType | '');

  // ADR-236: Shared active level state — synchronized between MultiLevelNavigation and LevelTabStrip
  const [activeLevelId, setActiveLevelId] = useState<string | null>(
    isMultiLevel && resolvedProperty.levels?.length
      ? resolvedProperty.levels[0].floorId
      : null
  );

  // attachments (ίδια λογική με mock)
  const { storage: attachedStorage, parking: attachedParking } = resolveAttachments(resolvedProperty);

  // safe update (ίδια συμπεριφορά: no-op όταν read-only)
  const baseSafeUpdate = useCallback(
    async (_propertyId: string, updates: Partial<Property>) => {
      if (isReadOnly) {
        return;
      }

      await runExistingPropertyUpdate(resolvedProperty, updates);
    },
    [isReadOnly, resolvedProperty, runExistingPropertyUpdate]
  );

  // ADR-236 Phase 4: Auto-create levels when type changes to multi-level capable
  const autoLevel = useAutoLevelCreation({
    buildingId: resolvedProperty.buildingId ?? null,
    currentFloorId: resolvedProperty.floorId ?? null,
    currentFloorNumber: resolvedProperty.floor ?? null,
    hasExistingLevels: (resolvedProperty.levels?.length ?? 0) >= 2,
    onUpdateProperty: (updates) => {
      if (resolvedProperty.id) {
        void baseSafeUpdate(resolvedProperty.id, updates);
      }
    },
  });

  // ADR-236: Intercept updates to track type changes locally for instant UI response
  const safeOnUpdateProperty = useCallback(
    async (id: string, updates: Partial<Property>) => {
      if (updates.type && typeof updates.type === 'string') {
        setLocalType(updates.type);
        // ADR-236 Phase 4: Trigger auto-level creation on type change
        autoLevel.triggerAutoLevelCreation(updates.type);
      }
      try {
        await baseSafeUpdate(id, updates);
      } catch (error) {
        notifyError(translatePropertyMutationError(error, t));
      }
    },
    [autoLevel, baseSafeUpdate, notifyError, t]
  );

  // 🏢 ENTERPRISE: Contextual floor validation (Google Contacts pattern)
  // Warns when user places a residential unit in a basement — non-blocking, user decides.
  const handleFloorBeforeChange = useCallback(async (floor: number): Promise<boolean> => {
    const warning = evaluateFloorTypeCompatibility(floor, effectiveType);
    if (!warning) return true;

    return confirmWarning({
      title: t(`properties:${warning.titleKey}`),
      description: t(`properties:${warning.descriptionKey}`),
      variant: 'warning',
      confirmText: t('properties:fieldWarnings.confirm'),
      cancelText: t('properties:fieldWarnings.cancel'),
    });
  }, [confirmWarning, effectiveType, t]);

  const handleBuildingLinkChange = useCallback(async (newBuildingId: string | null) => {
    const nextBuildingId = newBuildingId ?? null;
    const nextFloorId = nextBuildingId === (resolvedProperty.buildingId ?? null)
      ? (resolvedProperty.floorId ?? null)
      : null;

    // ADR-233: Clear entity code when building is disconnected (code depends on building)
    const shouldClearCode = !nextBuildingId && !!resolvedProperty.code;

    try {
      const completed = await runPreviewedMutation(
        {
          buildingId: nextBuildingId,
          floorId: nextFloorId,
          ...(shouldClearCode ? { code: '' } : {}),
        },
        async () => {
          await updatePropertyBuildingLinkWithPolicy({
            propertyId: resolvedProperty.id,
            currentProperty: resolvedProperty,
            buildingId: nextBuildingId,
            floorId: nextFloorId,
            clearCode: shouldClearCode,
          });
        },
      );

      return completed
        ? { success: true }
        : { success: false, error: t('entityLinks.error') };
    } catch (error) {
      const translatedError = translatePropertyMutationError(error, t);
      notifyError(translatedError);
      return {
        success: false,
        error: translatedError,
      };
    }
  }, [notifyError, resolvedProperty, runPreviewedMutation, t]);

  // === RENDER: ΑΠΑΡΑΛΛΑΚΤΟ DOM/Tailwind/labels ===
  // 🏢 ADR-258D: Read-only mode uses PropertyQuickView (shared SSoT with Γρήγορη Προβολή)
  if (isReadOnly) {
    return (
      <div className="flex flex-col p-2 h-full">
        <div className="flex-1">
          <PropertyQuickView property={resolvedProperty} />
        </div>
        <div className="shrink-0 pt-1">
          <LimitedInfoNotice />
        </div>
      </div>
    );
  }

  // 🏢 ENTERPRISE: Internal padding (8px) - parent CardContent has p-0 for scrollbar alignment
  return (
    <div className={`flex flex-col ${spacing.spaceBetween.sm} ${spacing.padding.sm} h-full`}>
      {isReadOnly && <ReadOnlyBanner />}

      {hasPropertyWithMismatch(resolvedProperty) && resolvedProperty.buyerMismatch && !isReadOnly && <BuyerMismatchAlert />}

      {/* Building Link + Floor/MultiLevel + Linked Spaces — top row */}
      {/* ADR-284 Batch 7: Hidden when creating new unit — NewUnitHierarchySection handles Project/Building/Floor selection */}
      {/* ADR-284 Family B: Hidden for standalone units (villa, detached_house) — direct Project parent, no Building/Floor */}
      {!isReadOnly && !isCreatingNewUnit && !isStandalone && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <PropertyEntityLinks
            propertyId={resolvedProperty?.id ?? ''}
            currentBuildingId={resolvedProperty?.buildingId}
            isEditing={isEditMode && !isSoldOrRented}
            onBuildingLinkChange={handleBuildingLinkChange}
          />
          {/* Floor card — only for single-floor types */}
          {!showMultiFloorSelector && (
            <Card>
              <CardHeader className="p-2">
                <CardTitle className={cn('flex items-center gap-2', typography.card.titleCompact)}>
                  <MapPin className={cn(iconSizes.md, PROPERTY_CARD_COLORS.floor)} />
                  {t('properties:fields.location.floor')}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2 pt-0">
                <FloorSelectField
                  buildingId={resolvedProperty?.buildingId ?? null}
                  value={resolvedProperty?.floorId ?? ''}
                  onBeforeChange={handleFloorBeforeChange}
                  onChange={(v: string, payload?: FloorChangePayload) => {
                    if (safeOnUpdateProperty && resolvedProperty?.id) {
                      if (payload) {
                        void safeOnUpdateProperty(resolvedProperty.id, {
                          floor: payload.floor,
                          floorId: payload.floorId,
                        });
                      } else {
                        void safeOnUpdateProperty(resolvedProperty.id, { floor: 0, floorId: undefined });
                      }
                    }
                  }}
                  label={t('properties:fields.location.floor')}
                  noBuildingHint={t('properties:fields.location.noFloorHint')}
                  disabled={!isEditMode || isSoldOrRented}
                />
              </CardContent>
            </Card>
          )}
          {/* ADR-236: Multi-level floors — same position as single-floor card */}
          {showMultiFloorSelector && (
            <MultiLevelNavigation
              property={resolvedProperty}
              onSelectFloor={onSelectFloor || (() => {})}
              currentFloorId={resolvedProperty.floorId}
              activeLevelId={activeLevelId}
              onActiveLevelChange={setActiveLevelId}
              isEditing={isEditMode && !isSoldOrRented}
              buildingId={resolvedProperty?.buildingId}
              onLevelsChange={(levels: PropertyLevel[]) => {
                if (safeOnUpdateProperty && resolvedProperty?.id) {
                  const derived = deriveMultiLevelFields(levels);
                  void safeOnUpdateProperty(resolvedProperty.id, {
                    levels: derived.levels,
                    isMultiLevel: derived.isMultiLevel,
                    floor: derived.floor,
                    floorId: derived.floorId,
                  });
                }
              }}
            />
          )}
          {resolvedProperty?.buildingId && (
            <LinkedSpacesCard
              key={resolvedProperty.id}
              propertyId={resolvedProperty.id ?? ''}
              buildingId={resolvedProperty.buildingId}
              currentLinkedSpaces={resolvedProperty.linkedSpaces ?? []}
              isEditing={isEditMode && !isSoldOrRented}
            />
          )}
        </div>
      )}

      {/* 🏢 ENTERPRISE: Property Fields Block (identity, location, layout, areas, etc) */}
      <PropertyFieldsBlock
        property={resolvedProperty}
        isReadOnly={isReadOnly}
        isEditMode={isEditMode}
        onExitEditMode={handleExitEditMode}
        isCreatingNewUnit={isCreatingNewUnit}
        onPropertyCreated={onPropertyCreated}
        activeLevelId={activeLevelId}
        onActiveLevelChange={setActiveLevelId}
        onAutoSaveFields={(fields) => {
          if (safeOnUpdateProperty && resolvedProperty?.id) {
            void safeOnUpdateProperty(resolvedProperty.id, fields);
          }
        }}
      />

      {/* Share Button removed per user request */}

      {/* Customer Information Card - Centralized System */}
      {resolvedProperty.soldTo && !isReadOnly && (
        <UnifiedCustomerCard
          contactId={resolvedProperty.soldTo}
          context="property"
          variant="compact"
          size="md"
          showUnitsCount={false}
          className={quick.input}
        />
      )}

      <AttachmentsBlock storage={attachedStorage} parking={attachedParking} />

      {/* ADR-199: LinkedSpacesCard moved to top-row grid (next to building link + floor) */}

      <ContactsBlock owner={resolvedProperty.owner} agent={resolvedProperty.agent} />

      {/* Hide sensitive documents in read-only mode */}
      {!isReadOnly && <DocumentsBlock documents={resolvedProperty.documents || []} />}

      <DatesBlock dates={resolvedProperty.dates} />

      {/* Show limited info message in read-only mode — pushed to bottom via flex spacer */}
      {isReadOnly && (
        <>
          <div className="flex-1" />
          <LimitedInfoNotice />
        </>
      )}
      {ImpactDialog}
      <ConfirmDialog {...floorWarningDialogProps} />

      {/* ADR-236 Phase 4: Auto-level creation dialogs */}
      {autoLevel.dialogState.type === 'warning' && (
        <ConfirmDialog
          open
          onOpenChange={(open) => { if (!open) autoLevel.handleDialogDismiss(); }}
          title={t('properties:multiLevel.noNextFloor.title')}
          description={t('properties:multiLevel.noNextFloor.description')}
          variant="warning"
          confirmText={t('common:deletionGuard.understood')}
          onConfirm={autoLevel.handleDialogConfirm}
        />
      )}
      {autoLevel.dialogState.type === 'confirm' && (
        <ConfirmDialog
          open
          onOpenChange={(open) => { if (!open) autoLevel.handleDialogDismiss(); }}
          title={t('properties:multiLevel.optionalConfirm.title')}
          description={t('properties:multiLevel.optionalConfirm.description')}
          variant="default"
          confirmText={t('properties:multiLevel.optionalConfirm.yes')}
          cancelText={t('properties:multiLevel.optionalConfirm.no')}
          onConfirm={autoLevel.handleDialogConfirm}
        />
      )}
    </div>
  );
}
