/**
 * @module lib/navigation/project-urls
 *
 * SSoT for deep links into ONE project's details: `/projects?projectId=…&tab=…` — the two parameters
 * `useProjectsPageState` reads (`urlParamName: 'projectId'` + extra param `tab`). Call-sites never template
 * the query by hand (the parameter names live here once).
 *
 * @see ADR-917 Φ3γ (card → budget tab)
 */

import { withQuery } from '@/lib/workspace/route-worlds';

/** A project tab id of `config/project-tabs-config.ts` that links can open */
export type ProjectDeepLinkTab = 'locations' | 'budget';

export function getProjectTabUrl(projectId: string, tab: ProjectDeepLinkTab) {
  const query = new URLSearchParams({ projectId, tab });
  return withQuery('/projects', query.toString());
}
