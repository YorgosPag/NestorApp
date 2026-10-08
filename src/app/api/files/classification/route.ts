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
 * 🔑 Η ΔΕΣΜΗ ΕΙΝΑΙ ΔΕΔΟΜΕΝΟ ΤΟΥ ΑΙΤΗΜΑΤΟΣ — ΙΔΙΟ ΣΧΗΜΑ ΜΕ ΤΟ `archive`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η οθόνη σημαίνει **πολλά** αρχεία μαζί. Ένα αίτημα ανά αρχείο θα ξαναπρόβαλλε την **ίδια**
 * αγγελία τόσες φορές όσες και οι φωτογραφίες της· εδώ ξαναπροβάλλεται **μία φορά ανά ακίνητο**,
 * αφού γραφτούν όλα.
 *
 * ⚠️ **Μερική επιτυχία είναι νόμιμη έκβαση**, ονομασμένη ανά αρχείο (`errors`) — ίδιο συμβόλαιο
 * με την αρχειοθέτηση. Ξένο αρχείο = ανύπαρκτο (κανένα μαντείο ύπαρξης, ADR-742).
 *
 * 🔒 `SENSITIVE`: αλλάζει **ποιος βλέπει τι** — ίδια βαθμίδα με τις πράξεις του δοχείου
 * (`/api/files/[fileId]/cde`). Ρητή δήλωση εδώ, όχι `defineRoute` (CHECK 3.78).
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { getErrorMessage } from '@/lib/error-utils';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import type { FileClassification } from '@/config/domain-constants';
import {
  isFileClassification,
  writeFileClassification,
  type ClassificationActor,
  type FileClassificationResponse,
} from '@/services/file-record/file-classification.service';
import {
  refreshListingsAfterFileChanges,
  type ChangedListingFile,
} from '@/services/listings/listing-media-refresh';
import { fileResource } from '../_shared/file-ownership';

const logger = createModuleLogger('FileClassificationRoute');

export const dynamic = 'force-dynamic';

/** Ίδιο ταβάνι με την αρχειοθέτηση — η οθόνη είναι η ίδια μπάρα μαζικών ενεργειών. */
const MAX_FILES_PER_REQUEST = 50;

function refusal(status: number, message: string): NextResponse<FileClassificationResponse> {
  return NextResponse.json(
    { success: false, processedCount: 0, errors: [message], listings: [] },
    { status },
  );
}

/** Το σώμα, κριμένο — ή η ονομασμένη άρνησή του. */
function readRequest(
  body: unknown,
): { fileIds: readonly string[]; classification: FileClassification } | string {
  const payload = (body ?? {}) as Record<string, unknown>;

  if (!isFileClassification(payload.classification)) return 'classification is invalid';
  if (!Array.isArray(payload.fileIds) || payload.fileIds.length === 0) return 'fileIds array is required';
  if (payload.fileIds.length > MAX_FILES_PER_REQUEST) {
    return `Maximum ${MAX_FILES_PER_REQUEST} files per request`;
  }
  if (!payload.fileIds.every((id): id is string => typeof id === 'string' && id.length > 0)) {
    return 'fileIds must be non-empty strings';
  }

  // Το ίδιο αρχείο δύο φορές θα έγραφε μία φορά και θα ανέφερε «unchanged» τη δεύτερη — σιωπηλό.
  return { fileIds: [...new Set(payload.fileIds)], classification: payload.classification };
}

function actorOf(ctx: AuthContext): ClassificationActor {
  return {
    uid: ctx.uid,
    companyId: ctx.companyId,
    capability: { globalRole: ctx.globalRole, permissions: ctx.permissions, companyId: ctx.companyId },
  };
}

/**
 * **Ένα αρχείο**: φόρτωσε → δικό μου; → γράψε. Επιστρέφει το έγγραφο όταν **άλλαξε**, ώστε ο
 * καλών να ξέρει ποια αγγελία αφορά· αλλιώς τον λόγο, ή `null` όταν δεν είχε τίποτα να αλλάξει.
 */
async function classifyOne(
  fileId: string,
  classification: FileClassification,
  ctx: AuthContext,
): Promise<{ changed: ChangedListingFile } | { error: string } | null> {
  const db = getAdminFirestore();
  const owned = await fileResource.load({
    docId: fileId,
    caller: ctx,
    action: 'classification',
    refusal: () => `${fileId}: not found`,
    db,
  });
  if (owned.refusal !== undefined) return { error: owned.refusal };

  const data = (owned.doc.data ?? {}) as Record<string, unknown>;
  const outcome = await writeFileClassification({
    fileId, ref: owned.doc.ref, data, classification, actor: actorOf(ctx),
  });

  if (outcome.kind === 'refused') return { error: `${fileId}: ${outcome.why}` };
  return outcome.kind === 'changed' ? { changed: data } : null;
}

async function handlePost(
  request: NextRequest,
  ctx: AuthContext,
  _cache: PermissionCache,
): Promise<NextResponse<FileClassificationResponse>> {
  const parsed = readRequest(await request.json().catch(() => null));
  if (typeof parsed === 'string') return refusal(400, parsed);

  const changed: ChangedListingFile[] = [];
  const errors: string[] = [];

  for (const fileId of parsed.fileIds) {
    try {
      const result = await classifyOne(fileId, parsed.classification, ctx);
      if (result === null) continue;
      if ('error' in result) errors.push(result.error);
      else changed.push(result.changed);
    } catch (error) {
      errors.push(`${fileId}: ${getErrorMessage(error)}`);
      logger.error('Η διαβάθμιση απέτυχε', { fileId, error: getErrorMessage(error) });
    }
  }

  // 🔴 **ΤΕΛΕΥΤΑΙΑ, ΜΙΑ ΦΟΡΑ ΑΝΑ ΑΚΙΝΗΤΟ** (ADR-845 §7.17): η αγγελία βλέπει τον κόσμο όπως έμεινε.
  const listings = await refreshListingsAfterFileChanges(getAdminFirestore(), changed);

  logger.info('Διαβάθμιση αρχείων', {
    classification: parsed.classification, changed: changed.length, errors: errors.length,
    listings: listings.length,
  });

  return NextResponse.json({ success: true, processedCount: changed.length, errors, listings });
}

export const POST = withSensitiveRateLimit(withAuth(handlePost));
