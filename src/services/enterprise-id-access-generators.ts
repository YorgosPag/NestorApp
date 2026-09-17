/**
 * ENTERPRISE ID GENERATION — ΟΙ ΤΑΥΤΟΤΗΤΕΣ ΤΟΥ ΚΥΚΛΟΥ ΕΝΤΑΞΗΣ
 *
 * Extracted from `enterprise-id-class.ts` (2026-09-12) when that file reached the N.7.1
 * 500-line ceiling — a **split, not a trim**: the same move that already produced
 * `enterprise-id-bim-generators.ts`, `enterprise-id-public-registry-generators.ts` and
 * `enterprise-id-composite-key-generators.ts`, for the same measured reason.
 *
 * Composition model — abstract base chain, not a mixin:
 *
 *   BimEntityIdGenerators        (ADR-363 drawing entities)
 *     ↑ extends
 *   PublicRegistryIdGenerators   (ADR-777 level Α + offers)
 *     ↑ extends
 *   AccessLifecycleIdGenerators  (this file)
 *     ↑ extends
 *   NetworkIdGenerators          (ADR-867 — νήματα ανάμεσα σε χώρους)
 *     ↑ extends
 *   CompositeKeyIdGenerators     (composite keys + pure readers)
 *     ↑ extends
 *   EnterpriseIdService          (owns the engines: retry loop, cache, stats, v4 nibble)
 *
 * 🔑 **ΤΙ ΕΝΩΝΕΙ ΑΥΤΑ ΤΑ ΤΡΙΑ — ΚΑΙ ΟΧΙ ΟΠΟΙΕΣ 40 ΓΡΑΜΜΕΣ ΕΦΤΑΝΑΝ ΣΤΟ ΟΡΙΟ.** Είναι οι
 * ταυτότητες που γεννιούνται **όσο ένας άνθρωπος μπαίνει σε χώρο**: η διεκδίκηση του
 * λογαριασμού του (`arj`), το αίτημα που ανοίγει **ο ίδιος** (`wacr`), και η πρόσκληση που
 * του στέλνει **ο χώρος** (`winv`). Τρεις σταθμοί μιας διαδρομής — το κόψιμο πέρασε από
 * σύνορο που **ήδη υπήρχε**, όχι από τη μέση μιας ευθύνης.
 *
 * ⚠️ **Η ΜΗΧΑΝΗ ΔΕΝ ΜΕΤΑΚΟΜΙΣΕ ΕΔΩ, ΕΠΙΤΗΔΕΣ.** Ο `mintDeterministicV4Id` μένει στην
 * `EnterpriseIdService`, δίπλα στον `generateDeterministicCompanyId` — που **δεν** ανήκει
 * σε αυτόν τον κύκλο *(είναι ο σπορέας δοκιμαστικών εταιρειών)*. Μια μηχανή παρκαρισμένη
 * στο αρχείο ενός τομέα θα έκανε **την κεφαλίδα του να λέει ψέματα**. Εδώ απλώς
 * **δηλώνεται** ως `protected abstract`, ακριβώς όπως το `BimEntityIdGenerators` δηλώνει το
 * `generateId`: η κατάσταση ζει σε **ένα** σημείο, αυτό το αρχείο προσθέτει **ονοματοδοσία,
 * ποτέ λογική γέννησης**.
 *
 * @module services/enterprise-id-access-generators
 * @version 1.0.0
 */

import {
  ENTERPRISE_ID_PREFIXES,
  type EnterpriseIdPrefix,
} from './enterprise-id-prefixes';
import { PublicRegistryIdGenerators } from './enterprise-id-public-registry-generators';

// Alias for compact generator methods
const P = ENTERPRISE_ID_PREFIXES;

export abstract class AccessLifecycleIdGenerators extends PublicRegistryIdGenerators {
  // `generateId` κληρονομείται ως protected abstract από τη βάση — η μηχανή μένει μία.

  /**
   * Implemented by {@link EnterpriseIdService} — ντετερμινιστικό id **με nibble v4**, ώστε
   * να το δέχεται ο επικυρωτής του **ίδιου** έργου (`isValidEnterpriseId`).
   *
   * ⛔ **ΔΕΝ ΛΕΓΕΤΑΙ `generateDeterministic…Id`, ΚΑΙ ΜΗΝ ΤΟ ΜΕΤΟΝΟΜΑΣΕΙΣ.** Η άγκυρα
   * `enterprise-id.service.test.ts` σαρώνει την αλυσίδα πρωτοτύπων με
   * `/^generateDeterministic[A-Z][A-Za-z0-9]*Id$/` για να πιάνει **κάθε** γεννήτορα
   * **οντότητας**, και όσους μπουν αύριο, χωρίς χειρόγραφη λίστα. Μια **μηχανή** με τέτοιο
   * όνομα μπαίνει στη σάρωση και δέχεται τον σπόρο **στη θέση του προθέματος** — μετρημένο
   * 2026-09-12: **4 κόκκινες** που έζησαν στο `main` από το `68230ba5` (ADR-851).
   */
  protected abstract mintDeterministicV4Id(prefix: EnterpriseIdPrefix, seed: string): string;

