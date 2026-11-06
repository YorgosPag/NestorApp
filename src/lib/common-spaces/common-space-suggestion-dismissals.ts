/**
 * @fileoverview **ΟΙ ΑΠΟΡΡΙΨΕΙΣ ΠΡΟΤΑΣΕΩΝ ΚΟΙΝΟΧΡΗΣΤΩΝ** (ADR-931 §6.2 · Β2) — το σχήμα, η ανάγνωση και οι δύο
 * ιδεμποτικές πράξεις (απόρριψη · επαναφορά) πάνω στο `Building.dismissedCommonSpaceSuggestions`. Καθαρό (πελάτης + server).
 * @related `common-space-suggestions.ts` (κλειδιά · κανόνες) ·
 *   `app/api/buildings/building-common-space-suggestion-dismiss.ts` (ο ΕΝΑΣ γραφέας)
 * @module lib/common-spaces/common-space-suggestion-dismissals
 *
 * 🔑 **Ποιος και πότε** (GitHub «dismissed by … on …»): κάθε απόρριψη είναι εγγραφή `{ key, dismissedBy, dismissedAt }`
 *   — η λίστα επαναφοράς δείχνει την απόφαση με τον άνθρωπό της, όχι ανώνυμο κλειδί. Το `dismissedAt` το γράφει ο
 *   **server** (ISO· το `serverTimestamp()` δεν επιτρέπεται μέσα σε πίνακα).
 * 🔑 **Επαναφορά = δεύτερη πράξη του ΙΔΙΟΥ κλάδου** (Google Ads «Undismiss» · GitHub «Reopen»): ένα/πολλά κλειδιά ή
 *   `'all'`. Το `'all'` αδειάζει και κλειδιά που δεν αντιστοιχούν πια σε πρόταση (π.χ. όροφος που σβήστηκε).
 * ⚠️ Μη έγκυρη εγγραφή (π.χ. σκέτο κλειδί χωρίς ποιος/πότε) ⇒ **αγνοείται**, ποτέ ρίψη· η πρόταση απλώς ξαναεμφανίζεται.
 */

import {
  isCommonSpaceSuggestionKey,
  suggestMissingCommonSpaces,
  type CommonSpaceSuggestion,
  type CommonSpaceSuggestionInput,
} from './common-space-suggestions';

/** Μία μόνιμη απόρριψη — η απόφαση με τον άνθρωπό της. */
export interface DismissedCommonSpaceSuggestion {
  readonly key: string;
  /** uid του ανθρώπου που απέρριψε (από τον server, ποτέ από το σώμα). */
  readonly dismissedBy: string;
  /** ISO 8601 — η ώρα του server. */
  readonly dismissedAt: string;
}

/** Τι επαναφέρεται: συγκεκριμένα κλειδιά, ή όλα. */
export type CommonSpaceSuggestionRestore = readonly string[] | typeof RESTORE_ALL_COMMON_SPACE_SUGGESTIONS;

/** Ανώτατο πλήθος απορρίψεων ανά κτίριο — φράγμα στο μέγεθος του εγγράφου, ποτέ λίστα χωρίς όριο. */
export const MAX_DISMISSED_COMMON_SPACE_SUGGESTIONS = 200;

/** Το πεδίο του κτιρίου — η ΜΙΑ δήλωση του ονόματος (γραφέας · τύπος · ιστορικό · πελάτης). */
export const DISMISSED_COMMON_SPACE_SUGGESTIONS_FIELD = 'dismissedCommonSpaceSuggestions';

/** Κλειδί σώματος του `PATCH /api/buildings` για μία απόρριψη. */
export const DISMISS_COMMON_SPACE_SUGGESTION_BODY_KEY = 'dismissCommonSpaceSuggestion';

/** Κλειδί σώματος του `PATCH /api/buildings` για επαναφορά (`string[]` κλειδιών ή `'all'`). */
export const RESTORE_COMMON_SPACE_SUGGESTIONS_BODY_KEY = 'restoreCommonSpaceSuggestions';

/** Η τιμή «επαναφορά όλων». */
export const RESTORE_ALL_COMMON_SPACE_SUGGESTIONS = 'all';

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

function isDismissal(value: unknown): value is DismissedCommonSpaceSuggestion {
  if (value === null || typeof value !== 'object') return false;
  const { key, dismissedBy, dismissedAt } = value as Record<string, unknown>;
  return isCommonSpaceSuggestionKey(key)
    && typeof dismissedBy === 'string' && dismissedBy !== ''
    && typeof dismissedAt === 'string' && ISO_INSTANT.test(dismissedAt);
}

