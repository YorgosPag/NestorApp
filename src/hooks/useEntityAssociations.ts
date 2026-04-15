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
import type { ReactNode } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { AssociationService } from '@/services/association.service';
import { ContactsService } from '@/services/contacts.service';
import { ContactNameResolver } from '@/services/contacts/ContactNameResolver';
import {
  linkContactToEntityWithPolicy,
  unlinkContactWithPolicy,
  updateContactLinkRoleWithPolicy,
} from '@/services/entity-linking/association-mutation-gateway';
import { useAuth } from '@/auth/hooks/useAuth';
import { RealtimeService } from '@/services/realtime';
import { useLinkRemovalGuard } from '@/hooks/useLinkRemovalGuard';
import type { ContactLinkCreatedPayload, ContactLinkDeletedPayload } from '@/services/realtime';
import { useNotifications } from '@/providers/NotificationProvider';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { createStaleCache } from '@/lib/stale-cache';
import { maybeFillProfessionFromRole } from '@/services/profession-bridge.service';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { EntityType } from '@/config/domain-constants';
import type { ContactLink } from '@/types/associations';
import type { EntityAssociationLink, ContactEntityLink, GroupedContactEntityLinks } from '@/types/entity-associations';

const logger = createModuleLogger('useEntityAssociations');

// ADR-300: Module-level caches — keyed by entity/contact, survive re-navigation
const entityContactLinksCache = createStaleCache<EntityAssociationLink[]>('entity-contact-links');
const contactEntityLinksCache = createStaleCache<GroupedContactEntityLinks>('contact-entity-links');

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
  LinkRemovalBlockedDialog: ReactNode;
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
  const { info } = useNotifications();
  // ADR-300: Seed from module-level cache → zero flash on re-navigation
  const entityCacheKey = `${entityType}-${entityId ?? 'none'}-${options?.parentProjectId ?? 'none'}`;
  const [links, setLinks] = useState<EntityAssociationLink[]>(entityContactLinksCache.get(entityCacheKey) ?? []);
  const [isLoading, setIsLoading] = useState(!entityContactLinksCache.hasLoaded(entityCacheKey));
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const { checkBeforeRemove, BlockedDialog: LinkRemovalBlockedDialog } = useLinkRemovalGuard();

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
      const key = `${entityType}-${entityId}-${parentProjectId ?? 'none'}`;
      // ADR-300: Only show spinner on first load — not on re-navigation
      if (!entityContactLinksCache.hasLoaded(key)) setIsLoading(true);
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
          const allLinks = [...directResolved, ...inheritedResolved];
          // ADR-300: Write to module-level cache so next remount skips spinner
          const key = `${entityType}-${entityId}-${parentProjectId ?? 'none'}`;
          entityContactLinksCache.set(allLinks, key);
          setLinks(allLinks);
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

    const result = await linkContactToEntityWithPolicy({
      input: {
        sourceWorkspaceId: 'default',
        sourceContactId: contactId,
        targetEntityType: entityType,
        targetEntityId: entityId,
        role,
        createdBy: user.uid,
      },
    });

    if (result.success) {
      refresh();

      // ADR-282: Auto-fill profession from project role (non-blocking)
      if (entityType === 'project') {
        maybeFillProfessionFromRole(contactId, role)
          .then((bridgeResult) => {
            if (bridgeResult.updated && bridgeResult.profession) {
              info(`Το επάγγελμα ορίστηκε αυτόματα: ${bridgeResult.profession}`);
            }
          })
          .catch((err) => {
            logger.warn('Profession bridge failed (non-critical)', { error: err });
          });
      }

      return true;
    }

    logger.error('Failed to add contact link', { error: result });
    return false;
  }, [entityType, entityId, user, refresh, info]);

  // Remove (deactivate) a contact link
  const removeLink = useCallback(async (linkId: string): Promise<boolean> => {
    if (!user) return false;

    const allowed = await checkBeforeRemove(linkId);
    if (!allowed) return false;

    const result = await unlinkContactWithPolicy({ linkId, updatedBy: user.uid });
    if (result.success) {
      refresh();
      return true;
    }

    logger.error('Failed to remove contact link', { error: result });
    return false;
  }, [user, refresh, checkBeforeRemove]);

  // Update role of a contact link
  const updateRole = useCallback(async (linkId: string, newRole: string): Promise<boolean> => {
    if (!user) return false;

    const result = await updateContactLinkRoleWithPolicy({
      linkId,
      role: newRole,
      updatedBy: user.uid,
    });
    if (result.success) {
      refresh();
      return true;
    }

    logger.error('Failed to update contact link role', { error: result });
    return false;
  }, [user, refresh]);

  return {
    links,
    isLoading,
    error,
    addLink,
    removeLink,
    updateRole,
    refresh,
    LinkRemovalBlockedDialog,
  };
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
  // ADR-300: Seed from module-level cache → zero flash on re-navigation
  const [grouped, setGrouped] = useState<GroupedContactEntityLinks>(
    contactEntityLinksCache.get(contactId ?? '') ?? { projects: [], buildings: [], properties: [] }
  );
  const [isLoading, setIsLoading] = useState(!contactEntityLinksCache.hasLoaded(contactId ?? ''));
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    if (!contactId || !user) {
      setGrouped({ projects: [], buildings: [], properties: [] });
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const fetchLinks = async () => {
      // ADR-300: Only show spinner on first load — not on re-navigation
      if (!contactEntityLinksCache.hasLoaded(contactId)) setIsLoading(true);
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
          properties: [],
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
              result.properties.push(entityLink);
              break;
          }
        }

        // Resolve entity names (project name, building name, etc.)
        await resolveEntityNames(result);

        if (!cancelled) {
          // ADR-300: Write to module-level cache so next remount skips spinner
          contactEntityLinksCache.set(result, contactId);
          setGrouped(result);
        }
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
    entityName: link.targetEntityId, // Placeholder — resolved by resolveEntityNames
    role: link.role || '',
    createdAt: typeof link.createdAt === 'string' ? link.createdAt : '',
  };
}

// ============================================================================
// HELPERS — Entity Name Resolution
// ============================================================================

const ENTITY_COLLECTION_MAP: Record<string, string> = {
  project: COLLECTIONS.PROJECTS,
  building: COLLECTIONS.BUILDINGS,
  property: COLLECTIONS.PROPERTIES,
};

/**
 * Resolves entity display names for all links in the grouped result.
 * Reads entity documents from Firestore to get the real name.
 */
async function resolveEntityNames(grouped: GroupedContactEntityLinks): Promise<void> {
  const allLinks = [
    ...grouped.projects,
    ...grouped.buildings,
    ...grouped.properties,
  ];

  await Promise.all(
    allLinks.map(async (link) => {
      const collectionName = ENTITY_COLLECTION_MAP[link.entityType];
      if (!collectionName) return;

      try {
        const docRef = doc(db, collectionName, link.entityId);
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
          const data = snapshot.data();
          link.entityName = data.name || data.title || link.entityId;
        }
      } catch {
        logger.warn(`Could not resolve name for ${link.entityType}/${link.entityId}`);
      }
    })
  );
}
