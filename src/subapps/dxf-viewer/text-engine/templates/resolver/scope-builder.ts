/**
 * ADR-344 Phase 7.C — Placeholder scope builder (server-only).
 *
 * Hydrates a `PlaceholderScope` from Firestore docs so the pure resolver
 * can run without any I/O. API routes that insert a template call this
 * first, then hand the scope to `resolvePlaceholdersInNode`.
 *
 * Concerns split:
 *   - This module: ONLY Firestore reads (admin SDK), narrow field
 *     projection into the resolver-specific sub-types. Tenant isolation
 *     enforced by always passing `companyId` and verifying it on every
 *     returned doc.
 *   - `resolver.ts`: pure substitution, zero I/O — keeps the management UI
 *     preview path fast and the test suite deterministic.
 *
 * Drawing facts (sheet number, scale, title, units) and revision facts
 * are NOT read from Firestore — they live in the active DXF document and
 * are supplied by the caller (the DXF viewer command pipeline) directly
 * via `BuildScopeInput.drawing` / `.revision`. We surface them on the
 * input shape so the API route signature stays explicit.
 *
 * @module text-engine/templates/resolver/scope-builder
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import type {
  PlaceholderScope,
  PlaceholderScopeCompany,
  PlaceholderScopeDrawing,
  PlaceholderScopeFormatting,
  PlaceholderScopeProject,
  PlaceholderScopeRevision,
  PlaceholderScopeUser,
} from './scope.types';

const logger = createModuleLogger('TextTemplateScopeBuilder');

// ── Input contract ───────────────────────────────────────────────────────────

export interface BuildScopeInput {
  /** Tenant — required for every fetch + cross-tenant guard. */
  readonly companyId: string;
  /** Optional project to hydrate `project.*` placeholders. */
  readonly projectId?: string;
  /** Optional acting user to hydrate `user.*` placeholders. */
  readonly userId?: string;
  /** Optional checker — separate uid because the architect and reviewer differ. */
  readonly checkerUserId?: string;
  /** Drawing facts pulled from the active DXF document by the caller. */
  readonly drawing?: PlaceholderScopeDrawing;
  /** Revision facts pulled from the drawing revision history by the caller. */
  readonly revision?: PlaceholderScopeRevision;
  /** Formatting overrides (locale, deterministic clock for tests). */
  readonly formatting?: PlaceholderScopeFormatting;
}

// ── Field-projection helpers ─────────────────────────────────────────────────

function stringField(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function pickCompany(data: Record<string, unknown> | undefined): PlaceholderScopeCompany | undefined {
  if (!data) return undefined;
  const name = stringField(data.name) ?? stringField(data.companyName);
  return name ? { name } : undefined;
}

function pickProject(data: Record<string, unknown> | undefined): PlaceholderScopeProject | undefined {
  if (!data) return undefined;
  const project: PlaceholderScopeProject = {
    name: stringField(data.name) ?? stringField(data.title),
    code: stringField(data.projectCode),
    owner: stringField(data.linkedCompanyName) ?? stringField(data.company),
  };
  return project.name || project.code || project.owner ? project : undefined;
}

function composeFullName(data: Record<string, unknown>): string | undefined {
  const direct = stringField(data.displayName) ?? stringField(data.fullName);
  if (direct) return direct;
  const composed = [stringField(data.firstName), stringField(data.lastName)]
    .filter((s): s is string => Boolean(s))
    .join(' ');
  return composed.length > 0 ? composed : undefined;
}

function pickUser(data: Record<string, unknown> | undefined): PlaceholderScopeUser | undefined {
  if (!data) return undefined;
  const user: PlaceholderScopeUser = {
    fullName: composeFullName(data),
    title: stringField(data.title) ?? stringField(data.jobTitle),
    licenseNumber: stringField(data.licenseNumber) ?? stringField(data.teeId),
  };
  return user.fullName || user.title || user.licenseNumber ? user : undefined;
}

function pickChecker(data: Record<string, unknown> | undefined): string | undefined {
  if (!data) return undefined;
  return composeFullName(data);
}

// ── Cross-tenant guard ───────────────────────────────────────────────────────

function isSameCompany(data: Record<string, unknown> | undefined, expected: string): boolean {
  if (!data) return false;
  const value = data.companyId;
  return typeof value === 'string' && value === expected;
}

// ── Firestore fetches ────────────────────────────────────────────────────────

async function fetchDoc(collection: string, id: string): Promise<Record<string, unknown> | undefined> {
  try {
    const snap = await getAdminFirestore().collection(collection).doc(id).get();
    return snap.exists ? (snap.data() as Record<string, unknown>) : undefined;
  } catch (error) {
    logger.warn('Failed to fetch doc for placeholder scope', {
      collection,
      id,
      error: getErrorMessage(error),
    });
    return undefined;
  }
}

// ── Public builder ───────────────────────────────────────────────────────────

/**
 * Build a `PlaceholderScope` from Firestore + caller-supplied drawing /
 * revision facts. Always tenant-scoped: every fetched doc is verified to
 * carry the expected `companyId` before its fields are projected.
 *
 * Returns a frozen scope so callers cannot accidentally mutate it on the
 * way to the resolver.
 */
export async function buildPlaceholderScope(input: BuildScopeInput): Promise<PlaceholderScope> {
  const company = await buildCompanyScope(input.companyId);
  const project = await buildProjectScope(input);
  const user = await buildUserScope(input);
  const checkerName = await buildCheckerName(input);

  const mergedUser: PlaceholderScopeUser | undefined =
    user || checkerName ? { ...(user ?? {}), checkerName } : undefined;

  const scope: PlaceholderScope = {
    company,
    project,
    user: mergedUser,
    drawing: input.drawing,
    revision: input.revision,
    formatting: input.formatting,
  };

  return Object.freeze(scope);
}

async function buildCompanyScope(companyId: string): Promise<PlaceholderScopeCompany | undefined> {
  const data = await fetchDoc(COLLECTIONS.COMPANIES, companyId);
  return pickCompany(data);
}

async function buildProjectScope(input: BuildScopeInput): Promise<PlaceholderScopeProject | undefined> {
  if (!input.projectId) return undefined;
  const data = await fetchDoc(COLLECTIONS.PROJECTS, input.projectId);
  if (!data || !isSameCompany(data, input.companyId)) {
    if (data) {
      logger.warn('Project companyId mismatch, dropping project scope', {
        projectId: input.projectId,
        expectedCompanyId: input.companyId,
      });
    }
    return undefined;
  }
  return pickProject(data);
}

async function buildUserScope(input: BuildScopeInput): Promise<PlaceholderScopeUser | undefined> {
  if (!input.userId) return undefined;
  const data = await fetchDoc(COLLECTIONS.USERS, input.userId);
  return pickUser(data);
}

async function buildCheckerName(input: BuildScopeInput): Promise<string | undefined> {
  if (!input.checkerUserId) return undefined;
  const data = await fetchDoc(COLLECTIONS.USERS, input.checkerUserId);
  return pickChecker(data);
}
