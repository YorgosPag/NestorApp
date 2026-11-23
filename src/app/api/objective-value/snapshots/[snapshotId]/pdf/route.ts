/**
 * @fileoverview `GET /api/objective-value/snapshots/{snapshotId}/pdf?lang=el|en` — το PDF πληροφοριακού υπολογισμού ενός
 * στιγμιοτύπου του χώρου του δρώντος, με κωδικό, QR επαλήθευσης, ψηφιακό αποτύπωμα και το περιεχόμενο συνημμένο
 * (ADR-947 Φ2β · Δ3).
 * @related services/pdf/renderers/objective-value/objective-value-pdf.server.ts · ../route.ts (η ανάγνωση με απόκλιση)
 *
 * Όριο: **heavy** — απόδοση PDF (γραμματοσειρά · QR · συνημμένο) στον server, ακριβότερη από μια ανάγνωση.
 * Γλώσσα: `lang` (el · en)· οτιδήποτε άλλο ⇒ η προεπιλογή. Το στιγμιότυπο δεν κρατά λέξεις, άρα οι δύο αποδόσεις λένε
 * το ίδιο. Καμία προσωρινή μνήμη (`private, no-store`): έγγραφο ενός χώρου.
 *
 * ⛔ **Dark launch**: κλειστός διακόπτης `OBJECTIVE_VALUE_PROFESSIONAL_TIERS` ⇒ 404.
 * 🔒 Στιγμιότυπο άλλου χώρου, άκυρο id ή αλλοιωμένο αποτύπωμα ≡ ανύπαρκτο (404, ποτέ 403).
 */

import { NextResponse, type NextRequest } from 'next/server';

import { isAppFeatureEnabled } from '@/config/feature-flags';
import { resolveHumanLanguage } from '@/i18n/languages';
import { ApiError } from '@/lib/api/ApiErrorHandler';
import { withAuth } from '@/lib/auth/middleware';
import type { AuthContext } from '@/lib/auth/types';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { attachmentDisposition } from '@/lib/http/content-disposition';
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import { readObjectiveValueSnapshotRecord } from '@/services/objective-value/objective-value-snapshots.server';
import { produceObjectiveValueSnapshotPdf } from '@/services/pdf/renderers/objective-value/objective-value-pdf.server';

interface SnapshotPdfRouteContext {
  readonly params: Promise<{ snapshotId: string }>;
}

async function snapshotPdfHandler(request: NextRequest, ctx: AuthContext, snapshotId: string) {
  if (!isAppFeatureEnabled('OBJECTIVE_VALUE_PROFESSIONAL_TIERS')) throw new ApiError(404, 'Not found', 'NOT_FOUND');
  const snapshot = await readObjectiveValueSnapshotRecord(getAdminFirestore(), { companyId: ctx.companyId, uid: ctx.uid }, snapshotId);
  if (snapshot === null) throw new ApiError(404, 'Not found', 'NOT_FOUND');
  const outcome = await produceObjectiveValueSnapshotPdf(snapshot, resolveHumanLanguage(request.nextUrl.searchParams.get('lang')));
  if (!outcome.ok) throw new ApiError(500, `Objective value snapshot PDF refused: ${outcome.reason}`, 'OBJECTIVE_VALUE_PDF_INCONSISTENT');
  return new NextResponse(new Uint8Array(outcome.pdf), {
    headers: new Headers({
      'Content-Type': 'application/pdf',
      'Content-Disposition': attachmentDisposition(outcome.fileName),
      'Content-Length': String(outcome.pdf.byteLength),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    }),
  });
}

export async function GET(request: NextRequest, segmentData: SnapshotPdfRouteContext) {
  const { snapshotId } = await segmentData.params;
  const handler = withHeavyRateLimit(
    withAuth((req: NextRequest, ctx: AuthContext) => snapshotPdfHandler(req, ctx, snapshotId), { permissions: 'reports:reports:view' }),
  );
  return handler(request);
}
