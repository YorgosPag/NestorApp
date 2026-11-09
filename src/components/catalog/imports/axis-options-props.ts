/**
 * @fileoverview Τα props της επιφάνειας «νέες τιμές άξονα» (ADR-923 §5.5.2 Β7) — **μόνο τύποι**.
 * @module components/catalog/imports/axis-options-props
 *
 * ⚠️ Δικό τους αρχείο, όπως το `line-tool-props.ts`: ο περιπατητής του CHECK 3.34 ακολουθεί και τα `import type`, άρα αν το κουμπί ή
 *    το μητρώο επιφανειών εισήγαγαν τον τύπο από το `AxisOptionsDialog`, η επιφάνεια δεν θα ήταν όριο.
 */

import type { CatalogFailure } from '@/services/catalog/catalog-failure';
import type { AddImportAxisOptionsRequest, ImportProposalWire } from '@/subapps/catalog/types/catalog-import-requests';

export interface AxisOptionsDialogProps {
  readonly proposal: ImportProposalWire;
  /** Οι ιδιότητες που ίσως είναι άξονας χωρίς τιμή (`axisCandidatesOf`). */
  readonly candidates: readonly string[];
  readonly saving: boolean;
  readonly onClose: () => void;
  /** `true` = γράφτηκαν και δέθηκαν (το πλαίσιο κλείνει). */
  readonly onSave: (request: AddImportAxisOptionsRequest) => Promise<boolean>;
  /** Ο ΕΝΑΣ ειδοποιητής της σελίδας: η επιφάνεια δεν φέρνει δικό της (που θα έφερνε και namespace). */
  readonly onFailure: (failure: CatalogFailure) => void;
}
