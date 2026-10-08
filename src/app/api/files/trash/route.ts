/**
 * @fileoverview **POST /api/files/trash** — κάδος και επαναφορά εταιρικών αρχείων ως πράξη διακομιστή.
 * @related ADR-845 §7.17 Α2 (κλάση Ο-35) · services/file-record/file-trash.service
 * @module app/api/files/trash/route
 *
 * Σώμα: `{ fileIds: string[], action: 'trash' | 'restore' }`
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο κάδος γραφόταν από τον **browser**: φωτογραφία που πετάχτηκε έμενε στη δημόσια αγγελία, το
 * ίχνος μπορούσε να λείπει, και το δικαίωμα δημοσίευσης της διαβάθμισης παρακαμπτόταν με
 * βαρύτερη πράξη. Εδώ κρίση, γραφή, ίχνος και επαναπροβολή γίνονται **στο ίδιο αίτημα**.
 *
 * 🗂️ **Μόνο το εταιρικό διαμέρισμα** (`files`): ο κάδος των **προσωπικών** αρχείων μένει στον
 * πελάτη, ατομικά ζευγαρωμένος με τη γραμμή δραστηριότητάς του από τους κανόνες (ADR-866 §2.6.11).
 *
 * 🔑 **Η απάντηση φέρει τα αλλαγμένα αρχεία** (`files`): ο πελάτης εκπέμπει το `FILE_TRASHED` /
 * `FILE_RESTORED` **μετά** την επιβεβαίωση, με ό,τι έγραψε πραγματικά ο διακομιστής — ποτέ με
 * ό,τι *νόμιζε* ότι θα γραφτεί.
 *
 * 🔒 `SENSITIVE`: κατεβάζει ή ξαναβγάζει υλικό στο κοινό — ίδια βαθμίδα με τη διαβάθμιση. Ρητή
 * δήλωση εδώ, όχι `defineRoute` (CHECK 3.78).
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import type {
  FileTrashChange,
  FileTrashResponse,
} from '@/services/file-record/file-batch-act.types';
import {
  createLivePropertyProbe,
  isFileTrashAction,
  writeFileTrashState,
} from '@/services/file-record/file-trash.service';
import {
  batchRefusal,
  readJsonBody,
  runFileBatch,
  verdictOf,
  type ChangedBatchFile,
  type OwnedBatchFile,
} from '../_shared/file-batch-act';

export const dynamic = 'force-dynamic';

/** Το πεδίο ως συμβολοσειρά, ή τίποτα — η βάση δεν εγγυάται σχήμα. */
function textOf(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** Ό,τι χρειάζεται το γεγονός του πελάτη για ένα αρχείο που άλλαξε. */
function changeOf(file: OwnedBatchFile, purgeAt: string | null): FileTrashChange {
  return {
    fileId: file.fileId,
    purgeAt,
    displayName: textOf(file.data.displayName),
    entityId: textOf(file.data.entityId),
    entityType: textOf(file.data.entityType),
  };
}

/** Το `files` του σύρματος — ό,τι **άλλαξε**, κενό στην άρνηση ολόκληρου του αιτήματος. */
function filesOf(
  changed: readonly ChangedBatchFile<string | null>[],
): { readonly files: readonly FileTrashChange[] } {
  return { files: changed.map(({ file, detail }) => changeOf(file, detail)) };
}

async function handlePost(
  request: NextRequest,
  ctx: AuthContext,
  _cache: PermissionCache,
): Promise<NextResponse<FileTrashResponse>> {
  const payload = await readJsonBody(request);
  const { action } = payload;

  if (!isFileTrashAction(action)) return batchRefusal(400, 'action is invalid', filesOf([]));

  // Μία ανάγνωση ανά ακίνητο για όλη τη δέσμη — 30 φωτογραφίες του ίδιου ακινήτου, ένα ερώτημα.
  const propertyIsLive = createLivePropertyProbe(getAdminFirestore());

  return runFileBatch({
    payload,
    ctx,
    action: `trash:${action}`,
    extra: filesOf,
    act: async (file, actor) => {
      const outcome = await writeFileTrashState({ ...file, action, actor, propertyIsLive });
      return verdictOf(outcome, outcome.kind === 'changed' ? outcome.purgeAt : null);
    },
  });
}

export const POST = withSensitiveRateLimit(withAuth(handlePost));
