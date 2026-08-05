/**
 * @fileoverview 🔴 **Ο σπόρος επιβιώνει του reset** — `useContactDataLoader` + `prefill`
 * (ADR-759 Φ1).
 *
 * Δεν είναι θεωρητικός κίνδυνος. Το ίδιο hook καλεί `resetForm()` τη στιγμή που ανοίγει η φόρμα
 * για **νέα** επαφή. Μια προσυμπλήρωση γραμμένη ως ξεχωριστό `useEffect` στον διάλογο θα
 * δούλευε **μόνο** επειδή το `useContactForm` δηλώνεται πιο πάνω στο αρχείο — και θα έσβηνε
 * σιωπηλά την ημέρα που κάποιος θα ανακάτευε δύο γραμμές. Εδώ αποδεικνύεται ότι η σειρά είναι
 * **γραμμένη**, όχι τυχερή: το reset και ο σπόρος ζουν στο **ίδιο** effect, με τον σπόρο δεύτερο.
 *
 * ⚠️ Το test τρέχει το **πραγματικό** hook, με πραγματικό `useState` απέναντι — όχι πλαστό
 * `setFormData` που θα κατέγραφε κλήσεις χωρίς να αποδεικνύει **τι τελικά κρατά η φόρμα**.
 */

import React, { useCallback, useState } from 'react';
import { renderHook, act } from '@testing-library/react';
import { initialFormData, type ContactFormData } from '@/types/ContactFormTypes';
import { useContactDataLoader } from '@/hooks/useContactDataLoader';

