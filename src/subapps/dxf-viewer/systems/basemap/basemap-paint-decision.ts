/**
 * Η **ΜΙΑ** απόφαση «τι δείχνει το υπόβαθρο χάρτη, και επιτρέπεται να ζωγραφιστεί;».
 *
 * ## Γιατί εξήχθη — ήταν ήδη γραμμένη δύο φορές
 * Πριν από αυτό το αρχείο, το ίδιο κατηγόρημα ζούσε αυτούσιο σε **δύο** σημεία, σε δύο σειρές
 * όρων:
 *
 * ```ts
 * // useBasemapPainter.ts
 * if (!state.enabled || availability === 'unknown' || state.opacity <= 0) return null;
 * // BasemapGroundLayer.ts
 * if (!state.enabled || state.opacity <= 0 || getBasemapAvailability() === 'unknown') { … }
 * ```
 *
 * Δύο αντίγραφα δεν είναι «λίγη επανάληψη»: είναι **δύο αλήθειες** για το ίδιο ερώτημα, που θα
 * αποκλίνουν την πρώτη φορά που κάποιος προσθέσει όρο στο ένα — και η απόκλιση θα φαίνεται ως
 * «ο χάρτης εμφανίζεται στο 2Δ αλλά όχι στο 3Δ», δηλαδή ως σφάλμα απόδοσης, όχι ως σφάλμα λογικής
 * (το σχήμα του ADR-749). Η απόδοση (attribution) θα ήταν το **τρίτο** αντίγραφο.
 *
 * ## 🔑 Δύο ερωτήματα, όχι ένα — και η ασυμμετρία είναι σκόπιμη
 *
 * | Συνάρτηση | Ερώτημα | Καταναλωτής |
 * |---|---|---|
 * | {@link resolveBasemapContent} | «υπάρχει χάρτης να δειχτεί;» | η **απόδοση** |
 * | {@link resolveBasemapPaint}   | «…και **επιτρέπεται** να ζωγραφιστεί;» | οι **ζωγράφοι** (2Δ + 3Δ) |
 *
 * Ο ζωγράφος ρωτά **ένα ερώτημα παραπάνω** από την απόδοση: αν υπάρχει επιφάνεια που αναλαμβάνει
 * τη μνεία του παρόχου (δες `basemap-attribution-surface`). Η ασυμμετρία **δεν** είναι στιλιστική
 * — είναι το μόνο που κρατά το σύστημα χωρίς κύκλο: αν η απόδοση ρωτούσε κι εκείνη «υπάρχει
 * επιφάνεια;», τότε δεν θα ζωγραφιζόταν ποτέ (δεν υπάρχει επιφάνεια ⇒ δεν δείχνω μνεία ⇒ δεν
 * υπάρχει επιφάνεια), και ο χάρτης θα ήταν μονίμως σβηστός χωρίς κανένα μήνυμα.
 *
 * Το αναλλοίωτο που προκύπτει: **ζωγραφισμένος χάρτης ⇒ ορατή απόδοση**, γιατί η επιφάνεια που
 * επιτρέπει τη ζωγραφική είναι η ίδια που δείχνει τη μνεία, και δείχνει τη μνεία **ακριβώς** όταν
 * η `resolveBasemapContent` λέει ναι.
 *
 * ⚠️ **ΜΗΝ καλέσεις τη `resolveBasemapContent` από ζωγράφο.** Θα έγραφε την ερώτηση χωρίς τον όρο
 * της άδειας, δηλαδή θα επανέφερε ακριβώς τη βλάβη που το μητρώο υπάρχει για να κλείσει. Άγκυρα:
 * `Α6` — διαβάζει τα δύο αρχεία των ζωγράφων και απαιτεί να μην την εισάγουν.
 */

import { getBasemapAvailability, type BasemapAvailability } from './basemap-availability';
import { getBasemapState } from './basemap-store';
import { hasBasemapAttributionSurface } from './basemap-attribution-surface';
import { resolveBasemapSource, type BasemapSource } from './basemap-source';

/**
 * Ο λόγος που δεν δείχνουμε χάρτη. Ονομασμένος και όχι `false`, γιατί οι λόγοι έχουν
 * **διαφορετική θεραπεία**: το «σβηστό» το ανάβει ο χρήστης, το «άγνωστη θέση» θέλει
 * γεωαναφορά, και το «χωρίς απόδοση» είναι **σφάλμα προγραμματιστή** — καμία ενέργεια χρήστη
 * δεν το διορθώνει.
 */
export type BasemapRefusal =
  /** Ο χρήστης δεν έχει ανάψει το υπόβαθρο. */
  | 'disabled'
  /** Αδιαφάνεια μηδέν — ζωγραφική χωρίς κανένα αποτέλεσμα στην οθόνη. */
  | 'transparent'
  /** Καμία πληροφορία θέσης· το ΕΓΣΑ'87 (0,0) πέφτει στον Ατλαντικό (δες `basemap-availability`). */
  | 'unlocated'
  /** Κανένα σημείο της οθόνης δεν αναλαμβάνει την απόδοση του παρόχου — δες την επικεφαλίδα. */
  | 'unattributed';

/** Ό,τι χρειάζεται όποιος **δείχνει** χάρτη — είτε τον ζωγραφίζει είτε τον αποδίδει. */
export interface BasemapContent {
  readonly source: BasemapSource;
  readonly opacity: number;
  /** Ποτέ `'unknown'`: εκείνο είναι άρνηση, όχι περιεχόμενο. */
  readonly availability: Exclude<BasemapAvailability, 'unknown'>;
}

export type BasemapDecision =
  | { readonly show: true; readonly content: BasemapContent }
  | { readonly show: false; readonly refusal: BasemapRefusal };

/**
 * «Υπάρχει χάρτης να δειχτεί;» — **χωρίς** τον όρο της άδειας.
 *
 * Καταναλωτής: **μόνο** η επιφάνεια απόδοσης. Δες την ασυμμετρία στην επικεφαλίδα.
 */
export function resolveBasemapContent(): BasemapDecision {
  const state = getBasemapState();
  if (!state.enabled) return { show: false, refusal: 'disabled' };
  if (state.opacity <= 0) return { show: false, refusal: 'transparent' };

  const availability = getBasemapAvailability();
  if (availability === 'unknown') return { show: false, refusal: 'unlocated' };

  return {
    show: true,
    content: { source: resolveBasemapSource(state.sourceId), opacity: state.opacity, availability },
  };
}

/**
 * «Υπάρχει χάρτης **και** επιτρέπεται να ζωγραφιστεί;»
 *
 * Καταναλωτές: ο painter της ζώνης Α (2Δ) και το `BasemapGroundLayer` (3Δ) — και **μόνο** αυτοί.
 * Η σειρά είναι συμβόλαιο: ο όρος της άδειας ελέγχεται **τελευταίος**, ώστε ένα σβηστό υπόβαθρο
 * να μην αναφέρεται ποτέ ως `'unattributed'` — θα ήταν αληθές και εντελώς παραπλανητικό.
 */
export function resolveBasemapPaint(): BasemapDecision {
  const decision = resolveBasemapContent();
  if (!decision.show) return decision;
  if (!hasBasemapAttributionSurface()) return { show: false, refusal: 'unattributed' };
  return decision;
}
