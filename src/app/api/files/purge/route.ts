/**
 * =============================================================================
 * File Purge API — Permanent Deletion of Expired Trash
 * =============================================================================
 *
 * POST /api/files/purge
 * Authorization: Cron secret header
 *
 * Χειροκίνητη εκτέλεση της **Φάσης Α** του `file-purge.job` — αρχεία στον κάδο που πέρασαν το
 * `purgeAt`, σε **όλα** τα διαμερίσματα (εταιρεία · άνθρωπος).
 *
 * 🧹 **ΛΕΠΤΟΣ ΠΡΟΣΑΡΜΟΓΕΑΣ, ΟΧΙ ΔΕΥΤΕΡΗ ΣΑΡΩΣΗ** (ADR-866 §2.6.9 Β4, N.0.2): μέχρι το 2β.3 αυτό το
 * αρχείο είχε **αντίγραφο** του ερωτήματος και του βρόχου του job. Ο χρονοπρογραμματιστής τρέχει
 * **μόνο** το job (`cron-schedule.ts` → `cron/file-purge`)· δύο σαρώσεις σήμαιναν ότι το δεύτερο
 * διαμέρισμα θα έμπαινε στη μία και θα ξεχνιόταν στην άλλη. Κρίση δέσμευσης, γραφέας και
 * διαμερίσματα ζουν **εκεί**.
 *
 * ⚠️ **Δηλωμένη αλλαγή συμβολαίου**: το `errors[]` μένει στο σχήμα αλλά είναι πλέον **κενό** — το
 * job μετρά την αποτυχημένη εκκαθάριση στο `skippedCount` και καταγράφει τον λόγο στο log.
 *
 * @module api/files/purge
 * @enterprise ADR-191 - Enterprise Document Management System (Phase 3.2)
 * @compliance ISO 27001 §A.8.3 (Media Handling)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { verifyCronAuthorization } from '@/lib/cron-auth';
import { purgeExpiredTrash } from '@/lib/cron/jobs/file-purge.job';

const logger = createModuleLogger('FilePurgeRoute');

export const maxDuration = 60;

// ============================================================================
// TYPES
// ============================================================================

interface PurgeResult {
  success: boolean;
  purgedCount: number;
  skippedCount: number;
  errors: string[];
}

// ============================================================================
// HANDLER
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse<PurgeResult>> {
  if (!verifyCronAuthorization(request)) {
    return NextResponse.json(
      { success: false, purgedCount: 0, skippedCount: 0, errors: ['Unauthorized'] },
      { status: 401 },
    );
  }

  try {
    const tally = await purgeExpiredTrash();

    logger.info('Purge cycle complete', { purgedCount: tally.purged, skippedCount: tally.skipped });

    return NextResponse.json({
      success: true,
      purgedCount: tally.purged,
      skippedCount: tally.skipped,
      errors: [],
    });
  } catch (err) {
    const message = getErrorMessage(err, 'Purge failed');
    logger.error(`Purge error: ${message}`);
    return NextResponse.json(
      { success: false, purgedCount: 0, skippedCount: 0, errors: [message] },
      { status: 500 },
    );
  }
}
