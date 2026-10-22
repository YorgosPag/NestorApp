/**
 * @fileoverview **Η ΤΟΠΙΚΗ ΑΝΑΓΝΩΣΗ** — ό,τι αποδεικνύει ο browser για ένα αρχείο **χωρίς** να το στείλει πουθενά
 *               (ADR-916 Φ-Γ2 Σ6).
 * @module components/handover-protocol-verify/protocol-local-read
 * @related lib/property-handover/handover-protocol-verification.ts (η κρίση) · use-handover-protocol-verification.ts
 *
 * 🔒 **Τίποτα από εδώ δεν φεύγει από τη συσκευή** εκτός από δύο τιμές: την ταυτότητα του πρωτοκόλλου και το sha256 του PDF.
 * 🔑 Το pdf-lib φορτώνεται **δυναμικά**, μόνο όταν πέσει αρχείο: η σελίδα ανοίγει χωρίς ~300KB που ίσως δεν χρειαστεί.
 * ⚠️ Χαλασμένο PDF ⇒ το `PDFDocument.load` ρίχνει — εδώ γίνεται ονομασμένη κατάσταση `not-pdf`, ποτέ εξαίρεση στην οθόνη.
 */

import {
  HANDOVER_PROTOCOL_VERIFY_MAX_PACKAGE_FILE_BYTES,
  HANDOVER_PROTOCOL_VERIFY_MAX_PDF_BYTES,
} from '@/config/handover-protocol-verification-policy';
import { sha256Hex } from '@/lib/hash/sha256';
import type { HandoverPackageFileEvidence } from '@/lib/property-handover/handover-protocol-package-check';
import type { HandoverProtocolManifest } from '@/lib/property-handover/handover-protocol-manifest-parse';
import { assessHandoverProtocolManifest, isPdfHeader } from '@/lib/property-handover/handover-protocol-verification';

/** Γιατί ένα αρχείο **δεν** είναι Πρωτόκολλο που μπορεί να ελεγχθεί — ονομαστικά, για την οθόνη. */
export type ProtocolLocalRefusal = 'too-large' | 'not-pdf' | 'no-manifest' | 'manifest-invalid';

export type ProtocolLocalReading =
  | { readonly kind: 'refused'; readonly reason: ProtocolLocalRefusal }
  | { readonly kind: 'inconsistent'; readonly manifest: HandoverProtocolManifest }
  | { readonly kind: 'readable'; readonly manifest: HandoverProtocolManifest; readonly pdfSha256: string };

async function manifestTextOf(bytes: Uint8Array): Promise<string | null | 'unreadable'> {
  try {
    const { readHandoverProtocolManifest } = await import('@/services/pdf/renderers/handover-protocol/handover-protocol-manifest');
    return await readHandoverProtocolManifest(bytes);
  } catch {
    return 'unreadable';
  }
}

/** **Διαβάζει ένα αρχείο ως Πρωτόκολλο** — μέγεθος · κεφαλίδα · συνημμένο · αυτοσυνέπεια · αποτύπωμα. */
export async function readProtocolLocally(file: Blob): Promise<ProtocolLocalReading> {
  if (file.size > HANDOVER_PROTOCOL_VERIFY_MAX_PDF_BYTES) return { kind: 'refused', reason: 'too-large' };
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isPdfHeader(bytes)) return { kind: 'refused', reason: 'not-pdf' };
  const text = await manifestTextOf(bytes);
  if (text === 'unreadable') return { kind: 'refused', reason: 'not-pdf' };
  const assessment = await assessHandoverProtocolManifest(text);
  if (assessment.kind === 'no-manifest' || assessment.kind === 'manifest-invalid') return { kind: 'refused', reason: assessment.kind };
  if (assessment.kind === 'digest-inconsistent') return { kind: 'inconsistent', manifest: assessment.manifest };
  return { kind: 'readable', manifest: assessment.manifest, pdfSha256: await sha256Hex(bytes) };
}

/** **Κατακερματίζει ένα παραδομένο αρχείο** — `sha256: null` πάνω από το όριο του browser (ονομασμένο, ποτέ σιωπηλό). */
export async function packageFileEvidenceOf(file: File): Promise<HandoverPackageFileEvidence> {
  if (file.size > HANDOVER_PROTOCOL_VERIFY_MAX_PACKAGE_FILE_BYTES) return { name: file.name, size: file.size, sha256: null };
  return { name: file.name, size: file.size, sha256: await sha256Hex(await file.arrayBuffer()) };
}
