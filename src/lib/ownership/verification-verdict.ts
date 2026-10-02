/**
 * @module lib/ownership/verification-verdict
 * @description **Ο ΕΝΑΣ κριτής της επαλήθευσης κατοχής** (ADR-900 §3.8) — καθαρή συνάρτηση.
 *
 * Αυτόματο `verified` **ΜΟΝΟ** όταν ισχύουν **όλα**:
 *
 * | # | Κριτήριο | Λόγος αν αποτύχει |
 * |---|---|---|
 * | 1 | σφραγίδα γνήσια, έγγραφο αναλλοίωτο | `seal-invalid` |
 * | 2 | υπογράφων = επιβεβαιωμένο Κτηματολόγιο | `issuer-unconfirmed` |
 * | 3 | ΠΚΑ ≤ {@link CERTIFICATE_MAX_AGE_DAYS} ημερών | `stale-certificate` |
 * | 4 | **ένας** ΚΑΕΚ στο έγγραφο | `kaek-unreadable` |
 * | 5 | δικαιούχοι διαβάστηκαν | `beneficiaries-unreadable` |
 * | 6 | δικαιούχος με **τον ίδιο ΑΦΜ** | `tax-id-absent` / `tax-id-mismatch` |
 * | 7 | **και** ίδιο όνομα (ακριβές ή συνεσταλμένο, ποτέ προσεγγιστικό) | `name-mismatch` |
 * | 8 | ο ΚΑΕΚ δεν είναι επαληθευμένος σε άλλον | `kaek-claimed-elsewhere` |
 * | 9 | ο ΑΦΜ δεν είναι δεμένος σε άλλον | `tax-id-claimed-elsewhere` |
 *
 * Σε κάθε άλλη περίπτωση `pending-review` με **όλους** τους λόγους — ποτέ σιωπηλή έγκριση, ποτέ
 * σιωπηλή απόρριψη. Σχήμα Zillow: ό,τι η μηχανή δεν αποδεικνύει, το κρίνει άνθρωπος.
 *
 * 🔑 **Γιατί ΑΦΜ ΚΑΙ όνομα** (απόφαση Giorgio 2026-10-02): το ΠΚΑ μπορεί να το εκδώσει και **τρίτος**
 * με έννομο συμφέρον — η γνήσια σφραγίδα αποδεικνύει ότι ο **τίτλος** είναι γνήσιος, όχι ότι είναι
 * **δικός σου**. Ο ΑΦΜ είναι ο φυσικός δεσμός (η έκδοση περνά από Taxisnet)· το όνομα είναι η
 * δεύτερη, ανεξάρτητη μαρτυρία· η μοναδικότητα (ένας ΑΦΜ = ένας λογαριασμός) κλείνει την
 * κατάληψη ταυτότητας τρίτου.
 *
 * **Layering**: καθαρή — καμία εισαγωγή Firestore/δικτύου/ρολογιού.
 */

import { MS_PER_DAY } from '@/lib/date-local';
import { personNameMatch } from '@/utils/greek-person-name';
import type { OwnershipReviewReason, OwnershipSealSummary } from '@/types/ownership-verification';

/**
 * Πόσο παλιό ΠΚΑ γίνεται δεκτό αυτόματα. Το ΠΚΑ περιγράφει την κατάσταση **τη στιγμή της έκδοσης**·
 * μια πώληση μετά από αυτή δεν φαίνεται. 90 ημέρες = το ίδιο παράθυρο φρεσκάδας με τη δηλωμένη
 * ζήτηση (`DEMAND_AFFIRMATION_TTL_DAYS`)· παλαιότερο πάει σε άνθρωπο, δεν απορρίπτεται.
 */
export const CERTIFICATE_MAX_AGE_DAYS = 90;

/** Ένας δικαιούχος όπως διαβάστηκε από το ΠΚΑ. Ο ΑΦΜ ήδη προστατευμένος (HMAC). */
export interface ExtractedBeneficiary {
  readonly name: string;
  readonly taxIdHmac: string | null;
}

export interface VerdictInput {
  readonly seal: OwnershipSealSummary;
  readonly kaekCodes: ReadonlyArray<string>;
  readonly beneficiaries: ReadonlyArray<ExtractedBeneficiary>;
  readonly claimant: { readonly legalName: string; readonly taxIdHmac: string };
  /** Ο κάτοχος της κλειδαριάς του ΚΑΕΚ, αν υπάρχει (uid). */
  readonly kaekHolderUid: string | null;
  /** Ο κάτοχος της κλειδαριάς του ΑΦΜ, αν υπάρχει (uid). */
  readonly taxIdHolderUid: string | null;
  readonly uid: string;
  readonly nowIso: string;
}

export interface OwnershipVerdict {
  readonly status: 'verified' | 'pending-review';
  readonly reasons: ReadonlyArray<OwnershipReviewReason>;
  /** Ο ΚΑΕΚ όταν διαβάστηκε **μονοσήμαντα**, αλλιώς `null`. */
  readonly kaek: string | null;
}

function sealReasons(seal: OwnershipSealSummary, nowIso: string): OwnershipReviewReason[] {
  if (seal.kind !== 'valid') return ['seal-invalid'];
  const reasons: OwnershipReviewReason[] = [];
  if (!seal.issuerConfirmed) reasons.push('issuer-unconfirmed');
  const signedMs = seal.signedAt === null ? Number.NaN : Date.parse(seal.signedAt);
  const ageDays = (Date.parse(nowIso) - signedMs) / MS_PER_DAY;
  if (!(ageDays <= CERTIFICATE_MAX_AGE_DAYS)) reasons.push('stale-certificate');
  return reasons;
}

function identityReasons(input: VerdictInput): OwnershipReviewReason[] {
  const { beneficiaries, claimant } = input;
  if (beneficiaries.length === 0) return ['beneficiaries-unreadable'];
  if (beneficiaries.every((beneficiary) => beneficiary.taxIdHmac === null)) return ['tax-id-absent'];

  const sameTaxId = beneficiaries.filter((beneficiary) => beneficiary.taxIdHmac === claimant.taxIdHmac);
  if (sameTaxId.length === 0) return ['tax-id-mismatch'];

  const nameAgrees = sameTaxId.some((beneficiary) => {
    const match = personNameMatch(claimant.legalName, beneficiary.name);
    return match === 'exact' || match === 'abbrev';
  });
  return nameAgrees ? [] : ['name-mismatch'];
}

function claimReasons(input: VerdictInput): OwnershipReviewReason[] {
  const reasons: OwnershipReviewReason[] = [];
  if (input.kaekHolderUid !== null && input.kaekHolderUid !== input.uid) reasons.push('kaek-claimed-elsewhere');
  if (input.taxIdHolderUid !== null && input.taxIdHolderUid !== input.uid) reasons.push('tax-id-claimed-elsewhere');
  return reasons;
}

/** Η κρίση. Ίδια είσοδος ⇒ ίδια κρίση (καθαρή, ιδεμπότητη). */
export function judgeOwnershipVerification(input: VerdictInput): OwnershipVerdict {
  const kaek = input.kaekCodes.length === 1 ? input.kaekCodes[0] : null;
  const reasons: OwnershipReviewReason[] = [
    ...sealReasons(input.seal, input.nowIso),
    ...(kaek === null ? (['kaek-unreadable'] as const) : []),
    ...identityReasons(input),
    ...claimReasons(input),
  ];
  return { status: reasons.length === 0 ? 'verified' : 'pending-review', reasons, kaek };
}
