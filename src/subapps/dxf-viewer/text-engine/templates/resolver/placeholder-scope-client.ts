'use client';
/**
 * ADR-651 Φάση Β — client-side cache of the Firestore-derived placeholder scope.
 *
 * The insert command must resolve a template SYNCHRONOUSLY at click time (no await in
 * the commit path ⇒ no race between the click and the fetch, and the ghost/footprint
 * stays a pure projection — ADR-040). So the scope is fetched ONCE when the tool arms
 * and parked in this module singleton; the click reads it with a getter.
 *
 * Plain singleton, zero React state — same pattern as `ViewportStore` / `HoverStore`.
 * The scope changes only when the active project changes (low frequency), so nothing
 * subscribes: consumers read at event time.
 *
 * @see ./scope-builder.ts — the server-only builder behind the route (SSoT)
 * @see /api/dxf/text-templates/placeholder-scope — the route that exposes it
 */

import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import type { PlaceholderScopeSources } from './scope.types';

const logger = createModuleLogger('PlaceholderScopeClient');

const SCOPE_ENDPOINT = '/api/dxf/text-templates/placeholder-scope';

/** No project selected ⇒ still a valid cache key (company + user scope resolve fine). */
const NO_PROJECT_KEY = '';

interface ScopeResponse {
  readonly success?: boolean;
  readonly scope?: PlaceholderScopeSources;
}

let cachedKey: string | null = null;
let cachedSources: PlaceholderScopeSources = {};
/** In-flight request per key — a second `load` while one is pending reuses it (idempotent). */
let pending: { readonly key: string; readonly promise: Promise<PlaceholderScopeSources> } | null =
  null;

async function requestScope(projectId: string | undefined): Promise<PlaceholderScopeSources> {
  const response = await fetch(SCOPE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId }),
  });
  if (!response.ok) throw new Error(`Scope request failed: ${response.status}`);
  const payload = (await response.json()) as ScopeResponse;
  return payload.scope ?? {};
}

/**
 * Fetch + cache the scope for `projectId` (idempotent: a cached or in-flight key is
 * reused). Failures are logged and cached as an empty scope — a title block with blank
 * fields is a better outcome than a blocked insert, and the user can still edit it.
 */
export async function loadPlaceholderScope(
  projectId?: string,
): Promise<PlaceholderScopeSources> {
  const key = projectId ?? NO_PROJECT_KEY;
  if (cachedKey === key) return cachedSources;
  if (pending?.key === key) return pending.promise;

  const promise = requestScope(projectId)
    .catch((error: unknown) => {
      logger.warn('Placeholder scope unavailable — inserting with empty fields', {
        projectId,
        error: getErrorMessage(error),
      });
      return {} as PlaceholderScopeSources;
    })
    .then((sources) => {
      cachedKey = key;
      cachedSources = sources;
      pending = null;
      return sources;
    });

  pending = { key, promise };
  return promise;
}

/** Event-time read (click / ghost). Empty scope until `loadPlaceholderScope` resolves. */
export function getPlaceholderScopeSources(): PlaceholderScopeSources {
  return cachedSources;
}

/**
 * ADR-651 Φάση Ε — η μόλις ανεβασμένη σφραγίδα μπαίνει **αμέσως** στο cached scope, ώστε η
 * επόμενη πινακίδα (ghost ή commit) να τη δείξει χωρίς να περιμένει νέο fetch. Ίδιο μοτίβο
 * με το `registerUserMaterialImage` (ADR-643 Φ4): ο server παραμένει η πηγή αλήθειας — αυτό
 * είναι μόνο το in-session «προβάδισμα» ώστε να μην υπάρχει race μεταξύ upload και render.
 *
 * `null` ⇒ η σφραγίδα αφαιρέθηκε.
 */
export function applyStampImageUrl(stampImageUrl: string | null): void {
  cachedSources = {
    ...cachedSources,
    user: { ...(cachedSources.user ?? {}), stampImageUrl: stampImageUrl ?? undefined },
  };
}

/** Test seam — reset the singleton between cases. */
export function __resetPlaceholderScopeForTests(): void {
  cachedKey = null;
  cachedSources = {};
  pending = null;
}
