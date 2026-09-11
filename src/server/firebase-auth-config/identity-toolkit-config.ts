/**
 * @fileoverview **ΤΟ I/O ΠΡΟΣ ΤΗΝ IDENTITY TOOLKIT ADMIN v2** — ανάγνωση/ενημέρωση ρύθμισης (ADR-851).
 * @module server/firebase-auth-config/identity-toolkit-config
 *
 * Το Admin SDK **δεν** τυλίγει το `projects.getConfig` / `projects.updateConfig`, άρα εδώ
 * ζει η **μία** κλήση REST, με το **ίδιο** διαπιστευτήριο (`getAdminAccessToken`).
 *
 * 🔒 Το σφάλμα επιστρέφεται ως **κωδικός + μήνυμα της Google** — ποτέ το σώμα της
 * απάντησης, που για το `getConfig` περιέχει και πεδία που **δεν** δηλώσαμε (SMTP, κλειδιά).
 */

import 'server-only';

import { getAdminAccessToken } from '@/lib/firebaseAdmin';

const ADMIN_V2_PROJECTS = 'https://identitytoolkit.googleapis.com/admin/v2/projects';

export class IdentityToolkitConfigError extends Error {
  constructor(readonly status: number, readonly googleStatus: string, message: string) {
    super(message);
    this.name = 'IdentityToolkitConfigError';
  }
}

async function failure(response: Response): Promise<IdentityToolkitConfigError> {
  const payload: unknown = await response.json().catch(() => null);
  const error = typeof payload === 'object' && payload !== null
    ? (payload as { error?: { status?: unknown; message?: unknown } }).error
    : undefined;
  return new IdentityToolkitConfigError(
    response.status,
    typeof error?.status === 'string' ? error.status : 'UNKNOWN',
    typeof error?.message === 'string' ? error.message : `HTTP ${response.status}`,
  );
}

/** Η ζωντανή ρύθμιση — ως `unknown`: την κρίνει **μόνο** το `auth-config-state.ts`. */
export async function fetchLiveAuthConfig(): Promise<{ readonly projectId: string; readonly live: unknown }> {
  const { accessToken, projectId } = await getAdminAccessToken();
  const response = await fetch(`${ADMIN_V2_PROJECTS}/${projectId}/config`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw await failure(response);
  return { projectId, live: await response.json() };
}

/** **Ενημέρωση ΜΟΝΟ των διαδρομών του `updateMask`.** */
export async function patchAuthConfig(body: Record<string, unknown>, updateMask: string): Promise<void> {
  const { accessToken, projectId } = await getAdminAccessToken();
  const url = `${ADMIN_V2_PROJECTS}/${projectId}/config?updateMask=${encodeURIComponent(updateMask)}`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw await failure(response);
}