jest.mock('@/lib/telemetry', () => ({
  __esModule: true,
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

/**
 * Το ελάχιστο περιβάλλον της φόρμας: **αληθινή** κατάσταση + το αληθινό `resetForm`.
 *
 * Το `resetForm` γράφει `initialFormData`, όπως το `useContactFormState`. Αν ο σπόρος έμπαινε
 * πριν από αυτό, θα εξαφανιζόταν — και ακριβώς αυτό ελέγχεται.
 */
const NOOP_PHOTOS = jest.fn();

/**
 * @param unstableDeps αναπαράγει καλούντα που δίνει **νέο** `handleMultiplePhotosChange` σε κάθε
 *   απόδοση — δηλαδή ξαναεκτελεί το effect συνεχώς. Δεν είναι εξεζητημένο: είναι το κλασικό
 *   λάθος του `useCallback` που ξεχάστηκε, και ο μόνος τρόπος να ελεγχθεί ο δεύτερος φύλακας.
 */
function useHarness(
  prefill?: Partial<ContactFormData>,
  isModalOpen = true,
  unstableDeps = false,
) {
  const [formData, setFormData] = useState<ContactFormData>(initialFormData);
  const resetForm = useCallback(() => setFormData(initialFormData), []);
  useContactDataLoader({
    isModalOpen,
    setFormData,
    handleMultiplePhotosChange: unstableDeps ? () => {} : NOOP_PHOTOS,
    resetForm,
    prefill,
  });
  return { formData, setFormData };
}

const SEED: Partial<ContactFormData> = {
  firstName: 'ΙΩΑΝΝΗΣ',
  lastName: 'ΝΙΚΟΛΑΟΥ',
  city: 'ΝΕΟΧΩΡΟΥΔΑ',
  emails: [{ email: 'info@nikolaou.com.gr', type: 'work', isPrimary: true }],
};

describe('🔴 ο σπόρος επιβιώνει του reset', () => {
  it('🔑 τα πεδία φτάνουν στη φόρμα — ΜΕΤΑ το reset, όχι πριν', () => {
    const { result } = renderHook(() => useHarness(SEED));

    expect(result.current.formData.firstName).toBe('ΙΩΑΝΝΗΣ');
    expect(result.current.formData.lastName).toBe('ΝΙΚΟΛΑΟΥ');
    expect(result.current.formData.city).toBe('ΝΕΟΧΩΡΟΥΔΑ');
    expect(result.current.formData.emails).toHaveLength(1);
  });

  it('🔴 ο έλεγχος έχει νόημα: ΧΩΡΙΣ σπόρο η φόρμα μένει κενή', () => {
    // Χωρίς αυτό, το προηγούμενο test θα περνούσε ακόμη κι αν η φόρμα γεννιόταν συμπληρωμένη.
    const { result } = renderHook(() => useHarness(undefined));
    expect(result.current.formData.firstName).toBe('');
    expect(result.current.formData.city).toBe('');
  });

  it('τα υπόλοιπα πεδία μένουν στις προεπιλογές — ο σπόρος είναι ΜΕΡΙΚΟΣ', () => {
    const { result } = renderHook(() => useHarness(SEED));
    expect(result.current.formData.vatNumber).toBe('');
    expect(result.current.formData.multiplePhotos).toEqual([]);
  });

  it('🔴 ο σπόρος ΔΕΝ ξαναγράφει ό,τι διόρθωσε ο άνθρωπος', () => {
    // Η φόρμα ξαναποδίδεται δεκάδες φορές όσο γράφει ο χρήστης. Αν ο σπόρος ξανάμπαινε σε κάθε
    // απόδοση, η διόρθωση του ονόματος — **ακριβώς αυτό που ζητά η προειδοποίηση σειράς** — θα
    // ήταν αδύνατη: κάθε πληκτρολόγηση θα επανερχόταν στην τιμή του σχεδίου.
    const { result, rerender } = renderHook(() => useHarness(SEED));

    act(() => {
      result.current.setFormData((prev) => ({ ...prev, firstName: 'ΙΩΑΝΝΑ' }));
    });
    rerender();

    expect(result.current.formData.firstName).toBe('ΙΩΑΝΝΑ');
  });

  it('🔑 ΚΛΕΙΣΤΗ φόρμα δεν σπέρνεται — ο σπόρος ανήκει στο άνοιγμα', () => {
    const { result } = renderHook(() => useHarness(SEED, false));
    expect(result.current.formData.firstName).toBe('');
  });
});

describe('🔴 ΑΣΤΑΘΗΣ σπόρος δεν γεννά βρόχο — μετρημένο, όχι υποθετικό', () => {
  it('🔑 νέο αντικείμενο σε ΚΑΘΕ απόδοση ⇒ η φόρμα ηρεμεί, δεν κρεμάει', () => {
    // 🔴 ΑΥΤΟ ΕΓΙΝΕ ΠΡΑΓΜΑΤΙΚΑ, 2026-08-05. Η πρώτη γραφή έβαζε το `prefill` στον πίνακα
    // εξαρτήσεων: το effect έγραφε **νέο** αντικείμενο κατάστασης ⇒ νέα απόδοση ⇒ νέο effect.
    // Το jest **κρέμασε** — «Maximum update depth exceeded», δύο φορές, χωρίς καν έξοδο.
    //
    // Το reset από μόνο του δεν είχε ποτέ βρόχο, επειδή γράφει τη **σταθερή** `initialFormData`
    // και ο React εγκαταλείπει. Ο σπόρος αφαιρεί ακριβώς αυτή τη διαφυγή — δηλαδή η προσθήκη
    // μετέτρεψε μια καλοήθη ασταθή εξάρτηση σε **κρέμασμα της εφαρμογής**.
    //
    // Το ενσωματωμένο αντικείμενο εδώ είναι ο **φυσικός** τρόπος που θα το γράψει ο επόμενος
    // καλών. Αν κάποια μέρα ξαναμπεί το `prefill` στις εξαρτήσεις, αυτό εδώ κρεμάει — που
    // είναι ασυγκρίτως καλύτερο από το να κρεμάσει η οθόνη του μηχανικού.
    const { result, rerender } = renderHook(() =>
      useHarness({ firstName: 'ΙΩΑΝΝΗΣ', lastName: 'ΝΙΚΟΛΑΟΥ' }),
    );

    expect(result.current.formData.firstName).toBe('ΙΩΑΝΝΗΣ');
    rerender();
    rerender();
    expect(result.current.formData.lastName).toBe('ΝΙΚΟΛΑΟΥ');
  });

  it('🔑 ΑΠΡΟΣΕΚΤΟΣ καλών (ασταθές callback) ⇒ η φόρμα ΗΡΕΜΕΙ, δεν κρεμάει', () => {
    // Ο δεύτερος φύλακας — «μία φορά ανά άνοιγμα» — απομονωμένος. Εδώ ξαναδημιουργείται το
    // `handleMultiplePhotosChange` σε κάθε απόδοση, οπότε το effect εκτελείται **πάντα**.
    // Χωρίς τον φύλακα: reset → σπόρος → **νέο** αντικείμενο κατάστασης → απόδοση → effect →
    // επ' άπειρον. Με τον φύλακα, μένει μόνο το reset, που γράφει τη **σταθερή**
    // `initialFormData` — ο React εγκαταλείπει και ο κύκλος κλείνει.
    //
    // ⚠️ **Τι ΔΕΝ ισχυρίζεται**: ο σπόρος **χάνεται** σε αυτή τη διάταξη, αλλά τον σβήνει το
    // `resetForm()` που έτρεχε σε κάθε εκτέλεση **και πριν το ADR-759**. Αυτή η προϋπάρχουσα
    // συμπεριφορά δεν αγγίχτηκε (έξω από τη Φ1)· κάθε πραγματικός καλών δίνει σταθερό
    // `useCallback`. Το μετρήσιμο εδώ είναι ένα και μόνο: **ότι τερματίζει**.
    const { result, rerender } = renderHook(() =>
      useHarness({ firstName: 'ΙΩΑΝΝΗΣ', lastName: 'ΝΙΚΟΛΑΟΥ' }, true, true),
    );

    rerender();
    rerender();
    expect(result.current.formData).toBeDefined();
  });
});
