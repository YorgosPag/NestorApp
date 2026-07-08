/**
 * ADR-587 Φ3b — Shared key-set guard factory (SSoT για το predicate boilerplate).
 *
 * Τα ~42 `*-command-keys.ts` registries επαναλάμβαναν το **ίδιο structural clone**:
 *
 * ```ts
 * const X_KEY_SET: ReadonlySet<string> = new Set<string>(X_KEYS);
 * export function isXRibbonKey(commandKey: string): boolean {
 *   return X_KEY_SET.has(commandKey);
 * }
 * ```
 *
 * Η **DATA** (τα keys) είναι νόμιμα per-type διαφορετική — δεν ενοποιείται. Το μόνο
 * που ήταν διπλότυπο ήταν το «build a Set → expose `.has`» boilerplate (name-blind
 * jscpd clone· CHECK 3.18 δεν το πιάνει). Ο factory το απορροφά σε ΕΝΑ σημείο· κάθε
 * registry κρατάει το named export του (`isXRibbonKey` κ.λπ.) ως adapter, ώστε ο
 * `useRibbonCommands` composer να συνεχίζει να τα καλεί ονομαστικά αμετάβλητα.
 *
 * Επιστρέφει **type predicate** (`key is K`): ταιριάζει τα boolean-returning guards
 * (assignable) ΚΑΙ διατηρεί τα ήδη narrowing guards (π.χ. `isMepFixtureVisibilityKey`)
 * χωρίς downgrade.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-587-entity-type-descriptor-registry-ssot.md
 */

/**
 * Χτίζει έναν O(1) membership guard πάνω σε ένα σταθερό σύνολο command keys.
 *
 * @param keys Τα command keys του registry (literal-union ⇒ narrowing predicate·
 *             `string[]` ⇒ ακίνδυνο `key is string`).
 * @returns predicate `(key: string) => key is K` — true iff το `key` ανήκει στο σύνολο.
 */
export function makeKeySetGuard<K extends string>(
  keys: Iterable<K>,
): (key: string) => key is K {
  const keySet = new Set<string>(keys);
  return (key: string): key is K => keySet.has(key);
}
