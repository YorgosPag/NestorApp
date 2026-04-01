/**
 * =============================================================================
 * FILE LINK SERVICE - CRUD Operations (ADR-032)
 * =============================================================================
 *
 * SSoT for file link operations:
 * - Create (link file to entity)
 * - Read (get by ID, list with filters, get with links)
 *
 * @module services/file-link.service
 * @enterprise ADR-032 - Linking Model (Associations)
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { RealtimeService } from '@/services/realtime';
import { fileLinkConverter } from '@/lib/firestore/converters/association.converter';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import type {
  FileLink,
  CreateFileLinkInput,
  ListFileLinksParams,
  LinkResult,
  FileWithLinks,
} from '@/types/associations';

const logger = createModuleLogger('FileLinkService');

// =============================================================================
// CREATE
// =============================================================================

export async function linkFileToEntity(input: CreateFileLinkInput): Promise<LinkResult> {
  try {
    const { sourceFileId, sourceWorkspaceId, targetEntityType, targetEntityId, targetWorkspaceId, reason, createdBy, metadata } = input;

    const linkId = generateFileLinkId(sourceFileId, targetEntityType, targetEntityId);

    // Check duplicate
    const existing = await getFileLinkById(linkId);
    if (existing) {
      logger.info(`File link already exists: ${linkId}`);
      return { success: true, linkId, message: 'Link already exists' };
    }

    const fileLink: FileLink = {
      id: linkId,
      sourceFileId,
      sourceWorkspaceId,
      targetEntityType,
      targetEntityId,
      targetWorkspaceId,
      reason,
      status: 'active',
      createdAt: new Date().toISOString(),
      createdBy,
      metadata,
    };

    const linkRef = doc(db, COLLECTIONS.FILE_LINKS, linkId).withConverter(fileLinkConverter);
    await setDoc(linkRef, fileLink);

    logger.info(`Created file link: ${linkId}`);

    RealtimeService.dispatch('FILE_LINK_CREATED', {
      linkId,
      link: { sourceFileId, sourceWorkspaceId, targetEntityType, targetEntityId, targetWorkspaceId },
      timestamp: Date.now(),
    });

    return { success: true, linkId, message: 'File linked successfully' };
  } catch (error) {
    logger.error('Failed to link file:', error);
    return { success: false, error: getErrorMessage(error), errorCode: 'LINK_FILE_FAILED' };
  }
}

// =============================================================================
// READ
// =============================================================================

export async function getFileLinkById(linkId: string): Promise<FileLink | null> {
  const linkRef = doc(db, COLLECTIONS.FILE_LINKS, linkId).withConverter(fileLinkConverter);
  const snapshot = await getDoc(linkRef);
  return snapshot.exists() ? snapshot.data() : null;
}

export async function listFileLinks(params: ListFileLinksParams = {}): Promise<FileLink[]> {
  const { sourceFileId, sourceWorkspaceId, targetEntityType, targetEntityId, targetWorkspaceId, status, limit: limitParam } = params;

  let q = query(
    collection(db, COLLECTIONS.FILE_LINKS).withConverter(fileLinkConverter),
    orderBy('createdAt', 'desc')
  );

  if (sourceFileId) q = query(q, where('sourceFileId', '==', sourceFileId));
  if (sourceWorkspaceId) q = query(q, where('sourceWorkspaceId', '==', sourceWorkspaceId));
  if (targetEntityType) q = query(q, where('targetEntityType', '==', targetEntityType));
  if (targetEntityId) q = query(q, where('targetEntityId', '==', targetEntityId));
  if (targetWorkspaceId) q = query(q, where('targetWorkspaceId', '==', targetWorkspaceId));
  if (status) q = query(q, where('status', '==', status));
  if (limitParam) q = query(q, firestoreLimit(limitParam));

  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => d.data());
}

export async function getFileWithLinks(fileId: string): Promise<FileWithLinks | null> {
  const links = await listFileLinks({ sourceFileId: fileId, status: 'active' });
  if (links.length === 0) return null;

  const linkedTo = links.map((link) => ({
    entityType: link.targetEntityType,
    entityId: link.targetEntityId,
    workspaceId: link.targetWorkspaceId,
  }));

  return {
    fileId,
    fileName: '',
    sourceWorkspaceId: links[0].sourceWorkspaceId,
    linkedTo,
  };
}

// =============================================================================
// ID GENERATION
// =============================================================================

function generateFileLinkId(fileId: string, targetEntityType: string, targetEntityId: string): string {
  return `fl_${fileId}_${targetEntityType}_${targetEntityId}`;
}
