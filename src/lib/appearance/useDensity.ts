'use client';

/**
 * =============================================================================
 * Η ΠΡΟΤΙΜΗΣΗ ΠΥΚΝΟΤΗΤΑΣ ΣΤΗΝ REACT — **ΜΙΑ** ΠΡΑΞΗ, ΤΡΕΙΣ ΑΠΟΔΕΚΤΕΣ
 * =============================================================================
 *
 * Οθόνη (`<html data-density>`) · αποθήκευση (`localStorage`) · **οι άλλες
 * καρτέλες**. Γραμμένα από κάθε καλούντα ξεχωριστά, ο τρίτος επιλογέας θα
 * ξεχνούσε άλλο βήμα από τον δεύτερο — το ελάττωμα που το **ADR-777 §8.29**
 * μέτρησε στη γλώσσα. Αυτό το hook είναι ο ιδιοκτήτης.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ `useSyncExternalStore` ΚΑΙ ΟΧΙ ΤΟ ΜΟΤΙΒΟ `mounted`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `mounted` («μην αποδώσεις τίποτα μέχρι το πρώτο `useEffect`») είναι το
 * μοτίβο που το **ίδιο** το README του `next-themes` προτείνει — αλλά **για το
 * component που ΔΕΙΧΝΕΙ** την τιμή, όχι για κάθε ανάγνωση. Και έχει μετρημένο
 * κόστος σε αυτό το αποθετήριο: εφαρμοσμένο στον **provider** κρατά ολόκληρη την
 * εφαρμογή `visibility: hidden` για **676-1125 ms** (μετρημένο σε `/`, `/login`,
 * `/terms`).
 *
 * Το `useSyncExternalStore` απαντά το ίδιο ερώτημα **χωρίς** να κρύψει τίποτα:
 * η React χρησιμοποιεί το `getServerSnapshot` στο πέρασμα ενυδάτωσης και μετά
 * συγχρονίζεται με τον πραγματικό κόσμο. Καμία ασυμφωνία, κανένα κρύψιμο.
 *
 * 🏆 **ΚΑΙ ΔΙΝΕΙ ΚΑΤΙ ΠΟΥ ΤΟ `mounted` ΔΕΝ ΜΠΟΡΕΙ: συγχρονισμό καρτελών.** Το
 * `storage` event πυροδοτεί **μόνο στις ΑΛΛΕΣ** καρτέλες — άρα η αλλαγή σε μία
 * καρτέλα φτάνει στις υπόλοιπες χωρίς επαναφόρτωση.
 *
 * @module lib/appearance/useDensity
 * @see ADR-811
 */

import { useCallback, useSyncExternalStore } from 'react';

import {
  DEFAULT_DENSITY,
  DENSITY_ATTRIBUTE,
  DENSITY_ROLES,
  DENSITY_STORAGE_KEY,
  type DensityRole,
} from '@/styles/design-tokens/generated/appearance';

import { applyDensity } from './apply-density';

/**
 * Το γεγονός που ειδοποιεί την **ίδια** καρτέλα.
 *
 * ⚠️ Χρειάζεται ξεχωριστά από το `storage`: η προδιαγραφή του HTML ορίζει ότι το
 * `storage` event **ΔΕΝ** πυροδοτεί στο έγγραφο που έκανε την εγγραφή. Χωρίς
 * αυτό, ο επιλογέας θα άλλαζε την οθόνη αλλά **δεν θα ενημέρωνε τον εαυτό του**,
 * και το Radix Select θα έδειχνε την **παλιά** τιμή — προτίμηση που εφαρμόζεται
 * και δεν φαίνεται εφαρμοσμένη.
 */
const DENSITY_CHANGE_EVENT = 'nestor:density-change';

function isDensityRole(value: string | null): value is DensityRole {
  return value !== null && (DENSITY_ROLES as readonly string[]).indexOf(value) !== -1;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(DENSITY_CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(DENSITY_CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

/**
 * Η **οθόνη** είναι η αλήθεια, όχι το `localStorage`.
 *
 * ⚠️ Σκόπιμο: το attribute είναι ό,τι όντως βάφει· διαβάζοντας το αποθηκευτικό
 * μέσο θα μπορούσαμε να επιστρέψουμε τιμή που **δεν** εφαρμόστηκε (π.χ. ρόλος
 * που καταργήθηκε και το `applyDensity` σωστά αγνόησε). Ένα hook που λέει
 * «compact» ενώ η οθόνη είναι «comfortable» είναι χειρότερο από άγνοια.
 */
function getSnapshot(): DensityRole {
  const attr = document.documentElement.getAttribute(DENSITY_ATTRIBUTE);
  return isDensityRole(attr) ? attr : DEFAULT_DENSITY;
}

function getServerSnapshot(): DensityRole {
  return DEFAULT_DENSITY;
}

export interface UseDensityResult {
  /** Ο ρόλος που **βάφει τώρα**. */
  readonly density: DensityRole;
  /** Όλοι οι διαθέσιμοι ρόλοι, στη σειρά δήλωσης του `design-tokens.json`. */
  readonly densities: readonly DensityRole[];
  /** Άλλαξε τον ρόλο: οθόνη → αποθήκευση → οι άλλες καρτέλες. */
  readonly setDensity: (next: DensityRole) => void;
}

export function useDensity(): UseDensityResult {
  const density = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setDensity = useCallback((next: DensityRole) => {
    if (!isDensityRole(next)) return;
    try {
      window.localStorage.setItem(DENSITY_STORAGE_KEY, next);
    } catch {
      // Ιδιωτική περιήγηση: η οθόνη αλλάζει ΟΠΩΣ ΚΑΙ ΝΑ ΕΧΕΙ. Μια προτίμηση
      // εμφάνισης δεν είναι συναλλαγή — το ίδιο σκεπτικό με το `useLanguagePreference`.
    }
    // ⚠️ Η ΙΔΙΑ συνάρτηση με το inline script — ποτέ δεύτερη υλοποίηση.
    applyDensity(DENSITY_STORAGE_KEY, DENSITY_ATTRIBUTE, DENSITY_ROLES, DEFAULT_DENSITY);
    window.dispatchEvent(new Event(DENSITY_CHANGE_EVENT));
  }, []);

  return { density, densities: DENSITY_ROLES, setDensity };
}
