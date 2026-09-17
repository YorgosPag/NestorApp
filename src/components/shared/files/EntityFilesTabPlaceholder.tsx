/**
 * EntityFilesTabPlaceholder — το «δεν υπάρχει τι να δείξω» μιας καρτέλας αρχείων
 *
 * Ένα σώμα για το μήνυμα που δείχνει μια καρτέλα αρχείων όταν λείπει οντότητα,
 * εταιρεία ή χρήστης. Ήταν γραμμένο με το χέρι σε κάθε καρτέλα (κτίριο · έργο · ακίνητο).
 *
 * @module components/shared/files/EntityFilesTabPlaceholder
 * @see ADR-031 — Canonical File Storage System
 */

'use client';

import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

interface EntityFilesTabPlaceholderProps {
  /** Ήδη μεταφρασμένο μήνυμα. */
  readonly message: string;
  /** Κλάση απόστασης — προεπιλογή `p-2`. */
  readonly paddingClassName?: string;
}

export function EntityFilesTabPlaceholder({
  message,
  paddingClassName = 'p-2',
}: EntityFilesTabPlaceholderProps) {
  const colors = useSemanticColors();

  return (
    <section className={cn(paddingClassName, 'text-center', colors.text.muted)}>
      <p>{message}</p>
    </section>
  );
}
