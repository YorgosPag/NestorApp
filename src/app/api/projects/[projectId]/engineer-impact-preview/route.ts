import { z } from 'zod';
import { previewEngineerRemoveImpact } from '@/lib/firestore/project-engineer-remove-impact.service';
import { projectPreviewRoute } from '../../_shared/project-preview-route';

const EngineerImpactRequestSchema = z.object({
  contactId: z.string().min(1),
  role: z.string().min(1),
});

/**
 * @rateLimit STANDARD — επιβάλλεται από τον `projectPreviewRoute` μαζί με την
 * ταυτότητα, το δικαίωμα και τον φύλακα ιδιοκτησίας (ADR-742 §7.8).
 */
export const POST = projectPreviewRoute({
  schema: EngineerImpactRequestSchema,
  action: 'engineer-impact-preview',
  preview: ({ projectId, input }) => previewEngineerRemoveImpact(projectId, input),
});
