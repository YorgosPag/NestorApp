/**
 * @fileoverview **Η ΚΡΙΣΗ ΤΗΣ ΠΟΡΤΑΣ ΕΠΑΛΗΘΕΥΣΗΣ** — μητρώο εκδότη + τοπική απόδειξη → **μία** ονομασμένη ετυμηγορία
 *               (ADR-916 Φ-Γ2 Σ6).
 * @module lib/property-handover/handover-protocol-verification
 * @related handover-protocol-manifest-parse.ts · handover-delivery-plan.ts (`handoverDeliveryDigest`) ·
 *          server/property-handover/handover-protocol-verification.server.ts (η πόρτα) ·
 *          components/handover-protocol-verify/* (η οθόνη)
 *
 * 🏆 **Το πρότυπο**: docs.gov.gr/validate (ο **εκδότης** απαντά από το μητρώο του) + Blueink verify (στέλνεται **μόνο** το
 *    SHA-256) + LiveVerify (κατακερματισμός **στον browser**). Το PDF δεν φεύγει ποτέ από τη συσκευή του τρίτου.
 * 🔑 **Γιατί αρκεί η ταύτιση του `pdfSha256`**: ο γραφέας (Σ4) αποθηκεύει το αποτύπωμα **μόνο** μετά από `verifyPdfSeal`
 *    valid + timestamped πάνω σε **αυτά** τα bytes. Ίδια bytes ⇒ ίδια σφραγίδα, ίδιος έλεγχος.
 * 🔴 **«Επαληθευμένο» ΜΟΝΟ όταν**: καταχωρισμένο **και** ίδια bytes **και** τρέχουσα αναθεώρηση. Γνήσιο αλλά παλιό ⇒
 *    `superseded` — ο συμβολαιογράφος πρέπει να ξέρει ότι υπάρχει νεότερο (το docs.gov.gr δεν το λέει).
 *
 * **Layering**: leaf — καθαρές συναρτήσεις· μόνο το Web Crypto (μέσω `handoverDeliveryDigest`).
 */

import { isSha256Hex } from '@/lib/hash/sha256';
import { isOneOf, isRecord } from '@/lib/type-guards';
import type { PropertyHandoverProtocol, PropertyHandoverProtocolPointer } from '@/types/property-handover-protocol';

import { handoverDeliveryDigest } from './handover-delivery-plan';
import { parseHandoverProtocolManifest, type HandoverProtocolManifest } from './handover-protocol-manifest-parse';

// ─── Η απάντηση του μητρώου (το συμβόλαιο της πόρτας) ─────────────────────────────────────────────────────────────────

export const HANDOVER_PROTOCOL_FILE_COMPARISONS = ['match', 'mismatch', 'not-provided'] as const;
/** Τα bytes που έφερε ο τρίτος, απέναντι στο `pdfSha256` του μητρώου. */
export type HandoverProtocolFileComparison = (typeof HANDOVER_PROTOCOL_FILE_COMPARISONS)[number];

/** Είναι η **τελευταία** αναθεώρηση; `undetermined` ⇒ ο δείκτης της παράδοσης δεν διαβάζεται — ποτέ «τρέχον» στα τυφλά. */
export type HandoverProtocolStanding =
  | { readonly kind: 'current' }
  | { readonly kind: 'superseded'; readonly latestRevision: number }
  | { readonly kind: 'undetermined' };

/** 🔒 **Ελάχιστα** στοιχεία, κανένα όνομα: όσα τυπώνει ήδη το χαρτί, για σύγκριση. */
export interface HandoverProtocolRegisteredAnswer {
  readonly kind: 'registered';
  readonly revision: number;
  readonly issuedAt: string;
  readonly rows: number;
  readonly bytes: number;
  readonly digest: string;
  readonly legalTextVersion: number;
  readonly file: HandoverProtocolFileComparison;
  readonly standing: HandoverProtocolStanding;
}

export type HandoverProtocolRegistryAnswer = { readonly kind: 'unknown' } | HandoverProtocolRegisteredAnswer;

