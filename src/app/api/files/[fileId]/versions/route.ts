/**
 * =============================================================================
 * Η ΣΤΟΙΒΑ ΕΚΔΟΣΕΩΝ ΕΝΟΣ ΑΡΧΕΙΟΥ (ADR-862 Φ0 · ανοιχτό του Β10)
 * =============================================================================
 *
 * `GET /api/files/{fileId}/versions` → {@link FileVersionStackResponse}
 *
 * 🔑 **ΔΙΑΚΟΜΙΣΤΗΣ, ΟΧΙ ΠΕΛΑΤΗΣ**: οι παλιές εκδόσεις είναι `SUPERSEDED`, και η ορατότητά
 * τους περνά από τον **διακόπτη ιστορικού** του κριτή (`historyRequested`) — ερώτηση που ο
 * κανόνας Firestore δεν μπορεί να κάνει. Κάθε έκδοση κρίνεται **χωριστά** με τον ΕΝΑ PEP
 * (`containerVisibilityRefusal`), με **κοινή** απομνημόνευση μέλους ανά αίτημα.
 *
 * ⚠️ Το 404 είναι **ένα** για απουσία και ξένο μισθωτή (ADR-742 §7.1). Έκδοση που ο αιτών
 * δεν βλέπει **παραλείπεται** — δεν ανακοινώνεται.
 *
 * ⚡ `STANDARD` ρητά (CHECK 3.78): ανάγνωση καταλόγου, όχι αλλαγή ορατότητας.
 *
 * @module app/api/files/[fileId]/versions
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { containerVisibilityRefusal } from '@/lib/auth/container-visibility-guard';
import type { ProjectMemberRead } from '@/lib/auth/project-member-read';
import { readContainerState } from '@/lib/files/file-record-read';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { readVersionStack } from '@/services/iso19650/version-stack';
import type { FileRecord } from '@/types/file-record';
import type { FileVersionEntry, FileVersionStackResponse } from '@/types/file-version-stack';
import {
  authorityUnavailableResponse,
  fileNotFoundResponse,
  resolveOwnedFile,
  type FileSegment,
} from '../../_shared/container-route-responses';

/** Η ικανότητα της **ανάγνωσης** αρχείου — ίδια με τη λήψη bytes. */
const VIEW_ACTION = 'dxf:files:view';

/** Το κλειστό σχήμα του σύρματος — ποτέ ολόκληρο το FileRecord. */
function entryOf(record: FileRecord, headFileId: string): FileVersionEntry {
  return {
    id: record.id,
    displayName: record.displayName,
    originalFilename: record.originalFilename,
    ext: record.ext,
    storagePath: record.storagePath,
    downloadUrl: record.downloadUrl ?? null,
    sizeBytes: typeof record.sizeBytes === 'number' ? record.sizeBytes : null,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : null,
    createdBy: record.createdBy,
    uploaderName: record.uploaderName ?? null,
    isCurrent: record.id === headFileId,
    promotedFromFileId: record.promotedFromFileId ?? null,
    phase: readContainerState({ ...record }).phase,
  };
}

/** Οι εκδόσεις που **βλέπει** ο αιτών — `null` αν η αυθεντία δεν απάντησε. */
async function visibleVersions(
  ctx: AuthContext,
  versions: readonly FileRecord[],
): Promise<FileRecord[] | null> {
  const cache = new Map<string, ProjectMemberRead>();
  const visible: FileRecord[] = [];
  for (const record of versions) {
    const verdict = await containerVisibilityRefusal<'hidden' | 'unavailable'>({
      fileId: record.id,
      caller: ctx,
      action: VIEW_ACTION,
      raw: record,
      notFound: () => 'hidden',
      unavailable: () => 'unavailable',
      cache,
      historyRequested: true,
    });
    if (verdict === 'unavailable') return null;
    if (verdict === null) visible.push(record);
  }
  return visible;
}

async function handleGet(_request: NextRequest, ctx: AuthContext, _cache: PermissionCache, segment?: FileSegment) {
  const resolved = await resolveOwnedFile(segment, ctx, 'versions');
  if (resolved.refusal) return resolved.refusal;
  const { fileId } = resolved;

  const stack = await readVersionStack(ctx.companyId, fileId);
  if (stack.kind === 'not-found') return fileNotFoundResponse();

  const visible = await visibleVersions(ctx, stack.versions);
  if (visible === null) return authorityUnavailableResponse();
  // Ο αιτών δεν βλέπει ΚΑΝ το ζητούμενο ⇒ το ίδιο 404, ποτέ κενή στοίβα που μαρτυρά ύπαρξη.
  if (!visible.some(record => record.id === fileId)) return fileNotFoundResponse();

  const body: FileVersionStackResponse = {
    headFileId: stack.headFileId,
    versions: visible.map(record => entryOf(record, stack.headFileId)),
  };
  return NextResponse.json(body, { status: 200 });
}

export const GET = withStandardRateLimit(withAuth<unknown, FileSegment>(handleGet));
