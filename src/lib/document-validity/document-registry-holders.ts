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
 *  - **§25 (5γ) — ανά πρόσωπο**: η ομάδα της Α5 είναι (ακίνητο, είδος, **πρόσωπο**)· η ενημερότητα του Α κρατά **μόνο**
 *    τη γραμμή του Α. Έγγραφο **χωρίς** πρόσωπο (αρχείο στο ακίνητο) κρατά απαίτηση προσώπου **μόνο** όταν δεν υπάρχει
 *    αμφισημία — ένα πρόσωπο για αυτό το (ακίνητο, είδος). Με δύο συμπωλητές: κανένα, και φαίνεται «λείπει» και στους
 *    δύο, αντί να «καλύψει» κάποιον στην τύχη (ίδιο δόγμα με §22.6 Ε4).
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
  withPartySuffix,
  type DocumentRequirement,
  type RequirementParty,
  type TrackedDocument,
} from '@/lib/document-validity/document-requirement';

/** Η ομάδα (ακίνητο, είδος) **χωρίς** πρόσωπο — η βάση κάθε κλειδιού ομάδας. */
const groupBaseOf = (propertyId: string, kind: DocumentKind): string => `${propertyId}:${kind}`;

/** Η ομάδα της Α5: (ακίνητο, είδος, πρόσωπο) — έγγραφο χωρίς ακίνητο είναι μόνο του. */
export function registryGroupKeyOf(document: Pick<RegistryDocument, 'id' | 'kind' | 'propertyId' | 'party'>): string {
  return document.propertyId === null
    ? `solo:${document.id}`
    : withPartySuffix(groupBaseOf(document.propertyId, document.kind), document.party);
}

/** Το αρχείο του εγγράφου, αν έχει — για τον ρητό δεσμό της βεβαίωσης. */
export function registryFileIdOf(document: RegistryDocument): string | null {
  return document.origin.kind === 'declared' ? null : document.origin.fileId;
}

/** Το έγγραφο όπως το ρωτά ο κριτής κάλυψης και το «τι σταματά». */
export function trackedDocumentOf(document: RegistryDocument, expiresOn: string | null): TrackedDocument {
  return {
    kind: document.kind,
    subject: document.propertyId === null ? null : { propertyId: document.propertyId, party: document.party },
    fileId: registryFileIdOf(document),
    expiresOn,
  };
}

// =============================================================================
// Ε8 — ΒΕΒΑΙΩΣΕΙΣ ΠΟΥ ΔΕΝ ΕΙΝΑΙ ΑΚΟΜΗ ΓΡΑΜΜΗ
// =============================================================================

/**
 * «Το ίδιο έγγραφο»: ίδιο ακίνητο, ίδιο είδος, **ίδιο πρόσωπο** (§25), ίδια ημερομηνία έκδοσης. Χωρίς έκδοση δεν
 * ταυτοποιείται. Χωρίς το πρόσωπο, δύο συμπωλητές με ενημερότητα της ίδιας μέρας θα γίνονταν **μία** γραμμή.
 */
const sameDocumentKey = (
  propertyId: string,
  kind: DocumentKind,
  party: RequirementParty | null,
  issuedOn: string | null,
): string | null => (issuedOn === null ? null : `${withPartySuffix(groupBaseOf(propertyId, kind), party)}:${issuedOn}`);

function attestedDocumentOf(requirement: DocumentRequirement, caseId: string): RegistryDocument {
  const attestation = requirement.attestation;
  return {
    // §25 — με το πρόσωπο: δύο συμπωλητές στην ίδια υπόθεση είναι δύο γραμμές, όχι μία ταυτότητα που συγκρούεται.
    id: withPartySuffix(`attested:${caseId}:${requirement.documentKind}`, requirement.subject.party),
    kind: requirement.documentKind,
    propertyId: requirement.subject.propertyId,
    party: requirement.subject.party,
    origin: { kind: 'attested', caseId, fileId: attestation?.fileId ?? null },
    issuedOn: attestation?.issuedOn ?? null,
    printedValidUntil: attestation?.printedValidUntil ?? null,
    // Η έγκριση μεταβίβασης δεν δηλώνει κατάταξη (κανένα είδος του καταλόγου δεν κατατάσσεται, ADR-915 §32).
    classification: null,
    source: null,
    pinned: false,
  };
}

