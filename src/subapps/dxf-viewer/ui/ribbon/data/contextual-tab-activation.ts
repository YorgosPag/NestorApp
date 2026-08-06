/**
 * ADR-345 §5.4 / **ADR-739 §52** — **ΠΟΙΑ ΚΑΡΤΕΛΑ ΓΙΝΕΤΑΙ ΕΝΕΡΓΗ** όταν αλλάζει το σύνολο των
 * ορατών contextual καρτελών. Καθαρή συνάρτηση· μηδέν React, μηδέν store.
 *
 * ## Γιατί εξήχθη από το effect του `RibbonRoot`
 * Ο κανόνας απέκτησε **τέταρτο** κλάδο (§52) και έγινε η μόνη απάντηση στο «γιατί δεν άνοιξε
 * η καρτέλα μου;» — ερώτημα που εμφανίστηκε **δύο** φορές στην ιστορία του αρχείου
 * (ADR-408 Φ7 «Edit Circuit», ADR-739 §52 «Μορφοποίηση»). Μέσα σε `useEffect` ελέγχεται μόνο
 * με μονταρισμένη ολόκληρη την κορδέλα — δηλαδή με ~90 widgets και τις εξαρτήσεις τους. Εδώ
 * ελέγχεται με τέσσερις γραμμές δεδομένων.
 *
 * ## Οι τέσσερις καταστάσεις — ο κατάλογος ΕΙΝΑΙ η προδιαγραφή
 * ```
 *   1. το σύνολο ΔΕΝ άλλαξε                       ⇒ null  (σεβασμός χειροκίνητης επιλογής)
 *   2. εμφανίστηκε ΝΕΑ που το δηλώνει ρητά        ⇒ αυτή  (§52: το σύνολο ΜΕΓΑΛΩΣΕ)
 *   3. η ενεργή δεν είναι πια ορατή contextual    ⇒ η πρώτη ορατή
 *   4. άδειασαν όλα ΚΑΙ η ενεργή δεν υπάρχει πια  ⇒ 'home'
 * ```
 * Η σειρά **είναι** ο μηχανισμός: ο (2) πρέπει να προηγηθεί του (3), αλλιώς μια ήδη-ενεργή
 * contextual ικανοποιεί τον (3) και ο (2) δεν φτάνει ποτέ — ακριβώς το ελάττωμα του §52.
 *
 * @module subapps/dxf-viewer/ui/ribbon/data/contextual-tab-activation
 * @see ui/ribbon/components/RibbonRoot.tsx — ο μοναδικός καταναλωτής
 */

import type { RibbonTab } from '../types/ribbon-types';

/** Η καρτέλα στην οποία επιστρέφει η κορδέλα όταν αδειάζουν τα contextual. */
export const RIBBON_HOME_TAB_ID = 'home';

export interface ContextualTabActivationInput {
  /** Το κλειδί του **προηγούμενου** ορατού συνόλου ({@link contextualTabsKey}). */
  readonly previousKey: string;
  readonly visibleContextualTabs: readonly RibbonTab[];
  readonly activeTabId: string;
  /** Οι **μόνιμες** καρτέλες — για να ξέρουμε αν η ενεργή επιβιώνει χωρίς contextual. */
  readonly persistentTabIds: readonly string[];
}

/**
 * Η ταυτότητα ενός ορατού συνόλου, ως συμβολοσειρά.
 *
 * Ζει εδώ και όχι στον καλούντα ώστε η **σύγκριση** και η **απόφαση** να μη μπορούν να
 * μιλήσουν διαφορετική γλώσσα: αν ο ένας ένωνε με `,` και ο άλλος με `|`, ο κανόνας «το
 * σύνολο δεν άλλαξε» θα ήταν πάντα ψευδής και η κορδέλα θα ακύρωνε κάθε χειροκίνητη επιλογή.
 */
export function contextualTabsKey(tabs: readonly RibbonTab[]): string {
  return tabs.map((tab) => tab.id).join(',');
}

/**
 * Ποια καρτέλα πρέπει να γίνει ενεργή· `null` όταν **δεν αλλάζει τίποτα**.
 *
 * `null` σημαίνει «μην αγγίξεις την ενεργή» και είναι η **συνηθισμένη** απάντηση: κάθε
 * μετακίνηση δρομέα μέσα σε πίνακα, κάθε αλλαγή τιμής, κάθε re-render περνά από εδώ.
 */
export function resolveContextualTabActivation(
  input: ContextualTabActivationInput,
): string | null {
  const { previousKey, visibleContextualTabs, activeTabId, persistentTabIds } = input;
  const key = contextualTabsKey(visibleContextualTabs);
  if (key === previousKey) return null;

  if (key === '') {
    // Από contextual σε τίποτα: επιστροφή στο «Αρχική» **μόνο** αν η ενεργή έπαψε να υπάρχει.
    // Ο χρήστης που είχε διαλέξει «Προβολή» δεν πετάγεται από εκεί επειδή αποεπέλεξε οντότητα.
    if (previousKey === '') return null;
    return persistentTabIds.includes(activeTabId) ? null : RIBBON_HOME_TAB_ID;
  }

  // 🔴 §52 — ΠΡΩΤΑ η ρητή δήλωση, και μόνο για ό,τι **μόλις** εμφανίστηκε.
  //
  // Ο έλεγχος «δεν ήταν ήδη ορατή» δεν είναι λεπτομέρεια: μια καρτέλα που δηλώνει
  // `autoActivateOnAppear` και ήταν ήδη εκεί δεν επιτρέπεται να ξανα-αρπάξει την εστίαση
  // επειδή εμφανίστηκε **άλλη** δίπλα της — αυτό θα ακύρωνε τη χειροκίνητη επιλογή σιωπηλά.
  const previousIds = new Set(previousKey === '' ? [] : previousKey.split(','));
  const appeared = visibleContextualTabs.find(
    (tab) => tab.autoActivateOnAppear === true && !previousIds.has(tab.id),
  );
  if (appeared) return appeared.id;

  // Ο κοινός κανόνας: ακολούθησε την επιλογή, εκτός αν η ενεργή είναι ήδη ένα από τα ορατά
  // contextual (persistent→contextual ΚΑΙ contextual→άλλο contextual, ADR-408 Φ7).
  const first = visibleContextualTabs[0];
  if (first && !visibleContextualTabs.some((tab) => tab.id === activeTabId)) return first.id;
  return null;
}
