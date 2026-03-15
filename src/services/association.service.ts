/**
 * =============================================================================
 * 🏢 ENTERPRISE: Association Service
 * =============================================================================
 *
 * Service για management των contact_links και file_links.
 * Implements ΤΕΛΕΙΩΤΙΚΗ ΕΝΤΟΛΗ linking requirements.
 *
 * @module services/association.service
 * @enterprise ADR-032 - Linking Model (Associations)
 *
 * Key Features:
 * - Link contacts από office_directory → companies/projects/units
 * - Link files → multiple entities (virtual folders)
 * - Audit trail (createdBy, createdAt, reason)
 * - No duplication (link-only, no copy)
 *
 * @example
 * ```typescript
 * import { AssociationService } from '@/services/association.service';
 *
 * // Link contact to company
 * await AssociationService.linkContactToEntity({
 *   sourceWorkspaceId: 'ws_office_directory',
 *   sourceContactId: 'contact_123',
 *   targetEntityType: 'company',
 *   targetEntityId: 'company_xyz',
 *   reason: 'Συνεργάτης για όλες τις εταιρείες',
 *   createdBy: 'user_abc',
 * });
 *
 * // Link file to project
 * await AssociationService.linkFileToEntity({
 *   sourceFileId: 'file_456',
 *   sourceWorkspaceId: 'ws_company_001',
 *   targetEntityType: 'project',
 *   targetEntityId: 'project_789',
 *   reason: 'Buyer KYC documents',
 *   createdBy: 'user_abc',
 * });
 * ```
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
// 🏢 ENTERPRISE: Centralized real-time service for cross-page sync
import { RealtimeService } from '@/services/realtime';
import { contactLinkConverter, fileLinkConverter } from '@/lib/firestore/converters/association.converter';
import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('AssociationService');
import type {
  ContactLink,
  FileLink,
  CreateContactLinkInput,
  CreateFileLinkInput,
  ListContactLinksParams,
  ListFileLinksParams,
  LinkResult,
  ContactWithLinks,
  FileWithLinks,
} from '@/types/associations';
import type {
  ProfessionalSnapshot,
  LegalProfessionalRole,
  LawyerSnapshotData,
  NotarySnapshotData,
} from '@/types/legal-contracts';
import type { PersonaData } from '@/types/contacts/personas';
import {
  findActivePersona,
  isLawyerPersona,
  isNotaryPersona,
} from '@/types/contacts/personas';

// ============================================================================
// ASSOCIATION SERVICE
// ============================================================================

export class AssociationService {
  // ==========================================================================
  // CONTACT LINKS - CREATE
  // ==========================================================================

  /**
   * Link a contact to an entity (company, project, unit)
   *
   * @param input - Contact link creation parameters
   * @returns Link result
   */
  static async linkContactToEntity(input: CreateContactLinkInput): Promise<LinkResult> {
    try {
      const { sourceWorkspaceId, sourceContactId, targetEntityType, targetEntityId, targetWorkspaceId, reason, role, createdBy, metadata } = input;

      if (!targetEntityType || !targetEntityId) {
        return {
          success: false,
          error: 'Target entity type and ID are required',
          errorCode: 'INVALID_TARGET'
        };
      }

      // ================================================================
      // QUERY-BASED duplicate detection (format-agnostic)
      // Handles both old IDs (cl_X_unit_Y) and new IDs (cl_X_unit_Y_role)
      // ================================================================
      const existingLinks = await this.listContactLinks({
        sourceContactId,
        targetEntityType,
        targetEntityId,
        status: 'active',
      });

      // Check if an active link with the SAME role already exists
      const duplicateLink = existingLinks.find((l) => l.role === role);
      if (duplicateLink) {
        logger.info(`✅ [AssociationService] Active link already exists for role=${role}: ${duplicateLink.id}`);
        return {
          success: true,
          linkId: duplicateLink.id,
          message: 'Link already exists',
        };
      }

      // Check for inactive link with same role — reactivate instead of creating new
      const inactiveLinks = await this.listContactLinks({
        sourceContactId,
        targetEntityType,
        targetEntityId,
      });
      const inactiveMatch = inactiveLinks.find(
        (l) => l.role === role && l.status === 'inactive'
      );

      if (inactiveMatch) {
        // Reactivate the existing link
        const linkRef = doc(db, COLLECTIONS.CONTACT_LINKS, inactiveMatch.id);
        await updateDoc(linkRef, {
          status: 'active',
          updatedBy: createdBy,
          updatedAt: serverTimestamp(),
        });
        logger.info(`♻️ [AssociationService] Reactivated contact link: ${inactiveMatch.id}`);

        RealtimeService.dispatch('CONTACT_LINK_CREATED', {
          linkId: inactiveMatch.id,
          link: { sourceContactId, sourceWorkspaceId, targetEntityType, targetEntityId, targetWorkspaceId },
          timestamp: Date.now(),
        });

        return {
          success: true,
          linkId: inactiveMatch.id,
          message: 'Contact link reactivated',
        };
      }

      // ================================================================
      // Cleanup: deactivate orphaned old-format links for this contact+entity
      // (links without role in the ID from before the multi-role fix)
      // ================================================================
      const oldFormatId = `cl_${sourceContactId}_${targetEntityType}_${targetEntityId}`;
      const orphanedLinks = existingLinks.filter(
        (l) => l.id === oldFormatId || (!l.role && l.id !== oldFormatId)
      );
      for (const orphan of orphanedLinks) {
        const orphanRef = doc(db, COLLECTIONS.CONTACT_LINKS, orphan.id);
        await updateDoc(orphanRef, { status: 'inactive', updatedBy: createdBy, updatedAt: serverTimestamp() });
        logger.info(`🧹 [AssociationService] Cleaned up orphaned link: ${orphan.id}`);
      }

      // ================================================================
      // Create new link with canonical ID (includes role)
      // ================================================================
      const linkId = this.generateContactLinkId(sourceContactId, targetEntityType, targetEntityId, role);

      const contactLink: ContactLink = {
        id: linkId,
        sourceWorkspaceId,
        sourceContactId,
        targetWorkspaceId,
        targetEntityType,
        targetEntityId,
        reason,
        role,
        status: 'active',
        createdAt: new Date().toISOString(),
        createdBy,
        metadata,
      };

      // Save to Firestore
      const linkRef = doc(db, COLLECTIONS.CONTACT_LINKS, linkId).withConverter(contactLinkConverter);
      await setDoc(linkRef, contactLink);

      logger.info(`✅ [AssociationService] Created contact link: ${linkId}`);

      // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
      RealtimeService.dispatch('CONTACT_LINK_CREATED', {
        linkId,
        link: {
          sourceContactId,
          sourceWorkspaceId,
          targetEntityType,
          targetEntityId,
          targetWorkspaceId,
        },
        timestamp: Date.now(),
      });

      return {
        success: true,
        linkId,
        message: 'Contact linked successfully',
      };
    } catch (error) {
      logger.error('[AssociationService] Failed to link contact:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorCode: 'LINK_CONTACT_FAILED',
      };
    }
  }

  // ==========================================================================
  // CONTACT LINKS - READ
  // ==========================================================================

  /**
   * Get contact link by ID
   *
   * @param linkId - Link ID
   * @returns Contact link or null
   */
  static async getContactLinkById(linkId: string): Promise<ContactLink | null> {
    const linkRef = doc(db, COLLECTIONS.CONTACT_LINKS, linkId).withConverter(contactLinkConverter);
    const snapshot = await getDoc(linkRef);

    if (!snapshot.exists()) {
      return null;
    }

    return snapshot.data();
  }

  /**
   * List contact links (with filters)
   *
   * @param params - Query parameters
   * @returns Array of contact links
   */
  static async listContactLinks(params: ListContactLinksParams = {}): Promise<ContactLink[]> {
    const { sourceContactId, sourceWorkspaceId, targetWorkspaceId, targetEntityType, targetEntityId, status, limit: limitParam } = params;

    // Build query
    let q = query(
      collection(db, COLLECTIONS.CONTACT_LINKS).withConverter(contactLinkConverter),
      orderBy('createdAt', 'desc')
    );

    // Add filters
    if (sourceContactId) {
      q = query(q, where('sourceContactId', '==', sourceContactId));
    }
    if (sourceWorkspaceId) {
      q = query(q, where('sourceWorkspaceId', '==', sourceWorkspaceId));
    }
    if (targetWorkspaceId) {
      q = query(q, where('targetWorkspaceId', '==', targetWorkspaceId));
    }
    if (targetEntityType) {
      q = query(q, where('targetEntityType', '==', targetEntityType));
    }
    if (targetEntityId) {
      q = query(q, where('targetEntityId', '==', targetEntityId));
    }
    if (status) {
      q = query(q, where('status', '==', status));
    }
    if (limitParam) {
      q = query(q, firestoreLimit(limitParam));
    }

    // Execute query
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => doc.data());
  }

  /**
   * Get all entities linked to a contact
   *
   * @param contactId - Contact ID
   * @returns Contact with links
   */
  static async getContactWithLinks(contactId: string): Promise<ContactWithLinks | null> {
    // Get contact links
    const links = await this.listContactLinks({
      sourceContactId: contactId,
      status: 'active',
    });

    if (links.length === 0) {
      return null;
    }

    // Build contact with links (simplified - you can enhance with actual names)
    const linkedTo = links.map((link) => ({
      workspaceId: link.targetWorkspaceId,
      entityType: link.targetEntityType,
      entityId: link.targetEntityId,
    }));

    return {
      contactId,
      contactName: '', // TODO: Fetch from contacts collection
      sourceWorkspaceId: links[0].sourceWorkspaceId,
      sourceWorkspaceName: '', // TODO: Fetch from workspaces collection
      linkedTo,
    };
  }

  // ==========================================================================
  // FILE LINKS - CREATE
  // ==========================================================================

  /**
   * Link a file to an entity (project, unit, contact, building)
   *
   * @param input - File link creation parameters
   * @returns Link result
   */
  static async linkFileToEntity(input: CreateFileLinkInput): Promise<LinkResult> {
    try {
      const { sourceFileId, sourceWorkspaceId, targetEntityType, targetEntityId, targetWorkspaceId, reason, createdBy, metadata } = input;

      // Generate link ID
      const linkId = this.generateFileLinkId(sourceFileId, targetEntityType, targetEntityId);

      // Check if link already exists
      const existing = await this.getFileLinkById(linkId);
      if (existing) {
        logger.info(`✅ [AssociationService] File link already exists: ${linkId}`);
        return {
          success: true,
          linkId,
          message: 'Link already exists',
        };
      }

      // Create file link
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

      // Save to Firestore
      const linkRef = doc(db, COLLECTIONS.FILE_LINKS, linkId).withConverter(fileLinkConverter);
      await setDoc(linkRef, fileLink);

      logger.info(`✅ [AssociationService] Created file link: ${linkId}`);

      // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
      RealtimeService.dispatch('FILE_LINK_CREATED', {
        linkId,
        link: {
          sourceFileId,
          sourceWorkspaceId,
          targetEntityType,
          targetEntityId,
          targetWorkspaceId,
        },
        timestamp: Date.now(),
      });

      return {
        success: true,
        linkId,
        message: 'File linked successfully',
      };
    } catch (error) {
      logger.error('[AssociationService] Failed to link file:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorCode: 'LINK_FILE_FAILED',
      };
    }
  }

  // ==========================================================================
  // FILE LINKS - READ
  // ==========================================================================

  /**
   * Get file link by ID
   *
   * @param linkId - Link ID
   * @returns File link or null
   */
  static async getFileLinkById(linkId: string): Promise<FileLink | null> {
    const linkRef = doc(db, COLLECTIONS.FILE_LINKS, linkId).withConverter(fileLinkConverter);
    const snapshot = await getDoc(linkRef);

    if (!snapshot.exists()) {
      return null;
    }

    return snapshot.data();
  }

  /**
   * List file links (with filters)
   *
   * @param params - Query parameters
   * @returns Array of file links
   */
  static async listFileLinks(params: ListFileLinksParams = {}): Promise<FileLink[]> {
    const { sourceFileId, sourceWorkspaceId, targetEntityType, targetEntityId, targetWorkspaceId, status, limit: limitParam } = params;

    // Build query
    let q = query(
      collection(db, COLLECTIONS.FILE_LINKS).withConverter(fileLinkConverter),
      orderBy('createdAt', 'desc')
    );

    // Add filters
    if (sourceFileId) {
      q = query(q, where('sourceFileId', '==', sourceFileId));
    }
    if (sourceWorkspaceId) {
      q = query(q, where('sourceWorkspaceId', '==', sourceWorkspaceId));
    }
    if (targetEntityType) {
      q = query(q, where('targetEntityType', '==', targetEntityType));
    }
    if (targetEntityId) {
      q = query(q, where('targetEntityId', '==', targetEntityId));
    }
    if (targetWorkspaceId) {
      q = query(q, where('targetWorkspaceId', '==', targetWorkspaceId));
    }
    if (status) {
      q = query(q, where('status', '==', status));
    }
    if (limitParam) {
      q = query(q, firestoreLimit(limitParam));
    }

    // Execute query
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => doc.data());
  }

  /**
   * Get all entities linked to a file
   *
   * @param fileId - File ID
   * @returns File with links
   */
  static async getFileWithLinks(fileId: string): Promise<FileWithLinks | null> {
    // Get file links
    const links = await this.listFileLinks({
      sourceFileId: fileId,
      status: 'active',
    });

    if (links.length === 0) {
      return null;
    }

    // Build file with links
    const linkedTo = links.map((link) => ({
      entityType: link.targetEntityType,
      entityId: link.targetEntityId,
      workspaceId: link.targetWorkspaceId,
    }));

    return {
      fileId,
      fileName: '', // TODO: Fetch from files collection
      sourceWorkspaceId: links[0].sourceWorkspaceId,
      linkedTo,
    };
  }

  // ==========================================================================
  // CONTACT LINKS - UPDATE / DEACTIVATE
  // ==========================================================================

  /**
   * Soft-delete (deactivate) a contact link
   *
   * @param linkId - Link ID to deactivate
   * @param updatedBy - User performing the action
   * @returns Link result
   */
  static async unlinkContact(linkId: string, updatedBy: string): Promise<LinkResult> {
    try {
      const linkRef = doc(db, COLLECTIONS.CONTACT_LINKS, linkId);
      const snapshot = await getDoc(linkRef);

      if (!snapshot.exists()) {
        return {
          success: false,
          error: 'Contact link not found',
          errorCode: 'LINK_NOT_FOUND',
        };
      }

      const linkData = snapshot.data() as ContactLink;

      await updateDoc(linkRef, {
        status: 'inactive',
        updatedBy,
        updatedAt: serverTimestamp(),
      });

      logger.info(`[AssociationService] Deactivated contact link: ${linkId}`);

      // ================================================================
      // Cleanup: deactivate ALL active links for the same contact+entity+role
      // Catches old-format orphans (cl_X_unit_Y) that duplicate this link
      // ================================================================
      if (linkData.sourceContactId && linkData.targetEntityType && linkData.targetEntityId) {
        const siblingLinks = await this.listContactLinks({
          sourceContactId: linkData.sourceContactId,
          targetEntityType: linkData.targetEntityType,
          targetEntityId: linkData.targetEntityId,
          status: 'active',
        });

        const orphans = siblingLinks.filter(
          (l) => l.id !== linkId && l.role === linkData.role
        );

        for (const orphan of orphans) {
          const orphanRef = doc(db, COLLECTIONS.CONTACT_LINKS, orphan.id);
          await updateDoc(orphanRef, { status: 'inactive', updatedBy, updatedAt: serverTimestamp() });
          logger.info(`🧹 [AssociationService] Cleaned up orphaned sibling link: ${orphan.id}`);
        }
      }

      RealtimeService.dispatch('CONTACT_LINK_REMOVED', {
        linkId,
        timestamp: Date.now(),
      });

      return {
        success: true,
        linkId,
        message: 'Contact link deactivated',
      };
    } catch (error) {
      logger.error('[AssociationService] Failed to unlink contact:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorCode: 'UNLINK_CONTACT_FAILED',
      };
    }
  }

  /**
   * Update the role of a contact link
   *
   * @param linkId - Link ID to update
   * @param role - New role value
   * @param updatedBy - User performing the action
   * @returns Link result
   */
  static async updateContactLinkRole(linkId: string, role: string, updatedBy: string): Promise<LinkResult> {
    try {
      const linkRef = doc(db, COLLECTIONS.CONTACT_LINKS, linkId);
      const snapshot = await getDoc(linkRef);

      if (!snapshot.exists()) {
        return {
          success: false,
          error: 'Contact link not found',
          errorCode: 'LINK_NOT_FOUND',
        };
      }

      await updateDoc(linkRef, {
        role,
        updatedBy,
        updatedAt: serverTimestamp(),
      });

      logger.info(`[AssociationService] Updated role for link ${linkId} → ${role}`);

      return {
        success: true,
        linkId,
        message: 'Role updated successfully',
      };
    } catch (error) {
      logger.error('[AssociationService] Failed to update role:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorCode: 'UPDATE_ROLE_FAILED',
      };
    }
  }

  // ==========================================================================
  // PROFESSIONAL SNAPSHOTS (ADR-230: Contract Workflow)
  // ==========================================================================

  /**
   * Δημιουργεί immutable snapshots των νομικών επαγγελματιών ενός unit.
   * Χρησιμοποιείται κατά τη δημιουργία/υπογραφή contract.
   *
   * Διαβάζει live associations (contact_links) → fetch contact → persona → snapshot.
   *
   * @param unitId - Unit ID
   * @param roles - Ποιους ρόλους να γυρίσει (default: όλους τους νομικούς)
   * @returns Array of ProfessionalSnapshot
   */
  static async snapshotProfessionals(
    unitId: string,
    roles: LegalProfessionalRole[] = ['seller_lawyer', 'buyer_lawyer', 'notary']
  ): Promise<ProfessionalSnapshot[]> {
    try {
      // 1. Βρες active contact links για αυτό το unit με νομικούς ρόλους
      const links = await this.listContactLinks({
        targetEntityType: 'unit',
        targetEntityId: unitId,
        status: 'active',
      });

      const legalLinks = links.filter(
        (link) => link.role && (roles as string[]).includes(link.role)
      );

      if (legalLinks.length === 0) {
        return [];
      }

      // 2. Fetch contact data + create snapshot
      const snapshots: ProfessionalSnapshot[] = [];

      for (const link of legalLinks) {
        const contactRef = doc(db, COLLECTIONS.CONTACTS, link.sourceContactId);
        const contactSnap = await getDoc(contactRef);

        if (!contactSnap.exists()) continue;

        const contactData = contactSnap.data();
        const role = link.role as LegalProfessionalRole;
        const personas: PersonaData[] = contactData.personas ?? [];

        // Build role-specific data
        let roleSpecificData: LawyerSnapshotData | NotarySnapshotData;

        if (role === 'notary') {
          const notaryPersona = findActivePersona(personas, 'notary');
          roleSpecificData = {
            type: 'notary',
            notaryRegistryNumber: (notaryPersona && isNotaryPersona(notaryPersona))
              ? notaryPersona.notaryRegistryNumber
              : null,
            notaryDistrict: (notaryPersona && isNotaryPersona(notaryPersona))
              ? notaryPersona.notaryDistrict
              : null,
          };
        } else {
          const lawyerPersona = findActivePersona(personas, 'lawyer');
          roleSpecificData = {
            type: 'lawyer',
            barAssociationNumber: (lawyerPersona && isLawyerPersona(lawyerPersona))
              ? lawyerPersona.barAssociationNumber
              : null,
            barAssociation: (lawyerPersona && isLawyerPersona(lawyerPersona))
              ? lawyerPersona.barAssociation
              : null,
          };
        }

        snapshots.push({
          contactId: link.sourceContactId,
          displayName: [contactData.firstName, contactData.lastName].filter(Boolean).join(' ')
            || contactData.companyName || 'Unknown',
          role,
          phone: contactData.phone ?? null,
          email: contactData.email ?? null,
          taxId: contactData.taxId ?? null,
          roleSpecificData,
          snapshotAt: new Date().toISOString(),
        });
      }

      logger.info(`[AssociationService] Snapshot ${snapshots.length} professionals for unit ${unitId}`);
      return snapshots;
    } catch (error) {
      logger.error('[AssociationService] Failed to snapshot professionals:', error);
      return [];
    }
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  /**
   * Generate contact link ID
   *
   * @param contactId - Contact ID
   * @param targetEntityType - Target entity type
   * @param targetEntityId - Target entity ID
   * @returns Generated link ID
   */
  private static generateContactLinkId(
    contactId: string,
    targetEntityType?: string,
    targetEntityId?: string,
    role?: string
  ): string {
    const base = `cl_${contactId}_${targetEntityType}_${targetEntityId}`;
    return role ? `${base}_${role}` : base;
  }

  /**
   * Generate file link ID
   *
   * @param fileId - File ID
   * @param targetEntityType - Target entity type
   * @param targetEntityId - Target entity ID
   * @returns Generated link ID
   */
  private static generateFileLinkId(
    fileId: string,
    targetEntityType: string,
    targetEntityId: string
  ): string {
    return `fl_${fileId}_${targetEntityType}_${targetEntityId}`;
  }
}

// Default export for convenience
export default AssociationService;
