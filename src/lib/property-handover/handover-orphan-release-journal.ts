/**
 * @fileoverview **Το ημερολόγιο της άρσης διατήρησης ορφανών bytes** — καθαρό: ανάγνωση, πρόθεση, επανάληψη (ADR-916 §5.24 · Ο24).
 * @related server/property-handover-delivery/handover-delivery-orphan-release.server.ts (η απόφαση) ·
 *          server/property-handover-delivery/handover-delivery-ledger.server.ts (η πρόθεση, μέσα στις συναλλαγές κλεισίματος)
 * @module lib/property-handover/handover-orphan-release-journal
 *
 * 🔑 **Πρόθεση ατομικά με την απόφαση**: η συναλλαγή που κλείνει τη γραμμή (sha256 · closure · άρση μη οφειλόμενης) **ήδη**
 *    διαβάζει την πηγή· αν τη βρει απούσα, γράφει `pending` στην ίδια συναλλαγή. Κρασάρισμα μετά ⇒ το δίχτυ βρίσκει την
 *    πρόθεση — ποτέ «το ξέραμε και το ξεχάσαμε».
 */

import { isOneOf } from '@/lib/type-guards';
import {
  HANDOVER_ORPHAN_RELEASE_KEEP_REASONS,
  HANDOVER_ORPHAN_RELEASE_RETRYABLE_REASONS,
  HANDOVER_ORPHAN_RELEASE_STATES,
  type HandoverOrphanReleaseJournal,
} from '@/types/property-handover-orphan-release';

const text = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

/**
 * Το ημερολόγιο μιας γραμμής — `null` ⇒ δεν γράφτηκε ποτέ πρόθεση. ⚠️ **Αλλοιωμένο ⇒ `pending`**: η απόφαση είναι ιδεμπότητη
 * και fail-closed, άρα μια επανάληψη δεν κοστίζει τίποτα· η σιωπηλή εγκατάλειψη θα άφηνε bytes κλειδωμένα για πάντα.
 */
export function orphanReleaseOf(raw: unknown): HandoverOrphanReleaseJournal | null {
  if (raw === undefined || raw === null) return null;
  const fields = typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const since = text(fields.since) ?? '';
  if (!isOneOf(HANDOVER_ORPHAN_RELEASE_STATES, fields.state)) return { state: 'pending', reason: null, since, settledAt: null };
  const reason = isOneOf(HANDOVER_ORPHAN_RELEASE_KEEP_REASONS, fields.reason) ? fields.reason : null;
  if (fields.state === 'kept' && reason === null) return { state: 'pending', reason: null, since, settledAt: null };
  return { state: fields.state, reason, since, settledAt: text(fields.settledAt) };
}

/** Ξαναρωτά το δίχτυ; — `pending`, ή `kept` με λόγο που **μπορεί να αλλάξει**. */
export function orphanReleaseRetryable(journal: HandoverOrphanReleaseJournal | null): boolean {
  if (journal === null) return false;
  if (journal.state === 'pending') return true;
  return journal.state === 'kept' && isOneOf(HANDOVER_ORPHAN_RELEASE_RETRYABLE_REASONS, journal.reason);
}

/**
 * **Η πρόθεση** — για τη συναλλαγή που κλείνει τη γραμμή: πηγή **απούσα** (όχι ξένη: ξένη = υπάρχει = διεκδικείται), θέση
 * γνωστή, και καμία προηγούμενη πρόθεση ⇒ το ημερολόγιο `pending`· αλλιώς `null` (τίποτα να γραφτεί).
 */
export function orphanReleaseIntentOf(
  ledger: { readonly orphanRelease?: unknown } | undefined,
  sourceExists: boolean,
  sourceLocated: boolean,
  now: string,
): HandoverOrphanReleaseJournal | null {
  if (ledger === undefined || sourceExists || !sourceLocated || orphanReleaseOf(ledger.orphanRelease) !== null) return null;
  return { state: 'pending', reason: null, since: now, settledAt: null };
}
