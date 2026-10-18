/**
 * @fileoverview **`PUT /api/agency-profile/licences` — «Αυτές είναι οι άδειές μου»** (ADR-915 §21).
 * @related services/mandate/showcase-licence-custody.ts (ο γραφέας) · lib/agency/showcase-licence.ts (ο σχηματισμός) ·
 *   components/mandate/ShowcaseLicencesContent.tsx (η υποσελίδα)
 * @module app/api/agency-profile/licences/route
 *
 * 🔑 **Δική τους πράξη**, όπως η κάρτα (`PUT /api/agency-profile/card`). Καμία `GET`: οι άδειες είναι **δημόσιες** μέσα
 *    στο ίδιο έγγραφο της βιτρίνας, που ο ιδιοκτήτης ήδη διαβάζει (`useAgencyShowcase`).
 * 🔑 **Η αρχή ΠΑΡΑΓΕΤΑΙ από την άδεια**: από το σώμα μόνο «ποια άδεια» και «ποιος αριθμός». Άγνωστη άδεια = 400 (κλειστό
 *    λεξιλόγιο)· κενός αριθμός / διπλή = 422 **ονομαστικά** (`formShowcaseLicences`), όχι «κακό σώμα».
 * 🔒 `withAuth` (το κλειδί είναι το `ctx.companyId`, ποτέ από σώμα) + standard rate limit — ίδια πόρτα με την κάρτα.
 */

import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { PROFESSIONAL_LICENCES } from '@/config/professional-licences';
import { readJsonBody } from '@/lib/api/json-body';
import { formShowcaseLicences, type ShowcaseLicenceRejection } from '@/lib/agency/showcase-licence';
import type { ShowcaseLicencesWire } from '@/lib/agency/showcase-wire';
import { withAuth } from '@/lib/auth/middleware';
import type { AuthContext } from '@/lib/auth/types';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { saveShowcaseLicences } from '@/services/mandate/showcase-licence-custody';
import type { ShowcaseLicence } from '@/types/agency-profile';

/** 🔑 `z.ZodType<ShowcaseLicencesWire>` — νέο πεδίο στο σύρμα **δεν μεταγλωττίζεται** εδώ σιωπηλά. `max` = φρουρός πόρου. */
const licencesSchema: z.ZodType<ShowcaseLicencesWire> = z.object({
  licences: z
    .array(
      z.object({
        licence: z.enum(PROFESSIONAL_LICENCES),
        registrationNumber: z.string().max(64),
        registrationChapter: z.string().max(80).optional(),
      }),
    )
    .max(PROFESSIONAL_LICENCES.length * 2),
});

export type ShowcaseLicencesResponse =
  | { readonly licences: readonly ShowcaseLicence[] }
  | { readonly error: 'INVALID_LICENCES'; readonly reason: ShowcaseLicenceRejection }
  | { readonly error: 'WRITE_FAILED' };

async function saveHandler(request: NextRequest, ctx: AuthContext): Promise<NextResponse<ShowcaseLicencesResponse>> {
  const parsed = await readJsonBody(request, licencesSchema);
  if ('rejected' in parsed) return parsed.rejected;

  const formed = formShowcaseLicences(parsed.data.licences);
  if ('reason' in formed) {
    return NextResponse.json({ error: 'INVALID_LICENCES', reason: formed.reason } as const, { status: 422 });
  }

  const result = await saveShowcaseLicences(getAdminFirestore(), ctx.companyId, formed.licences);
  // `rejected` = και η διπλή δήλωση άδειας που ήδη δίνει η ειδικότητα (ADR-915 §34 Λ5) — κρίνεται στη συναλλαγή.
  switch (result.kind) {
    case 'saved':
      return NextResponse.json({ licences: result.licences });
    case 'rejected':
      return NextResponse.json({ error: 'INVALID_LICENCES', reason: result.reason } as const, { status: 422 });
    case 'failed':
      return NextResponse.json({ error: 'WRITE_FAILED' } as const, { status: 500 });
  }
}

export const PUT = withStandardRateLimit(withAuth<ShowcaseLicencesResponse>(saveHandler));
