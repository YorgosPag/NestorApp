import { z } from 'zod';
import { previewOwnershipMutationImpact } from '@/lib/firestore/project-ownership-mutation-impact.service';
import { projectPreviewRoute } from '../../_shared/project-preview-route';

const OwnershipImpactRequestSchema = z.object({
  operation: z.enum(['finalize', 'unlock']),
  tableId: z.string().min(1),
  tableVersion: z.number().int().min(0),
  tableStatus: z.enum(['draft', 'finalized', 'registered']),
});

/**
 * @rateLimit STANDARD — επιβάλλεται από τον `projectPreviewRoute` μαζί με την
 * ταυτότητα, το δικαίωμα και τον φύλακα ιδιοκτησίας (ADR-742 §7.8).
 */
export const POST = projectPreviewRoute({
  schema: OwnershipImpactRequestSchema,
  action: 'ownership-impact-preview',
  preview: ({ project, input }) => previewOwnershipMutationImpact(project.id, input),
});
