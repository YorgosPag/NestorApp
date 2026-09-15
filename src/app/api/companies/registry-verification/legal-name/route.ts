/**
 * =============================================================================
 * POST /api/companies/registry-verification/legal-name — «ΥΙΟΘΕΤΗΣΗ ΕΠΩΝΥΜΙΑΣ ΓΕΜΗ»
 * =============================================================================
 *
 * Ο κάτοχος υιοθετεί στο προφίλ την επωνυμία που απάντησε το ΓΕΜΗ (ADR-841 §7 Α23, Φ3.2 Γ).
 *
 * ⚠️ **Ο οργανισμός ΔΕΝ έρχεται από το σώμα** (`ctx.companyId`) · **ούτε η επωνυμία**: το σώμα
 * κουβαλά μόνο το `expectedLegalName` — ό,τι **είδε** ο άνθρωπος — για σύγκριση (CAS). Η τιμή που
 * γράφεται είναι **πάντα** του αποθηκευμένου αντιγράφου ΓΕΜΗ· ένα πεδίο «νέα επωνυμία» εδώ θα
 * επέτρεπε αυτο-επαλήθευση οποιουδήποτε κειμένου.
 *
 * | Έκβαση | HTTP | Σώμα |
 * |---|---|---|
 * | `adopted` · `already-adopted` | 200 | `{ success, data: report }` |
 * | `not-adoptable` | 422 | `{ error: 'NAME_NOT_ADOPTABLE', data: report }` |
 * | `registry-changed` | 409 | `{ error: 'REGISTRY_CHANGED', data: report }` — νέα προεπισκόπηση (AIP-154) |
 *
 * 🔑 **Η πράξη κατέχει τη συνέπειά της** (Α1.6): μετά την απάντηση, `propagateCompanyRename` (βιτρίνα
 * → αγγελίες). Και στο `already-adopted`: ζώνη ασφαλείας — αν η συνέπεια της πρώτης κλήσης απέτυχε, το
 * δεύτερο πάτημα τη διορθώνει· η διάδοση είναι ιδεμποτής.
 *
 * 🔒 `ADMINISTRATIVE_ROLES` · ⏱️ `sensitive`, ρητά (CHECK 3.78 — αλλάζει νομικό στοιχείο).
 *
 * @module api/companies/registry-verification/legal-name
 * @see ADR-841 §7 Α23
 */

import 'server-only';

import { after, NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { readJsonBody } from '@/lib/api/json-body';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { ADMINISTRATIVE_ROLES } from '@/lib/auth/roles';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { propagateCompanyRename } from '@/services/company/company-rename.service';
import {
  adoptRegistryLegalName,
  type LegalNameAdoption,
} from '@/services/company-registry/legal-name-adoption.service';

/** ⚠️ Χωρίς `trim`: η σύγκριση είναι με ό,τι **είδε** ο άνθρωπος, χαρακτήρα προς χαρακτήρα. */
const adoptionSchema = z.object({
  expectedLegalName: z.string().min(1).max(500),
});

/** ⚠️ Κλειστό σύνολο, χωρίς `default` — νέα έκβαση δεν μεταγλωττίζεται μέχρι να αποφασιστεί τι σημαίνει. */
function respond(outcome: LegalNameAdoption): NextResponse {
  switch (outcome.kind) {
    case 'adopted':
    case 'already-adopted':
      return NextResponse.json({ success: true, data: outcome.report });
    case 'not-adoptable':
      return NextResponse.json({ error: 'NAME_NOT_ADOPTABLE', data: outcome.report }, { status: 422 });
    case 'registry-changed':
      return NextResponse.json({ error: 'REGISTRY_CHANGED', data: outcome.report }, { status: 409 });
  }
}

async function handler(request: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  // 🔴 fail-closed, πρότυπο `extractCustomClaims`: *«κενή συμβολοσειρά = απουσία»*.
  const companyId = ctx.companyId?.trim() ?? '';
  if (companyId === '') return NextResponse.json({ error: 'NO_ORGANIZATION' }, { status: 403 });

  const parsed = await readJsonBody(request, adoptionSchema);
  if ('rejected' in parsed) return parsed.rejected;

  const adminDb = getAdminFirestore();
  const outcome = await adoptRegistryLegalName(adminDb, {
    companyId,
    actorUid: ctx.uid,
    expectedLegalName: parsed.data.expectedLegalName,
  });
  if (outcome.kind === 'adopted' || outcome.kind === 'already-adopted') {
    after(() => propagateCompanyRename(adminDb, companyId, ctx.uid));
  }
  return respond(outcome);
}

export const POST = withSensitiveRateLimit(
  withAuth(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => handler(request, ctx),
    { requiredGlobalRoles: ADMINISTRATIVE_ROLES },
  ),
);
