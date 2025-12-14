'use client';

import React from 'react';
import type { Property } from '@/types/property-viewer';
import type { PropertyDetailsContentProps } from './types';

import { MultiLevelNavigation } from '@/components/property-viewer/details/MultiLevelNavigation';
import { PropertyMeta } from '@/components/property-viewer/details/PropertyMeta';
import { PropertyShareButton } from '@/components/ui/ShareButton';

import { ReadOnlyBanner } from './components/ReadOnlyBanner';
import { BuyerMismatchAlert } from './components/BuyerMismatchAlert';
import { UnifiedCustomerCard } from '@/components/shared/customer-info';
import { LimitedInfoNotice } from './components/LimitedInfoNotice';
import { AttachmentsBlock } from './components/AttachmentsBlock';
import { ContactsBlock } from './components/ContactsBlock';
import { DocumentsBlock } from './components/DocumentsBlock';
import { DatesBlock } from './components/DatesBlock';

import { resolveAttachments } from './utils/attachments';
import { makeSafeUpdate } from './utils/safeUpdate';
import { useNotifications } from '@/providers/NotificationProvider';

export function PropertyDetailsContent({
  property,
  onSelectFloor,
  onUpdateProperty,
  isReadOnly = false,
}: PropertyDetailsContentProps) {
  const notifications = useNotifications();
  const isMultiLevel = property.isMultiLevel || property.type === 'Μεζονέτα';

  // attachments (ίδια λογική με mock)
  const { storage: attachedStorage, parking: attachedParking } = resolveAttachments(property);

  // safe update (ίδια συμπεριφορά: no-op όταν read-only)
  const safeOnUpdateProperty = makeSafeUpdate(isReadOnly, onUpdateProperty);

  // Share handlers
  const handleShareSuccess = () => {
    notifications.success('✅ Η κοινοποίηση ολοκληρώθηκε επιτυχώς!');
  };

  const handleShareError = (errorMessage: string) => {
    notifications.error(`❌ Αποτυχία κοινοποίησης: ${errorMessage}`);
  };

  // === RENDER: ΑΠΑΡΑΛΛΑΚΤΟ DOM/Tailwind/labels ===
  return (
    <div className="space-y-4 p-1">
      {isReadOnly && <ReadOnlyBanner />}

      {property.buyerMismatch && !isReadOnly && <BuyerMismatchAlert />}

      {isMultiLevel && (
        <MultiLevelNavigation
          property={property}
          onSelectFloor={onSelectFloor}
          currentFloorId={property.floorId}
        />
      )}

      <PropertyMeta
        property={property}
        onUpdateProperty={safeOnUpdateProperty}
      />

      {/* Share Button - Always visible for easy sharing */}
      <div className="flex justify-end">
        <PropertyShareButton
          propertyId={property.id}
          propertyTitle={property.name}
          propertyDescription={property.description}
          propertyPrice={property.price}
          propertyArea={property.area}
          propertyLocation={`${property.building}, Όροφος ${property.floor}`}
          source="property_details"
          variant="outline"
          size="sm"
          onShareSuccess={handleShareSuccess}
          onShareError={handleShareError}
        />
      </div>

      {/* Customer Information Card - Centralized System */}
      {property.soldTo && !isReadOnly && (
        <UnifiedCustomerCard
          contactId={property.soldTo}
          context="unit"
          variant="compact"
          size="md"
          showUnitsCount={false}
          className="border-primary/20"
        />
      )}

      <AttachmentsBlock storage={attachedStorage} parking={attachedParking} />

      <ContactsBlock owner={property.owner} agent={property.agent} />

      {/* Hide sensitive documents in read-only mode */}
      {!isReadOnly && <DocumentsBlock documents={property.documents || []} />}

      <DatesBlock dates={property.dates} />

      {/* Show limited info message in read-only mode */}
      {isReadOnly && <LimitedInfoNotice />}
    </div>
  );
}
