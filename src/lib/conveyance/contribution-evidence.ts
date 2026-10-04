/**
 * =============================================================================
 * Conveyance — transmittals → τεκμήρια (ADR-901 Φ4.4 · άγκυρες Α23 · Α24)
 * =============================================================================
 *
 * `αποστολές της υπόθεσης + ενεργοί συντάκτες τώρα + κατάσταση αρχείων + θεατής → τεκμήρια του θεατή`
 *
 * 1. **Ζωντανή** = όχι αποσυρμένη **και** ο συντάκτης έχει ενεργή συμμετοχή **τώρα** με τον **ίδιο** ρόλο
 *    (αντικατάσταση συμβολαιογράφου ⇒ τα δικά του παύουν να μετράνε· το ίχνος μένει).
 * 2. Ανά (συντάκτης, γραμμή) μετρά **η νεότερη** ζωντανή — η παλαιότερη μένει αποδείξιμη στο ίχνος, όχι τεκμήριο.
 * 3. **Ακροατήριο** από τον ρόλο — ή, για έγγραφο πελάτη, από την κλάση του εγγράφου (`reachesViewer`) — Α23 · Π2
 * 4. Το αρχείο πρέπει να υπάρχει, να ανήκει στον συντάκτη και να έχει bytes. Ο **κάδος** του συντάκτη **δεν**
 *    κόβει (σιωπηλή δέσμευση· κάδος ≠ απόσυρση)· η **απόσυρση** κόβει.
 *
 * 🔑 Α24 **δομικά**: η μόνη είσοδος είναι οι **αποστολές** — καμία συνάρτηση εδώ δεν δέχεται «τα αρχεία του
 * επαγγελματία». Πρόχειρο χωρίς αποστολή δεν έχει από πού να μπει.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις· τα δεδομένα τα φέρνει `conveyance-contribution-evidence.server.ts`.
 *
 * @module lib/conveyance/contribution-evidence
 */

import { ENTITY_TYPES } from '@/config/domain-constants';
import { findEntryPoint } from '@/config/upload-entry-points/queries';
import type { ConveyanceContribution } from '@/types/conveyance-contribution';
import type { EvidenceFile, EvidenceSource, NewerVersion, SealedDelivery } from '@/types/conveyance-case';
import type { LegalProfessionalRole } from '@/types/legal-contracts';
import {
  audienceOfTransmittal,
  reachesViewer,
  sentOnBehalf,
  type AudienceQuestion,
  type CaseViewerRole,
} from './contribution-audience';
import { viewerSeesItem } from './derive-checklist';

/** Ένας ενεργός **τώρα** συντάκτης: ο άνθρωπος με τον ρόλο της ενεργής του συμμετοχής. */
export interface ActiveContributor {
  readonly uid: string;
  readonly role: LegalProfessionalRole;
}

/** Η κατάσταση του προσωπικού αρχείου, όπως τη διάβασε ο server **τώρα**. */
export interface ContributedFileState {
  readonly fileId: string;
  readonly ownerUid: string;
  /** Έχει bytes (`storagePath`) — η απώλειά τους είναι το μόνο που κάνει μια σταλμένη έκδοση μη ανοίξιμη. */
  readonly hasBytes: boolean;
}

interface ContributionEvidenceInput {
  readonly contributions: readonly ConveyanceContribution[];
  readonly activeContributors: readonly ActiveContributor[];
  readonly files: ReadonlyMap<string, ContributedFileState>;
  readonly viewer: CaseViewerRole;
  /** Το uid του θεατή (`null` = οικοδεσπότης ως χώρος) — μόνο για το `own`. */
  readonly viewerUid: string | null;
  /**
   * Φ4.5 — νεότερη έτοιμη έκδοση ανά `contributionId`, **μόνο** για αποστολές του θεατή (τη φέρνει ο server).
   * Διαβάζεται **αποκλειστικά** στον κλάδο `own: true` — εγγραφή για ξένη αποστολή αγνοείται (Α28).
   */
  readonly newerVersions?: ReadonlyMap<string, NewerVersion>;
}

function isLive(c: ConveyanceContribution, active: readonly ActiveContributor[]): boolean {
  return c.withdrawnAt === null && active.some((a) => a.uid === c.authorUid && a.role === c.authorRole);
}

