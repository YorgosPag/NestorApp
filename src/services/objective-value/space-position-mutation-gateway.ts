'use client';

/**
 * @fileoverview **Η πόρτα γραφής της θέσης ενός χώρου κατά την αντικειμενική** (ADR-898 §19) — η απάντηση «πού είναι
 * αυτή η θέση/αποθήκη κατά τον νόμο», από το συρτάρι του πίνακα του κτιρίου.
 * @related `services/parking-mutation-gateway.ts` · `services/storage-mutation-gateway.ts` (οι ΜΟΝΕΣ διαδρομές PATCH των
 *   χώρων — ADR-696: ίχνος, έλεγχος έκδοσης, μισθωτής) · `building-mutation-gateway.ts` (ίδιο σχήμα για τα γεγονότα κτιρίου)
 * @module services/objective-value/space-position-mutation-gateway
 *
 * 🔑 Καμία δεύτερη διαδρομή: γράφει μέσω των υπαρχουσών πυλών του κάθε χώρου, και εκπέμπει το **ίδιο** γεγονός με κάθε
 *   άλλη αλλαγή χώρου (`PARKING_UPDATED` / `STORAGE_UPDATED`) ⇒ ο πίνακας ξαναρωτά μόνος του. **Δεν πετά ποτέ.**
 */

import {
  SPACE_OBJECTIVE_VALUE_POSITION_FIELD,
  type BuildingSpaceKind,
  type SpaceLawPosition,
} from '@/lib/objective-value/building-space-objective-value';
import type { ObjectiveValueWriteOutcome } from '@/lib/objective-value/objective-value-improve-subject';
import { objectiveValueWriteFailureOf } from '@/lib/objective-value/objective-value-write-failure';
import { createModuleLogger } from '@/lib/telemetry';
import { updateParkingWithPolicy } from '@/services/parking-mutation-gateway';
import { RealtimeService } from '@/services/realtime/RealtimeService';
import { updateStorageWithPolicy } from '@/services/storage-mutation-gateway';

const logger = createModuleLogger('space-position-mutation-gateway');

export interface SpacePositionWrite {
  readonly kind: BuildingSpaceKind;
  readonly spaceId: string;
  /** `null` = «σβήσε την απάντηση» (επιστροφή στο κτίριο / στα δεδομένα του χώρου). */
  readonly position: SpaceLawPosition | null;
}

async function send({ kind, spaceId, position }: SpacePositionWrite): Promise<void> {
  const payload = { [SPACE_OBJECTIVE_VALUE_POSITION_FIELD]: position };
  if (kind === 'parking') {
    await updateParkingWithPolicy({ parkingSpotId: spaceId, payload });
    RealtimeService.dispatch('PARKING_UPDATED', { parkingSpotId: spaceId, updates: payload, timestamp: Date.now() });
    return;
  }
  await updateStorageWithPolicy({ storageId: spaceId, payload });
  RealtimeService.dispatch('STORAGE_UPDATED', { storageId: spaceId, updates: payload, timestamp: Date.now() });
}

export async function updateSpaceObjectiveValuePositionWithPolicy(write: SpacePositionWrite): Promise<ObjectiveValueWriteOutcome> {
  try {
    await send(write);
    return { kind: 'saved' };
  } catch (cause) {
    logger.warn('Space objective-value position was not saved', {
      data: { kind: write.kind, spaceId: write.spaceId },
      error: cause instanceof Error ? cause.message : String(cause),
    });
    return objectiveValueWriteFailureOf(cause);
  }
}
