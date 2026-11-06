'use client';

/**
 * @fileoverview **Αισιόδοξη εικόνα των απορρίψεων κοινοχρήστων** (ADR-931 §6.2) — αποθηκευμένες εγγραφές (onSnapshot) +
 * εκκρεμείς απορρίψεις/επαναφορές που δεν επιβεβαιώθηκαν ακόμη.
 * @related `lib/common-spaces/common-space-suggestion-dismissals.ts` (σχήμα · ανάγνωση) · `useCommonSpaceSuggestions.ts`
 * @module components/building-management/CommonSpacesTab/useOptimisticSuggestionDismissals
 *
 * 🔑 **Συμφιλίωση με την αλήθεια** (Gmail/Linear): κάθε εκκρεμότητα σβήνει μόλις τη δείξει το snapshot. Χωρίς αυτό μια
 *   παλιά «επαναφορά» θα έκρυβε για πάντα μια **μεταγενέστερη** απόρριψη του ίδιου κλειδιού από άλλον άνθρωπο.
 * 🔑 **Getter τη στιγμή της κλήσης** (ADR-040): το «επαναφορά όλων» διαβάζει την τρέχουσα εικόνα, όχι στιγμιότυπο απόδοσης.
 * 🔑 Αντίθετες πράξεις στο ίδιο κλειδί ακυρώνουν η μία την άλλη (απόρριψη → αναίρεση = καμία εκκρεμότητα).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  readDismissedCommonSpaceSuggestions,
  type DismissedCommonSpaceSuggestion,
} from '@/lib/common-spaces/common-space-suggestion-dismissals';

interface Pending {
  readonly dismissed: ReadonlyMap<string, DismissedCommonSpaceSuggestion>;
  readonly restored: ReadonlySet<string>;
}

const NO_PENDING: Pending = { dismissed: new Map(), restored: new Set() };

export interface OptimisticSuggestionDismissals {
  readonly dismissals: readonly DismissedCommonSpaceSuggestion[];
  readonly getDismissals: () => readonly DismissedCommonSpaceSuggestion[];
  readonly markDismissed: (record: DismissedCommonSpaceSuggestion) => void;
  readonly markRestored: (keys: readonly string[]) => void;
  /** Ακύρωση εκκρεμοτήτων μετά από αποτυχία της πόρτας — η οθόνη γυρίζει στην αποθηκευμένη αλήθεια για αυτά τα κλειδιά. */
  readonly forget: (keys: readonly string[]) => void;
}

function effectiveOf(stored: readonly DismissedCommonSpaceSuggestion[], pending: Pending): readonly DismissedCommonSpaceSuggestion[] {
  const kept = stored.filter((record) => !pending.restored.has(record.key) && !pending.dismissed.has(record.key));
  return [...kept, ...pending.dismissed.values()];
}

/** Σβήνει ό,τι το snapshot ήδη δείχνει — ίδια αναφορά όταν δεν αλλάζει τίποτα (κανένα περιττό render). */
function reconcile(pending: Pending, storedKeys: ReadonlySet<string>): Pending {
  const dismissed = new Map([...pending.dismissed].filter(([key]) => !storedKeys.has(key)));
  const restored = new Set([...pending.restored].filter((key) => storedKeys.has(key)));
  const unchanged = dismissed.size === pending.dismissed.size && restored.size === pending.restored.size;
  return unchanged ? pending : { dismissed, restored };
}

function withoutKeys(pending: Pending, keys: readonly string[]): Pending {
  const drop = new Set(keys);
  return {
    dismissed: new Map([...pending.dismissed].filter(([key]) => !drop.has(key))),
    restored: new Set([...pending.restored].filter((key) => !drop.has(key))),
  };
}

export function useOptimisticSuggestionDismissals(raw: unknown): OptimisticSuggestionDismissals {
  const stored = useMemo(() => readDismissedCommonSpaceSuggestions(raw), [raw]);
  const [pending, setPending] = useState<Pending>(NO_PENDING);

  useEffect(() => {
    const storedKeys = new Set(stored.map((record) => record.key));
    setPending((current) => reconcile(current, storedKeys));
  }, [stored]);

  const dismissals = useMemo(() => effectiveOf(stored, pending), [stored, pending]);
  const latest = useRef(dismissals);
  latest.current = dismissals;
  const getDismissals = useCallback(() => latest.current, []);

  const markDismissed = useCallback((record: DismissedCommonSpaceSuggestion) => {
    setPending((current) => {
      const base = withoutKeys(current, [record.key]);
      return { ...base, dismissed: new Map([...base.dismissed, [record.key, record]]) };
    });
  }, []);

  const markRestored = useCallback((keys: readonly string[]) => {
    setPending((current) => {
      const base = withoutKeys(current, keys);
      return { ...base, restored: new Set([...base.restored, ...keys]) };
    });
  }, []);

  const forget = useCallback((keys: readonly string[]) => setPending((current) => withoutKeys(current, keys)), []);

  return { dismissals, getDismissals, markDismissed, markRestored, forget };
}
