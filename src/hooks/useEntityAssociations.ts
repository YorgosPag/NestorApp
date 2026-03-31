/**
 * =============================================================================
 * Entity Associations Hooks
 * =============================================================================
 *
 * - useEntityContactLinks: Entity-side (Project/Building βλέπει τις επαφές)
 * - useContactEntityLinks: Contact-side (Επαφή βλέπει τα entities)
 *
 * @module hooks/useEntityAssociations
 * @enterprise ADR-032 - Linking Model (Associations)
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { AssociationService } from '@/services/association.service';
import { ContactsService } from '@/services/contacts.service';
import { ContactNameResolver } from '@/services/contacts/ContactNameResolver';
import { useAuth } from '@/auth/hooks/useAuth';
import { RealtimeService } from '@/services/realtime';
import type { ContactLinkCreatedPayload, ContactLinkDeletedPayload } from '@/services/realtime';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import type { EntityType } from '@/config/domain-constants';
import type { ContactLink } from '@/types/associations';
import type { EntityAssociationLink, ContactEntityLink, GroupedContactEntityLinks } from '@/types/entity-associations';

const logger = createModuleLogger('useEntityAssociations');

// ============================================================================
// ENTITY-SIDE HOOK: Entity → linked contacts
// ============================================================================

interface UseEntityContactLinksReturn {
  links: EntityAssociationLink[];
  isLoading: boolean;
  error: string | null;
  addLink: (contactId: string, role: string) => Promise<boolean>;
  removeLink: (linkId: string) => Promise<boolean>;
  updateRole: (linkId: string, newRole: string) => Promise<boolean>;
  refresh: () => void;
}

/**
 * Options for useEntityContactLinks hook
 */
interface UseEntityContactLinksOptions {
  /** Parent project ID for inheritance (Building → gets Project contacts) */
  parentProjectId?: string;
}

/**
 * Hook for entity-side: "Ποιες επαφές είναι συνδεδεμένες σε αυτό το entity;"
 *
 * When parentProjectId is provided, also fetches contacts linked to the
 * parent project and marks them as inherited (SAP/Procore pattern).
 */
