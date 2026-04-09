/**
 * @fileoverview Photo Share History Service — queries photo share records per contact.
 * @module services/photo-share-history
 * @enterprise Photo Share History Feature
 */

import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { createModuleLogger } from '@/lib/telemetry';
import type { PhotoShareRecord } from '@/types/photo-share';

const logger = createModuleLogger('PhotoShareHistoryService');

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

// ============================================================================
// SERVICE
// ============================================================================

/**
 * Fetch photo share history for a specific contact.
 * Returns records sorted by createdAt descending (newest first).
 */
export async function getPhotoSharesByContact(
  contactId: string,
  companyId: string,
  limitVal = DEFAULT_LIMIT,
): Promise<PhotoShareRecord[]> {
  if (!contactId || !companyId) {
    return [];
  }

  const effectiveLimit = Math.min(limitVal, MAX_LIMIT);

  try {
    const q = query(
      collection(db, COLLECTIONS.PHOTO_SHARES),
      where(FIELDS.CONTACT_ID, '==', contactId),
      where(FIELDS.COMPANY_ID, '==', companyId),
      orderBy(FIELDS.CREATED_AT, 'desc'),
      firestoreLimit(effectiveLimit),
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        contactId: data.contactId,
        contactName: data.contactName ?? '',
        channel: data.channel,
        externalUserId: data.externalUserId ?? '',
        photoUrls: data.photoUrls ?? [],
        photoCount: data.photoCount ?? data.photoUrls?.length ?? 0,
        caption: data.caption ?? null,
        status: data.status ?? 'sent',
        sentCount: data.sentCount ?? data.photoCount ?? 0,
        companyId: data.companyId,
        createdBy: data.createdBy,
        createdAt: data.createdAt?.toDate?.() ?? data.createdAt ?? new Date(),
      } satisfies PhotoShareRecord;
    });
  } catch (error) {
    logger.error('Failed to fetch photo share history', {
      contactId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return [];
  }
}

/**
 * Count total photo shares for a contact (for stats display).
 */
export async function countPhotoSharesByContact(
  contactId: string,
  companyId: string,
): Promise<number> {
  const records = await getPhotoSharesByContact(contactId, companyId, MAX_LIMIT);
  return records.length;
}
