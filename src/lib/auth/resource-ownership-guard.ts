/**
 * «Ανήκει αυτός ο πόρος;» — **η απόφαση, μία φορά για όλους τους πόρους**
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ (ADR-742 §7octies · N.0.2 · N.18)
 * ─────────────────────────────────────────────────────────────────────────────
 * Μέχρι τις 2026-08-01 η **ίδια** διαδικασία απόφασης ήταν γραμμένη τρεις φορές
 * — `project-ownership.ts` (Ομάδα 3), `contact-ownership.ts` και
 * `building-ownership.ts` (Ομάδα 4) — με πανομοιότυπη λογική και μόνο τα
 * ονόματα αλλαγμένα:
 *
 * ```
 * bypass ρόλος → (αν ξένο) κατάγραψε · πέρασε ως 'cross-tenant-bypass'
 * ανήκει       → 'owned'
 * αλλιώς       → κατάγραψε παραβίαση · 'denied'
 * ```
 *
 * 🔴 **Το `jscpd` τα βρήκε ΚΑΘΑΡΑ** — και είχε δίκιο με τα δικά του κριτήρια:
 * είναι token-based, και `projectData`/`contactData`/`buildingData` είναι
 * **διαφορετικά tokens**. Ακριβώς το τυφλό σημείο που το ADR-584 αποδίδει στο
 * `ssot:discover` (name-based) — εδώ εμφανίζεται **ανάποδα**: αντίγραφο που
 * κρύβεται πίσω από συνεπή μετονομασία. **Δύο ανιχνευτές, ίδιο κενό.**
 *
 * ⇒ Ο κίνδυνος δεν είναι οι γραμμές· είναι ότι μια αλλαγή δόγματος πρέπει να
 * θυμηθεί **τρία** αρχεία. Η μετάβαση σε **JIT elevation** (§7ter.3) — που η
 * βιομηχανία θεωρεί υποχρεωτική (Google zero standing privilege · Atlassian
 * TCS · break-glass με justification) — θα άλλαζε **αυτή** τη συνάρτηση αν
 * είναι μία, ή θα ξεχνούσε μία στις τρεις αν είναι τρεις.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΙ **ΔΕΝ** ΕΝΟΠΟΙΕΙΤΑΙ — ΚΑΙ ΓΙΑΤΙ
 * ─────────────────────────────────────────────────────────────────────────────
 * Κάθε πόρος κρατά **δικό του λεπτό module** που ονοματίζει τα πεδία του
 * (`contactData`, `contactId`) και εξάγει το δικό του εργοστάσιο «δεν βρέθηκε».
 * Δεν είναι διακόσμηση:
 *
 * - Τα **μηνύματα** είναι δημόσιο συμβόλαιο ανά πόρο (`'Contact not found'` ≠
 *   `'Building not found'`) και **πρέπει** να διαφέρουν.
 * - Οι **καλούντες** κερδίζουν τύπους που διαβάζονται στο σημείο χρήσης, αντί
 *   για ένα γενικό `data`.
 *
 * ⇒ Ενοποιείται η **απόφαση**, όχι το **λεξιλόγιο**. Ίδιο σχήμα με το
 * {@link loadOwnedDoc}: γενική αλυσίδα, λεπτά typed δεσίματα.
 *
 * @module lib/auth/resource-ownership-guard
 * @see ./tenant-ownership — ο SSoT της ερώτησης «ανήκει;»
 * @see ./owned-doc-loader — η αντίστοιχη ενοποίηση της **αλυσίδας** φόρτωσης
 * @see ADR-742 §3.2, §3.4, §7.1, §7octies
 */

import { createModuleLogger } from '@/lib/telemetry';
import { isRoleBypass } from './roles';
import { isPayloadOwnedByCompany, type MaybeTenantOwned } from './tenant-ownership';

/** Ό,τι χρειάζεται η απόφαση από τον καλούντα. Κάθε `AuthContext` το ικανοποιεί. */
export interface ResourceAccessCaller {
  readonly companyId: string;
  readonly globalRole: string;
  readonly uid?: string;
  readonly email?: string | null;
}

/**
 * Η ετυμηγορία. **Τρεις ονομασμένες καταστάσεις, όχι boolean** — μια boolean σε
 * κλήση ασφαλείας είναι αυτό που ρυθμίζεται λάθος στο review (ADR-742 §3.2).
 *
 * 🔑 Η μεσαία **δεν** είναι συνώνυμο του `'owned'`: είναι το σημείο εισόδου του
 * μελλοντικού JIT elevation (§7ter.3). Αν συγχωνευόταν, η μετάβαση θα έπρεπε να
 * ξαναβρεί πού λαμβάνεται η απόφαση bypass — δηλαδή τα 47 σκόρπια
 * `!isSuperAdmin &&` που αυτή η δουλειά ονομάτισε.
 */
