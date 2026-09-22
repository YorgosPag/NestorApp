/**
 * =============================================================================
 * ΤΟ ΟΝΟΜΑ ΤΟΥ ΡΟΛΟΥ, ΕΚΤΟΣ REACT — ΑΠΟ ΤΑ ΙΔΙΑ LOCALE ΜΕ ΤΗΝ ΟΘΟΝΗ (ADR-853 §17)
 * =============================================================================
 *
 * 🔴 **ΤΟ ΕΥΡΗΜΑ (Ε-Β, μετρημένο 2026-09-22): ΤΡΙΑ ΟΝΟΜΑΤΑ ΓΙΑ ΤΟΝ ΙΔΙΟ ΡΟΛΟ**, στην
 * **ίδια** ροή — «Εσωτερικός» στη διαχείριση ρόλων · «Εσωτερικός συνεργάτης» στη σελίδα
 * πρόσκλησης · «Εσωτερικός χρήστης» στο email που οδηγεί σε εκείνη τη σελίδα. Ο άνθρωπος
 * διαβάζει τρεις φορές τι θα γίνει, και μαθαίνει τρία πράγματα.
 *
 * ⚠️ **Και οι τρεις λόγοι ήταν σωστοί**: το `admin` namespace δεν φορτώνεται σε δημόσια
 * σελίδα, και το email δεν έχει React runtime για να ρωτήσει το i18next. Λάθος ήταν η
 * **θεραπεία**: αντί να μετακομίσει το λεξιλόγιο εκεί που το φτάνουν όλοι, αντιγράφηκε.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΟ ΙΔΙΟ ΙΔΙΩΜΑ ΜΕ ΤΟ `project-status-text.ts` (ADR-812)
 * ─────────────────────────────────────────────────────────────────────────────
 * Ξεχωριστό αρχείο, **όχι** μέσα στο `lib/auth/types.ts`: εκείνο είναι leaf που το εισάγει
 * μισή εφαρμογή — ένα `import … from 'locales/el/common.json'` εκεί θα έβαζε **δύο locale
 * αρχεία στο bundle κάθε καταναλωτή** του κλειστού συνόλου των ρόλων.
 *
 * ⚠️ **ΜΗΝ γράψεις εδώ σκληρό κείμενο** (N.11). Οι λέξεις ζουν στα
 * `locales/<γλώσσα>/common.json → globalRoles`, και **εκεί** αλλάζουν — μία φορά, για
 * οθόνη, δημόσια σελίδα και email μαζί.
 *
 * @module constants/global-role-text
 * @see docs/centralized-systems/reference/adrs/ADR-853-workspace-invitations.md §17
 */

import elCommon from '@/i18n/locales/el/common.json';
import enCommon from '@/i18n/locales/en/common.json';
import { GLOBAL_ROLES, type GlobalRole } from '@/lib/auth/types';
import type { HumanLanguage } from '@/i18n/languages';

/** Το κλειδί του καταλόγου, **γραμμένο μία φορά** — το ίδιο που ζητά η οθόνη με `common:`. */
export const GLOBAL_ROLE_KEY_PREFIX = 'common:globalRoles.' as const;

const CATALOGUE: Readonly<Record<HumanLanguage, Readonly<Record<string, string>>>> = {
  el: elCommon.globalRoles,
  en: enCommon.globalRoles,
};

/**
 * **Ο ρόλος → λέξη, στη γλώσσα του ανθρώπου.**
 *
 * ⚠️ Επιστρέφει `null` όταν η λέξη λείπει — **ποτέ** το ωμό `internal_user` ως «όνομα»:
 * ο καλών ξέρει τι να δείξει αντ' αυτού, αυτό το αρχείο όχι. Σήμερα το `null` είναι
 * αδύνατο (το φυλά το {@link everyGlobalRoleHasName}), και μένει επειδή **ένας πέμπτος
 * ρόλος** θα το κάνει εφικτό πριν προλάβει κανείς να προσθέσει λέξη.
 */
export function globalRoleName(language: HumanLanguage, role: GlobalRole): string | null {
  const word = CATALOGUE[language]?.[role];
  return typeof word === 'string' && word.length > 0 ? word : null;
}

/**
 * **Έχει κάθε ρόλος λέξη, σε κάθε γλώσσα;** — άγκυρα που **εκτελείται** (N.17: στη ροή του
 * πράκτορα ο μεταγλωττιστής δεν είναι φρουρός που τρέχει, και τα JSON δεν έχουν τύπο).
 */
export function everyGlobalRoleHasName(): boolean {
  return (Object.keys(CATALOGUE) as HumanLanguage[]).every((language) =>
    GLOBAL_ROLES.every((role) => globalRoleName(language, role) !== null),
  );
}
