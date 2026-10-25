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
 * 🔑 **`baseRevision` = η αναθεώρηση πάνω στην οποία χτίστηκε το πρόχειρο** — αυτήν στέλνει ο CAS (HTTP `If-Match`).
 *    Ακολουθεί τη ζωντανή εγγραφή **μόνο** όσο το πρόχειρο την ακολουθεί· βρώμικο πρόχειρο κρατά ό,τι διάβασε ο
 *    άνθρωπος, αλλιώς η αλλαγή του άλλου θα «νομιμοποιούσε» την αντικατάστασή της (μετρημένο ζωντανά, §5.9.2).
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
  /**
   * Βρώμικο **και όχι** σε αποστολή: ό,τι θα χανόταν αν ο άνθρωπος έφευγε τώρα. Αυτό δηλώνεται στον φύλακα — πρόχειρο
   * που ήδη στέλνεται δεν είναι «μη αποθηκευμένο» (Gmail/Docs: η αποστολή συνεχίζει, η άρνηση έρχεται ως ειδοποίηση).
   */
  readonly unsaved: boolean;
  /** Η αναθεώρηση πάνω στην οποία χτίστηκε το πρόχειρο (`null` = νέα οντότητα) — η βάση του CAS. */
  readonly baseRevision: number | null;
  readonly status: DraftStatus;
  readonly serverIssues: readonly CatalogIssue[];
  /** Σημειώνει «στέλνεται» και επιστρέφει τον χειριστή του αποτελέσματος. */
  readonly beginSave: <R>(onSaved?: (record: R) => void) => (outcome: CatalogOutcome<R>) => void;
}

interface Seen<D> {
  readonly identity: string;
  readonly base: D;
  readonly revision: number | null;
}

/**
 * `identity` = ποια οντότητα επεξεργάζεται (id ή `new`): αλλαγή ⇒ νέο πρόχειρο από τη βάση.
 * `revision` = η αναθεώρηση της βάσης (`null` για νέα οντότητα).
 */
export function useDefinitionDraft<D>(base: D, identity: string, revision: number | null = null): DefinitionDraft<D> {
  const [draft, setDraft] = useState(base);
  const [seen, setSeen] = useState<Seen<D>>({ identity, base, revision });
  const [baseRevision, setBaseRevision] = useState(revision);
  const [serverIssues, setServerIssues] = useState<readonly CatalogIssue[]>([]);
  const [status, setStatus] = useState<DraftStatus>('clean');
  const latest = useRef({ base, revision });
  latest.current = { base, revision };

  // Προσαρμογή κατά την απόδοση (React: «adjusting state when a prop changes») — χωρίς effect, χωρίς τρεμόπαιγμα.
  if (seen.identity !== identity || seen.revision !== revision || !dequal(seen.base, base)) {
    const switched = seen.identity !== identity;
    const followLive = !switched && status !== 'saving' && dequal(draft, seen.base);
    setSeen({ identity, base, revision });
    if (switched || followLive) {
      setDraft(base);
      setServerIssues([]);
      if (switched) setStatus('clean');
    }
    // Η βάση του CAS προχωρά μόνο όταν το πρόχειρο ΕΙΝΑΙ η νέα εκδοχή (ακολούθησε, ή έγινε ίδιο — π.χ. η δική μας εγγραφή).
    if (switched || followLive || dequal(draft, base)) setBaseRevision(revision);
  }

  const update = useCallback((next: D) => {
    setDraft(next);
    setServerIssues([]);
    setStatus('dirty');
  }, []);
  const discard = useCallback(() => {
    setDraft(latest.current.base);
    setBaseRevision(latest.current.revision);
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
      if (outcome.failure.kind === 'revisionMismatch') {
        setDraft(latest.current.base);
        setBaseRevision(latest.current.revision);
      } else setServerIssues(outcome.failure.issues);
    };
  }, []);

  const dirty = !dequal(draft, base);
  const shown: DraftStatus = status === 'saving' ? 'saving' : dirty ? 'dirty' : status === 'saved' ? 'saved' : 'clean';
  return { draft, update, discard, dirty, unsaved: shown === 'dirty', baseRevision, status: shown, serverIssues, beginSave };
}
