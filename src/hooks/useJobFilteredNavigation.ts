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
import {
  filterItemsByCapability,
  type OrganizationCapabilityView,
} from '@/config/navigation-capability';
import { computeJobSuggestion, type JobSuggestionOutcome } from '@/config/job-suggestion';
import { resolveJobAffinity } from '@/config/isco-job-affinity';
import { useActiveJob } from '@/contexts/ActiveJobContext';
import { useDeclaredOccupation } from '@/hooks/useDeclaredOccupation';
import { useEffectivePermissions } from '@/hooks/useEffectivePermissions';
import { useMyOrganizationCapabilities } from '@/services/realtime/hooks/useOrganizationCapability';

/** Τα τρία δέντρα του sidebar, περασμένα **μόνο** από το φίλτρο δικαιωμάτων. */
export interface JobMenus {
  readonly main: MenuItem[];
  readonly tools: MenuItem[];
  readonly settings: MenuItem[];
}

/**
 * 🔒 **ΤΟ ΜΟΝΑΔΙΚΟ ΣΗΜΕΙΟ ΠΟΥ ΧΤΙΖΕΙ ΤΑ ΤΡΙΑ ΔΕΝΤΡΑ.**
 *
 * Δύο καταναλωτές: ο φιλτραρισμένος hook (τι βλέπεις **τώρα**) και η πρόταση
 * της Φάσης 3.5α (τι θα έβλεπες **αν** δεχτείς). Αν καθένας τα έχτιζε μόνος
 * του, ο αριθμός της πρότασης θα μπορούσε να μετρά **άλλο δέντρο** από αυτό
 * που βάφει η οθόνη — η ίδια οικογένεια ελαττώματος με το «22 αντί για 9».
 */
export function buildJobMenus(
  permissions: readonly string[],
  capabilities: OrganizationCapabilityView,
): JobMenus {
  const permissionList = [...permissions];
  // 🔴 **ΤΟ ΤΡΙΤΟ ΦΙΛΤΡΟ ΕΦΑΡΜΟΖΕΤΑΙ ΕΔΩ, ΚΑΙ ΤΟ ΣΗΜΕΙΟ ΕΙΝΑΙ ΟΡΘΟΤΗΤΑ** (ADR-824 Φάση 4).
  //
  // Το «Αποκάλυψη κρυμμένων» παρακάτω επιστρέφει τα **αφιλτράριστα** δέντρα
  // (`pick(menus.main, …)`). Αν η ικανότητα κρινόταν στη βαθμίδα της **δουλειάς**, ένα
  // κλικ θα **ξαναπρόσφερε** στον αρχιτέκτονα τη μεσιτεία — δουλειά που ο Ν. 4072/2012
  // επιτρέπει μόνο σε εγγεγραμμένα μεσιτικά γραφεία. Κόβοντας **πριν** χτιστούν τα
  // δέντρα, το στοιχείο δεν είναι «κρυμμένο» αλλά **ανύπαρκτο** — η ίδια διάκριση που
  // το `hiddenCount` τεκμηριώνει ήδη για τα δικαιώματα, και ο λόγος που δεν
  // προσμετράται: δείκτης «+1 κρυμμένο» που δεν αποκαλύπτεται ποτέ είναι υπόσχεση που
  // η οθόνη δεν μπορεί να τηρήσει.
  //
  // ⚠️ **Και οι ΔΥΟ καταναλωτές περνούν από εδώ** — η οθόνη και η **πρόταση** δουλειάς.
  // Αν η πρόταση μετρούσε δέντρο με τη γραμμή μέσα, ο αριθμός της θα απέκλινε από
  // αυτόν που βάφει η οθόνη: το «22 αντί για 9» ξαναγεννημένο. Γι' αυτό η παράμετρος
  // είναι **υποχρεωτική** και όχι προαιρετική με προεπιλογή.
  return {
    main: filterItemsByCapability(getMainMenuItems(permissionList), capabilities),
    tools: filterItemsByCapability(getToolsMenuItems(permissionList), capabilities),
    settings: filterItemsByCapability(getSettingsMenuItems(permissionList), capabilities),
  };
}

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
  // ⚠️ **Το `settled` ΔΕΝ διαβάζεται εδώ, και είναι σκόπιμο.** Όσο δεν ξέρουμε, η όψη
  // λέει ήδη «μην προσφέρεις» — που είναι **ακριβώς** η σωστή απάντηση για ένα μενού:
  // μια γραμμή που εμφανίζεται αργοπορημένα είναι ενόχληση, μια γραμμή που δεν έπρεπε
  // να εμφανιστεί είναι **παράβαση**. Το `settled` αφορά μόνο όποιον **μιλά**.
  const { view: capabilities } = useMyOrganizationCapabilities();

  const computed = useMemo(() => {
    const menus = buildJobMenus(permissions, capabilities);
    const results = {
      main: filterItemsByJob(menus.main, activeJob),
      tools: filterItemsByJob(menus.tools, activeJob),
      settings: filterItemsByJob(menus.settings, activeJob),
    };
    const summary = summarizeHidden([results.main, results.tools, results.settings]);
    return { menus, results, summary };
  }, [permissions, activeJob, capabilities]);

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

