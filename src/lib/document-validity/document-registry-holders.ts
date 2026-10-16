/**
 * =============================================================================
 * Μητρώο λήξεων — ΠΟΙΟ έγγραφο κρατά κάθε απαίτηση (ADR-915 Φ4δ · Ε8 · Ε9)
 * =============================================================================
 *
 * Κάθε απαίτηση (μεταβίβαση · αγγελία) έχει **ακριβώς έναν** κάτοχο — το έγγραφο που θα την αφήσει χωρίς έγκυρο αν
 * λήξει — **ή κανέναν**, και τότε το έγγραφο **λείπει**. Ποτέ δύο: μια υπόθεση που μετρά κάτω από δύο γραμμές θα έλεγε
 * «μπλοκάρει» δύο φορές· και ποτέ σιωπηλά κανένας: απαίτηση χωρίς κάτοχο είναι το «λείπει» του Street.
 *
 *  - **Ε8 — η βεβαίωση είναι έγγραφο**: ο επαγγελματίας ενέκρινε έγγραφο στον έλεγχο (`attestation`). Αν το αρχείο του
 *    δεν είναι ήδη γραμμή (παραλαβή εκτός πλατφόρμας · αρχείο χωρίς γεγονότα), γίνεται γραμμή `attested` με την έκδοση
 *    του ελεγκτή — ίδια εφεδρεία με τον κατάλογο. Χωρίς αυτό, η ταυτότητα κτιρίου (ικανοποιείται **μόνο** εκτός
 *    πλατφόρμας) θα «έλειπε» από κάθε υπόθεση, ακόμη κι αφού εγκρίθηκε.
 *  - **Ε9 — ο κάτοχος**: ανάμεσα στα **τρέχοντα** έγγραφα (Α5) που την καλύπτουν (`requirementCoveredBy`, ο ΕΝΑΣ
 *    κριτής), νικά το αρχείο που ενέκρινε ρητά ο επαγγελματίας — αυτό κρίνει και ο κατάλογος της υπόθεσης. Έτσι ένα ΠΕΑ
 *    επιπέδου **έργου** (Δ3) κρατά τις υποθέσεις που το ενέκριναν, σε **μία** γραμμή, όσα ακίνητα κι αν αφορούν.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O, μηδέν ρολόι. Μόνο **τύποι** από το `document-registry` (κανένας
 * κύκλος εκτέλεσης).
 *
 * @module lib/document-validity/document-registry-holders
 */

import type { DocumentKind } from '@/config/document-validity/document-validity';
import type { RegistryDocument } from '@/lib/document-validity/document-registry';
import {
  requirementCoveredBy,
  type DocumentRequirement,
  type TrackedDocument,
} from '@/lib/document-validity/document-requirement';

/** Η ομάδα της Α5: (ακίνητο, είδος) — έγγραφο χωρίς ακίνητο είναι μόνο του. */
export function registryGroupKeyOf(document: Pick<RegistryDocument, 'id' | 'kind' | 'propertyId'>): string {
  return document.propertyId === null ? `solo:${document.id}` : `${document.propertyId}:${document.kind}`;
}

/** Το αρχείο του εγγράφου, αν έχει — για τον ρητό δεσμό της βεβαίωσης. */
export function registryFileIdOf(document: RegistryDocument): string | null {
  return document.origin.kind === 'declared' ? null : document.origin.fileId;
}

/** Το έγγραφο όπως το ρωτά ο κριτής κάλυψης και το «τι σταματά». */
export function trackedDocumentOf(document: RegistryDocument, expiresOn: string | null): TrackedDocument {
  return {
    kind: document.kind,
    subject: document.propertyId === null ? null : { propertyId: document.propertyId },
    fileId: registryFileIdOf(document),
    expiresOn,
  };
}

// =============================================================================
// Ε8 — ΒΕΒΑΙΩΣΕΙΣ ΠΟΥ ΔΕΝ ΕΙΝΑΙ ΑΚΟΜΗ ΓΡΑΜΜΗ
// =============================================================================

/** «Το ίδιο έγγραφο»: ίδιο ακίνητο, ίδιο είδος, ίδια ημερομηνία έκδοσης. Χωρίς έκδοση δεν ταυτοποιείται. */
const sameDocumentKey = (propertyId: string, kind: DocumentKind, issuedOn: string | null): string | null =>
  issuedOn === null ? null : `${propertyId}:${kind}:${issuedOn}`;

