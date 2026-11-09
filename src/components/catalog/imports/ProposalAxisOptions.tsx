'use client';

/**
 * @fileoverview **Νέες τιμές άξονα από τον έλεγχο** (ADR-923 §5.5.2 Β7): το κουμπί της πρότασης ιδιοτήτων. Όταν οι παραλλαγές ενός πίνακα
 *   τυπώνουν κωδικούς που ο άξονας δεν αναγνωρίζει, ο άνθρωπος φτιάχνει τις τιμές **εδώ**, για όλες μαζί, χωρίς να φύγει από την εισαγωγή.
 * @module components/catalog/imports/ProposalAxisOptions
 *
 * 🔑 Φαίνεται μόνο όταν υπάρχει εύρημα άξονα (`axisCandidatesOf`, φθηνό, χωρίς βιβλιοθήκη) και ο άνθρωπος διαχειρίζεται σχήμα.
 * 🔑 Το πλαίσιο είναι **τεμπέλικη επιφάνεια** (`AxisOptionsDialogSlot`): βιβλιοθήκη, φόρμα και κείμενά τους μόνο όταν ανοίξει.
 */

import React, { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { axisCandidatesOf } from '@/subapps/catalog/import/axis-options-from-review';
import type { ImportProposalWire } from '@/subapps/catalog/types/catalog-import-requests';
import { useCatalogCanManage } from '../shared/catalog-ui-hooks';
import { AxisOptionsDialogSlot } from './import-surfaces';
import { LINE_REFUSAL_KEYS, useImportText } from './import-text';
import type { AxisOptionsState } from './use-axis-options';

interface ProposalAxisOptionsProps {
  readonly proposal: ImportProposalWire;
  readonly state: AxisOptionsState;
  /** Η πρόταση εκκρεμεί και η παρτίδα είναι ανοιχτή. */
  readonly decidable: boolean;
}

export function ProposalAxisOptions({ proposal, state, decidable }: ProposalAxisOptionsProps) {
  const { t } = useImportText();
  const canManage = useCatalogCanManage();
  const [open, setOpen] = useState(false);
  const candidates = useMemo(() => axisCandidatesOf(proposal.rows), [proposal.rows]);
  if (!decidable || !canManage || proposal.purpose !== 'attributes' || candidates.length === 0) return null;
  return (
    <section className="flex flex-col gap-1" aria-label={t('review.axis.open')}>
      <p className="m-0 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">{t('review.axis.hint')}</span>
        <Button type="button" size="sm" variant="outline" disabled={state.saving} onClick={() => { state.clearRefusal(); setOpen(true); }}>{t('review.axis.open')}</Button>
      </p>
      {state.refusal !== null ? <p className="m-0 text-sm text-destructive" role="alert">{t(LINE_REFUSAL_KEYS[state.refusal])}</p> : null}
      {open ? (
        <AxisOptionsDialogSlot proposal={proposal} candidates={candidates} saving={state.saving} onClose={() => setOpen(false)}
          onSave={state.add} onFailure={state.reportFailure} />
      ) : null}
    </section>
  );
}
