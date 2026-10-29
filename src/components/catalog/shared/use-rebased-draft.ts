'use client';

/**
 * **Πρόχειρο πλέγματος πάνω σε ζωντανό σύνολο** — rebase ανά γραμμή, συγκρούσεις ως γεγονός, αναίρεση/επανάληψη
 * (ADR-923 §5.10.4 Β4 · §5.11 «3δ»). Το ΕΝΑ ιδίωμα για το πλέγμα παραλλαγών και το πλέγμα γραμμών τιμοκαταλόγου.
 *
 * - Όσο ο άνθρωπος δεν άγγιξε τίποτα, το πρόχειρο **είναι** η ζωντανή εικόνα (καμία αντιγραφή).
 * - Μόλις αγγίξει, κάθε νέα ζωντανή εικόνα περνά από το `rebase` του καλούντος (καθαρό μοντέλο): ξένη αλλαγή σε γραμμή
 *   που δεν πείραξε υιοθετείται σιωπηλά· σε γραμμή που πείραξε κρατιέται η ζωντανή και η δική του **αναφέρεται**.
 * - Η σύγκρουση είναι **γεγονός**: το πρόχειρο υιοθετεί τη ζωντανή γραμμή και η ειδοποίηση κρατιέται ως την
 *   αποθήκευση/απόρριψη (ζωντανά, ADR-923 §5.10.5: «ξανανακαλυπτόταν» σε κάθε render και έμενε ΜΕΤΑ την αποθήκευση).
 *   Προσαρμογή κατά την απόδοση (React): συγκλίνει, αφού το υιοθετημένο πρόχειρο δεν συγκρούεται ξανά.
 * - `amend` = αλλαγή **χωρίς** εγγραφή ιστορικού (π.χ. η επίλυση ενός κωδικού που πληκτρολογήθηκε — παράγωγο, όχι ενέργεια).
 *
 * @module components/catalog/shared/use-rebased-draft
 */

import { useCallback, useMemo, useState } from 'react';

import { emptyHistory, recordHistory, redoHistory, undoHistory, type History } from '@/lib/spreadsheet/grid-history';

export interface Rebased<D> {
  readonly draft: D;
  readonly conflicts: readonly string[];
}

export interface RebasedDraft<D> {
  readonly draft: D;
  /** Συγκρούσεις από την τελευταία αποθήκευση/απόρριψη (κωδικοί γραμμών). */
  readonly conflicts: readonly string[];
  readonly clearConflicts: () => void;
  /** Μία ενέργεια του ανθρώπου = μία εγγραφή ιστορικού. */
  readonly change: (next: D) => void;
  /** Αλλαγή χωρίς ιστορικό — πάνω στο **τρέχον** πρόχειρο (συναρτησιακά, ασφαλές σε ασύγχρονες επιλύσεις). */
  readonly amend: (update: (current: D) => D) => void;
  readonly undo: () => void;
  readonly redo: () => void;
  readonly discard: () => void;
}

export function useRebasedDraft<D>(base: D, rebase: (own: D, base: D) => Rebased<D>): RebasedDraft<D> {
  const [own, setOwn] = useState<D | null>(null);
  const rebased = useMemo<Rebased<D>>(() => (own ? rebase(own, base) : { draft: base, conflicts: [] }), [own, base, rebase]);
  const [notice, setNotice] = useState<readonly string[]>([]);
  if (own && rebased.conflicts.length > 0) {
    setOwn(rebased.draft);
    setNotice((prev) => [...new Set([...prev, ...rebased.conflicts])]);
  }
  const [history, setHistory] = useState<History<D>>(emptyHistory());
  // Σταθερή αναφορά: καλείται από effects (επίλυση κωδικού) — νέα συνάρτηση σε κάθε απόδοση θα τα ξανάτρεχε.
  // Αμετάβλητο αποτέλεσμα ⇒ καμία νέα κατάσταση (αλλιώς κάθε κενή επίλυση θα ξανάδινε απόδοση).
  const amend = useCallback((update: (current: D) => D) => setOwn((prev) => {
    const current = prev ? rebase(prev, base).draft : base;
    const next = update(current);
    return next === current ? prev : next;
  }), [rebase, base]);
  const step = (result: { history: History<D>; apply: D | null }) => { setHistory(result.history); if (result.apply) setOwn(result.apply); };
  return {
    draft: rebased.draft,
    conflicts: notice,
    clearConflicts: () => setNotice([]),
    change: (next) => { setHistory((prev) => recordHistory(prev, { before: rebased.draft, after: next })); setOwn(next); },
    amend,
    undo: () => step(undoHistory(history)),
    redo: () => step(redoHistory(history)),
    discard: () => { setOwn(null); setHistory(emptyHistory()); setNotice([]); },
  };
}
