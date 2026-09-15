/**
 * @fileoverview **ΠΟΙΟ ΟΝΟΜΑ, ΠΟΣΗ ΕΔΡΑ, ΠΟΙΑ ΑΠΟΔΕΙΞΗ** — ο κριτής της νομικής ταυτότητας της βιτρίνας
 * (ADR-841 §7 Α23, Δ5–Δ7). Καθαρός: μηδέν I/O, μηδέν ρολόι.
 * @module lib/agency/showcase-legal-identity
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΜΙΑ ΚΡΙΣΗ, ΤΡΕΙΣ ΚΑΛΟΥΝΤΕΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η δημοσίευση βιτρίνας, η **ανανέωση** μετά από αλλαγή προφίλ / επαλήθευση / κάρτα, και η φόρμα
 * (για την προεπιλογή έδρας) ρωτούν την **ίδια** συνάρτηση. Δεύτερη υλοποίηση στην ανανέωση θα
 * δημοσίευε όνομα που η δημοσίευση θα αρνιόταν.
 *
 * Το «επαληθευμένο» **δεν** ξανακρίνεται εδώ: περνά από το `judgeRegistryIdentity` (Φ2) — ο **ένας**
 * κριτής του ζεύγους προφίλ ⇄ ΓΕΜΗ (ADR-749).
 *
 * | Σειρά | Ερώτηση | Άρνηση |
 * |---|---|---|
 * | 1 | έχει το προφίλ επωνυμία; | `agency-profile-name-missing` |
 * | 2 | είναι ο αριθμός **ενεργή** επιχείρηση στο ΓΕΜΗ; | **καμία εδώ** — `registryClosure` (Φ3.2) |
 * | 3 | ο τίτλος ανήκει στο ΓΕΜΗ **αυτού του αριθμού**; | `agency-profile-title-not-in-registry` |
 * | 4 | επιλέχθηκε έδρα (ή υπάρχει προεπιλογή); | `agency-profile-seat-disclosure-missing` |
 * | 5 | υπάρχει η διεύθυνση που επιλέχθηκε; | `agency-profile-seat-address-missing` |
 *
 * 🔴 **Η ΑΝΕΝΕΡΓΗ ΔΕΝ ΕΙΝΑΙ ΠΙΑ ΑΡΝΗΣΗ ΤΟΥ ΚΡΙΤΗ** (Φ3.2, Απόφαση 1). Η κρίση λέει **τι ισχύει**
 * (`registryClosure`)· η **πολιτική** ανήκει στον καλούντα: η δημοσίευση αρνείται
 * `agency-profile-registry-inactive` (`formLegalShowcase`), η ανανέωση **γράφει** την ετικέτα. Άρνηση
 * εδώ θα έκανε την ανανέωση να σβήνει την ταυτότητα — και ο επισκέπτης δεν θα μάθαινε τίποτα.
 */

import { canonicalGemiNumber } from '@/lib/company/gemi-number';
import { normalizeLegalName, sameLegalName } from '@/lib/company/legal-name-match';
import { isAnswerForNumber, judgeRegistryIdentity } from '@/lib/company/registry-identity-judgment';
import type { AgencyProfileRejection } from '@/services/mandate/agency-profile-verdict';
import type {
  CompanyRegistryDeclaration,
  RegistryCheck,
  RegistryCheckRead,
  RegistryIdentityJudgment,
} from '@/types/company-registry';
import type { ShowcaseStreetLine } from '@/types/showcase-card';
import type {
  CompanySeatDeclaration,
  LegalIdentityAttestation,
  PublicNameChoice,
  RegistryClosure,
  SeatDisclosure,
  ShowcaseLegalDeclaration,
  ShowcaseLegalForm,
  ShowcaseLegalIdentity,
  ShowcaseSeat,
} from '@/types/showcase-legal-identity';

/** Ό,τι χρειάζεται η κρίση — διαβασμένο από τον καλούντα, **μέσα** στη συναλλαγή του. */
export interface LegalIdentityInputs {
  /** `null` = δεν υπάρχει προφίλ. (Το «δεν διαβάστηκε» δεν φτάνει εδώ: ο καλών αποτυγχάνει.) */
  readonly declaration: CompanyRegistryDeclaration | null;
  readonly seat: CompanySeatDeclaration | null;
  readonly stored: RegistryCheckRead;
  /** Η οδός της **έδρας της κάρτας** (Α21.16) — `null` = καμία έδρα ή δημοσιευμένη μόνο περιοχή. */
  readonly headquarters: ShowcaseStreetLine | null;
}

export type LegalIdentityResolution =
  | { readonly identity: ShowcaseLegalIdentity; readonly displayName: string }
  | { readonly reason: AgencyProfileRejection };

const NO_SEAT: CompanySeatDeclaration = { address: null, city: null, postalCode: null };

