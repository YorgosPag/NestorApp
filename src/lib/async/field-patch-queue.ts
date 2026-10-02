/**
 * @fileoverview **ΣΕΙΡΙΑΚΗ ΟΥΡΑ ΜΕΡΙΚΩΝ ΔΙΟΡΘΩΣΕΩΝ, ΜΕ ΑΙΣΙΟΔΟΞΗ ΕΠΙΚΑΛΥΨΗ** — αποθήκευση **ανά απάντηση** όπως το
 * Google Docs, πάνω σε έναν ζωντανό αναγνώστη που μένει η πηγή αλήθειας (ADR-898 Φ3β-2). Γενικό· χωρίς DOM, χωρίς React.
 * @related `hooks/useFieldPatchQueue.ts` (ο React δέτης) · `components/owner-property/improve/` (πρώτος καταναλωτής) ·
 *   αδελφός του `hooks/useAutoSave.ts` (ADR-248) — εκείνο αποθηκεύει **ΟΛΟΚΛΗΡΟ** έγγραφο με debounce, αυτό
 *   **μόνο τα πεδία που άλλαξαν**, ώστε να μην ξαναγράφει ό,τι άλλαξε άλλη καρτέλα.
 * @module lib/async/field-patch-queue
 *
 * 🔑 **Ένα αίτημα στον αέρα.** Ό,τι έρθει στο μεταξύ **συγχωνεύεται** (τελευταίο ανά πεδίο) και φεύγει σε **ένα**
 *   επόμενο αίτημα. Ζώνη + τιράντες πάνω από τη συναλλαγή του server: η σειρά των απαντήσεων είναι η σειρά της οθόνης.
 * 🔑 **Επικάλυψη, όχι αντίγραφο.** Η οθόνη δείχνει «αλήθεια του αναγνώστη + ό,τι δεν επιβεβαιώθηκε ακόμη». Τρία
 *   στρώματα: `acknowledged` (ο server είπε ναι, ο αναγνώστης δεν το έφερε ακόμη) · `inflight` · `queued`. Το πρώτο
 *   σβήνει όταν ο αναγνώστης φέρει νέα κατάσταση ({@link FieldPatchQueue.sourceChanged}) — ποτέ αναβόσβημα στην παλιά τιμή.
 * 🔑 **Αποτυχία ⇒ επαναφορά.** Το κομμάτι που απέτυχε φεύγει από την επικάλυψη (η οθόνη γυρίζει στην αλήθεια) και
 *   μένει ως `failure` — με δυνατότητα επανάληψης όταν φταίει το δίκτυο, με τους κωδικούς όταν το αρνήθηκε ο server.
 * 🔑 **Ιδεμπότητο**: κάθε διόρθωση είναι «θέσε τιμή» ⇒ η επανάληψη δίνει το ίδιο αποτέλεσμα.
 */

import { createExternalStore } from '@/lib/state/createExternalStore';

export type FieldPatchOutcome<R> =
  | { readonly kind: 'saved' }
  /** Ο server απάντησε «όχι» με κωδικούς (π.χ. 422) — η επανάληψη ΔΕΝ θα βοηθούσε. */
  | { readonly kind: 'rejected'; readonly reasons: readonly R[] }
  /** Δίκτυο / 5xx — η επανάληψη μπορεί να βοηθήσει. */
  | { readonly kind: 'failed' };

export type FieldPatchStatus = 'idle' | 'saving' | 'success' | 'error';

export interface FieldPatchFailure<P, R> {
  readonly patch: P;
  readonly outcome: Exclude<FieldPatchOutcome<R>, { readonly kind: 'saved' }>;
}

export interface FieldPatchQueueSnapshot<P, R> {
  /** Ό,τι δεν έχει φτάσει ακόμη από τον αναγνώστη — η οθόνη το απλώνει πάνω στην αλήθεια. */
  readonly overlay: P | null;
  readonly status: FieldPatchStatus;
  readonly failure: FieldPatchFailure<P, R> | null;
  /** `Date.now()` της τελευταίας επιτυχίας. */
  readonly lastSavedAt: number | null;
}

export interface FieldPatchQueue<P, R> {
  enqueue(patch: P): void;
  /** Ξαναστέλνει το κομμάτι που απέτυχε (μόνο για `failed`)· νεότερες απαντήσεις στα ίδια πεδία νικούν. */
  retry(): void;
  dismissFailure(): void;
  /** Ο αναγνώστης έφερε νέα κατάσταση ⇒ ό,τι επιβεβαίωσε ο server δεν χρειάζεται πια επικάλυψη. */
  sourceChanged(): void;
  /** Υπάρχει κάτι που δεν έχει φύγει ή δεν έχει απαντηθεί (για προειδοποίηση πριν κλείσει η σελίδα). */
  isBusy(): boolean;
  subscribe(listener: () => void): () => void;
  getSnapshot(): FieldPatchQueueSnapshot<P, R>;
}

