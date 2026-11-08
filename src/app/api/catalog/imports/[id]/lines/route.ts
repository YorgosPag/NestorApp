/**
 * POST /api/catalog/imports/[id]/lines — απόφαση για γραμμή πίνακα (αντιστοίχιση · νέα ιδιότητα · αγνόηση · αναίρεση) και
 * ξαναερμηνεία του πίνακά της **χωρίς AI** (ADR-923 §5.5.2 Β3). Άρνηση με λόγο, ποτέ πληρωμένη κλήση.
 * Auth: `catalog:products:manage` (+ `catalog:schema:manage` για δέσιμο νέας ιδιότητας, κρίνεται στον server) ·
 * Rate: sensitive (κατεβάζει και ανασυνθέτει τη σελίδα του PDF) · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { setImportLine } from '@/server/catalog/import-page-reinterpret.server';
import { setImportLineBodySchema } from '@/subapps/catalog/schema/zod/catalog-import.schema';
import { catalogEntityRoute } from '../../../_shared/catalog-route';

/** Λήψη + ανασύνθεση μίας σελίδας, χωρίς μοντέλο: πολύ κάτω από την ανάγνωση. */
export const maxDuration = 120;

export const POST = catalogEntityRoute({ category: 'SENSITIVE', authority: 'products' }, setImportLineBodySchema, (auth, id, body) =>
  setImportLine(auth, id, body),
);
