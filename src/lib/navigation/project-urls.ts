/**
 * @module lib/navigation/project-urls
 *
 * SSoT for links into ONE project's details: `/projects?projectId=…` (overview) and `/projects?projectId=…&tab=…`
 * (deep link). The two parameter names live here ONCE: `useProjectsPageState` reads `PROJECT_ID_PARAM` (selection)
 * and `ProjectViewSwitch` reads/writes `PROJECT_TAB_PARAM` (active tab, ADR-242 Step 3). Call-sites never template
 * the query by hand.
 *
 * 🔑 The canonical address is the query form: `/projects/[id]` is only a server redirect to it (one extra hop).
 *
 * @see ADR-917 Φ3γ (card → budget tab) · ADR-242 (portfolio table → project overview)
 */

import { withQuery } from '@/lib/workspace/route-worlds';

/** The query key that selects the project on `/projects`. */
export const PROJECT_ID_PARAM = 'projectId';

/** The query key of the active project tab — absent ⇒ the default tab (one screen, one address). */
export const PROJECT_TAB_PARAM = 'tab';

/**
 * A project tab id of `config/project-tabs-config.ts` that links can open.
 * Anchored by test: every member must be a selectable tab (`getSelectableProjectTabIds`) — else the link silently
 * lands on the default tab.
 */
export type ProjectDeepLinkTab = 'locations' | 'budget';

function projectQuery(projectId: string, tab?: ProjectDeepLinkTab) {
  const query = new URLSearchParams({ [PROJECT_ID_PARAM]: projectId });
  if (tab !== undefined) query.set(PROJECT_TAB_PARAM, tab);
  return withQuery('/projects', query.toString());
}

/** The project's overview (its default tab) — for links whose context matches no single tab. */
export function getProjectUrl(projectId: string) {
  return projectQuery(projectId);
}

export function getProjectTabUrl(projectId: string, tab: ProjectDeepLinkTab) {
  return projectQuery(projectId, tab);
}
