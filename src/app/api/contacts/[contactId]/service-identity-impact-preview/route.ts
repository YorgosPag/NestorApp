/**
 * POST /api/contacts/[contactId]/service-identity-impact-preview
 *
 * ⚠️ Βλ. `identity-impact-preview` — ήταν το **δίδυμό** του, με την ίδια
 * μισογραμμένη μεταμφίεση `403` (ADR-742 §7sexies) και τον ίδιο tenant που δεν
 * έφτανε ποτέ στη μηχανή (§7octies).
 *
 * @module api/contacts/[contactId]/service-identity-impact-preview
 * @enterprise ADR-742 §7octies
 */

import { z } from 'zod';
import { previewServiceIdentityImpact } from '@/lib/firestore/service-identity-impact-preview.service';
import { SERVICE_IDENTITY_FIELDS } from '@/utils/contactForm/service-identity-guard';
import type { ContactIdentityImpactPreview } from '@/types/contact-identity-impact';
import { contactPreviewRouteWithBody } from '../../_shared/contact-preview-route';

const ServiceIdentityFieldSchema = z.enum(SERVICE_IDENTITY_FIELDS);
const ServiceIdentityFieldCategorySchema = z.enum(['display', 'administrative']);

const ServiceIdentityImpactRequestSchema = z.object({
  changes: z.array(z.object({
    field: ServiceIdentityFieldSchema,
    category: ServiceIdentityFieldCategorySchema,
    oldValue: z.string(),
    newValue: z.string(),
    isCleared: z.boolean(),
  })),
});

export const POST = contactPreviewRouteWithBody<
  typeof ServiceIdentityImpactRequestSchema,
  ContactIdentityImpactPreview
>({
  schema: ServiceIdentityImpactRequestSchema,
  action: 'service-identity-impact-preview',
  requireType: 'service',
  wrongTypeMessage: 'Identity impact preview is only available for service contacts',
  preview: ({ contactId, companyId, input }) =>
    previewServiceIdentityImpact(contactId, companyId, input.changes),
});
