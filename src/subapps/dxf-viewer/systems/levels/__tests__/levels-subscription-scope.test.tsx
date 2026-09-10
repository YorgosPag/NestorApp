/**
 * ⚓ ΑΓΚΥΡΑ Α-20 (ADR-845 §7.15, Ο-18) — **η ΣΥΝΔΡΟΜΗ ρωτά ποιου κτηρίου;**
 *
 * ## Η ερώτηση
 *
 * Ο διακομιστής απέκτησε εμβέλεια *(Α-18)*, αλλά ο viewer **δεν διαβάζει από τον
 * διακομιστή**: κρέμεται απευθείας σε `onSnapshot` μέσω του
 * `firestoreQueryService`. Άρα η ίδια ερώτηση πρέπει να απαντηθεί **δεύτερη φορά,
 * με δικό της δρόμο** — αλλιώς η πύλη φυλάει μια πόρτα που κανείς δεν χρησιμοποιεί.
 *
 * ## Δύο πράγματα μετρώνται εδώ, και το δεύτερο είναι παγίδα
 *
 * **Π1** *«Φτάνει η δηλωμένη εμβέλεια στα constraints του ερωτήματος;»*
 *
 * **Π2** 🔴 *«Τρέχει το bootstrap όταν το φιλτραρισμένο ερώτημα γυρίσει άδειο;»*
 * — Το `useLevelsFirestoreSync` δημιουργεί **προεπιλεγμένα επίπεδα** όταν δει
 * κενή λίστα *(ADR-040 Φάση XXI: ο πρώτος χρήστης σε **κενό μισθωτή**)*. Με
 * φίλτρο κτηρίου, «κενό» παύει να σημαίνει «κενός μισθωτής» και αρχίζει να
 * σημαίνει **«κτήριο που περιμένει κάτοψη»**. Τα επίπεδα που θα γεννιόνταν εκεί
 * δεν έχουν `buildingId` ⇒ **δεν θα φαίνονταν ποτέ** στο ίδιο φιλτραρισμένο
 * ερώτημα ⇒ κάθε φόρτωμα θα γεννούσε καινούργια. Σιωπηλός πολλαπλασιαστής
 * σκουπιδιών, και ακριβώς τα *unlinked orphans* που το ADR-420 ονομάζει
 * «επιφάνεια που χάνει σιωπηλά δεδομένα».
 */

import { renderHook } from '@testing-library/react';

interface Constraint {
  readonly kind: string;
  readonly field?: string;
  readonly op?: string;
  readonly value?: unknown;
}

let capturedConstraints: readonly Constraint[] = [];
let deliver: ((result: { documents: unknown[] }) => void) | null = null;
const createdLevels: Array<Record<string, unknown>> = [];

jest.mock('firebase/firestore', () => ({
  orderBy: (field: string) => ({ kind: 'orderBy', field }),
  where: (field: string, op: string, value: unknown) => ({ kind: 'where', field, op, value }),
}));

jest.mock('@/services/firestore', () => ({
  firestoreQueryService: {
    subscribe: (
      _key: string,
      onData: (result: { documents: unknown[] }) => void,
      _onError: unknown,
      options: { constraints?: readonly Constraint[] },
    ) => {
      capturedConstraints = options.constraints ?? [];
      deliver = onData;
      return () => { /* noop */ };
    },
  },
}));

jest.mock('@/services/dxf-level-mutation-gateway', () => ({
  createDxfLevelWithPolicy: (args: { payload: Record<string, unknown> }) => {
    createdLevels.push(args.payload);
    return Promise.resolve({ levelId: 'lvl_new' });
  },
}));

import { useLevelsFirestoreSync } from '../hooks/useLevelsFirestoreSync';

const BLDG_B = 'bldg_bbbbbbbb';

function baseParams(over: Record<string, unknown> = {}) {
  return {
    enableFirestore: true,
    firestoreCollection: 'dxf_viewer_levels',
    currentLevelId: null,
    companyId: 'comp_1',
    userId: 'uid_1',
    isSuperAdmin: false,
    setLevels: jest.fn(),
    setCurrentLevelId: jest.fn(),
    setIsLoading: jest.fn(),
    setError: jest.fn(),
    handleError: jest.fn(),
    ...over,
  } as Parameters<typeof useLevelsFirestoreSync>[0];
}

beforeEach(() => {
  capturedConstraints = [];
  deliver = null;
  createdLevels.length = 0;
});

describe('Π1 — η δηλωμένη εμβέλεια φτάνει στο ερώτημα', () => {
  it('προσθέτει `where(buildingId)` όταν η εμβέλεια είναι δηλωμένη', () => {
    renderHook(() => useLevelsFirestoreSync(baseParams({ activeBuildingId: BLDG_B })));

    expect(capturedConstraints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'where', field: 'buildingId', op: '==', value: BLDG_B }),
      ]),
    );
  });

  it('χωρίς δήλωση δεν φιλτράρει — απουσία εμβέλειας ΔΕΝ είναι κενή εμβέλεια', () => {
    renderHook(() => useLevelsFirestoreSync(baseParams({ activeBuildingId: null })));

    expect(capturedConstraints.filter((c) => c.field === 'buildingId')).toHaveLength(0);
    // Το `orderBy('order')` μένει άθικτο και στις δύο περιπτώσεις.
    expect(capturedConstraints).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'orderBy', field: 'order' })]),
    );
  });
});

describe('Π2 — 🔴 το bootstrap ΔΕΝ τρέχει πίσω από φίλτρο κτηρίου', () => {
  it('κενό φιλτραρισμένο ερώτημα ΔΕΝ γεννά προεπιλεγμένα επίπεδα', () => {
    renderHook(() => useLevelsFirestoreSync(baseParams({ activeBuildingId: BLDG_B })));
    deliver?.({ documents: [] });

    expect(createdLevels).toHaveLength(0);
  });

  it('χωρίς εμβέλεια, το bootstrap κενού μισθωτή εξακολουθεί να τρέχει', () => {
    renderHook(() => useLevelsFirestoreSync(baseParams({ activeBuildingId: null })));
    deliver?.({ documents: [] });

    expect(createdLevels.length).toBeGreaterThan(0);
  });
});
