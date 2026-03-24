// 🌐 i18n: All labels converted to i18n keys - 2026-01-19
'use client';

import React, { useState, useCallback, useEffect } from 'react';
import type { Property, ExtendedPropertyDetails } from '@/types/property-viewer';
import type { PropertyDetailsContentProps } from './types';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from 'react-i18next';

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
import { UnitFieldsBlock } from './components/UnitFieldsBlock';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { resolveAttachments } from './utils/attachments';
import { makeSafeUpdate } from './utils/safeUpdate';
import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('PropertyDetailsContent');

import { UnitEntityLinks } from './components/UnitEntityLinks';
import { LinkedSpacesCard } from './components/LinkedSpacesCard';
import { FloorSelectField } from '@/components/shared/FloorSelectField';
import type { FloorChangePayload } from '@/components/shared/FloorSelectField';
import { isMultiLevelCapableType } from '@/config/domain-constants';
import type { UnitLevel } from '@/types/unit';
import { deriveMultiLevelFields } from '@/services/multi-level.service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { cn } from '@/lib/utils';

export function PropertyDetailsContent({
  property,
  unit, // Support for UniversalTabsRenderer compatibility
  data, // Support for UniversalTabsRenderer compatibility
  onSelectFloor,
  onUpdateProperty,
  isReadOnly = false,
  // 🏢 ENTERPRISE: Edit mode props from parent (UnitsSidebar) - Pattern A
  isEditMode: externalEditMode,
  onToggleEditMode: externalToggleEditMode,
  onExitEditMode: externalExitEditMode,
  // 🏢 ENTERPRISE: Inline new unit creation props
  isCreatingNewUnit,
  onUnitCreated,
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
  onUnitCreated?: (unitId: string) => void;
}) {
  const { t } = useTranslation(['common', 'properties', 'units']);
  const { quick } = useBorderTokens();
  const spacing = useSpacingTokens();
  const iconSizes = useIconSizes();
  const typography = useTypography();

  // 🏢 ENTERPRISE: Edit mode - prefer external props (from UnitsSidebar), fallback to local state
  const [localEditMode, setLocalEditMode] = useState(false);

  // Use external edit mode if provided, otherwise local
  const isEditMode = externalEditMode !== undefined ? externalEditMode : localEditMode;

  // 🏢 ENTERPRISE: Toggle edit mode callback - use external if provided
  const handleToggleEditMode = useCallback(() => {
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

  // Type guard για buyerMismatch property
  const hasPropertyWithMismatch = (prop: unknown): prop is ExtendedPropertyDetails & { buyerMismatch: boolean } => {
    return typeof prop === 'object' && prop !== null && 'buyerMismatch' in prop;
  };

  // ADR-236: Determine if property is multi-level capable (SSoT detection)
  const effectiveType = localType || resolvedProperty.type;
  const isMultiLevel = resolvedProperty.isMultiLevel || isMultiLevelCapableType(effectiveType);
  const showMultiFloorSelector = isMultiLevelCapableType(effectiveType);

  // ADR-236: Shared active level state — synchronized between MultiLevelNavigation and LevelTabStrip
  const [activeLevelId, setActiveLevelId] = useState<string | null>(
    isMultiLevel && resolvedProperty.levels?.length
      ? resolvedProperty.levels[0].floorId
      : null
  );

  // attachments (ίδια λογική με mock)
  const { storage: attachedStorage, parking: attachedParking } = resolveAttachments(resolvedProperty);

  // safe update (ίδια συμπεριφορά: no-op όταν read-only)
  const baseSafeUpdate = makeSafeUpdate(isReadOnly, onUpdateProperty || (() => {}));

  // ADR-236: Intercept updates to track type changes locally for instant UI response
  const safeOnUpdateProperty = useCallback(
    (id: string, updates: Partial<Property>) => {
      if (updates.type && typeof updates.type === 'string') {
        setLocalType(updates.type);
      }
      baseSafeUpdate(id, updates);
    },
    [baseSafeUpdate]
  );

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
      {!isReadOnly && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <UnitEntityLinks
            unitId={resolvedProperty?.id ?? ''}
            currentBuildingId={resolvedProperty?.buildingId}
            isEditing={isEditMode && !isSoldOrRented}
          />
          {/* Floor card — only for single-floor types */}
          {!showMultiFloorSelector && (
            <Card>
              <CardHeader className="p-2">
                <CardTitle className={cn('flex items-center gap-2', typography.card.titleCompact)}>
                  <MapPin className={cn(iconSizes.md, 'text-emerald-500')} />
                  {t('units:fields.location.floor', { defaultValue: 'Όροφος' })}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2 pt-0">
                <FloorSelectField
                  buildingId={resolvedProperty?.buildingId ?? null}
                  value={resolvedProperty?.floorId ?? ''}
                  onChange={(v: string, payload?: FloorChangePayload) => {
                    if (safeOnUpdateProperty && resolvedProperty?.id) {
                      if (payload) {
                        safeOnUpdateProperty(resolvedProperty.id, {
                          floor: payload.floor,
                          floorId: payload.floorId,
                        });
                      } else {
                        safeOnUpdateProperty(resolvedProperty.id, { floor: 0, floorId: undefined });
                      }
                    }
                  }}
                  label={t('units:fields.location.floor', { defaultValue: 'Όροφος' })}
                  noBuildingHint={t('units:fields.location.noFloorHint', { defaultValue: 'Συνδέστε πρώτα κτίριο' })}
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
              onLevelsChange={(levels: UnitLevel[]) => {
                if (safeOnUpdateProperty && resolvedProperty?.id) {
                  const derived = deriveMultiLevelFields(levels);
                  safeOnUpdateProperty(resolvedProperty.id, {
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
              unitId={resolvedProperty.id ?? ''}
              buildingId={resolvedProperty.buildingId}
              currentLinkedSpaces={resolvedProperty.linkedSpaces ?? []}
              isEditing={isEditMode && !isSoldOrRented}
            />
          )}
        </div>
      )}

      {/* 🏢 ENTERPRISE: Unit Fields Block (identity, location, layout, areas, etc) */}
      <UnitFieldsBlock
        property={resolvedProperty}
        onUpdateProperty={safeOnUpdateProperty}
        isReadOnly={isReadOnly}
        isEditMode={isEditMode}
        onExitEditMode={handleExitEditMode}
        isCreatingNewUnit={isCreatingNewUnit}
        onUnitCreated={onUnitCreated}
        activeLevelId={activeLevelId}
        onActiveLevelChange={setActiveLevelId}
      />

      {/* Share Button removed per user request */}

      {/* Customer Information Card - Centralized System */}
      {resolvedProperty.soldTo && !isReadOnly && (
        <UnifiedCustomerCard
          contactId={resolvedProperty.soldTo}
          context="unit"
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
    </div>
  );
}
