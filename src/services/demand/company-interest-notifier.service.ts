/**
 * @fileoverview **Η ΕΙΔΗΣΗ ΦΤΑΝΕΙ ΚΑΙ ΣΤΟ ΓΡΑΦΕΙΟ** — ADR-777 §8.23 / §8.2.
 * @module services/demand/company-interest-notifier.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 Η ΑΠΟΦΑΣΗ ΤΟΜΕΑ ΠΟΥ ΕΛΕΙΠΕ — και γιατί δεν χρειάστηκε μετανάστευση
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το §8.22 άφησε ρητά ανοιχτό το «**ποιος στο γραφείο ειδοποιείται;**»: το
 * `owner_properties` έχει **έναν** μονοσήμαντο παραλήπτη (`ownerUserId`), ενώ το
 * `properties` ανήκει σε **εταιρεία** — και ο παραλήπτης μιας ειδοποίησης πρέπει
 * να είναι **άνθρωπος**.
 *
 * **Απόφαση Giorgio (2026-08-19): αυτός που καταχώρησε το ακίνητο.**
 *
 * 🔴 **Η πρώτη ανάλυση αυτής της επιλογής ήταν ΛΑΘΟΣ, και το λάθος αξίζει να
 * μείνει γραμμένο**: αναφέρθηκε ότι «τα ακίνητα δεν κρατούν ποιος τα καταχώρησε»
 * και ότι η επιλογή θα απαιτούσε **νέο πεδίο + μετανάστευση**. Η πηγή του
 * σφάλματος: ρωτήθηκε ο **τύπος** (`types/property.ts`, όπου το πεδίο όντως δεν
 * δηλωνόταν) αντί για τα **δεδομένα**. Η ζωντανή βάση απάντησε **8 στα 8** με
 * συμπληρωμένο `createdBy`, γραμμένο συστηματικά από το `buildCommonFields` του
 * `lib/firestore/entity-creation.service.ts` — που το χρησιμοποιεί **κάθε**
 * διαδρομή δημιουργίας ακινήτου.
 *
 * *Ο κώδικας είναι η αλήθεια για τη συμπεριφορά· τα **δεδομένα** είναι η αλήθεια
 * για το τι υπάρχει. Ένας τύπος που δεν δηλώνει ένα πεδίο δεν αποδεικνύει ότι
 * λείπει — αποδεικνύει ότι είναι **αόρατο**.*
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΤΙ ΓΙΝΕΤΑΙ ΟΤΑΝ Η ΥΠΟΓΡΑΦΗ ΛΕΙΠΕΙ — ρητή κατάσταση, ποτέ σιωπή
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ένα έγγραφο γραμμένο από seed script ή από παλαιότερο μονοπάτι μπορεί να μην
 * έχει `createdBy`. **Δεν επινοείται παραλήπτης** και **δεν αγνοείται σιωπηλά**:
 * μετριέται ως {@link CompanyAnnouncementReport.unsigned} και λέγεται στα logs.
 * Ένα ακίνητο που δεν ειδοποιεί κανέναν επειδή δεν ξέρουμε ποιον, είναι ακριβώς
 * το είδος του κενού που όλο το ADR-777 υπάρχει για να μη μένει αόρατο.
 *
 * @see ADR-777 §8.23 · §8.2
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { nowISO, todayLocalDate } from '@/lib/date-local';
import { createModuleLogger } from '@/lib/telemetry';
import {
  announceIfNewsworthy,
  createAnnouncementTally,
  type AnnouncementCounters,
} from '@/services/demand/announcement-pass';
import { MAX_ANNOUNCE_PROPERTIES } from '@/services/demand/interest-notifier.service';
import { readLiveDemands } from '@/services/demand/live-demands.reader';
import { companyPropertyFactsOf } from '@/services/demand/place-interest.service';
import type { PropertyDemand } from '@/types/property-demand';

const logger = createModuleLogger('demand/company-interest-notifier');

/** Το σχήμα που χρειάζεται ο σαρωτής από ένα ακίνητο γραφείου. */
interface ScannableCompanyProperty {
  readonly id: string;
  readonly name?: string | null;
  readonly companyId?: string | null;
  readonly createdBy?: string | null;
  readonly buildingId?: string | null;
  readonly projectId?: string | null;
}

/**
 * Τι έκανε το πέρασμα. **Κλειστή λογιστική** — κάθε ακίνητο σε έναν κάδο.
 *
 * Οι τέσσερις κοινοί κάδοι έρχονται από τον **κοινό** μετρητή· εδώ προστίθεται
 * **ένας** που δεν υπάρχει στον ιδιώτη, γιατί εκεί ο παραλήπτης είναι δομικά
 * παρών (`ownerUserId`) ενώ εδώ μπορεί να λείπει.
 */
export interface CompanyAnnouncementReport extends AnnouncementCounters {
  /** 🔴 Δεν υπάρχει `createdBy` ⇒ **δεν ξέρουμε ποιον να ειδοποιήσουμε**. */
  readonly unsigned: number;
}

