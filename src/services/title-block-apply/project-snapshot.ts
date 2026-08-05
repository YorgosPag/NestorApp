/**
 * @fileoverview Η **ανάγνωση τη στιγμή του κλικ** — ο φύλακας του Γ5 (ADR-745 Φ3β).
 *
 * 🔴 **Ποτέ από το στιγμιότυπο της πρότασης.** Ο Λ2 διαβάζει τη βάση όταν **ανοίγει** η παλέτα·
 * ο άνθρωπος πατάει Έγκριση λεπτά αργότερα. Στο μεταξύ, η καρτέλα του έργου μπορεί να έχει
 * δηλώσει `acquisitionStatus`, να έχει προσθέσει οικοπεδούχο, να έχει αλλάξει ποσοστά.
 *
 * Και τα δύο πεδία-στόχοι είναι **πίνακες**, και τα Firestore arrays
 * **αντικαθίστανται ολόκληρα** — δεν κάνουν merge ανά στοιχείο. Το `updateProjectWithPolicy`
 * είναι **σκέτο pass-through**: καμία συναλλαγή, κανένα optimistic concurrency
 * (`project-mutation-gateway.ts:46`). Γράφοντας το στιγμιότυπο πίσω, σβήνουμε ό,τι μπήκε
 * ενδιάμεσα — **χωρίς σφάλμα και χωρίς μήνυμα**, ακριβώς το σχήμα του Σ1 της Φ3α.
 *
 * @module services/title-block-apply/project-snapshot
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { getErrorMessage } from '@/lib/error-utils';
import type { LandownerEntry } from '@/types/ownership-table';
import type { ProjectAddress } from '@/types/project/addresses';

export interface ProjectSnapshot {
  readonly id: string;
  readonly landowners: readonly LandownerEntry[];
  readonly addresses: readonly ProjectAddress[];
  readonly buildingBlock?: string;
}

type ProjectGetPayload = {
  project?: {
    id?: string;
    landowners?: LandownerEntry[] | null;
    addresses?: ProjectAddress[] | null;
    buildingBlock?: string | null;
  };
};

/**
 * Το έργο **τώρα**, από την ίδια tenant-scoped διαδρομή που κάνει και την εγγραφή.
 *
 * Η ανάγνωση περνά από το `GET /api/projects/{id}`, που φορτώνει μέσω `loadOwnedProject`
 * (ADR-742) — δηλαδή «υπάρχει;» και «δικό μου;» απαντούν με **το ίδιο σφάλμα**. Ένα direct
 * Firestore read εδώ θα ήταν δεύτερη διαδρομή με δικό της μοντέλο ασφαλείας.
 *
 * @throws όταν η ανάγνωση αποτύχει — **ποτέ σιωπηλά κενό έργο**: ένα `{ landowners: [] }` από
 *   αποτυχία θα φαινόταν σαν «έργο χωρίς οικοπεδούχους» και η επόμενη εγγραφή θα **έσβηνε**
 *   όλους τους υπάρχοντες.
 */
export async function readProjectSnapshot(projectId: string): Promise<ProjectSnapshot> {
  try {
    const payload = await apiClient.get<ProjectGetPayload>(API_ROUTES.PROJECTS.BY_ID(projectId));
    const project = payload?.project;
    if (!project) throw new Error('empty project payload');

    return {
      id: project.id ?? projectId,
      landowners: project.landowners ?? [],
      addresses: project.addresses ?? [],
      ...(project.buildingBlock ? { buildingBlock: project.buildingBlock } : {}),
    };
  } catch (error) {
    throw new Error(`readProjectSnapshot(${projectId}): ${getErrorMessage(error)}`);
  }
}
