/**
 * =============================================================================
 * 🏢 ENTERPRISE: Association Firestore Converters
 * =============================================================================
 *
 * Type-safe converters για Contact Links και File Links.
 *
 * @module lib/firestore/converters/association.converter
 * @enterprise ADR-032 - Linking Model (Associations)
 */

import type {
  DocumentData,
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
  Timestamp,
} from 'firebase/firestore';
import type {
  ContactLink,
  ContactLinkFirestoreDoc,
  FileLink,
  FileLinkFirestoreDoc,
} from '@/types/associations';

// ============================================================================
// CONTACT LINK CONVERTER
// ============================================================================

/**
 * Firestore converter for ContactLink entities
 */
export const contactLinkConverter: FirestoreDataConverter<ContactLink> = {
  /**
   * Convert ContactLink to Firestore document
   */
  toFirestore(contactLink: ContactLink): DocumentData {
    const createdAt =
      typeof contactLink.createdAt === 'string'
        ? new Date(contactLink.createdAt)
        : contactLink.createdAt;

    const updatedAt = contactLink.updatedAt
      ? typeof contactLink.updatedAt === 'string'
        ? new Date(contactLink.updatedAt)
        : contactLink.updatedAt
      : null;

    return {
      id: contactLink.id,
      sourceWorkspaceId: contactLink.sourceWorkspaceId,
      sourceContactId: contactLink.sourceContactId,
      targetWorkspaceId: contactLink.targetWorkspaceId ?? null,
      targetEntityType: contactLink.targetEntityType ?? null,
      targetEntityId: contactLink.targetEntityId ?? null,
      reason: contactLink.reason ?? null,
      status: contactLink.status,
      createdAt,
      createdBy: contactLink.createdBy,
      updatedAt,
      updatedBy: contactLink.updatedBy ?? null,
      metadata: contactLink.metadata ?? null,
    } as ContactLinkFirestoreDoc;
  },

  /**
   * Convert Firestore document to ContactLink
   */
  fromFirestore(
    snapshot: QueryDocumentSnapshot<ContactLinkFirestoreDoc>,
    options?: SnapshotOptions
  ): ContactLink {
    const data = snapshot.data(options);

    const createdAt = (data.createdAt as Timestamp).toDate().toISOString();
    const updatedAt = data.updatedAt
      ? (data.updatedAt as Timestamp).toDate().toISOString()
      : undefined;

    return {
      id: data.id,
      sourceWorkspaceId: data.sourceWorkspaceId,
      sourceContactId: data.sourceContactId,
      targetWorkspaceId: data.targetWorkspaceId,
      targetEntityType: data.targetEntityType,
      targetEntityId: data.targetEntityId,
      reason: data.reason,
      status: data.status,
      createdAt,
      createdBy: data.createdBy,
      updatedAt,
      updatedBy: data.updatedBy,
      metadata: data.metadata,
    };
  },
};

// ============================================================================
// FILE LINK CONVERTER
// ============================================================================

/**
 * Firestore converter for FileLink entities
 */
export const fileLinkConverter: FirestoreDataConverter<FileLink> = {
  /**
   * Convert FileLink to Firestore document
   */
  toFirestore(fileLink: FileLink): DocumentData {
    const createdAt =
      typeof fileLink.createdAt === 'string'
        ? new Date(fileLink.createdAt)
        : fileLink.createdAt;

    const updatedAt = fileLink.updatedAt
      ? typeof fileLink.updatedAt === 'string'
        ? new Date(fileLink.updatedAt)
        : fileLink.updatedAt
      : null;

    return {
      id: fileLink.id,
      sourceFileId: fileLink.sourceFileId,
      sourceWorkspaceId: fileLink.sourceWorkspaceId,
      targetEntityType: fileLink.targetEntityType,
      targetEntityId: fileLink.targetEntityId,
      targetWorkspaceId: fileLink.targetWorkspaceId ?? null,
      reason: fileLink.reason ?? null,
      status: fileLink.status,
      createdAt,
      createdBy: fileLink.createdBy,
      updatedAt,
      updatedBy: fileLink.updatedBy ?? null,
      metadata: fileLink.metadata ?? null,
    } as FileLinkFirestoreDoc;
  },

  /**
   * Convert Firestore document to FileLink
   */
  fromFirestore(
    snapshot: QueryDocumentSnapshot<FileLinkFirestoreDoc>,
    options?: SnapshotOptions
  ): FileLink {
    const data = snapshot.data(options);

    const createdAt = (data.createdAt as Timestamp).toDate().toISOString();
    const updatedAt = data.updatedAt
      ? (data.updatedAt as Timestamp).toDate().toISOString()
      : undefined;

    return {
      id: data.id,
      sourceFileId: data.sourceFileId,
      sourceWorkspaceId: data.sourceWorkspaceId,
      targetEntityType: data.targetEntityType,
      targetEntityId: data.targetEntityId,
      targetWorkspaceId: data.targetWorkspaceId,
      reason: data.reason,
      status: data.status,
      createdAt,
      createdBy: data.createdBy,
      updatedAt,
      updatedBy: data.updatedBy,
      metadata: data.metadata,
    };
  },
};
