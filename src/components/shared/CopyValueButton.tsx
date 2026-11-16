'use client';

/**
 * @fileoverview **Κουμπί-εικονίδιο «Αντιγραφή» δίπλα σε μια τιμή** (ΑΦΜ, κωδικός, αριθμός) — το αποτέλεσμα ανακοινώνεται
 *   σε `aria-live`, ποτέ μόνο με αλλαγή εικονιδίου.
 * @related hooks/useCopyToClipboard.ts (η ΜΙΑ αντιγραφή, με εφεδρεία για παλιούς browsers) · ADR-915 §45.20
 * @module components/shared/CopyValueButton
 *
 * 🔑 **Χωρίς δικά του κείμενα, επίτηδες** (CHECK 3.34): οι λέξεις έρχονται από τον καλούντα, στο namespace της οθόνης
 *    του — ένα κοινό κουμπί με δικό του namespace θα έσερνε λεξιλόγιο σε κάθε σελίδα που το εισάγει.
 */

import React, { useCallback, useState } from 'react';
import { Check, Copy } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';

export interface CopyValueButtonProps {
  /** Ό,τι μπαίνει στο πρόχειρο. */
  readonly value: string;
  /** Το προσβάσιμο όνομα του κουμπιού — π.χ. «Αντιγραφή ΑΦΜ 800764388». */
  readonly label: string;
  /** Ανακοίνωση επιτυχίας. */
  readonly copiedLabel: string;
  /** Ανακοίνωση αποτυχίας (ο browser αρνήθηκε το πρόχειρο). */
  readonly failedLabel: string;
}

export function CopyValueButton({ value, label, copiedLabel, failedLabel }: CopyValueButtonProps): React.ReactElement {
  const { copy, copied } = useCopyToClipboard();
  const [failed, setFailed] = useState(false);
  const onCopy = useCallback(() => {
    void copy(value).then((ok) => setFailed(!ok));
  }, [copy, value]);
  return (
    <>
      <Button type="button" variant="ghost" size="icon" className="size-7 align-middle" onClick={onCopy} aria-label={label}>
        {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
      </Button>
      <span className="sr-only" aria-live="polite">
        {copied && copiedLabel}
        {failed && failedLabel}
      </span>
    </>
  );
}
