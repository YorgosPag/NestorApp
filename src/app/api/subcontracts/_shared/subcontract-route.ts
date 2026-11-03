/**
 * Το **factory** των διαδρομών της υπεργολαβίας (ADR-928 Φ1) — ένα σύνορο για όλες, στο πρότυπο του `catalog-route`:
 *
 * - `defineRoute` ⇒ `withAuth` ⇒ **ιδεμποτία** (CHECK 3.92) · zod σώμα.
 * - Η βαθμίδα ορίου ρυθμού **δηλώνεται στο ίδιο το `route.ts`** (CHECK 3.78).
 * - Δικαίωμα ανά **δικαιοδοσία** από τον ΕΝΑ πίνακα `SUBCONTRACT_AUTHORITY_PERMISSIONS` (κοινός με την οθόνη, CHECK 3.68):
 *   κανένας έλεγχος ρόλου στον κώδικα.
 * - `SubcontractWriteError` ⇒ `ApiError` σε **ένα** σημείο (`toSubcontractApiError`).
 *
 * Οι **αναγνώσεις** δεν περνούν από εδώ: ο πελάτης διαβάζει απευθείας τη Firestore (κανόνες: `isInternalUserOfCompany`).
 * @module app/api/subcontracts/_shared/subcontract-route
 */

import 'server-only';

import type { NextResponse } from 'next/server';
import type { z } from 'zod';

import { badRequest, created, defineRoute, ok, type RateLimitTier } from '@/lib/api/define-route';
import type { AuthContext } from '@/lib/auth';
import type { PermissionId } from '@/lib/auth/types';
import type { RateLimitCategory } from '@/lib/middleware/rate-limit-config';
import type { VersionTarget } from '@/server/subcontracts/clause-governance-writer.server';
import { SubcontractWriteError, toSubcontractApiError } from '@/server/subcontracts/subcontract-write-error';
import { SUBCONTRACT_AUTHORITY_PERMISSIONS, type SubcontractAuthority } from '@/subapps/procurement/subcontracts/vocabulary/subcontract-authorities';
import {
  SUBCONTRACT_AGREEMENT_TRANSITIONS,
  type SubcontractAgreementTransition,
} from '@/subapps/procurement/subcontracts/types/agreement';

type SubcontractRateCategory = Extract<RateLimitCategory, 'HIGH' | 'STANDARD' | 'SENSITIVE'>;

export interface SubcontractRoutePolicy {
  readonly category: SubcontractRateCategory;
  readonly authority: SubcontractAuthority;
}

const TIER_OF: Readonly<Record<SubcontractRateCategory, RateLimitTier>> = { HIGH: 'high', STANDARD: 'standard', SENSITIVE: 'sensitive' };
const FALLBACK_ERROR = 'Subcontract write failed';

const permissionsOf = (policy: SubcontractRoutePolicy): PermissionId[] => [...SUBCONTRACT_AUTHORITY_PERMISSIONS[policy.authority]];

async function respond<T>(envelope: (data: T) => NextResponse, run: () => Promise<T>): Promise<NextResponse> {
  try {
    return envelope(await run());
  } catch (error) {
    if (error instanceof SubcontractWriteError) throw toSubcontractApiError(error);
    throw error;
  }
}

/**
 * Η **μία** διαδρομή εγγραφής: σώμα (zod) + τμήματα διαδρομής (`params`). Δημιουργία ⇒ `created` (201), πράξη ⇒ `ok`.
 * 🔑 Εξαγόμενο επίτηδες: το CHECK 3.92 υπολογίζει τα σύνορα από εξαγόμενες συναρτήσεις που καλούν σύνορο.
 */
export function subcontractWriteRoute<TSchema extends z.ZodTypeAny, TParams extends Record<string, string>, TResult>(
  policy: SubcontractRoutePolicy,
  schema: TSchema,
  run: (auth: AuthContext, body: z.infer<TSchema>, params: TParams) => Promise<TResult>,
  envelope: (data: TResult) => NextResponse = ok,
) {
  return defineRoute<TSchema, TParams>({
    rateLimit: TIER_OF[policy.category],
    schema,
    auth: { permissions: permissionsOf(policy) },
    fallbackError: FALLBACK_ERROR,
    handler: ({ auth, body, params }) => respond(envelope, () => run(auth, body, params)),
  });
}

/** `POST` που γεννά νέα οντότητα — ίδιο σύνορο, 201. */
export function subcontractCreateRoute<TSchema extends z.ZodTypeAny, TParams extends Record<string, string>, TResult>(
  policy: SubcontractRoutePolicy,
  schema: TSchema,
  run: (auth: AuthContext, body: z.infer<TSchema>, params: TParams) => Promise<TResult>,
) {
  return subcontractWriteRoute(policy, schema, run, created);
}

/** Ο αριθμός έκδοσης από το τμήμα `[version]` — θετικός ακέραιος, αλλιώς 400. */
function versionNumberOf(segment: string): number {
  const version = Number(segment);
  if (!Number.isSafeInteger(version) || version < 1) badRequest('Invalid clause version');
  return version;
}

/** Τα τμήματα `…/agreements/[id]/…`. */
export type AgreementParams = { id: string };

/** Τα τμήματα `…/agreements/[id]/transitions/[transition]`. */
export type AgreementTransitionParams = { id: string; transition: string };

const KNOWN_TRANSITIONS: ReadonlySet<string> = new Set(SUBCONTRACT_AGREEMENT_TRANSITIONS);
const isAgreementTransition = (segment: string): segment is SubcontractAgreementTransition => KNOWN_TRANSITIONS.has(segment);

/** Η μετάβαση από το τμήμα `[transition]` — μέλος του κλειστού λεξιλογίου, αλλιώς 400. */
export function agreementTransitionOf(segment: string): SubcontractAgreementTransition {
  if (!isAgreementTransition(segment)) return badRequest('Invalid agreement transition');
  return segment;
}

/** Τα τμήματα `…/clauses/[id]/versions/[version]/…`. */
export type ClauseVersionParams = { id: string; version: string };

/** Η έκδοση-στόχος μιας πράξης διακυβέρνησης: διαδρομή + η αναθεώρηση που διάβασε ο πελάτης (CAS). */
export function versionTargetOf(params: ClauseVersionParams, expectedRevision: number): VersionTarget {
  return { clauseId: params.id, version: versionNumberOf(params.version), expectedRevision };
}
