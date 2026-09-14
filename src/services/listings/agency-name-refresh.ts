/**
 * @fileoverview **ΤΟ ΟΝΟΜΑ ΑΛΛΑΞΕ — ΟΙ ΑΓΓΕΛΙΕΣ ΤΟ ΜΑΘΑΙΝΟΥΝ.** Η μία διατύπωση της συνέπειας.
 * @related ADR-841 §7 Α1.6 · Α22 · services/listings/rebuild-public-listings.service.ts
 * @module services/listings/agency-name-refresh
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ: ΤΡΙΑ ΓΕΓΟΝΟΤΑ ΑΛΛΑΖΟΥΝ ΤΟ ΟΝΟΜΑ, ΕΝΑ ΤΟ ΗΞΕΡΕ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `PublicListing.agencyName` είναι **ΑΝΑΦΟΡΑ αποθηκευμένη ως στιγμιότυπο** (Α1.6) — και
 * η θεραπεία που επέλεξε η Α1.6 είναι *«η πράξη που αλλάζει το όνομα ΚΑΤΕΧΕΙ τη συνέπειά
 * της»*. Μέχρι τις 2026-09-14 υπήρχε **μία** τέτοια πράξη (η μετονομασία εταιρείας) και
 * **μία** κλήση, γραμμένη inline στη διαδρομή της. Η Α22 έκανε τη βιτρίνα **αυθεντία** του
 * ονόματος ⇒ οι πράξεις έγιναν **τρεις**:
 *
 * | Αιτία | Ποιος καλεί |
 * |---|---|
 * | `company-renamed` | `api/admin/bootstrap-company` (PATCH) |
 * | `showcase-published` | `api/agency-profile` (POST), **μόνο** αν άλλαξε το όνομα |
 * | `showcase-withdrawn` | `api/agency-profile` (DELETE) **και** η ανάκληση ικανότητας (Π2) |
 *
 * ⛔ Τρία αντίγραφα του `try { republish… } catch { log }` θα απέκλιναν την πρώτη φορά που
 * κάποιος πρόσθετε μέτρηση στο ένα. Εδώ ζει **μία φορά** (N.0.2).
 *
 * ⚠️ **ΔΕΝ ΠΕΤΑ ΠΟΤΕ.** Η αλλαγή ονόματος **έγινε** και δεν ακυρώνεται από αποτυχία
 * παραγώγου· ο άνθρωπος/ο διαχειριστής **μαθαίνει** από τη γραμμή `error` και από το
 * `null`. Δίχτυ ασφαλείας: η επανασύνθεση (`rebuildAllPublicListings`) ρωτά ξανά τον ίδιο
 * επιλυτή.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { createModuleLogger } from '@/lib/telemetry';
import {
  republishListingsForCompany,
  type CompanyRepublishReport,
} from '@/services/listings/rebuild-public-listings.service';

const logger = createModuleLogger('listings/agency-name-refresh');

/** **Γιατί** ξαναγράφονται — κλειστό σύνολο, ώστε η γραμμή log να λέει ποια πράξη το ζήτησε. */
export type AgencyNameChangeCause = 'company-renamed' | 'showcase-published' | 'showcase-withdrawn';

/**
 * **Ξαναγράφει τις δημόσιες αγγελίες ενός οργανισμού ώστε να λένε το ΤΡΕΧΟΝ δημόσιο όνομα.**
 *
 * @returns Η λογιστική του περάσματος, ή `null` όταν **το ίδιο το πέρασμα** απέτυχε.
 */
export async function refreshAgencyNameOnListings(
  adminDb: AdminFirestore,
  companyId: string,
  cause: AgencyNameChangeCause,
): Promise<CompanyRepublishReport | null> {
  try {
    const report = await republishListingsForCompany(adminDb, companyId);

    // 🔑 Μερική αποτυχία ≠ επιτυχία: οι `failed` αγγελίες κρατούν το **παλιό** όνομα.
    if (report.failed > 0 || !report.balanced) {
      logger.error('Το όνομα άλλαξε — ΚΑΠΟΙΕΣ αγγελίες έμειναν με το παλιό', { cause, report });
    } else {
      logger.info('Οι αγγελίες ανανεώθηκαν με το τρέχον δημόσιο όνομα', { cause, report });
    }
    return report;
  } catch (error) {
    logger.error('Το όνομα άλλαξε — οι αγγελίες ΕΜΕΙΝΑΝ ΜΠΑΓΙΑΤΙΚΕΣ', {
      companyId,
      cause,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
