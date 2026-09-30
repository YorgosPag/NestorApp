/**
 * @fileoverview **ΤΟ ψεύτικο Firestore των tests** — ένα, όχι τρία (ADR-742 §7sexdecies).
 *
 * Υπερσύνολο των τριών που υπήρχαν ως 2026-09-30 (`test-utils/mock-firestore` · `places/__tests__/fake-firestore` ·
 * `lib/oauth/__tests__/fake-firestore`), που υλοποιούσαν ανεξάρτητα το ίδιο συμβόλαιο και **απέκλιναν σιωπηλά**
 * (ADR-890 §17.4: και τα δύο μεγάλα ήταν τυφλά στο «το `orderBy` κρύβει έγγραφα»).
 *
 * 🔑 **VERIFIED FAKE**: η σουίτα συμβολαίου `contract/firestore-contract.ts` τρέχει **και εδώ** (unit jest) **και** στον
 * Firestore emulator με το Admin SDK (`tests/firestore-contract/`). Ό,τι ισχυρίζεται το συμβόλαιο δεν μπορεί να
 * αποκλίνει από το αληθινό χωρίς κόκκινο· ό,τι **σκόπιμα** αποκλίνει ζει στον πίνακα `DECLARED_DEVIATIONS`, με λόγο.
 *
 * ⚠️ Ό,τι αφορά **κανόνες πρόσβασης** δοκιμάζεται σε πραγματικό emulator (`tests/firestore-rules/`), όχι εδώ.
 *
 * @module test-utils/fake-firestore/fake-firestore
 * @see adrs/ADR-742 §7sexdecies
 */

import { FakeStore, type FakeContext, type FakeWriteRecord } from './store';
import { FakeCollection, FakeDocRef, FakeQuery, type FakeDocSnapshot } from './refs';
import { runFakeTransaction, type FakeTransaction } from './transaction';
import { FakeBatch } from './batch';
import type { Doc } from './values';

export type { FakeWriteRecord } from './store';
export type { FakeDocSnapshot, FakeQueryDocSnapshot, FakeQuerySnapshot } from './refs';
export { FakeCollection, FakeDocRef, FakeQuery } from './refs';
export type { FakeTransaction } from './transaction';
export type { FakeBatch } from './batch';

export class FakeFirestore {
  private readonly store = new FakeStore();
  private readonly ctx: FakeContext = { store: this.store, failing: () => this.failReads };

  /** Η βάση **δεν απαντά**: κάθε ανάγνωση πετά — «δεν μάθαμε» ≠ «δεν υπάρχει» χρειάζεται απόδειξη ζωής (ADR-749 §5). */
  public failReads = false;

  /**
   * **Ο ανταγωνιστής** (ADR-827 §9.21): καλείται μία φορά, αμέσως μετά την πρώτη ανάγνωση μιας συναλλαγής, και
   * μηδενίζεται — «ο συνάδελφος πρόλαβε ανάμεσα στο `get` και στο `commit`», το σενάριο που το CAS υπάρχει να πιάσει.
   */
  public interfere: (() => void) | null = null;

  /** Πόσες εγγραφές έγιναν — οι άγκυρες μετρούν **πράξεις**, όχι μόνο κατάσταση. */
  get writes(): number {
    return this.store.writes;
  }

  // ── επιφάνεια Admin SDK ────────────────────────────────────────────────────────────────────────────────────────

  collection(path: string): FakeCollection {
    return new FakeCollection(this.ctx, path);
  }

  /** Κάθε συλλογή με αυτό το τελικό όνομα, κάτω από οποιονδήποτε γονέα (ADR-884 Κ3α). */
  collectionGroup(name: string): FakeQuery {
    return FakeQuery.group(this.ctx, name);
  }

  batch(): FakeBatch {
    return new FakeBatch(this.store);
  }

  runTransaction<T>(body: (transaction: FakeTransaction) => Promise<T>, options?: { readonly maxAttempts?: number }): Promise<T> {
    return runFakeTransaction(this.store, this, body, options?.maxAttempts);
  }

