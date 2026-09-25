/**
 * @fileoverview Η κατάσταση του διαλόγου κοινής χρήσης showcase στις σελίδες λεπτομερειών —
 * ανοιχτός/κλειστός και ένας σταθερός χειριστής «άνοιξε» για το header (CHECK 3.28).
 * @module hooks/useShowcaseDialog
 */

import { useCallback, useState } from 'react';

export interface ShowcaseDialogState {
  readonly open: boolean;
  readonly setOpen: (open: boolean) => void;
  /** Σταθερή αναφορά — ασφαλής ως prop σε memoized header. */
  readonly openDialog: () => void;
}

export function useShowcaseDialog(): ShowcaseDialogState {
  const [open, setOpen] = useState(false);
  const openDialog = useCallback(() => setOpen(true), []);
  return { open, setOpen, openDialog };
}
