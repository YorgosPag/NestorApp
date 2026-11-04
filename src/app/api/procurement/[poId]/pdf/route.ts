/**
 * GET /api/procurement/[poId]/pdf — Download PO as PDF
 *
 * Auth: withAuth | Rate: standard
 * Tenant: `findOwnedPO` (service layer) — a foreign PO answers exactly like a missing one (ADR-923 κύμα 3 Λ5)
 *
 * 🔒 ADR-923 Λ5β — ήταν το τελευταίο route PO εκτός `defineRoute`: σε 500 έστελνε το
 * `getErrorMessage(err)` στον πελάτη (μηνύματα Firestore/SDK/pdf-lib) και καμία πολιτική
 * cache για ένα έγγραφο με τιμές και στοιχεία προμηθευτή. Μέσα από το factory παίρνει την
 * ασπίδα του ADR-603: `private, no-store` σε κάθε απόκριση, γενικό μήνυμα + `requestId`
 * στο σύρμα, η λεπτομέρεια μόνο στο log.
 *
 * @see ADR-267 Phase B — PDF Export
 * @see ADR-603 API Route-Handler Factory SSoT (§Ασπίδα)
 */

import 'server-only';

import { z } from 'zod';
import { NextResponse } from 'next/server';
import { defineRoute, notFound, httpError } from '@/lib/api/define-route';
import { findOwnedPO } from '@/services/procurement';
import { PO_NOT_FOUND_MESSAGE } from '@/subapps/procurement/services/procurement-rule-error';
import { generatePurchaseOrderPdf } from '@/services/procurement/po-pdf-generator';
import { resolvePODocumentParties } from '@/services/procurement/po-document-parties';
import { poPdfFilename } from '@/services/procurement/po-format';
import { attachmentDisposition } from '@/lib/http/content-disposition';

/** Μόνο οι δύο γλώσσες του εγγράφου· οτιδήποτε άλλο ⇒ ελληνικά (η προεπιλογή που ίσχυε). */
function pdfLanguageOf(raw: string | null): 'el' | 'en' {
  return raw === 'en' ? 'en' : 'el';
}

export const GET = defineRoute<z.ZodTypeAny, { poId: string }>({
  rateLimit: 'standard',
  fallbackError: 'Failed to generate PDF',
  handler: async ({ req, auth, params: { poId } }) => {
    // ADR-742 §7undecies · ADR-923 Λ5 — «δεν υπάρχει» και «δεν είναι δικό σου» = **μία** απάντηση,
    // και ο φράχτης εταιρείας ζει στην υπηρεσία (ίδιος για όλες τις πράξεις PO).
    const po = await findOwnedPO({ caller: auth, poId, action: 'pdf', intent: 'read' });
    if (!po) notFound(PO_NOT_FOUND_MESSAGE);

    // ADR-923 §5.11 «3γ» Α11 — τα μέρη του εγγράφου από ΕΝΑ SSoT (κοινό με το email).
    const parties = await resolvePODocumentParties(auth, po);
    if (!parties.ok) httpError(422, parties.reason);

    const pdfBytes = await generatePurchaseOrderPdf({
      po,
      companyInfo: parties.companyInfo,
      supplierInfo: parties.supplierInfo,
      language: pdfLanguageOf(req.nextUrl.searchParams.get('lang')),
    });

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': attachmentDisposition(poPdfFilename(po.poNumber)),
      },
    });
  },
});
