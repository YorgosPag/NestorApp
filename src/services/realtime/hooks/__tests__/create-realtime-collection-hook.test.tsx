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
 *
 * 🔑 **ΤΟ ΕΡΓΟΣΤΑΣΙΟ ΚΑΛΕΙΤΑΙ ΜΙΑ ΦΟΡΑ, ΠΟΤΕ ΜΕΣΑ ΣΕ RENDER** — όπως στην
 * πραγματική χρήση (`const useX = createRealtimeCollectionHook(...)` σε εμβέλεια
 * module). Η πρώτη γραφή αυτού του αρχείου το καλούσε **μέσα** στη render
 * callback: κάθε render έφτιαχνε **νέο** store, και οι άγκυρες του Βήματος Β
 * κοκκίνισαν σωστά δείχνοντάς το.
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

/**
 * Ένα **εργοστάσιο** ανά test — δηλαδή ένα store ανά test, ίδια απομόνωση με
 * ξεχωριστό αρχείο hook. Καλείται **έξω** από κάθε render.
 */
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
    const useCollection = buildHook();
    const { result } = renderHook(() => useCollection(true));

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
    // Ο παρονομαστής κάθε διαρροής listener: χωρίς αυτό, ξεχασμένος καθαρισμός
    // θα άφηνε το `onSnapshot` ζωντανό για πάντα.
    const useCollection = buildHook();
    const { unmount } = renderHook(() => useCollection(true));
    expect(unsubscribe).not.toHaveBeenCalled();
    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  test('Α3 — `enabled: false` ⇒ ΚΑΜΙΑ συνδρομή, κατάσταση idle', () => {
    const useCollection = buildHook();
    const { result } = renderHook(() => useCollection(false));
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
    const useCollection = buildHook();
    const { result } = renderHook(() => useCollection(true));

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
    const useCollection = buildHook();
    const { result } = renderHook(() => useCollection(true));

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
    const useCollection = buildHook(cache);
    const { result } = renderHook(() => useCollection(true));

    act(() => lastHandlers().onData({ documents: [{ id: 'a' }] }));
    expect(cache.get()).toEqual(['a']); // ο παρονομαστής: η μνήμη ΟΝΤΩΣ γράφεται

    act(() => lastHandlers().onError(new MissingTenantError()));
    expect(result.current.items).toEqual([]);
    expect(cache.get()).toEqual(['a']); // ...αλλά ΟΧΙ από το σχεδιασμένο κενό
  });
});

// ============================================================================
describe('Γ — ο πυροδότης του `refetch` ξαναστήνει, όντως', () => {
  test('Γ1 — `refetch()` **ξαναστήνει** τη συνδρομή', () => {
    // 🔴 Η ΑΠΟΦΑΣΗ ΤΟΥ §22.4: τρία από τα πέντε αδέλφια κρατούσαν τον πυροδότη σε
    // `useRef` και τον διάβαζαν στο dep array — μη-αντιδραστική σύλληψη, που
    // επανεγγράφεται **κατά τύχη**, μόνο όταν ένα διπλανό `setState` προκαλέσει
    // render. Το `useRealtimeBuildings` το είχε ήδη διορθώσει (2026-06-11).
    const useCollection = buildHook();
    const { result } = renderHook(() => useCollection(true));
    expect(subscribeMock).toHaveBeenCalledTimes(1);

    act(() => result.current.refetch());

    expect(subscribeMock).toHaveBeenCalledTimes(2);
    expect(unsubscribe).toHaveBeenCalledTimes(1); // η παλιά έκλεισε πρώτα
  });

  test('Γ2 — ΤΟ ΑΟΡΑΤΟ: `refetch()` ΕΝΩ φορτώνει ήδη, δουλεύει κι αυτό', () => {
    // 🔑 Αυτό ακριβώς **έπεφτε σιωπηλά** στην έκδοση με ref: με `loading === true`
    // και `error === null`, τα `setLoading(true)`/`setError(null)` του `refetch`
    // ήταν **no-op** ⇒ κανένα render ⇒ το `ref.current` δεν ξαναδιαβαζόταν ποτέ
    // ⇒ **καμία** επανεγγραφή.
    const useCollection = buildHook();
    const { result } = renderHook(() => useCollection(true));
    expect(result.current.loading).toBe(true); // ο παρονομαστής: ΟΝΤΩΣ φορτώνει

    act(() => result.current.refetch());

    expect(subscribeMock).toHaveBeenCalledTimes(2);
  });

  test('Γ3 — ΠΑΡΟΝΟΜΑΣΤΗΣ: απενεργοποιημένος καταναλωτής ΔΕΝ ξαναστήνει', () => {
    // Αλλιώς ένα `refetch()` από οθόνη που έχει ρητά δηλώσει «μη με συνδέσεις»
    // θα άνοιγε συνδρομή που κανείς δεν ζήτησε.
    const useCollection = buildHook();
    const { result } = renderHook(() => useCollection(false));
    act(() => result.current.refetch());
    expect(subscribeMock).not.toHaveBeenCalled();
  });
});