export type FieldPatchSend<P, R> = (patch: P) => Promise<FieldPatchOutcome<R>>;

type Layer<P> = P | null;

function merged<P extends object>(...layers: readonly Layer<P>[]): Layer<P> {
  const present = layers.filter((layer): layer is P => layer !== null);
  return present.length === 0 ? null : present.reduce((into, layer) => ({ ...into, ...layer }));
}

/** Τα κλειδιά του `patch` που **δεν** καλύπτει το `newer` — `null` όταν δεν μένει κανένα. */
function withoutKeysOf<P extends object>(patch: P, newer: P): Layer<P> {
  const rest = Object.fromEntries(Object.entries(patch).filter(([key]) => !(key in newer)));
  return Object.keys(rest).length === 0 ? null : (rest as P);
}

interface QueueState<P, R> {
  acknowledged: Layer<P>;
  inflight: Layer<P>;
  queued: Layer<P>;
  status: FieldPatchStatus;
  failure: FieldPatchFailure<P, R> | null;
  lastSavedAt: number | null;
}

class SerialFieldPatchQueue<P extends object, R> implements FieldPatchQueue<P, R> {
  private readonly state: QueueState<P, R> = {
    acknowledged: null,
    inflight: null,
    queued: null,
    status: 'idle',
    failure: null,
    lastSavedAt: null,
  };
  /** Η δημοσίευση ζει στο κοινό pub/sub κελί (SSoT `create-external-store`) — εδώ μόνο η πολιτική της ουράς. */
  private readonly store = createExternalStore<FieldPatchQueueSnapshot<P, R>>(snapshotOf(this.state));

  constructor(private readonly send: FieldPatchSend<P, R>) {}

  enqueue(patch: P): void {
    const { state } = this;
    state.queued = merged(state.queued, patch);
    const failure = state.failure;
    const rest = failure === null ? null : withoutKeysOf(failure.patch, patch);
    state.failure = failure === null || rest === null ? null : { ...failure, patch: rest };
    this.pump();
  }

  retry(): void {
    const { state } = this;
    const failure = state.failure;
    if (failure === null || failure.outcome.kind !== 'failed') return;
    state.failure = null;
    state.queued = merged(failure.patch, state.queued);
    this.pump();
  }

  dismissFailure(): void {
    const { state } = this;
    if (state.failure === null) return;
    state.failure = null;
    if (state.status === 'error') state.status = 'idle';
    this.publish();
  }

  sourceChanged(): void {
    if (this.state.acknowledged === null) return;
    this.state.acknowledged = null;
    this.publish();
  }

  isBusy(): boolean {
    return this.state.inflight !== null || this.state.queued !== null;
  }

  subscribe(listener: () => void): () => void {
    return this.store.subscribe(listener);
  }

  getSnapshot(): FieldPatchQueueSnapshot<P, R> {
    return this.store.get();
  }

  private publish(): void {
    this.store.set(snapshotOf(this.state));
  }

  private pump(): void {
    const { state } = this;
    const patch = state.queued;
    if (state.inflight !== null || patch === null) {
      this.publish();
      return;
    }
    state.inflight = patch;
    state.queued = null;
    state.status = 'saving';
    this.publish();
    this.send(patch).then(
      (outcome) => this.settle(patch, outcome),
      () => this.settle(patch, { kind: 'failed' }),
    );
  }

  private settle(patch: P, outcome: FieldPatchOutcome<R>): void {
    const { state } = this;
    state.inflight = null;
    if (outcome.kind === 'saved') {
      state.acknowledged = merged(state.acknowledged, patch);
      state.lastSavedAt = Date.now();
    } else {
      state.failure = { patch, outcome };
    }
    state.status = state.queued !== null ? 'saving' : state.failure !== null ? 'error' : 'success';
    this.pump();
  }
}

/** Μία ουρά ανά έγγραφο. `send` δεν πρέπει να ρίχνει — αν ρίξει, μετρά ως `failed`. */
export function createFieldPatchQueue<P extends object, R>(send: FieldPatchSend<P, R>): FieldPatchQueue<P, R> {
  return new SerialFieldPatchQueue(send);
}

function snapshotOf<P extends object, R>(state: QueueState<P, R>): FieldPatchQueueSnapshot<P, R> {
  return {
    overlay: merged(state.acknowledged, state.inflight, state.queued),
    status: state.status,
    failure: state.failure,
    lastSavedAt: state.lastSavedAt,
  };
}
