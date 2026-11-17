/**
 * 📧 COMMUNICATION IMPACT PREVIEW — Thin Wrapper
 *
 * Delegates to the unified ContactImpactEngine for dependency queries.
 * Maps generic result to the CommunicationImpactPreview shape
 * expected by the CommunicationImpactDialog.
 *
 * Now supports ALL contact types (individual, company, service),
 * not just company. The registry handles per-type filtering.
 *
 * 🔑 ADR-944 §3.7 — **άγκυρα ταυτότητας**: όταν η φόρμα αφαιρεί email, απαντά ποια από αυτά είναι email αποδεκτού
 * λογαριασμού της επαφής (`anchoredEmailKeys`) — τομή με ό,τι **έστειλε** ο πελάτης, ποτέ το email του λογαριασμού.
 * «Δεν μπόρεσα να ρωτήσω» ⇒ 503 (ο πελάτης μπλοκάρει), ποτέ «καμία άγκυρα».
 *
 * @module lib/firestore/communication-impact-preview
 * @enterprise ADR-280 — Communication Field Impact Detection · ADR-944 §3.7
 */

import 'server-only';

import { computeContactImpact, findDependencyCount } from './contact-impact-engine';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { ApiError } from '@/lib/api/ApiErrorHandler';
import { emailKeyOf } from '@/lib/contacts/contact-email-keys';
import { readAcceptedAccountEmailKeys } from '@/server/engagements/contact-engagement-link.server';
import type { ContactType } from '@/types/contacts';
import type { CommunicationImpactPreview } from '@/types/communication-impact-preview';

export type { CommunicationImpactPreview } from '@/types/communication-impact-preview';

// ============================================================================
// ANCHORS (ADR-944 §3.7)
// ============================================================================

/** Τα αφαιρούμενα κλειδιά που είναι άγκυρες. Κενή είσοδος ⇒ καμία ανάγνωση (κόστος μηδέν για απλές αλλαγές). */
async function anchoredEmailKeysOf(
  contactId: string,
  companyId: string,
  removedEmailKeys: ReadonlyArray<string>,
): Promise<string[]> {
  const removed = [...new Set(removedEmailKeys.map(emailKeyOf).filter((key): key is string => key !== null))];
  if (removed.length === 0) return [];
  const db = getAdminFirestore();
  if (!db) throw new ApiError(503, 'Database not available');
  const read = await readAcceptedAccountEmailKeys(db, companyId, contactId, Date.now());
  if (read.outcome === 'unknown') throw new ApiError(503, 'Account anchors unavailable');
  return removed.filter((key) => read.keys.has(key)).sort();
}

// ============================================================================
// PREVIEW
// ============================================================================

export async function previewCommunicationImpact(
  contactId: string,
  companyId: string,
  contactType: ContactType = 'company',
  removedEmailKeys: ReadonlyArray<string> = [],
): Promise<CommunicationImpactPreview> {
  const [result, anchoredEmailKeys] = await Promise.all([
    computeContactImpact(contactId, 'communicationChange', contactType, companyId),
    anchoredEmailKeysOf(contactId, companyId, removedEmailKeys),
  ]);

  return {
    totalAffected: result.totalAffected,
    properties: findDependencyCount(result, 'properties'),
    paymentPlans: findDependencyCount(result, 'propertyPaymentPlans'),
    projects: findDependencyCount(result, 'projectsAsCompany'),
    communications: findDependencyCount(result, 'communications'),
    invoices: findDependencyCount(result, 'invoices'),
    apyCertificates: findDependencyCount(result, 'apyCertificates'),
    anchoredEmailKeys,
  };
}
