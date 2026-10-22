/**
 * @fileoverview **ΤΟ ΣΥΝΟΡΟ ΑΝΑΓΝΩΣΗΣ ΤΟΥ ΠΡΩΤΟΚΟΛΛΟΥ** — έγγραφο Firestore → `PropertyHandoverProtocol`, ή `null`.
 * @related ADR-916 Φ-Γ2 Σ4 · property-handover-from-document.ts (`protocolPointerOf` — ο ίδιος δείκτης) · CHECK 3.74
 * @module lib/property-handover/property-handover-protocol-from-document
 *
 * 🔑 **Κάθε ανάγνωση αποθηκευμένου πρωτοκόλλου περνά από εδώ** (ο γραφέας · η πόρτα επαλήθευσης, Σ6). Πεδίο προς πεδίο,
 *    κανένας ισχυρισμός τύπου· ελλιπές έγγραφο **δεν** είναι πρωτόκολλο (`null`). Η ταυτότητα έρχεται **από έξω** και νικά.
 *
 * **Layering**: leaf — καθαρή συνάρτηση, κανένα Firestore SDK.
 */

import type { PropertyHandoverProtocol } from '@/types/property-handover-protocol';

import { protocolPointerOf } from './property-handover-from-document';

const nonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';
const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0;
const isSha256Hex = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);

function legalTextOf(raw: unknown): PropertyHandoverProtocol['legalText'] | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { version, digest } = raw as Record<string, unknown>;
  return isCount(version) && version >= 1 && nonEmptyString(digest) ? { version, digest } : null;
}

/** **Διαβάζει ένα αποθηκευμένο έγγραφο ως Πρωτόκολλο.** `null` ⇒ «αυτό δεν είναι πρωτόκολλο». */
export function propertyHandoverProtocolFromDocument(raw: unknown, id: string): PropertyHandoverProtocol | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const stored = raw as Record<string, unknown>;
  const pointer = protocolPointerOf({ ...stored, protocolId: id });
  const legalText = legalTextOf(stored.legalText);
  const { companyId, propertyId, handoverId, recipientUserId, supersedesProtocolId, pdfSha256, rows, bytes } = stored;
  if (pointer === null || legalText === null || !isSha256Hex(pdfSha256) || !isCount(rows) || !isCount(bytes)) return null;
  if (!nonEmptyString(companyId) || !nonEmptyString(propertyId) || !nonEmptyString(handoverId) || !nonEmptyString(recipientUserId)) return null;
  if (supersedesProtocolId !== null && !nonEmptyString(supersedesProtocolId)) return null;
  return {
    ...pointer, companyId, propertyId, handoverId, recipientUserId,
    supersedesProtocolId: supersedesProtocolId ?? null,
    pdfSha256, legalText, rows, bytes,
  };
}
