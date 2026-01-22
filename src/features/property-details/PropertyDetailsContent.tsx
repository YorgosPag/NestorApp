// 🌐 i18n: All labels converted to i18n keys - 2026-01-19
'use client';

import React from 'react';
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
import { BuildingSelectorCard } from './components/BuildingSelectorCard';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { useSpacingTokens } from '@/hooks/useSpacingTokens';

import { resolveAttachments } from './utils/attachments';
import { makeSafeUpdate } from './utils/safeUpdate';
import { useNotifications } from '@/providers/NotificationProvider';

export function PropertyDetailsContent({
  property,
  unit, // Support for UniversalTabsRenderer compatibility
  data, // Support for UniversalTabsRenderer compatibility
  onSelectFloor,
  onUpdateProperty,
  isReadOnly = false
}: Partial<PropertyDetailsContentProps> & {
  property?: ExtendedPropertyDetails & { buyerMismatch?: boolean };
  unit?: ExtendedPropertyDetails;
  data?: ExtendedPropertyDetails;
  onSelectFloor?: (floorId: string | null) => void;
  onUpdateProperty?: (propertyId: string, updates: Partial<Property>) => void;
  isReadOnly?: boolean;
}) {
  const { t } = useTranslation(['common', 'properties']);
  const notifications = useNotifications();
  const { quick } = useBorderTokens();
  const spacing = useSpacingTokens();

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
      />

      {/* 🏢 ENTERPRISE: Building Selector για σύνδεση Μονάδας→Κτιρίου */}
      {!isReadOnly && (
        <BuildingSelectorCard
          unitId={resolvedProperty.id}
          currentBuildingId={resolvedProperty.buildingId}
          isEditing={true}
          onBuildingChanged={(newBuildingId) => {
            console.log(`✅ Unit ${resolvedProperty.id} linked to building ${newBuildingId}`);
          }}
        />
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
