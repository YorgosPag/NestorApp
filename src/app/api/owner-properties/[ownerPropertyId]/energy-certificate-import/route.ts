/**
 * @fileoverview **Εισαγωγή ΠΕΑ σε αγγελία ιδιώτη** (ADR-777 §8.96) — `POST { fileId }` → πρόταση για το μπλοκ.
 * @related services/energy-certificate/energy-certificate-import.service.ts ·
 *   server/energy-certificate/energy-certificate-import-http.ts (η αδελφή του γραφείου μοιράζεται το HTTP)
 *
 * 🔑 **Το ΠΕΑ ζει στον ΦΑΚΕΛΟ του ακινήτου** (`property_dossier`, `files_personal`, ADR-866): εκεί το ανεβάζει η οθόνη,
 * άρα εκεί εμφανίζεται στα «Έγγραφα». Αγγελία χωρίς φάκελο, ή σε χώρο γραφείου ⇒ κανένα αρχείο δεν της ανήκει.
 * 🔑 **Δεν γράφει τίποτα**: η εφαρμογή περνά από το `PATCH /api/owner-properties/[id]` (`setOwnerPropertyEnergyCertificate`).
 * 🔒 Ξένη αγγελία ⇒ 404, ποτέ «υπάρχει» (`mayAdminister`, ίδιος φράχτης με την εγγραφή).
 */

import { NextResponse, type NextRequest } from 'next/server';

import { COLLECTIONS } from '@/config/firestore-collections';
import { listingActorOf, withPersonalOrOrgAuth, type ApiActor } from '@/lib/auth/personal-scope-middleware';
import { utcDateOf } from '@/lib/date-local';
import { readEnergyCertificate } from '@/lib/energy-certificate/energy-certificate';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { custodyOf, mayAdminister } from '@/lib/owner-property/listing-custody';
import { ownerPropertyFromDocument } from '@/lib/owner-property/owner-property-from-document';
import { ownerPeaFileScope } from '@/server/energy-certificate/energy-certificate-file-scope';
import {
  respondToEnergyCertificateImport,
  type EnergyCertificateImportBody,
} from '@/server/energy-certificate/energy-certificate-import-http';
import { proposeEnergyCertificateImport } from '@/services/energy-certificate/energy-certificate-import.service';
import { extractPdfText } from '@/services/pdf/pdf-rasterize.service';
import type { OwnerProperty } from '@/types/owner-property';

type RouteContext = { params: Promise<{ ownerPropertyId: string }> };

type Body = EnergyCertificateImportBody | { readonly error: 'NOT_FOUND' };

/** Η αγγελία, **μόνο** αν τη διαχειρίζεται ο καλών — αλλιώς `null` (⇒ 404). */
async function administeredProperty(ownerPropertyId: string, actor: ApiActor): Promise<OwnerProperty | null> {
  const snap = await getAdminFirestore().collection(COLLECTIONS.OWNER_PROPERTIES).doc(ownerPropertyId).get();
  const property = ownerPropertyFromDocument(snap.data(), ownerPropertyId);
  if (property === null || !mayAdminister(custodyOf(property), listingActorOf(actor))) return null;
  return property;
}

async function handler(request: NextRequest, actor: ApiActor, context?: RouteContext): Promise<NextResponse<Body>> {
  const ownerPropertyId = (await context?.params)?.ownerPropertyId?.trim() ?? '';
  const property = ownerPropertyId === '' ? null : await administeredProperty(ownerPropertyId, actor);
  if (property === null) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

  return respondToEnergyCertificateImport(request, ownerPropertyId, (fileId) =>
    proposeEnergyCertificateImport(
      getAdminFirestore(),
      fileId,
      {
        // Το ΕΝΑ δοχείο του ΠΕΑ — ίδιο με αυτό από το οποίο ο γραφέας διαβάζει τα γεγονότα (ADR-915 Φ3β-2).
        ...ownerPeaFileScope(actor.ctx.uid, property),
        current: readEnergyCertificate(property.energy),
        propertyArea: property.areaSqm,
        today: utcDateOf(Date.now()) ?? '',
        actorUid: actor.ctx.uid,
      },
      { readPdfText: extractPdfText },
    ),
  );
}

export const POST = withSensitiveRateLimit(withPersonalOrOrgAuth<Body, RouteContext>(handler));