/**
 * **Η προεπιλογή έδρας** — `full` μόνο για κεφαλαιουχικές εταιρείες.
 *
 * 🔴 Ατομική · ΟΕ · άγνωστη μορφή ⇒ `null`: φυσικά πρόσωπα με απεριόριστη ευθύνη, έδρα συχνά η
 * κατοικία (GDPR άρθ. 25(2)). Άγνωστη μορφή **δεν** μαντεύεται ως ΑΕ.
 */
export function defaultSeatDisclosure(legalForm: ShowcaseLegalForm | null): SeatDisclosure | null {
  return legalForm === 'ae' || legalForm === 'epe' ? 'full' : null;
}

function judgmentOf(declaration: CompanyRegistryDeclaration, stored: RegistryCheckRead): RegistryIdentityJudgment {
  return judgeRegistryIdentity(
    { registrationNumber: declaration.gemiNumber, legalName: declaration.businessName },
    stored,
  );
}

/**
 * Η απάντηση του ΓΕΜΗ **για τον αριθμό του προφίλ** — η αρχή του διακριτικού τίτλου.
 *
 * 🏆 **Ο τίτλος δένεται με τον ΑΡΙΘΜΟ, όχι με την ορθογραφία της επωνυμίας**: οι τίτλοι του μητρώου
 * ανήκουν στην εγγραφή `arGemi`. Μια διαφορά γραφής στην επωνυμία (`name-mismatch`) ρίχνει το σήμα
 * της επωνυμίας, αλλά **δεν** κάνει ψεύτικο τον τίτλο που το ΓΕΜΗ έδωσε για αυτόν τον αριθμό.
 */
function checkForNumber(declaration: CompanyRegistryDeclaration, stored: RegistryCheckRead): RegistryCheck | null {
  if (stored.kind !== 'present') return null;
  return isAnswerForNumber(declaration.gemiNumber, stored.check.record) ? stored.check : null;
}

/** Το κείμενο του ονόματος — ο τίτλος **με την ορθογραφία του μητρώου**, ποτέ του σώματος. */
function publicNameOf(choice: PublicNameChoice, legalName: string, check: RegistryCheck | null): string | null {
  if (choice.kind === 'legal-name') return legalName;
  // ⚠️ Η **κλεισμένη** κρατά τον τίτλο της: ανήκει στην εγγραφή του αριθμού (Google: η κλειστή επιχείρηση
  //    κρατά το όνομά της). Νέα δημοσίευση κλειστής αρνείται αλλού. Μόνο το «άγνωστο» δεν στηρίζει τίτλο.
  if (check === null || check.record.status.activity === 'unknown') return null;
  const wanted = normalizeLegalName(choice.title);
  if (wanted === '') return null;
  return check.record.distinctiveTitles.find((title) => normalizeLegalName(title) === wanted) ?? null;
}

/** Ο δήμος: του **μητρώου** όταν επαληθεύτηκε, αλλιώς η πόλη που δήλωσε το προφίλ. */
function localityOf(inputs: LegalIdentityInputs, judgment: RegistryIdentityJudgment): string | null {
  const registry = judgment.state === 'verified' ? judgment.check.record.seat.municipality?.label.trim() : '';
  return registry || inputs.seat?.city || null;
}

/** Η έδρα **κομμένη στην επιλογή** — ό,τι δεν επιλέχθηκε δεν φτάνει ούτε στο αντικείμενο. */
function seatOf(
  disclosure: SeatDisclosure,
  inputs: LegalIdentityInputs,
  judgment: RegistryIdentityJudgment,
): ShowcaseSeat | null {
  switch (disclosure) {
    case 'full': {
      const { address, city, postalCode } = inputs.seat ?? NO_SEAT;
      return address && city ? { disclosure, streetLine: address, postalCode, locality: city } : null;
    }
    case 'business-address': {
      const street = inputs.headquarters;
      const locality = localityOf(inputs, judgment);
      if (street === null || locality === null) return null;
      const streetLine = `${street.street} ${street.number}`.trim();
      return { disclosure, streetLine, postalCode: street.postalCode.trim() || null, locality };
    }
    case 'municipality': {
      const locality = localityOf(inputs, judgment);
      return locality === null ? null : { disclosure, streetLine: null, postalCode: null, locality };
    }
  }
}

function attestationOf(judgment: RegistryIdentityJudgment): LegalIdentityAttestation {
  return judgment.state === 'verified'
    ? { state: 'verified', issuer: judgment.issuer, checkedAt: judgment.check.checkedAt }
    : { state: 'declared' };
}

/**
 * **Η επωνυμία, με την ορθογραφία της ΑΡΧΗΣ όπου το μητρώο τη στηρίζει** — και στην κλειστή.
 *
 * 🔴 Χωρίς τον δεύτερο κλάδο, το κλείσιμο **άλλαζε το δημόσιο όνομα** («ΠΑΓΩΝΗΣ ΑΝΩΝΥΜΗ ΕΤΑΙΡΕΙΑ» →
 * «ΠΑΓΩΝΗΣ Α.Ε.») και ξανάγραφε κάθε αγγελία — μετρημένο από την άγκυρα Α2α. Το `gapOf` σταματά στο
 * `inactive` πριν συγκρίνει ονόματα, άρα η σύγκριση γίνεται εδώ, με τον **ίδιο** κριτή ονομάτων.
 */
