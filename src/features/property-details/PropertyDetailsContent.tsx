// 🌐 i18n: All labels converted to i18n keys - 2026-01-19
'use client';

import React, { useState, useCallback } from 'react';
import type { Property, ExtendedPropertyDetails } from '@/types/property-viewer';
import type { PropertyDetailsContentProps } from './types';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from 'react-i18next';

import { MultiLevelNavigation } from '@/components/property-viewer/details/MultiLevelNavigation';
import { PropertyMeta } from '@/components/property-viewer/details/PropertyMeta';
import { PropertyShareButton } from '@/components/ui/ShareButton';

import { ReadOnlyBanner } from './components/ReadOnlyBanner';
import { BuyerMismatchAlert } from './components/BuyerMismatchAlert';
import { UnifiedCustomerCard } from '@/components/shared/customer-info';
import { LimitedInfoNotice } from './components/LimitedInfoNotice';
import { AttachmentsBlock } from './components/AttachmentsBlock';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { ContactsBlock } from './components/ContactsBlock';
import { DocumentsBlock } from './components/DocumentsBlock';
import { DatesBlock } from './components/DatesBlock';
import { UnitFieldsBlock } from './components/UnitFieldsBlock';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
// 🏢 ENTERPRISE: Centralized feature flags
import { isAppFeatureEnabled } from '@/config/feature-flags';

import { resolveAttachments } from './utils/attachments';
import { makeSafeUpdate } from './utils/safeUpdate';
import { useNotifications } from '@/providers/NotificationProvider';

// 🏢 ENTERPRISE: Lazy imports for Unit Linking (behind feature flag)
// These are only loaded when UNIT_LINKING feature is enabled
const BuildingSelectorCard = isAppFeatureEnabled('UNIT_LINKING')
  ? require('./components/BuildingSelectorCard').BuildingSelectorCard
  : null;
