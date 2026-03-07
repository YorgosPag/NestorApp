'use client';

import { useMemo, useRef } from 'react';
import { AddressMap } from '@/components/shared/addresses/AddressMap';
import { AddressUtils } from '@/config/address-config';
import { createProjectAddress } from '@/types/project/address-helpers';
import type { ProjectAddress, ProjectAddressType } from '@/types/project/addresses';
import type { CompanyAddress } from '@/types/ContactFormTypes';

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
  className,
}: ContactAddressMapPreviewProps) {
  const fallbackAddressIdRef = useRef<string>(AddressUtils.generateAddressId());

  const addresses = useMemo<ProjectAddress[]>(() => {
    const defaults = AddressUtils.getNewAddressDefaults();

    // Multi-address mode: company contacts with HQ + branches
    if (companyAddresses && companyAddresses.length > 0) {
      return companyAddresses
        .filter((addr) => addr.city.trim() || (addr.street.trim() && addr.postalCode.trim()))
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

  if (addresses.length === 0) {
    return null;
  }

  return (
    <AddressMap
      addresses={addresses}
      highlightPrimary
      showGeocodingStatus
      enableClickToFocus
      {...(heightPreset ? { heightPreset } : {})}
      className={className}
    />
  );
}

export default ContactAddressMapPreview;
