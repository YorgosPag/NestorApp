/**
 * GET /api/catalog/publications/[id]/download?profile=print — το PDF μιας έτοιμης έκδοσης (ADR-923 §5.6).
 * 🔒 Η **μόνη** πόρτα του αρχείου: σφραγισμένη ρίζα `catalog-publications/` (`allow read, write: if false`), κριτής
 * `catalog:pricing:view`, ξένη έκδοση ≡ ανύπαρκτη. Rate: standard. Κάθε λήψη καταγράφεται πριν σερβιριστούν bytes, γιατί από αυτήν
 * κρίνεται πόσο θα ζήσει το αρχείο (§5.6.1).
 */

import 'server-only';

import { NextResponse } from 'next/server';

import { notFound } from '@/lib/api/define-route';
import { attachmentDisposition } from '@/lib/http/content-disposition';
import { publicationBucket } from '@/server/catalog/publishing/publication-bucket.server';
import { recordPublicationDownload } from '@/server/catalog/publishing/publication-retention.server';
import { readOwnedPublicationRun } from '@/server/catalog/publishing/publication-run.server';
import { catalogFileRoute } from '../../../_shared/catalog-route';

export const GET = catalogFileRoute({ category: 'STANDARD', authority: 'pricingView' }, async (auth, id, search) => {
  const run = await readOwnedPublicationRun(auth, id);
  const live = run?.status === 'ready' && run.retention.disposal === null ? run : null;
  const artifact = live?.artifacts.find((candidate) => candidate.profile === search.get('profile'));
  if (!live || !artifact) return notFound('Publication not found');
  await recordPublicationDownload(auth, live);
  const [bytes] = await publicationBucket().file(artifact.storagePath).download();
  return new NextResponse(new Uint8Array(bytes), {
    headers: new Headers({
      'Content-Type': 'application/pdf',
      'Content-Disposition': attachmentDisposition(`catalog-${artifact.profile}-${artifact.sha256.slice(0, 8)}.pdf`),
      'Content-Length': String(bytes.length),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    }),
  });
});
