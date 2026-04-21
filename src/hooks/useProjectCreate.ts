'use client';

import { useCallback } from 'react';
import { useProjectNotifications } from '@/hooks/notifications/useProjectNotifications';
import { createProjectWithPolicy } from '@/services/projects/project-mutation-gateway';
import type { ProjectCreatePayload } from '@/services/projects-client.service';
import type { CreateProjectResult } from '@/services/projects/project-mutation-gateway';

export function useProjectCreate() {
  const projectNotifications = useProjectNotifications();

  const createProject = useCallback(
    async (payload: ProjectCreatePayload): Promise<CreateProjectResult> => {
      const result = await createProjectWithPolicy({ payload });
      if (result.success) {
        projectNotifications.created();
      }
      return result;
    },
    [projectNotifications],
  );

  return { createProject };
}
