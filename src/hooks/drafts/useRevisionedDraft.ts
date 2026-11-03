'use client';

/**
 * @fileoverview **Το πρόχειρο ενός επεξεργαστή πάνω σε έγγραφο με αναθεώρηση (CAS)** — ένας μηχανισμός για τον
 *   κατάλογο (ADR-923 Φάση 1γ) και την υπεργολαβία (ADR-928 Φ3γ).
 * @module hooks/drafts/useRevisionedDraft
 *
 * 🔑 **Η βάση είναι η `settled` όψη** (στιγμιότυπο + επιβεβαιωμένα, **χωρίς** εκκρεμή): η δική μας αισιόδοξη εγγραφή
 *    δεν γίνεται ποτέ «αποθηκευμένη» στα μάτια του επεξεργαστή. Σε άρνηση 422 το πρόχειρο **μένει** όπως το άφησε ο
 *    άνθρωπος, με τα ευρήματα δίπλα στα πεδία.
 * 🔑 **Καθαρό πρόχειρο ακολουθεί τη ζωντανή εγγραφή** (Google Docs). **Βρώμικο** πρόχειρο δεν πατιέται σιωπηλά.
 * 🔑 **`baseRevision` = η αναθεώρηση πάνω στην οποία χτίστηκε το πρόχειρο** — αυτήν στέλνει ο CAS. Ακολουθεί τη ζωντανή
 *    εγγραφή **μόνο** όσο το πρόχειρο την ακολουθεί· βρώμικο πρόχειρο κρατά ό,τι διάβασε ο άνθρωπος, αλλιώς η αλλαγή
 *    του άλλου θα «νομιμοποιούσε» την αντικατάστασή της (ADR-923 §5.9.2).
 * 🔑 **Σύγκρουση (409)** — δύο πολιτικές, ρητές:
 *    - `reset` (κατάλογος): επιστροφή στη **νεότερη** βάση, με ειδοποίηση από τον καλούντα.
 *    - `hold` (υπεργολαβία, ADR-928 Φ3γ): το πρόχειρο **μένει**· ο άνθρωπος διαλέγει `discard` (φόρτωσε τη νέα) ή
 *      `adoptLatestBase` (κράτα τις αλλαγές μου πάνω στη νέα — συνειδητή αντικατάσταση). Το `behind` το λέει **πριν**
 *      την αποθήκευση, μόλις φτάσει η ζωντανή αλλαγή του άλλου.
 * 🔑 Τα ευρήματα του **διακομιστή** σβήνουν με την πρώτη αλλαγή του ανθρώπου (αφορούσαν άλλο πρόχειρο).
 */

