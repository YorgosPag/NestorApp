/**
 * @fileoverview **ΤΑ ΠΑΓΩΜΕΝΑ ΑΠΟΔΕΙΚΤΙΚΑ ΜΙΑΣ ΕΝΤΟΛΗΣ** — πού ζουν, ποια είναι, πώς τα βλέπει η οθόνη (ADR-864 §19).
 * @related services/mandate/attestation-evidence.ts · services/mandate/mandate-evidence-access.ts ·
 *   lib/mandate/private-marketing-panel.ts · lib/storage/storage-path-custody.ts · storage.rules
 * @module lib/mandate/mandate-evidence
 *
 * 🔑 Η ρίζα είναι **`server-only`** στο `storage.rules` (`allow read, write: if false`) και στον κριτή
 * θεματοφυλακής: **κανένας** client — ούτε το γραφείο που ανέβασε το πρωτότυπο, ούτε ο super admin — δεν
 * διαβάζει ή σβήνει. Η μόνη πρόσβαση είναι ο διακομιστής, **αφού** κρίνει ότι ο καλών είναι μέρος της εντολής.
 *
 * 🔑 **Δύο σημεία όπου γεννιέται αποδεικτικό**, μία απαρίθμηση: η βεβαίωση **εντολής** (`mandate.proof`) και
 * κάθε **έντυπο συναίνεσης** (`granted.proof`). Ο κριτής πρόσβασης και το πάνελ διαβάζουν **αυτή** τη συνάρτηση —
 * δεύτερη απαρίθμηση θα άφηνε αποδεικτικό που η οθόνη δείχνει αλλά η λήψη αρνείται (ή το αντίστροφο).
 *
 * **Layering**: leaf — καθαρές συναρτήσεις· ο browser τις εισάγει (καμία διαδρομή δεν φεύγει μέσω του {@link EvidenceView}).
 */

import { privateMarketingEventsOf } from '@/lib/mandate/private-marketing-standing';
import type { AttestationEvidence, BrokeredListingMandate, MandateProof } from '@/types/owner-property-mandate';
import { AGENCY_ATTESTATION } from '@/types/owner-property-mandate';

/** Η ρίζα στο bucket — καθρέφτης του μπλοκ `match /mandate-evidence/…` του `storage.rules`. */
export const MANDATE_EVIDENCE_ROOT = 'mandate-evidence';

/** `mandate-evidence/{ownerPropertyId}/{evidenceId}` — χωρίς επέκταση: τύπος στο metadata, όνομα στην απόδειξη. */
export function attestationEvidencePath(ownerPropertyId: string, evidenceId: string): string {
  return `${MANDATE_EVIDENCE_ROOT}/${ownerPropertyId}/${evidenceId}`;
}

/**
 * Η αντίστροφη του {@link attestationEvidencePath} — `null` για ό,τι δεν έχει **ακριβώς** το σχήμα της ρίζας.
 * Τη χρειάζεται η σάρωση του bucket (υιοθεσία, ADR-864 §20), όπου το μόνο που υπάρχει είναι το όνομα.
 */
export function parseEvidencePath(path: string): { readonly ownerPropertyId: string; readonly evidenceId: string } | null {
  const [root, ownerPropertyId, evidenceId, ...rest] = path.split('/');
  if (root !== MANDATE_EVIDENCE_ROOT || !ownerPropertyId || !evidenceId || rest.length > 0) return null;
  return { ownerPropertyId, evidenceId };
}

/** Το ακίνητο ενός αποδεικτικού, από τη διαδρομή που **ο ίδιος** ο διακομιστής έγραψε. */
export function ownerPropertyIdOfEvidencePath(path: string): string {
  const parsed = parseEvidencePath(path);
  if (parsed === null) throw new Error(`Not a mandate evidence path: ${path}`);
  return parsed.ownerPropertyId;
}

/** Το αντίγραφο μιας απόδειξης — `null` όταν η απόδειξη δεν έχει (συγκατάθεση · βεβαίωση χωρίς έντυπο). */
export function evidenceOfProof(proof: MandateProof): AttestationEvidence | null {
  return proof.via === AGENCY_ATTESTATION ? (proof.evidence ?? null) : null;
}

/** **Κάθε** αποδεικτικό της εντολής, με τη σειρά που γεννήθηκε: πρώτα της εντολής, μετά των συναινέσεων. */
export function evidencesOfMandate(mandate: BrokeredListingMandate): readonly AttestationEvidence[] {
  const fromConsents = privateMarketingEventsOf(mandate).flatMap((event) =>
    event.kind === 'granted' ? [evidenceOfProof(event.proof)] : [],
  );
  return [evidenceOfProof(mandate.proof), ...fromConsents].filter((evidence): evidence is AttestationEvidence => evidence !== null);
}

/** Ό,τι φτάνει στην οθόνη — **χωρίς** διαδρομή αποθήκευσης (Α33). */
export interface EvidenceView {
  readonly id: string;
  readonly fileName: string;
  /** `sha256:…` — ο ιδιοκτήτης το συγκρίνει με το αρχείο που κατέβασε. */
  readonly digest: string;
  /**
   * ISO — η **κλειδωμένη** ημερομηνία διατήρησης (ADR-864 §20)· `null` όσο ζει η σχέση (ή πριν το μητρώο το δει):
   * τότε η οθόνη λέει τον **κανόνα**, όχι ημερομηνία που δεν υπάρχει ακόμη.
   */
  readonly retainUntil: string | null;
  /** ISO — πότε **διατέθηκε** (τα bytes σβήστηκαν, το αποτύπωμα μένει)· `null` όσο υπάρχει. */
  readonly disposedAt: string | null;
}

/** Ό,τι λέει το μητρώο για ένα αποδεικτικό στην οθόνη. */
export interface EvidenceRetentionView {
  readonly retainUntil: string | null;
  readonly disposedAt: string | null;
}

/** @param retentionById — από το μητρώο (`services/mandate/evidence-registry.ts`)· απουσία ⇒ ο κανόνας, χωρίς ημερομηνίες. */
export function evidenceViewOf(evidence: AttestationEvidence, retentionById: ReadonlyMap<string, EvidenceRetentionView> = new Map()): EvidenceView {
  const retention = retentionById.get(evidence.id);
  return {
    id: evidence.id,
    fileName: evidence.fileName,
    digest: evidence.digest,
    retainUntil: retention?.retainUntil ?? null,
    disposedAt: retention?.disposedAt ?? null,
  };
}
