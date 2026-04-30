/**
 * ADR-336 — Signatory resolver (multi-field match-or-create).
 *
 * Server-side. Returns a `MatchResult` describing how the extracted signatory
 * relates to existing IndividualContacts in the tenant:
 *
 *   - kind: 'strong'  → safe to auto-link, no user confirmation needed
 *   - kind: 'weak'    → at least one field overlaps, but identity is ambiguous
 *                       — UI must surface a disambiguation modal
 *   - kind: 'none'    → no overlap; caller creates a new IndividualContact
 *
 * Strong-match rules (any one suffices):
 *   1. vatNumber equal (rare, but unique by definition)
 *   2. mobile equal AND firstName + lastName equal
 *   3. email  equal AND firstName + lastName equal
 *   4. firstName + lastName + employerId + profession all equal
 *
 * Weak-match rules (single-field overlap with name divergence):
 *   - mobile matches but name differs
 *   - email matches but name differs
 *   - firstName + lastName match but employer differs
 *
 * The resolver scopes every query to `companyId` (multi-tenant) and never
 * leaks contacts across tenants. It is read-only — creation lives in the
 * commit-signatory route.
 */

import 'server-only';

import { safeFirestoreOperation } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import type { IndividualContact } from '@/types/contacts/contracts';

const logger = createModuleLogger('SIGNATORY_RESOLVER');

// ============================================================================
// PUBLIC TYPES
// ============================================================================

export interface SignatoryInput {
  firstName: string | null;
  lastName: string | null;
  role: string | null;
  profession: string | null;
  mobile: string | null;
  email: string | null;
  vatNumber: string | null;
  /** companyId of the vendor (target of the relationship). */
  vendorContactId: string;
}

export interface WeakCandidate {
  contactId: string;
  /** Human-readable display name of the existing contact. */
  displayName: string;
  /** Which field(s) overlapped. */
  matchedOn: ReadonlyArray<'mobile' | 'email' | 'name'>;
  /** Why it's only weak — name/employer divergence summary. */
  divergenceReason: string;
}

export interface StrongMatchReason {
  /** Which rule fired. */
  rule: 'vat' | 'mobile_and_name' | 'email_and_name' | 'name_and_employer_and_profession';
  contactDisplayName: string;
}

export type MatchResult =
  | { kind: 'strong'; contactId: string; reason: StrongMatchReason }
  | { kind: 'weak'; candidates: WeakCandidate[] }
  | { kind: 'none' };

// ============================================================================
// NORMALIZATION HELPERS
// ============================================================================

function normalizeName(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeEmail(s: string | null | undefined): string {
  if (!s) return '';
  return s.trim().toLowerCase();
}

/**
 * Greek-aware phone normalizer:
 *  - strips non-digits and leading "00"
 *  - prepends "30" to bare 10-digit Greek mobiles starting with 6
 *  - leaves international numbers untouched once cleaned
 */
function normalizePhone(p: string | null | undefined): string {
  if (!p) return '';
  let n = p.replace(/\D/g, '');
  if (n.startsWith('00')) n = n.slice(2);
  if (n.length === 10 && n.startsWith('6')) n = '30' + n;
  return n;
}

function normalizeVat(v: string | null | undefined): string {
  if (!v) return '';
  return v.replace(/\s+/g, '').toUpperCase();
}

// ============================================================================
// CANDIDATE FETCH
// ============================================================================

const CANDIDATE_FETCH_CAP = 5000;

async function fetchTenantIndividuals(companyId: string): Promise<IndividualContact[]> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db.collection(COLLECTIONS.CONTACTS)
      .where('companyId', '==', companyId)
      .where('type', '==', 'individual')
      .limit(CANDIDATE_FETCH_CAP)
      .get();
    if (snap.size >= CANDIDATE_FETCH_CAP) {
      logger.warn('Candidate fetch hit cap — resolver may miss matches', {
        companyId,
        cap: CANDIDATE_FETCH_CAP,
      });
    }
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as IndividualContact));
  }, []);
}

// ============================================================================
// MATCH PREDICATES
// ============================================================================

function contactMatchesPhone(c: IndividualContact, target: string): boolean {
  const tNorm = normalizePhone(target);
  if (!tNorm) return false;
  return (c.phones ?? []).some((p) => normalizePhone(p.number) === tNorm);
}

function contactMatchesEmail(c: IndividualContact, target: string): boolean {
  const tNorm = normalizeEmail(target);
  if (!tNorm) return false;
  return (c.emails ?? []).some((e) => normalizeEmail(e.email) === tNorm);
}

function contactMatchesName(c: IndividualContact, fn: string, ln: string): boolean {
  const fnNorm = normalizeName(fn);
  const lnNorm = normalizeName(ln);
  if (!fnNorm || !lnNorm) return false;
  return normalizeName(c.firstName) === fnNorm && normalizeName(c.lastName) === lnNorm;
}

