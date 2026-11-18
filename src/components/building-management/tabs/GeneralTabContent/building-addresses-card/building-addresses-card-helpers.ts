import type { ProjectAddress } from '@/types/project/addresses';
import {
  createProjectAddress,
  formatAddressLine,
  migrateLegacyAddress,
} from '@/types/project/address-helpers';

export { formatAddressLine };

export function createInitialBuildingAddresses(
  addresses?: ProjectAddress[],
  legacyAddress?: string,
  legacyCity?: string
): ProjectAddress[] {
  if (addresses && addresses.length > 0) {
    return addresses;
  }

  if (legacyAddress && legacyCity) {
    return migrateLegacyAddress(legacyAddress, legacyCity);
  }

  return [];
}

export function ensureSinglePrimaryAddress(addresses: ProjectAddress[]): ProjectAddress[] {
  if (addresses.length === 0) {
    return addresses;
  }

  const primaryIndex = addresses.findIndex((address) => address.isPrimary);
  if (primaryIndex >= 0) {
    return addresses.map((address, index) => ({
      ...address,
      isPrimary: index === primaryIndex,
    }));
  }

  return addresses.map((address, index) => ({
    ...address,
    isPrimary: index === 0,
  }));
}

/**
 * Οι διευθύνσεις του κτιρίου που **δεν** υπάρχουν στο έργο (π.χ. χειροκίνητη διεύθυνση από πριν μπει το κτίριο σε έργο,
 * ή διεύθυνση που αφαιρέθηκε από το έργο). Χωρίς αυτή τη λίστα η καρτέλα δείχνει μόνο διευθύνσεις έργου και αυτές
 * μένουν στο κτίριο **αόρατες και αμετακίνητες** (ADR-332).
 * ⚠️ Έχει νόημα μόνο όταν οι διευθύνσεις του έργου **φορτώθηκαν**: σε αποτυχία φόρτωσης όλες θα έμοιαζαν «εκτός έργου».
 */
export function buildingOnlyAddresses(
  localAddresses: readonly ProjectAddress[],
  projectAddresses: readonly ProjectAddress[]
): ProjectAddress[] {
  const projectIds = new Set(projectAddresses.map((address) => address.id));
  return localAddresses.filter((address) => !projectIds.has(address.id));
}

/** Το κτίριο χωρίς αυτή τη διεύθυνση — με ακριβώς μία κύρια ανάμεσα σε όσες μένουν. */
export function buildUnlinkedAddressUpdate(
  localAddresses: readonly ProjectAddress[],
  addressId: string
): ProjectAddress[] {
  return ensureSinglePrimaryAddress(localAddresses.filter((address) => address.id !== addressId));
}

export function buildProjectAddressSelection(
  localAddresses: ProjectAddress[],
  projectAddress: ProjectAddress
): ProjectAddress[] {
  if (localAddresses.some((address) => address.id === projectAddress.id)) {
    return buildUnlinkedAddressUpdate(localAddresses, projectAddress.id);
  }
  return ensureSinglePrimaryAddress([
    ...localAddresses,
    {
      ...projectAddress,
      isPrimary: localAddresses.length === 0 ? true : projectAddress.isPrimary,
    },
  ]);
}

export function buildPrimaryAddressUpdate(
  addresses: ProjectAddress[],
  predicate: (address: ProjectAddress, index: number) => boolean
): ProjectAddress[] {
  return ensureSinglePrimaryAddress(
    addresses.map((address, index) => ({
      ...address,
      isPrimary: predicate(address, index),
    }))
  );
}

export function buildDeletedAddressUpdate(addresses: ProjectAddress[], indexToDelete: number): ProjectAddress[] {
  return ensureSinglePrimaryAddress(addresses.filter((_, index) => index !== indexToDelete));
}

export function createManualBuildingAddress(
  draftAddress: Partial<ProjectAddress>,
  existingCount: number
): ProjectAddress {
  return createProjectAddress({
    ...draftAddress,
    street: draftAddress.street ?? '',
    city: draftAddress.city ?? '',
    isPrimary: existingCount === 0,
    sortOrder: existingCount,
  });
}

export function updateManualBuildingAddress(
  originalAddress: ProjectAddress,
  draftAddress: Partial<ProjectAddress>
): ProjectAddress {
  return createProjectAddress({
    ...originalAddress,
    ...draftAddress,
    id: originalAddress.id,
    street: draftAddress.street ?? originalAddress.street,
    city: draftAddress.city ?? originalAddress.city,
    isPrimary: originalAddress.isPrimary,
    sortOrder: originalAddress.sortOrder ?? 0,
  });
}

export function getBuildingAddressCardId(addressId: string): string {
  return `building-address-card-${addressId}`;
}
