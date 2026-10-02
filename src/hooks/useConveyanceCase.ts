'use client';

/**
 * =============================================================================
 * useConveyanceCase — υπόθεση μεταβίβασης ενός ακινήτου (ADR-901 Φ1)
 * =============================================================================
 *
 * Optimistic updates σε στυλ Gmail: κάθε εντολή εφαρμόζεται **αμέσως** στην οθόνη με
 * τον ΙΔΙΟ αμιγή πυρήνα που τρέχει ο server (`applyConveyanceCommand` +
 * `deriveCaseChecklist`), και επιβεβαιώνεται από την απάντηση του server.
 *
 * - **Ουρά**: οι εντολές στέλνονται σειριακά, η καθεμιά με την επιβεβαιωμένη `version`
 *   της προηγούμενης (CAS) — δύο γρήγορα κλικ δεν συγκρούονται μεταξύ τους.
 * - **Rollback**: αποτυχία ⇒ η οθόνη γυρνά στην τελευταία επιβεβαιωμένη εικόνα.
 * - **409**: κάποιος άλλος άλλαξε την υπόθεση ⇒ ξαναφόρτωση + μήνυμα (καμία σιωπηλή αντικατάσταση).
 *
 * @module hooks/useConveyanceCase
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import { ApiClientError } from '@/lib/api/enterprise-api-client';
import { getErrorMessage } from '@/lib/error-utils';
import { applyConveyanceCommand } from '@/lib/conveyance/apply-command';
import { deriveCaseChecklist } from '@/lib/conveyance/case-checklist';
import { conveyanceToday } from '@/lib/conveyance/conveyance-calendar';
import type { CommandRejection, ConveyanceCommand } from '@/lib/conveyance/conveyance-commands';
import { nowISO } from '@/lib/date-local';
import {
  fetchConveyanceCaseView,
  openConveyanceCaseRequest,
  sendConveyanceCommand,
} from '@/services/conveyance/conveyance-case-gateway';
import type { ConveyanceCaseView } from '@/types/conveyance-case';

const HTTP_CONFLICT = 409;

export type ConveyanceCommandOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'conflict' | 'error'; readonly message: string | null }
  | { readonly ok: false; readonly reason: 'rejected'; readonly rejection: CommandRejection };

interface UseConveyanceCaseReturn {
  readonly view: ConveyanceCaseView | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly opening: boolean;
  readonly openCase: () => Promise<void>;
  readonly run: (command: ConveyanceCommand) => Promise<ConveyanceCommandOutcome>;
  readonly reload: () => Promise<void>;
}

/** Η εικόνα μετά την εντολή, χωρίς να ρωτηθεί ο server — ή η απόρριψη του πυρήνα. */
function optimisticView(view: ConveyanceCaseView, command: ConveyanceCommand, actorUid: string): ConveyanceCaseView | CommandRejection {
  const today = conveyanceToday();
  const applied = applyConveyanceCommand(view.conveyanceCase, command, { actorUid, now: nowISO(), today, evidence: view.evidence });
  if (!applied.ok) return applied.rejection;
  const record = applied.next;
  const checklist = deriveCaseChecklist({ record, derivedFacts: view.derivedFacts, evidence: view.evidence, today, viewer: 'host' });
  const state = record.storedState === 'cancelled' ? 'cancelled' : view.state;
  return { ...view, conveyanceCase: record, checklist, state };
}

/** Η εικόνα στην οθόνη + η τελευταία επιβεβαιωμένη — refs ώστε δύο γρήγορα κλικ να βλέπουν την ίδια αλήθεια. */
function useCaseStore() {
  const [view, setView] = useState<ConveyanceCaseView | null>(null);
  /** Η τελευταία εικόνα που επιβεβαίωσε ο server — βάση για CAS και rollback. */
  const confirmed = useRef<ConveyanceCaseView | null>(null);
  /** Ό,τι δείχνει η οθόνη αυτή τη στιγμή (μαζί με τα optimistic) — χωρίς να περιμένει render. */
  const shown = useRef<ConveyanceCaseView | null>(null);
  const show = useCallback((next: ConveyanceCaseView | null) => {
    shown.current = next;
    setView(next);
  }, []);
  const accept = useCallback((next: ConveyanceCaseView | null) => {
    confirmed.current = next;
    show(next);
  }, [show]);
  return { view, confirmed, shown, show, accept };
}

type CaseStore = ReturnType<typeof useCaseStore>;

function useCaseLoader(propertyId: string | null, accept: CaseStore['accept']) {
  const [loading, setLoading] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!propertyId) return;
    setLoading(true);
    setError(null);
    try {
      accept(await fetchConveyanceCaseView(propertyId));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [propertyId, accept]);

  useEffect(() => {
    accept(null);
    void reload();
  }, [reload, accept]);

  const openCase = useCallback(async () => {
    if (!propertyId) return;
    setOpening(true);
    setError(null);
    try {
      accept(await openConveyanceCaseRequest(propertyId));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setOpening(false);
    }
  }, [propertyId, accept]);

  return { loading, error, opening, reload, openCase };
}

/** Optimistic + σειριακή ουρά + rollback + 409 → ξαναφόρτωση. */
function useCommandRunner(store: CaseStore, reload: () => Promise<void>) {
  const { user } = useAuth();
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const { confirmed, shown, show, accept } = store;

  const send = useCallback(async (command: ConveyanceCommand): Promise<ConveyanceCommandOutcome> => {
    const base = confirmed.current;
    if (!base) return { ok: false, reason: 'error', message: null };
    try {
      accept(await sendConveyanceCommand(base.conveyanceCase.id, { expectedVersion: base.conveyanceCase.version, command }));
      return { ok: true };
    } catch (err) {
      show(confirmed.current);
      if (err instanceof ApiClientError && err.statusCode === HTTP_CONFLICT) {
        await reload();
        return { ok: false, reason: 'conflict', message: null };
      }
      return { ok: false, reason: 'error', message: getErrorMessage(err) };
    }
  }, [confirmed, show, accept, reload]);

  return useCallback(async (command: ConveyanceCommand): Promise<ConveyanceCommandOutcome> => {
    const current = shown.current;
    if (!current) return { ok: false, reason: 'error', message: null };
    const optimistic = optimisticView(current, command, user?.uid ?? '');
    if (typeof optimistic === 'string') return { ok: false, reason: 'rejected', rejection: optimistic };
    show(optimistic);
    const result = queue.current.then(() => send(command));
    queue.current = result;
    return result;
  }, [shown, show, user?.uid, send]);
}

export function useConveyanceCase(propertyId: string | null): UseConveyanceCaseReturn {
  const store = useCaseStore();
  const { loading, error, opening, reload, openCase } = useCaseLoader(propertyId, store.accept);
  const run = useCommandRunner(store, reload);
  return { view: store.view, loading, error, opening, openCase, run, reload };
}
