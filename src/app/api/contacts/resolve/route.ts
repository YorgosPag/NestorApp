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

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore, FieldValue } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { EntityAuditService } from '@/services/entity-audit.service';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { createContactServerSide, updateContactField } from '@/services/ai-pipeline/shared/contact-lookup-crud';
import { fuzzyGreekMatch } from '@/services/ai-pipeline/shared/greek-text-utils';
import { getErrorMessage } from '@/lib/error-utils';
import {
  ResolveContactSchema,
  normalizeVat,
  stripLegalSuffix,
  resolveDisplayName,
  storeContactEmail,
  storeBankAccounts,
  ensureSupplierPersona,
  setContactLogoIfEmpty,
} from './resolve-helpers';

async function handlePost(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      const parsed = safeParseBody(ResolveContactSchema, await req.json());
      if (parsed.error) return parsed.error;

      const { vatNumber, name, phone, emails, logoUrl, vendorAddress, vendorCity, vendorPostalCode, vendorCountry, bankAccounts } = parsed.data;
      const normalizedVat = normalizeVat(vatNumber);
      const companyId = ctx.companyId;
      const adminDb = getAdminFirestore();

      const snap = await adminDb
        .collection(COLLECTIONS.CONTACTS)
        .where('companyId', '==', companyId)
        .where('status', '==', 'active')
        .get();
      const contacts = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown> & { id: string }));

      // ── VAT match (deterministic) ─────────────────────────────────────────
      if (normalizedVat) {
        const vatMatch = contacts.find(
          (c) => normalizeVat(c['vatNumber'] as string | undefined) === normalizedVat,
        );
        if (vatMatch) {
          await ensureSupplierPersona(vatMatch.id, companyId, ctx.uid);
          if (bankAccounts?.length) await storeBankAccounts(vatMatch.id, companyId, ctx.uid, bankAccounts, resolveDisplayName(vatMatch));
          logger.info('Storing emails for VAT-matched contact', { contactId: vatMatch.id, emailCount: (emails ?? []).length, emails: emails ?? [] });
          for (const em of emails ?? []) { if (em) await storeContactEmail(vatMatch.id, companyId, ctx.uid, em); }
          if (logoUrl) await setContactLogoIfEmpty(vatMatch.id, companyId, ctx.uid, logoUrl);
          return NextResponse.json({ success: true, data: { contactId: vatMatch.id, displayName: resolveDisplayName(vatMatch), wasCreated: false } });
        }
      }

      // ── Fuzzy name match ──────────────────────────────────────────────────
      if (name) {
        const stripped = stripLegalSuffix(name);
        const nameMatch = contacts.find((c) => {
          const cName = resolveDisplayName(c);
          if (!cName) return false;
          const cStripped = stripLegalSuffix(cName);
          return fuzzyGreekMatch(cStripped, stripped) || fuzzyGreekMatch(stripped, cStripped);
        });
        if (nameMatch) {
          await ensureSupplierPersona(nameMatch.id, companyId, ctx.uid);
          if (bankAccounts?.length) await storeBankAccounts(nameMatch.id, companyId, ctx.uid, bankAccounts, resolveDisplayName(nameMatch));
          for (const em of emails ?? []) { if (em) await storeContactEmail(nameMatch.id, companyId, ctx.uid, em); }
          if (logoUrl) await setContactLogoIfEmpty(nameMatch.id, companyId, ctx.uid, logoUrl);
          return NextResponse.json({ success: true, data: { contactId: nameMatch.id, displayName: resolveDisplayName(nameMatch), wasCreated: false } });
        }
      }

      // ── Create new company contact ────────────────────────────────────────
      const companyName = name ?? 'Άγνωστος Προμηθευτής';
      try {
        const result = await createContactServerSide({
          firstName: companyName,
          lastName: '',
          type: 'company',
          companyName,
          email: null,  // stored separately via storeContactEmail with inferred type
          phone: phone ?? null,
          companyId,
          createdBy: ctx.uid,
          skipDuplicateCheck: false,
        });

        if (normalizedVat) {
          await updateContactField(result.contactId, 'vatNumber', normalizedVat, ctx.uid);
        }

        if (vendorAddress || vendorCity) {
          const addressEntry = {
            street: vendorAddress ?? '',
            city: vendorCity ?? '',
            postalCode: vendorPostalCode ?? '',
            country: vendorCountry ?? null,
            type: 'work',
            isPrimary: true,
          };
          const docRef = adminDb.collection(COLLECTIONS.CONTACTS).doc(result.contactId);
          await docRef.update({
            addresses: FieldValue.arrayUnion(addressEntry),
            updatedAt: FieldValue.serverTimestamp(),
            lastModifiedBy: ctx.uid,
          });
          await EntityAuditService.recordChange({
            entityType: ENTITY_TYPES.CONTACT,
            entityId: result.contactId,
            entityName: result.displayName ?? null,
            action: 'updated',
            changes: [{ field: 'addresses', oldValue: null, newValue: JSON.stringify(addressEntry), label: 'addresses' }],
            performedBy: ctx.uid,
            performedByName: ctx.uid,
            companyId,
          });
        }

        await ensureSupplierPersona(result.contactId, companyId, ctx.uid);
        logger.info('Storing emails for new contact', { contactId: result.contactId, emailCount: (emails ?? []).length, emails: emails ?? [] });
        for (const em of emails ?? []) { if (em) await storeContactEmail(result.contactId, companyId, ctx.uid, em); }
        if (logoUrl) await setContactLogoIfEmpty(result.contactId, companyId, ctx.uid, logoUrl);
        if (bankAccounts?.length) await storeBankAccounts(result.contactId, companyId, ctx.uid, bankAccounts, result.displayName ?? undefined);

        return NextResponse.json({
          success: true,
          data: { contactId: result.contactId, displayName: result.displayName, wasCreated: true },
        });
      } catch (err) {
        const msg = getErrorMessage(err);
        if (msg.startsWith('DUPLICATE_CONTACT:')) {
          try {
            const jsonPart = msg.split('|||')[1];
            const matches = JSON.parse(jsonPart) as Array<{ contactId: string; name: string }>;
            const first = matches[0];
            if (first) {
              return NextResponse.json({ success: true, data: { contactId: first.contactId, displayName: first.name, wasCreated: false } });
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
