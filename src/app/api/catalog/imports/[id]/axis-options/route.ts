/**
 * POST /api/catalog/imports/[id]/axis-options — νέες τιμές στον άξονα της παρτίδας **από τον έλεγχο** και δέσιμο της γραμμής του πίνακα
 * που τις τυπώνει, **χωρίς AI** (ADR-923 §5.5.2 Β7). Οι επιλογές γράφονται μόνο από τον γραφέα ιδιοτήτων· άρνηση με λόγο, τίποτα μισό.
 * Auth: `catalog:schema:manage` (αλλάζει ιδιότητα) **και** το δικαίωμα του σκοπού της παρτίδας (κρίνεται στον server) ·
 * Rate: sensitive (κατεβάζει και ανασυνθέτει τη σελίδα του PDF) · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { addImportAxisOptions } from '@/server/catalog/import-axis-options.server';
import { addImportAxisOptionsBodySchema } from '@/subapps/catalog/schema/zod/catalog-import.schema';
import { catalogEntityRoute } from '../../../_shared/catalog-route';

/** Λήψη + ανασύνθεση μίας σελίδας, χωρίς μοντέλο: όπως το `/lines`. */
export const maxDuration = 120;

export const POST = catalogEntityRoute({ category: 'SENSITIVE', authority: 'schema' }, addImportAxisOptionsBodySchema, (auth, id, body) =>
  addImportAxisOptions(auth, id, body),
);