function contactMatchesVat(c: IndividualContact, target: string): boolean {
  const tNorm = normalizeVat(target);
  if (!tNorm) return false;
  return normalizeVat(c.vatNumber) === tNorm;
}

function contactMatchesProfession(c: IndividualContact, target: string): boolean {
  const tNorm = normalizeName(target);
  if (!tNorm) return false;
  return normalizeName(c.profession) === tNorm;
}

function contactDisplayName(c: IndividualContact): string {
  const fn = (c.firstName ?? '').trim();
  const ln = (c.lastName ?? '').trim();
  const full = `${fn} ${ln}`.trim();
  return full || c.id || 'unknown';
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Resolve a signatory against existing tenant contacts. Read-only.
 * Caller decides what to do with the result (link, create, prompt user).
 */
export async function resolveSignatory(
  input: SignatoryInput,
  companyId: string
): Promise<MatchResult> {
  const fn = input.firstName ?? '';
  const ln = input.lastName ?? '';
  const hasName = Boolean(normalizeName(fn) && normalizeName(ln));
  const hasVat = Boolean(normalizeVat(input.vatNumber));
  const hasMobile = Boolean(normalizePhone(input.mobile));
  const hasEmail = Boolean(normalizeEmail(input.email));
  const hasProfession = Boolean(normalizeName(input.profession));

  // Optimization: if nothing identifying is present, short-circuit to none.
  if (!hasName && !hasVat && !hasMobile && !hasEmail) {
    return { kind: 'none' };
  }

  const candidates = await fetchTenantIndividuals(companyId);

  // ── Strong matches ──────────────────────────────────────────────────────
  // Rule 1: vatNumber match (unique by definition, irrespective of other fields).
  if (hasVat) {
    const hit = candidates.find((c) => contactMatchesVat(c, input.vatNumber!));
    if (hit?.id) {
      return {
        kind: 'strong',
        contactId: hit.id,
        reason: { rule: 'vat', contactDisplayName: contactDisplayName(hit) },
      };
    }
  }

  // Rule 2: mobile + name.
  if (hasMobile && hasName) {
    const hit = candidates.find(
      (c) =>
        contactMatchesPhone(c, input.mobile!) &&
        contactMatchesName(c, fn, ln)
    );
    if (hit?.id) {
      return {
        kind: 'strong',
        contactId: hit.id,
        reason: { rule: 'mobile_and_name', contactDisplayName: contactDisplayName(hit) },
      };
    }
  }

  // Rule 3: email + name.
  if (hasEmail && hasName) {
    const hit = candidates.find(
      (c) =>
        contactMatchesEmail(c, input.email!) &&
        contactMatchesName(c, fn, ln)
    );
    if (hit?.id) {
      return {
        kind: 'strong',
        contactId: hit.id,
        reason: { rule: 'email_and_name', contactDisplayName: contactDisplayName(hit) },
      };
    }
  }

  // Rule 4: name + employerId + profession.
  if (hasName && hasProfession) {
    const hit = candidates.find(
      (c) =>
        c.employerId === input.vendorContactId &&
        contactMatchesName(c, fn, ln) &&
        contactMatchesProfession(c, input.profession!)
    );
    if (hit?.id) {
      return {
        kind: 'strong',
        contactId: hit.id,
        reason: { rule: 'name_and_employer_and_profession', contactDisplayName: contactDisplayName(hit) },
      };
    }
  }

  // ── Weak matches (single-field overlap with divergence) ─────────────────
  const weak: WeakCandidate[] = [];
  const seen = new Set<string>();
  const add = (c: IndividualContact, on: WeakCandidate['matchedOn'], reason: string): void => {
    if (!c.id || seen.has(c.id)) return;
    seen.add(c.id);
    weak.push({
      contactId: c.id,
      displayName: contactDisplayName(c),
      matchedOn: on,
      divergenceReason: reason,
    });
  };

  if (hasMobile) {
    for (const c of candidates) {
      if (contactMatchesPhone(c, input.mobile!) && (!hasName || !contactMatchesName(c, fn, ln))) {
        add(c, ['mobile'], 'Same mobile, different name');
      }
    }
  }
  if (hasEmail) {
    for (const c of candidates) {
      if (contactMatchesEmail(c, input.email!) && (!hasName || !contactMatchesName(c, fn, ln))) {
        add(c, ['email'], 'Same email, different name');
      }
    }
  }
  if (hasName) {
    for (const c of candidates) {
      if (
        contactMatchesName(c, fn, ln) &&
        c.employerId !== input.vendorContactId &&
        // Ensure it didn't already win via Rule 4 elsewhere.
        !(hasProfession && contactMatchesProfession(c, input.profession!))
      ) {
        add(c, ['name'], 'Same name, different employer');
      }
    }
  }

  if (weak.length > 0) {
    return { kind: 'weak', candidates: weak };
  }

  return { kind: 'none' };
}
