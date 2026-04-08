/**
 * 🔗 CASCADE CONTACT NAME — Owner Name Propagation
 *
 * When a contact's display name changes, propagates the new name to:
 * 1. units.commercial.owners[].name WHERE ownerContactIds array-contains contactId
 * 2. payment_plans subcollection WHERE ownerContactId == contactId
 *
 * ADR-244 Phase 3: Uses ownerContactIds (flat array) for Firestore queries,
 * updates owners[] array entries by read-modify-write pattern.
 *
 * Called server-side from /api/contacts/[contactId]/name-cascade.
 *
 * @module lib/firestore/cascade-contact-name
 * @enterprise ADR-244 — Multi-Buyer Co-Ownership, ADR-249 — Name Cascade
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FieldValue } from 'firebase-admin/firestore';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import type { CascadeResult } from './cascade-propagation.service';

const logger = createModuleLogger('CascadeContactName');

/**
 * Propagate contact name change to all denormalized locations.
 * Uses ownerContactIds (flat array) for queries,
 * updates owners[] array entries by read-modify-write.
 */
export async function propagateContactNameChange(
  contactId: string,
  newDisplayName: string
): Promise<CascadeResult> {
  const db = getAdminFirestore();
  const collections: Record<string, number> = {};
  let totalUpdated = 0;

  try {
    // --- Step 1: Update owners[].name in units ---
    const unitsSnapshot = await db
      .collection(COLLECTIONS.PROPERTIES)
      .where('commercial.ownerContactIds', 'array-contains', contactId)
      .select('commercial')
      .get();

    if (!unitsSnapshot.empty) {
      const unitBatch = db.batch();
      let unitCount = 0;

      for (const unitDoc of unitsSnapshot.docs) {
        const data = unitDoc.data();
        const commercial = (data.commercial ?? {}) as Record<string, unknown>;
        const owners = (commercial.owners ?? []) as Array<{
          contactId: string;
          name: string;
          ownershipPct: number;
          role: string;
          paymentPlanId: string | null;
        }>;

        // Update matching owner name(s) in the array
        const updatedOwners = owners.map(o =>
          o.contactId === contactId ? { ...o, name: newDisplayName } : o
        );

        unitBatch.update(unitDoc.ref, {
          'commercial.owners': updatedOwners,
          updatedAt: FieldValue.serverTimestamp(),
        });
        unitCount++;
      }

      await unitBatch.commit();
      collections[COLLECTIONS.PROPERTIES] = unitCount;
      totalUpdated += unitCount;

      // --- Step 2: Update payment_plans subcollections ---
      let planCount = 0;

      for (const unitDoc of unitsSnapshot.docs) {
        const plansSnapshot = await db
          .collection(COLLECTIONS.PROPERTIES)
          .doc(unitDoc.id)
          .collection(COLLECTIONS.PROPERTY_PAYMENT_PLANS)
          .where('ownerContactId', '==', contactId)
          .select()
          .get();

        if (!plansSnapshot.empty) {
          const planBatch = db.batch();

          for (const planDoc of plansSnapshot.docs) {
            planBatch.update(planDoc.ref, {
              ownerName: newDisplayName,
              updatedAt: FieldValue.serverTimestamp(),
            });
            planCount++;
          }

          await planBatch.commit();
        }
      }

      if (planCount > 0) {
        collections[COLLECTIONS.PROPERTY_PAYMENT_PLANS] = planCount;
        totalUpdated += planCount;
      }
    } else {
      collections[COLLECTIONS.PROPERTIES] = 0;
    }

    logger.info('Contact→Name cascade completed', {
      contactId,
      newDisplayName,
      totalUpdated,
      collections,
    });

    return { success: true, totalUpdated, collections };
  } catch (error) {
    const message = getErrorMessage(error);
    logger.error('Contact→Name cascade failed', { contactId, newDisplayName, error: message });
    return { success: false, totalUpdated, collections, error: message };
  }
}

// ============================================================================
// PREVIEW (DRY-RUN) — Counts only, no writes
// ============================================================================

export interface NameCascadePreview {
  readonly totalAffected: number;
  readonly properties: number;
  readonly paymentPlans: number;
}

/**
 * Preview how many records would be affected by a name change.
 * Read-only — no Firestore writes. Used for confirmation dialogs.
 */
export async function previewContactNameCascade(
  contactId: string
): Promise<NameCascadePreview> {
  const db = getAdminFirestore();

  try {
    const unitsSnapshot = await db
      .collection(COLLECTIONS.PROPERTIES)
      .where('commercial.ownerContactIds', 'array-contains', contactId)
      .select()
      .get();

    const properties = unitsSnapshot.size;
    let paymentPlans = 0;

    // Count payment plans in affected properties
    for (const unitDoc of unitsSnapshot.docs) {
      const plansSnapshot = await db
        .collection(COLLECTIONS.PROPERTIES)
        .doc(unitDoc.id)
        .collection(COLLECTIONS.PROPERTY_PAYMENT_PLANS)
        .where('ownerContactId', '==', contactId)
        .select()
        .get();

      paymentPlans += plansSnapshot.size;
    }

    return {
      totalAffected: properties + paymentPlans,
      properties,
      paymentPlans,
    };
  } catch (error) {
    logger.warn('Name cascade preview failed:', error);
    return { totalAffected: 0, properties: 0, paymentPlans: 0 };
  }
}