// ============================================================================
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Δ — 🔴 ΒΗΜΑ Β: **ΕΝΑΣ LISTENER ΓΙΑ ΟΛΟΥΣ** (§22.7)
 *
 * Το μετρημένο περιστατικό του `useFirestoreBuildings` (2026-06-11): ~11
 * ταυτόχρονοι καταναλωτές άνοιγαν ο καθένας **δικό του** `onSnapshot` ⇒ **9×**
 * διπλή δουλειά ανά αλλαγή. Οι πέντε αδελφοί είχαν **2-4** ο καθένας.
 * ═══════════════════════════════════════════════════════════════════════════
 */
describe('Δ — ο κοινός, μετρημένος listener', () => {
  test('Δ1 — ΔΥΟ καταναλωτές ⇒ **ΜΙΑ** συνδρομή', () => {
    const useCollection = buildHook();
    renderHook(() => useCollection(true));
    renderHook(() => useCollection(true));

    expect(subscribeMock).toHaveBeenCalledTimes(1);
  });

  test('Δ2 — μία παράδοση φτάνει σε **ΟΛΟΥΣ** τους καταναλωτές', () => {
    // Ο παρονομαστής του Δ1: χωρίς αυτό, «μία συνδρομή» θα μπορούσε να σημαίνει
    // ότι ο δεύτερος καταναλωτής απλώς **δεν βλέπει τίποτα**.
    const useCollection = buildHook();
    const first = renderHook(() => useCollection(true));
    const second = renderHook(() => useCollection(true));

    act(() => lastHandlers().onData({ documents: [{ id: 'a' }, { id: 'b' }] }));

    expect(first.result.current.items).toEqual(['a', 'b']);
    expect(second.result.current.items).toEqual(['a', 'b']);
    // ...και είναι **η ίδια** αναφορά: μία χαρτογράφηση, όχι δύο.
    expect(first.result.current.items).toBe(second.result.current.items);
  });

  test('Δ3 — ο ΠΡΩΤΟΣ που φεύγει ΔΕΝ κλείνει· ο ΤΕΛΕΥΤΑΙΟΣ κλείνει', () => {
    const useCollection = buildHook();
    const first = renderHook(() => useCollection(true));
    const second = renderHook(() => useCollection(true));

    first.unmount();
    expect(unsubscribe).not.toHaveBeenCalled(); // ο δεύτερος ακούει ακόμη

    second.unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  test('Δ4 — 🔴 Η ΑΙΧΜΗ ΤΟΥ TanStack: επαναπροσάρτηση ΞΑΝΑΣΤΗΝΕΙ, ποτέ παγωμένα', () => {
    // Το invertase/tanstack-query-firebase #25 περιγράφει ακριβώς αυτό: όταν
    // φύγει ο τελευταίος καταναλωτής η συνδρομή κλείνει, και σε επαναπροσάρτηση
    // **όσο η εγγραφή ζει στη μνήμη** το `queryFn` δεν ξανατρέχει ⇒ η οθόνη
    // δείχνει **σιωπηλά παγωμένα** δεδομένα. Εδώ ο μετρητής αναφορών 0 → 1
    // ξαναστήνει, ενώ τα δεδομένα επιβιώνουν ⇒ μηδέν αναλαμπή ΚΑΙ μηδέν ψέμα.
    const useCollection = buildHook();
    const first = renderHook(() => useCollection(true));
    act(() => lastHandlers().onData({ documents: [{ id: 'a' }] }));
    first.unmount();

    expect(subscribeMock).toHaveBeenCalledTimes(1);

    const second = renderHook(() => useCollection(true));
    expect(subscribeMock).toHaveBeenCalledTimes(2); // ΞΑΝΑΣΤΗΘΗΚΕ
    expect(second.result.current.items).toEqual(['a']); // ...χωρίς αναλαμπή
  });

  test('Δ5 — 🔑 το ατομικό συμβόλαιο του `enabled` ΕΠΙΒΙΩΝΕΙ του κοινού store', () => {
    // 🔴 Ο κίνδυνος του Βήματος Β: με κοινή κατάσταση, ένας καταναλωτής που έχει
    // ρητά δηλώσει «μη με συνδέσεις» θα μπορούσε να **αρχίσει να βλέπει
    // δεδομένα** επειδή τα ζήτησε κάποιος άλλος. Το store είναι κοινό — η
    // **προβολή** του, όχι.
    const useCollection = buildHook();
    const active = renderHook(() => useCollection(true));
    const disabled = renderHook(() => useCollection(false));

    act(() => lastHandlers().onData({ documents: [{ id: 'a' }] }));

    expect(active.result.current.items).toEqual(['a']);
    expect(disabled.result.current.items).toEqual([]);
    expect(disabled.result.current.status).toBe('idle');
    expect(disabled.result.current.loading).toBe(false);
  });
});
