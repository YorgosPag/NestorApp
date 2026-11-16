/**
 * @fileoverview ADR-915 §45.15 (1β-γ) — **τι βεβαίωσε ο ιδιοκτήτης για τους ιδιοκτήτες**, τη στιγμή που ενέκρινε.
 * @related issuance-assignment.ts (`IssuanceDecision.ownerAttestation`) · issuance-request.ts (το σώμα του `approve`) ·
 *   server/issuance-invitations/issuance-link-owners.ts (ο κριτής) · lib/validation/greek-vat-number.ts (ψηφίο ελέγχου)
 * @module lib/document-validity/issuance-owner-attestation
 *
 * 🔑 **Τεκμήριο, όχι δεύτερη πηγή** (DocuSign): ό,τι βεβαιώθηκε μένει στην απόφαση ως στιγμιότυπο. Η τρέχουσα αλήθεια
 *    είναι η επαφή του γραφείου· η διόρθωση **δεν** γράφεται εκεί μόνη της (Salesforce staging — 1β-γ-2).
 * 🔑 **Ο πελάτης λέει μόνο την κρίση του** (`confirmed` · `corrected` + νέο ΑΦΜ). Το «σωστό» ΑΦΜ το συμπληρώνει ο
 *    διακομιστής από την επαφή — ο πελάτης βλέπει μασκαρισμένο το ΑΦΜ τρίτων και **δεν** μπορεί να το ξαναστείλει.
 * 🔑 **Ίδιο σύνολο ή τίποτα**: αν οι ιδιοκτήτες άλλαξαν ανάμεσα στην όψη και την απάντηση ⇒ `owners-changed`, ποτέ
 *    τεκμήριο για πρόσωπα που ο άνθρωπος δεν είδε.
 *
 * **Layering**: leaf, καθαρή — πελάτης και διακομιστής.
 */

import { isValidGreekVat, normalizeVat } from '@/lib/validation/greek-vat-number';

export const OWNER_VERDICTS = ['confirmed', 'corrected'] as const;
export type OwnerVerdict = (typeof OWNER_VERDICTS)[number];

export const OWNER_ATTESTATION_POLICY = {
  /** Όριο πλήθους ιδιοκτητών σε ένα τεκμήριο — φρένο μεγέθους εγγράφου, πολύ πάνω από κάθε πραγματική συνιδιοκτησία. */
  maxOwners: 50,
  /** «Λείπει κάποιος;» — ελεύθερη σημείωση του ιδιοκτήτη προς το γραφείο. */
  missingNoteMax: 500,
  /** Πόσα τελευταία ψηφία δείχνει η μάσκα στο ΑΦΜ τρίτου. */
  maskVisibleDigits: 3,
} as const;

/** Η κρίση του ιδιοκτήτη για ένα πρόσωπο, όπως φεύγει από τη σελίδα. `vatNumber` μόνο για `corrected`. */
export interface OwnerAttestationAnswerEntry {
  readonly contactId: string;
  readonly verdict: OwnerVerdict;
  readonly vatNumber: string | null;
}

export interface OwnerAttestationAnswer {
  readonly owners: readonly OwnerAttestationAnswerEntry[];
  readonly missingNote: string | null;
}

/** Το στιγμιότυπο — **τι** βεβαιώθηκε για κάθε πρόσωπο (`vatNumber: null` = βεβαίωσε το πρόσωπο χωρίς ΑΦΜ). */
export interface OwnerAttestationEntry {
  readonly contactId: string;
  readonly verdict: OwnerVerdict;
  readonly vatNumber: string | null;
}

export interface IssuanceOwnerAttestation {
  readonly owners: readonly OwnerAttestationEntry[];
  readonly missingNote: string | null;
}

export type OwnerAttestationRefusal = 'owners-changed' | 'vat-invalid';

function sameOwnerSet(answer: OwnerAttestationAnswer, current: ReadonlyMap<string, string | null>): boolean {
  const ids = new Set(answer.owners.map((owner) => owner.contactId));
  return ids.size === answer.owners.length && ids.size === current.size && [...ids].every((id) => current.has(id));
}

