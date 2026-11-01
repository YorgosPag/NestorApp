'use client';

/**
 * Τι επιτρέπεται στον θεατή σε ένα έργο, όπως το απαντά ο διακομιστής (ADR-926 Κ7).
 *
 * Ο πελάτης δεν ξέρει την ιδιότητα μέλους, και δεν ξαναγράφει τον κριτή. Όσο δεν υπάρχει απάντηση, ή αν αποτύχει, μένει
 * `null`, δηλαδή καμία επιπλέον πράξη: το κουμπί κρύβεται, και τον έλεγχο τον ξανακάνει η διαδρομή.
 *
 * @module hooks/useProjectCapabilities
 */

import { useEffect, useState } from 'react';

import { API_ROUTES } from '@/config/domain-constants';
import { apiClient } from '@/lib/api/enterprise-api-client';
import type { ProjectViewerCapabilities } from '@/lib/auth/project-scoped-actions';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useProjectCapabilities');

interface ViewerCapabilitiesResponse {
  readonly viewerCapabilities: ProjectViewerCapabilities;
}

/** Πολλά hooks στην ίδια οθόνη ρωτούν το ίδιο έργο: ένα αίτημα εν πτήσει ανά έργο. */
const inFlight = new Map<string, Promise<ProjectViewerCapabilities>>();

function fetchOnce(projectId: string): Promise<ProjectViewerCapabilities> {
  const pending = inFlight.get(projectId);
  if (pending) return pending;

  const request = apiClient
    .get<ViewerCapabilitiesResponse>(API_ROUTES.PROJECTS.VIEWER_CAPABILITIES(projectId))
    .then((response) => response.viewerCapabilities)
    .finally(() => inFlight.delete(projectId));
  inFlight.set(projectId, request);
  return request;
}

export function useProjectCapabilities(projectId: string | null | undefined): ProjectViewerCapabilities | null {
  const [answer, setAnswer] = useState<{ readonly projectId: string; readonly capabilities: ProjectViewerCapabilities } | null>(null);

  useEffect(() => {
    if (!projectId) return undefined;

    let current = true;
    fetchOnce(projectId)
      .then((capabilities) => { if (current) setAnswer({ projectId, capabilities }); })
      .catch((error: unknown) => {
        logger.warn('Project capabilities unavailable', { projectId, error });
        if (current) setAnswer(null);
      });
    return () => { current = false; };
  }, [projectId]);

  // Απάντηση άλλου έργου δεν ισχύει εδώ, ούτε για ένα render.
  return answer !== null && answer.projectId === projectId ? answer.capabilities : null;
}
