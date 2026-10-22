/**
 * @fileoverview **Ο ΕΝΑΣ ΑΝΑΓΝΩΣΤΗΣ ΤΟΥ `manifest.json`** — κείμενο του συνημμένου → τυποποιημένο manifest, ή `null`
 *               (ADR-916 Φ-Γ2 Σ6).
 * @module lib/property-handover/handover-protocol-manifest-parse
 * @related services/pdf/renderers/handover-protocol/handover-protocol-manifest.ts (ο **γραφέας** — ίδιο σχήμα) ·
 *          property-handover-protocol-store.server.ts (υιοθέτηση) · handover-protocol-verification.ts (η πόρτα, Σ6)
 *
 * 🔑 **Δύο αναγνώστες, ΕΝΑΣ κώδικας**: ο διακομιστής (υιοθέτηση αντικειμένου στο 412) και ο browser του τρίτου (η πόρτα
 *    επαλήθευσης) διαβάζουν το ίδιο συνημμένο. Δύο χαλαροί αναγνώστες θα διαφωνούσαν στο πρώτο ελλιπές πεδίο.
 * 🔒 Πεδίο προς πεδίο, κανένας ισχυρισμός τύπου· **ποτέ** δεν ρίχνει (το `JSON.parse` τυλίγεται): το κείμενο έρχεται από
 *    αρχείο που έφερε ένας άγνωστος.
 * ⚠️ Ξένο `delivery.scheme` ⇒ `null`: η συνταγή του αποτυπώματος δεν ξαναϋπολογίζεται με άλλη ετικέτα.
 *
 * **Layering**: leaf — καθαρή συνάρτηση, κανένα pdf-lib, κανένα SDK.
 */

import { isSha256Hex } from '@/lib/hash/sha256';
import { isRecord } from '@/lib/type-guards';

import { HANDOVER_DELIVERY_DIGEST_SCHEME } from './handover-delivery-plan';

/** Ετικέτα σχήματος του manifest — αλλαγή μορφής ⇒ νέα ετικέτα (ίδια αρχή με το αποτύπωμα). */
export const HANDOVER_PROTOCOL_MANIFEST_SCHEME = 'nestor.handover-protocol-manifest.v1';

/** Μία γραμμή του πίνακα — τα τέσσερα πεδία του αποτυπώματος + το όνομα που είδε ο αγοραστής. */
export interface HandoverProtocolManifestFile {
  readonly sourceFileId: string;
  readonly copyFileId: string;
  readonly sha256: string;
  readonly size: number;
  readonly name: string | null;
}

export interface HandoverProtocolManifestRef {
  readonly id: string;
  readonly revision: number;
}

export interface HandoverProtocolManifest {
  readonly protocol: HandoverProtocolManifestRef & {
    readonly supersedes: HandoverProtocolManifestRef | null;
    readonly issuedAt: string;
  };
  readonly issuerName: string | null;
  readonly propertyLabel: string | null;
  readonly recipientName: string | null;
  readonly legalText: { readonly version: number; readonly digest: string };
  readonly delivery: {
    readonly digest: string;
    readonly totalBytes: number;
    readonly files: readonly HandoverProtocolManifestFile[];
  };
}

const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';
const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0;
const isRevision = (value: unknown): value is number => isCount(value) && value >= 1;
const textOrNull = (value: unknown): string | null => (nonEmpty(value) ? value : null);
const nameAt = (raw: unknown): string | null => (isRecord(raw) ? textOrNull(raw.name) : null);

function refOf(raw: unknown): HandoverProtocolManifestRef | null {
  if (!isRecord(raw) || !nonEmpty(raw.id) || !isRevision(raw.revision)) return null;
  return { id: raw.id, revision: raw.revision };
}

function protocolOf(raw: unknown): HandoverProtocolManifest['protocol'] | null {
  const ref = refOf(raw);
  if (ref === null || !isRecord(raw) || !nonEmpty(raw.issuedAt)) return null;
  const supersedes = raw.supersedes === null ? null : refOf(raw.supersedes);
  if (raw.supersedes !== null && supersedes === null) return null;
  return { ...ref, supersedes, issuedAt: raw.issuedAt };
}

function fileOf(raw: unknown): HandoverProtocolManifestFile | null {
  if (!isRecord(raw)) return null;
  const { sourceFileId, copyFileId, sha256, size, name } = raw;
  if (!nonEmpty(sourceFileId) || !nonEmpty(copyFileId) || !isSha256Hex(sha256) || !isCount(size)) return null;
  if (name !== null && typeof name !== 'string') return null;
  return { sourceFileId, copyFileId, sha256, size, name: textOrNull(name) };
}

function deliveryOf(raw: unknown): HandoverProtocolManifest['delivery'] | null {
  if (!isRecord(raw) || raw.scheme !== HANDOVER_DELIVERY_DIGEST_SCHEME || !nonEmpty(raw.digest) || !isCount(raw.totalBytes)) return null;
  if (!Array.isArray(raw.files) || raw.files.length === 0) return null;
  const files: HandoverProtocolManifestFile[] = [];
  for (const item of raw.files) {
    const file = fileOf(item);
    if (file === null) return null;
    files.push(file);
  }
  return { digest: raw.digest, totalBytes: raw.totalBytes, files };
}

function legalTextOf(raw: unknown): HandoverProtocolManifest['legalText'] | null {
  return isRecord(raw) && isRevision(raw.version) && nonEmpty(raw.digest) ? { version: raw.version, digest: raw.digest } : null;
}

function jsonOf(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** **Διαβάζει το κείμενο του συνημμένου ως manifest.** `null` ⇒ «αυτό δεν είναι manifest Πρωτοκόλλου (v1)». */
export function parseHandoverProtocolManifest(text: string): HandoverProtocolManifest | null {
  const raw = jsonOf(text);
  if (!isRecord(raw) || raw.schema !== HANDOVER_PROTOCOL_MANIFEST_SCHEME) return null;
  const protocol = protocolOf(raw.protocol);
  const legalText = legalTextOf(raw.legalText);
  const delivery = deliveryOf(raw.delivery);
  if (protocol === null || legalText === null || delivery === null) return null;
  return {
    protocol,
    issuerName: nameAt(raw.issuer),
    propertyLabel: isRecord(raw.property) ? textOrNull(raw.property.label) : null,
    recipientName: nameAt(raw.recipient),
    legalText,
    delivery,
  };
}
