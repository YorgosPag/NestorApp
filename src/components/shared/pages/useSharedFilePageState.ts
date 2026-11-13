/**
 * =============================================================================
 * useSharedFilePageState — the `/shared/[token]` page as a state machine
 * =============================================================================
 *
 * ADR-884 Φ0.12: this hook no longer validates anything. It asks the server
 * (`UnifiedSharingService.resolve` → `POST /api/shares/resolve`) **once** and
 * renders the named outcome. Before Κ4 it queried a world-readable collection,
 * compared password hashes and bumped counters **in the browser**, with every
 * branch written twice (open + after password) — and its contact/file reads were
 * denied by the rules for the very visitor the link was for.
 *
 * @module components/shared/pages/useSharedFilePageState
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';

import { ApiClientError } from '@/lib/api/api-client-types';
import { openRemoteUrlInNewTab } from '@/lib/exports/trigger-export-download';
import { UnifiedSharingService } from '@/services/sharing/unified-sharing.service';
import type {
  ResolvedSharePayload,
  ShareResolveOutcome,
  ShareResolveRefusal,
} from '@/services/sharing/share-resolve-contract';

/** What the page shows. `wrong-password` never reaches `refused` — it stays on the gate. */
export type SharedPageView =
  | { readonly kind: 'loading' }
  | { readonly kind: 'password'; readonly wrongPassword: boolean }
  | { readonly kind: 'refused'; readonly reason: Exclude<ShareResolveRefusal, 'wrong-password'> }
  | { readonly kind: 'resolved'; readonly share: ResolvedSharePayload; readonly expiresAt: string };

export interface SharedFilePageState {
  readonly token: string;
  readonly view: SharedPageView;
  readonly password: string;
  readonly submitting: boolean;
  readonly downloading: boolean;
  setPassword: (value: string) => void;
  handlePasswordSubmit: (event: React.FormEvent) => Promise<void>;
  handleDownload: () => Promise<void>;
  /**
   * **Νέα επίσκεψη χωρίς ανανέωση σελίδας** (ADR-315 Α6): ξανανοίγει το token με το ΙΔΙΟ `resolve`, όταν η
   * επίσκεψη έληξε από αδράνεια ή έφτασε την απόλυτη λήξη της. `true` ⇒ γράφτηκε νέο κουπόνι. `false` ⇒ η σελίδα
   * δείχνει ήδη ό,τι είπε ο διακομιστής (πύλη κωδικού · άρνηση), ή το δίκτυο απέτυχε (η όψη μένει). Μία πτήση τη
   * φορά: ταυτόχρονοι καλούντες μοιράζονται το ίδιο αίτημα (ένα άνοιγμα = μία μέτρηση).
   */
  reopenVisit: () => Promise<boolean>;
}

/** Server outcome → view. */
function viewOf(outcome: ShareResolveOutcome): SharedPageView {
  switch (outcome.status) {
    case 'password-required':
      return { kind: 'password', wrongPassword: false };
    case 'resolved':
      return { kind: 'resolved', share: outcome.share, expiresAt: outcome.expiresAt };
    case 'refused':
      return outcome.reason === 'wrong-password'
        ? { kind: 'password', wrongPassword: true }
        : { kind: 'refused', reason: outcome.reason };
  }
}

/** Transport failure → view: 404 is a verdict («no such link»); anything else is ours. */
function viewOfFailure(error: unknown): SharedPageView {
  const notFound = error instanceof ApiClientError && error.statusCode === 404;
  return { kind: 'refused', reason: notFound ? 'not-found' : 'unavailable' };
}

/** Ένα νέο άνοιγμα του token → `true` αν γράφτηκε κουπόνι. Η άρνηση/πύλη γίνεται όψη· το σφάλμα δικτύου όχι. */
async function reopenOnce(token: string, setView: (view: SharedPageView) => void): Promise<boolean> {
  try {
    const outcome = await UnifiedSharingService.resolve(token);
    if (outcome.status === 'resolved') return true;
    setView(viewOf(outcome));
  } catch (error: unknown) {
    // 404 = ετυμηγορία («δεν υπάρχει τέτοιος σύνδεσμος»)· κάθε άλλο σφάλμα είναι δικό μας ⇒ η όψη μένει.
    if (error instanceof ApiClientError && error.statusCode === 404) setView(viewOfFailure(error));
  }
  return false;
}

/** `reopenVisit` με μία πτήση τη φορά (βλ. `SharedFilePageState.reopenVisit`). */
function useReopenVisit(token: string, setView: (view: SharedPageView) => void): () => Promise<boolean> {
  const inFlight = useRef<Promise<boolean> | null>(null);
  return useCallback(() => {
    if (inFlight.current === null) {
      inFlight.current = reopenOnce(token, setView).finally(() => { inFlight.current = null; });
    }
    return inFlight.current;
  }, [token, setView]);
}

export function useSharedFilePageState(): SharedFilePageState {
  const params = useParams();
  const token = typeof params.token === 'string' ? params.token : '';

  const [view, setView] = useState<SharedPageView>({ kind: 'loading' });
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    UnifiedSharingService.resolve(token)
      .then((outcome) => { if (!cancelled) setView(viewOf(outcome)); })
      .catch((error: unknown) => { if (!cancelled) setView(viewOfFailure(error)); });
    return () => { cancelled = true; };
  }, [token]);

  const handlePasswordSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      setView(viewOf(await UnifiedSharingService.resolve(token, password)));
    } catch (error: unknown) {
      setView(viewOfFailure(error));
    } finally {
      setSubmitting(false);
    }
  }, [token, password]);

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    try {
      const outcome = await UnifiedSharingService.requestDownload(token);
      if (outcome.status === 'signed') openRemoteUrlInNewTab(outcome.url);
      else if (outcome.reason === 'password-required') setView({ kind: 'password', wrongPassword: false });
      else setView(viewOf({ status: 'refused', reason: outcome.reason }));
    } catch (error: unknown) {
      setView(viewOfFailure(error));
    } finally {
      setDownloading(false);
    }
  }, [token]);

  const reopenVisit = useReopenVisit(token, setView);

  return {
    token, view, password, submitting, downloading, setPassword, handlePasswordSubmit, handleDownload, reopenVisit,
  };
}
