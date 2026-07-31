import { z } from 'zod';
import { projectAddressSchema } from '@/types/project/address-schemas';
import { previewProjectAddressMutationImpact } from '@/lib/firestore/project-address-mutation-impact.service';
import { projectPreviewRoute } from '../../_shared/project-preview-route';

const ProjectAddressOperationSchema = z.enum(['add', 'edit', 'delete', 'set-primary']);

const AddressImpactRequestSchema = z.object({
  operation: ProjectAddressOperationSchema,
  address: projectAddressSchema,
  previousAddress: projectAddressSchema.optional(),
});

/**
 * @rateLimit STANDARD — επιβάλλεται από τον `projectPreviewRoute` μαζί με την
 * ταυτότητα, το δικαίωμα και τον φύλακα ιδιοκτησίας (ADR-742 §7.8).
 */
export const POST = projectPreviewRoute({
  schema: AddressImpactRequestSchema,
  action: 'address-impact-preview',
  preview: ({ project, input }) => previewProjectAddressMutationImpact(project, input),
});
