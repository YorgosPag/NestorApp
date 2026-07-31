import { previewProjectMutationImpact } from '@/lib/firestore/project-mutation-impact-preview.service';
import { projectPreviewRoute } from '../../_shared/project-preview-route';
import { ProjectUpdateSchema } from '../project-mutations.types';

/**
 * @rateLimit STANDARD — επιβάλλεται από τον `projectPreviewRoute` μαζί με την
 * ταυτότητα, το δικαίωμα και τον φύλακα ιδιοκτησίας (ADR-742 §7.8).
 */
export const POST = projectPreviewRoute({
  schema: ProjectUpdateSchema,
  action: 'impact-preview',
  preview: ({ project, input }) => previewProjectMutationImpact(project, input),
});
