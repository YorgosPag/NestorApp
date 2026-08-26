/**
 * ADR-798 §22 — **Η ΜΗΧΑΝΗ ΕΚΤΕΛΕΙΤΑΙ, ΔΕΝ ΔΙΑΒΑΖΕΤΑΙ.**
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔴 ΤΟ ΜΑΘΗΜΑ ΠΟΥ ΓΕΝΝΗΣΕ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ
 *
 * Η προηγούμενη άγκυρα του §21 ρωτούσε `toContain('isMissingTenantError')` —
 * δηλαδή απεδείκνυε ότι υπάρχει η **εισαγωγή**, όχι ότι ο φρουρός **τρέχει**.
 * Αντικαθιστώντας τη συνθήκη με `if (false)` έμενε **ΠΡΑΣΙΝΗ** πάνω σε νεκρό
 * φρουρό, σε **δύο** αρχεία. *Άγκυρα που διαβάζει πηγή απαντά «είναι
 * γραμμένο;», ποτέ «λέει το σωστό;».*
 *
 * Εδώ **δεν διαβάζεται καμία πηγή**: η μηχανή στήνεται, το `onError` πυροδοτείται
 * με πραγματικά σφάλματα, και κρίνεται η **κατάσταση που βλέπει ο άνθρωπος**.
 *
 * ⚠️ Το `@/services/firestore` είναι πλαστό — το `@/services/firestore/auth-context`
 * **ΟΧΙ**: ο κριτής (`isMissingTenantError`) και ο δρομολογητής
 * (`routeTenantScopedError`) εκτελούνται **αληθινοί**. Αλλιώς η άγκυρα θα
 * επικύρωνε το πλαστό της.
 * ═════════════════════════════════════════════════════════════════════════════
 */

import { renderHook, act } from '@testing-library/react';
import type { DocumentData } from 'firebase/firestore';
import { MissingTenantError } from '@/services/firestore/auth-context';
import { createModuleLogger } from '@/lib/telemetry';
import { createStaleCache } from '@/lib/stale-cache';
import { firestoreQueryService } from '@/services/firestore';
import { createRealtimeCollectionHook } from '../create-realtime-collection-hook';

jest.mock('@/services/firestore', () => ({
  firestoreQueryService: { subscribe: jest.fn() },
}));

/**
 * ⚠️ **ΜΟΝΟ ΤΟ SDK, ΠΟΤΕ Ο ΚΡΙΤΗΣ.** Το `auth-context` σέρνει στο import του το
 * `firebase/auth`, που θέλει `fetch` — global που το jsdom δεν εκθέτει. Πλαστά
 * γίνονται **αποκλειστικά** αυτά τα δύο σύνορα SDK· ο `isMissingTenantError`
 * και ο `MissingTenantError` ζουν στο **ίδιο** το `auth-context`, είναι καθαροί,
 * και εκτελούνται **αληθινοί**. Πλαστός κριτής = άγκυρα που επικυρώνει το
 * πλαστό της.
 */
jest.mock('@/lib/firebase', () => ({ auth: {} }));
jest.mock('firebase/auth', () => ({ onAuthStateChanged: jest.fn() }));

type OnData = (result: { documents: readonly DocumentData[] }) => void;
type OnError = (error: Error) => void;

const subscribeMock = firestoreQueryService.subscribe as unknown as jest.Mock;

/** Το τελευταίο ζεύγος χειριστών που έδωσε η μηχανή στο SSoT ερώτημα. */
function lastHandlers(): { onData: OnData; onError: OnError } {
  const call = subscribeMock.mock.calls[subscribeMock.mock.calls.length - 1];
  return { onData: call[1] as OnData, onError: call[2] as OnError };
}

const logger = createModuleLogger('create-realtime-collection-hook.test');

/** Ένα hook ανά test: η μηχανή κρατά state ανά **ορισμό**, όχι καθολικά. */
function buildHook(cache?: ReturnType<typeof createStaleCache<string[]>>) {
  return createRealtimeCollectionHook<DocumentData, string>({
    collection: 'TASKS',
    logger,
    cache,
    mapDocuments: (documents) => documents.map((doc) => doc.id as string),
  });
}

let unsubscribe: jest.Mock;

beforeEach(() => {
  jest.restoreAllMocks();
  subscribeMock.mockReset();
  unsubscribe = jest.fn();
  subscribeMock.mockImplementation(() => unsubscribe);
});

