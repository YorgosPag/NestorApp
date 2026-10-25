'use client';

/**
 * @fileoverview **Το πρόχειρο ενός επεξεργαστή του καταλόγου** — ένας μηχανισμός για ιδιότητα, οικογένεια μέτρησης και
 *   οικογένεια προϊόντων (ADR-923 Φάση 1γ).
 * @module components/catalog/shared/use-definition-draft
 *
 * 🔑 **Η βάση είναι η `settled` όψη** (στιγμιότυπο + επιβεβαιωμένα, **χωρίς** εκκρεμή — `useCatalogOptimistic`): η δική
 *    μας αισιόδοξη εγγραφή δεν γίνεται ποτέ «αποθηκευμένη» στα μάτια του επεξεργαστή. Σε άρνηση 422 το πρόχειρο
 *    **μένει** όπως το άφησε ο άνθρωπος, με τα ευρήματα δίπλα στα πεδία.
 * 🔑 **Καθαρό πρόχειρο ακολουθεί τη ζωντανή εγγραφή**: αν κάποιος άλλος αλλάξει την οντότητα όσο ο άνθρωπος απλώς
 *    κοιτά, βλέπει αμέσως τη νέα εκδοχή (Google Docs). **Βρώμικο** πρόχειρο δεν πατιέται σιωπηλά — η σύγκρουση λύνεται
 *    στην αποθήκευση (CAS ⇒ 409 ⇒ επαναφορά στη **νεότερη** βάση, με ειδοποίηση από τον καλούντα).
 * 🔑 Τα ευρήματα του **διακομιστή** σβήνουν με την πρώτη αλλαγή του ανθρώπου (αφορούσαν άλλο πρόχειρο).
 */

import { useCallback, useRef, useState } from 'react';
import { dequal } from 'dequal';

import type { CatalogOutcome } from '@/hooks/catalog/useCatalogOptimistic';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';

export type DraftStatus = 'clean' | 'dirty' | 'saving' | 'saved';

export interface DefinitionDraft<D> {
  readonly draft: D;
  readonly update: (next: D) => void;
  readonly discard: () => void;
  readonly dirty: boolean;
  readonly status: DraftStatus;
  readonly serverIssues: readonly CatalogIssue[];
  /** Σημειώνει «στέλνεται» και επιστρέφει τον χειριστή του αποτελέσματος. */
  readonly beginSave: <R>(onSaved?: (record: R) => void) => (outcome: CatalogOutcome<R>) => void;
}

/** `identity` = ποια οντότητα επεξεργάζεται (id ή `new`): αλλαγή ⇒ νέο πρόχειρο από τη βάση. */
export function useDefinitionDraft<D>(base: D, identity: string): DefinitionDraft<D> {
  const [draft, setDraft] = useState(base);
  const [seen, setSeen] = useState({ identity, base });
  const [serverIssues, setServerIssues] = useState<readonly CatalogIssue[]>([]);
  const [status, setStatus] = useState<DraftStatus>('clean');
  const latestBase = useRef(base);
  latestBase.current = base;

  // Προσαρμογή κατά την απόδοση (React: «adjusting state when a prop changes») — χωρίς effect, χωρίς τρεμόπαιγμα.
  if (seen.identity !== identity || !dequal(seen.base, base)) {
    const switched = seen.identity !== identity;
    const followLive = !switched && status !== 'saving' && dequal(draft, seen.base);
    setSeen({ identity, base });
    if (switched || followLive) {
      setDraft(base);
      setServerIssues([]);
      if (switched) setStatus('clean');
    }
  }

  const update = useCallback((next: D) => {
    setDraft(next);
    setServerIssues([]);
    setStatus('dirty');
  }, []);
  const discard = useCallback(() => {
    setDraft(latestBase.current);
    setServerIssues([]);
    setStatus('clean');
  }, []);

  const beginSave = useCallback(<R,>(onSaved?: (record: R) => void) => {
    setStatus('saving');
    return (outcome: CatalogOutcome<R>) => {
      if (outcome.ok) {
        setStatus('saved');
        onSaved?.(outcome.record);
        return;
      }
      setStatus('dirty');
      if (outcome.failure.kind === 'revisionMismatch') setDraft(latestBase.current);
      else setServerIssues(outcome.failure.issues);
    };
  }, []);

  const dirty = !dequal(draft, base);
  const shown: DraftStatus = status === 'saving' ? 'saving' : dirty ? 'dirty' : status === 'saved' ? 'saved' : 'clean';
  return { draft, update, discard, dirty, status: shown, serverIssues, beginSave };
}
