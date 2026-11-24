/**
 * GET / PUT / POST / DELETE /api/companies/self-contact — **η επαφή του χώρου** (ADR-951).
 *
 * - `GET`: κάθε μέλος — ο δεσμός, ή (χωρίς δεσμό) η πρόταση από το ΑΦΜ του προφίλ, **και** `canEdit`.
 * - `PUT` `{ contactId, logoChoice }`: διαχειριστές — σύνδεση υπάρχουσας επαφής. `HEAVY`, όπως το PUT του
 *   λογοτύπου: με `use-contact-image` κάνει την ίδια κανονικοποίηση εικόνας.
 * - `POST`: διαχειριστές — δημιουργία επαφής από τα στοιχεία του χώρου + σύνδεση (μία συναλλαγή).
 * - `DELETE`: διαχειριστές — αποσύνδεση (η επαφή μένει).
 *
 * Αρνήσεις ⇒ **409/422** με κατονομασμένο `refusal` που μεταφράζει ο browser. Βλάβη ανάγνωσης ⇒ **503**
 * `UNAVAILABLE` (μοτίβο του δέντρου), ποτέ άρνηση για δεδομένα που δεν διαβάστηκαν. Ιδεμποτία: το σύνορο του
 * `withAuth` (ADR-872) + ο γραφέας (σύνδεση με την ήδη συνδεδεμένη = τίποτα).
 *
 * @module api/companies/self-contact
 */

import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { ADMINISTRATIVE_ROLES, withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { userPerformer, type AuditPerformer } from '@/lib/audit/audit-performer';
import { withHeavyRateLimit, withSensitiveRateLimit, withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { readSelfContactState } from '@/server/company/self-contact-read.server';
import {
  createSelfContactFromWorkspace,
  linkSelfContact,
  unlinkSelfContact,
  type SelfContactWriteOutcome,
} from '@/server/company/self-contact-store.server';
import {
  SELF_CONTACT_LOGO_CHOICES,
  type SelfContactRefusal,
  type SelfContactResponse,
} from '@/types/company-self-contact';

type SelfContactError =
  | { readonly error: 'NOT_FOUND' | 'INVALID_BODY' | 'UNAVAILABLE' }
  | { readonly error: 'REFUSED'; readonly refusal: SelfContactRefusal };

const LinkBodySchema = z.object({
  contactId: z.string().trim().min(1).max(200),
  logoChoice: z.enum(SELF_CONTACT_LOGO_CHOICES),
}).strict();

/** Οι αρνήσεις κατάστασης (σύγκρουση) ≠ αρνήσεις εισόδου (μη επεξεργάσιμο). */
const CONFLICT_REFUSALS: ReadonlySet<SelfContactRefusal> = new Set(['already-linked', 'contact-inactive']);

/** Το ΙΔΙΟ ταβάνι με τις εγγραφές, ώστε η οθόνη να μη δείχνει ενέργεια που ο server θα αρνηθεί. */
const canEdit = (ctx: AuthContext): boolean => ADMINISTRATIVE_ROLES.includes(ctx.globalRole);

const performerOf = (ctx: AuthContext): AuditPerformer => userPerformer(ctx.uid, ctx.email);

const errorOf = (error: 'NOT_FOUND' | 'UNAVAILABLE') =>
  NextResponse.json<SelfContactError>({ error }, { status: error === 'NOT_FOUND' ? 404 : 503 });

/** Η όψη του `GET` — η ΙΔΙΑ απάντηση για ανάγνωση και για κάθε επιτυχή πράξη. */
async function viewResponse(ctx: AuthContext) {
  const read = await readSelfContactState(ctx.companyId);
  if (read.kind === 'absent') return errorOf('NOT_FOUND');
  if (read.kind === 'unavailable') return errorOf('UNAVAILABLE');
  return NextResponse.json<SelfContactResponse>({ ...read.view, canEdit: canEdit(ctx) });
}

/** Κάθε επιτυχής πράξη απαντά με την ΙΔΙΑ όψη με το `GET` — ο browser δεν συνθέτει κατάσταση μόνος του. */
async function respond(ctx: AuthContext, outcome: SelfContactWriteOutcome) {
  if (outcome.kind === 'absent') return errorOf('NOT_FOUND');
  if (outcome.kind === 'unavailable') return errorOf('UNAVAILABLE');
  if (outcome.kind === 'refused') {
    const status = CONFLICT_REFUSALS.has(outcome.refusal) ? 409 : 422;
    return NextResponse.json<SelfContactError>({ error: 'REFUSED', refusal: outcome.refusal }, { status });
  }
  return viewResponse(ctx);
}

async function handleGet(_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) {
  return viewResponse(ctx);
}

async function handlePut(req: NextRequest, ctx: AuthContext, _cache: PermissionCache) {
  const parsed = LinkBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json<SelfContactError>({ error: 'INVALID_BODY' }, { status: 400 });
  const { contactId, logoChoice } = parsed.data;
  return respond(ctx, await linkSelfContact(ctx.companyId, contactId, logoChoice, performerOf(ctx)));
}

async function handlePost(_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) {
  return respond(ctx, await createSelfContactFromWorkspace(ctx.companyId, performerOf(ctx)));
}

async function handleDelete(_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) {
  return respond(ctx, await unlinkSelfContact(ctx.companyId, performerOf(ctx)));
}

const ADMIN_ONLY = { requiredGlobalRoles: ADMINISTRATIVE_ROLES } as const;

export const GET = withStandardRateLimit(withAuth(handleGet));
export const PUT = withHeavyRateLimit(withAuth(handlePut, ADMIN_ONLY));
export const POST = withSensitiveRateLimit(withAuth(handlePost, ADMIN_ONLY));
export const DELETE = withSensitiveRateLimit(withAuth(handleDelete, ADMIN_ONLY));
