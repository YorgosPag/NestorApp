/**
 * =============================================================================
 * 🏢 ENTERPRISE: Workspace Firestore Converter
 * =============================================================================
 *
 * Type-safe converter για Workspace entities.
 * Converts between Firestore Timestamp και JavaScript Date strings.
 *
 * @module lib/firestore/converters/workspace.converter
 * @enterprise ADR-032 - Workspace-based Multi-Tenancy
 */

import type {
  DocumentData,
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
  Timestamp,
} from 'firebase/firestore';
import type {
  Workspace,
  WorkspaceFirestoreDoc,
  WorkspaceMember,
  WorkspaceMemberFirestoreDoc,
} from '@/types/workspace';

// ============================================================================
// WORKSPACE CONVERTER
// ============================================================================

/**
 * Firestore converter for Workspace entities
 */
export const workspaceConverter: FirestoreDataConverter<Workspace> = {
  /**
   * Convert Workspace to Firestore document
   */
  toFirestore(workspace: Workspace): DocumentData {
    // Convert string dates back to Timestamps if needed
    const createdAt =
      typeof workspace.createdAt === 'string'
        ? new Date(workspace.createdAt)
        : workspace.createdAt;

    const updatedAt = workspace.updatedAt
      ? typeof workspace.updatedAt === 'string'
        ? new Date(workspace.updatedAt)
        : workspace.updatedAt
      : undefined;

    return {
      id: workspace.id,
      type: workspace.type,
      displayName: workspace.displayName,
      description: workspace.description,
      companyId: workspace.companyId,
      status: workspace.status,
      settings: workspace.settings,
      createdAt,
      createdBy: workspace.createdBy,
      updatedAt,
      updatedBy: workspace.updatedBy,
      metadata: workspace.metadata,
    } as WorkspaceFirestoreDoc;
  },

  /**
   * Convert Firestore document to Workspace
   */
  fromFirestore(
    snapshot: QueryDocumentSnapshot<WorkspaceFirestoreDoc>,
    options?: SnapshotOptions
  ): Workspace {
    const data = snapshot.data(options);

    // Convert Timestamps to ISO strings
    const createdAt = (data.createdAt as Timestamp).toDate().toISOString();
    const updatedAt = data.updatedAt
      ? (data.updatedAt as Timestamp).toDate().toISOString()
      : undefined;

    return {
      id: data.id,
      type: data.type,
      displayName: data.displayName,
      description: data.description,
      companyId: data.companyId,
      status: data.status,
      settings: data.settings,
      createdAt,
      createdBy: data.createdBy,
      updatedAt,
      updatedBy: data.updatedBy,
      metadata: data.metadata,
    };
  },
};

// ============================================================================
// WORKSPACE MEMBER CONVERTER
// ============================================================================

/**
 * Firestore converter for WorkspaceMember entities
 */
export const workspaceMemberConverter: FirestoreDataConverter<WorkspaceMember> = {
  /**
   * Convert WorkspaceMember to Firestore document
   */
  toFirestore(member: WorkspaceMember): DocumentData {
    const addedAt =
      typeof member.addedAt === 'string'
        ? new Date(member.addedAt)
        : member.addedAt;

    const lastActiveAt = member.lastActiveAt
      ? typeof member.lastActiveAt === 'string'
        ? new Date(member.lastActiveAt)
        : member.lastActiveAt
      : undefined;

    return {
      id: member.id,
      workspaceId: member.workspaceId,
      userId: member.userId,
      userEmail: member.userEmail,
      userDisplayName: member.userDisplayName,
      role: member.role,
      addedAt,
      addedBy: member.addedBy,
      lastActiveAt,
    } as WorkspaceMemberFirestoreDoc;
  },

  /**
   * Convert Firestore document to WorkspaceMember
   */
  fromFirestore(
    snapshot: QueryDocumentSnapshot<WorkspaceMemberFirestoreDoc>,
    options?: SnapshotOptions
  ): WorkspaceMember {
    const data = snapshot.data(options);

    const addedAt = (data.addedAt as Timestamp).toDate().toISOString();
    const lastActiveAt = data.lastActiveAt
      ? (data.lastActiveAt as Timestamp).toDate().toISOString()
      : undefined;

    return {
      id: data.id,
      workspaceId: data.workspaceId,
      userId: data.userId,
      userEmail: data.userEmail,
      userDisplayName: data.userDisplayName,
      role: data.role,
      addedAt,
      addedBy: data.addedBy,
      lastActiveAt,
    };
  },
};
