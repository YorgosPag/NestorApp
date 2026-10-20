/**
 * Project reference — how financial-intelligence records name the project they belong to.
 *
 * A record stores the project's document ID and a display name copied from the project
 * document at write time. The name is never taken from the client: free-text project
 * names drifted (typos, renames) and could not be joined back to the portfolio.
 *
 * @module services/financial-intelligence/project-reference
 * @enterprise SPEC-242C — Portfolio Dashboard & Debt Maturity Wall
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { getString } from '@/lib/firestore/field-extractors';

/** The slice of the Admin Firestore API this module reads through. */
interface ProjectDocReader {
  collection(path: string): {
    doc(id: string): {
      get(): Promise<{ exists: boolean; data(): Record<string, unknown> | undefined }>;
    };
  };
}

/** Display name of a project document — `name`, falling back to the legacy `title`. */
export function readProjectDisplayName(projectData: Record<string, unknown>): string {
  return getString(projectData, 'name', '') || getString(projectData, 'title', 'Unknown');
}

/**
 * Display name of `projectId` if it is a project of `companyId`, otherwise `null`.
 * A project of another company answers exactly like a missing one.
 */
export async function resolveCompanyProjectName(
  db: ProjectDocReader,
  projectId: string,
  companyId: string,
): Promise<string | null> {
  const snap = await db.collection(COLLECTIONS.PROJECTS).doc(projectId).get();
  const data = snap.data();
  if (!snap.exists || !data || data[FIELDS.COMPANY_ID] !== companyId) return null;
  return readProjectDisplayName(data);
}