/**
 * Αρχείο **χωρίς στοιχεία** (ADR-915 §33): καμία προέλευση **και** καμία ημερομηνία. Η δεύτερη συνθήκη είναι ζώνη
 * ασφαλείας — μια γραμμή που κρατά έστω μία ημερομηνία δεν υποχωρεί ποτέ, όπως κι αν έφτασε εδώ.
 */
const isUndeclaredFile = (document: RegistryDocument): boolean =>
  document.origin.kind === 'file' && document.source === null && document.issuedOn === null && document.printedValidUntil === null;

/**
 * ADR-915 §33 Δ5 — **η γραμμή «χωρίς στοιχεία» υποχωρεί** σε ό,τι ήδη ξέρουμε για το ίδιο αρχείο. Αρχείο χωρίς γεγονότα
 * που ενέκρινε ελεγκτής μεταβίβασης (`attestation.fileId`) **δεν** γίνεται δική του γραμμή: αλλιώς η βεβαίωση θα δενόταν
 * πάνω του (Ε9) και η ημερομηνία του ελεγκτή θα χανόταν πίσω από ένα «χωρίς στοιχεία». Τη γραμμή την κάνει η Ε8.
 */
export function withoutYieldingUndeclared(
  documents: readonly RegistryDocument[],
  requirements: readonly DocumentRequirement[],
): readonly RegistryDocument[] {
  const attestedFileIds = new Set<string>();
  for (const { attestation, process } of requirements) {
    if (attestation === null || attestation.fileId === null || process.kind !== 'conveyance') continue;
    attestedFileIds.add(attestation.fileId);
  }
  return documents.filter((document) =>
    !(isUndeclaredFile(document) && document.origin.kind === 'file' && attestedFileIds.has(document.origin.fileId)));
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
  const known = new Set(documents.map((d) => (d.propertyId === null ? null : sameDocumentKey(d.propertyId, d.kind, d.party, d.issuedOn))));
  const attested: RegistryDocument[] = [];
  for (const requirement of requirements) {
    const { attestation, process } = requirement;
    if (attestation === null || process.kind !== 'conveyance') continue;
    if (attestation.fileId !== null && fileIds.has(attestation.fileId)) continue;
    const { propertyId, party } = requirement.subject;
    const key = sameDocumentKey(propertyId, requirement.documentKind, party, attestation.issuedOn);
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

/** (ακίνητο, είδος) → πόσα **διαφορετικά** πρόσωπα το ζητούν — η αμφισημία του εγγράφου χωρίς πρόσωπο (§25). */
function partiesPerGroup(requirements: readonly DocumentRequirement[]): ReadonlyMap<string, number> {
  const parties = new Map<string, Set<string>>();
  for (const { subject, documentKind } of requirements) {
    if (subject.party === null) continue;
    const base = groupBaseOf(subject.propertyId, documentKind);
    parties.set(base, (parties.get(base) ?? new Set<string>()).add(subject.party.key));
  }
  return new Map([...parties].map(([base, keys]) => [base, keys.size]));
}

interface HolderIndex {
  readonly byFile: ReadonlyMap<string, RegistryDocument>;
  readonly byGroup: ReadonlyMap<string, RegistryDocument>;
  readonly parties: ReadonlyMap<string, number>;
}

/**
 * Ο κάτοχος: ανάμεσα στους υποψήφιους που **καλύπτουν** την απαίτηση, πρώτα το ρητά εγκεκριμένο αρχείο, μετά το
 * έγγραφο **του ίδιου προσώπου**, τελευταίο το έγγραφο χωρίς πρόσωπο — μόνο όταν το πρόσωπο είναι **ένα** (§25).
 */
function holderOf(requirement: DocumentRequirement, { byFile, byGroup, parties }: HolderIndex): RegistryDocument | undefined {
  const fileId = requirement.attestation?.fileId ?? null;
  const base = groupBaseOf(requirement.subject.propertyId, requirement.documentKind);
  const unambiguous = requirement.subject.party === null || parties.get(base) === 1;
  const candidates = [
    fileId === null ? undefined : byFile.get(fileId),
    byGroup.get(withPartySuffix(base, requirement.subject.party)),
    unambiguous ? byGroup.get(base) : undefined,
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
  const index: HolderIndex = { byFile, byGroup, parties: partiesPerGroup(requirements) };
  const held = new Map<string, DocumentRequirement[]>();
  const unheld: DocumentRequirement[] = [];
  for (const requirement of requirements) {
    const holder = holderOf(requirement, index);
    if (holder === undefined) unheld.push(requirement);
    else held.set(holder.id, [...(held.get(holder.id) ?? []), requirement]);
  }
  return { held, unheld };
}
