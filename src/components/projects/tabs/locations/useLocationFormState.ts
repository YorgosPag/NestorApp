/**
 * =============================================================================
 * useLocationFormState — η κατάσταση ΜΙΑΣ φόρμας διεύθυνσης έργου (προσθήκη ή επεξεργασία)
 * =============================================================================
 *
 * Εξήχθη από το `useProjectLocations` (477 γρ., N.7.1) — ADR-332 D27 Βήμα Β.
 *
 * ⚠️ Οι δύο φόρμες είχαν **δέκα** `useState` σε δύο αντίγραφα και **δύο** χειρόγραφους
 * καθαρισμούς πέντε γραμμών· ένα νέο πεδίο έπρεπε να προστεθεί τέσσερις φορές. Εδώ ζει
 * **μία** φορά και το hook καλείται δύο.
 *
 * 🔑 **Η θέση ΔΕΝ ζει εδώ**, επίτηδες: τη φέρει το `useFormPlacedPoint`, που είναι κοινό με τα
 * κτίρια. Αυτό εδώ είναι τα πεδία **κειμένου και ταξινόμησης** της διεύθυνσης έργου.
 *
 * @module components/projects/tabs/locations/useLocationFormState
 */

import { useCallback, useState } from 'react';
import type { AddressWithHierarchyValue } from '@/components/shared/addresses/AddressWithHierarchy';
import type { BlockSideDirection, ProjectAddress, ProjectAddressType } from '@/types/project/addresses';
import { SELECT_CLEAR_VALUE } from '@/config/domain-constants';
import { toHierarchyValue } from './location-converters';

export type BlockSideValue = BlockSideDirection | typeof SELECT_CLEAR_VALUE;

export interface LocationFormState {
  readonly hierarchy: Partial<AddressWithHierarchyValue>;
  readonly setHierarchy: (value: Partial<AddressWithHierarchyValue>) => void;
  readonly type: ProjectAddressType;
  readonly setType: (value: ProjectAddressType) => void;
  readonly blockSide: BlockSideValue;
  readonly setBlockSide: (value: BlockSideValue) => void;
  readonly label: string;
  readonly setLabel: (value: string) => void;
  readonly isPrimary: boolean;
  readonly setIsPrimary: (value: boolean) => void;
  /** Γεμίζει τη φόρμα από αποθηκευμένη διεύθυνση (επεξεργασία). */
  readonly load: (address: ProjectAddress) => void;
  readonly reset: () => void;
}

/** Τα προαιρετικά πεδία ταξινόμησης, **μόνο** όταν έχουν τιμή — κοινό για αποθήκευση προσθήκης και επεξεργασίας. */
export function optionalClassification(
  form: Pick<LocationFormState, 'blockSide' | 'label'>,
): Partial<Pick<ProjectAddress, 'blockSide' | 'label'>> {
  return {
    ...(form.blockSide !== SELECT_CLEAR_VALUE ? { blockSide: form.blockSide } : {}),
    ...(form.label ? { label: form.label } : {}),
  };
}

export function useLocationFormState(): LocationFormState {
  const [hierarchy, setHierarchy] = useState<Partial<AddressWithHierarchyValue>>({});
  const [type, setType] = useState<ProjectAddressType>('site');
  const [blockSide, setBlockSide] = useState<BlockSideValue>(SELECT_CLEAR_VALUE);
  const [label, setLabel] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);

  const load = useCallback((address: ProjectAddress) => {
    setHierarchy(toHierarchyValue(address));
    setType(address.type || 'site');
    setBlockSide(address.blockSide || SELECT_CLEAR_VALUE);
    setLabel(address.label || '');
    setIsPrimary(address.isPrimary ?? false);
  }, []);

  const reset = useCallback(() => {
    setHierarchy({});
    setType('site');
    setBlockSide(SELECT_CLEAR_VALUE);
    setLabel('');
    setIsPrimary(false);
  }, []);

  return {
    hierarchy, setHierarchy,
    type, setType,
    blockSide, setBlockSide,
    label, setLabel,
    isPrimary, setIsPrimary,
    load, reset,
  };
}
