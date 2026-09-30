/**
 * @fileoverview **Η συναλλαγή**: αναγνώσεις που **καταγράφονται**, γραφές που **αναβάλλονται** ως το commit.
 *
 * 🔑 Ο κύκλος (ADR-827 §9.21): εκτέλεσε το σώμα· πριν το commit, έλεγξε ότι **κάθε** έγγραφο που διαβάστηκε είναι
 * ακόμη όπως το είδαμε· αλλιώς **ξαναεκτέλεσε** — όπως το αληθινό. Ένα fake που απλώς σειριοποιεί θα ήταν **πιο
 * συγχωρητικό** από την παραγωγή: δεν θα έδειχνε ποτέ ότι το σώμα τρέχει δύο φορές (παρενέργεια μέσα σε συναλλαγή
 * φεύγει πολλές φορές).
 *
 * ⚠️ Δηλωμένα όρια (πίνακας `DECLARED_DEVIATIONS` του συμβολαίου): **δεν** επιβάλλει «όλα τα get πριν από κάθε write»·
 * **δεν** πιάνει phantom reads (νέο έγγραφο που αρχίζει να ταιριάζει σε ερώτημα)· το commit είναι σειριακό, όχι ατομικό.
 *
 * @module test-utils/fake-firestore/transaction
 */

import { grpcError, type FakeStore } from './store';
import { FakeQuery, type FakeDocRef, type FakeDocSnapshot, type FakeQuerySnapshot } from './refs';
import type { Doc } from './values';

/** Ο ανταγωνιστής (`FakeFirestore.interfere`): χτυπά **μία** φορά, ανάμεσα στην πρώτη ανάγνωση και στο commit. */
export interface CompetitorSlot {
  interfere: (() => void) | null;
}

export class FakeTransaction {
  private readonly reads = new Map<string, string>();
  private readonly pending: (() => Promise<void>)[] = [];
  private struck = false;

  constructor(
    private readonly store: FakeStore,
    private readonly competitor: CompetitorSlot,
  ) {}

  async get(ref: FakeQuery): Promise<FakeQuerySnapshot>;
  async get(ref: FakeDocRef): Promise<FakeDocSnapshot>;
  async get(ref: FakeDocRef | FakeQuery): Promise<FakeDocSnapshot | FakeQuerySnapshot> {
    if (ref instanceof FakeQuery) return this.getByQuery(ref);
    const snapshot = await ref.get();
    // 🔴 Καταγράφεται ό,τι **επέστρεψε** η ανάγνωση — όχι ό,τι λέει ο δίσκος τώρα: με δύο `get` σε `Promise.all` ο
    //    ανταγωνιστής προλαβαίνει ανάμεσά τους και ο έλεγχος θα συνέκρινε το νέο με το νέο (το βρήκε η άγκυρα Α2).
    this.reads.set(ref.path, JSON.stringify(snapshot.data() ?? null));
    this.letCompetitorStrike();
    return snapshot;
  }

  /** N έγγραφα, σειρά ένα-προς-ένα με τις αναφορές (και για τα ανύπαρκτα) — ADR-867 Β9(β) Ε9. */
  async getAll(...refs: readonly FakeDocRef[]): Promise<FakeDocSnapshot[]> {
    const snapshots: FakeDocSnapshot[] = [];
    for (const ref of refs) snapshots.push(await this.get(ref));
    return snapshots;
  }

  /** Ερώτημα μέσα σε συναλλαγή (ADR-853 Φ2): καταγράφεται **κάθε** έγγραφο που επέστρεψε. */
  private async getByQuery(query: FakeQuery): Promise<FakeQuerySnapshot> {
    const result = await query.get();
    for (const doc of result.docs) this.reads.set(doc.ref.path, JSON.stringify(doc.data() ?? null));
    this.letCompetitorStrike();
    return result;
  }

  private letCompetitorStrike(): void {
    if (this.struck || this.competitor.interfere === null) return;
    this.struck = true;
    const strike = this.competitor.interfere;
    this.competitor.interfere = null;
    strike();
  }

  set(ref: FakeDocRef, doc: Doc, options?: { readonly merge?: boolean }): FakeTransaction {
    this.pending.push(() => ref.set(doc, options));
    return this;
  }

  update(ref: FakeDocRef, patch: Doc): FakeTransaction {
    this.pending.push(() => ref.update(patch));
    return this;
  }

  /** `ALREADY_EXISTS` στο commit απορρίπτει το `runTransaction` — ποτέ σιωπηλή αντικατάσταση (ADR-862 Φ0 Β14). */
  create(ref: FakeDocRef, doc: Doc): FakeTransaction {
    this.pending.push(() => ref.create(doc));
    return this;
  }

  delete(ref: FakeDocRef): FakeTransaction {
    this.pending.push(() => ref.delete());
    return this;
  }

  /** Είναι ακόμη αληθινό ό,τι διαβάσαμε; `lastIndexOf`, όχι `split` — το κλειδί υποσυλλογής έχει πολλές `/`. */
  readsAreStillValid(): boolean {
    for (const [key, seen] of this.reads) {
      const cut = key.lastIndexOf('/');
      if (this.store.snapshotOf(key.slice(0, cut), key.slice(cut + 1)) !== seen) return false;
    }
    return true;
  }

  /** Περιμένει και **μεταφέρει** την αποτυχία (ADR-841 §7 Α22): μια απορριφθείσα γραφή απορρίπτει το `runTransaction`. */
  async flush(): Promise<void> {
    for (const apply of this.pending) await apply();
  }
}

/** Πόσες φορές ξαναδοκιμάζει το σώμα, όπως το Admin SDK. */
export const TRANSACTION_ATTEMPTS = 5;

export async function runFakeTransaction<T>(
  store: FakeStore,
  competitor: CompetitorSlot,
  body: (transaction: FakeTransaction) => Promise<T>,
  maxAttempts: number = TRANSACTION_ATTEMPTS,
): Promise<T> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const transaction = new FakeTransaction(store, competitor);
    const result = await body(transaction);
    if (transaction.readsAreStillValid()) {
      await transaction.flush();
      return result;
    }
  }
  // Το αληθινό πετά `ABORTED` όταν εξαντληθούν οι προσπάθειες — ποτέ «αποτέλεσμα» από εκτέλεση που δεν έγραψε τίποτα.
  throw grpcError(10, 'ABORTED', 'too much contention');
}
