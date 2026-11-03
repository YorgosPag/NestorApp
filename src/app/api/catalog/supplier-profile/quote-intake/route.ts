/**
 * PUT /api/catalog/supplier-profile/quote-intake — «δέχομαι αιτήματα προσφοράς από τη βιτρίνα» (ADR-923 §5.13 Ε6β).
 * Ίδιο singleton και ίδιο CAS με το προφίλ παρόχου, άλλη πράξη: γράφει μόνο τη ρύθμιση και κρατά περιγραφή και έργα.
 * Ίδιο δικαίωμα με τις ρυθμίσεις του καταλόγου. Rate: standard · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { saveQuoteIntake } from '@/server/catalog/supplier-profile-writer.server';
import { saveQuoteIntakeBodySchema } from '@/subapps/catalog/schema/zod/product-requests.schema';
import { catalogActionRoute } from '../../_shared/catalog-route';

export const PUT = catalogActionRoute({ category: 'STANDARD' }, saveQuoteIntakeBodySchema, (auth, body) =>
  saveQuoteIntake(auth, body.expectedRevision, body.quoteIntake),
);
