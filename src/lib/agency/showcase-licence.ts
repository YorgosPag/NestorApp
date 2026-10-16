/**
 * @fileoverview **ΟΙ ΑΔΕΙΕΣ ΤΗΣ ΒΙΤΡΙΝΑΣ** — σχηματισμός από το σύρμα, ανάγνωση από τον δίσκο, ερώτηση (ADR-915 §21).
 * @related config/professional-licences.ts (το λεξιλόγιο) · types/agency-profile.ts (`ShowcaseLicence`) ·
 *   lib/agency/showcase-read.ts (το σύνορο ανάγνωσης) · lib/agency/occupation-query.ts (ο κριτής «μπορεί να εκδώσει»)
 * @module lib/agency/showcase-licence
 *
 * 🔑 **Καθαρό leaf** — καμία εισαγωγή SDK: το ζητούν ο γραφέας (διακομιστής), το σύνορο ανάγνωσης και ο κατάλογος (πελάτης).
 * 🔑 **Η αρχή ΠΑΡΑΓΕΤΑΙ από την άδεια** — ο πελάτης στέλνει μόνο «ποια άδεια» και «ποιος αριθμός».
 * 🔒 **Πάντα `declared`**: καμία σύνδεση με το μητρώο (ADR-798 §7). Ο πελάτης ελέγχει τον αριθμό ο ίδιος, από τον
 *    σύνδεσμο `registryLookupUrl` που δείχνει η κάρτα.
 */

import {
  isProfessionalLicence,
  PROFESSIONAL_LICENCE_SPECS,
  type ProfessionalLicence,
} from '@/config/professional-licences';
import { readProfessionalAttestation } from '@/lib/professional/professional-attestation';
import type { PublicShowcase, ShowcaseLicence } from '@/types/agency-profile';

/**
 * **Οι λόγοι άρνησης της πράξης «άδειες»** — δικό τους κλειστό λεξιλόγιο (ρίζα, CHECK 3.73), χωριστό από τη δημοσίευση
 * της βιτρίνας: οι άδειες είναι **δική τους** πράξη (υποσελίδα), και τα κείμενά τους δεν ταξιδεύουν στη φόρμα της
 * βιτρίνας (route slice, CHECK 3.34).
 */
export const SHOWCASE_LICENCE_REJECTIONS = [
  /** Άδεια **χωρίς** αριθμό μητρώου: ισχυρισμός που κανείς δεν μπορεί να διαψεύσει (ADR-841 Α9.2). */
  'licence-number-missing',
  /** Η ίδια άδεια δηλώθηκε δύο φορές. */
  'licence-duplicate',
  /** Δήλωση αδειών για βιτρίνα που ΔΕΝ υπάρχει: δεν έχουν πού να φανούν (ίδιο με την κάρτα). */
  'licences-without-showcase',
] as const;
export type ShowcaseLicenceRejection = (typeof SHOWCASE_LICENCE_REJECTIONS)[number];

/** Ό,τι χρειάζεται ο σχηματισμός από το σύρμα (ίδιο σχήμα με το `ShowcaseLicenceWire`, χωρίς εξάρτηση από αυτό). */
interface LicenceDeclaration {
  readonly licence: string;
  readonly registrationNumber: string;
}

/** Μια **δηλωμένη** άδεια — η αρχή από τον πίνακα, ο αριθμός όπως τον έδωσε ο άνθρωπος. */
function declaredLicence(licence: ProfessionalLicence, number: string): ShowcaseLicence {
  const { authority } = PROFESSIONAL_LICENCE_SPECS[licence];
  return {
    licence,
    attestation: { state: 'declared', registration: { authorityKind: 'national', authority, number } },
  };
}

/**
 * Από το σύρμα στις άδειες της βιτρίνας — με **ονομασμένη** άρνηση, ποτέ σιωπηλή παράλειψη.
 * Άγνωστη άδεια το έχει ήδη απορρίψει το σχήμα του σύρματος (κλειστό `enum`)· εδώ φτάνει μόνο ως άμυνα.
 */
export function formShowcaseLicences(
  declared: readonly LicenceDeclaration[],
): { readonly licences: readonly ShowcaseLicence[] } | { readonly reason: ShowcaseLicenceRejection } {
  const licences: ShowcaseLicence[] = [];
  for (const { licence, registrationNumber } of declared) {
    if (!isProfessionalLicence(licence)) return { reason: 'licence-number-missing' };
    const number = registrationNumber.trim();
    if (number === '') return { reason: 'licence-number-missing' };
    if (licences.some((held) => held.licence === licence)) return { reason: 'licence-duplicate' };
    licences.push(declaredLicence(licence, number));
  }
  return { licences };
}

/** Μία αποθηκευμένη γραμμή ⇒ άδεια, ή `null` αν δεν περνά τον φρουρό (παραλείπεται — ποτέ μαντεψιά). */
function readLicence(raw: unknown): ShowcaseLicence | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const row = raw as Record<string, unknown>;
  if (!isProfessionalLicence(row.licence)) return null;
  // 🔑 Ο ΕΝΑΣ αναγνώστης απόδειξης (ίδιος με τα credentials) — καμία δεύτερη ανάλυση του σχήματος.
  const attestation = readProfessionalAttestation(row.attestation);
  if (attestation === null || attestation.state === 'unknown') return null;
  // Η αρχή πρέπει να είναι ΑΥΤΗ της άδειας — έγγραφο που λέει άλλη δεν το πιστεύουμε.
  if (attestation.registration.authority !== PROFESSIONAL_LICENCE_SPECS[row.licence].authority) return null;
  return { licence: row.licence, attestation };
}

/**
 * Οι άδειες ενός αποθηκευμένου εγγράφου.
 *
 * 🔑 **Απόν πεδίο ⇒ `[]`, και εδώ είναι ΑΛΗΘΕΣ** — αντίθετα από τα `credentials` (όπου η απουσία σημαίνει «παλιό σχήμα»):
 *    έγγραφο γραμμένο πριν υπάρξουν άδειες **δεν δήλωσε καμία**. Μια γραμμή που δεν περνά τον φρουρό παραλείπεται.
 */
export function readShowcaseLicences(raw: unknown): readonly ShowcaseLicence[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(readLicence).filter((licence): licence is ShowcaseLicence => licence !== null);
}

/** *«Δηλώνει αυτή η βιτρίνα την άδεια;»* — η **μία** ερώτηση για κριτή, πλήθη και κάρτα. */
export function showcaseHoldsLicence(showcase: Pick<PublicShowcase, 'licences'>, licence: ProfessionalLicence): boolean {
  return showcase.licences.some((held) => held.licence === licence);
}