/** Το σώμα της πόρτας. */
export type HandoverProtocolVerificationResponse =
  | { readonly ok: true; readonly registry: HandoverProtocolRegistryAnswer }
  | { readonly ok: false; readonly reason: 'request-invalid' | 'unavailable' };

function standingOf(protocol: PropertyHandoverProtocol, latest: PropertyHandoverProtocolPointer | null): HandoverProtocolStanding {
  if (latest === null) return { kind: 'undetermined' };
  if (latest.protocolId === protocol.protocolId) return { kind: 'current' };
  return latest.revision > protocol.revision ? { kind: 'superseded', latestRevision: latest.revision } : { kind: 'undetermined' };
}

/**
 * **Η απάντηση του μητρώου** — `protocol` από το σύνορο ανάγνωσης (αλλοιωμένο ⇒ `null` ⇒ `unknown`), `latest` ο δείκτης
 * της παράδοσης του. `sha256 === null` ⇒ ερώτηση από χαρτί (QR), χωρίς αρχείο.
 */
export function registryAnswerOf(
  protocol: PropertyHandoverProtocol | null,
  latest: PropertyHandoverProtocolPointer | null,
  sha256: string | null,
): HandoverProtocolRegistryAnswer {
  if (protocol === null) return { kind: 'unknown' };
  return {
    kind: 'registered',
    revision: protocol.revision,
    issuedAt: protocol.issuedAt,
    rows: protocol.rows,
    bytes: protocol.bytes,
    digest: protocol.digest,
    legalTextVersion: protocol.legalText.version,
    file: sha256 === null ? 'not-provided' : sha256 === protocol.pdfSha256 ? 'match' : 'mismatch',
    standing: standingOf(protocol, latest),
  };
}

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0;
const isRevision = (value: unknown): value is number => isCount(value) && value >= 1;

function standingFromResponse(raw: unknown): HandoverProtocolStanding | null {
  if (!isRecord(raw)) return null;
  if (raw.kind === 'current' || raw.kind === 'undetermined') return { kind: raw.kind };
  return raw.kind === 'superseded' && isRevision(raw.latestRevision) ? { kind: 'superseded', latestRevision: raw.latestRevision } : null;
}

/** **Ο αποκωδικοποιητής του πελάτη** — πεδίο προς πεδίο· ό,τι δεν καταλαβαίνει ⇒ `null` (ποτέ «επαληθευμένο» από σκουπίδι). */
export function registryAnswerFromResponse(raw: unknown): HandoverProtocolRegistryAnswer | null {
  if (!isRecord(raw) || raw.ok !== true || !isRecord(raw.registry)) return null;
  const answer = raw.registry;
  if (answer.kind === 'unknown') return { kind: 'unknown' };
  const standing = standingFromResponse(answer.standing);
  const { revision, issuedAt, rows, bytes, digest, legalTextVersion, file } = answer;
  if (answer.kind !== 'registered' || standing === null || !isOneOf(HANDOVER_PROTOCOL_FILE_COMPARISONS, file)) return null;
  if (!isRevision(revision) || typeof issuedAt !== 'string' || !isCount(rows) || !isCount(bytes)) return null;
  if (typeof digest !== 'string' || !isRevision(legalTextVersion)) return null;
  return { kind: 'registered', revision, issuedAt, rows, bytes, digest, legalTextVersion, file, standing };
}

// ─── Η τοπική απόδειξη (στον browser, πριν το δίκτυο) ─────────────────────────────────────────────────────────────────

/** Το PDF ξεκινά πάντα με `%PDF-` (ISO 32000-2 §7.5.2). */
export function isPdfHeader(bytes: Uint8Array): boolean {
  const header = [0x25, 0x50, 0x44, 0x46, 0x2d];
  return bytes.length >= header.length && header.every((byte, index) => bytes[index] === byte);
}

