/**
 * =============================================================================
 * JOB: first-contact-invitation-expiry — **Η ΠΡΟΣΚΛΗΣΗ ΠΟΥ ΔΕΝ ΠΑΤΗΘΗΚΕ** (ADR-844)
 * =============================================================================
 *
 * Η λήξη είναι ήδη **δομική**: το `claimInvitation` αρνείται κάθε πρόσκληση που πέρασε την
 * ώρα της, και το `readStoredInvitationState` διαβάζει fail-closed προς `expired`. Άρα
 * **καμία** ληγμένη πρόσκληση δεν εξαργυρώνεται, με ή χωρίς αυτή την εργασία.
 *
 * 🔑 **Αυτό που λείπει δεν είναι ασφάλεια — είναι ΚΑΘΑΡΙΟΤΗΤΑ.** Το έγγραφο κρατά
 * **όνομα, email και τηλέφωνο** ανθρώπου που τελικά **δεν επικοινώνησε με κανέναν**.
 * Χωρίς σαρωτή, αυτά τα στοιχεία μένουν για πάντα σε συλλογή που **κανείς δεν διαβάζει**:
 * καθαρή έκθεση χωρίς αναγνώστη, δηλαδή παραβίαση της ελαχιστοποίησης (GDPR 5.1.γ).
 *
 * 🔑 **Καμία νέα υποδομή** (ADR-740): περιοδική εκτέλεση, ταυτότητα μηχανής→μηχανής,
 * lease, monitor και catch-up υπάρχουν όλα. Εδώ δηλώνεται **ποια** εργασία είναι.
 *
 * @module lib/cron/jobs/first-contact-invitation-expiry.job
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { purgeExpiredInvitations } from '@/services/contact/first-contact-invitation-expiry.service';
import type { CronJobResult } from '@/types/cron-schedule';

/**
 * Ένα πέρασμα: «σβήσε ό,τι πέρασε η ώρα του».
 *
 * ⚠️ **Κάθε κάδος εκπέμπεται, ΚΑΙ ΟΤΑΝ ΕΙΝΑΙ ΜΗΔΕΝ.** Ένα `considered` που λείπει
 * διαβάζεται ως «δεν έληξε τίποτα» — αλλά διαβάζεται **εξίσου** ως «δεν κοίταξε κανείς».
 * Η διάκριση είναι το σχήμα που κυνηγά όλο το ADR-777, και η εργασία της λήξης είναι
 * ακριβώς εκείνη που κανείς δεν κοιτάζει μέχρι να πάει κάτι στραβά.
 */
export async function runFirstContactInvitationExpiry(): Promise<CronJobResult> {
  const report = await purgeExpiredInvitations(getAdminFirestore());

  return {
    summary:
      `expired ${report.considered}, deleted ${report.deleted}, failed ${report.failed}`
      + (report.truncated ? ', TRUNCATED' : ''),
    metrics: {
      considered: report.considered,
      deleted: report.deleted,
      failed: report.failed,
      truncated: report.truncated ? 1 : 0,
    },
  };
}
