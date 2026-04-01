'use client';

/**
 * @fileoverview Realtime subscriptions for NavigationContext
 * @description Extracted from NavigationContext.tsx for SRP compliance.
 *              Handles project updates, entity linking, navigation refresh, and logout.
 */

import { useEffect } from 'react';
import {
  REALTIME_EVENTS,
  RealtimeService,
  type ProjectUpdatedPayload,
  type EntityLinkedPayload,
  type EntityUnlinkedPayload,
} from '@/services/realtime';
import { createModuleLogger } from '@/lib/telemetry';
import { applyUpdates } from '@/lib/utils';
import type { NavigationState } from '../types';
import { resetNavigationState } from '../NavigationContext';

const logger = createModuleLogger('NavigationSubscriptions');

const INITIAL_STATE: NavigationState = {
  companies: [],
  selectedCompany: null,
  projects: [],
  selectedProject: null,
  selectedBuilding: null,
  selectedProperty: null,
  selectedFloor: null,
  currentLevel: 'companies',
  loading: false,
  projectsLoading: false,
  error: null,
};

/**
 * Subscribes to all realtime events that affect navigation state:
 * - NAVIGATION_REFRESH → full reload
 * - PROJECT_UPDATED → patch project in state
 * - ENTITY_LINKED / ENTITY_UNLINKED → full reload
 * - auth:logout → reset state
 */
export function useNavigationSubscriptions(
  refreshNavigation: () => Promise<void>,
  setState: React.Dispatch<React.SetStateAction<NavigationState>>
): void {
  // Listen for NAVIGATION_REFRESH events
  useEffect(() => {
    const handleNavigationRefresh = () => {
      logger.info('Received NAVIGATION_REFRESH event');
      refreshNavigation();
    };

    window.addEventListener(REALTIME_EVENTS.NAVIGATION_REFRESH, handleNavigationRefresh);

    return () => {
      window.removeEventListener(REALTIME_EVENTS.NAVIGATION_REFRESH, handleNavigationRefresh);
    };
  }, [refreshNavigation]);

  // Centralized Real-time Service: project updates
  useEffect(() => {
    const handleProjectUpdate = (payload: ProjectUpdatedPayload) => {
      logger.info('Applying update for project', { projectId: payload.projectId });

      setState(prev => ({
        ...prev,
        projects: prev.projects.map(project =>
          project.id === payload.projectId
            ? applyUpdates(project, payload.updates)
            : project
        ),
        selectedProject: prev.selectedProject?.id === payload.projectId
          ? applyUpdates(prev.selectedProject, payload.updates)
          : prev.selectedProject
      }));
    };

    const unsubscribe = RealtimeService.subscribe('PROJECT_UPDATED', handleProjectUpdate, {
      checkPendingOnMount: false
    });

    return unsubscribe;
  }, [setState]);

  // Entity linking — refresh navigation hierarchy (ADR-228 Tier 1)
  useEffect(() => {
    const handleLinked = (payload: EntityLinkedPayload) => {
      logger.info('Entity linked — refreshing navigation', {
        entityType: payload.entityType,
        parentType: payload.parentType
      });
      refreshNavigation();
    };

    const handleUnlinked = (payload: EntityUnlinkedPayload) => {
      logger.info('Entity unlinked — refreshing navigation', {
        entityType: payload.entityType
      });
      refreshNavigation();
    };

    const unsubLinked = RealtimeService.subscribe('ENTITY_LINKED', handleLinked, {
      checkPendingOnMount: false
    });
    const unsubUnlinked = RealtimeService.subscribe('ENTITY_UNLINKED', handleUnlinked, {
      checkPendingOnMount: false
    });

    return () => { unsubLinked(); unsubUnlinked(); };
  }, [refreshNavigation]);

  // Listen for auth:logout event to reset navigation state
  useEffect(() => {
    const handleLogout = () => {
      logger.info('Received auth:logout event - resetting state');
      resetNavigationState();
      setState(INITIAL_STATE);
    };

    window.addEventListener('auth:logout', handleLogout);

    return () => {
      window.removeEventListener('auth:logout', handleLogout);
    };
  }, [setState]);
}
