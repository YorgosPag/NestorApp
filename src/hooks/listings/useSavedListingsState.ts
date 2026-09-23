'use client';

/**
 * @fileoverview **Η ΚΑΤΑΣΤΑΣΗ «ΤΙ ΕΧΩ ΚΡΑΤΗΣΕΙ»** — ένα fetch ανά σελίδα, αισιόδοξη εναλλαγή, πρόθεση που
 * επιβιώνει της σύνδεσης.
 * @related ADR-777 §8.74 · components/listings/SavedListingsProvider.tsx · app/api/saved-listings
 * @module hooks/listings/useSavedListingsState
 *
 * 🔑 **Αισιόδοξα, αλλά ΧΩΡΙΣ αγώνα** (N.7.2 #2): η καρδιά αλλάζει **αμέσως** (πρότυπο Gmail/Zillow)· το
 * αίτημα φεύγει μετά. Τρία γρήγορα κλικ **δεν** στέλνουν τρία αιτήματα που φτάνουν ανάποδα: ανά αγγελία
 * κρατιέται η **επιθυμητή** κατάσταση, και ένας μόνο βρόχος στέλνει ώσπου ο διακομιστής να συμφωνήσει με
 * την τελευταία. `PUT`/`DELETE` είναι ιδεμπότητα ⇒ η επανάληψη δεν αναιρεί ποτέ την πρόθεση.
 *
 * 🔴 **Αποτυχία ⇒ επαναφορά ΣΤΗΝ ΤΕΛΕΥΤΑΙΑ ΕΠΙΒΕΒΑΙΩΜΕΝΗ κατάσταση** και ορατή είδηση — ποτέ καρδιά που
 * λέει «κρατημένη» για κάτι που ο διακομιστής δεν κράτησε.
 *
 * 🔑 **Ο ανώνυμος** πηγαίνει στη σύνδεση με την πρόθεση στο `?next=` (`?save=<id>`)· στην επιστροφή η
 * αποθήκευση γίνεται **μία φορά**, μόνη της, και η παράμετρος σβήνεται από το URL.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuthOptional } from '@/auth/contexts/AuthContext';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { ApiClientError } from '@/lib/api/api-client-types';
import {
  SAVED_LISTINGS_API_PATH,
  SAVE_INTENT_PARAM,
  savedListingApiPath,
  withSaveIntent,
} from '@/lib/listings/saved-listing-routes';
import { loginHref } from '@/lib/routes/return-path';
import { createModuleLogger } from '@/lib/telemetry';
import { currentSearchParams, replaceUrlSearchParams } from '@/lib/url-query-state';
import { usePathname, useRouter } from '@/lib/workspace/navigation';
import type { SaveRefusal, SaveToggleResponse, SavedListingRow, SavedListingsResponse } from '@/types/saved-listing';

const logger = createModuleLogger('useSavedListingsState');

export type SavedListingsStatus = 'anonymous' | 'loading' | 'ready' | 'unavailable';

/** Γιατί η καρδιά γύρισε πίσω — ονομασμένο, ώστε η είδηση να λέει την αλήθεια. */
export interface SaveNotice {
  readonly kind: 'failed' | SaveRefusal;
  /** Αυξάνει σε κάθε νέα είδηση: ίδια αιτία δύο φορές ⇒ ανακοινώνεται ξανά. */
  readonly seq: number;
}

export interface SavedListingsState {
  readonly status: SavedListingsStatus;
  readonly savedIds: ReadonlySet<string>;
  /**
   * Οι γραμμές **όπως φορτώθηκαν** — η σελίδα «Αποθηκευμένα» τις δείχνει από εδώ (κανένα δεύτερο fetch).
   * 🔑 Δεν σβήνονται με την αφαίρεση: η γραμμή μένει με άδεια καρδιά, ώστε ένα λάθος κλικ να αναιρείται
   * με ένα δεύτερο (πρότυπο Gmail «αναίρεση»), αντί να εξαφανίζεται κάτω από το δάχτυλο.
   */
  readonly rows: readonly SavedListingRow[];
  readonly truncated: boolean;
  readonly notice: SaveNotice | null;
  readonly toggle: (listingId: string) => void;
}

function refusalOf(error: unknown): SaveRefusal | null {
  if (!ApiClientError.isApiClientError(error) || error.statusCode !== 409) return null;
  const reason = (error.errorBody as { reason?: unknown } | undefined)?.reason;
  return reason === 'own-listing' || reason === 'not-in-market' ? reason : null;
}

async function sendSaved(listingId: string, want: boolean): Promise<void> {
  const path = savedListingApiPath(listingId);
  await (want ? apiClient.put<SaveToggleResponse>(path) : apiClient.delete<SaveToggleResponse>(path));
}

function withMembership(ids: ReadonlySet<string>, listingId: string, member: boolean): ReadonlySet<string> {
  if (ids.has(listingId) === member) return ids;
  const next = new Set(ids);
  if (member) next.add(listingId);
  else next.delete(listingId);
  return next;
}

