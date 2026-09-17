/**
 * @fileoverview **ΕΚΒΑΣΗ ΛΗΨΗΣ ΑΠΟΔΕΙΚΤΙΚΟΥ → HTTP** — μία απόδοση για σύνδεσμο και λογαριασμό (ADR-864 §19).
 * @related services/mandate/mandate-evidence-access.ts ·
 *   app/api/owner-properties/[ownerPropertyId]/mandate-evidence/[evidenceId]/route.ts ·
 *   app/api/mandate/[token]/evidence/[evidenceId]/route.ts
 * @module app/api/owner-properties/_shared/evidence-download-response
 *
 * 🔑 **Βραχύβιο υπογεγραμμένο URL σε JSON** (πρότυπο Autodesk Construction Cloud, `signed-download-url`): τα bytes
 * **δεν** περνούν από τον διακομιστή, ο σύνδεσμος λήγει σε 15′, και φέρει `Content-Disposition: attachment`.
 * ⚠️ **Όχι 307**: η ταυτότητα λογαριασμού ταξιδεύει σε κεφαλίδα `Authorization` (Bearer), που μια πλοήγηση
 * φυλλομετρητή **δεν** στέλνει — ένα `<a href>` θα έπεφτε πάντα σε 401. Ίδιο σχήμα και για τον σύνδεσμο: μία απόδοση.
 * ⚠️ `Cache-Control: no-store` — η απάντηση κουβαλά **μυστικό** (η Google το ονομάζει έτσι)· δεν αποθηκεύεται.
 * ⚠️ **404 για ανύπαρκτο ΚΑΙ ξένο** — ένα σώμα, κανένα μαντείο.
 */

import { NextResponse } from 'next/server';

import type { EvidenceDownload } from '@/services/mandate/mandate-evidence-access';

export function respondToEvidenceDownload(outcome: EvidenceDownload): NextResponse {
  switch (outcome.kind) {
    case 'signed':
      return NextResponse.json({ kind: 'signed', url: outcome.url }, { headers: { 'Cache-Control': 'no-store' } });
    case 'absent':
      return NextResponse.json({ kind: 'absent' }, { status: 404 });
    case 'failed':
      return NextResponse.json({ kind: 'failed' }, { status: 500 });
  }
}
