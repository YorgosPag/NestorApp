'use client';

/**
 * ADR-892 — Τα **κοινά** κομμάτια κάθε διαλόγου θέσης μέλους (διαχειριστής Φ2/Φ2β · αποχώρηση Φ3). Δέχονται
 * **μεταφρασμένο** κείμενο, όχι κλειδί: ο κάθε διάλογος μιλά από το δικό του namespace και με τη δική του οπτική
 * («το μέλος» / «εσείς»), ενώ η **συμπεριφορά** μένει μία (CHECK 3.28).
 *
 * @module components/workspace-membership/exit-dialog-parts
 */

import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';

interface ExitRefusalNoticeProps {
  readonly message: string;
  readonly cancelLabel: string;
  readonly onClose: () => void;
  /** Ο **δρόμος** μετά την άρνηση (π.χ. «Διαχείριση ρόλων») — όχι μόνο «όχι». */
  readonly action?: ReactNode;
}

/** Ο κριτής είπε «όχι» — με **όνομα**, και **χωρίς** κουμπί πράξης. */
export function ExitRefusalNotice({ message, cancelLabel, onClose, action }: ExitRefusalNoticeProps) {
  return (
    <>
      <p role="alert" className="rounded-lg border border-destructive/50 p-3 text-sm text-destructive">{message}</p>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>{cancelLabel}</Button>
        {action}
      </DialogFooter>
    </>
  );
}

interface PreviewFailedNoticeProps {
  readonly message: string;
  readonly cancelLabel: string;
  readonly retryLabel: string;
  readonly onClose: () => void;
  readonly onRetry: () => void;
}

/** Η προεπισκόπηση απέτυχε ⇒ **κανένα** κουμπί πράξης, μόνο επανάληψη (§7: ποτέ πράξη στα τυφλά). */
export function PreviewFailedNotice({ message, cancelLabel, retryLabel, onClose, onRetry }: PreviewFailedNoticeProps) {
  return (
    <>
      <p role="alert" className="text-sm text-destructive">{message}</p>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>{cancelLabel}</Button>
        <Button onClick={onRetry}>{retryLabel}</Button>
      </DialogFooter>
    </>
  );
}
