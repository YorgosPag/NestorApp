import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { apiSuccess, ApiError, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { isRoleBypass } from '@/lib/auth/roles';
import { previewContactIdentityImpact } from '@/lib/firestore/contact-identity-impact-preview.service';
import { INDIVIDUAL_IDENTITY_FIELDS } from '@/utils/contactForm/individual-identity-guard';
import type { ContactIdentityImpactPreview } from '@/types/contact-identity-impact';
import type { Contact } from '@/types/contacts';

const IndividualIdentityFieldSchema = z.enum(INDIVIDUAL_IDENTITY_FIELDS);
const IndividualIdentityFieldCategorySchema = z.enum(['display', 'identity', 'regulated']);

const ContactIdentityImpactRequestSchema = z.object({
  changes: z.array(z.object({
    field: IndividualIdentityFieldSchema,
    category: IndividualIdentityFieldCategorySchema,
    oldValue: z.string(),
    newValue: z.string(),
    isCleared: z.boolean(),
  })),
});

async function handlePost(
  request: NextRequest,
  segmentData?: { params: Promise<{ contactId: string }> },
): Promise<NextResponse> {
  const { contactId } = await segmentData!.params;

  const handler = withAuth<ApiSuccessResponse<ContactIdentityImpactPreview>>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      const parsed = safeParseBody(ContactIdentityImpactRequestSchema, await req.json());
      if (parsed.error) {
        return parsed.error;
      }

      const db = getAdminFirestore();
      const contactDoc = await db.collection(COLLECTIONS.CONTACTS).doc(contactId).get();
      if (!contactDoc.exists) {
        throw new ApiError(404, 'Contact not found');
      }

      const contact = { id: contactDoc.id, ...(contactDoc.data() ?? {}) } as Contact;
      const isSuperAdmin = isRoleBypass(ctx.globalRole);

      if (!isSuperAdmin && contact.companyId !== ctx.companyId) {
        throw new ApiError(403, 'Access denied - Contact not found');
      }

      if (contact.type !== 'individual') {
        throw new ApiError(400, 'Identity impact preview is only available for individual contacts');
      }

      const preview = await previewContactIdentityImpact(contactId, parsed.data.changes);
      return apiSuccess(preview);
    },
    { permissions: 'crm:contacts:update' },
  );

  return handler(request);
}

export const POST = withStandardRateLimit(handlePost);