/**
 * ADR-748 Φάση 3.5α — η **πρόταση** δουλειάς, ή `null` όταν δεν υπάρχει λόγος.
 *
 * ΓΙΑΤΙ ΣΤΟ ΙΔΙΟ ΑΡΧΕΙΟ με τον φιλτραρισμένο hook: μοιράζονται το
 * `buildJobMenus` και απαντούν **δύο όψεις της ίδιας ερώτησης** — «τι βλέπω
 * τώρα» και «τι θα έβλεπα αν δεχτώ». Χωριστό αρχείο θα ήταν δεύτερο σπίτι για
 * την ίδια γνώση, με δική του ευκαιρία να αποκλίνει.
 *
 * ⚠️ Η **απόρριψη** έρχεται απ' έξω ως `dismissed` και δεν διαβάζεται εδώ: η
 * αποθήκευση είναι πλευρική ενέργεια του component, ενώ αυτός ο hook μένει
 * καθαρός υπολογισμός πάνω σε ζωντανά δεδομένα (Ε5.α).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ADR-798 Φάση 3 — ΕΔΩ ΕΝΩΝΟΝΤΑΙ ΤΑ ΔΥΟ ΕΡΩΤΗΜΑΤΑ, ΚΑΙ **ΜΟΝΟ** ΕΔΩ
 *
 *   `useDeclaredOccupation()` → *«τι δήλωσε ο άνθρωπος»* (μηδέν I/O)
 *   `resolveJobAffinity()`    → *«τι δουλειά υποδεικνύει αυτό»* (καθαρός πίνακας)
 *
 * Χωριστά επίτηδες: ο χαρακτηρισμός της δήλωσης δεν ξέρει τίποτα για δουλειές,
 * και ο πίνακας συγγένειας δεν ξέρει τίποτα για χρήστες. Καθένας δοκιμάζεται
 * μόνος του· η ένωση είναι **τρεις γραμμές** και ζει στον καταναλωτή.
 *
 * 🔒 Το αποτέλεσμα ταξιδεύει ως `tiebreak` — **σπάει ισοβαθμία, δεν διευρύνει
 * σύνολο**. Το `computeJobSuggestion` κρατά ακέραιο τον έλεγχο `granted`, οπότε
 * επάγγελμα που δείχνει σε δουλειά χωρίς **μετρημένο** δικαίωμα ⇒ **σιωπή**.
 *
 * ⚠️ Το `iscoCode` **ΠΡΕΠΕΙ** να είναι στις εξαρτήσεις του `useMemo`: χωρίς
 * αυτό η τιμή παγώνει στην πρώτη απόδοση — τότε το προφίλ **δεν έχει φορτώσει
 * ακόμη** — και το επάγγελμα φαίνεται «μη δηλωμένο» **για πάντα**. Σφάλμα που
 * **καμία πύλη δεν πιάνει** (μάθημα Φάσης 2). Είναι `string | null`, δηλαδή
 * πρωτογενής τιμή: σταθερή εξάρτηση, χωρίς την αστάθεια του αντικειμένου.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function useJobSuggestion(dismissed: boolean): JobSuggestionOutcome | null {
  const access = useEffectivePermissions();
  const { activeJob } = useActiveJob();
  const { iscoCode } = useDeclaredOccupation();
  // ⚠️ **Η ΙΔΙΑ όψη ικανοτήτων με την οθόνη.** Η πρόταση απαντά «τι θα έβλεπες **αν**
  // δεχτείς» — αν μετρούσε δέντρο που περιέχει γραμμή την οποία η οθόνη δεν βάφει
  // ποτέ, θα υποσχόταν όφελος που δεν υπάρχει.
  const { view: capabilities } = useMyOrganizationCapabilities();

  return useMemo(() => {
    const menus = buildJobMenus(access.permissions, capabilities);
    return computeJobSuggestion({
      access,
      activeJob,
      dismissed,
      tiebreak: resolveJobAffinity(iscoCode),
      menus: [menus.main, menus.tools, menus.settings],
    });
  }, [access, activeJob, dismissed, iscoCode, capabilities]);
}
