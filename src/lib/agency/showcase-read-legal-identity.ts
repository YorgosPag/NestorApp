/**
 * @fileoverview **Η ΝΟΜΙΚΗ ΤΑΥΤΟΤΗΤΑ ΣΤΟ ΣΥΝΟΡΟ ΑΝΑΓΝΩΣΗΣ** — ανεκτικός αναγνώστης, αυστηρός γραφέας
 * (ADR-841 §7 Α23, Δ8).
 * @related lib/agency/showcase-read.ts · lib/agency/showcase-legal-identity.ts
 * @module lib/agency/showcase-read-legal-identity
 *
 * 🔴 **`null` = ΠΑΛΙΑ ΒΙΤΡΙΝΑ (πριν την Α23) Ή ΣΚΟΥΠΙΔΙ — και ΔΕΝ σβήνει τη βιτρίνα.** Το έγγραφο το
 * διαβάζει **ανώνυμος**· μια έλλειψη εδώ σημαίνει *«δεν δείχνουμε τίποτα νομικό»*, ποτέ *«μαντεύουμε»*
 * ή *«εξαφανίζουμε το γραφείο»* (CHECK 3.74: καμία εγγραφή μετανάστευσης). Η επόμενη δημοσίευση
 * **απαιτεί** επιλογές.
 *
 * ⛔ **Ποτέ περισσότερη έδρα από όση επιλέχθηκε**: έγγραφο με `municipality` και οδό (χειρόγραφη
 * γραφή, παλιότερος γραφέας) διαβάζεται **χωρίς** οδό. Η προστασία της κατοικίας δεν εξαρτάται από
 * το ότι ο δίσκος είναι καθαρός.
 */

import { COMPANY_ENTITY_TYPES } from '@/subapps/accounting/types/entity';
import { canonicalGemiNumber } from '@/lib/company/gemi-number';
import { text } from '@/lib/agency/showcase-read-primitives';
import {
  isSeatDisclosure,
  PUBLIC_NAME_KINDS,
  type LegalIdentityAttestation,
  type RegistryClosure,
  type ShowcaseLegalIdentity,
  type ShowcaseSeat,
} from '@/types/showcase-legal-identity';

type Loose = Record<string, unknown>;

function isLoose(raw: unknown): raw is Loose {
  return typeof raw === 'object' && raw !== null;
}

function readSeat(raw: unknown): ShowcaseSeat | null {
  if (!isLoose(raw) || !isSeatDisclosure(raw.disclosure)) return null;
  const locality = text(raw.locality);
  if (locality === null) return null;
  if (raw.disclosure === 'municipality') {
    return { disclosure: 'municipality', streetLine: null, postalCode: null, locality };
  }
  const streetLine = text(raw.streetLine);
  // Διεύθυνση που επιλέχθηκε αλλά δεν γράφτηκε δεν είναι έδρα — δεν ζωγραφίζεται μισή.
  if (streetLine === null) return null;
  return { disclosure: raw.disclosure, streetLine, postalCode: text(raw.postalCode), locality };
}

function readAttestation(raw: unknown): LegalIdentityAttestation | null {
  if (!isLoose(raw)) return null;
  if (raw.state === 'declared') return { state: 'declared' };
  if (raw.state !== 'verified' || raw.issuer !== 'gemi') return null;
  const checkedAt = text(raw.checkedAt);
  // 🔴 «Επαληθευμένο» χωρίς ημερομηνία ελέγχου **δεν** δείχνεται — η ημερομηνία είναι μέρος του ισχυρισμού.
  return checkedAt === null ? null : { state: 'verified', issuer: 'gemi', checkedAt };
}

/**
 * Το κλείσιμο (Φ3.2). Απουσία ⇒ `null` (βιτρίνα πριν τη Φ3.2 — καμία μετανάστευση).
 *
 * ⚠️ «Κλειστή» **χωρίς ημερομηνία ή άγνωστη πηγή** ⇒ `null`, ίδιο δόγμα με το «επαληθευμένη»: ισχυρισμός
 * αρχής δεν δείχνεται χωρίς πότε ρωτήθηκε. Το κόστος είναι ορατό και φθηνό: μένει στον κατάλογο μέχρι την
 * επόμενη ανανέωση, που το ξαναγράφει σωστά — ποτέ ετικέτα «κλειστή» σε ζωντανή επιχείρηση από σκουπίδι.
 */
function readRegistryClosure(raw: unknown): RegistryClosure | null {
  if (!isLoose(raw) || raw.issuer !== 'gemi') return null;
  const checkedAt = text(raw.checkedAt);
  return checkedAt === null ? null : { issuer: 'gemi', checkedAt };
}

export function readLegalIdentity(raw: unknown): ShowcaseLegalIdentity | null {
  if (!isLoose(raw)) return null;
  const publicName = PUBLIC_NAME_KINDS.find((kind) => kind === raw.publicName);
  const legalName = text(raw.legalName);
  const seat = readSeat(raw.seat);
  const attestation = readAttestation(raw.attestation);
  if (publicName === undefined || legalName === null || seat === null || attestation === null) return null;
  const registryClosure = readRegistryClosure(raw.registryClosure);
  return {
    publicName,
    legalName,
    legalForm: COMPANY_ENTITY_TYPES.find((form) => form === raw.legalForm) ?? null,
    gemiNumber: canonicalGemiNumber(text(raw.gemiNumber)),
    seat,
    // 🔴 Κλειστή δεν δείχνεται ΠΟΤΕ ως επαληθευμένη — ούτε αν ο δίσκος λέει και τα δύο.
    attestation: registryClosure === null ? attestation : { state: 'declared' },
    registryClosure,
  };
}
