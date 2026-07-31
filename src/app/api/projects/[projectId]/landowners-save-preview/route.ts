import { z } from 'zod';
import { previewLandownersSaveImpact } from '@/lib/firestore/project-landowners-save-impact.service';
import { projectPreviewRoute } from '../../_shared/project-preview-route';

const LandownersSavePreviewSchema = z.object({
  landownersChanged: z.boolean(),
  bartexChanged: z.boolean(),
});

/**
 * @rateLimit STANDARD — επιβάλλεται από τον `projectPreviewRoute` μαζί με την
 * ταυτότητα, το δικαίωμα και τον φύλακα ιδιοκτησίας (ADR-742 §7.8).
 */
export const POST = projectPreviewRoute({
  schema: LandownersSavePreviewSchema,
  action: 'landowners-save-preview',
  preview: ({ projectId, input }) => previewLandownersSaveImpact(projectId, input),
});
