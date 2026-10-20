import 'server-only';

/**
 * @fileoverview **Το δίχτυ της παράδοσης** — ό,τι ξέφυγε από τα σημεία κλήσης (ADR-916 §5.4).
 * @related services/property-handover/property-handover-write.service.ts (ο ΕΝΑΣ γραφέας) · ADR-740
 * @module services/property-handover/property-handover-reconcile.service
 *
 * 🔑 **Δεν είναι δεύτερη μηχανή**: για κάθε υποψήφιο ακίνητο καλεί τον **ίδιο** `syncPropertyHandovers`.
 * Υποψήφια = (α) ό,τι πουλιέται τώρα (κράτηση · πώληση — και στο παλιό κάτοπτρο `status`), (β) ό,τι έχει
 * παράδοση σε αναμονή (ώστε μια ακύρωση που ξέφυγε να γίνει `cancelled`).
 *
 * 🔴 **Το `changed` είναι ο λόγος ύπαρξής του**: με κάθε σημείο κλήσης στη θέση του είναι **μηδέν**. Μη
 * μηδενικό = σημείο κλήσης που ξέφυγε — φαίνεται στα μεγέθη της εκτέλεσης.
 *
 * 🔑 **Η απούσα ρύθμιση = ΕΝΑ `warn` ανά εκτέλεση** (ADR-916 §5.6), με το πλήθος — όχι ένα `error` ανά παράδοση κάθε
 * πρωί. Η ίδια ρύθμιση φαίνεται ήδη ως **ένα** σήμα στο `api/admin/environment` (`environment-contract.ts`).
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';

import { syncPropertyHandovers } from './property-handover-write.service';

const logger = createModuleLogger('PropertyHandoverReconcile');

/** Οι διαθέσεις που ανοίγουν παράδοση — ίδιο σύνολο με το `handover-plan` (κράτηση · πώληση). */
const COMMITTED_STATUSES = ['reserved', 'sold'];

export interface PropertyHandoverReconcileReport {
  readonly scanned: number;
  /** Μεταβάσεις κύκλου ζωής — μη μηδενικό = σημείο κλήσης που ξέφυγε. */
  readonly changed: number;
  /**
   * Ακίνητα όπου άλλαξε **μόνο** η πρόσκληση (ADR-916 Φ-Β) — π.χ. η επαφή απέκτησε ή άλλαξε email. **Δεν** είναι διαρροή:
   * η επεξεργασία επαφής δεν έχει (και δεν πρέπει να έχει) σημείο κλήσης της παράδοσης· το δίχτυ **είναι** ο δρόμος της.
   */
  readonly invitationChanged: number;
  /** Προσκλήσεις που οφείλονται αλλά περιμένουν το μυστικό των συνδέσμων — μη μηδενικό = ρύθμιση, όχι βλάβη κώδικα. */
  readonly invitationsAwaitingConfiguration: number;
  readonly failed: number;
}

async function candidatePropertyIds(adminDb: AdminFirestore): Promise<readonly string[]> {
  const properties = adminDb.collection(COLLECTIONS.PROPERTIES);
  const [committed, legacy, awaiting] = await Promise.all([
    // tenant-scope-exempt: νυχτερινό δίχτυ συστήματος — σαρώνει ΟΛΟΥΣ τους μισθωτές· κάθε ακίνητο συμφιλιώνεται με τον δικό του `companyId`
    properties.where('commercialStatus', 'in', COMMITTED_STATUSES).get(),
    // tenant-scope-exempt: το παλιό κάτοπτρο `status` (ADR-249) — ίδιο δίχτυ, έγγραφα χωρίς `commercialStatus`
    properties.where('status', 'in', COMMITTED_STATUSES).get(),
    // tenant-scope-exempt: παραδόσεις σε αναμονή όλων των μισθωτών — η ακύρωση που ξέφυγε γίνεται `cancelled`
    adminDb.collection(COLLECTIONS.PROPERTY_HANDOVERS).where('lifecycle', '==', 'awaiting-completion').get(),
  ]);
  const ids = new Set([...committed.docs, ...legacy.docs].map((doc) => doc.id));
  for (const doc of awaiting.docs) {
    const propertyId: unknown = doc.get('propertyId');
    if (typeof propertyId === 'string' && propertyId !== '') ids.add(propertyId);
  }
  return [...ids];
}

/** **Συμφιλιώνει** κάθε υποψήφιο ακίνητο, ένα-ένα (ο γραφέας κρατά συναλλαγή ανά ακίνητο). */
export async function reconcilePropertyHandovers(adminDb: AdminFirestore): Promise<PropertyHandoverReconcileReport> {
  const propertyIds = await candidatePropertyIds(adminDb);
  let changed = 0;
  let invitationChanged = 0;
  let invitationsAwaitingConfiguration = 0;
  let failed = 0;
  for (const propertyId of propertyIds) {
    const outcome = await syncPropertyHandovers(adminDb, propertyId, { cause: 'reconcile', performedBy: 'system' });
    if (outcome.kind === 'failed') {
      failed += 1;
      continue;
    }
    invitationsAwaitingConfiguration += outcome.invitationsAwaitingConfiguration;
    if (outcome.writes > 0) changed += 1;
    else if (outcome.invitationWrites > 0) invitationChanged += 1;
  }
  if (invitationsAwaitingConfiguration > 0) {
    logger.warn('Προσκλήσεις αγοραστή σε αναμονή ρύθμισης — λείπει το μυστικό των συνδέσμων· το δίχτυ ξαναδοκιμάζει', {
      pending: invitationsAwaitingConfiguration,
    });
  }
  return { scanned: propertyIds.length, changed, invitationChanged, invitationsAwaitingConfiguration, failed };
}
