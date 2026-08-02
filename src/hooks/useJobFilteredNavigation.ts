'use client';

/**
 * ADR-748 Φάση 3 — Η πλοήγηση **περασμένη από τα δύο φίλτρα**, μία φορά.
 *
 * ΤΑ ΔΥΟ ΦΙΛΤΡΑ ΕΙΝΑΙ ΔΙΑΔΟΧΙΚΑ ΚΑΙ ΑΝΕΞΑΡΤΗΤΑ (§14.5) — μην τα ενώσεις:
 *
 *   1. **ΔΙΚΑΙΩΜΑ** → `filterItemsByPermissions()` μέσα στο
 *      `smart-navigation-factory`. Υπάρχει και τρέχει από πριν· είναι ασφάλεια
 *      στο UI επίπεδο και **δεν το αγγίζουμε**.
 *   2. **ΕΝΕΡΓΗ ΔΟΥΛΕΙΑ** → `filterItemsByJob()`. Καθαρή ετικέτα ορατότητας.
 *
 * Ένα στοιχείο εμφανίζεται όταν *(α)* ανήκει στην ενεργή δουλειά **ΚΑΙ** *(β)*
 * ο έλεγχος δικαιωμάτων το έχει ήδη επιτρέψει. 🔒 Η δουλειά **ΠΟΤΕ** δεν
 * προσθέτει δικαίωμα — μόνο αφαιρεί θόρυβο (§5, Ε5.η).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ HOOK ΚΑΙ ΟΧΙ ΥΠΟΛΟΓΙΣΜΟΣ ΜΕΣΑ ΣΤΟ `AppSidebar`
 *
 * Τον **ίδιο** αριθμό «Χ κρυμμένα» χρειάζεται και ο διακόπτης στο header. Δύο
 * ανεξάρτητοι υπολογισμοί = δύο αριθμοί που θα αποκλίνουν την πρώτη φορά που θα
 * αλλάξει ο κανόνας — το κλασικό «δύο λίστες, μία αλήθεια» που όλο το ADR-748
 * κυνηγά. Ένας hook, δύο καταναλωτές, **ένα** μονοπάτι κώδικα.
 * ─────────────────────────────────────────────────────────────────────────────
 * ΦΑΣΗ 3.6 — ΤΑ ΤΡΙΑ ΕΠΙΠΕΔΑ ΤΟΥ ΔΕΙΚΤΗ (§14.7)
 *
 *   1. `hiddenCount`            — κλάδοι που λείπουν από την οθόνη· ο δείκτης
 *                                 της κεφαλίδας. **Η μονάδα δεν άλλαξε** (Ε14.ιβ).
 *   2. `reveal.hiddenSubItemCountByParent` — τα κλαδεμένα παιδιά **ΟΡΑΤΩΝ**
 *                                 γονέων, ανά δοχείο· ο δείκτης ζει **μέσα** στο
 *                                 ανοιγμένο δοχείο, εκεί που αφορά.
 *   3. `reveal.isRevealing`     — ο τρόπος «Αποκάλυψη»: τα δέντρα επιστρέφουν
 *                                 **αφιλτράριστα** και το `hiddenHrefs` λέει
 *                                 ποια να υποβαθμιστούν οπτικά.
 *
 * 🔑 **Ο αριθμός ΔΕΝ αλλάζει όταν αποκαλύπτεις** — και είναι σκόπιμο: ο δείκτης
 * απαντά «τι κρύβει η δουλειά», όχι «τι βλέπω τώρα». Το ίδιο κάνει το Revit: το
 * `Reveal Hidden Elements` δεν ξε-κρύβει τίποτα, το **δείχνει**.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-748-role-based-workspaces.md §14
 */

import { useCallback, useMemo } from 'react';
import {
  getMainMenuItems,
  getToolsMenuItems,
  getSettingsMenuItems,
} from '@/config/navigation';
import type { MenuItem } from '@/config/navigation';
import { filterItemsByJob, summarizeHidden } from '@/config/jobs-visibility';
import { useActiveJob } from '@/contexts/ActiveJobContext';
import { useEffectivePermissions } from '@/hooks/useEffectivePermissions';

