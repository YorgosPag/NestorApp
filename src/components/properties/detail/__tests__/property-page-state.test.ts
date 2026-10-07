/**
 * @fileoverview **ΑΓΚΥΡΕΣ: «ΔΕΝ ΒΡΕΘΗΚΕ» ΣΗΜΑΙΝΕΙ ΨΑΞΑΜΕ** (ADR-777 §8.30).
 * @related components/properties/detail/property-page-state · SharedPropertiesProvider
 *
 * 🔴 **Το ελάττωμα που κλειδώνουν αυτές οι άγκυρες ήταν ΖΩΝΤΑΝΟ, όχι υποθετικό.**
 * Η πρώτη γραφή της απόφασης έλεγε `loading ? … : property ? … : absent`. Ο
 * `SharedPropertiesProvider` όμως ενεργοποιείται **τεμπέλικα** και ξεκινά με
 * `isLoading === false` (γρ. 60, «Start false (lazy)»), και το `activate()` του
 * ζει σε `useEffect` — δηλαδή **δεν τρέχει ποτέ στον διακομιστή**.
 *
 * Αποτέλεσμα, μετρημένο στο HTML που στέλνει ο διακομιστής: η καρτέλα ανακοίνωνε
 * «**το ακίνητο δεν βρέθηκε**» για ακίνητο που **υπάρχει**. Ένα «δεν βρέθηκε»
 * που σημαίνει «δεν ρώτησα» είναι το σχήμα «0 = κανείς δεν κοίταξε» στραμμένο
 * στον χρήστη — και εδώ έχει τίμημα: όποιος ήρθε από σύνδεσμο email συμπεραίνει
 * ότι το ακίνητό του **διαγράφηκε**.
 */

import { derivePropertyPageState } from '../property-page-state';
import type { RetiredPropertyLookup } from '@/hooks/useRetiredPropertyRecord';
import type { Property } from '@/types/property-viewer';

const PROPERTY = { id: 'prop_1', name: 'Δ3' } as unknown as Property;
const ARCHIVED = { id: 'prop_1', name: 'Δ3', status: 'archived' } as unknown as Property;

/** Ο δεύτερος αναγνώστης ρωτήθηκε και απάντησε «δεν είναι αποσυρμένο δικό σου». */
const NOT_RETIRED: RetiredPropertyLookup = { kind: 'absent' };
const LOOKUPS: readonly RetiredPropertyLookup[] = [
  { kind: 'idle' },
  { kind: 'loading' },
  { kind: 'absent' },
  { kind: 'failed' },
  { kind: 'retired', property: ARCHIVED },
];

describe('ADR-777 §8.30 — οι τρεις καταστάσεις της καρτέλας', () => {
  it('Κ1 🔴 ΑΓΝΟΙΑ ≠ ΑΠΟΥΣΙΑ: χωρίς απάντηση καταλόγου δεν λέμε «δεν βρέθηκε»', () => {
    // 🔴 **Η ακριβής ζωντανή κατάσταση**: ο ακροατής δεν ξεκίνησε (`loading`
    // false, τεμπέλικη ενεργοποίηση) και ο κατάλογος είναι κενός.
    expect(
      derivePropertyPageState({ loading: false, hasAnswered: false, property: null, retired: NOT_RETIRED }),
    ).toEqual({ kind: 'loading' });
  });

  it('Κ2: «δεν βρέθηκε» ΜΟΝΟ αφού ο κατάλογος απάντησε', () => {
    expect(
      derivePropertyPageState({ loading: false, hasAnswered: true, property: null, retired: NOT_RETIRED }),
    ).toEqual({ kind: 'absent' });
  });

  it('Κ3: ενεργός ακροατής ⇒ φορτώνει, ό,τι κι αν λέει το `hasAnswered`', () => {
    // Επαναφόρτωση μετά από `forceDataRefresh`: ο κατάλογος **έχει** απαντήσει
    // στο παρελθόν αλλά ρωτά ξανά — δεν ανακοινώνουμε ετυμηγορία στο ενδιάμεσο.
    expect(
      derivePropertyPageState({ loading: true, hasAnswered: true, property: null, retired: NOT_RETIRED }),
    ).toEqual({ kind: 'loading' });
    expect(
      derivePropertyPageState({ loading: true, hasAnswered: false, property: null, retired: NOT_RETIRED }),
    ).toEqual({ kind: 'loading' });
  });

  it('Κ4: βρέθηκε ⇒ το ίδιο το ακίνητο ταξιδεύει στην κατάσταση', () => {
    const state = derivePropertyPageState({
      loading: false,
      hasAnswered: true,
      property: PROPERTY,
      retired: NOT_RETIRED,
    });
    expect(state).toEqual({ kind: 'found', property: PROPERTY });
  });

  it('Κ5: `undefined` ακίνητο κρίνεται όπως το `null` — μία απουσία, όχι δύο', () => {
    expect(
      derivePropertyPageState({ loading: false, hasAnswered: true, property: undefined, retired: NOT_RETIRED }),
    ).toEqual({ kind: 'absent' });
  });

  it('Κ6: η καθαρή συνάρτηση δεν κρύβει έκτη κατάσταση', () => {
    const kinds = new Set<string>();
    for (const loading of [false, true]) {
      for (const hasAnswered of [false, true]) {
        for (const property of [null, PROPERTY]) {
          for (const retired of LOOKUPS) {
            kinds.add(derivePropertyPageState({ loading, hasAnswered, property, retired }).kind);
          }
        }
      }
    }
    expect([...kinds].sort()).toEqual(['absent', 'found', 'loading', 'retired', 'unreachable']);
  });
});

