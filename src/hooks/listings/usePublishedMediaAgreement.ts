'use client';

/**
 * @fileoverview **ΣΥΜΦΩΝΕΙ Η ΔΗΜΟΣΙΑ ΑΓΓΕΛΙΑ ΜΕ ΤΟ ΤΡΕΧΟΝ ΥΛΙΚΟ;** — ο αναγνώστης της οθόνης (ADR-845 §7.17 Α5β).
 * @related app/api/properties/[id]/listing-media/route · lib/listings/listing-media-fingerprint ·
 *   hooks/listings/usePublishedModelFreshness (το ίδιο ιδίωμα)
 * @module hooks/listings/usePublishedMediaAgreement
 *
 * ⛔ **Η ΚΡΙΣΗ ΔΕΝ ΖΕΙ ΕΔΩ — ΟΥΤΕ ΣΤΟΝ BROWSER.** Τη δίνει ο διακομιστής, από τον **ίδιο** κριτή με
 * τη βραδινή συμφιλίωση. Αυτό το hook είναι **μεταφορά δεδομένων**: ρωτά, δίνει, ξεχνά.
 *
 * ⚠️ **Δεν πετά ποτέ**: αποτυχία ⇒ `unknown` *(«δεν ξέρω»)*, ποτέ `current`. Ίδιο συμβόλαιο με το
 * `usePublishedModelFreshness` — μια ένδειξη που δεν φορτώθηκε δεν ρίχνει την οθόνη της.
 *
 * 🔑 **Ξαναρωτά όταν αλλάζει αρχείο**: η ετυμηγορία αφορά τα αρχεία, και ο άνθρωπος τα αλλάζει στην
 * ίδια οθόνη. Ένα σήμα ανά αρχείο θα ήταν ένα αίτημα ανά αρχείο — η μαζική πράξη 30 φωτογραφιών
 * μαζεύεται σε **ένα**, λίγο μετά το τελευταίο σήμα.
 */

import * as React from 'react';

import { API_ROUTES } from '@/config/domain-constants';
import { apiClient } from '@/lib/api/enterprise-api-client';
import type {
  ListingMediaAgreementResponse,
  ListingMediaVerdict,
} from '@/lib/listings/listing-media-fingerprint';
import { createModuleLogger } from '@/lib/telemetry';
import { RealtimeService } from '@/services/realtime';

const logger = createModuleLogger('usePublishedMediaAgreement');

/** Τα σήματα που σημαίνουν *«άλλαξε αρχείο»* — όσα ακούει και η λίστα αρχείων της ίδιας οθόνης. */
const FILE_CHANGE_EVENTS = [
  'FILE_CREATED',
  'FILE_UPDATED',
  'FILE_TRASHED',
  'FILE_RESTORED',
  'FILE_SUPERSEDED',
] as const;

/** Πόσο περιμένει μετά το τελευταίο σήμα πριν ξαναρωτήσει (ms). */
const SETTLE_MS = 600;

export interface PublishedMediaAgreement {
  /** `null` όσο δεν έχει απαντήσει ο διακομιστής — η οθόνη **σιωπά**, δεν μαντεύει. */
  readonly agreement: ListingMediaVerdict | null;
  readonly mayRefresh: boolean;
  readonly refreshing: boolean;
  /** *«Ενημέρωσε την αγγελία τώρα.»* Δεν πετά· σε αποτυχία η ετυμηγορία γίνεται `unknown`. */
  readonly refresh: () => void;
}

interface State {
  readonly agreement: ListingMediaVerdict | null;
  readonly mayRefresh: boolean;
  readonly refreshing: boolean;
}

const IDLE: State = { agreement: null, mayRefresh: false, refreshing: false };

/** Η απάντηση όταν ο διακομιστής δεν απάντησε: **«δεν ξέρω»**, και καμία πράξη να προταθεί. */
const UNREADABLE: ListingMediaAgreementResponse = { agreement: 'unknown', mayRefresh: false };

async function ask(
  propertyId: string,
  how: 'read' | 'refresh',
): Promise<ListingMediaAgreementResponse> {
  const route = API_ROUTES.PROPERTIES.LISTING_MEDIA(propertyId);
  try {
    return how === 'read'
      ? await apiClient.get<ListingMediaAgreementResponse>(route)
      : await apiClient.post<ListingMediaAgreementResponse>(route, {});
  } catch (error) {
    logger.warn('Η συμφωνία μέσων της αγγελίας δεν διαβάστηκε — η οθόνη λέει «δεν ξέρω»', {
      propertyId, how, error: error instanceof Error ? error.message : String(error),
    });
    return UNREADABLE;
  }
}

export function usePublishedMediaAgreement(
  propertyId: string | null | undefined,
): PublishedMediaAgreement {
  const [state, setState] = React.useState<State>(IDLE);
  // ⚠️ **Ακύρωση, όχι μόνο καθαρισμός**: αργοπορημένη απάντηση **άλλου** ακινήτου δεν επιτρέπεται
  //    να γραφτεί πάνω στην τρέχουσα οθόνη. Ο μετρητής ανεβαίνει σε κάθε αλλαγή ακινήτου.
  const epoch = React.useRef(0);

  const run = React.useCallback((id: string, how: 'read' | 'refresh') => {
    const mine = epoch.current;
    if (how === 'refresh') setState((previous) => ({ ...previous, refreshing: true }));

    void ask(id, how).then((answer) => {
      if (mine === epoch.current) setState({ ...answer, refreshing: false });
    });
  }, []);

  React.useEffect(() => {
    epoch.current += 1;
    setState(IDLE);
    if (!propertyId) return;

    run(propertyId, 'read');

    let timer: ReturnType<typeof setTimeout> | null = null;
    const onFileChange = (): void => {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => run(propertyId, 'read'), SETTLE_MS);
    };
    const unsubscribers = FILE_CHANGE_EVENTS.map((event) => RealtimeService.subscribe(event, onFileChange));

    return () => {
      if (timer !== null) clearTimeout(timer);
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [propertyId, run]);

  const refresh = React.useCallback(() => {
    if (propertyId) run(propertyId, 'refresh');
  }, [propertyId, run]);

  return { ...state, refresh };
}
