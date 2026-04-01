/**
 * =============================================================================
 * ASSOCIATION SERVICE - Facade (ADR-032)
 * =============================================================================
 *
 * Backward-compatible facade that composes:
 * - contact-link.service.ts (Contact CRUD + unlink + role update)
 * - file-link.service.ts (File CRUD)
 * - professional-snapshot.service.ts (ADR-230 snapshots)
 *
 * @module services/association.service
 * @enterprise ADR-032 - Linking Model (Associations)
 */

import * as ContactLinkService from './contact-link.service';
import * as FileLinkService from './file-link.service';
import { snapshotProfessionals } from './professional-snapshot.service';
import type { CreateContactLinkInput, CreateFileLinkInput, ListContactLinksParams, ListFileLinksParams, LinkResult, ContactWithLinks, FileWithLinks } from '@/types/associations';
import type { ProfessionalSnapshot, LegalProfessionalRole } from '@/types/legal-contracts';

/**
 * AssociationService — Facade class for backward compatibility.
 * Delegates to specialized services.
 */
export class AssociationService {
  // Contact Links
  static linkContactToEntity(input: CreateContactLinkInput): Promise<LinkResult> {
    return ContactLinkService.linkContactToEntity(input);
  }

  static getContactLinkById(linkId: string) {
    return ContactLinkService.getContactLinkById(linkId);
  }

  static listContactLinks(params: ListContactLinksParams = {}) {
    return ContactLinkService.listContactLinks(params);
  }

  static getContactWithLinks(contactId: string): Promise<ContactWithLinks | null> {
    return ContactLinkService.getContactWithLinks(contactId);
  }

  static unlinkContact(linkId: string, updatedBy: string): Promise<LinkResult> {
    return ContactLinkService.unlinkContact(linkId, updatedBy);
  }

  static updateContactLinkRole(linkId: string, role: string, updatedBy: string): Promise<LinkResult> {
    return ContactLinkService.updateContactLinkRole(linkId, role, updatedBy);
  }

  static generateContactLinkId(contactId: string, targetEntityType?: string, targetEntityId?: string, role?: string): string {
    return ContactLinkService.buildContactLinkId(contactId, targetEntityType, targetEntityId, role);
  }

  // File Links
  static linkFileToEntity(input: CreateFileLinkInput): Promise<LinkResult> {
    return FileLinkService.linkFileToEntity(input);
  }

  static getFileLinkById(linkId: string) {
    return FileLinkService.getFileLinkById(linkId);
  }

  static listFileLinks(params: ListFileLinksParams = {}) {
    return FileLinkService.listFileLinks(params);
  }

  static getFileWithLinks(fileId: string): Promise<FileWithLinks | null> {
    return FileLinkService.getFileWithLinks(fileId);
  }

  // Professional Snapshots (ADR-230)
  static snapshotProfessionals(propertyId: string, roles?: LegalProfessionalRole[]): Promise<ProfessionalSnapshot[]> {
    return snapshotProfessionals(propertyId, roles);
  }
}

export default AssociationService;
