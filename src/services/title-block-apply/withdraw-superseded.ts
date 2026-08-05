/**
 * @fileoverview Απόσυρση των **στόχων** που αντικαταστάθηκαν (ADR-745 Φ3β, Τομέας Δ2).
 *
 * 🔴 **Γιατί υπάρχει.** Μέχρι σήμερα το supersede άγγιζε **μόνο** τη συλλογή
 * `title_block_bindings`: το προηγούμενο binding γινόταν `superseded` και ο **στόχος** του έμενε
 * ζωντανός. Ήταν σχεδόν αόρατο όσο το UI δεν επέτρεπε δεύτερη επιλογή· ο επιλογέας υποψηφίου το
 * κάνει **καθημερινό**: «διάλεξα λάθος, το διορθώνω» άφηνε **δύο ενεργά `contact_links`** και το
 * έργο δήλωνε **δύο διαφορετικούς ανθρώπους** στον ίδιο ρόλο, χωρίς καμία ένδειξη πουθενά.
 *
 * 🔑 **Η θεραπεία ανήκει στον διανομέα, όχι στην υπηρεσία των bindings.** Εκείνη κατέχει **μία**
 * συλλογή (§10 #7)· μια κλήση `unlinkContact` από μέσα της θα την έκανε γραφέα σε δεύτερη. Ο
 * διανομέας κατέχει ήδη τη σειρά «πρώτα ο στόχος, μετά η προέλευση» (Γ9) — η απόσυρση είναι το
 * **τρίτο** βήμα της ίδιας σειράς.
 *
 * ⚠️ **Ο οικοπεδούχος ΔΕΝ αποσύρεται εδώ, και είναι σκόπιμο.** Η αφαίρεση οικοπεδούχου
 * ξαναμοιράζει τα χιλιοστά **όλης** της λίστας (`apply-landowner.ts` → `reapportion`), δηλαδή
 * αλλάζει **τιμές τρίτων ιδιοκτητών** — και το ADR §10 δηλώνει ότι η αφαίρεση έχει **δικούς της
 * φύλακες**. Αντί να την κάνουμε σιωπηλά ως παρενέργεια, ο διανομέας **αρνείται** εξαρχής τη
 * δεύτερη έγκριση διαφορετικού προσώπου στο ίδιο slot (δες `refuseLandownerReplacement`).
 *
 * @module services/title-block-apply/withdraw-superseded
 */

import { buildContactLinkKey } from '@/lib/contact-link-id';
import { unlinkContact } from '@/services/contact-link.service';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import type { TitleBlockBinding } from '@/types/title-block-binding';

const logger = createModuleLogger('TitleBlockWithdraw');

/**
 * Γιατί μια **αντικατάσταση οικοπεδούχου** δεν εκτελείται σιωπηλά.
 *
 * 🔴 Το σενάριο, μετρημένο στον κώδικα: ο `mergeLandowner` κάνει **append** όταν το `contactId`
 * είναι νέο, και ο `reapportion` ξαναμοιράζει τα χιλιοστά πάνω σε **ΟΛΗ** τη λίστα. Έγκριση
 * λάθος προσώπου με 40%, μετά «διόρθωση» σε άλλο πρόσωπο με 40%, δίνει **τέσσερις** ιδιοκτήτες
 * αντί για τρεις, άθροισμα 180%, και **αλλαγμένα χιλιοστά στους δύο αρχικούς** — ανθρώπους που
 * ο χρήστης δεν άγγιξε ποτέ. Είναι σφάλμα **τιμής**, της ίδιας κλάσης με το «999‰ σε τρία
 * αδέλφια» που το `apply-landowner.ts` αναφέρει ρητά.
 *
 * 🔑 **Γιατί άρνηση και όχι αυτόματη αφαίρεση.** Η αφαίρεση οικοπεδούχου έχει **δικούς της
 * φύλακες** (ADR §10 όριο 1: πίνακες ποσοστών που μπαγιατεύουν, υπογραφές που καταγράφηκαν στο
 * μεταξύ). Εκτελώντας την ως **παρενέργεια** ενός κλικ στον καμβά, θα την περνούσαμε από πάνω
 * τους — δηλαδή θα θεραπεύαμε μια απώλεια δεδομένων γεννώντας άλλη. Ο χρήστης στέλνεται στην
 * καρτέλα, όπου η πράξη έχει το πλαίσιο που της αναλογεί.
 */
export function refuseLandownerReplacement(
  sameSlot: readonly TitleBlockBinding[],
  contactId: string,
): TitleBlockBinding | null {
  return (
    sameSlot.find(
      (b) => b.target.kind === 'landowner' && b.target.contactId !== contactId,
    ) ?? null
  );
}

/** Τι δεν κατάφερε να αποσυρθεί — **ποτέ σιωπηλά**, ακόμη κι όταν η έγκριση πέτυχε. */
export interface WithdrawFailure {
  readonly bindingId: string;
  readonly reason: string;
}

/**
 * Αποσυνδέει τους στόχους των bindings που μόλις έγιναν `superseded`.
 *
 * 🔑 **Ο `linkId` ξαναχτίζεται — δεν χρειάζεται να τον έχουμε αποθηκεύσει.** Το
 * `buildContactLinkKey` είναι καθαρά ντετερμινιστικό (`cl_{contactId}_project_{projectId}_{role}`)
 * και ο **ρόλος ζει μέσα στο superseded binding**, αφού είναι μέρος του `targetRef`. Αυτός είναι
 * ο πραγματικός λόγος που ο ρόλος ανήκει στο κλειδί.
 *
 * ⚠️ **Η αποτυχία εδώ ΔΕΝ ακυρώνει την έγκριση.** Ο νέος στόχος και η νέα προέλευση έχουν ήδη
 * γραφτεί σωστά· μια αποτυχία καθαριότητας που γκρέμιζε την κύρια πράξη θα άφηνε τον χρήστη
 * χωρίς **τίποτα** επειδή δεν καθάρισε ένα παλιό. Επιστρέφεται ώστε να φανεί, όχι να σβήσει.
 */
export async function withdrawSupersededTargets(
  superseded: readonly TitleBlockBinding[],
  userId: string,
): Promise<WithdrawFailure[]> {
  const failures: WithdrawFailure[] = [];

  for (const stale of superseded) {
    // Μόνο οι **συνδέσεις** αποσύρονται. Μια τιμή πεδίου (Ο.Τ., δήμος) δεν «αποσυνδέεται»:
    // αντικαταστάθηκε επί τόπου από τη νέα έγκριση, και δεν υπάρχει τίποτα να αναιρεθεί.
    if (stale.target.kind !== 'contact') continue;

    const linkId = buildContactLinkKey(
      stale.target.contactId,
      'project',
      stale.target.projectId,
      stale.target.role,
    );

    try {
      const result = await unlinkContact(linkId, userId);
      if (!result.success) {
        failures.push({ bindingId: stale.id, reason: result.error });
      }
    } catch (error) {
      failures.push({ bindingId: stale.id, reason: getErrorMessage(error) });
    }
  }

  if (failures.length > 0) {
    logger.warn('Superseded targets left connected', { failures });
  }
  return failures;
}