  /**
   * ADR-844 §13.8 — **το ημερολόγιο μιας διεκδίκησης λογαριασμού**, ένα ανά email.
   * Ντετερμινιστικό επειδή η **συνέχιση** μιας διακοπείσας πράξης ξέρει μόνο το email.
   */
  generateDeterministicAuthReprovisionJournalId(normalizedEmail: string): string {
    return this.mintDeterministicV4Id(P.AUTH_REPROVISION_JOURNAL, normalizedEmail);
  }

  /**
   * ADR-660 §6 — **το αίτημα ένταξης** σε χώρο εργασίας, ένα ανά (χώρος, πρόσωπο).
   * Ντετερμινιστικό ⇒ δύο συνδέσεις μαζί ανοίγουν **ένα** αίτημα, χωρίς ερώτημα.
   */
  generateDeterministicWorkspaceAccessRequestId(companyId: string, uid: string): string {
    return this.mintDeterministicV4Id(P.WORKSPACE_ACCESS_REQUEST, `${companyId}:${uid}`);
  }

  /**
   * ADR-841 §7 Α21.21 Φάση Β — **η ερώτηση αργιών**, μία ανά (γραφείο, εορταστική περίοδος).
   * Ντετερμινιστικό ⇒ το ημερήσιο cron που ξαναρωτά την ίδια περίοδο γράφει **ένα** έγγραφο, χωρίς ερώτημα.
   */
  generateDeterministicHolidayHoursQuestionId(companyId: string, seasonKey: string): string {
    return this.mintDeterministicV4Id(P.HOLIDAY_HOURS_QUESTION, `${companyId}:${seasonKey}`);
  }

  /**
   * ADR-835 §21 — **οι κανόνες ανά ημερομηνία ενός μήνα**, ένα έγγραφο ανά (ακίνητο, `YYYY-MM`).
   * Ντετερμινιστικό ⇒ η συναλλαγή που ρυθμίζει μέρες ξέρει ποιο έγγραφο γράφει χωρίς ερώτημα.
   */
  generateDeterministicStayCalendarMonthId(propertyId: string, monthKey: string): string {
    return this.mintDeterministicV4Id(P.STAY_CALENDAR_MONTH, `${propertyId}:${monthKey}`);
  }

  /**
   * ADR-835 §22 — **το εξωτερικό block ενός γεγονότος feed** (`sblk_*`), ένα ανά
   * (πηγή, `UID`).
   *
   * 🔑 Ντετερμινιστικό ⇒ η **επανεισαγωγή** του ίδιου γεγονότος γράφει το **ίδιο**
   * έγγραφο, χωρίς ερώτημα: δύο δημοσκοπήσεις δεν φτιάχνουν δύο blocks για μία κράτηση.
   *
   * ⚠️ **Δεν αρκεί μόνο του**: η Booking.com δίνει **νέο `UID` κάθε μέρα** για την ίδια
   * κράτηση (μετρημένο), οπότε η συμφιλίωση έχει **δεύτερο** δρόμο ταύτισης κατά ημέρα
   * αναχώρησης (`lib/stay/stay-channel-reconcile.ts`). Το ντετερμινιστικό id είναι η
   * **ιδιοδυναμία**, όχι η ταυτότητα του γεγονότος.
   */
  generateDeterministicStayExternalBlockId(feedId: string, externalUid: string): string {
    return this.mintDeterministicV4Id(P.STAY_BLOCK, `${feedId}:${externalUid}`);
  }

  /**
   * ADR-853 §7.1 — **η πρόσκληση σε χώρο εργασίας**.
   *
   * 🔴 **ΜΗ ΝΤΕΤΕΡΜΙΝΙΣΤΙΚΟ, ΑΝΤΙΘΕΤΑ ΑΠΟ ΤΟΝ ΔΙΠΛΑΝΟ ΤΟΥ `wacr` — ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ, ΟΧΙ
   * ΑΒΛΕΨΙΑ**: η **επαναποστολή** οφείλει να γεννά **νέο token με νέα λήξη**, ενώ ένα
   * σταθερό id ανά (χώρος, email) θα ανάγκαζε επανεγγραφή του **ίδιου** εγγράφου ενώ το
   * **παλιό token ζει ακόμη** — δηλαδή δύο κλειδιά για μία πόρτα.
   *
   * 🔑 Η ιδεμποτησία δεν χάνεται· **μετακομίζει**: *ένα ζωντανό ανά (χώρος, κανονικοποιημένο
   * email)*, με την προηγούμενη να γίνεται `revoked` μέσα στην **ίδια** συναλλαγή (ADR-853
   * §7.3 — πρότυπο `superseded` του ADR-844). Έτσι δεν κυκλοφορούν ποτέ **δύο ζωντανά
   * token** για το ίδιο πρόσωπο, που είναι και η άμυνα στο race-condition των ορίων.
   */
  generateWorkspaceInvitationId(): string { return this.generateId(P.WORKSPACE_INVITATION).id; }
}