describe('ADR-329 §3.9 — ο σύνδεσμος προς αποσυρμένο ακίνητο δεν είναι αδιέξοδο', () => {
  const answered = { loading: false, hasAnswered: true, property: null } as const;

  it('Α1 🔴 αποσυρμένο ⇒ η καρτέλα το δείχνει, δεν λέει «δεν βρέθηκε»', () => {
    // 🔴 **Η ζωντανή κατάσταση πριν τη διόρθωση**: ο κατάλογος δεν περιέχει αποσυρμένα, άρα το
    // «Άνοιγμα σε σελίδα» ενός αρχειοθετημένου και κάθε σύνδεσμος του ιστορικού έβγαζαν «δεν βρέθηκε».
    expect(
      derivePropertyPageState({ ...answered, retired: { kind: 'retired', property: ARCHIVED } }),
    ).toEqual({ kind: 'retired', property: ARCHIVED });
  });

  it('Α2 🔴 ΑΓΝΟΙΑ ≠ ΑΠΟΥΣΙΑ, δεύτερη φορά: όσο ο δεύτερος αναγνώστης δεν απάντησε, φορτώνει', () => {
    // Το `idle` είναι το καρέ ανάμεσα στην απάντηση του καταλόγου και στο effect που ρωτά.
    for (const kind of ['idle', 'loading'] as const) {
      expect(derivePropertyPageState({ ...answered, retired: { kind } })).toEqual({ kind: 'loading' });
    }
  });

  it('Α3 🔴 «δεν μπόρεσα να ρωτήσω» δεν είναι «δεν βρέθηκε»', () => {
    // Αποτυχία δικτύου ή 5xx: το «δεν βρέθηκε» εδώ θα έλεγε σε όποιον ήρθε από σύνδεσμο ότι το
    // ακίνητό του διαγράφηκε, ενώ απλώς δεν απάντησε ο διακομιστής.
    expect(derivePropertyPageState({ ...answered, retired: { kind: 'failed' } })).toEqual({ kind: 'unreachable' });
  });

  it('Α4 🔑 ο κατάλογος προηγείται ΠΑΝΤΑ: ζωντανό ακίνητο κερδίζει μπαγιάτικη απόσυρση', () => {
    // Επαναφορά (από εδώ ή από αλλού): ο ζωντανός κατάλογος αποκτά το ακίνητο ενώ ο δεύτερος
    // αναγνώστης κρατά ακόμη το αποσυρμένο στιγμιότυπο. Η σελίδα ξεκλειδώνει χωρίς ανανέωση.
    for (const retired of LOOKUPS) {
      expect(
        derivePropertyPageState({ loading: false, hasAnswered: true, property: PROPERTY, retired }),
      ).toEqual({ kind: 'found', property: PROPERTY });
    }
  });

  it('Α5: ο δεύτερος αναγνώστης δεν μιλά πριν από τον κατάλογο', () => {
    expect(
      derivePropertyPageState({
        loading: false,
        hasAnswered: false,
        property: null,
        retired: { kind: 'retired', property: ARCHIVED },
      }),
    ).toEqual({ kind: 'loading' });
  });
});