/** Ό,τι είναι αποθηκευμένο (ή λείπει) → οι έγκυρες εγγραφές, μία ανά κλειδί (κρατά την πρώτη). Ποτέ ρίψη. */
export function readDismissedCommonSpaceSuggestions(raw: unknown): readonly DismissedCommonSpaceSuggestion[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  return raw.filter(isDismissal).filter((record) => !seen.has(record.key) && Boolean(seen.add(record.key)));
}

/** Μόνο τα κλειδιά — για τους κανόνες προτάσεων και το ιστορικό (το «ποιος/πότε» ζει ήδη στη γραμμή ιστορικού). */
export function dismissedCommonSpaceSuggestionKeys(raw: unknown): readonly string[] {
  return readDismissedCommonSpaceSuggestions(raw).map((record) => record.key);
}

/** Η απόρριψη πάνω στη φρέσκια λίστα — ιδεμποτική: ήδη απορριφθέν κλειδί ⇒ ίδια λίστα, κρατά την ΑΡΧΙΚΗ απόφαση. */
export function withDismissedCommonSpaceSuggestion(
  current: readonly DismissedCommonSpaceSuggestion[],
  record: DismissedCommonSpaceSuggestion,
): readonly DismissedCommonSpaceSuggestion[] {
  return current.some((existing) => existing.key === record.key) ? current : [...current, record];
}

/** Η επαναφορά πάνω στη φρέσκια λίστα — ιδεμποτική: κλειδί που δεν υπάρχει ⇒ καμία αλλαγή. */
export function withoutDismissedCommonSpaceSuggestions(
  current: readonly DismissedCommonSpaceSuggestion[],
  restore: CommonSpaceSuggestionRestore,
): readonly DismissedCommonSpaceSuggestion[] {
  if (restore === RESTORE_ALL_COMMON_SPACE_SUGGESTIONS) return [];
  const keys = new Set(restore);
  const next = current.filter((record) => !keys.has(record.key));
  return next.length === current.length ? current : next;
}

/** Σχήμα του σώματος επαναφοράς: `'all'`, ή 1..MAX έγκυρα κλειδιά (χωρίς διπλότυπα). Άκυρο ⇒ `null`. */
export function parseCommonSpaceSuggestionRestore(value: unknown): CommonSpaceSuggestionRestore | null {
  if (value === RESTORE_ALL_COMMON_SPACE_SUGGESTIONS) return RESTORE_ALL_COMMON_SPACE_SUGGESTIONS;
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_DISMISSED_COMMON_SPACE_SUGGESTIONS) return null;
  if (!value.every(isCommonSpaceSuggestionKey)) return null;
  return [...new Set(value)];
}

/** Απορριφθείσα πρόταση που **ισχύει ακόμη** — η πρόταση (με τον λόγο της) και η απόφαση (ποιος/πότε). */
export interface DismissedCommonSpaceSuggestionView {
  readonly suggestion: CommonSpaceSuggestion;
  readonly dismissal: DismissedCommonSpaceSuggestion;
}

export interface CommonSpaceSuggestionPartition {
  readonly open: readonly CommonSpaceSuggestion[];
  /** Νεότερη απόφαση πρώτη. */
  readonly dismissed: readonly DismissedCommonSpaceSuggestionView[];
}

/**
 * **Ανοιχτές και απορριφθείσες, από τους ΙΔΙΟΥΣ κανόνες.** Η λίστα επαναφοράς δείχνει **μόνο** απορρίψεις που θα
 * ξαναγίνονταν πρόταση σήμερα — πέρα από το Google Ads, που δείχνει και όσες δεν ισχύουν πια (χώρος που προστέθηκε,
 * όροφος που σβήστηκε): «επαναφορά» για κάτι που δεν θα εμφανιστεί είναι ψέμα της οθόνης.
 */
export function partitionCommonSpaceSuggestions(
  input: Omit<CommonSpaceSuggestionInput, 'dismissed'> & { readonly dismissed: readonly DismissedCommonSpaceSuggestion[] },
): CommonSpaceSuggestionPartition {
  const byKey = new Map(input.dismissed.map((record) => [record.key, record]));
  const all = suggestMissingCommonSpaces({ ...input, dismissed: [] });
  const open = all.filter((suggestion) => !byKey.has(suggestion.key));
  const dismissed = all.flatMap((suggestion) => {
    const dismissal = byKey.get(suggestion.key);
    return dismissal ? [{ suggestion, dismissal }] : [];
  }).sort((a, b) => b.dismissal.dismissedAt.localeCompare(a.dismissal.dismissedAt));
  return { open, dismissed };
}
