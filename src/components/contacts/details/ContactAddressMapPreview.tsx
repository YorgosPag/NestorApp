'use client';

import { useMemo, useRef } from 'react';
import { AddressMap } from '@/components/shared/addresses/AddressMap';
import { AddressUtils } from '@/config/address-config';
import { createProjectAddress } from '@/types/project/address-helpers';
import type { ProjectAddress, ProjectAddressType, PartialProjectAddress } from '@/types/project/addresses';
import type { CompanyAddress } from '@/types/ContactFormTypes';

/** Address data returned by draggable pin reverse geocoding */
export interface DragResolvedAddress {
  street: string;
  number: string;
  postalCode: string;
  city: string;
  neighborhood: string;
  region: string;
}

interface ContactAddressMapPreviewProps {
  contactId?: string;
  street?: string;
  streetNumber?: string;
  city?: string;
  postalCode?: string;
  /** Municipality name for geocoding disambiguation */
  municipality?: string;
  /** Regional unit name for geocoding disambiguation */
  regionalUnit?: string;
  /** Region name for geocoding disambiguation */
  region?: string;
  /** Multi-address array for company contacts (HQ + branches) */
  companyAddresses?: CompanyAddress[];
  /** Map height preset override */
  heightPreset?: 'viewerCompact' | 'viewerStandard' | 'viewerExpanded' | 'viewerFullscreen';
  /** Enable draggable pin for address selection (edit mode) */
  draggable?: boolean;
  /** Callback when user drags pin — provides resolved address data + address index */
  onDragResolve?: (address: DragResolvedAddress, addressIndex: number) => void;
  /** Additional CSS classes for map container */
  className?: string;
}

/** Map CompanyAddress type to ProjectAddressType with correct labels */
const COMPANY_TYPE_MAP: Record<CompanyAddress['type'], ProjectAddressType> = {
  headquarters: 'legal',
  branch: 'postal',
};

export function ContactAddressMapPreview({
  contactId,
  street,
  streetNumber,
  city,
  postalCode,
  municipality,
  regionalUnit,
  region,
  companyAddresses,
  heightPreset,
  draggable = false,
  onDragResolve,
  className,
}: ContactAddressMapPreviewProps) {
  const fallbackAddressIdRef = useRef<string>(AddressUtils.generateAddressId());

  const addresses = useMemo<ProjectAddress[]>(() => {
    const defaults = AddressUtils.getNewAddressDefaults();

    // Multi-address mode: company contacts with HQ + branches
    if (companyAddresses && companyAddresses.length > 0) {
      // In draggable mode: include ALL addresses (even empty) so each gets a pin
      const filtered = draggable
        ? companyAddresses
        : companyAddresses.filter((addr) => addr.city.trim() || (addr.street.trim() && addr.postalCode.trim()));
      return filtered
        .map((addr, index) => {
          const isHq = addr.type === 'headquarters';
          return createProjectAddress({
            ...defaults,
            id: `${contactId || fallbackAddressIdRef.current}-${index}`,
            street: addr.street.trim(),
            city: addr.city.trim(),
            number: addr.number.trim() || undefined,
            postalCode: addr.postalCode.trim(),
            municipality: addr.municipalityName?.trim() || undefined,
            regionalUnit: addr.regionalUnitName?.trim() || undefined,
            region: addr.regionName?.trim() || addr.region?.trim() || undefined,
            type: COMPANY_TYPE_MAP[addr.type],
            label: isHq ? 'Έδρα' : 'Υποκατάστημα',
            isPrimary: isHq,
          });
        });
    }

    // Single-address mode: individual / service contacts
    const trimmedStreet = (street ?? '').trim();
    const trimmedCity = (city ?? '').trim();
    const trimmedStreetNumber = (streetNumber ?? '').trim();
    const trimmedPostalCode = (postalCode ?? '').trim();

    if (!trimmedCity && !(trimmedStreet && trimmedPostalCode)) {
      return [];
    }

    return [
      createProjectAddress({
        ...defaults,
        id: contactId || fallbackAddressIdRef.current,
        street: trimmedStreet,
        city: trimmedCity,
        number: trimmedStreetNumber || undefined,
        postalCode: trimmedPostalCode,
        municipality: municipality?.trim() || undefined,
        regionalUnit: regionalUnit?.trim() || undefined,
        region: region?.trim() || undefined,
        type: 'legal',
        label: 'Διεύθυνση',
        isPrimary: true,
      }),
    ];
  }, [city, contactId, postalCode, street, streetNumber, municipality, regionalUnit, region, companyAddresses]);

  // Map drag handler — converts ProjectAddress partial to DragResolvedAddress
  const handleDragUpdate = useMemo(() => {
    if (!draggable || !onDragResolve) return undefined;
    return (data: Partial<PartialProjectAddress>, addressIndex: number) => {
      // Split "Σαμοθράκης 16" into street + number
      const streetParts = (data.street ?? '').match(/^(.+?)\s+(\d+\S*)$/);
      onDragResolve({
        street: streetParts ? streetParts[1] : (data.street ?? ''),
        number: streetParts ? streetParts[2] : '',
        postalCode: data.postalCode ?? '',
        city: data.neighborhood || data.city || '',
        neighborhood: data.neighborhood ?? '',
        region: data.region ?? '',
      }, addressIndex);
    };
  }, [draggable, onDragResolve]);

  // In draggable mode: always show map (even without addresses)
  if (addresses.length === 0 && !draggable) {
    return null;
  }

  return (
    <AddressMap
      addresses={addresses}
      highlightPrimary
      showGeocodingStatus
      enableClickToFocus
      draggableMarkers={draggable}
      onAddressDragUpdate={handleDragUpdate}
      {...(heightPreset ? { heightPreset } : {})}
      className={className}
    />
  );
}

export default ContactAddressMapPreview;
