'use client';

/**
 * @fileoverview **Μία πράξη της οθόνης «Συνδέσεις»**: ένα αίτημα τη φορά, αποτυχία με την κοινή λέξη του καταλόγου, και μετά
 *   ανανέωση στο παρασκήνιο. Το σήμα θα έφερνε ούτως ή άλλως τη νέα όψη· η ρητή ανανέωση κόβει την αναμονή του ανθρώπου.
 * @module components/catalog/supply/use-supply-action
 */

import { useCallback, useState } from 'react';

import { catalogFailureOf } from '@/services/catalog/catalog-failure';
import { useCatalogFailureNotice } from '../shared/catalog-ui-hooks';

export interface SupplyAction {
  /** Το κλειδί της πράξης που εκκρεμεί: η γραμμή της δείχνει «στέλνεται» και κλειδώνει. */
  readonly pending: string | null;
  run(key: string, act: () => Promise<unknown>): Promise<boolean>;
}

export function useSupplyAction(revalidate: () => Promise<void>): SupplyAction {
  const notice = useCatalogFailureNotice();
  const [pending, setPending] = useState<string | null>(null);
  const run = useCallback(async (key: string, act: () => Promise<unknown>) => {
    setPending(key);
    try {
      await act();
      await revalidate();
      return true;
    } catch (cause: unknown) {
      notice(catalogFailureOf(cause));
      return false;
    } finally {
      setPending(null);
    }
  }, [notice, revalidate]);
  return { pending, run };
}
