/**
 * ORG STRUCTURE HANDLER — Pure helpers (ADR-326 Phase 7)
 *
 * Extracted from `org-structure-handler.ts` to keep the dispatcher under the
 * 500-line file budget (CLAUDE.md N.7.1). All functions are pure (no I/O)
 * except `verifyContactBelongsToTenant` and `loadOrgStructure`, which read
 * Firestore through the canonical `org-structure-repository`.
 *
 * @module services/ai-pipeline/tools/handlers/org-structure-handler-utils
 * @see ADR-326 Phase 7
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import {
  getOrgStructure,
  getContactOrgStructure,
} from '@/services/org-structure/org-structure-repository';
import {
  CANONICAL_DEPARTMENT_CODES,
  type DepartmentCode,
} from '@/config/department-codes';
import type {
  OrgStructure,
  OrgDepartment,
  OrgMember,
} from '@/types/org/org-structure';
import {
  type AgenticContext,
  type ToolResult,
  logger,
} from '../executor-shared';

// ─── Types ───────────────────────────────────────────────────────────────────

export type OrgScope = 'tenant' | 'contact';
export type TraversalDirection = 'ascendants' | 'descendants';

export interface DepartmentArg { kind: 'code' | 'label'; value: string }

export interface SerializedMember {
  id: string;
  displayName: string;
  role: OrgMember['role'];
  positionLabel: string | null;
  isDepartmentHead: boolean;
  reportsTo: string | null;
  primaryEmail: string | null;
  primaryPhone: string | null;
  contactId: string | null;
  status: OrgMember['status'];
}

// ─── Arg parsing ─────────────────────────────────────────────────────────────

export interface ParsedScope {
  ok: true;
  scope: OrgScope;
  contactId: string | null;
}

export interface ParsedScopeError {
  ok: false;
  error: ToolResult;
}

export function parseScopeArgs(
  args: Record<string, unknown>,
): ParsedScope | ParsedScopeError {
  const scope: OrgScope = args.scope === 'contact' ? 'contact' : 'tenant';
  const contactId = stringArg(args.contactId);
  if (scope === 'contact' && !contactId) {
    return {
      ok: false,
      error: { success: false, error: 'contactId is required when scope=contact' },
    };
  }
  return { ok: true, scope, contactId: contactId ?? null };
}

export function stringArg(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}

export function numericArg(v: unknown, fallback: number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.floor(v);
  if (typeof v === 'string') {
    const n = Number(v);
    if (Number.isFinite(n)) return Math.floor(n);
  }
  return fallback;
}

export function resolveDepartmentArg(args: Record<string, unknown>): DepartmentArg | null {
  const code = stringArg(args.departmentCode);
  if (code) return { kind: 'code', value: code };
  const label = stringArg(args.label);
  if (label) return { kind: 'label', value: label };
  return null;
}

export function canonicalCodeFromArg(arg: DepartmentArg): DepartmentCode | null {
  const candidate = arg.value as DepartmentCode;
  if (arg.kind === 'code') {
    return CANONICAL_DEPARTMENT_CODES.some(c => c === candidate)
      ? candidate
      : null;
  }
  const lower = arg.value.toLowerCase();
  return CANONICAL_DEPARTMENT_CODES.find(c => c === lower) ?? null;
}

// ─── I/O ─────────────────────────────────────────────────────────────────────

export async function loadOrgStructure(
  scope: OrgScope,
  contactId: string | null,
  ctx: AgenticContext,
): Promise<OrgStructure | null> {
  if (scope === 'tenant') {
    return getOrgStructure(ctx.companyId);
  }

  if (!contactId) return null;
  const verified = await verifyContactBelongsToTenant(contactId, ctx.companyId);
  if (!verified) {
    logger.warn('org-structure-handler: contact outside tenant scope', {
      contactId,
      requestedBy: ctx.companyId,
      requestId: ctx.requestId,
    });
    return null;
  }
  return getContactOrgStructure(contactId);
}

export async function verifyContactBelongsToTenant(
  contactId: string,
  companyId: string,
): Promise<boolean> {
  try {
    const snap = await getAdminFirestore()
      .collection(COLLECTIONS.CONTACTS)
      .doc(contactId)
      .get();
    if (!snap.exists) return false;
    const data = snap.data() as { companyId?: string } | undefined;
    return data?.companyId === companyId;
  } catch (err) {
    logger.error('org-structure-handler: tenant verification failed', { contactId, err });
    return false;
  }
}

export function emptyOrgResult(scope: OrgScope): ToolResult {
  return {
    success: true,
    data: { scope, found: false, reason: 'No org structure configured' },
  };
}

// ─── Lookup utilities ────────────────────────────────────────────────────────

export function findDepartment(org: OrgStructure, arg: DepartmentArg): OrgDepartment | null {
  if (arg.kind === 'code') {
    return org.departments.find(d => d.code === arg.value) ?? null;
  }
  const lower = arg.value.toLowerCase();
  return (
    org.departments.find(d => d.label?.toLowerCase() === lower) ??
    org.departments.find(d => d.code.toLowerCase() === lower) ??
    null
  );
}

export function findMemberById(org: OrgStructure, memberId: string): OrgMember | null {
  for (const dept of org.departments) {
    const found = dept.members.find(m => m.id === memberId);
    if (found) return found;
  }
  return null;
}

export function fuzzyFindMembers(
  org: OrgStructure,
  query: string,
): Array<{ departmentCode: DepartmentCode; member: SerializedMember }> {
  const lower = query.toLowerCase();
  const results: Array<{ departmentCode: DepartmentCode; member: SerializedMember }> = [];

  for (const dept of org.departments) {
    for (const m of dept.members) {
      if (m.status !== 'active') continue;
      const haystack = [m.displayName, m.positionLabel ?? '', m.role].join(' ').toLowerCase();
      if (haystack.includes(lower)) {
        results.push({ departmentCode: dept.code, member: serializeMember(m) });
      }
    }
  }
  return results;
}

// ─── Tree traversal ──────────────────────────────────────────────────────────

export function collectDescendants(
  org: OrgStructure,
  start: OrgMember,
  maxDepth: number,
): Array<{ depth: number; member: SerializedMember }> {
  const allMembers = org.departments.flatMap(d => d.members);
  const collected: Array<{ depth: number; member: SerializedMember }> = [];
  const visited = new Set<string>([start.id]);

  function walk(parentId: string, depth: number): void {
    if (depth > maxDepth) return;
    for (const m of allMembers) {
      if (m.reportsTo === parentId && !visited.has(m.id)) {
        visited.add(m.id);
        collected.push({ depth, member: serializeMember(m) });
        walk(m.id, depth + 1);
      }
    }
  }

  walk(start.id, 1);
  return collected;
}

export function collectAscendants(
  org: OrgStructure,
  start: OrgMember,
  maxDepth: number,
): Array<{ depth: number; member: SerializedMember }> {
  const allMembers = org.departments.flatMap(d => d.members);
  const collected: Array<{ depth: number; member: SerializedMember }> = [];
  const visited = new Set<string>([start.id]);

  let cursor: OrgMember | undefined = start;
  let depth = 1;
  while (cursor?.reportsTo && depth <= maxDepth) {
    const next: OrgMember | undefined = allMembers.find(m => m.id === cursor!.reportsTo);
    if (!next || visited.has(next.id)) break;
    visited.add(next.id);
    collected.push({ depth, member: serializeMember(next) });
    cursor = next;
    depth += 1;
  }
  return collected;
}

// ─── Serializers ─────────────────────────────────────────────────────────────

export function serializeMember(m: OrgMember): SerializedMember {
  return {
    id: m.id,
    displayName: m.displayName,
    role: m.role,
    positionLabel: m.positionLabel ?? null,
    isDepartmentHead: m.isDepartmentHead,
    reportsTo: m.reportsTo,
    primaryEmail: m.emails.find(e => e.isPrimary)?.email ?? null,
    primaryPhone: m.phones.find(p => p.isPrimary)?.number ?? null,
    contactId: m.contactId ?? null,
    status: m.status,
  };
}

export interface SerializedDepartment {
  id: string;
  code: DepartmentCode;
  label: string | null;
  status: OrgDepartment['status'];
  primaryEmail: string | null;
  memberCount: number;
  members: SerializedMember[] | null;
}

export function summarizeDepartment(
  d: OrgDepartment,
  summarizeMembers: boolean,
): SerializedDepartment {
  return {
    id: d.id,
    code: d.code,
    label: d.label ?? null,
    status: d.status,
    primaryEmail: d.emails?.[0]?.email ?? null,
    memberCount: d.members.length,
    members: summarizeMembers ? null : d.members.map(serializeMember),
  };
}
