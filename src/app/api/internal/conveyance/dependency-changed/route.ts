/**
 * POST /api/internal/conveyance/dependency-changed — ADR-905 §6 (Στάδιο 3, CDC).
 *
 * Καλείται **μόνο** από τα Cloud Functions `onConveyance{File,Property,Project}Write`, υπογεγραμμένα. Λεπτό: η πόρτα κρίνει
 * υπογραφή + ιδεμποτία, η υπηρεσία κρίνει ποιες όψεις άλλαξαν και ζητά σήμα από τον ΕΝΑ γραφέα.
 *
 * 🔑 **Δύο καταναλωτές της ίδιας ροής αρχείων** (ADR-915 §20): (1) τα σήματα όψεων της μεταβίβασης · (2) η ανάγνωση
 * κειμένου εγγράφου στο ανέβασμα (`readDocumentTextOnFileChange`). Σειρά: **πρώτα** τα σήματα — μια βλάβη της ανάγνωσης
 * (5xx ⇒ επανάληψη) δεν επιτρέπεται να καθυστερήσει την όψη· η επανάληψη ξανατρέχει και τα δύο, και τα δύο αντέχουν.
 *
 * Ρυθμός (§8 Ε3) — δύο κάδοι: ανάχωμα ανά IP **πριν** την υπογραφή (`INTERNAL_WEBHOOK`) · προϋπολογισμός ανά **πηγή**
 * **μετά** την υπογραφή (`INTERNAL_WEBHOOK_SOURCE_QUOTA`, μέσα στην πόρτα).
 */

import 'server-only';

import { NextResponse } from 'next/server';

import { parseDependencyChangeEvent } from '@/lib/conveyance/dependency-change-event';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { INTERNAL_WEBHOOK_SOURCE_QUOTA } from '@/lib/middleware/rate-limit-config';
import { withInternalWebhookRateLimit } from '@/lib/middleware/with-rate-limit';
import { readDocumentTextOnFileChange } from '@/server/files/document-text-on-file-change';
import { withSignedInternalWebhook } from '@/server/internal-webhooks/signed-webhook-door';
import { relayDependencyChange } from '@/services/conveyance/conveyance-dependency-relay.server';
import { extractPdfText } from '@/services/pdf/pdf-rasterize.service';

export const dynamic = 'force-dynamic';

async function handleDependencyChange(body: unknown): Promise<NextResponse> {
  const event = parseDependencyChangeEvent(body);
  if (!event) return NextResponse.json({ ok: false, error: 'invalid_event' }, { status: 400 });
  const db = getAdminFirestore();
  const outcome = await relayDependencyChange(db, event);
  const documentText = await readDocumentTextOnFileChange(db, event, { readPdfText: extractPdfText });
  return NextResponse.json({ ok: true, ...outcome, documentText: documentText?.kind ?? null });
}

export const POST = withInternalWebhookRateLimit(
  withSignedInternalWebhook({ source: 'conveyance-dependency', quota: INTERNAL_WEBHOOK_SOURCE_QUOTA }, handleDependencyChange),
);
