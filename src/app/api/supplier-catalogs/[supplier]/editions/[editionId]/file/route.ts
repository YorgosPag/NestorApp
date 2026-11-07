/**
 * `GET /api/supplier-catalogs/<προμηθευτής>/editions/<έκδοση>/file` — η βραχύβια άδεια ανάγνωσης ενός **ανώνυμου** εντύπου της
 * δημόσιας βιτρίνας (ADR-923 §5.15 Η3 · Η4). Χωρίς σύνδεση: ο θεατής είναι πάντα `anonymous`.
 *
 * 🔒 Ο προμηθευτής λύνεται από την **αυθεντία** του ψευδωνύμου (`resolveAlias`, όπως οι σελίδες της βιτρίνας), ποτέ από
 *    ό,τι ισχυρίζεται το αίτημα· η πύλη της βιτρίνας και η κρίση του κοινού ζουν στο σύνορο (`signCatalogEditionFile`).
 * 🔒 Κρυφό, αποσυρμένο, ανακλημένο, ανύπαρκτο ⇒ **ίδιο** 404. «Δεν μπόρεσα να ρωτήσω» ⇒ 503, ποτέ 404.
 * 🔒 Η απάντηση είναι άδεια 15′ ⇒ `no-store`· `X-Robots-Tag: noindex` (Θ3: τα PDF δεν ευρετηριάζονται). Το PDF το φέρνει ο
 *    φυλλομετρητής **απευθείας** από τον κάδο (`urlDelivery: 'direct'`), ποτέ `attachment`.
 * 🔑 Ρητή βαθμίδα `STANDARD` (CHECK 3.78): ανώνυμη πόρτα, κλειδί ορίου ο κατακερματισμένος IP.
 * @module app/api/supplier-catalogs/[supplier]/editions/[editionId]/file/route
 */

import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';

import { resolveAlias } from '@/lib/workspace/alias-registry';
import { withRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { signCatalogEditionFile } from '@/server/catalog/editions/catalog-edition-reads.server';

const logger = createModuleLogger('public-catalog-edition-file');

type RouteContext = { readonly params: Promise<{ readonly supplier: string; readonly editionId: string }> };

const HEADERS = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'X-Content-Type-Options': 'nosniff' } as const;

const answer = (body: unknown, status: number): NextResponse => NextResponse.json(body, { status, headers: HEADERS });

async function handleGet(_request: NextRequest, context?: RouteContext): Promise<NextResponse> {
  if (!context) return answer({ error: 'NOT_FOUND' }, 404);
  const { supplier, editionId } = await context.params;
  try {
    const resolution = await resolveAlias(supplier);
    if (resolution.outcome === 'unknown') return answer({ error: 'UNAVAILABLE' }, 503);
    if (resolution.outcome === 'not-found') return answer({ error: 'NOT_FOUND' }, 404);
    const signed = await signCatalogEditionFile(resolution.companyId, { kind: 'anonymous' }, editionId);
    return signed === null ? answer({ error: 'NOT_FOUND' }, 404) : answer(signed, 200);
  } catch (error) {
    logger.warn('Το δημόσιο έντυπο δεν κρίθηκε', { error: error instanceof Error ? error.message : String(error) });
    return answer({ error: 'UNAVAILABLE' }, 503);
  }
}

export const GET = withRateLimit<RouteContext>(handleGet, { category: 'STANDARD' });
