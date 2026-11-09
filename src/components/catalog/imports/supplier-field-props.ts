/**
 * @fileoverview Τα props της επιφάνειας «προμηθευτής και μνήμη» (ADR-923 §5.5.2 Β5.2) — **μόνο τύποι**.
 * @module components/catalog/imports/supplier-field-props
 *
 * ⚠️ Ζουν σε δικό τους αρχείο γιατί ο περιπατητής του CHECK 3.34 ακολουθεί και τα `import type`: αν το μητρώο επιφανειών ή ο hook
 *    εισήγαγαν τύπο από το `ImportSupplierField`, η επιφάνεια δεν θα ήταν όριο (ίδιο σχήμα με το `line-tool-props.ts`).
 */

import type { CatalogFailure } from '@/services/catalog/catalog-failure';
import type { ImportMemoryActionOutcome, ImportMemoryActionRequest, ImportMemoryHints } from '@/subapps/catalog/types/catalog-import-requests';

/** Η τελευταία πράξη μνήμης και τι έκανε. */
export interface MemoryActionReport {
  readonly action: ImportMemoryActionRequest['action'];
  readonly outcome: ImportMemoryActionOutcome;
}

export interface ImportSupplierFieldProps {
  readonly supplierContactId: string | null;
  readonly learnLabels: boolean;
  /** Απούσα όταν η παρτίδα δεν έχει προμηθευτή. */
  readonly hints: ImportMemoryHints | undefined;
  /** Αποθήκευση, πράξη μνήμης ή αναβάθμιση σε εξέλιξη: καμία νέα πράξη. */
  readonly busy: boolean;
  readonly memoryBusy: boolean;
  readonly report: MemoryActionReport | null;
  readonly onSupplier: (supplierContactId: string | null) => void;
  readonly onLearn: (learnLabels: boolean) => void;
  readonly onMemory: (action: ImportMemoryActionRequest['action']) => void;
  /** Αποτυχία μέσα στην επιφάνεια ⇒ ο **ένας** ειδοποιητής της σελίδας (όχι δεύτερος εδώ, που θα έφερνε το namespace `catalog`). */
  readonly onFailure: (failure: CatalogFailure) => void;
}

/** Η μνήμη ενός προμηθευτή: ανεξάρτητη από παρτίδα, ώστε να μπει και αλλού (π.χ. καρτέλα επαφής) χωρίς δεύτερο αντίγραφο. */
export interface LabelMemoryPanelProps {
  readonly supplierContactId: string;
  readonly onClose: () => void;
  readonly onFailure: (failure: CatalogFailure) => void;
}
