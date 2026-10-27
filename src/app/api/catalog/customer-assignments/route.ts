/**
 * POST /api/catalog/customer-assignments — νέα ανάθεση συμβαλλομένου σε ΜΙΑ ομάδα πελάτη (ADR-923 §5.11 «3β»).
 * Auth: `catalog:pricing:manage` · Rate: standard · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { createCustomerAssignment } from '@/server/catalog/customer-assignment-writer.server';
import { createCustomerAssignmentBodySchema } from '@/subapps/catalog/schema/zod/price-list-requests.schema';
import { catalogCreateRoute } from '../_shared/catalog-route';

export const POST = catalogCreateRoute({ category: 'STANDARD', authority: 'pricing' }, createCustomerAssignmentBodySchema, (auth, body) =>
  createCustomerAssignment(auth, body.definition),
);
