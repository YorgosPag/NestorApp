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
import type { Property } from '@/types/property-viewer';

const PROPERTY = { id: 'prop_1', name: 'Δ3' } as unknown as Property;

describe('ADR-777 §8.30 — οι τρεις καταστάσεις της καρτέλας', () => {
  it('Κ1 🔴 ΑΓΝΟΙΑ ≠ ΑΠΟΥΣΙΑ: χωρίς απάντηση καταλόγου δεν λέμε «δεν βρέθηκε»', () => {
    // 🔴 **Η ακριβής ζωντανή κατάσταση**: ο ακροατής δεν ξεκίνησε (`loading`
    // false, τεμπέλικη ενεργοποίηση) και ο κατάλογος είναι κενός.
    expect(
      derivePropertyPageState({ loading: false, hasAnswered: false, property: null }),
    ).toEqual({ kind: 'loading' });
  });

  it('Κ2: «δεν βρέθηκε» ΜΟΝΟ αφού ο κατάλογος απάντησε', () => {
    expect(
      derivePropertyPageState({ loading: false, hasAnswered: true, property: null }),
    ).toEqual({ kind: 'absent' });
  });

  it('Κ3: ενεργός ακροατής ⇒ φορτώνει, ό,τι κι αν λέει το `hasAnswered`', () => {
    // Επαναφόρτωση μετά από `forceDataRefresh`: ο κατάλογος **έχει** απαντήσει
    // στο παρελθόν αλλά ρωτά ξανά — δεν ανακοινώνουμε ετυμηγορία στο ενδιάμεσο.
    expect(
      derivePropertyPageState({ loading: true, hasAnswered: true, property: null }),
    ).toEqual({ kind: 'loading' });
    expect(
      derivePropertyPageState({ loading: true, hasAnswered: false, property: null }),
    ).toEqual({ kind: 'loading' });
  });

  it('Κ4: βρέθηκε ⇒ το ίδιο το ακίνητο ταξιδεύει στην κατάσταση', () => {
    const state = derivePropertyPageState({
      loading: false,
      hasAnswered: true,
      property: PROPERTY,
    });
    expect(state).toEqual({ kind: 'found', property: PROPERTY });
  });

  it('Κ5: `undefined` ακίνητο κρίνεται όπως το `null` — μία απουσία, όχι δύο', () => {
    expect(
      derivePropertyPageState({ loading: false, hasAnswered: true, property: undefined }),
    ).toEqual({ kind: 'absent' });
  });

  it('Κ6: η καθαρή συνάρτηση δεν κρύβει τέταρτη κατάσταση', () => {
    const kinds = new Set(
      [
        [false, false, null],
        [false, true, null],
        [true, false, null],
        [true, true, null],
        [false, false, PROPERTY],
        [false, true, PROPERTY],
        [true, false, PROPERTY],
        [true, true, PROPERTY],
      ].map(([loading, hasAnswered, property]) =>
        derivePropertyPageState({
          loading: loading as boolean,
          hasAnswered: hasAnswered as boolean,
          property: property as Property | null,
        }).kind,
      ),
    );
    expect([...kinds].sort()).toEqual(['absent', 'found', 'loading']);
  });
});