export function useEntityContactLinks(
  entityType: EntityType,
  entityId: string | undefined,
  options?: UseEntityContactLinksOptions
): UseEntityContactLinksReturn {
  const { user } = useAuth();
  const [links, setLinks] = useState<EntityAssociationLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const parentProjectId = options?.parentProjectId;

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  // Fetch links + resolve contact names (+ inherited from parent project)
  useEffect(() => {
    if (!entityId || !user) {
      setLinks([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const fetchLinks = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch direct links for this entity
        const directLinksPromise = AssociationService.listContactLinks({
          targetEntityType: entityType,
          targetEntityId: entityId,
          status: 'active',
        });

        // Fetch inherited links from parent project (if applicable)
        const inheritedLinksPromise = parentProjectId
          ? AssociationService.listContactLinks({
              targetEntityType: 'project' as EntityType,
              targetEntityId: parentProjectId,
              status: 'active',
            })
          : Promise.resolve([]);

        const [directRawLinks, inheritedRawLinks] = await Promise.all([
          directLinksPromise,
          inheritedLinksPromise,
        ]);

        if (cancelled) return;

        // Resolve direct contact names
        const directResolved = await resolveContactLinks(directRawLinks, false);

        // Resolve inherited contact names — exclude contacts already directly linked
        const directContactIds = new Set(directRawLinks.map((l) => l.sourceContactId));
        const uniqueInheritedRaw = inheritedRawLinks.filter(
          (l) => !directContactIds.has(l.sourceContactId)
        );
        const inheritedResolved = await resolveContactLinks(
          uniqueInheritedRaw,
          true,
          parentProjectId
        );

        if (!cancelled) {
          // Direct links first, then inherited
          setLinks([...directResolved, ...inheritedResolved]);
        }
      } catch (err) {
        if (!cancelled) {
          const msg = getErrorMessage(err, 'Failed to load associations');
          setError(msg);
          logger.error('Failed to load entity contact links', { error: err });
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchLinks();
    return () => { cancelled = true; };
  }, [entityType, entityId, parentProjectId, user, refreshKey]);

  // 🏢 ENTERPRISE: Event bus subscribers for cross-tab contact link sync (ADR-228 Tier 4)
  useEffect(() => {
    if (!entityId) return;

    const handleLinkCreated = (payload: ContactLinkCreatedPayload) => {
      if (payload.link.targetEntityType === entityType && payload.link.targetEntityId === entityId) {
        refresh();
      }
    };

    const handleLinkRemoved = (_payload: ContactLinkDeletedPayload) => {
      refresh();
    };

    const unsub1 = RealtimeService.subscribe('CONTACT_LINK_CREATED', handleLinkCreated);
    const unsub2 = RealtimeService.subscribe('CONTACT_LINK_REMOVED', handleLinkRemoved);

    return () => { unsub1(); unsub2(); };
  }, [entityType, entityId, refresh]);

  // Add a new contact link
  const addLink = useCallback(async (contactId: string, role: string): Promise<boolean> => {
    if (!entityId || !user) return false;

    const result = await AssociationService.linkContactToEntity({
      sourceWorkspaceId: 'default',
      sourceContactId: contactId,
      targetEntityType: entityType,
      targetEntityId: entityId,
      role,
      createdBy: user.uid,
    });

    if (result.success) {
      refresh();
      return true;
    }

    logger.error('Failed to add contact link', { error: result });
    return false;
  }, [entityType, entityId, user, refresh]);

  // Remove (deactivate) a contact link
  const removeLink = useCallback(async (linkId: string): Promise<boolean> => {
    if (!user) return false;

    const result = await AssociationService.unlinkContact(linkId, user.uid);
    if (result.success) {
      refresh();
      return true;
    }

    logger.error('Failed to remove contact link', { error: result });
    return false;
  }, [user, refresh]);

  // Update role of a contact link
  const updateRole = useCallback(async (linkId: string, newRole: string): Promise<boolean> => {
    if (!user) return false;

    const result = await AssociationService.updateContactLinkRole(linkId, newRole, user.uid);
    if (result.success) {
      refresh();
      return true;
    }

    logger.error('Failed to update contact link role', { error: result });
    return false;
  }, [user, refresh]);

  return { links, isLoading, error, addLink, removeLink, updateRole, refresh };
}

// ============================================================================
// CONTACT-SIDE HOOK: Contact → linked entities
// ============================================================================

interface UseContactEntityLinksReturn {
  grouped: GroupedContactEntityLinks;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Hook for contact-side: "Σε ποια entities είναι συνδεδεμένη αυτή η επαφή;"
 */
export function useContactEntityLinks(
  contactId: string | undefined
): UseContactEntityLinksReturn {
  const { user } = useAuth();
  const [grouped, setGrouped] = useState<GroupedContactEntityLinks>({
    projects: [],
    buildings: [],
    units: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    if (!contactId || !user) {
      setGrouped({ projects: [], buildings: [], units: [] });
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const fetchLinks = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const rawLinks = await AssociationService.listContactLinks({
          sourceContactId: contactId,
          status: 'active',
        });

        if (cancelled) return;

        const result: GroupedContactEntityLinks = {
          projects: [],
          buildings: [],
          units: [],
        };

        for (const link of rawLinks) {
          const entityLink = mapToContactEntityLink(link);
          if (!entityLink) continue;

          switch (link.targetEntityType) {
            case 'project':
              result.projects.push(entityLink);
              break;
            case 'building':
              result.buildings.push(entityLink);
              break;
            case 'property':
              result.units.push(entityLink);
              break;
          }
        }

        if (!cancelled) setGrouped(result);
      } catch (err) {
        if (!cancelled) {
          const msg = getErrorMessage(err, 'Failed to load entity links');
          setError(msg);
          logger.error('Failed to load contact entity links', { error: err });
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchLinks();
    return () => { cancelled = true; };
  }, [contactId, user, refreshKey]);

  // 🏢 ENTERPRISE: Event bus subscribers for cross-tab contact link sync (ADR-228 Tier 4)
  useEffect(() => {
    if (!contactId) return;

    const handleLinkCreated = (payload: ContactLinkCreatedPayload) => {
      if (payload.link.sourceContactId === contactId) {
        refresh();
      }
    };

    const handleLinkRemoved = (_payload: ContactLinkDeletedPayload) => {
      refresh();
    };

    const unsub1 = RealtimeService.subscribe('CONTACT_LINK_CREATED', handleLinkCreated);
    const unsub2 = RealtimeService.subscribe('CONTACT_LINK_REMOVED', handleLinkRemoved);

    return () => { unsub1(); unsub2(); };
  }, [contactId, refresh]);

  return { grouped, isLoading, error, refresh };
}

// ============================================================================
// HELPERS — Contact Resolution
// ============================================================================

/**
 * Resolves contact names for a list of raw contact links.
 * Optionally marks them as inherited from a parent entity.
 */
async function resolveContactLinks(
  rawLinks: ContactLink[],
  inherited: boolean,
  inheritedFromId?: string
): Promise<EntityAssociationLink[]> {
  return Promise.all(
    rawLinks.map(async (link) => {
      let contactName = link.sourceContactId;
      let contactType = 'individual';

      try {
        const contact = await ContactsService.getContact(link.sourceContactId);
        if (contact) {
          const nameResult = ContactNameResolver.resolveContactDisplayName(contact);
          contactName = nameResult.displayName;
          contactType = contact.type || 'individual';
        }
      } catch {
        logger.warn(`Could not resolve contact name for ${link.sourceContactId}`);
      }

      const enriched: EntityAssociationLink = {
        linkId: link.id,
        contactId: link.sourceContactId,
        contactName,
        contactType,
        role: link.role || '',
        createdAt: typeof link.createdAt === 'string' ? link.createdAt : '',
        ...(inherited
          ? {
              inherited: true,
              inheritedFromType: 'project' as EntityType,
              inheritedFromId,
            }
          : {}),
      };
      return enriched;
    })
  );
}

// ============================================================================
// HELPERS — Contact Entity Link Mapping
// ============================================================================

function mapToContactEntityLink(link: ContactLink): ContactEntityLink | null {
  if (!link.targetEntityType || !link.targetEntityId) return null;

  return {
    linkId: link.id,
    entityType: link.targetEntityType,
    entityId: link.targetEntityId,
    entityName: link.targetEntityId, // Will be resolved later in component if needed
    role: link.role || '',
    createdAt: typeof link.createdAt === 'string' ? link.createdAt : '',
  };
}
