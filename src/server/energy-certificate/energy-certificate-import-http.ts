/**
 * @module server/energy-certificate/energy-certificate-import-http
 * @description **Το HTTP της εισαγωγής ΠΕΑ** (ADR-777 §8.96) — ΕΝΑ σημείο για τις δύο διαδρομές (ακίνητο γραφείου ·
 * αγγελία ιδιώτη), που διαφέρουν **μόνο** στο ποιος είναι ο κάτοχος και πού ζουν τα αρχεία του.
 *
 * 🔑 **Το σώμα κουβαλά ΜΟΝΟ το `fileId`**: δοχείο, κάτοχος και τρέχον μπλοκ τα ξέρει ο server από την ήδη
 * εξουσιοδοτημένη διαδρομή — ποτέ από τη φόρμα.
 * 🔑 Άρνηση ⇒ 422 με όνομα (η επανάληψη δεν βοηθά) · βλάβη ⇒ 503 («ξαναδοκίμασε, μην αλλάξεις τίποτα»).
 */

import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';

import { isPlainRecord } from '@/lib/type-guards';
import { createModuleLogger } from '@/lib/telemetry';
import type { PeaProposal } from '@/lib/energy-certificate/pea-proposal';
import type { PeaImportOutcome, PeaImportRefusal } from '@/lib/energy-certificate/pea-import-outcome';

const logger = createModuleLogger('energy-certificate-import');

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export type EnergyCertificateImportBody =
  | { readonly proposal: PeaProposal }
  | { readonly error: PeaImportRefusal | 'MALFORMED' | 'UNAVAILABLE' };

async function fileIdOf(request: NextRequest): Promise<string | null> {
  const body: unknown = await request.json().catch(() => null);
  const fileId = isPlainRecord(body) ? body.fileId : undefined;
  return typeof fileId === 'string' && fileId.trim() !== '' ? fileId.trim() : null;
}

/**
 * Το σώμα → η εισαγωγή → η απάντηση. Ο `run` είναι ό,τι διαφέρει ανά διαδρομή: ήδη ξέρει ακίνητο και κάτοχο.
 *
 * @param subjectId για το log μόνο — ποτέ στο σώμα της απάντησης
 */
export async function respondToEnergyCertificateImport(
  request: NextRequest,
  subjectId: string,
  run: (fileId: string) => Promise<PeaImportOutcome>,
): Promise<NextResponse<EnergyCertificateImportBody>> {
  const fileId = await fileIdOf(request);
  if (fileId === null) return NextResponse.json({ error: 'MALFORMED' }, { status: 400 });
  try {
    const outcome = await run(fileId);
    if (outcome.kind === 'refused') return NextResponse.json({ error: outcome.reason }, { status: 422 });
    return NextResponse.json({ proposal: outcome.proposal }, { headers: NO_STORE });
  } catch (error) {
    logger.error('Η εισαγωγή ΠΕΑ απέτυχε', {
      data: { subjectId, fileId },
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'UNAVAILABLE' }, { status: 503 });
  }
}