  /**
   * `db.getAll(...refs, readOptions?)` — snapshot **και για τα ανύπαρκτα**, σειρά ένα-προς-ένα· τελευταίο όρισμα
   * `{ fieldMask }` (ADR-890 §13, πρώτου επιπέδου πεδία).
   */
  async getAll(...args: readonly (FakeDocRef | { readonly fieldMask?: readonly string[] })[]): Promise<FakeDocSnapshot[]> {
    const refs = args.filter((arg): arg is FakeDocRef => arg instanceof FakeDocRef);
    const mask = args.find((arg): arg is { readonly fieldMask?: readonly string[] } => !(arg instanceof FakeDocRef))?.fieldMask;
    const snapshots = await Promise.all(refs.map((ref) => ref.get()));
    if (mask === undefined) return snapshots;
    return snapshots.map((snapshot) => ({ ...snapshot, data: () => maskDoc(snapshot.data(), mask) }));
  }

  // ── σπορά και ισχυρισμοί (όχι API του Firestore) ──────────────────────────────────────────────────────────────

  /** Ένα έγγραφο, ως έχει (χωρίς εγγραφή στον μετρητή/ημερολόγιο). */
  seed(collection: string, id: string, doc: Doc): void {
    this.store.bucket(collection).set(id, doc);
  }

  /** Ολόκληρη συλλογή — **αντικαθιστά** ό,τι υπήρχε, με αντίγραφα των εγγράφων. */
  seedCollection(collection: string, docs: Record<string, Doc>): void {
    this.store.replaceBucket(collection, new Map(Object.entries(docs).map(([id, doc]) => [id, { ...doc }])));
  }

  all<T>(collection: string): readonly T[] {
    return [...this.store.bucket(collection).values()] as T[];
  }

  getData(collection: string, id: string): Doc | undefined {
    return this.store.bucket(collection).get(id);
  }

  getAllDocs(collection: string): Record<string, Doc> {
    return Object.fromEntries(this.store.bucket(collection));
  }

  /** Ο **ζωντανός** κάδος μιας συλλογής (πλήρης διαδρομή) — για ισχυρισμούς/χειρισμούς πάνω στα κλειδιά. */
  pathBucket(fullPath: string): Map<string, Doc> {
    return this.store.bucket(fullPath);
  }

  snapshotOf(collection: string, id: string): string {
    return this.store.snapshotOf(collection, id);
  }

  /** Εγγραφή «από έξω» (π.χ. ο ανταγωνιστής): μετράει, αλλά **δεν** μπαίνει στο ημερολόγιο του κώδικα υπό δοκιμή. */
  write(collection: string, id: string, doc: Doc): void {
    this.store.bucket(collection).set(id, doc);
    this.store.countOnly();
  }

  /** Κάθε `set`/`update`/`delete` του κώδικα, με σειρά. **Μη κενό σε διαδρομή που όφειλε να αρνηθεί = διαρροή.** */
  writeLog(): readonly FakeWriteRecord[] {
    return this.store.writeLog();
  }

  /** Μηδενίζει το ημερολόγιο χωρίς να πειράξει δεδομένα ή μετρητή (setup vs act). */
  clearWriteLog(): void {
    this.store.clearWriteLog();
  }

  /**
   * **Άδειασε τα πάντα** — για σουίτες που μοιράζονται ένα στιγμιότυπο αιχμαλωτισμένο σε `jest.mock` (ADR-841 §7
   * Α21.12). Μηδενίζει δεδομένα, μετρητή, ημερολόγιο **και** διακόπτες: μισοκαθαρισμένη κατάσταση μοιάζει καθαρή.
   */
  reset(): void {
    this.store.clear();
    this.failReads = false;
    this.interfere = null;
  }
}

function maskDoc(data: Doc | undefined, mask: readonly string[]): Doc | undefined {
  return data === undefined ? undefined : Object.fromEntries(Object.entries(data).filter(([key]) => mask.includes(key)));
}
