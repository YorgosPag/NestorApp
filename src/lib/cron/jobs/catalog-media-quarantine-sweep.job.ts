import 'server-only';

/**
 * @fileoverview Cron: **το δίχτυ της καραντίνας μέσων καταλόγου** (ADR-934 §5.2.2 Μ-β5). Ο κύριος δρόμος αποδεσμεύει στο τέλος
 * της παρτίδας· εδώ ό,τι χάθηκε (παρτίδες χωρίς αποδέσμευση · ορφανά περιεχόμενα). Ο κάδος αδειάζει από το `file-purge`.
 * @module lib/cron/jobs/catalog-media-quarantine-sweep.job
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { sweepMediaQuarantine } from '@/server/catalog/media-quarantine-sweep.server';
import type { CronJobResult } from '@/types/cron-schedule';

export async function runCatalogMediaQuarantineSweep(): Promise<CronJobResult> {
  const metrics = await sweepMediaQuarantine(getAdminFirestore(), Date.now());
  return {
    summary: `batches ${metrics.batches}, released ${metrics.released}, held ${metrics.held}, orphans ${metrics.orphansReleased}/${metrics.orphansChecked}`,
    metrics: { ...metrics },
  };
}
