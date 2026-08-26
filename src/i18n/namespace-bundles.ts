/**
 * @fileoverview i18n namespace bundles — SSoT for the common namespace lists
 *               passed to `useTranslation([...])`.
 * @description Many components load the exact same list of `common` + `common-*`
 *              namespaces. Restating that 10-item array in every file is a
 *              duplication smell (jscpd CHECK 3.28 trips when two such files land
 *              in one diff). This module owns each shared bundle once.
 *
 * @enterprise SSoT — a single named array per shared namespace set.
 * @enterprise ADR-584 — jscpd clone ratchet (de-duplication driver).
 *
 * ⚠️ TOOLING CONTRACT: the pre-commit i18n key checks parse `useTranslation(...)`
 * to learn which namespaces a file loads. They resolve a bare bundle identifier
 * (e.g. `useTranslation(COMMON_NAMESPACES)`) by reading THIS file. So:
 *   • every bundle MUST be `export const <NAME> = [ ...string literals ] as const;`
 *   • keep the literals inline (no computed/spread entries) — the checker's
 *     `scripts/lib/i18n-namespace-extract.js` parser reads them statically.
 * See scripts/check-i18n-missing-keys.js (CHECK 3.8) and
 *     scripts/generate-i18n-keys-baseline.js.
 */

/**
 * The shared `common` + `common-*` UI namespace set. Loaded by ~137 components
 * that render generic account / actions / navigation / photos / sales / status /
 * validation strings. This is the byte-identical array those files used to
 * restate inline.
 */
export const COMMON_NAMESPACES = [
  'common',
  'common-account',
  'common-actions',
  'common-empty-states',
  'common-navigation',
  'common-photos',
  'common-sales',
  'common-shared',
  'common-status',
  'common-validation',
] as const;

/**
 * `COMMON_NAMESPACES` **+ οι ετικέτες πεδίων του ιστορικού** — για τη γραμμή χρόνου
 * ελέγχου και **μόνο** γι' αυτήν.
 *
 * 🔴 **ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ BUNDLE ΚΑΙ ΟΧΙ ΕΓΓΡΑΦΗ ΣΤΟ `COMMON_NAMESPACES`** (ADR-810):
 * το `audit.fields` είναι **14.839 bytes** — **27%** του `common.json` — και υπηρετεί
 * **ΜΙΑ** επιφάνεια (`audit-timeline-entry.tsx`, τρία δυναμικά κλειδιά). Το
 * `COMMON_NAMESPACES` το φορτώνουν **~137 components**, και το `common` ταξιδεύει
 * **ΟΛΟΚΛΗΡΟ** στο shell slice κάθε διαδρομής (`guaranteedNamespaces`, ADR-744) —
 * άρα εγγραφή εκεί θα έστελνε τις ετικέτες ιστορικού σε **κάθε οθόνη**.
 * Μετρημένο: `common` **55.457 → 40.608** bytes, δηλαδή **κάτω** ακόμη κι από την τιμή
 * πριν την αποκατάσταση των 177 χαμένων ετικετών (48.599).
 *
 * ⚠️ **Η ΕΜΦΩΛΕΥΣΗ ΜΕΝΕΙ ΙΔΙΑ** (`{ audit: { fields: … } }`): το i18next ψάχνει τη
 * λίστα namespaces **με σειρά**, οπότε κανένα από τα τρία δυναμικά κλειδιά του
 * καταναλωτή δεν χρειάστηκε να αλλάξει — **μηδέν ρίσκο ωμού κλειδιού**.
 * ⚠️ **ΜΗΝ** το προσθέσεις στα `CRITICAL_NAMESPACES`: δεν είναι κέλυφος, και το
 * preload ζει πίσω από `typeof window !== 'undefined'` (δεν αγγίζει τον server).
 */
export const AUDIT_TIMELINE_NAMESPACES = [
  'common',
  'common-account',
  'common-actions',
  'common-audit',
  'common-empty-states',
  'common-navigation',
  'common-photos',
  'common-sales',
  'common-shared',
  'common-status',
  'common-validation',
] as const;
