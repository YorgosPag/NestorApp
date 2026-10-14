/**
 * @fileoverview **Εισαγωγή ΠΕΑ σε ακίνητο του γραφείου** (ADR-777 §8.96) — `POST { fileId }` → πρόταση για το μπλοκ.
 * @related services/energy-certificate/energy-certificate-import.service.ts ·
 *   server/energy-certificate/energy-certificate-import-http.ts (η αδελφή του ιδιώτη μοιράζεται το HTTP)
 *
 * 🔑 **Δεν γράφει το ακίνητο**: η πρόταση εφαρμόζεται στη φόρμα, και αποθηκεύεται με το κανονικό «Αποθήκευση»
 * (`PATCH /api/properties/[id]`, `property-energy-patch.ts`) — ο ΕΝΑΣ γραφέας του `energy`. Γράφει **μόνο** τα γεγονότα
 * του ίδιου του PDF πάνω στο αρχείο (`documentFacts`, ADR-915 Φ3).
 * ⚠️ **`intent: 'write'`**: η εισαγωγή υπάρχει για να γραφτεί το μπλοκ· αποσυρμένο ακίνητο ⇒ 409 πριν διαβαστεί byte.
 * ⚠️ **`SENSITIVE`**: κάθε αίτημα κατεβάζει αρχείο και αναλύει PDF — βαρύ έργο ανά κλήση.
 */

import type { NextRequest } from 'next/server';

import { runGuarded } from '@/lib/api/guarded-route';
import { requirePropertyInTenantScope } from '@/lib/auth/tenant-isolation';
import { utcDateOf } from '@/lib/date-local';
import { readEnergyCertificate } from '@/lib/energy-certificate/energy-certificate';
import { propertyDisplayArea } from '@/lib/properties/property-display-area';
import { isPlainRecord } from '@/lib/type-guards';
import { companyPeaFileScope } from '@/server/energy-certificate/energy-certificate-file-scope';
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
            // Το ΕΝΑ δοχείο του ΠΕΑ — ίδιο με αυτό από το οποίο ο γραφέας διαβάζει τα γεγονότα (ADR-915 Φ3β-2).
            ...companyPeaFileScope(ctx.companyId, id),
            current: readEnergyCertificate(record.energy),
            propertyArea: propertyDisplayArea(record),
            today: utcDateOf(Date.now()) ?? '',
            actorUid: ctx.uid,
          },
          { readPdfText: extractPdfText },
        ),
      );
    },
    'SENSITIVE',
  );
}