/** Τι λέει το ίδιο το manifest για τον εαυτό του — **πριν** ρωτήσουμε οποιονδήποτε. */
export type HandoverProtocolManifestAssessment =
  | { readonly kind: 'no-manifest' }
  | { readonly kind: 'manifest-invalid' }
  | { readonly kind: 'digest-inconsistent'; readonly manifest: HandoverProtocolManifest }
  | { readonly kind: 'consistent'; readonly manifest: HandoverProtocolManifest };

/**
 * **Αυτοσυνέπεια του πίνακα**: ο browser ξαναϋπολογίζει το αποτύπωμα (v2 · v3 με κλεισμένες) από τις γραμμές του manifest με τον **ίδιο**
 * κώδικα που το υπολόγισε ο γραφέας, και ελέγχει το σύνολο bytes. Ασυνέπεια ⇒ κάποιος πείραξε τη λίστα.
 */
export async function assessHandoverProtocolManifest(text: string | null): Promise<HandoverProtocolManifestAssessment> {
  if (text === null) return { kind: 'no-manifest' };
  const manifest = parseHandoverProtocolManifest(text);
  if (manifest === null) return { kind: 'manifest-invalid' };
  const { files, closed, digest, totalBytes } = manifest.delivery;
  const total = files.reduce((sum, file) => sum + file.size, 0);
  // Φ-Δ.7γ — οι κλεισμένες γραμμές μπαίνουν στο αποτύπωμα v3: αφαίρεση ή αλλαγή μιας από αυτές φαίνεται εδώ.
  const recomputed = await handoverDeliveryDigest(files, closed);
  return recomputed === digest && total === totalBytes ? { kind: 'consistent', manifest } : { kind: 'digest-inconsistent', manifest };
}

// ─── Η ετυμηγορία ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** Ό,τι ο browser **έχει ήδη αποδείξει** για το αρχείο, όταν φτάνει η απάντηση του μητρώου. */
export interface HandoverProtocolLocalProof {
  readonly manifest: HandoverProtocolManifest;
  readonly pdfSha256: string;
}

export type HandoverProtocolVerdict =
  | { readonly kind: 'verified'; readonly manifest: HandoverProtocolManifest; readonly registry: HandoverProtocolRegisteredAnswer }
  | { readonly kind: 'superseded'; readonly manifest: HandoverProtocolManifest; readonly registry: HandoverProtocolRegisteredAnswer; readonly latestRevision: number }
  | { readonly kind: 'genuine-standing-undetermined'; readonly manifest: HandoverProtocolManifest; readonly registry: HandoverProtocolRegisteredAnswer }
  | { readonly kind: 'altered'; readonly registry: HandoverProtocolRegisteredAnswer }
  | { readonly kind: 'not-registered' }
  | { readonly kind: 'other-protocol'; readonly expectedProtocolId: string; readonly foundProtocolId: string };

/**
 * **Η ΜΙΑ ετυμηγορία** — `expectedProtocolId` όταν η σελίδα άνοιξε από QR: αρχείο **άλλου** πρωτοκόλλου δεν «επαληθεύεται»
 * σιωπηλά για λογαριασμό εκείνου που σκάναρε ο άνθρωπος.
 */
export function handoverProtocolVerdictOf(
  proof: HandoverProtocolLocalProof,
  registry: HandoverProtocolRegistryAnswer,
  expectedProtocolId: string | null,
): HandoverProtocolVerdict {
  const foundProtocolId = proof.manifest.protocol.id;
  if (expectedProtocolId !== null && expectedProtocolId !== foundProtocolId) return { kind: 'other-protocol', expectedProtocolId, foundProtocolId };
  if (registry.kind === 'unknown') return { kind: 'not-registered' };
  if (registry.file !== 'match' || !isSha256Hex(proof.pdfSha256)) return { kind: 'altered', registry };
  const { manifest } = proof;
  if (registry.standing.kind === 'superseded') return { kind: 'superseded', manifest, registry, latestRevision: registry.standing.latestRevision };
  if (registry.standing.kind === 'undetermined') return { kind: 'genuine-standing-undetermined', manifest, registry };
  return { kind: 'verified', manifest, registry };
}
