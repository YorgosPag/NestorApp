'use client';

/**
 * @fileoverview **Η ΖΩΝΤΑΝΗ ΑΝΑΓΝΩΣΗ ΜΕ ΚΛΕΙΔΙ, ΧΩΡΙΣ ΧΩΡΟ** — `onSnapshot` για δεδομένα που **δεν ανήκουν σε
 * εταιρεία**, με σύνορο ανάγνωσης και κλειδί που ορίζει πότε ξανανοίγει η συνδρομή.
 * @related ADR-867 Β7 · `useOwnedDocuments.ts` (το ίδιο σχήμα για «τα δικά μου») · `use-keyed-realtime-subscription.ts`
 * @module services/realtime/hooks/use-live-snapshot
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΟΧΙ `firestoreQueryService` — ΜΕΤΡΗΜΕΝΟ 2026-09-19
 * ────────────────────────────────────────────────────────────────────────────
 * Κάθε συνδρομή του (`subscribeDoc` · `subscribeToCollection`) καλεί `requireAuthContext()`, που για
 * άνθρωπο **χωρίς** εταιρεία ρίχνει `MissingTenantError` (`auth-context.ts`). Ένα νήμα δικτύου έχει
 * **δύο** πλευρές και η μία είναι ιδιώτης (ο ιδιοκτήτης) ⇒ μέσω εκείνης της υπηρεσίας **η οθόνη του
 * ιδιοκτήτη δεν θα άνοιγε ποτέ**. Η απομόνωση εδώ δεν είναι φίλτρο εταιρείας — είναι ο **κανόνας**
 * (`network_audience/{uid}` ζωντανή), που για ξένο νήμα απαντά **άρνηση**.
 *
 * 🔑 **Η ΑΡΝΗΣΗ ΤΟΥ ΚΑΝΟΝΑ ⇒ `absent`, ΠΟΤΕ «ΑΠΑΓΟΡΕΥΕΤΑΙ»** (ίδιο συμβόλαιο με το `useOwnedDocument`):
 * ένα «δεν σου επιτρέπεται» θα **επιβεβαίωνε** ότι υπάρχει συνομιλία εκεί.
 *
 * ⚠️ **Το κλειδί είναι η ΜΟΝΗ εξάρτηση** (το σχήμα του `use-keyed-realtime-subscription`): ο καλών χτίζει
 * το ερώτημα **inline**, άρα η ταυτότητά του αλλάζει σε κάθε render· κρατιέται σε `ref`. `null` ⇒ καμία
 * συνδρομή (`idle`).
 */

import { useEffect, useRef, useState } from 'react';
import {
  onSnapshot,
  type DocumentData,
  type DocumentReference,
  type Query,
} from 'firebase/firestore';

import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useLiveSnapshot');

export type LiveState<T> =
  | { readonly state: 'idle' }
  | { readonly state: 'loading' }
  | { readonly state: 'ready'; readonly value: T }
  /** Δεν υπάρχει **για σένα** — ανύπαρκτο **ή** αρνημένο από τον κανόνα: επίτηδες αδιάκριτα. */
  | { readonly state: 'absent' }
  | { readonly state: 'error'; readonly message: string };

type Emit<T> = (value: T | null) => void;
type Opener<T> = (emit: Emit<T>, fail: (error: Error) => void) => () => void;

const isPermissionDenied = (error: Error): boolean =>
  (error as { readonly code?: string }).code === 'permission-denied' || error.message.includes('permission');

/** Ο **ένας** κύκλος ζωής: άνοιγμα ανά κλειδί, `absent` στην άρνηση, κλείσιμο στο unmount. */
function useLiveSource<T>(key: string | null, open: Opener<T>, label: string): LiveState<T> {
  const [live, setLive] = useState<LiveState<T>>(key === null ? { state: 'idle' } : { state: 'loading' });
  const opener = useRef(open);
  opener.current = open;

  useEffect(() => {
    if (key === null) {
      setLive({ state: 'idle' });
      return undefined;
    }
    setLive({ state: 'loading' });
    return opener.current(
      (value) => setLive(value === null ? { state: 'absent' } : { state: 'ready', value }),
      (error) => {
        if (isPermissionDenied(error)) {
          setLive({ state: 'absent' });
          return;
        }
        logger.error(`Δεν φορτώθηκε: ${label}`, { data: { key }, error: error.message });
        setLive({ state: 'error', message: error.message });
      },
    );
  }, [key, label]);

  return live;
}

/** **Ένα** έγγραφο, ζωντανά — `fromDocument` είναι το σύνορο (`null` ⇒ «δεν είναι έγγραφο του τομέα»). */
export function useLiveDocument<T>(
  key: string | null,
  ref: () => DocumentReference<DocumentData>,
  fromDocument: (raw: unknown, id: string) => T | null,
  label: string,
): LiveState<T> {
  return useLiveSource<T>(
    key,
    (emit, fail) =>
      onSnapshot(
        ref(),
        (snapshot) => emit(snapshot.exists() ? fromDocument(snapshot.data(), snapshot.id) : null),
        fail,
      ),
    label,
  );
}

/** **Μια λίστα**, ζωντανά — ό,τι δεν περνά το σύνορο **πέφτει**, δεν μπαίνει ως τρύπα. */
export function useLiveList<T>(
  key: string | null,
  query: () => Query<DocumentData>,
  fromDocument: (raw: unknown, id: string) => T | null,
  label: string,
): LiveState<readonly T[]> {
  return useLiveSource<readonly T[]>(
    key,
    (emit, fail) =>
      onSnapshot(
        query(),
        (snapshot) =>
          emit(
            snapshot.docs.flatMap((entry) => {
              const item = fromDocument(entry.data(), entry.id);
              return item === null ? [] : [item];
            }),
          ),
        fail,
      ),
    label,
  );
}