function attestedDocumentOf(requirement: DocumentRequirement, caseId: string): RegistryDocument {
  const attestation = requirement.attestation;
  return {
    id: `attested:${caseId}:${requirement.documentKind}`,
    kind: requirement.documentKind,
    propertyId: requirement.subject.propertyId,
    origin: { kind: 'attested', caseId, fileId: attestation?.fileId ?? null },
    issuedOn: attestation?.issuedOn ?? null,
    printedValidUntil: attestation?.printedValidUntil ?? null,
    source: null,
    pinned: false,
  };
}

/**
 * Οι εγκεκριμένες βεβαιώσεις που **δεν** είναι ήδη γραμμή. Αρχείο που είναι γραμμή ⇒ δεσμός (Ε9), όχι δεύτερη γραμμή·
 * ίδιο έγγραφο ήδη γνωστό στο ίδιο ακίνητο (ίδια έκδοση) ⇒ τίποτα.
 */
export function attestedDocumentsOf(
  documents: readonly RegistryDocument[],
  requirements: readonly DocumentRequirement[],
): readonly RegistryDocument[] {
  const fileIds = new Set(documents.map(registryFileIdOf).filter((id): id is string => id !== null));
  const known = new Set(documents.map((d) => (d.propertyId === null ? null : sameDocumentKey(d.propertyId, d.kind, d.issuedOn))));
  const attested: RegistryDocument[] = [];
  for (const requirement of requirements) {
    const { attestation, process } = requirement;
    if (attestation === null || process.kind !== 'conveyance') continue;
    if (attestation.fileId !== null && fileIds.has(attestation.fileId)) continue;
    const key = sameDocumentKey(requirement.subject.propertyId, requirement.documentKind, attestation.issuedOn);
    if (key !== null && known.has(key)) continue;
    attested.push(attestedDocumentOf(requirement, process.caseId));
    // Δύο υποθέσεις που ενέκριναν το ΙΔΙΟ αρχείο ή το ίδιο έγγραφο ⇒ μία γραμμή· η δεύτερη το βρίσκει ως κάτοχο.
    known.add(key);
    if (attestation.fileId !== null) fileIds.add(attestation.fileId);
  }
  return attested;
}

// =============================================================================
// Ε9 — Ο ΚΑΤΟΧΟΣ ΚΑΘΕ ΑΠΑΙΤΗΣΗΣ
// =============================================================================

export interface RequirementHolders {
  /** `id` τρέχοντος εγγράφου → οι απαιτήσεις που κρατά. */
  readonly held: ReadonlyMap<string, readonly DocumentRequirement[]>;
  /** Απαιτήσεις **χωρίς** κάτοχο — το υλικό του «λείπει». */
  readonly unheld: readonly DocumentRequirement[];
}

/** Ο κάτοχος: ανάμεσα στους υποψήφιους που **καλύπτουν** την απαίτηση, πρώτα το ρητά εγκεκριμένο αρχείο. */
function holderOf(
  requirement: DocumentRequirement,
  byFile: ReadonlyMap<string, RegistryDocument>,
  byGroup: ReadonlyMap<string, RegistryDocument>,
): RegistryDocument | undefined {
  const fileId = requirement.attestation?.fileId ?? null;
  const candidates = [
    fileId === null ? undefined : byFile.get(fileId),
    byGroup.get(`${requirement.subject.propertyId}:${requirement.documentKind}`),
  ];
  return candidates.find((candidate): candidate is RegistryDocument =>
    candidate !== undefined && requirementCoveredBy(trackedDocumentOf(candidate, null), requirement));
}

/**
 * **Ποιο έγγραφο κρατά κάθε απαίτηση** — μόνο **τρέχοντα** έγγραφα (`current`: `id` → `id` του τρέχοντος της ομάδας
 * του, Α5). Αντικατεστημένο αρχείο που ενέκρινε κάποτε ο ελεγκτής **δεν** κρατά τίποτα: το κουβαλά η τρέχουσα γραμμή.
 */
export function requirementHolders(
  documents: readonly RegistryDocument[],
  current: ReadonlyMap<string, string>,
  requirements: readonly DocumentRequirement[],
): RequirementHolders {
  const live = documents.filter((document) => (current.get(document.id) ?? document.id) === document.id);
  const byFile = new Map(live.flatMap((d) => { const id = registryFileIdOf(d); return id === null ? [] : [[id, d] as const]; }));
  const byGroup = new Map(live.filter((d) => d.propertyId !== null).map((d) => [registryGroupKeyOf(d), d] as const));
  const held = new Map<string, DocumentRequirement[]>();
  const unheld: DocumentRequirement[] = [];
  for (const requirement of requirements) {
    const holder = holderOf(requirement, byFile, byGroup);
    if (holder === undefined) unheld.push(requirement);
    else held.set(holder.id, [...(held.get(holder.id) ?? []), requirement]);
  }
  return { held, unheld };
}
