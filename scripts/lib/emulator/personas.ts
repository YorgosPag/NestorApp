/**
 * ADR-798 Φάση 6 — **ΤΑ ΔΕΔΟΜΕΝΑ** των οκτώ ανθρώπων. Καμία εκτέλεση.
 *
 * 🔴 **ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΑ ΑΠΟ ΤΟΝ ΣΠΟΡΕΑ — ΤΟ ΕΔΕΙΞΕ Η ΠΡΩΤΗ ΑΓΚΥΡΑ.** Όσο ζούσαν
 * μέσα στο `emulator-seed-personas.ts`, κάθε `import` τους **εκτελούσε** τον
 * σπορέα: ο φρουρός του emulator έβγαινε `process.exit(1)` και ο jest ανέφερε
 * *«Jest worker encountered 4 child process exceptions»* — δηλαδή τα δεδομένα
 * ήταν **αδοκίμαστα** επειδή το άγγιγμά τους ήταν πράξη.
 *
 * 🔑 Ίδια τομή με το `lib/auth/role-catalogue.ts`: **κάτω τα δεδομένα** (καμία
 * εξάρτηση, καμία παρενέργεια), **πάνω οι πράξεις**.
 *
 * @module scripts/lib/emulator/personas
 * @see docs/centralized-systems/reference/adrs/ADR-798-person-professional-identity.md
 */

import type { SeedIdentity } from './identity';

export const COMPANY_ID = 'comp_alpha_emulator';
export const COMPANY_NAME = 'Άλφα Τεχνική (DEMO)';

/**
 * ⚠️ **Οι κωδικοί ISCO ΔΕΝ είναι διακοσμητικοί** — τους διαβάζει το
 * `ISCO_JOB_AFFINITY` (`config/isco-job-affinity.ts`) και **σπάει την ισοβαθμία**
 * της πρότασης δουλειάς. Γι' αυτό οι οκτώ καλύπτουν **τέσσερις** διαφορετικές
 * δουλειές: αν όλοι έδιναν την ίδια, το rig θα ήταν οκτώ αντίγραφα ενός σεναρίου.
 *
 * ⛔ **ΜΗΝ επινοήσεις κωδικό.** Κάθε τιμή εδώ υπάρχει στον χάρτη ή είναι πρόθεμά
 * του (`2142` ⇒ `214`). Άγνωστος κωδικός δεν σπάει τίποτα — απλώς **δεν κάνει
 * τίποτα**, και η προσωπικότητα γίνεται σιωπηλά ισοδύναμη με «χωρίς επάγγελμα».
 */
export const PERSONAS: readonly SeedIdentity[] = [
  // ── Ο ΠΟΛΙΤΗΣ — κανένα επάγγελμα, ιδιωτικός χώρος ─────────────────────────
  {
    email: 'ext.seeker@solo.local',
    displayName: 'Ελένη Ζητούσα',
    globalRole: 'external_user',
  },
  {
    email: 'ext.owner@solo.local',
    displayName: 'Κώστας Ιδιοκτήτης',
    globalRole: 'external_user',
  },

  // ── Ο ΑΥΤΟΝΟΜΟΣ ΕΠΑΓΓΕΛΜΑΤΙΑΣ — επάγγελμα ΧΩΡΙΣ οργανισμό ─────────────────
  {
    email: 'ext.architect@solo.local',
    displayName: 'Μαρία Αρχιτεκτονίδου',
    globalRole: 'external_user',
    occupation: { profession: 'Αρχιτέκτονας', escoLabel: 'Αρχιτέκτονας', iscoCode: '2161' },
  },
  {
    email: 'ext.lawyer@solo.local',
    displayName: 'Νίκος Δικηγόρου',
    globalRole: 'external_user',
    occupation: { profession: 'Δικηγόρος', escoLabel: 'Δικηγόρος', iscoCode: '2611' },
  },

  // ── Ο ΕΠΑΓΓΕΛΜΑΤΙΑΣ ΣΕ ΟΡΓΑΝΙΣΜΟ ─────────────────────────────────────────
  {
    email: 'int.architect@alpha.local',
    displayName: 'Άννα Αρχιτεκτονίδη',
    companyId: COMPANY_ID,
    globalRole: 'internal_user',
    occupation: { profession: 'Αρχιτέκτονας', escoLabel: 'Αρχιτέκτονας', iscoCode: '2161' },
  },
  {
    email: 'int.surveyor@alpha.local',
    displayName: 'Πέτρος Τοπογράφου',
    companyId: COMPANY_ID,
    globalRole: 'internal_user',
    occupation: { profession: 'Τοπογράφος Μηχανικός', escoLabel: 'Τοπογράφος', iscoCode: '2165' },
  },
  {
    email: 'int.accountant@alpha.local',
    displayName: 'Σοφία Λογιστού',
    companyId: COMPANY_ID,
    globalRole: 'internal_user',
    occupation: { profession: 'Λογιστής', escoLabel: 'Λογιστής', iscoCode: '241' },
  },
  {
    email: 'admin.civil@alpha.local',
    displayName: 'Δημήτρης Πολιτικός',
    companyId: COMPANY_ID,
    globalRole: 'company_admin',
    occupation: { profession: 'Πολιτικός Μηχανικός', escoLabel: 'Πολιτικός μηχανικός', iscoCode: '2142' },
  },
] as const;