/** Φόρτωση της λίστας όταν υπάρχει ταυτότητα — **ένα** αίτημα ανά σελίδα, για όλες τις κάρτες. */
function useSavedIdsLoader(uid: string | null, authLoading: boolean) {
  const [status, setStatus] = useState<SavedListingsStatus>('loading');
  const [savedIds, setSavedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [loaded, setLoaded] = useState<SavedListingsResponse>({ rows: [], truncated: false });
  const confirmed = useRef<Map<string, boolean>>(new Map());

  useEffect(() => {
    if (authLoading) return undefined;
    confirmed.current = new Map();
    if (uid === null) {
      setStatus('anonymous');
      setSavedIds(new Set());
      setLoaded({ rows: [], truncated: false });
      return undefined;
    }
    let alive = true;
    setStatus('loading');
    apiClient
      .get<SavedListingsResponse>(SAVED_LISTINGS_API_PATH)
      .then((response) => {
        if (!alive) return;
        setLoaded(response);
        setSavedIds(new Set(response.rows.map((row) => row.listingId)));
        setStatus('ready');
      })
      .catch((cause: unknown) => {
        logger.warn('Οι αποθηκευμένες αγγελίες δεν φορτώθηκαν', { error: cause instanceof Error ? cause.message : String(cause) });
        if (alive) setStatus('unavailable');
      });
    return () => {
      alive = false;
    };
  }, [uid, authLoading]);

  return { status, savedIds, setSavedIds, confirmed, loaded };
}

/** Ο **γραφέας**: αισιόδοξη αλλαγή + ένας βρόχος ανά αγγελία + επαναφορά στην επιβεβαιωμένη κατάσταση. */
function useSaveWriter(loader: ReturnType<typeof useSavedIdsLoader>) {
  const { savedIds, setSavedIds, confirmed } = loader;
  const [notice, setNotice] = useState<SaveNotice | null>(null);
  const desired = useRef<Map<string, boolean>>(new Map());
  const inFlight = useRef<Set<string>>(new Set());

  const flush = useCallback(async (listingId: string, before: boolean) => {
    inFlight.current.add(listingId);
    let settled = confirmed.current.get(listingId) ?? before;
    try {
      for (let want = desired.current.get(listingId); want !== undefined && want !== settled; want = desired.current.get(listingId)) {
        await sendSaved(listingId, want);
        settled = want;
      }
      confirmed.current.set(listingId, settled);
    } catch (error) {
      desired.current.delete(listingId);
      setSavedIds((ids) => withMembership(ids, listingId, settled));
      setNotice((previous) => ({ kind: refusalOf(error) ?? 'failed', seq: (previous?.seq ?? 0) + 1 }));
    } finally {
      inFlight.current.delete(listingId);
    }
  }, [confirmed, setSavedIds]);

  const setSaved = useCallback((listingId: string, want: boolean) => {
    const before = savedIds.has(listingId);
    desired.current.set(listingId, want);
    setSavedIds((ids) => withMembership(ids, listingId, want));
    if (!inFlight.current.has(listingId)) void flush(listingId, before);
  }, [flush, savedIds, setSavedIds]);

  return { setSaved, notice };
}

/** 🔑 Η πρόθεση του ανώνυμου: καταναλώνεται **μία** φορά, μόλις η λίστα είναι γνωστή. */
function useSaveIntent(
  status: SavedListingsStatus,
  savedIds: ReadonlySet<string>,
  setSaved: (listingId: string, want: boolean) => void,
): void {
  const consumed = useRef(false);
  useEffect(() => {
    if (status !== 'ready' || consumed.current) return;
    const listingId = currentSearchParams().get(SAVE_INTENT_PARAM);
    if (listingId === null || listingId === '') return;
    consumed.current = true;
    replaceUrlSearchParams((params) => params.delete(SAVE_INTENT_PARAM));
    if (!savedIds.has(listingId)) setSaved(listingId, true);
  }, [savedIds, setSaved, status]);
}

export function useSavedListingsState(): SavedListingsState {
  const auth = useAuthOptional();
  const loader = useSavedIdsLoader(auth?.user?.uid ?? null, auth?.loading ?? false);
  const { status, savedIds } = loader;
  const { setSaved, notice } = useSaveWriter(loader);
  const router = useRouter();
  const pathname = usePathname();

  const toggle = useCallback((listingId: string) => {
    if (status === 'anonymous') {
      router.push(loginHref(withSaveIntent(pathname, currentSearchParams().toString(), listingId)));
      return;
    }
    if (status === 'ready') setSaved(listingId, !savedIds.has(listingId));
  }, [pathname, router, savedIds, setSaved, status]);

  useSaveIntent(status, savedIds, setSaved);
  return { status, savedIds, rows: loader.loaded.rows, truncated: loader.loaded.truncated, notice, toggle };
}