/**
 * Ό,τι χρειάζεται η **οθόνη** για τα επίπεδα 2 και 3 — ένα αντικείμενο, ώστε να
 * ταξιδεύει ως **ένα** prop μέσα από το `SidebarMenuSection`.
 *
 * ⚠️ Σκόπιμα **δεν** είναι σημαία πάνω στα ίδια τα `MenuItem`: θα μόλυνε τον
 * κοινό τύπο της πλοήγησης με πεδίο που αφορά μόνο αυτόν τον τρόπο λειτουργίας.
 */
export interface JobRevealView {
  /** Επίπεδο 2 — «+7 κρυμμένα» μέσα στο δοχείο, με κλειδί το `href` του γονιού. */
  readonly hiddenSubItemCountByParent: ReadonlyMap<string, number>;
  /** Επίπεδο 3 — ποια `href` να δείχνονται υποβαθμισμένα κατά την αποκάλυψη. */
  readonly hiddenHrefs: ReadonlySet<string>;
  readonly isRevealing: boolean;
  readonly onReveal: () => void;
  readonly onStopRevealing: () => void;
}

export interface JobFilteredNavigation {
  readonly mainMenuItems: MenuItem[];
  readonly toolsMenuItems: MenuItem[];
  readonly settingsMenuItems: MenuItem[];
  /**
   * Α-3/Ε5.ε — πόσα στοιχεία έκρυψε **η ενεργή δουλειά** (όχι τα δικαιώματα:
   * όσα κόβει το permission δεν είναι «κρυμμένα», είναι **ανύπαρκτα** για τον
   * χρήστη και δεν επαναφέρονται με κλικ. Δύο διαφορετικά πράγματα — η ένωσή
   * τους σε έναν αριθμό θα υποσχόταν επαναφορά που δεν μπορεί να γίνει).
   */
  readonly hiddenCount: number;
  /**
   * Τα υπο-στοιχεία μέσα σε **ΟΡΑΤΟΥΣ** γονείς. **Ξεχωριστός** αριθμός επίτηδες:
   * αν προστίθετο στον παραπάνω, θα ξαναγεννιόταν το «22 αντί για 9» των 17:13.
   * Ζει μόνο στην **ανάλυση** του tooltip, ποτέ ως ο ίδιος ο δείκτης.
   */
  readonly hiddenSubItemCount: number;
  readonly reveal: JobRevealView;
}

export function useJobFilteredNavigation(): JobFilteredNavigation {
  const { permissions } = useEffectivePermissions();
  const { activeJob, isRevealingHidden, setRevealingHidden } = useActiveJob();

  const computed = useMemo(() => {
    const permissionList = [...permissions];
    const menus = {
      main: getMainMenuItems(permissionList),
      tools: getToolsMenuItems(permissionList),
      settings: getSettingsMenuItems(permissionList),
    };
    const results = {
      main: filterItemsByJob(menus.main, activeJob),
      tools: filterItemsByJob(menus.tools, activeJob),
      settings: filterItemsByJob(menus.settings, activeJob),
    };
    const summary = summarizeHidden([results.main, results.tools, results.settings]);
    return { menus, results, summary };
  }, [permissions, activeJob]);

  const onReveal = useCallback(() => setRevealingHidden(true), [setRevealingHidden]);
  const onStopRevealing = useCallback(() => setRevealingHidden(false), [setRevealingHidden]);

  return useMemo(() => {
    const { menus, results, summary } = computed;
    // Επίπεδο 3: στην «Αποκάλυψη» επιστρέφουν τα **αφιλτράριστα** δέντρα, ώστε
    // κάθε κρυμμένο στοιχείο να ξαναβρεθεί **στη θέση του** — όχι σε λίστα στο
    // τέλος. Η θέση είναι η μισή πληροφορία: «τι έλειπε **από πού**».
    const pick = (all: MenuItem[], result: { readonly visible: readonly MenuItem[] }): MenuItem[] =>
      isRevealingHidden ? [...all] : [...result.visible];

    return {
      mainMenuItems: pick(menus.main, results.main),
      toolsMenuItems: pick(menus.tools, results.tools),
      settingsMenuItems: pick(menus.settings, results.settings),
      hiddenCount: summary.hiddenCount,
      hiddenSubItemCount: summary.hiddenSubItemCount,
      reveal: {
        hiddenSubItemCountByParent: summary.hiddenSubItemCountByParent,
        hiddenHrefs: summary.hiddenHrefs,
        isRevealing: isRevealingHidden,
        onReveal,
        onStopRevealing,
      },
    };
  }, [computed, isRevealingHidden, onReveal, onStopRevealing]);
}