const LinkedSpacesCard = isAppFeatureEnabled('UNIT_LINKING')
  ? require('./components/LinkedSpacesCard').LinkedSpacesCard
  : null;

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
}) {
  const { t } = useTranslation(['common', 'properties']);
  const notifications = useNotifications();
  const { quick } = useBorderTokens();
  const spacing = useSpacingTokens();

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

  // Early return if no property data available
  if (!resolvedProperty) {
    console.warn('PropertyDetailsContent: No property data provided');
    return null;
  }

  // Type guard για buyerMismatch property
  const hasPropertyWithMismatch = (prop: unknown): prop is ExtendedPropertyDetails & { buyerMismatch: boolean } => {
    return typeof prop === 'object' && prop !== null && 'buyerMismatch' in prop;
  };

  // Determine if property is multi-level based on type
  const isMultiLevel = resolvedProperty.type === 'Μεζονέτα';

  // attachments (ίδια λογική με mock)
  const { storage: attachedStorage, parking: attachedParking } = resolveAttachments(resolvedProperty);

  // safe update (ίδια συμπεριφορά: no-op όταν read-only)
  const safeOnUpdateProperty = makeSafeUpdate(isReadOnly, onUpdateProperty || (() => {}));

  // Share handlers - 🏢 ENTERPRISE: i18n-enabled notifications
  const handleShareSuccess = () => {
    notifications.success(`✅ ${t('share.shareSuccess', { ns: 'common' })}`);
  };

  const handleShareError = (errorMessage: string) => {
    notifications.error(`❌ ${t('share.shareErrorSimple', { ns: 'common', error: errorMessage })}`);
  };

  // === RENDER: ΑΠΑΡΑΛΛΑΚΤΟ DOM/Tailwind/labels ===
  // 🏢 ENTERPRISE: Internal padding (8px) - parent CardContent has p-0 for scrollbar alignment
  return (
    <div className={`${spacing.spaceBetween.sm} ${spacing.padding.sm}`}>
      {isReadOnly && <ReadOnlyBanner />}

      {hasPropertyWithMismatch(resolvedProperty) && resolvedProperty.buyerMismatch && !isReadOnly && <BuyerMismatchAlert />}

      {isMultiLevel && (
        <MultiLevelNavigation
          property={resolvedProperty}
          onSelectFloor={onSelectFloor || (() => {})}
          currentFloorId={resolvedProperty.floorId}
        />
      )}

      <PropertyMeta
        property={resolvedProperty}
        onUpdateProperty={safeOnUpdateProperty}
        isEditMode={isEditMode}
        onToggleEditMode={handleToggleEditMode}
        // TODO: onNavigateToFloorPlan - implement when Floor Plan tab navigation is ready
      />

      {/* 🏢 ENTERPRISE: Unit Fields Block (bedrooms, bathrooms, orientations, etc) */}
      <UnitFieldsBlock
        property={resolvedProperty}
        onUpdateProperty={safeOnUpdateProperty}
        isReadOnly={isReadOnly}
        isEditMode={isEditMode}
        onExitEditMode={handleExitEditMode}
      />

      {/* 🏢 ENTERPRISE: Unit Linking Section (Building, Floor, Parking, Storage) */}
      {/* 🚫 FEATURE FLAG: UNIT_LINKING - Currently DISABLED */}
      {/* Root Cause: State mirroring anti-pattern causing ref attach/detach loop */}
      {/* Fix Required: Convert to fully controlled components (ΒΗΜΑ 2) */}
      {/* See: src/config/feature-flags.ts for details */}
      {isAppFeatureEnabled('UNIT_LINKING') && !isReadOnly && isEditMode && BuildingSelectorCard && (
        <>
          <BuildingSelectorCard
            unitId={resolvedProperty?.id ?? ''}
            currentBuildingId={resolvedProperty?.buildingId}
            currentFloorId={resolvedProperty?.floorId}
            isEditing
            onBuildingChanged={(newBuildingId: string, newFloorId?: string) => {
              if (onUpdateProperty && resolvedProperty?.id) {
                const updates: Partial<Property> = { buildingId: newBuildingId };
                if (newFloorId) {
                  updates.floorId = newFloorId;
                }
                onUpdateProperty(resolvedProperty.id, updates);
              }
            }}
          />

          {resolvedProperty?.buildingId && LinkedSpacesCard && (
            <LinkedSpacesCard
              unitId={resolvedProperty?.id ?? ''}
              buildingId={resolvedProperty.buildingId}
              currentLinkedSpaces={resolvedProperty?.linkedSpaces}
              isEditing
              onLinkedSpacesChanged={(newLinkedSpaces: Property['linkedSpaces']) => {
                if (onUpdateProperty && resolvedProperty?.id) {
                  onUpdateProperty(resolvedProperty.id, { linkedSpaces: newLinkedSpaces });
                }
              }}
            />
          )}
        </>
      )}

      {/* Share Button - Always visible for easy sharing */}
      <div className="flex justify-end">
        <PropertyShareButton
          propertyId={resolvedProperty.id}
          propertyTitle={resolvedProperty.name}
          propertyDescription={resolvedProperty.description}
          propertyPrice={resolvedProperty.price}
          propertyArea={resolvedProperty.area}
          propertyLocation={`${resolvedProperty.building}, ${t('viewer.info.floor', { ns: 'properties' })} ${resolvedProperty.floor}`}
          source="property_details"
          variant="outline"
          size="sm"
          onShareSuccess={handleShareSuccess}
          onShareError={handleShareError}
        />
      </div>

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

      <ContactsBlock owner={resolvedProperty.owner} agent={resolvedProperty.agent} />

      {/* Hide sensitive documents in read-only mode */}
      {!isReadOnly && <DocumentsBlock documents={resolvedProperty.documents || []} />}

      <DatesBlock dates={resolvedProperty.dates} />

      {/* Show limited info message in read-only mode */}
      {isReadOnly && <LimitedInfoNotice />}
    </div>
  );
}
