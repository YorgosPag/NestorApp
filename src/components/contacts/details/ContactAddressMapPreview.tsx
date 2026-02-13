'use client';

import { useMemo, useRef } from 'react';
import { AddressMap } from '@/components/shared/addresses/AddressMap';
import { AddressUtils } from '@/config/address-config';
import { createProjectAddress } from '@/types/project/address-helpers';
import type { ProjectAddress } from '@/types/project/addresses';

interface ContactAddressMapPreviewProps {
  contactId?: string;
  street?: string;
  streetNumber?: string;
  city?: string;
  postalCode?: string;
}

export function ContactAddressMapPreview({
  contactId,
  street,
  streetNumber,
  city,
  postalCode,
}: ContactAddressMapPreviewProps) {
  const fallbackAddressIdRef = useRef<string>(AddressUtils.generateAddressId());

  const addresses = useMemo<ProjectAddress[]>(() => {
    const trimmedStreet = (street ?? '').trim();
    const trimmedCity = (city ?? '').trim();
    const trimmedStreetNumber = (streetNumber ?? '').trim();
    const trimmedPostalCode = (postalCode ?? '').trim();

    if (!trimmedStreet || !trimmedCity) {
      return [];
    }

    const defaults = AddressUtils.getNewAddressDefaults();

    return [
      createProjectAddress({
        ...defaults,
        id: contactId || fallbackAddressIdRef.current,
        street: trimmedStreet,
        city: trimmedCity,
        number: trimmedStreetNumber || undefined,
        postalCode: trimmedPostalCode,
        isPrimary: true,
      }),
    ];
  }, [city, contactId, postalCode, street, streetNumber]);

  if (addresses.length === 0) {
    return null;
  }

  return (
    <AddressMap
      addresses={addresses}
      highlightPrimary
      showGeocodingStatus
      enableClickToFocus
    />
  );
}

export default ContactAddressMapPreview;
