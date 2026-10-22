import 'server-only';

/**
 * @fileoverview **Ο ΠΑΡΑΓΩΓΟΣ ΤΟΥ ΣΦΡΑΓΙΣΜΕΝΟΥ ΠΡΩΤΟΚΟΛΛΟΥ** — όψη → PDF + `manifest.json` → σφραγίδα PAdES → έλεγχος
 *               (ADR-916 Φ-Γ2 Σ4 · ADR-918).
 * @module services/pdf/renderers/handover-protocol/handover-protocol-pdf.server
 *
 * ⛔ **Κανένα ασφράγιστο Πρωτόκολλο φεύγει ποτέ από εδώ.** Η έξοδος είναι **ή** σφραγισμένο PDF που πέρασε δύο ελέγχους
 *    **ή** ονομασμένη άρνηση. Χωρίς ρύθμιση παρόχου ⇒ `awaiting-seal-configuration` (η συνεδρία μετρά **ένα** σήμα ανά
 *    εκτέλεση, ADR-918).
 * 🔑 **Δύο έλεγχοι, δύο ερωτήσεις**:
 *    1. **Πριν**: το αποτύπωμα των γραμμών της όψης = το αποτύπωμα του καθολικού. Αλλιώς ο πίνακας λέει άλλο από αυτό που
 *       σφραγίζεται (π.χ. γραμμή που χάθηκε στη μεταφορά) ⇒ `digest-mismatch`, τίποτα δεν σφραγίζεται.
 *    2. **Μετά**: ο `sealPdf` ήδη τρέχει τον `verifyPdfSeal` (γνήσια σφραγίδα + χρονοσήμανση). Εδώ ρωτάμε το **άλλο**: το
 *       σφραγισμένο αρχείο κρατά **αυτό** το manifest, byte προς byte; Ό,τι θα έκανε ο τρίτος.
 */

import { createHash } from 'node:crypto';

import { qrPngDataUrl } from '@/lib/qr/qr-code';
import { handoverDeliveryDigest } from '@/lib/property-handover/handover-delivery-plan';
import type { SealSession } from '@/server/pdf-seal/seal-pdf.server';
import type { SealFailure } from '@/server/pdf-seal/seal-signer.types';

import { attachHandoverProtocolManifest, handoverProtocolManifestOf, readHandoverProtocolManifest } from './handover-protocol-manifest';
import { renderHandoverProtocolPdf } from './handover-protocol-pdf-renderer';
import type { HandoverProtocolView } from './handover-protocol-view';
import { HANDOVER_PROTOCOL_WORDING } from './handover-protocol-wording';

/** Πλάτος του QR σε pixels — αρκετό για εκτύπωση 26 mm σε 300 dpi. */
const QR_WIDTH_PX = 320;

export type HandoverProtocolPdfFailure = 'digest-mismatch' | 'manifest-mismatch' | SealFailure;

export type HandoverProtocolPdfOutcome =
  | { readonly kind: 'sealed'; readonly pdf: Uint8Array; readonly sha256: string; readonly manifest: string }
  | { readonly kind: 'awaiting-seal-configuration'; readonly missing: readonly string[] }
  | { readonly kind: 'failed'; readonly reason: HandoverProtocolPdfFailure; readonly detail: string };

const failed = (reason: HandoverProtocolPdfFailure, detail: string): HandoverProtocolPdfOutcome => ({ kind: 'failed', reason, detail });

/** Το ασφράγιστο υλικό: απόδοση + συνημμένο manifest (πριν τη σφράγιση — ό,τι μπει μετά θα την έσπαγε). */
async function unsealedMaterial(view: HandoverProtocolView, manifest: string): Promise<Uint8Array> {
  const wording = HANDOVER_PROTOCOL_WORDING.el;
  const qrOf = (url: string | null): Promise<string | null> => (url === null ? Promise.resolve(null) : qrPngDataUrl(url, 'print', QR_WIDTH_PX));
  const [legalText, verification] = await Promise.all([qrOf(view.legalText.url), qrOf(view.verification.url)]);
  const rendered = await renderHandoverProtocolPdf(view, wording, { legalText, verification });
  return attachHandoverProtocolManifest(rendered, manifest, new Date(view.issuedAt));
}

/** **Παράγει το σφραγισμένο Πρωτόκολλο.** Ποτέ δεν επιστρέφει ασφράγιστο PDF· ποτέ δεν ρίχνει για προβλέψιμη άρνηση. */
export async function produceHandoverProtocolPdf(view: HandoverProtocolView, session: SealSession): Promise<HandoverProtocolPdfOutcome> {
  const recomputed = await handoverDeliveryDigest(view.rows);
  if (recomputed !== view.ledgerDigest) return failed('digest-mismatch', `${view.protocolId}: ${recomputed ?? 'null'} ≠ ${view.ledgerDigest}`);
  const manifest = handoverProtocolManifestOf(view);
  const outcome = await session.seal(await unsealedMaterial(view, manifest), {
    reason: HANDOVER_PROTOCOL_WORDING.el.sealReason(view.revision),
    location: HANDOVER_PROTOCOL_WORDING.el.sealLocation,
  });
  if (outcome.kind === 'awaiting-seal-configuration') return outcome;
  if (outcome.kind === 'failed') return failed(outcome.reason, outcome.detail);
  if ((await readHandoverProtocolManifest(outcome.pdf)) !== manifest) return failed('manifest-mismatch', view.protocolId);
  return { kind: 'sealed', pdf: outcome.pdf, sha256: createHash('sha256').update(outcome.pdf).digest('hex'), manifest };
}
