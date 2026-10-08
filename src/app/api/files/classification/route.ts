/**
 * @fileoverview **POST /api/files/classification** — η διαβάθμιση αρχείων ως πράξη διακομιστή.
 * @related ADR-845 §7.17 (κλάση Ο-35) · services/file-record/file-classification.service
 * @module app/api/files/classification/route
 *
 * Σώμα: `{ fileIds: string[], classification: 'public' | 'internal' | 'confidential' }`
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ — ΚΑΙ ΓΙΑΤΙ **ΔΕΝ** ΛΕΓΕΤΑΙ `classify`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η διαβάθμιση γραφόταν από τον **browser**, και η δημόσια αγγελία δεν το μάθαινε ποτέ: αρχείο
 * που έγινε `internal` έμενε στο δημόσιο ράφι *(μετρημένο ζωντανά 2026-10-08)*. Εδώ η γραφή και η
 * επαναπροβολή γίνονται **στο ίδιο αίτημα**, awaited — όποιος είδε επιτυχία δικαιούται η αγγελία
 * να έχει **ήδη** αλλάξει.
 *
 * ⚠️ Το `/api/files/classify` είναι **πιασμένο και σημαίνει άλλο πράγμα**: την ταξινόμηση
 * **περιεχομένου** από AI *(γράφει `ingestion.*`, ποτέ `classification`)*. Ίδια παγίδα ονόματος με
 * το `'share'` του ημερολογίου αρχείων — γι' αυτό διαφορετική διαδρομή.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 Η ΔΕΣΜΗ ΕΙΝΑΙ ΔΕΔΟΜΕΝΟ ΤΟΥ ΑΙΤΗΜΑΤΟΣ — Ο ΣΚΕΛΕΤΟΣ ΤΗΣ ΕΙΝΑΙ ΚΟΙΝΟΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η οθόνη σημαίνει **πολλά** αρχεία μαζί. Ένα αίτημα ανά αρχείο θα ξαναπρόβαλλε την **ίδια**
 * αγγελία τόσες φορές όσες και οι φωτογραφίες της· εδώ ξαναπροβάλλεται **μία φορά ανά ακίνητο**,
 * αφού γραφτούν όλα. Ο βρόχος, ο PEP και η επαναπροβολή ζουν στο `_shared/file-batch-act`
 * *(κοινά με τον κάδο)*· εδώ μένει **μόνο** ό,τι είναι της διαβάθμισης.
 *
 * ⚠️ **Μερική επιτυχία είναι νόμιμη έκβαση**, ονομασμένη ανά αρχείο (`errors`). Ξένο αρχείο =
 * ανύπαρκτο (κανένα μαντείο ύπαρξης, ADR-742).
 *
 * 🔒 `SENSITIVE`: αλλάζει **ποιος βλέπει τι** — ίδια βαθμίδα με τις πράξεις του δοχείου
 * (`/api/files/[fileId]/cde`). Ρητή δήλωση εδώ, όχι `defineRoute` (CHECK 3.78).
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import {
  isFileClassification,
  writeFileClassification,
  type FileClassificationResponse,
} from '@/services/file-record/file-classification.service';
import {
  batchEnvelope,
  batchRefusal,
  fileActorOf,
  readBatchFileIds,
  readJsonBody,
  runFileBatch,
} from '../_shared/file-batch-act';

export const dynamic = 'force-dynamic';

async function handlePost(
  request: NextRequest,
  ctx: AuthContext,
  _cache: PermissionCache,
): Promise<NextResponse<FileClassificationResponse>> {
  const payload = await readJsonBody(request);
  const { classification } = payload;

  if (!isFileClassification(classification)) return batchRefusal(400, 'classification is invalid', {});
  const fileIds = readBatchFileIds(payload);
  if (typeof fileIds === 'string') return batchRefusal(400, fileIds, {});

  const actor = fileActorOf(ctx);
  const result = await runFileBatch({
    fileIds,
    ctx,
    action: 'classification',
    act: async (file) => {
      const outcome = await writeFileClassification({ ...file, classification, actor });
      if (outcome.kind === 'refused') return { refused: outcome.why };
      return outcome.kind === 'changed' ? { changed: outcome.from } : null;
    },
  });

  return NextResponse.json(batchEnvelope(result));
}

export const POST = withSensitiveRateLimit(withAuth(handlePost));
