'use client';

/**
 * @fileoverview **Αισιόδοξες εγγραφές καταλόγου με compare-and-swap** — Gmail/Docs: η αλλαγή φαίνεται αμέσως, ο
 *   διακομιστής μένει αυθεντία, η αποτυχία γυρίζει πίσω (ADR-923 §5.9 · Φάση 1γ).
 * @related hooks/document-registry/useSerialOptimistic.ts (ο μηχανισμός σειράς — επαναχρησιμοποιείται, όχι αντίγραφο) ·
 *   services/catalog/catalog-failure.ts (η ερμηνεία της άρνησης)
 * @module hooks/catalog/useCatalogOptimistic
 *
 * Τρεις στρώσεις, ένα αποτέλεσμα (`view`):
 *  1. **στιγμιότυπο** — ό,τι λέει τώρα η Firestore (ζωντανά).
 *  2. **επιβεβαιωμένα** — η απάντηση του γραφέα, ώσπου το στιγμιότυπο να τη φτάσει (αλλιώς η οθόνη θα «πηδούσε»
 *     πίσω για όσο αργεί το snapshot μετά το 200).
 *  3. **εκκρεμή** — η πράξη που μόλις έκανε ο άνθρωπος.
 *
 * 🔑 **Ο CAS στέλνει ό,τι ΔΙΑΒΑΣΕ ο άνθρωπος** (`baseRevision`, HTTP `If-Match`) — **ποτέ** το ζωντανό στιγμιότυπο: αυτό
 *    έχει ήδη φέρει την αλλαγή του άλλου, άρα «η νεότερη γνωστή αναθεώρηση» = «πάτα σιωπηλά τον άλλον» (μετρημένο
 *    ζωντανά σε δύο καρτέλες, ADR-923 §5.9.2). Η βάση προωθείται **μόνο** μέσα από την αλυσίδα των **δικών μας**
 *    επιτυχημένων εγγραφών (`από → σε`): δύο γρήγορες αλλαγές του ίδιου ανθρώπου δεν χτυπούν 409 η μία στην άλλη·
 *    αλλαγή **άλλου** χτυπά, όπως πρέπει. Οι πράξεις της ίδιας οντότητας τρέχουν **σειριακά** (`useSerialOptimistic`).
 * 🔑 **Αποτυχία ⇒ επαναφορά** (το εκκρεμές σβήνει, μένει το στιγμιότυπο) **και** ανάδραση: ο καλών παίρνει το
 *    αποτέλεσμα στο `onSettled` (ευρήματα δίπλα στο πεδίο), η οθόνη ειδοποιείται από το `onFailure`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useSerialOptimistic } from '@/hooks/document-registry/useSerialOptimistic';
import { catalogFailureOf, type CatalogFailure } from '@/services/catalog/catalog-failure';

export interface CatalogRecordLike {
  readonly id: string;
  readonly revision: number;
  readonly isDeleted: boolean;
}

export type CatalogOutcome<T> =
  | { readonly ok: true; readonly record: T }
  | { readonly ok: false; readonly failure: CatalogFailure };

export interface CatalogOperation<T> {
  /** Η οντότητα (id) — ή `new:<κωδικός>` για δημιουργία, όπου το id το δίνει ο διακομιστής. */
  readonly key: string;
  /** Τι δείχνει η οθόνη όσο εκκρεμεί· `null` = εξαφανίζεται (διαγραφή). */
  readonly optimistic: T | null;
  /** Η αναθεώρηση πάνω στην οποία χτίστηκε η πράξη — ό,τι είδε ο άνθρωπος (`null` = δημιουργία). */
  readonly baseRevision: number | null;
  /** Η εγγραφή, με την αναθεώρηση του CAS: η βάση, προωθημένη **μόνο** από δικές μας εγγραφές (`null` = νέα). */
  readonly send: (expectedRevision: number | null) => Promise<T>;
  readonly onSettled?: (outcome: CatalogOutcome<T>) => void;
}

export interface CatalogOptimistic<T> {
  /** Ό,τι δείχνουν οι λίστες: στιγμιότυπο + επιβεβαιωμένα + **εκκρεμή**. */
  readonly view: readonly T[];
  /**
   * Χωρίς τα εκκρεμή: η **βάση** ενός επεξεργαστή. Ο επεξεργαστής δεν πρέπει να βλέπει τη δική του αισιόδοξη εγγραφή
   * ως «αποθηκευμένη» — σε άρνηση 422 η επαναφορά της όψης θα έσβηνε το πρόχειρο του ανθρώπου.
   */
  readonly settled: readonly T[];
  readonly pendingKeys: ReadonlySet<string>;
  readonly submit: (operation: CatalogOperation<T>) => void;
}

