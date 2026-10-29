/**
 * POST /api/contacts/resolve — Find-or-create contact by VAT/name.
 *
 * Strategy (belt-and-suspenders per GOL):
 *   1. VAT match (deterministic — BG prefix stripped)
 *   2. Email match (deterministic — ADR-327 §8.5 Γ: the invite e-mail of a portal vendor)
 *   3. Fuzzy name match (Greek/Latin tolerant)
 *   4. Create new company contact from extracted data
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
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('ContactResolveRoute');
import { getAdminFirestore, FieldValue } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { EntityAuditService } from '@/services/entity-audit.service';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { createContactServerSide, updateContactField } from '@/services/ai-pipeline/shared/contact-lookup-crud';
import { getErrorMessage } from '@/lib/error-utils';
import { userPerformer } from '@/lib/audit/audit-performer';
import { resolvePerformer, performerStamp } from '@/server/lib/performer-stamp';
import { splitStreetAndNumber } from '@/utils/address/address-parse';
import {
  ResolveContactSchema,
  normalizeVat,
  resolveDisplayName,
  findContactByEmail,
  findContactByName,
  enrichMatchedContact,
} from './resolve-helpers';

async function handlePost(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      const parsed = safeParseBody(ResolveContactSchema, await req.json());
      if (parsed.error) return parsed.error;

      const { vatNumber, name, phone, emails, logoUrl, vendorAddress, vendorCity, vendorPostalCode, vendorCountry, bankAccounts } = parsed.data;
      const normalizedVat = normalizeVat(vatNumber);
      const companyId = ctx.companyId;
      // ADR-195 — ο ΕΝΑΣ φορέας κάθε εγγραφής αυτής της αίτησης (σφραγίδα CDC + γραμμή Ιστορικού).
      const actor = userPerformer(ctx.uid, ctx.email ?? null);
      const adminDb = getAdminFirestore();

      const snap = await adminDb
        .collection(COLLECTIONS.CONTACTS)
        .where('companyId', '==', companyId)
        .where('status', '==', 'active')
        .get();
      const contacts = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown> & { id: string }));

      // ── VAT → email → fuzzy name: ντετερμινιστικά πρώτα (ADR-327 §8.5 Γ: το email της πρόσκλησης) ─────
      const normalizedEmails = (emails ?? []).map((em) => em.trim().toLowerCase()).filter(Boolean);
      const match =
        (normalizedVat ? contacts.find((c) => normalizeVat(c['vatNumber'] as string | undefined) === normalizedVat) : undefined)
        ?? findContactByEmail(contacts, normalizedEmails)
        ?? (name ? findContactByName(contacts, name) : undefined);
      if (match) {
        await enrichMatchedContact(match.id, companyId, actor, resolveDisplayName(match), { emails, bankAccounts, logoUrl });
        return NextResponse.json({ success: true, data: { contactId: match.id, displayName: resolveDisplayName(match), wasCreated: false } });
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
          performer: actor,
          skipDuplicateCheck: false,
        });

        if (normalizedVat) {
          await updateContactField(result.contactId, 'vatNumber', normalizedVat, actor);
        }

        if (vendorAddress || vendorCity) {
          // 🔑 **Μία γραμματική αριθμού για όλο το έργο** (2026-09-02): αυτό ήταν αντίγραφο,
          // χαρακτήρα προς χαρακτήρα, του regex της `parseGreekAddress` — και κανένα από τα
          // δύο δεν ήξερε το «25ης Μαρτίου 12» ή το «8-10». Δες `utils/address/address-parse`.
          const { street: parsedStreet, number: parsedNumber } = splitStreetAndNumber(
            vendorAddress ?? '',
          );
          const addressEntry = {
            street: parsedStreet,
            ...(parsedNumber ? { number: parsedNumber } : {}),
            city: vendorCity ?? '',
            postalCode: vendorPostalCode ?? '',
            country: vendorCountry ?? null,
            type: 'work',
            isPrimary: true,
          };
          const performer = await resolvePerformer(actor);
          const docRef = adminDb.collection(COLLECTIONS.CONTACTS).doc(result.contactId);
          await docRef.update({
            addresses: FieldValue.arrayUnion(addressEntry),
            updatedAt: FieldValue.serverTimestamp(),
            ...performerStamp(performer),
          });
          await EntityAuditService.recordChange({
            entityType: ENTITY_TYPES.CONTACT,
            entityId: result.contactId,
            entityName: result.displayName ?? null,
            action: 'updated',
            changes: [{ field: 'addresses', oldValue: null, newValue: JSON.stringify(addressEntry), label: 'addresses' }],
            performedBy: performer.id,
            performedByName: performer.name,
            companyId,
          });
        }

        await enrichMatchedContact(result.contactId, companyId, actor, result.displayName ?? undefined, { emails, bankAccounts, logoUrl });

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
        logger.error('Contact resolve failed', { msg });
        return NextResponse.json({ success: false, error: msg }, { status: 500 });
      }
    },
  );
  return handler(request);
}

export const POST = withStandardRateLimit(handlePost);
