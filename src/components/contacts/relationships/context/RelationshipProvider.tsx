'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { ContactRelationship } from '@/types/contacts/relationships';
import type { ContactType } from '@/types/contacts';
import { RequestDeduplicator } from '../hooks/useRelationshipListOptimized';
import { createModuleLogger } from '@/lib/telemetry';
import { RealtimeService } from '@/services/realtime';
import {
  deleteRelationshipWithPolicy,
  terminateRelationshipWithPolicy,
} from '@/services/contact-relationships/relationship-mutation-gateway';
import type { RelationshipCreatedPayload, RelationshipUpdatedPayload, RelationshipDeletedPayload } from '@/services/realtime';

const logger = createModuleLogger('RelationshipProvider');

interface RelationshipContextState {
  relationships: ContactRelationship[];
  loading: boolean;
  error: string | null;
  expandedRelationships: Set<string>;
  refreshRelationships: () => Promise<void>;
  deleteRelationship: (relationshipId: string) => Promise<void>;
  terminateRelationship: (relationshipId: string) => Promise<void>;
  toggleExpanded: (relationshipId: string) => void;
  contactId: string;
  contactType: ContactType;
}

interface RelationshipProviderProps {
  contactId: string;
  contactType: ContactType;
  onRelationshipsChange?: (relationships: ContactRelationship[]) => void;
  children: ReactNode;
}

const RelationshipContext = createContext<RelationshipContextState | null>(null);

export const RelationshipProvider: React.FC<RelationshipProviderProps> = ({
  contactId,
  contactType,
  onRelationshipsChange,
  children
}) => {
  const [relationships, setRelationships] = useState<ContactRelationship[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedRelationships, setExpandedRelationships] = useState<Set<string>>(new Set());

  const loadRelationships = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);

      if (forceRefresh) {
        RequestDeduplicator.invalidate(contactId);
      }

      const data = await RequestDeduplicator.get(contactId);

      setRelationships(prevRelationships => {
        const prevIds = new Set(prevRelationships.map(rel => rel.id));
        const newIds = new Set(data.map(rel => rel.id));

        const hasChanged = prevRelationships.length !== data.length ||
          !Array.from(newIds).every(id => prevIds.has(id));

        if (hasChanged || forceRefresh) {
          onRelationshipsChange?.(data);
          return data;
        }

        return prevRelationships;
      });
    } catch (err) {
      logger.error('loadRelationships failed:', { error: err });
      setError('relationships.manager.errors.listError');
      setRelationships([]);
    } finally {
      setLoading(false);
    }
  }, [contactId, onRelationshipsChange]);

  const refreshRelationships = useCallback(async () => {
    logger.info('PROVIDER: Force refreshing relationships for', { data: contactId });
    RequestDeduplicator.invalidate(contactId);
    await new Promise(resolve => setTimeout(resolve, 200));
    logger.info('PROVIDER: Cache invalidated, now reloading...');
    await loadRelationships(true);
    logger.info('PROVIDER: Refresh completed');
  }, [contactId, loadRelationships]);

  const terminateRelationship = useCallback(async (relationshipId: string) => {
    try {
      setLoading(true);
      setError(null);

      logger.info('PROVIDER: Terminating relationship:', { data: relationshipId });
      await terminateRelationshipWithPolicy({ relationshipId });

      RequestDeduplicator.invalidate(contactId);
      await loadRelationships(true);

      logger.info('PROVIDER: Relationship terminated successfully');
    } catch (err) {
      const errorMessage = 'relationships.status.terminateError';
      setError(errorMessage);
      logger.error('PROVIDER: Error terminating relationship:', { error: err });
      await loadRelationships(true);
    } finally {
      setLoading(false);
    }
  }, [contactId, loadRelationships]);

  const deleteRelationship = useCallback(async (relationshipId: string) => {
    try {
      setLoading(true);
      setError(null);

      logger.info('PROVIDER: Deleting relationship:', { data: relationshipId });
      await deleteRelationshipWithPolicy({ relationshipId });

      RequestDeduplicator.invalidate(contactId);

      setRelationships(prev => {
        const updated = prev.filter(rel => rel.id !== relationshipId);
        onRelationshipsChange?.(updated);
        return updated;
      });

      setExpandedRelationships(prev => {
        const newSet = new Set(prev);
        newSet.delete(relationshipId);
        return newSet;
      });

      logger.info('PROVIDER: Relationship deleted successfully');
    } catch (err) {
      const errorMessage = 'relationships.errors.saveFailed';
      setError(errorMessage);
      logger.error('PROVIDER: Error deleting relationship:', { error: err });
      await loadRelationships(true);
    } finally {
      setLoading(false);
    }
  }, [contactId, loadRelationships, onRelationshipsChange]);

  const toggleExpanded = useCallback((relationshipId: string) => {
    setExpandedRelationships(prev => {
      const newSet = new Set(prev);
      if (newSet.has(relationshipId)) {
        newSet.delete(relationshipId);
      } else {
        newSet.add(relationshipId);
      }
      return newSet;
    });
  }, []);

  useEffect(() => {
    if (contactId && contactId !== 'new-contact' && contactId.trim() !== '') {
      loadRelationships();
    } else {
      setRelationships([]);
      setError(null);
      setExpandedRelationships(new Set());
    }
  }, [contactId, loadRelationships]);

  useEffect(() => {
    if (!contactId || contactId === 'new-contact') return;

    const handleCreated = (payload: RelationshipCreatedPayload) => {
      if (payload.relationship.sourceId === contactId || payload.relationship.targetId === contactId) {
        RequestDeduplicator.invalidate(contactId);
        void loadRelationships(true);
      }
    };

    const handleUpdated = (payload: RelationshipUpdatedPayload) => {
      setRelationships(prev => prev.map(rel =>
        rel.id === payload.relationshipId
          ? { ...rel, ...payload.updates }
          : rel
      ));
    };

    const handleDeleted = (payload: RelationshipDeletedPayload) => {
      setRelationships(prev => {
        const updated = prev.filter(r => r.id !== payload.relationshipId);
        onRelationshipsChange?.(updated);
        return updated;
      });
    };

    const unsub1 = RealtimeService.subscribe('RELATIONSHIP_CREATED', handleCreated);
    const unsub2 = RealtimeService.subscribe('RELATIONSHIP_UPDATED', handleUpdated);
    const unsub3 = RealtimeService.subscribe('RELATIONSHIP_DELETED', handleDeleted);

    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }, [contactId, loadRelationships, onRelationshipsChange]);

  const contextValue: RelationshipContextState = {
    relationships,
    loading,
    error,
    expandedRelationships,
    refreshRelationships,
    deleteRelationship,
    terminateRelationship,
    toggleExpanded,
    contactId,
    contactType
  };

  return (
    <RelationshipContext.Provider value={contextValue}>
      {children}
    </RelationshipContext.Provider>
  );
};

export const useRelationshipContext = (): RelationshipContextState => {
  const context = useContext(RelationshipContext);

  if (!context) {
    throw new Error('useRelationshipContext must be used within a RelationshipProvider');
  }

  return context;
};
