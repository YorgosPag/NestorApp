/**
 * @fileoverview **Εισαγωγή ΠΕΑ σε ακίνητο του γραφείου** (ADR-777 §8.96) — `POST { fileId }` → πρόταση για το μπλοκ.
 * @related services/energy-certificate/energy-certificate-import.service.ts ·
 *   server/energy-certificate/energy-certificate-import-http.ts (η αδελφή του ιδιώτη μοιράζεται το HTTP)
 *
 * 🔑 **Δεν γράφει τίποτα**: η πρόταση εφαρμόζεται στη φόρμα, και αποθηκεύεται με το κανονικό «Αποθήκευση»
 * (`PATCH /api/properties/[id]`, `property-energy-patch.ts`) — ο ΕΝΑΣ γραφέας του `energy`.
 * ⚠️ **`intent: 'write'`**: η εισαγωγή υπάρχει για να γραφτεί το μπλοκ· αποσυρμένο ακίνητο ⇒ 409 πριν διαβαστεί byte.
 * ⚠️ **`SENSITIVE`**: κάθε αίτημα κατεβάζει αρχείο και αναλύει PDF — βαρύ έργο ανά κλήση.
 */

import type { NextRequest } from 'next/server';

import { ENTITY_TYPES } from '@/config/domain-constants';
import { COLLECTIONS } from '@/config/firestore-collections';
import { runGuarded } from '@/lib/api/guarded-route';
import { requirePropertyInTenantScope } from '@/lib/auth/tenant-isolation';
import { utcDateOf } from '@/lib/date-local';
import { readEnergyCertificate } from '@/lib/energy-certificate/energy-certificate';
import { propertyDisplayArea } from '@/lib/properties/property-display-area';
import { isPlainRecord } from '@/lib/type-guards';
import {
  respondToEnergyCertificateImport,
  type EnergyCertificateImportBody,
} from '@/server/energy-certificate/energy-certificate-import-http';
import { proposeEnergyCertificateImport } from '@/services/energy-certificate/energy-certificate-import.service';
import { extractPdfText } from '@/services/pdf/pdf-rasterize.service';

const PATH = '/api/properties/[id]/energy-certificate-import';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, segment: RouteContext): Promise<Response> {
  const { id } = await segment.params;
  return runGuarded<EnergyCertificateImportBody>(
    request,
    'properties:properties:update',
    async ({ req, ctx, adminDb }) => {
      const property = await requirePropertyInTenantScope({ ctx, propertyId: id, path: PATH, intent: 'write' });
      const record = isPlainRecord(property) ? property : {};
      return respondToEnergyCertificateImport(req, id, (fileId) =>
        proposeEnergyCertificateImport(
          adminDb,
          fileId,
          {
            fileCollection: COLLECTIONS.FILES,
            // Ο κάτοχος = η εταιρεία της ΣΥΝΕΔΡΙΑΣ, ακριβώς όπως ανεβάζει η καρτέλα «Έγγραφα»
            // (`usePropertyFilesTab` → `custody: { companyId }`). Η εμβέλεια στο ακίνητο την κρίνει ήδη ο φρουρός μισθωτή.
            container: {
              owner: { kind: 'company', companyId: ctx.companyId },
              entityType: ENTITY_TYPES.PROPERTY,
              entityId: id,
            },
            current: readEnergyCertificate(record.energy),
            propertyArea: propertyDisplayArea(record),
            today: utcDateOf(Date.now()) ?? '',
          },
          { readPdfText: extractPdfText },
        ),
      );
    },
    'SENSITIVE',
  );
}