/** Κλείνει το άθροισμα; Υπάρχει **για να αποτύχει θορυβωδώς**. */
export function companyReportBalances(report: CompanyAnnouncementReport): boolean {
  return (
    report.announced +
      report.alreadyKnown +
      report.noNews +
      report.optedOut +
      report.unsigned ===
    report.considered
  );
}

/**
 * **Πες σε κάθε υπάλληλο ό,τι είναι είδηση για τα ακίνητα που καταχώρησε ο ίδιος.**
 *
 * ⚠️ **Idempotent**, με τον ίδιο μηχανισμό όπως ο ειδοποιητής ιδιωτών: το κλειδί
 * είναι `propertyId:demand-band:N`, άρα δύο περάσματα χωρίς αλλαγή στην αγορά
 * στέλνουν **μηδέν** δεύτερα μηνύματα.
 */
export async function announceInterestToCompanyStaff(
  db: AdminFirestore,
): Promise<CompanyAnnouncementReport> {
  const { demands } = await readLiveDemands(db, 'demand/company-interest-notifier');

  const snapshot = await db
    .collection(COLLECTIONS.PROPERTIES)
    .limit(MAX_ANNOUNCE_PROPERTIES)
    .get();

  const properties = snapshot.docs.map((doc) => ({
    ...(doc.data() as ScannableCompanyProperty),
    id: doc.id,
  }));

  const report = await tallyCompanyAnnouncements(db, properties, demands);

  // 🔴 Άγνωστη κατάσταση ⇒ σφάλμα **με όνομα**, ποτέ σιωπηλή απώλεια κάδου.
  if (!companyReportBalances(report)) {
    throw new Error(
      `company-interest-notifier: ασυνεπής λογιστική — ${report.announced}+` +
        `${report.alreadyKnown}+${report.noNews}+${report.optedOut}+${report.unsigned} ` +
        `≠ ${report.considered}`,
    );
  }

  if (report.unsigned > 0) {
    logger.warn('Ακίνητα ΧΩΡΙΣ υπογραφή — κανείς δεν ειδοποιήθηκε γι΄ αυτά', {
      data: { unsigned: String(report.unsigned) },
    });
  }

  if (report.truncated) {
    logger.warn('Το όριο ακινήτων αγγίχθηκε — κάποια ΔΕΝ εξετάστηκαν', {
      data: { limit: String(MAX_ANNOUNCE_PROPERTIES) },
    });
  }

  return report;
}

/**
 * Ο βρόχος που μετράει και στέλνει.
 *
 * ⚠️ **Μία ανάγνωση ρολογιού για όλο το πέρασμα** — ίδιο συμβόλαιο με τον
 * ειδοποιητή ιδιωτών: δύο κλήσεις θα έκριναν τα πρώτα ακίνητα σε άλλη στιγμή από
 * τα τελευταία, δηλαδή η φρεσκάδα μιας ζήτησης θα μπορούσε να λήξει **στη μέση**
 * της ίδιας σάρωσης.
 *
 * ⚠️ **Σειριακά, όχι παράλληλα**, και είναι απόφαση: κάθε ακίνητο κοστίζει
 * αναγνώσεις για την αλυσίδα κτίριο → έργο, και ένα `Promise.all` πάνω σε 500
 * ακίνητα θα άνοιγε 500 ταυτόχρονες αλυσίδες πάνω στην ίδια Firestore.
 */
async function tallyCompanyAnnouncements(
  db: AdminFirestore,
  properties: readonly ScannableCompanyProperty[],
  demands: readonly PropertyDemand[],
): Promise<CompanyAnnouncementReport> {
  const nowIso = nowISO();
  const todayDate = todayLocalDate();
  const tally = createAnnouncementTally();
  const moment = { nowIso, todayDate };
  let unsigned = 0;

  for (const property of properties) {
    // 🔴 **Η υπογραφή ελέγχεται ΠΡΙΝ από κάθε δουλειά.** Χωρίς παραλήπτη, το
    // ταίριασμα θα ήταν υπολογισμός που δεν μπορεί να καταλήξει πουθενά — και,
    // χειρότερα, θα μετριόταν ως «καμία είδηση» και θα φαινόταν φυσιολογικό.
    const recipientId = property.createdBy;
    if (typeof recipientId !== 'string' || recipientId.length === 0) {
      unsigned += 1;
      continue;
    }

    await announceIfNewsworthy(
      tally,
      {
        propertyId: property.id,
        propertyTitle: property.name ?? '',
        recipientId,
        // Ο μισθωτής είναι η **εταιρεία** — σε αντίθεση με τον ιδιώτη, όπου ο
        // μισθωτής είναι ο ίδιος ο άνθρωπος (`tenant-config.ts`, mode `userId`).
        tenantId: property.companyId ?? recipientId,
        facts: await companyPropertyFactsOf(db, { ...property }, nowIso),
      },
      demands,
      moment,
    );
  }

  return {
    ...tally.snapshot(properties.length, MAX_ANNOUNCE_PROPERTIES),
    unsigned,
  };
}
