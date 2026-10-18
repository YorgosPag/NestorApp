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
  PROFESSIONAL_LICENCES,
  PROFESSIONAL_LICENCE_SPECS,
  type ProfessionalLicence,
} from '@/config/professional-licences';
import { isChapteredRegistry } from '@/constants/professional-registries';
import { readProfessionalAttestation } from '@/lib/professional/professional-attestation';
import type { PublicShowcase, ShowcaseCredential, ShowcaseLicence } from '@/types/agency-profile';

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
  /**
   * Άδεια αρχής **με παραρτήματα** (Περιφερειακή Ενότητα) χωρίς τον εκδότη: «1234» χωρίς «ΠΕ Θεσσαλονίκης» δεν
   * επαληθεύεται από κανέναν (ADR-841 Α9.1 · ADR-915 §34).
   */
  'licence-chapter-missing',
  /** Η άδεια προκύπτει ΗΔΗ από δηλωμένη ειδικότητα (ηλεκτρολόγος + εγγραφή Περιφέρειας) — καμία διπλή δήλωση (§34 Λ5). */
  'licence-held-through-occupation',
] as const;
export type ShowcaseLicenceRejection = (typeof SHOWCASE_LICENCE_REJECTIONS)[number];

/** Ό,τι χρειάζεται ο σχηματισμός από το σύρμα (ίδιο σχήμα με το `ShowcaseLicenceWire`, χωρίς εξάρτηση από αυτό). */
interface LicenceDeclaration {
  readonly licence: string;
  readonly registrationNumber: string;
  readonly registrationChapter?: string;
}

/**
 * Μια **δηλωμένη** άδεια — η αρχή από τον πίνακα, ο αριθμός (και, σε αρχή με παραρτήματα, ο εκδότης) όπως τα έδωσε ο
 * άνθρωπος. Κενός εκδότης σε αρχή με παραρτήματα ⇒ `null` (ο καλών αρνείται ονομαστικά)· σε εθνική αρχή αγνοείται.
 */
function declaredLicence(licence: ProfessionalLicence, number: string, chapter: string): ShowcaseLicence | null {
  const { authority } = PROFESSIONAL_LICENCE_SPECS[licence];
  if (!isChapteredRegistry(authority)) {
    return { licence, attestation: { state: 'declared', registration: { authorityKind: 'national', authority, number } } };
  }
  if (chapter === '') return null;
  return {
    licence,
    attestation: { state: 'declared', registration: { authorityKind: 'chapter', authority, chapter, number } },
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
  for (const { licence, registrationNumber, registrationChapter } of declared) {
    if (!isProfessionalLicence(licence)) return { reason: 'licence-number-missing' };
    const number = registrationNumber.trim();
    if (number === '') return { reason: 'licence-number-missing' };
    if (licences.some((held) => held.licence === licence)) return { reason: 'licence-duplicate' };
    const formed = declaredLicence(licence, number, (registrationChapter ?? '').trim());
    if (formed === null) return { reason: 'licence-chapter-missing' };
    licences.push(formed);
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

/**
 * Η άδεια που **είναι** ένα credential, αν είναι (ADR-915 §34 Λ3): ειδικότητα του `heldThroughOccupations` **και**
 * δηλωμένη/επαληθευμένη εγγραφή στην **ίδια** αρχή. Ηλεκτρολόγος 7411 χωρίς αριθμό Περιφέρειας ⇒ καμία (π.δ. 108/2013
 * άρθ. 12: χωρίς άδεια δεν υπογράφει)· ηλεκτρολόγος οικιακών συσκευών με αριθμό ⇒ καμία (δεν ελέγχει εγκατάσταση).
 */
function licenceOfCredential(credential: ShowcaseCredential, licence: ProfessionalLicence): ShowcaseLicence | null {
  const spec = PROFESSIONAL_LICENCE_SPECS[licence];
  const { attestation, occupation } = credential;
  if (attestation.state === 'unknown' || !spec.heldThroughOccupations.includes(occupation.escoUri)) return null;
  return attestation.registration.authority === spec.authority ? { licence, attestation } : null;
}

/**
 * *«Ποιες άδειες έχει ήδη αυτή η βιτρίνα **μέσα από τις ειδικότητές της**;»* — μία ανά άδεια, με την απόδειξη του
 * credential. Τη ρωτούν ο κριτής, η φόρμα («καλύπτεται από την ειδικότητά σας») και ο γραφέας (καμία διπλή δήλωση).
 */
export function licencesHeldThroughCredentials(credentials: readonly ShowcaseCredential[]): readonly ShowcaseLicence[] {
  return PROFESSIONAL_LICENCES.flatMap((licence) => {
    for (const credential of credentials) {
      const held = licenceOfCredential(credential, licence);
      if (held !== null) return [held];
    }
    return [];
  });
}

/**
 * *«Έχει αυτή η βιτρίνα την άδεια;»* — η **μία** ερώτηση για κριτή, πλήθη και κάρτα: ρητή δήλωση **ή** ειδικότητα που
 * **είναι** η άδεια (§34 Λ3).
 */
export function showcaseHoldsLicence(
  showcase: Pick<PublicShowcase, 'licences' | 'credentials'>,
  licence: ProfessionalLicence,
): boolean {
  if (showcase.licences.some((held) => held.licence === licence)) return true;
  return showcase.credentials.some((credential) => licenceOfCredential(credential, licence) !== null);
}

/**
 * Ο φρουρός του γραφέα (§34 Λ5): ρητή άδεια που η βιτρίνα **ήδη** έχει μέσα από ειδικότητα ⇒ ονομασμένη άρνηση. Δύο
 * δηλώσεις της ίδιας άδειας θα μπορούσαν να διαφωνήσουν (άλλος αριθμός, άλλη ΠΕ) — και κανείς δεν θα ήξερε ποια ισχύει.
 */
export function licenceDeclaredTwice(
  licences: readonly ShowcaseLicence[],
  credentials: readonly ShowcaseCredential[],
): ShowcaseLicenceRejection | null {
  const implied = new Set(licencesHeldThroughCredentials(credentials).map((held) => held.licence));
  return licences.some((declared) => implied.has(declared.licence)) ? 'licence-held-through-occupation' : null;
}