// ============================================================================
describe('Α — ο κύκλος ζωής, από άκρη σε άκρη', () => {
  test('Α1 — προσάρτηση ⇒ connecting ⇒ δεδομένα ⇒ active', () => {
    const { result } = renderHook(() => buildHook()(true));

    expect(result.current.status).toBe('connecting');
    expect(result.current.loading).toBe(true);
    expect(subscribeMock).toHaveBeenCalledTimes(1);
    expect(subscribeMock.mock.calls[0][0]).toBe('TASKS');

    act(() => lastHandlers().onData({ documents: [{ id: 'a' }, { id: 'b' }] }));

    expect(result.current.items).toEqual(['a', 'b']);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.status).toBe('active');
  });

  test('Α2 — αποπροσάρτηση **κλείνει** τη συνδρομή', () => {
    // Ο παρονομαστής κάθε διαρροής listener: χωρίς αυτό, μια ξεχασμένη
    // `return` στο effect θα άφηνε το `onSnapshot` ζωντανό για πάντα.
    const { unmount } = renderHook(() => buildHook()(true));
    expect(unsubscribe).not.toHaveBeenCalled();
    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  test('Α3 — `enabled: false` ⇒ ΚΑΜΙΑ συνδρομή, κατάσταση idle', () => {
    const { result } = renderHook(() => buildHook()(false));
    expect(subscribeMock).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
    expect(result.current.loading).toBe(false);
  });
});

// ============================================================================
describe('Β — 🔴 Η ΚΡΙΣΗ «σχεδιασμένη κατάσταση ή βλάβη;» ΤΡΕΧΕΙ', () => {
  test('Β1 — «δεν ανήκεις σε εταιρεία» ⇒ κενό + active + ΚΑΜΙΑ κόκκινη γραμμή', () => {
    // Ο αυτόνομος του ADR-807 δεν έχει οργανισμό **εκ σχεδιασμού**. Αυτό δεν
    // είναι βλάβη — και ο θόρυβος κρύβει τα αληθινά σφάλματα.
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => undefined);
    const { result } = renderHook(() => buildHook()(true));

    act(() => lastHandlers().onData({ documents: [{ id: 'a' }] }));
    act(() => lastHandlers().onError(new MissingTenantError()));

    expect(result.current.items).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(result.current.status).toBe('active');
    expect(errorSpy).not.toHaveBeenCalled();
  });

  test('Β2 — ΠΑΡΟΝΟΜΑΣΤΗΣ: ΠΡΑΓΜΑΤΙΚΗ βλάβη ⇒ error + status error + κόκκινη γραμμή', () => {
    // Χωρίς αυτό, μια μηχανή που καλεί **πάντα** το `onDesignedEmpty` θα
    // περνούσε το Β1 και θα **έθαβε κάθε σφάλμα** — σιωπή αντί για διάκριση.
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => undefined);
    const { result } = renderHook(() => buildHook()(true));

    act(() => lastHandlers().onError(new Error('PERMISSION_DENIED: real breakage')));

    expect(result.current.error).toBe('PERMISSION_DENIED: real breakage');
    expect(result.current.status).toBe('error');
    expect(result.current.loading).toBe(false);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  test('Β3 — 🔴 το σχεδιασμένο κενό ΔΕΝ γράφεται στη μνήμη ADR-300', () => {
    // Αλλιώς το κενό του αυτόνομου θα το **κληρονομούσε** η επόμενη ταυτότητα
    // που θα προσαρτούσε τη σελίδα — δεδομένα ενός χρήστη στην οθόνη άλλου.
    const cache = createStaleCache<string[]>('anchor-designed-empty');
    const { result } = renderHook(() => buildHook(cache)(true));

    act(() => lastHandlers().onData({ documents: [{ id: 'a' }] }));
    expect(cache.get()).toEqual(['a']); // ο παρονομαστής: η μνήμη ΟΝΤΩΣ γράφεται

    act(() => lastHandlers().onError(new MissingTenantError()));
    expect(result.current.items).toEqual([]);
    expect(cache.get()).toEqual(['a']); // ...αλλά ΟΧΙ από το σχεδιασμένο κενό
  });
});

// ============================================================================
describe('Γ — ο πυροδότης του `refetch` είναι STATE, όχι ref', () => {
  test('Γ1 — `refetch()` **ξαναστήνει** τη συνδρομή', () => {
    // 🔴 Η ΑΠΟΦΑΣΗ ΤΟΥ §22: τρία από τα πέντε αδέλφια κρατούσαν τον πυροδότη σε
    // `useRef` και τον διάβαζαν στο dep array — μη-αντιδραστική σύλληψη, που
    // επανεγγράφεται **κατά τύχη**, μόνο όταν ένα διπλανό `setState` προκαλέσει
    // render. Το `useRealtimeBuildings` το είχε ήδη διορθώσει σε state
    // (2026-06-11) και **αυτό** το δόγμα υιοθετήθηκε για όλους.
    const { result } = renderHook(() => buildHook()(true));
    expect(subscribeMock).toHaveBeenCalledTimes(1);

    act(() => result.current.refetch());

    expect(subscribeMock).toHaveBeenCalledTimes(2);
    expect(unsubscribe).toHaveBeenCalledTimes(1); // η παλιά έκλεισε πρώτα
  });

  test('Γ2 — ΤΟ ΑΟΡΑΤΟ: `refetch()` ΕΝΩ φορτώνει ήδη, δουλεύει κι αυτό', () => {
    // 🔑 Αυτό ακριβώς **έπεφτε σιωπηλά** στην έκδοση με ref: με `loading === true`
    // και `error === null`, τα `setLoading(true)`/`setError(null)` του `refetch`
    // είναι **no-op** ⇒ κανένα render ⇒ το `ref.current` δεν ξαναδιαβάζεται ποτέ
    // ⇒ **καμία** επανεγγραφή. Με state, ο μετρητής αλλάζει πάντα.
    const { result } = renderHook(() => buildHook()(true));
    expect(result.current.loading).toBe(true); // ο παρονομαστής: ΟΝΤΩΣ φορτώνει

    act(() => result.current.refetch());

    expect(subscribeMock).toHaveBeenCalledTimes(2);
  });
});