/** Η νεότερη ζωντανή αποστολή ανά (συντάκτης, γραμμή). */
export function currentContributions(
  contributions: readonly ConveyanceContribution[],
  active: readonly ActiveContributor[],
): readonly ConveyanceContribution[] {
  const latest = new Map<string, ConveyanceContribution>();
  for (const c of contributions) {
    if (!isLive(c, active)) continue;
    const key = `${c.authorUid}|${c.checklistItemId}`;
    const held = latest.get(key);
    if (!held || held.issuedAt < c.issuedAt) latest.set(key, c);
  }
  return [...latest.values()];
}

/** Η προέλευση — ο κλάδος `own: true` είναι ο **μόνος** που μπορεί να κουβαλά `newerVersion` (Α28). */
function sourceOf(c: ConveyanceContribution, audience: AudienceQuestion, input: ContributionEvidenceInput): EvidenceSource {
  const base = { kind: 'transmittal', contributionId: c.id, authorRole: c.authorRole, onBehalf: sentOnBehalf(audience.item) } as const;
  if (input.viewerUid === null || input.viewerUid !== c.authorUid) return { ...base, own: false };
  return { ...base, own: true, newerVersion: input.newerVersions?.get(c.id) ?? null };
}

function toEvidence({ contribution: c, audience }: DeliveredTransmittal, input: ContributionEvidenceInput): EvidenceFile | null {
  const entryPoint = findEntryPoint(ENTITY_TYPES.CONVEYANCE_CASE, c.entryPointId);
  if (!entryPoint) return null;
  return {
    source: sourceOf(c, audience, input),
    fileId: c.file.fileId,
    displayName: c.file.displayName,
    entityType: ENTITY_TYPES.CONVEYANCE_CASE,
    entityId: c.caseId,
    purpose: entryPoint.purpose,
    level: 'contribution',
    fingerprint: c.file.fingerprint,
    createdAt: c.issuedAt,
  };
}

/** Μια τρέχουσα αποστολή που **παραδόθηκε** (έγκυρο αρχείο του συντάκτη), με την ερώτηση ακροατηρίου της. */
interface DeliveredTransmittal {
  readonly contribution: ConveyanceContribution;
  readonly audience: AudienceQuestion;
}

type DeliveryInput = Pick<ContributionEvidenceInput, 'contributions' | 'activeContributors' | 'files'>;

/**
 * Κανόνες 1, 2 και 4 — **κοινοί** για τα τεκμήρια και τις σφραγισμένες παραδόσεις: ό,τι δεν μετρά ως τεκμήριο για
 * όσους το βλέπουν, δεν μετρά ούτε ως «παραδόθηκε» για όσους δεν το βλέπουν. Γραμμή εκτός καταλόγου ⇒ τίποτα.
 */
function deliveredTransmittals(input: DeliveryInput): readonly DeliveredTransmittal[] {
  return currentContributions(input.contributions, input.activeContributors).flatMap((contribution) => {
    const file = input.files.get(contribution.file.fileId);
    if (file === undefined || file.ownerUid !== contribution.authorUid || !file.hasBytes) return [];
    const audience = audienceOfTransmittal(contribution);
    return audience ? [{ contribution, audience }] : [];
  });
}

/** Τα τεκμήρια που φτάνουν **σε αυτόν** τον θεατή από τις αποστολές της υπόθεσης (κανόνας 3: ακροατήριο). */
export function contributionEvidence(input: ContributionEvidenceInput): readonly EvidenceFile[] {
  return deliveredTransmittals(input)
    .filter((delivered) => reachesViewer(delivered.audience, input.viewer))
    .map((delivered) => toEvidence(delivered, input))
    .filter((file): file is EvidenceFile => file !== null);
}

/**
 * 🔒 Π2 — οι **σφραγισμένες** παραδόσεις για αυτόν τον θεατή: εκ μέρους του πελάτη, σε ακροατήριο όπου **δεν** ανήκει,
 * σε γραμμή που **βλέπει**. Μόνο έγγραφα πελάτη — το δικό του έργο ενός επαγγελματία (έκθεση νομικού ελέγχου της άλλης
 * πλευράς) **δεν** σφραγίζεται: εκεί η γραμμή του οικοδεσπότη αφορά τη **δική του** πλευρά (`ownSideOnly`).
 */
export function sealedDeliveries(input: DeliveryInput & { readonly viewer: CaseViewerRole }): readonly SealedDelivery[] {
  return deliveredTransmittals(input)
    .filter(({ audience }) => sentOnBehalf(audience.item) && !reachesViewer(audience, input.viewer) && viewerSeesItem(input.viewer, audience.item))
    .map(({ contribution }) => ({ itemId: contribution.checklistItemId, deliveredAt: contribution.issuedAt, authorRole: contribution.authorRole }));
}
