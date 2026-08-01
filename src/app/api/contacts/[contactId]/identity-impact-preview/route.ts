/**
 * POST /api/contacts/[contactId]/identity-impact-preview
 *
 * ⚠️ Μέχρι τις 2026-08-01 απαντούσε `403 'Access denied - Contact not found'`
 * στην άρνηση ιδιοκτησίας ενώ ο γνήσιος κλάδος απαντά `404 'Contact not found'`:
 * η **μισογραμμένη μεταμφίεση** του ADR-742 §7sexies. Πλέον και τα δύο «όχι»
 * βγαίνουν από το **ίδιο** εργοστάσιο (`contactNotFound`), και ο tenant φτάνει
 * στη μηχανή (§7octies).
 *
 * @module api/contacts/[contactId]/identity-impact-preview
 * @enterprise ADR-742 §7octies
 */

import { z } from 'zod';
import { previewContactIdentityImpact } from '@/lib/firestore/contact-identity-impact-preview.service';
import { INDIVIDUAL_IDENTITY_FIELDS } from '@/utils/contactForm/individual-identity-guard';
import type { ContactIdentityImpactPreview } from '@/types/contact-identity-impact';
import { contactPreviewRouteWithBody } from '../../_shared/contact-preview-route';

const IndividualIdentityFieldSchema = z.enum(INDIVIDUAL_IDENTITY_FIELDS);
const IndividualIdentityFieldCategorySchema = z.enum([
  'display',
  'identity',
  'regulated',
  'administrative',
]);

const ContactIdentityImpactRequestSchema = z.object({
  changes: z.array(z.object({
    field: IndividualIdentityFieldSchema,
    category: IndividualIdentityFieldCategorySchema,
    oldValue: z.string(),
    newValue: z.string(),
    isCleared: z.boolean(),
  })),
});

export const POST = contactPreviewRouteWithBody<
  typeof ContactIdentityImpactRequestSchema,
  ContactIdentityImpactPreview
>({
  schema: ContactIdentityImpactRequestSchema,
  action: 'identity-impact-preview',
  requireType: 'individual',
  wrongTypeMessage: 'Identity impact preview is only available for individual contacts',
  preview: ({ contactId, companyId, input }) =>
    previewContactIdentityImpact(contactId, companyId, input.changes),
});
