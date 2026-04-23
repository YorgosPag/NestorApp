'use client';

import '@/lib/design-system';
import { useMemo, useRef } from 'react';
import { AddressMap } from '@/components/shared/addresses/AddressMap';
import { AddressUtils } from '@/config/address-config';
import { createProjectAddress } from '@/types/project/address-helpers';
import type { ProjectAddress, ProjectAddressType, PartialProjectAddress } from '@/types/project/addresses';
import type { CompanyAddress } from '@/types/ContactFormTypes';
import { useTranslation } from '@/i18n/hooks/useTranslation';

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
  /**
   * ADR-318: additional addresses rendered as read-only pins (e.g. derived
   * work addresses from professional relationships). Never draggable.
   */
  readOnlyExtraAddresses?: ProjectAddress[];
  /** Map height preset override */
  heightPreset?: 'viewerCompact' | 'viewerStandard' | 'viewerExpanded' | 'viewerFullscreen';
  /** Enable draggable pin for address selection (edit mode) */
  draggable?: boolean;
  /** Callback when user drags pin — provides resolved address data + address index */
  onDragResolve?: (address: DragResolvedAddress, addressIndex: number) => void;
  /** Additional CSS classes for map container */
  className?: string;
}

/**
 * Map CompanyAddress.type (ADR-319 taxonomy) to ProjectAddressType.
 * The target taxonomy is only about pin colour/legend in the map — we keep
 * `legal` for the primary slot (headquarters/home) and `postal` for every
 * other semantic category.
 */
function mapContactTypeToProjectType(type: CompanyAddress['type']): ProjectAddressType {
  if (type === 'headquarters' || type === 'home') return 'legal';
  if (type === 'other') return 'other';
  return 'postal';
}

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
  readOnlyExtraAddresses,
  heightPreset,
  draggable = false,
  onDragResolve,
  className,
}: ContactAddressMapPreviewProps) {
  const fallbackAddressIdRef = useRef<string>(AddressUtils.generateAddressId());
  const { t: tContactsForm } = useTranslation('contacts-form');
  const { t: tAddr } = useTranslation('addresses');

  // SSoT labels — pulled from locale files, never hardcoded
  const hqLabel = tContactsForm('addressesSection.headquarters');
  const branchLabel = tContactsForm('addressesSection.branch');
  const homeLabel = tAddr('types.home');

  // Resolve a CompanyAddress to its human-readable pin label (ADR-319).
  // `customLabel` wins for `other`; everything else reads from `addresses.types`.
  const resolveTypeLabel = (addr: CompanyAddress): string => {
    if (addr.type === 'other' && addr.customLabel?.trim()) return addr.customLabel.trim();
    if (addr.type === 'headquarters') return hqLabel;
    if (addr.type === 'branch') return branchLabel;
    return tAddr(`types.${addr.type}`);
  };

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
          const isPrimary = addr.type === 'headquarters' || addr.type === 'home';
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
            type: mapContactTypeToProjectType(addr.type),
            label: resolveTypeLabel(addr),
            isPrimary,
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
        label: homeLabel,
        isPrimary: true,
      }),
    ];
  }, [city, contactId, postalCode, street, streetNumber, municipality, regionalUnit, region, companyAddresses, draggable, hqLabel, branchLabel, homeLabel]);

  // ADR-318: append read-only derived addresses and track their ids so the
  // map knows not to make them draggable.
  const combinedAddresses = useMemo<ProjectAddress[]>(
    () => (readOnlyExtraAddresses && readOnlyExtraAddresses.length > 0
      ? [...addresses, ...readOnlyExtraAddresses]
      : addresses),
    [addresses, readOnlyExtraAddresses]
  );

  const readOnlyAddressIds = useMemo<Set<string> | undefined>(
    () => (readOnlyExtraAddresses && readOnlyExtraAddresses.length > 0
      ? new Set(readOnlyExtraAddresses.map(a => a.id))
      : undefined),
    [readOnlyExtraAddresses]
  );

  // Map drag handler — converts ProjectAddress partial to DragResolvedAddress.
  // `data.number` arrives separated from `data.street` (reverseResultToAddress
  // preserves the Nominatim `addr.house_number` / `addr.road` split). The regex
  // split is only a safety net for legacy callers that still concatenate.
  const handleDragUpdate = useMemo(() => {
    if (!draggable || !onDragResolve) return undefined;
    return (data: Partial<PartialProjectAddress>, addressIndex: number) => {
      let street = (data.street ?? '').trim();
      let number = (data.number ?? '').trim();
      if (!number && street) {
        const parts = street.match(/^(.+?)\s+(\d+\S*)$/);
        if (parts) {
          street = parts[1];
          number = parts[2];
        }
      }
      onDragResolve({
        street,
        number,
        postalCode: data.postalCode ?? '',
        city: data.neighborhood || data.city || '',
        neighborhood: data.neighborhood ?? '',
        region: data.region ?? '',
      }, addressIndex);
    };
  }, [draggable, onDragResolve]);

  // In draggable mode: always show map (even without addresses)
  if (combinedAddresses.length === 0 && !draggable) {
    return null;
  }

  return (
    <AddressMap
      addresses={combinedAddresses}
      highlightPrimary
      showGeocodingStatus
      enableClickToFocus
      draggableMarkers={draggable}
      onAddressDragUpdate={handleDragUpdate}
      readOnlyAddressIds={readOnlyAddressIds}
      {...(heightPreset ? { heightPreset } : {})}
      className={className}
    />
  );
}

export default ContactAddressMapPreview;
