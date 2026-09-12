/**
 * createPersistedValue — SSoT reactive + localStorage-persisted value (Zustand `persist`
 * middleware / VS Code Memento analog).
 *
 * Composes the TWO existing SSoT primitives — it re-implements NEITHER:
 *   • `createExternalStore` (WAVE 3, `@/lib/state`) — the zero-React pub/sub machinery.
 *   • `storage-utils` (ADR-092) `storageGet` / `storageSet` / `storageRemove` — the ONE
 *     SSR-safe + quota-guarded + JSON localStorage accessor.
 *
 * Before this, ~10+ module-level stores hand-rolled the SAME shape: an init that did
 * `typeof localStorage === 'undefined' ? default : JSON.parse(getItem(key)) ?? default`,
 * a mutator that did `setItem(key, JSON.stringify(next))` (± `removeItem` on default) inside
 * a try/catch, and the createExternalStore pub/sub. This factory collapses that to
 * `createPersistedValue(KEY, default, opts)` — hydrate-on-init + persist-on-change, ONCE.
 *
 * Returns the plain `ExternalStore<T>` shape, so domain-named wrappers
 * (`getX`/`setX`/`subscribeX`/`useX` via `useSyncExternalStore`) stay identical to the
 * hand-rolled stores — only the plumbing changes.
 *
 * Behaviour vs the hand-rolled stores:
 *   - Hydration: **LAZY** — `storageGet(key, default)` (SSR-safe, JSON) runs on the first
 *     `get`/`set`/`subscribe`, NOT at module-evaluation time (see the block comment on
 *     `hydrateOnce`: an eager read here crashed production with a TDZ ReferenceError once this
 *     factory landed inside an import cycle). `validate` then normalises a corrupt/out-of-range
 *     hydrated value (e.g. finite-&-positive) exactly like the old inits.
 *   - `set` runs the underlying `set` (honouring `equals`), then persists ONLY when the stored
 *     snapshot actually changed — so an `equals`-suppressed or same-value write never touches
 *     localStorage (byte-identical to the `if (next === current) return` guards).
 *   - `removeOnDefault` (identity `Object.is` vs `default`): mirrors the many stores that
 *     `removeItem` instead of writing the default back (keeps storage lean, default is implicit).
 *   - `reset`: delegates to `createExternalStore.reset` (state + drop subscribers, NO persist) —
 *     test/lifecycle only, matching every hand-rolled `__resetForTesting`.
 *
 * @see ./createExternalStore — reactive pub/sub SSoT
 * @see ../utils/storage-utils — localStorage SSoT (storageGet/storageSet/storageRemove)
 */

import { createExternalStore, type ExternalStore } from './createExternalStore';
import {
  storageGet,
  storageSet,
  storageRemove,
  storageGetString,
  storageSetString,
  type StorageKey,
} from '../utils/storage-utils';

export interface PersistedValueOptions<T> {
  /**
   * Change guard forwarded to `createExternalStore`. When it reports the next value equal to
   * the current, `set` is a no-op (no notify, no persist). Use `Object.is` for primitives.
   */
  readonly equals?: (a: T, b: T) => boolean;
  /**
   * When a `set` lands the value identity-equal (`Object.is`) to `defaultValue`, remove the key
   * instead of writing it — the default becomes implicit (re-hydrates via the `defaultValue`
   * fallback). Mirrors the hand-rolled `if (next === DEFAULT) removeItem(...)` stores. Identity
   * compare, so intended for primitive/sentinel defaults; omit for object snapshots.
   */
  readonly removeOnDefault?: boolean;
  /**
   * Normalise a hydrated value before it seeds the store — return the sanitised value (e.g.
   * clamp, coerce an unknown enum to the default, or fall back when non-finite). Runs on the
   * hydrated snapshot in BOTH the JSON and raw-string paths, not on later `set`s (mutators keep
   * their own domain validation). Defaults to identity.
   */
  readonly validate?: (hydrated: T) => T;
  /**
   * Raw-string codec (Zustand-parity). Provide BOTH `serialize` and `deserialize` to persist as
   * a BARE string instead of JSON — required to preserve a pre-existing non-JSON format (an enum
   * literal like `'mm'`, a legacy `'1'`/`'0'` flag) so existing users' stored values still
   * hydrate. Omit both ⇒ JSON via `storageGet`/`storageSet`. `deserialize` may throw on a corrupt
   * value → falls back to `defaultValue` (then `validate`).
   */
  readonly serialize?: (value: T) => string;
  readonly deserialize?: (raw: string) => T;
}

/**
 * Create a reactive, localStorage-persisted single value.
 *
 * @param key          localStorage key (ideally from `STORAGE_KEYS` in storage-utils).
 * @param defaultValue value used when nothing is stored / storage is unavailable.
 * @param options      see `PersistedValueOptions`.
 */
