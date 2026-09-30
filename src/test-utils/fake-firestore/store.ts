/**
 * @fileoverview **Ο χώρος αποθήκευσης** του ψεύτικου Firestore + το **ΕΝΑ** σημείο καταγραφής εγγραφών.
 *
 * Επίπεδος `Map<διαδρομή συλλογής, Map<id, έγγραφο>>`. Η ένθεση εκφράζεται ως **κλειδί με διαδρομή**
 * (`companies/c/projects/p/members`), όπως το αληθινό `ref.path` — έτσι η υποσυλλογή **ενός** γονέα δεν επιστρέφει
 * ποτέ έγγραφο **άλλου** (ADR-862 Φ0 Β7 · ADR-884 Κ2).
 *
 * Κάθε εγγραφή κώδικα περνά από το {@link FakeStore.record}, που κρατά **και** τις δύο όψεις που ζητούσαν τα δύο
 * παλιά fakes: τον **μετρητή** `writes` («πόσες πράξεις;») και το **ημερολόγιο** («ποιες, με ποια σειρά;» — μια διαδρομή
 * `Promise<void>` που έπρεπε να αρνηθεί και έγραψε είναι διαρροή που μόνο η παρενέργεια δείχνει, ADR-742 §7duodecies).
 *
 * @module test-utils/fake-firestore/store
 */

import type { Doc } from './values';

/** Μια εγγραφή που όντως έφτασε στη «βάση». Το `create` καταγράφεται ως `set` — η διάκρισή του ζει στη ρίψη. */
export interface FakeWriteRecord {
  readonly kind: 'set' | 'update' | 'delete';
  readonly collection: string;
  readonly docId: string;
  readonly data?: Doc;
}

export class FakeStore {
  private readonly buckets = new Map<string, Map<string, Doc>>();
  private readonly journal: FakeWriteRecord[] = [];
  /** Πόσες εγγραφές έγιναν (κάθε πράξη αναφοράς + μία ανά `commit` δέσμης). */
  public writes = 0;

  /** Ο κάδος μιας συλλογής — δημιουργείται κενός στην πρώτη ζήτηση, όπως μια συλλογή «υπάρχει» σε κάθε διαδρομή. */
  bucket(path: string): Map<string, Doc> {
    const existing = this.buckets.get(path);
    if (existing !== undefined) return existing;
    const created = new Map<string, Doc>();
    this.buckets.set(path, created);
    return created;
  }

  /** Αντικατάσταση ολόκληρης συλλογής (σπορά). */
  replaceBucket(path: string, docs: Map<string, Doc>): void {
    this.buckets.set(path, docs);
  }

  /** Κάθε διαδρομή συλλογής που τελειώνει στο όνομα — η σάρωση ενός `collectionGroup`. */
  groupPaths(name: string): string[] {
    return [...this.buckets.keys()].filter((path) => path === name || path.endsWith(`/${name}`));
  }

  /** Τι λέει **τώρα** ο δίσκος για ένα έγγραφο — σειριοποιημένο, για τον έλεγχο φρεσκάδας της συναλλαγής. */
  snapshotOf(path: string, id: string): string {
    return JSON.stringify(this.bucket(path).get(id) ?? null);
  }

  record(entry: FakeWriteRecord): void {
    this.writes += 1;
    this.journal.push(entry);
  }

  countOnly(): void {
    this.writes += 1;
  }

  writeLog(): readonly FakeWriteRecord[] {
    return this.journal;
  }

  clearWriteLog(): void {
    this.journal.length = 0;
  }

  clear(): void {
    this.buckets.clear();
    this.journal.length = 0;
    this.writes = 0;
  }
}

/** Ό,τι χρειάζονται οι αναφορές από τη «βάση» — χωρίς να εισάγουν την ίδια την κλάση (καμία κυκλική εξάρτηση). */
export interface FakeContext {
  readonly store: FakeStore;
  /** Συνάρτηση, όχι τιμή: ο διακόπτης βλάβης γυρίζει **μετά** τη δημιουργία των αναφορών. */
  readonly failing: () => boolean;
}

/** Η βλάβη ανάγνωσης — «δεν μάθαμε» ≠ «δεν υπάρχει» (ADR-749 §5). */
export const FAKE_UNAVAILABLE = 'FAKE_FIRESTORE_UNAVAILABLE';

export function assertReadable(ctx: FakeContext): void {
  if (ctx.failing()) throw new Error(FAKE_UNAVAILABLE);
}

/** Σφάλμα με κωδικό gRPC, όπως το SDK (6 = ALREADY_EXISTS, 5 = NOT_FOUND, 10 = ABORTED) — ADR-864 §20. */
export function grpcError(code: 5 | 6 | 10, name: string, detail: string): Error {
  return Object.assign(new Error(`${name}: ${detail}`), { code });
}
