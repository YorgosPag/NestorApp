/**
 * PUT /api/catalog/supplier-profile — το προφίλ του παρόχου: περιγραφή και portfolio (ADR-923 §22 Υ8).
 * Το **πρώτο** αποθηκευμένο έγγραφο ζητά `expectedRevision: 0`. Ίδιο δικαίωμα με τις ρυθμίσεις του καταλόγου.
 * Rate: standard · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { saveSupplierProfile } from '@/server/catalog/supplier-profile-writer.server';
import { saveSupplierProfileBodySchema } from '@/subapps/catalog/schema/zod/product-requests.schema';
import { catalogActionRoute } from '../_shared/catalog-route';

export const PUT = catalogActionRoute({ category: 'STANDARD' }, saveSupplierProfileBodySchema, (auth, body) =>
  saveSupplierProfile(auth, body.expectedRevision, body.definition),
);