/** Ποιες επιβεβαιώσεις έχει ήδη φτάσει το στιγμιότυπο — αυτές δεν χρειάζονται πια. */
function stillAhead<T extends CatalogRecordLike>(confirmed: ReadonlyMap<string, T>, records: readonly T[]): Map<string, T> {
  const live = new Map(records.map((record) => [record.id, record]));
  const next = new Map<string, T>();
  for (const [id, record] of confirmed) {
    const current = live.get(id);
    const caughtUp = record.isDeleted ? current === undefined : current !== undefined && current.revision >= record.revision;
    if (!caughtUp) next.set(id, record);
  }
  return next;
}

function mergeView<T extends CatalogRecordLike>(
  records: readonly T[],
  confirmed: ReadonlyMap<string, T>,
  pending: ReadonlyMap<string, CatalogOperation<T>>,
): T[] {
  const byId = new Map(records.map((record) => [record.id, record]));
  for (const [id, record] of confirmed) {
    const current = byId.get(id);
    if (!current || record.revision > current.revision) byId.set(id, record);
  }
  for (const [key, operation] of pending) {
    if (operation.optimistic === null) byId.delete(key);
    else byId.set(operation.optimistic.id, operation.optimistic);
  }
  return [...byId.values()].filter((record) => !record.isDeleted);
}

const NO_PENDING: ReadonlyMap<string, never> = new Map();

/** Η αλυσίδα των δικών μας εγγραφών ανά οντότητα: αναθεώρηση που ξεπεράσαμε → αναθεώρηση που γράψαμε. */
export type OwnWriteChain = ReadonlyMap<number, number>;

/** Η βάση, προωθημένη από τις **δικές μας** εγγραφές· ό,τι έγραψε άλλος δεν είναι ποτέ στην αλυσίδα. */
export function fastForwardOwnWrites(chain: OwnWriteChain | undefined, base: number | null): number | null {
  if (base === null || !chain) return base;
  let revision = base;
  for (let next = chain.get(revision); next !== undefined && next > revision; next = chain.get(revision)) revision = next;
  return revision;
}

function useOwnWrites() {
  const chains = useRef(new Map<string, Map<number, number>>());
  const expectedFor = useCallback((key: string, base: number | null) => fastForwardOwnWrites(chains.current.get(key), base), []);
  const record = useCallback((key: string, from: number | null, to: number) => {
    if (from === null) return;
    const chain = chains.current.get(key) ?? new Map<number, number>();
    chains.current.set(key, chain.set(from, to));
  }, []);
  return useMemo(() => ({ expectedFor, record }), [expectedFor, record]);
}

function useConfirmed<T extends CatalogRecordLike>(records: readonly T[]) {
  const [confirmed, setConfirmed] = useState<ReadonlyMap<string, T>>(new Map());
  useEffect(() => {
    // Ίδια αναφορά όταν τίποτα δεν «έφτασε» (το `stillAhead` μόνο αφαιρεί ⇒ ίδιο μέγεθος = ίδιο περιεχόμενο): οι καλούντες
    // περνούν ΝΕΟ πίνακα σε κάθε render (`[input.root]`) ⇒ νέο Map εδώ = νέο render = βρόχος, όσο η απάντηση προηγείται
    // του στιγμιοτύπου (ADR-923 §5.10.5 — «Maximum update depth» σε αργό δίκτυο).
    setConfirmed((prev) => {
      if (prev.size === 0) return prev;
      const next = stillAhead(prev, records);
      return next.size === prev.size ? prev : next;
    });
  }, [records]);
  const confirm = useCallback((record: T) => setConfirmed((prev) => new Map(prev).set(record.id, record)), []);
  return { confirmed, confirm };
}

export function useCatalogOptimistic<T extends CatalogRecordLike>(
  records: readonly T[],
  onFailure: (failure: CatalogFailure) => void,
): CatalogOptimistic<T> {
  const { confirmed, confirm } = useConfirmed(records);
  const ownWrites = useOwnWrites();

  const run = useCallback(
    async (key: string, operation: CatalogOperation<T>): Promise<void> => {
      try {
        const expected = ownWrites.expectedFor(key, operation.baseRevision);
        const record = await operation.send(expected);
        ownWrites.record(key, expected, record.revision);
        confirm(record);
        operation.onSettled?.({ ok: true, record });
      } catch (cause) {
        const failure = catalogFailureOf(cause);
        onFailure(failure);
        operation.onSettled?.({ ok: false, failure });
      }
    },
    [ownWrites, confirm, onFailure],
  );

  const { pending, submit: submitSerial } = useSerialOptimistic<CatalogOperation<T>>(run);
  const submit = useCallback((operation: CatalogOperation<T>) => submitSerial(operation.key, operation), [submitSerial]);
  const view = useMemo(() => mergeView(records, confirmed, pending), [records, confirmed, pending]);
  const settled = useMemo(() => mergeView(records, confirmed, NO_PENDING), [records, confirmed]);
  const pendingKeys = useMemo(() => new Set(pending.keys()), [pending]);
  return useMemo(() => ({ view, settled, pendingKeys, submit }), [view, settled, pendingKeys, submit]);
}
