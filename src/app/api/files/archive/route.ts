/**
 * @fileoverview **POST /api/files/archive** — αρχειοθέτηση και επαναφορά από το αρχείο, ως πράξη με κριτή.
 * @related ADR-845 §7.17 Α3 (κλάση Ο-35) · ADR-191 §3.2 · services/file-record/file-archive.service
 * @module app/api/files/archive/route
 *
 * Σώμα: `{ fileIds: string[], action?: 'archive' | 'unarchive' }` — απόν `action` ⇒ `archive`.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΞΑΝΑΓΡΑΦΤΗΚΕ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η διαδρομή έγραφε μόνη της, μέσα σε δικό της βρόχο: φωτογραφία που αρχειοθετήθηκε **έμενε** στη
 * δημόσια αγγελία, το ίχνος ήταν αόρατο *(χωρίς `companyId`)*, και το δικαίωμα δημοσίευσης της
 * διαβάθμισης παρακαμπτόταν. Τώρα φέρνει **μόνο** τον γραφέα της· PEP, αρνήσεις και
 * **επαναπροβολή** είναι του κοινού σκελετού *(`runFileBatch`)* — τρίτη πόρτα, ένα σώμα.
 *
 * 🔒 `SENSITIVE` και όχι `STANDARD` όπως πριν: κατεβάζει ή ξαναβγάζει υλικό στο κοινό — ίδια
 * βαθμίδα με τη διαβάθμιση και τον κάδο. Ρητή δήλωση εδώ, όχι `defineRoute` (CHECK 3.78).
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import type { FileBatchActResponse } from '@/services/file-record/file-batch-act.types';
import {
  isFileArchiveAction,
  writeFileArchiveState,
  type FileArchiveAction,
} from '@/services/file-record/file-archive.service';
import {
  batchRefusal,
  noBatchExtra,
  readJsonBody,
  runFileBatch,
  verdictOf,
} from '../_shared/file-batch-act';

export const dynamic = 'force-dynamic';

/** Η προεπιλογή του σύρματος — ό,τι έκανε πάντα ένα σώμα χωρίς `action`. */
const DEFAULT_ACTION: FileArchiveAction = 'archive';

async function handlePost(
  request: NextRequest,
  ctx: AuthContext,
  _cache: PermissionCache,
): Promise<NextResponse<FileBatchActResponse>> {
  const payload = await readJsonBody(request);
  const action = payload.action ?? DEFAULT_ACTION;

  if (!isFileArchiveAction(action)) return batchRefusal(400, 'action is invalid', noBatchExtra());

  return runFileBatch({
    payload,
    ctx,
    action: `archive:${action}`,
    extra: noBatchExtra,
    act: async (file, actor) => verdictOf(await writeFileArchiveState({ ...file, action, actor }), action),
  });
}

export const POST = withSensitiveRateLimit(withAuth(handlePost));