export function createPersistedValue<T>(
  key: StorageKey,
  defaultValue: T,
  options?: PersistedValueOptions<T>,
): ExternalStore<T> {
  const validate = options?.validate ?? ((v: T): T => v);
  // Raw-string codec active only when BOTH halves are supplied (preserve non-JSON formats).
  const codec = options?.serialize && options?.deserialize
    ? { serialize: options.serialize, deserialize: options.deserialize }
    : null;

  /**
   * Διαβάζει τον δίσκο και λέει **ΚΑΙ αν βρήκε κάτι**.
   *
   * 🔑 Το `found` δεν είναι διακόσμηση: χωρίς αυτό, η τεμπέλικη ενυδάτωση καλεί `store.set()`
   * ακόμη και όταν δεν υπάρχει τίποτα αποθηκευμένο — και το `createExternalStore` **χωρίς
   * `equals` ειδοποιεί σε κάθε `set`** ⇒ κάθε `useSyncExternalStore` συνδρομητής παίρνει ένα
   * **περιττό re-render** τη στιγμή που προσχωρεί. Το έπιασε το ίδιο το υπάρχον test
   * («persists on set and notifies subscribers»: περίμενε 1 ειδοποίηση, πήρε 2).
   */
  const hydrate = (): { found: boolean; value: T } => {
    const raw = storageGetString(key);
    if (raw === null) return { found: false, value: defaultValue };
    if (codec) {
      try {
        return { found: true, value: codec.deserialize(raw) };
      } catch {
        return { found: false, value: defaultValue }; // corrupt raw value → default
      }
    }
    return { found: true, value: storageGet<T>(key, defaultValue) };
  };

  /** Ο ίδιος φρουρός αλλαγής που βλέπει και το υποκείμενο store (ποτέ δεύτερη σημασιολογία). */
  const isUnchanged = options?.equals ?? Object.is;

  // 🔴 Ο ΔΙΣΚΟΣ ΔΕΝ ΔΙΑΒΑΖΕΤΑΙ ΕΔΩ — ΜΗΝ ΤΟ ΞΑΝΑΚΑΝΕΙΣ `createExternalStore(validate(hydrate()))`.
  //
  // Οι καταναλωτές γράφουν `const store = createPersistedValue(...)` σε module scope, άρα μια
  // ανάγνωση εδώ θα γινόταν σε **χρόνο αξιολόγησης module**. Αν αυτό το module βρεθεί μέσα σε
  // κύκλο εισαγωγών — και βρέθηκε — το `STORAGE_KEYS` που περνά ο καλών είναι ακόμα στη ζώνη
  // TDZ, και η παραγωγή σκάει με `Cannot access 'o' before initialization` **στην αρχικοποίηση
  // ολόκληρου του chunk**: δηλαδή ρίχνει σελίδες που δεν ακουμπούν καν τον viewer.
  //
  // Ίδιο μοτίβο και ίδιο σκεπτικό με το `state/table-border-pencil-store.ts` (που το έγραψε
  // για SSR hydration mismatch). Η τεμπέλικη ανάγνωση λύνει **και τα δύο**: πρώτη χρήση =
  // χειρισμός συμβάντος ή effect, ποτέ import.
  // @see ADR-858 — Levelization & αρχή αξιολόγησης modules
  const store = createExternalStore<T>(
    validate(defaultValue),
    options?.equals ? { equals: options.equals } : undefined,
  );

  let hydrated = false;

  /**
   * Διαβάζει τον δίσκο **μία φορά**, την πρώτη φορά που κάποιος ζητά ή αλλάζει την τιμή.
   *
   * Ο φρουρός `typeof window === 'undefined'` κρατά τον server στην προεπιλογή **χωρίς** να
   * σφραγίσει τη σημαία: ο ίδιος κώδικας που έτρεξε στον server ξαναρωτά στον client και
   * ενυδατώνεται κανονικά εκεί.
   */
  const hydrateOnce = (): void => {
    if (hydrated || typeof window === 'undefined') return;
    hydrated = true;
    const { found, value } = hydrate();
    if (!found) return; // τίποτα αποθηκευμένο ⇒ η προεπιλογή ήδη ισχύει ⇒ **καμία** ειδοποίηση
    const next = validate(value);
    if (isUnchanged(next, store.get())) return; // ίδια τιμή ⇒ καμία ειδοποίηση
    // Κατευθείαν στο υποκείμενο store: το persist ανήκει στο `set` του wrapper, και η
    // ενυδάτωση ΔΕΝ είναι εγγραφή — θα ξανάγραφε στον δίσκο ό,τι μόλις διάβασε.
    store.set(next);
  };

  const persist = (value: T): void => {
    if (options?.removeOnDefault && Object.is(value, defaultValue)) {
      storageRemove(key);
    } else if (codec) {
      storageSetString(key, codec.serialize(value));
    } else {
      storageSet(key, value);
    }
  };

  return {
    get: (): T => {
      hydrateOnce();
      return store.get();
    },
    subscribe: (listener: () => void): (() => void) => {
      // Ο listener καταχωρείται ΠΡΙΝ την ενυδάτωση επίτηδες: έτσι, αν ο δίσκος κρατά κάτι
      // διαφορετικό από την προεπιλογή, ο συνδρομητής το **μαθαίνει**. Η αντίστροφη σειρά
      // θα άφηνε κάθε `useSyncExternalStore` δείκτη να δείχνει για πάντα την προεπιλογή.
      const unsubscribe = store.subscribe(listener);
      hydrateOnce();
      return unsubscribe;
    },
    // `reset` = «η τιμή ορίζεται ΡΗΤΑ τώρα» (jest isolation). Σφραγίζει την ενυδάτωση, αλλιώς
    // η επόμενη `get` θα διάβαζε τον δίσκο και θα έσβηνε σιωπηλά αυτό που μόλις όρισε το test.
    reset: (next: T): void => {
      hydrated = true;
      store.reset(next);
    },
    set: (next: T): void => {
      hydrateOnce();
      const before = store.get();
      store.set(next);
      const after = store.get();
      // Persist only on a real change — an `equals`-suppressed or identical write is a no-op.
      if (!Object.is(after, before)) persist(after);
    },
  };
}