import { useCallback, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { dequal } from 'dequal';

export type DraftStatus = 'clean' | 'dirty' | 'saving' | 'saved';
export type DraftConflictPolicy = 'reset' | 'hold';

/** Η άρνηση του γραφέα όπως τη χρειάζεται το πρόχειρο — δομικά συμβατή με `CatalogFailure` και `SubcontractFailure`. */
export interface DraftFailure<I> {
  readonly kind: string;
  readonly issues: readonly I[];
  readonly currentRevision?: number | null;
}

export type DraftOutcome<R, I> =
  | { readonly ok: true; readonly record: R }
  | { readonly ok: false; readonly failure: DraftFailure<I> };

export interface RevisionedDraft<D, I> {
  readonly draft: D;
  readonly update: (next: D) => void;
  /** Πίσω στη ζωντανή βάση (απόρριψη αλλαγών · «φόρτωσε τη νέα εκδοχή»). */
  readonly discard: () => void;
  readonly dirty: boolean;
  /** Βρώμικο **και όχι** σε αποστολή: ό,τι θα χανόταν αν ο άνθρωπος έφευγε τώρα. */
  readonly unsaved: boolean;
  /** Η αναθεώρηση πάνω στην οποία χτίστηκε το πρόχειρο (`null` = νέα οντότητα) — η βάση του CAS. */
  readonly baseRevision: number | null;
  /** Το πρόχειρο χτίστηκε πάνω σε **παλιότερη** αναθεώρηση από τη ζωντανή, ή ο γραφέας απάντησε 409 (`hold`). */
  readonly behind: boolean;
  /** «Κράτα τις αλλαγές μου»: η νεότερη γνωστή αναθεώρηση γίνεται βάση του CAS (μόνο `hold`). */
  readonly adoptLatestBase: () => void;
  readonly status: DraftStatus;
  readonly serverIssues: readonly I[];
  /** Η **νέα** οντότητα που ΑΥΤΟ το πρόχειρο έστειλε — `null` για υπάρχουσα, πριν από την αποστολή ή μετά από άρνηση. */
  readonly created: D | null;
  /** Σημειώνει «στέλνεται» και επιστρέφει τον χειριστή του αποτελέσματος. */
  readonly beginSave: <R>(onSaved?: (record: R) => void) => (outcome: DraftOutcome<R, I>) => void;
}

interface Latest<D> {
  readonly base: D;
  readonly revision: number | null;
  readonly draft: D;
}

interface DraftState<D, I> {
  readonly latest: MutableRefObject<Latest<D>>;
  readonly draft: D;
  readonly setDraft: (draft: D) => void;
  readonly status: DraftStatus;
  readonly setStatus: (status: DraftStatus) => void;
  readonly baseRevision: number | null;
  readonly setBaseRevision: (revision: number | null) => void;
  readonly setServerIssues: (issues: readonly I[]) => void;
  readonly setCreated: (created: D | null) => void;
  readonly conflictRevision: number | null;
  readonly setConflictRevision: (revision: number | null) => void;
}

/** «Στέλνεται» → αποτέλεσμα. Νέα οντότητα (`revision === null`) ⇒ το σταλμένο πρόχειρο γίνεται `created` ώσπου να αρνηθεί ο γραφέας. */
function useBeginSave<D, I>(state: DraftState<D, I>, policy: DraftConflictPolicy): RevisionedDraft<D, I>['beginSave'] {
  const { latest, setStatus, setDraft, setBaseRevision, setServerIssues, setCreated, setConflictRevision } = state;
  return useCallback(<R,>(onSaved?: (record: R) => void) => {
    setStatus('saving');
    if (latest.current.revision === null) setCreated(latest.current.draft);
    return (outcome: DraftOutcome<R, I>) => {
      if (outcome.ok) {
        setStatus('saved');
        setConflictRevision(null);
        onSaved?.(outcome.record);
        return;
      }
      setStatus('dirty');
      setCreated(null);
      if (outcome.failure.kind !== 'revisionMismatch') return void setServerIssues(outcome.failure.issues);
      if (policy === 'hold') return void setConflictRevision(outcome.failure.currentRevision ?? latest.current.revision);
      setDraft(latest.current.base);
      setBaseRevision(latest.current.revision);
    };
  }, [latest, policy, setStatus, setDraft, setBaseRevision, setServerIssues, setCreated, setConflictRevision]);
}

interface Seen<D> {
  readonly identity: string;
  readonly base: D;
  readonly revision: number | null;
}

/**
 * Προσαρμογή κατά την απόδοση όταν αλλάζει η βάση (React: «adjusting state when a prop changes») — χωρίς effect,
 * χωρίς τρεμόπαιγμα. Άλλη οντότητα ⇒ νέο πρόχειρο· καθαρό ⇒ ακολουθεί· βρώμικο ⇒ κρατά τη βάση που διάβασε.
 */
function useFollowBase<D, I>(state: DraftState<D, I>, identity: string, base: D, revision: number | null): void {
  const [seen, setSeen] = useState<Seen<D>>({ identity, base, revision });
  if (seen.identity === identity && seen.revision === revision && dequal(seen.base, base)) return;
  const switched = seen.identity !== identity;
  const followLive = !switched && state.status !== 'saving' && dequal(state.draft, seen.base);
  setSeen({ identity, base, revision });
  if (switched || followLive) {
    state.setDraft(base);
    state.setServerIssues([]);
    state.setConflictRevision(null);
    if (switched) {
      state.setStatus('clean');
      state.setCreated(null);
    }
  }
  // Η βάση του CAS προχωρά μόνο όταν το πρόχειρο ΕΙΝΑΙ η νέα εκδοχή (ακολούθησε, ή έγινε ίδιο — π.χ. η δική μας εγγραφή).
  if (switched || followLive || dequal(state.draft, base)) state.setBaseRevision(revision);
}

function useDraftState<D, I>(base: D, revision: number | null): DraftState<D, I> & { readonly serverIssues: readonly I[]; readonly created: D | null } {
  const [draft, setDraft] = useState(base);
  const [baseRevision, setBaseRevision] = useState(revision);
  const [serverIssues, setServerIssues] = useState<readonly I[]>([]);
  const [status, setStatus] = useState<DraftStatus>('clean');
  const [created, setCreated] = useState<D | null>(null);
  const [conflictRevision, setConflictRevision] = useState<number | null>(null);
  const latest = useRef<Latest<D>>({ base, revision, draft });
  latest.current = { base, revision, draft };
  return {
    latest, draft, setDraft, status, setStatus, baseRevision, setBaseRevision, serverIssues, setServerIssues,
    created, setCreated, conflictRevision, setConflictRevision,
  };
}

const newest = (a: number | null, b: number | null): number | null => (a === null ? b : b === null ? a : Math.max(a, b));

/**
 * `identity` = ποια οντότητα επεξεργάζεται (id ή `new`): αλλαγή ⇒ νέο πρόχειρο από τη βάση.
 * `revision` = η αναθεώρηση της βάσης (`null` για νέα οντότητα). `policy` = τι κάνει το 409 (εξ ορισμού `reset`).
 */
export function useRevisionedDraft<D, I>(base: D, identity: string, revision: number | null = null, policy: DraftConflictPolicy = 'reset'): RevisionedDraft<D, I> {
  const state = useDraftState<D, I>(base, revision);
  useFollowBase(state, identity, base, revision);
  const { latest, setDraft, setServerIssues, setStatus, setBaseRevision, setConflictRevision } = state;

  const update = useCallback((next: D) => {
    setDraft(next);
    setServerIssues([]);
    setStatus('dirty');
  }, [setDraft, setServerIssues, setStatus]);
  const discard = useCallback(() => {
    setDraft(latest.current.base);
    setBaseRevision(latest.current.revision);
    setServerIssues([]);
    setConflictRevision(null);
    setStatus('clean');
  }, [latest, setDraft, setBaseRevision, setServerIssues, setConflictRevision, setStatus]);
  const { conflictRevision } = state;
  const adoptLatestBase = useCallback(() => {
    setBaseRevision(newest(conflictRevision, latest.current.revision));
    setConflictRevision(null);
  }, [latest, conflictRevision, setBaseRevision, setConflictRevision]);

  const beginSave = useBeginSave(state, policy);
  return useMemo(() => {
    const dirty = !dequal(state.draft, state.created ?? base);
    const shown: DraftStatus = state.status === 'saving' ? 'saving' : dirty ? 'dirty' : state.status === 'saved' ? 'saved' : 'clean';
    const behind = conflictRevision !== null || (dirty && state.baseRevision !== null && revision !== null && state.baseRevision < revision);
    return {
      draft: state.draft, update, discard, dirty, unsaved: shown === 'dirty', baseRevision: state.baseRevision, behind,
      adoptLatestBase, status: shown, serverIssues: state.serverIssues, created: state.created, beginSave,
    };
  }, [state.draft, state.created, state.status, state.baseRevision, state.serverIssues, base, revision, conflictRevision, update, discard, adoptLatestBase, beginSave]);
}

const NO_ISSUES: readonly never[] = [];

/**
 * **Ανέγγιχτη φόρμα δεν «κοκκινίζει»** — η ΜΙΑ απόφαση για κάθε επεξεργαστή: τα ευρήματα φαίνονται από την πρώτη
 * αλλαγή ή την απάντηση του γραφέα. `immediate` = ευρήματα που φαίνονται ΑΜΕΣΑ — σταθερή αναφορά (ορισμός σε επίπεδο αρχείου).
 */
export function useShownDraftIssues<I>(
  editor: { readonly dirty: boolean; readonly serverIssues: readonly I[] },
  clientIssues: readonly I[],
  immediate?: (issue: I) => boolean,
): readonly I[] {
  const touched = editor.dirty || editor.serverIssues.length > 0;
  const { serverIssues } = editor;
  return useMemo(() => {
    if (touched) return [...clientIssues, ...serverIssues];
    return immediate ? clientIssues.filter(immediate) : NO_ISSUES;
  }, [touched, clientIssues, serverIssues, immediate]);
}