function legalNameOf(businessName: string, judgment: RegistryIdentityJudgment): string {
  if (judgment.state === 'verified') return judgment.check.record.legalName;
  const registry = judgment.gap === 'inactive' ? judgment.check?.record.legalName ?? null : null;
  return registry !== null && sameLegalName(businessName, registry) ? registry : businessName;
}

/** Ανενεργή **για αυτόν τον αριθμό** ⇒ κλείσιμο, με την ημερομηνία της ερώτησης που το είπε. */
function closureOf(judgment: RegistryIdentityJudgment): RegistryClosure | null {
  if (judgment.state !== 'declared' || judgment.gap !== 'inactive' || judgment.check === null) return null;
  return { issuer: 'gemi', checkedAt: judgment.check.checkedAt };
}

/** **Η κρίση.** Επιστρέφει την ταυτότητα **και** το δημόσιο όνομα — ή τον πρώτο ονομασμένο λόγο. */
export function resolveShowcaseLegalIdentity(
  inputs: LegalIdentityInputs,
  choice: ShowcaseLegalDeclaration,
): LegalIdentityResolution {
  const { declaration } = inputs;
  if (declaration === null || declaration.businessName === null) return { reason: 'agency-profile-name-missing' };

  const judgment = judgmentOf(declaration, inputs.stored);
  const legalName = legalNameOf(declaration.businessName, judgment);
  const displayName = publicNameOf(choice.publicName, legalName, checkForNumber(declaration, inputs.stored));
  if (displayName === null) return { reason: 'agency-profile-title-not-in-registry' };

  const disclosure = choice.seatDisclosure ?? defaultSeatDisclosure(declaration.entityType);
  if (disclosure === null) return { reason: 'agency-profile-seat-disclosure-missing' };
  const seat = seatOf(disclosure, inputs, judgment);
  if (seat === null) return { reason: 'agency-profile-seat-address-missing' };

  return {
    displayName,
    identity: {
      publicName: choice.publicName.kind,
      legalName,
      legalForm: declaration.entityType,
      gemiNumber: canonicalGemiNumber(declaration.gemiNumber),
      seat,
      attestation: attestationOf(judgment),
      registryClosure: closureOf(judgment),
    },
  };
}

/**
 * **Η επιλογή που είχε γίνει**, ξαναχτισμένη από αποθηκευμένη ταυτότητα — για την ανανέωση.
 *
 * ⚠️ Ο τίτλος ξαναβγαίνει από το **δημοσιευμένο όνομα**: είναι το μόνο σημείο όπου ζει, και είναι
 * η ορθογραφία του μητρώου τη στιγμή της δημοσίευσης.
 */
export function declarationOfStored(identity: ShowcaseLegalIdentity, displayName: string): ShowcaseLegalDeclaration {
  const publicName: PublicNameChoice =
    identity.publicName === 'legal-name' ? { kind: 'legal-name' } : { kind: 'distinctive-title', title: displayName };
  return { publicName, seatDisclosure: identity.seat.disclosure };
}

/**
 * **Η ανανέωση: ίδια επιλογή, φρέσκες είσοδοι — με ΜΙΑ ονομασμένη υποχώρηση** (Φ3.2).
 *
 * 🔴 **Τίτλος που το ΓΕΜΗ δεν στηρίζει πια ⇒ η ΕΠΩΝΥΜΙΑ.** Αφαιρέθηκε από το μητρώο, άλλαξε ο αριθμός,
 * ή ο αριθμός «δεν υπάρχει»: ο τίτλος θα έμενε δημόσιο όνομα **χωρίς αρχή** — παραπλανητικό ως προς την
 * ταυτότητα. Stripe και Google Business Profile ζητούν δημόσιο όνομα που **ταιριάζει με τα επίσημα
 * στοιχεία**· η Google σε ασυμφωνία **αναστέλλει** τη σελίδα. Εδώ η σελίδα **μένει** με όνομα που είναι
 * πάντα αληθές, και η επιλογή γράφεται `legal-name` — ο τίτλος ξαναμπαίνει μόνο με **ρητή** πράξη.
 *
 * ⚠️ Οι άλλες αρνήσεις (επωνυμία σβήστηκε · διεύθυνση λείπει) **δεν** υποχωρούν: εκεί δεν υπάρχει αληθής
 * εναλλακτική χωρίς επινόηση, άρα η ταυτότητα αποσύρεται (`withheld`).
 */
export function reresolveShowcaseLegalIdentity(
  inputs: LegalIdentityInputs,
  identity: ShowcaseLegalIdentity,
  displayName: string,
): LegalIdentityResolution {
  const stored = declarationOfStored(identity, displayName);
  const resolved = resolveShowcaseLegalIdentity(inputs, stored);
  if (!('reason' in resolved) || resolved.reason !== 'agency-profile-title-not-in-registry') return resolved;
  return resolveShowcaseLegalIdentity(inputs, { ...stored, publicName: { kind: 'legal-name' } });
}
