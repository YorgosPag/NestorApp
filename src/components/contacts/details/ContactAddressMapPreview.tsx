'use client';

import '@/lib/design-system';
import { useMemo, useRef } from 'react';
import { AddressMap } from '@/components/shared/addresses/AddressMap';
import { AddressUtils } from '@/config/address-config';
import { createProjectAddress } from '@/types/project/address-helpers';
import type { ProjectAddress, ProjectAddressType } from '@/types/project/addresses';
import { mapPinDropText, type PinDrop } from '@/components/shared/addresses/pin-drop';
import type { CompanyAddress } from '@/types/ContactFormTypes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { pickStoredAddressPosition } from '@/utils/address/stored-address-position';
import { toContactDraggedAddress, type DragResolvedAddress } from './contact-pin-drop';

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
  /**
   * ADR-332 D27 Β-ΙΙ — **κάθε** σύρσιμο φτάνει στον γονιό, ολόκληρο: σημείο, χειρονομία και
   * ό,τι είπε η μηχανή (`pending` → κείμενο · δεν βρέθηκε · δεν απάντησε). Ως τότε εδώ
   * υπήρχαν δύο κανάλια, και το σημείο **πετιόταν** — γιατί οι επαφές δεν αποθήκευαν θέση.
   */
  onPinDrop?: (drop: PinDrop<DragResolvedAddress>, addressIndex: number) => void;
  /** Additional CSS classes for map container */
  className?: string;
  /** Increment to clear map drag positions after undo/redo in the address editor. */
  dragResetKey?: number;
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
  onPinDrop,
  className,
  dragResetKey,
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
            // ADR-332 D27 Β-ΙΙ: η ΑΠΟΘΗΚΕΥΜΕΝΗ θέση — ο χάρτης την προτιμά από τη γεωκωδικοποίηση
            // της οθόνης (`displayedPosition`), οπότε η πινέζα δεν «πηδά» μετά το σύρσιμο.
            ...pickStoredAddressPosition(addr),
            // Η πραγματική ταυτότητα, όπου υπάρχει — ο δείκτης αλλάζει όταν σβήνεται υποκατάστημα.
            id: addr.id ?? `${contactId || fallbackAddressIdRef.current}-${index}`,
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

  // Το σύρσιμο φτάνει ΟΛΟΚΛΗΡΟ στον γονιό — μόνο το κείμενο μεταφράζεται στο λεξιλόγιο επαφής.
  const handleDragUpdate = useMemo(() => {
    if (!draggable || !onPinDrop) return undefined;
    return (drop: PinDrop, addressIndex: number) =>
      onPinDrop(mapPinDropText(drop, toContactDraggedAddress), addressIndex);
  }, [draggable, onPinDrop]);

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
      {...(dragResetKey !== undefined ? { dragResetKey } : {})}
      className={className}
    />
  );
}

export default ContactAddressMapPreview;
