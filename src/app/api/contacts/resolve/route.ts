/**
 * POST /api/contacts/resolve — Find-or-create contact by VAT/name.
 *
 * Strategy (belt-and-suspenders per GOL):
 *   1. VAT match (deterministic — BG prefix stripped)
 *   2. Fuzzy name match (Greek/Latin tolerant)
 *   3. Create new company contact from extracted data
 *
 * Used by quote review page vendor-mismatch banner to switch vendorContactId.
 *
 * @see ADR-327 — Quote Management
 * @see src/subapps/procurement/utils/vendor-mismatch.ts — mismatch detection
 */

import 'server-only';

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { createContactServerSide } from '@/services/ai-pipeline/shared/contact-lookup-crud';
import { updateContactField } from '@/services/ai-pipeline/shared/contact-lookup-crud';
import { fuzzyGreekMatch } from '@/services/ai-pipeline/shared/greek-text-utils';
import { getErrorMessage } from '@/lib/error-utils';

// ============================================================================
// SCHEMA
// ============================================================================

const ResolveContactSchema = z.object({
  vatNumber: z.string().nullable().optional(),
  name: z.string().min(1).nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
});

// ============================================================================
// HELPERS
// ============================================================================

function normalizeVat(vat: string | null | undefined): string {
  if (!vat) return '';
  return vat.replace(/^BG/i, '').replace(/\s/g, '').toLowerCase();
}

const SUFFIX_RE =
  /\b(α\.?ε\.?|ε\.?π\.?ε\.?|ι\.?κ\.?ε\.?|ο\.?ε\.?|еоод|оод|ад|ltd|llc|inc|gmbh|s\.?a\.?|s\.?r\.?l\.?|b\.?v\.?|n\.?v\.?)\b\.?/gi;

function stripLegalSuffix(name: string): string {
  return name.replace(SUFFIX_RE, '').replace(/\s+/g, ' ').trim();
}

function resolveDisplayName(doc: Record<string, unknown>): string {
  return (
    (doc['displayName'] as string | undefined) ??
    (doc['name'] as string | undefined) ??
    [doc['firstName'], doc['lastName']].filter(Boolean).join(' ') ||
    (doc['companyName'] as string | undefined) ??
    ''
  );
}

// ============================================================================
// HANDLER
// ============================================================================

async function handlePost(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      const parsed = safeParseBody(ResolveContactSchema, await req.json());
      if (parsed.error) return parsed.error;

      const { vatNumber, name, phone, email } = parsed.data;
      const normalizedVat = normalizeVat(vatNumber);
      const companyId = ctx.companyId;

      const adminDb = getAdminFirestore();

      // ── Step 1: Load all active contacts for tenant ──────────────────────
      const snap = await adminDb
        .collection(COLLECTIONS.CONTACTS)
        .where('companyId', '==', companyId)
        .where('status', '==', 'active')
        .get();

      const contacts = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown> & { id: string }));

      // ── Step 2: VAT match (deterministic) ────────────────────────────────
      if (normalizedVat) {
        const vatMatch = contacts.find(
          (c) => normalizeVat(c['vatNumber'] as string | undefined) === normalizedVat,
        );
        if (vatMatch) {
          return NextResponse.json({
            success: true,
            data: {
              contactId: vatMatch.id,
              displayName: resolveDisplayName(vatMatch),
              wasCreated: false,
            },
          });
        }
      }

      // ── Step 3: Fuzzy name match ──────────────────────────────────────────
      if (name) {
        const stripped = stripLegalSuffix(name);
        const nameMatch = contacts.find((c) => {
          const cName = resolveDisplayName(c);
          if (!cName) return false;
          const cStripped = stripLegalSuffix(cName);
          return fuzzyGreekMatch(cStripped, stripped) || fuzzyGreekMatch(stripped, cStripped);
        });
        if (nameMatch) {
          return NextResponse.json({
            success: true,
            data: {
              contactId: nameMatch.id,
              displayName: resolveDisplayName(nameMatch),
              wasCreated: false,
            },
          });
        }
      }

      // ── Step 4: Create new company contact ───────────────────────────────
      const companyName = name ?? 'Άγνωστος Προμηθευτής';
      try {
        const result = await createContactServerSide({
          firstName: companyName,
          lastName: '',
          type: 'company',
          companyName,
          email: email ?? null,
          phone: phone ?? null,
          companyId,
          createdBy: ctx.uid,
          skipDuplicateCheck: false,
        });

        // Store VAT on the newly created contact (createContactServerSide doesn't accept vatNumber)
        if (normalizedVat) {
          await updateContactField(result.contactId, 'vatNumber', normalizedVat, ctx.uid);
        }

        return NextResponse.json({
          success: true,
          data: { contactId: result.contactId, displayName: result.displayName, wasCreated: true },
        });
      } catch (err) {
        const msg = getErrorMessage(err);
        // Duplicate detected by createContactServerSide — extract existing contactId
        if (msg.startsWith('DUPLICATE_CONTACT:')) {
          try {
            const jsonPart = msg.split('|||')[1];
            const matches = JSON.parse(jsonPart) as Array<{ contactId: string; name: string }>;
            const first = matches[0];
            if (first) {
              return NextResponse.json({
                success: true,
                data: { contactId: first.contactId, displayName: first.name, wasCreated: false },
              });
            }
          } catch {
            // fall through to generic error
          }
        }
        return NextResponse.json({ success: false, error: msg }, { status: 500 });
      }
    },
  );
  return handler(request);
}

export const POST = withStandardRateLimit(handlePost);
