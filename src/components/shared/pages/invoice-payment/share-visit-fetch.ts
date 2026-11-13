/**
 * share-visit-fetch — κάθε ερώτηση της σελίδας τιμολογίου μέσα σε **ζωντανή επίσκεψη** (ADR-315 Α6 · ADR-ACC-030 §5.6).
 *
 * Η επίσκεψη (κουπόνι `HttpOnly`) λήγει μετά από 15′ **αδράνειας** ή στις 8 ώρες από το άνοιγμα. Όταν μια ερώτηση
 * ακούσει `visit-expired`, η σελίδα **δεν** δείχνει σφάλμα: ανοίγει **μία** νέα επίσκεψη με το ίδιο token
 * (`reopenVisit` — ό,τι θα έκανε μια ανανέωση σελίδας, χωρίς να χαθεί τίποτα από την οθόνη) και ξαναρωτά **μία**
 * φορά. Ποτέ βρόχος. Αν η νέα επίσκεψη δεν ανοίξει (ανάκληση · κωδικός · δίκτυο), επιστρέφεται η αρχική άρνηση και
 * ο κάτοχος της σελίδας έχει ήδη δείξει ό,τι είπε ο διακομιστής.
 *
 * Κάθε επανάληψη είναι **νέο** αίτημα: μια πράξη με `Idempotency-Key` παίρνει **νέο** κλειδί (`keyedHeaders`), αφού
 * η πρώτη απορρίφθηκε χωρίς να εκτελεστεί.
 *
 * Το `reopenVisit` φτάνει σε κάθε ερώτηση της σελίδας από **ένα** context (`ShareVisitContext`), όχι με props σε
 * τρία επίπεδα. Χωρίς πάροχο ⇒ καμία νέα επίσκεψη (`false`): η άρνηση φτάνει αυτούσια, όπως πριν.
 *
 * @module components/shared/pages/invoice-payment/share-visit-fetch
 */

'use client';

import { createContext, useContext } from 'react';

/** Νέα επίσκεψη χωρίς ανανέωση σελίδας — `true` ⇒ γράφτηκε νέο κουπόνι (`useSharedFilePageState.reopenVisit`). */
export type ReopenVisit = () => Promise<boolean>;

const NO_REOPEN: ReopenVisit = () => Promise.resolve(false);

/** Ο ΕΝΑΣ δρόμος του `reopenVisit` προς τις ερωτήσεις της σελίδας τιμολογίου. */
export const ShareVisitContext = createContext<ReopenVisit>(NO_REOPEN);

/** Το `reopenVisit` της σελίδας. */
export function useShareVisitReopen(): ReopenVisit {
  return useContext(ShareVisitContext);
}

/** Το σχήμα κάθε απάντησης ροής της σελίδας: `status`, και `reason` στην άρνηση. */
interface VisitFlowBody {
  readonly status: string;
  readonly reason?: string;
}

/** Έληξε η επίσκεψη; (όχι ο σύνδεσμος — εκείνο είναι `link-inactive`). */
export function isVisitExpired(body: VisitFlowBody | null): boolean {
  return body !== null && body.status === 'refused' && body.reason === 'visit-expired';
}

/**
 * Ρωτά· σε `visit-expired` ανοίγει **μία** νέα επίσκεψη και ξαναρωτά **μία** φορά. `null` από το `ask` (δίκτυο ·
 * μη-2xx) περνά αυτούσιο — εκείνο δεν είναι ετυμηγορία για την επίσκεψη.
 */
export async function fetchInVisit<T extends VisitFlowBody>(
  ask: () => Promise<T | null>,
  reopenVisit: ReopenVisit,
): Promise<T | null> {
  const first = await ask();
  if (!isVisitExpired(first)) return first;
  return (await reopenVisit()) ? ask() : first;
}
