'use client';

/**
 * ADR-244/706 — buyer-owners state shared by the sales action dialogs.
 *
 * Reserve and Sell ask the same four questions of the same list: who are the owners,
 * which of them is the primary buyer, how do we label them, and does that buyer have
 * an email. They differ in one thing only — Sell seeds the list from the owners already
 * on the unit, Reserve starts empty — so that difference is a flag, not a second copy.
 *
 * @module components/sales/dialogs/use-sales-buyer-owners
 */

import { useState } from 'react';
import type { Property } from '@/types/property';
import type { PropertyOwnerEntry } from '@/types/ownership-table';
import { formatOwnerNames, getPrimaryBuyerContactId } from '@/lib/ownership/owner-utils';
import { useContactEmailWatch } from '@/hooks/sales/useContactEmailWatch';
import { usePropertyHierarchyValidation } from '@/hooks/sales/usePropertyHierarchyValidation';

export interface SalesBuyerOwners {
  owners: PropertyOwnerEntry[];
  setOwners: React.Dispatch<React.SetStateAction<PropertyOwnerEntry[]>>;
  buyerContactId: string;
  buyerName: string;
  buyerHasEmail: boolean;
  /** True when the unit already carried owners and the list was seeded from them. */
  hasExistingOwners: boolean;
  hierarchy: ReturnType<typeof usePropertyHierarchyValidation>;
}

export function useSalesBuyerOwners(
  unit: Property,
  open: boolean,
  options: { seedFromUnit?: boolean } = {},
): SalesBuyerOwners {
  const existingOwners = options.seedFromUnit
    ? (unit.commercial?.owners as PropertyOwnerEntry[] | null | undefined) ?? null
    : null;

  const [owners, setOwners] = useState<PropertyOwnerEntry[]>(
    () => (existingOwners && existingOwners.length > 0 ? existingOwners : []),
  );

  const buyerContactId = getPrimaryBuyerContactId(owners) ?? '';
  const buyerName = formatOwnerNames(owners) ?? '';
  const { hasEmail: buyerHasEmail } = useContactEmailWatch(buyerContactId);
  const hierarchy = usePropertyHierarchyValidation(unit, open);

  return {
    owners,
    setOwners,
    buyerContactId,
    buyerName,
    buyerHasEmail,
    hasExistingOwners: Boolean(existingOwners?.length),
    hierarchy,
  };
}
