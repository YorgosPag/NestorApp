import 'server-only';

/**
 * **Το άμεσο άδειασμα μετά το commit** (ADR-923 §5.13 Δ3): best effort, στο `after` της αίτησης. Η σημείωση έχει ήδη
 * γραφτεί μέσα στη συναλλαγή, άρα ό,τι δεν προλάβει εδώ το παίρνει η σάρωση.
 *
 * 🔑 Μόνο μέχρι {@link IMMEDIATE_LIMIT} μοντέλα, και ποτέ το `catalog`: μια εισαγωγή δεν κρατά την αίτηση σε χιλιάδες
 *    προβολές. Έξω από αίτηση (σενάρια, jest) το `after` πετά, και αυτό σημαίνει απλώς «το πιάνει η σάρωση».
 * ⚠️ Ο γραφέας φορτώνεται δυναμικά, για να μη σέρνει τη μηχανή του ραφιού σε κάθε εισαγωγή της μηχανής καταλόγου.
 *
 * @module server/catalog/public/public-drain-schedule.server
 */

import { after } from 'next/server';

import { createModuleLogger } from '@/lib/telemetry';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import type { PublicScope } from '@/subapps/catalog/public/public-scopes-of-write';

const logger = createModuleLogger('PublicDrainSchedule');

const IMMEDIATE_LIMIT = 20;

async function drainNow(companyId: string, modelIds: readonly string[]): Promise<void> {
  try {
    const { drainPublicModel } = await import('./public-model-writer.server');
    const db = getAdminFirestore();
    for (const modelId of modelIds) await drainPublicModel(db, companyId, modelId, Date.now());
  } catch (error) {
    logger.warn('Το άμεσο άδειασμα απέτυχε: το παίρνει η σάρωση', { companyId, error: error instanceof Error ? error.message : String(error) });
  }
}

export function schedulePublicDrain(companyId: string, scopes: readonly PublicScope[]): void {
  const modelIds = scopes.flatMap((scope) => (scope.kind === 'model' ? [scope.modelId] : [])).slice(0, IMMEDIATE_LIMIT);
  if (modelIds.length === 0) return;
  try {
    after(() => drainNow(companyId, modelIds));
  } catch {
    // Χωρίς πλαίσιο αίτησης: η σημείωση υπάρχει, το δίχτυ την πιάνει.
  }
}
