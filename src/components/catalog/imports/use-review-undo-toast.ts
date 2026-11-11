'use client';

/**
 * @fileoverview **Το toast «Αναίρεση» της ομαδικής πράξης στην οθόνη ελέγχου** (ADR-923 §5.5.2 Β9γ).
 * @related `hooks/notifications/useUndoToasts.ts` — ο ΕΝΑΣ μηχανισμός (μονιμότητα ADR-866 §2.10 Β2, σταθερό `id`)
 * @module components/catalog/imports/use-review-undo-toast
 *
 * 🔑 **Μόνο ομαδική πράξη** (`isGroupStep`, π.χ. «Αποδοχή γραμμής · 5 πεδία») — Gmail: «αρχειοθετήθηκαν 12 · Αναίρεση». Η πράξη
 *    σε ΕΝΑ πεδίο φαίνεται ήδη στη θέση της και αναιρείται εκεί.
 * 🔑 **Το toast ζει όσο το βήμα του είναι στην ΚΟΡΥΦΗ της στοίβας.** Ctrl+Z · κουμπί · νέα πράξη · έξοδος από την οθόνη ⇒ φεύγει.
 *    Έτσι το «Αναίρεση» του toast αναιρεί **πάντα** αυτό που γράφει — ποτέ κάτι άλλο, ποτέ κάτι ήδη αναιρεμένο.
 * 🔑 **Μία στοίβα, μία πόρτα**: το κουμπί ζητά αναίρεση **του συγκεκριμένου βήματος** από την ίδια ουρά αιτημάτων με το Ctrl+Z
 *    (`undo(entry)`)· αν στο μεταξύ η κορυφή άλλαξε, το αίτημα πέφτει — καμία αναίρεση λάθος βήματος.
 * 🔑 Κανένα νέο κείμενο: μήνυμα = το όνομα του βήματος (`useStepName`), κουμπί = `review.history.undo`.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import { useUndoToasts } from '@/hooks/notifications/useUndoToasts';
import type { History, HistoryEntry } from '@/lib/spreadsheet/grid-history';
import { useImportText } from './import-text';
import type { ReviewStep } from './review-history';
import { useStepName } from './use-review-step-name';

export type ReviewEntry = HistoryEntry<ReviewStep>;

const SCOPE_PREFIX = 'catalog-import-review-undo:';

interface Toasted {
  readonly entry: ReviewEntry;
  readonly key: string;
}

/**
 * @param batchId   το εύρος του toast (ένα ανά παρτίδα).
 * @param history   η στοίβα — η κορυφή της κρίνει αν το toast ισχύει ακόμη.
 * @param announce  το τελευταίο **καταγεγραμμένο** ομαδικό βήμα (όχι επανάληψη) — αυτό ανακοινώνεται.
 * @param undo      αίτημα αναίρεσης **αυτού** του βήματος.
 */
export function useReviewUndoToast(batchId: string, history: History<ReviewStep>, announce: ReviewEntry | null, undo: (entry: ReviewEntry) => void): void {
  const { t } = useImportText();
  const nameOf = useStepName();
  const [toasted, setToasted] = useState<Toasted | null>(null);
  const top = history.past[history.past.length - 1] ?? null;
  const liveKeys = useMemo(() => new Set(toasted && top === toasted.entry ? [toasted.key] : []), [toasted, top]);
  const show = useUndoToasts(`${SCOPE_PREFIX}${batchId}`, liveKeys, { retireOnUnmount: true });
  const shown = useRef<ReviewEntry | null>(null);
  const sequence = useRef(0);

  useEffect(() => {
    if (!announce || shown.current === announce || top !== announce) return;
    const message = nameOf(announce.after.label);
    if (!message) return;
    shown.current = announce;
    sequence.current += 1;
    const key = String(sequence.current);
    setToasted({ entry: announce, key });
    show({ key, message, undoLabel: t('review.history.undo'), onUndo: () => undo(announce) });
  }, [announce, nameOf, show, t, top, undo]);
}