export type ResourceAccessVerdict =
  /** Ανήκει στον καλούντα — η κανονική περίπτωση. */
  | 'owned'
  /** Ξένο, αλλά ο καλών έχει **μόνιμο** cross-tenant προνόμιο (ADR-232 · χρέος §7ter.3). */
  | 'cross-tenant-bypass'
  /** Ξένο ή χωρίς tenant, και ο καλών δεν δικαιούται να μάθει ότι υπάρχει. */
  | 'denied';

export interface ResourceAccessQuery {
  /** Το φορτίο **όπως βγήκε από τη βάση** — ποτέ στενεμένο (§7.5). */
  readonly data: MaybeTenantOwned | null | undefined;
  readonly caller: ResourceAccessCaller;
  /** Το id όπως το έδωσε ο καλών. */
  readonly resourceId: string;
  /** Ποιο μονοπάτι ρώτησε, π.χ. `'view'`, `'update'`, `'link-project'`. */
  readonly action: string;
}

/**
 * Φτιάχνει τη διαδικασία απόφασης για **έναν** πόρο.
 *
 * @param resourceLabel Ανθρώπινο όνομα για τα logs (`'Contact'`, `'Building'`).
 *   **Μόνο** για logs — ό,τι φεύγει στο σύρμα το παράγει το πεδίο ορισμού.
 * @param idLogField Πώς λέγεται το id στα logs (`'contactId'`), ώστε τα
 *   υπάρχοντα ερωτήματα παρατηρησιμότητας να μη σπάσουν.
 */
export function createOwnershipDecision(resourceLabel: string, idLogField: string) {
  const logger = createModuleLogger(`${resourceLabel}Ownership`);
  const companyLogField = `${resourceLabel.toLowerCase()}CompanyId`;

  /**
   * **Η απόφαση (PDP)** — ολική, χωρίς ρίψη, ώστε κάθε διαδρομή να την επιβάλλει
   * με **το δικό της** σχήμα σύρματος (PEP). ADR-742 §7ter.4.
   *
   * Η σειρά των βημάτων **είναι** το συμβόλαιο:
   *
   * 1. **Bypass ρόλος ⇒ περνά**, και αν ο πόρος είναι ξένος **καταγράφεται**.
   *    Αυτό απορροφά τους `log-only` κλάδους που πριν ήταν χωριστά `if` — η ίδια
   *    σύγκριση, μία φορά.
   * 2. **Ανήκει ⇒ περνά.**
   * 3. **Αλλιώς ⇒ `denied`**, με προηγηθείσα καταγραφή: η απόπειρα είναι σήμα
   *    ασφαλείας και πρέπει να επιβιώνει ακόμη κι αν ο καλών καταπιεί το σφάλμα.
   *
   * 🔴 Ρωτά {@link isPayloadOwnedByCompany} και **ποτέ** σκέτο `!==`: ο τύπος
   * υπόσχεται `companyId: string`, η βάση δεν το εγγυάται (§7.5). Καλών με
   * χαλασμένο token (`companyId: ''`) περνούσε σε κάθε έγγραφο με κενό
   * `companyId` — **το κενό δεν είναι tenant, είναι απουσία tenant** (§4).
   */
  return function checkAccess(query: ResourceAccessQuery): ResourceAccessVerdict {
    const { data, caller, resourceId, action } = query;
    const owned = isPayloadOwnedByCompany(data, caller.companyId);

    if (isRoleBypass(caller.globalRole)) {
      if (!owned) {
        logger.info(`[SUPER_ADMIN] Cross-tenant ${resourceLabel.toLowerCase()} access`, {
          action,
          [idLogField]: resourceId,
          email: caller.email ?? null,
          [companyLogField]: data?.companyId ?? null,
        });
        return 'cross-tenant-bypass';
      }
      return 'owned';
    }

    if (owned) return 'owned';

    logger.warn(
      `TENANT ISOLATION VIOLATION — ${resourceLabel.toLowerCase()} access blocked`,
      {
        action,
        [idLogField]: resourceId,
        uid: caller.uid ?? null,
        userCompanyId: caller.companyId,
        [companyLogField]: data?.companyId ?? null,
      },
    );
    return 'denied';
  };
}
