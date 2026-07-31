import { z } from 'zod';
import { previewBrokerTerminateImpact } from '@/lib/firestore/project-broker-terminate-impact.service';
import { projectPreviewRoute } from '../../_shared/project-preview-route';

const BrokerTerminateRequestSchema = z.object({
  agreementId: z.string().min(1).max(128),
});

/**
 * @rateLimit STANDARD — επιβάλλεται από τον `projectPreviewRoute` μαζί με την
 * ταυτότητα, το δικαίωμα και τον φύλακα ιδιοκτησίας (ADR-742 §7.8).
 *
 * ⚠️ Μοναδική στις έξι: ο υπολογισμός δέχεται τον tenant του **καλούντα**
 * (`ctx.companyId`), όχι του έργου. Διατηρείται αυτούσιο — η Ομάδα 3 άλλαξε
 * *τι λέμε στην άρνηση*, όχι *ποιος βλέπει τι* (ADR-742 §7ter.3).
 */
export const POST = projectPreviewRoute({
  schema: BrokerTerminateRequestSchema,
  action: 'broker-terminate-preview',
  preview: ({ input, ctx }) => previewBrokerTerminateImpact(input, ctx.companyId),
});
