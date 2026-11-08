/**
 * POST /api/catalog/imports/[id]/reinterpret — αναβάθμιση μίας σελίδας στην τρέχουσα έκδοση παραγωγής (ADR-923 §5.5.2 Β3.1):
 * ξαναχτίσιμο από τη φυλαγμένη ανάγνωση + το PDF + τις αποφάσεις του ανθρώπου, **χωρίς AI**. Τρέχουσα σελίδα ⇒ καμία εγγραφή.
 * Auth: `catalog:products:manage` · Rate: sensitive (κατεβάζει και ανασυνθέτει τη σελίδα του PDF) · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { reinterpretImportPage } from '@/server/catalog/import-page-rederive.server';
import { readImportPageBodySchema } from '@/subapps/catalog/schema/zod/catalog-import.schema';
import { catalogEntityRoute } from '../../../_shared/catalog-route';

/** Λήψη + ανασύνθεση μίας σελίδας, χωρίς μοντέλο: όπως το `/lines`. */
export const maxDuration = 120;

export const POST = catalogEntityRoute({ category: 'SENSITIVE', authority: 'products' }, readImportPageBodySchema, (auth, id, body) =>
  reinterpretImportPage(auth, id, body.page),
);
