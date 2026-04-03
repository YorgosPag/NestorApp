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

export function buildProjectAddressSelection(
  localAddresses: ProjectAddress[],
  projectAddress: ProjectAddress
): ProjectAddress[] {
  const nextAddresses = localAddresses.some((address) => address.id === projectAddress.id)
    ? localAddresses.filter((address) => address.id !== projectAddress.id)
    : [
        ...localAddresses,
        {
          ...projectAddress,
          isPrimary: localAddresses.length === 0 ? true : projectAddress.isPrimary,
        },
      ];

  return ensureSinglePrimaryAddress(nextAddresses);
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
