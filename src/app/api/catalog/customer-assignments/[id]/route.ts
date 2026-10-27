/**
 * PUT    /api/catalog/customer-assignments/[id] — αντικατάσταση (CAS).
 * DELETE /api/catalog/customer-assignments/[id]?expectedRevision=N — soft delete (ο συμβαλλόμενος είναι η ταυτότητα — δεν αλλάζει).
 * Auth: `catalog:pricing:manage` · ADR-923 §5.11 «3β».
 */

import 'server-only';

import { deleteCustomerAssignment, updateCustomerAssignment } from '@/server/catalog/customer-assignment-writer.server';
import { updateCustomerAssignmentBodySchema } from '@/subapps/catalog/schema/zod/price-list-requests.schema';
import { catalogDeleteRoute, catalogEntityRoute } from '../../_shared/catalog-route';

export const PUT = catalogEntityRoute({ category: 'STANDARD', authority: 'pricing' }, updateCustomerAssignmentBodySchema, (auth, id, body) =>
  updateCustomerAssignment(auth, id, body.expectedRevision, body.definition),
);

export const DELETE = catalogDeleteRoute({ category: 'STANDARD', authority: 'pricing' }, deleteCustomerAssignment);
