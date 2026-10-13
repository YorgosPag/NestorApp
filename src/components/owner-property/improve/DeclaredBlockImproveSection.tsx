'use client';

/**
 * **Το κέλυφος μιας ενότητας-μπλοκ** της οθόνης «Βελτίωσε την αγγελία σου» (ADR-842 Φ4 · ADR-777 §8.93 · §8.94).
 * @related `CommonChargesImproveSection.tsx` · `EnergyCertificateImproveSection.tsx` (οι δύο καλούντες) ·
 *   `hooks/useFieldPatchQueue.ts` (η σειριακή ουρά)
 *
 * 🔑 **Κάθε απάντηση αποθηκεύεται αμέσως** (σειριακή ουρά, αισιόδοξη επικάλυψη)· ο listener μένει η πηγή αλήθειας.
 * 🔑 **Καμία δεύτερη αλήθεια**: τιμή στην οθόνη = `apply(read(έγγραφο του listener), επικάλυψη)` — οι **ίδιες**
 *   συναρτήσεις με τον server, που ο καλών δίνει από το φύλλο του μπλοκ.
 *
 * Εξήχθη στη **δεύτερη** ενότητα-μπλοκ: τα κοινόχρηστα και το ΠΕΑ έχουν το ίδιο σώμα και διαφέρουν μόνο στο ποιο
 * μπλοκ διαβάζουν και ποια πεδία ζωγραφίζουν (N.18).
 */

import React, { useMemo, type ReactElement } from 'react';

import { ObjectiveValueSaveStatus } from '@/components/objective-value/ObjectiveValueSaveStatus';
import { useFieldPatchQueue } from '@/hooks/useFieldPatchQueue';
import type { FieldPatchOutcome } from '@/lib/async/field-patch-queue';

export interface DeclaredBlockImproveSectionProps<Block, Patch extends object> {
  /** Η εισαγωγική πρόταση της ενότητας — ήδη μεταφρασμένη από τον καλούντα (πλήρες, στατικό κλειδί εκεί). */
  readonly lead: string;
  /** Το μπλοκ όπως κάθεται στο έγγραφο του listener — ωμό. */
  readonly stored: unknown;
  /** Αλλάζει σε κάθε νέα κατάσταση του εγγράφου ⇒ η αισιόδοξη επικάλυψη καθαρίζει. */
  readonly revision: unknown;
  readonly write: (patch: Patch) => Promise<FieldPatchOutcome<never>>;
  /** Ο ΕΝΑΣ αναγνώστης του μπλοκ — **σταθερή** συνάρτηση. */
  readonly read: (stored: unknown) => Block;
  /** Η εφαρμογή διόρθωσης — η ίδια με τον server, **σταθερή** συνάρτηση. */
  readonly apply: (block: Block, patch: Patch) => Block;
  readonly renderFields: (block: Block, onChange: (patch: Patch) => void) => ReactElement;
}

export function DeclaredBlockImproveSection<Block, Patch extends object>({
  lead,
  stored,
  revision,
  write,
  read,
  apply,
  renderFields,
}: DeclaredBlockImproveSectionProps<Block, Patch>) {
  const save = useFieldPatchQueue(write, revision);
  const { overlay } = save;
  const block = useMemo(() => {
    const truth = read(stored);
    return overlay === null ? truth : apply(truth, overlay);
  }, [stored, overlay, read, apply]);

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 text-sm text-muted-foreground">{lead}</p>
        <ObjectiveValueSaveStatus save={save} />
      </header>
      {renderFields(block, save.enqueue)}
    </>
  );
}