/** Μία κρίση → μία γραμμή στιγμιοτύπου. Διόρθωση ίση με το τρέχον ΑΦΜ = επιβεβαίωση (καμία ψεύτικη απόκλιση). */
function entryOf(owner: OwnerAttestationAnswerEntry, currentVat: string | null): OwnerAttestationEntry | 'vat-invalid' {
  if (owner.verdict === 'confirmed') return { contactId: owner.contactId, verdict: 'confirmed', vatNumber: currentVat };
  if (owner.vatNumber === null || !isValidGreekVat(owner.vatNumber)) return 'vat-invalid';
  const vatNumber = normalizeVat(owner.vatNumber);
  // Και οι δύο πλευρές κανονικοποιημένες: «090 000 045» στην επαφή ≡ «090000045» από τη σελίδα.
  return sameVat(vatNumber, currentVat)
    ? { contactId: owner.contactId, verdict: 'confirmed', vatNumber }
    : { contactId: owner.contactId, verdict: 'corrected', vatNumber };
}

/**
 * Η κρίση του πελάτη + τα τρέχοντα ΑΦΜ των ιδιοκτητών (κατά τον αναγνώστη του μητρώου) ⇒ το στιγμιότυπο, ή γιατί όχι.
 * Η σειρά του στιγμιοτύπου ακολουθεί τη σειρά του `current` (του μητρώου), όχι του πελάτη.
 */
export function ownerAttestationOf(
  answer: OwnerAttestationAnswer,
  current: ReadonlyMap<string, string | null>,
): IssuanceOwnerAttestation | OwnerAttestationRefusal {
  if (!sameOwnerSet(answer, current)) return 'owners-changed';
  const byId = new Map(answer.owners.map((owner) => [owner.contactId, owner]));
  const owners: OwnerAttestationEntry[] = [];
  for (const [contactId, currentVat] of current) {
    const answered = byId.get(contactId);
    if (answered === undefined) return 'owners-changed';
    const entry = entryOf(answered, currentVat);
    if (entry === 'vat-invalid') return entry;
    owners.push(entry);
  }
  const missingNote = answer.missingNote?.trim() || null;
  return { owners, missingNote };
}

/** Ίδιο ΑΦΜ; — κανονικοποιημένα και τα δύο (`null` ≠ οτιδήποτε). */
export function sameVat(a: string | null, b: string | null): boolean {
  return a !== null && b !== null && normalizeVat(a) === normalizeVat(b);
}

/**
 * 1β-γ-2 — **οι εκκρεμείς διορθώσεις**: όσα ΑΦΜ διόρθωσε ο ιδιοκτήτης και **δεν** έχει ακόμη η επαφή. **Παράγεται**, δεν
 * αποθηκεύεται: μόλις το γραφείο εφαρμόσει τη διόρθωση, σβήνει μόνη της (Salesforce staging).
 * `currentVatOf` → `undefined` = η επαφή δεν διαβάστηκε τώρα ⇒ **καμία** κρίση (ποτέ ψεύτικη εκκρεμότητα).
 */
export function pendingVatCorrectionsOf(
  attestation: IssuanceOwnerAttestation | null,
  currentVatOf: (contactId: string) => string | null | undefined,
): readonly OwnerAttestationEntry[] {
  if (attestation === null) return [];
  return attestation.owners.filter((owner) => {
    if (owner.verdict !== 'corrected') return false;
    const current = currentVatOf(owner.contactId);
    return current !== undefined && !sameVat(owner.vatNumber, current);
  });
}

/** Το ΑΦΜ τρίτου στη σελίδα του ιδιοκτήτη: μόνο τα τελευταία ψηφία (ιδιωτικότητα εκ σχεδιασμού). */
export function maskedVatTail(vatNumber: string): string {
  return normalizeVat(vatNumber).slice(-OWNER_ATTESTATION_POLICY.maskVisibleDigits);
}
