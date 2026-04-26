/**
 * =============================================================================
 * ORG STRUCTURE HANDLER — AI agentic tools for tenant org chart (ADR-326 Phase 7)
 * =============================================================================
 *
 * Exposes the L1 (tenant) and L2 (CompanyContact) org structures to the AI agent
 * via 5 tools:
 *   - query_org_structure       → dump structure (departments + members, depth-limited)
 *   - get_department_head       → head info for a given department
 *   - find_department_member    → fuzzy search by displayName / position / role
 *   - traverse_hierarchy        → ascendants / descendants from a memberId
 *   - resolve_routing_email     → wrapper over org-routing-resolver (L1 event / L2 dept)
 *
 * All tools are admin-only (super admin scope). Tenant isolation is enforced
 * for L2 tools by verifying that contacts/{contactId}.companyId === ctx.companyId.
 *
 * Safety limits:
 *   - Max traversal depth: MAX_TRAVERSAL_DEPTH (10)
 *   - Max members per response: MAX_MEMBERS_RESPONSE (100)
 *
 * @module services/ai-pipeline/tools/handlers/org-structure-handler
 * @see ADR-326 §3.12 (AI integration spec) + Phase 7
 * @see ADR-171 (Autonomous AI Agent)
 */

import 'server-only';

import {
  resolveTenantNotificationEmail,
  resolveContactDepartmentEmail,
} from '@/services/org-structure/org-routing-resolver';
import {
  NOTIFICATION_EVENTS,
  type NotificationEventCode,
} from '@/config/notification-events';
import {
  type AgenticContext,
  type ToolHandler,
  type ToolResult,
} from '../executor-shared';
import {
  type OrgScope,
  type TraversalDirection,
  parseScopeArgs,
  stringArg,
  numericArg,
  resolveDepartmentArg,
  canonicalCodeFromArg,
  loadOrgStructure,
  verifyContactBelongsToTenant,
  emptyOrgResult,
  findDepartment,
  findMemberById,
  fuzzyFindMembers,
  collectDescendants,
  collectAscendants,
  serializeMember,
  summarizeDepartment,
} from './org-structure-handler-utils';

// ─── Safety limits (ADR-326 §3.12) ───────────────────────────────────────────

const MAX_TRAVERSAL_DEPTH = 10;
const MAX_MEMBERS_RESPONSE = 100;

const CANONICAL_EVENT_CODES: ReadonlyArray<NotificationEventCode> =
  Object.values(NOTIFICATION_EVENTS);

// ─── Handler ─────────────────────────────────────────────────────────────────

export class OrgStructureHandler implements ToolHandler {
  readonly toolNames = [
    'query_org_structure',
    'get_department_head',
    'find_department_member',
    'traverse_hierarchy',
    'resolve_routing_email',
  ] as const;

  async execute(
    toolName: string,
    args: Record<string, unknown>,
    ctx: AgenticContext,
  ): Promise<ToolResult> {
    if (!ctx.isAdmin) {
      return { success: false, error: 'org-structure tools are admin-only' };
    }

    switch (toolName) {
      case 'query_org_structure':
        return this.queryOrgStructure(args, ctx);
      case 'get_department_head':
        return this.getDepartmentHead(args, ctx);
      case 'find_department_member':
        return this.findDepartmentMember(args, ctx);
      case 'traverse_hierarchy':
        return this.traverseHierarchy(args, ctx);
      case 'resolve_routing_email':
        return this.resolveRoutingEmail(args, ctx);
      default:
        return { success: false, error: `Unknown org-structure tool: ${toolName}` };
    }
  }

  // --------------------------------------------------------------------------
  // 1. query_org_structure
  // --------------------------------------------------------------------------

  private async queryOrgStructure(
    args: Record<string, unknown>,
    ctx: AgenticContext,
  ): Promise<ToolResult> {
    const parsed = parseScopeArgs(args);
    if (!parsed.ok) return parsed.error;

    const org = await loadOrgStructure(parsed.scope, parsed.contactId, ctx);
    if (!org) return emptyOrgResult(parsed.scope);

    const totalMembers = org.departments.reduce((s, d) => s + d.members.length, 0);
    const truncated = totalMembers > MAX_MEMBERS_RESPONSE;

    return {
      success: true,
      data: {
        scope: parsed.scope,
        contactId: parsed.scope === 'contact' ? parsed.contactId : null,
        departments: org.departments.map(d => summarizeDepartment(d, truncated)),
        notificationRouting: org.notificationRouting ?? [],
        totalMembers,
        truncated,
      },
      count: org.departments.length,
    };
  }

  // --------------------------------------------------------------------------
  // 2. get_department_head
  // --------------------------------------------------------------------------

  private async getDepartmentHead(
    args: Record<string, unknown>,
    ctx: AgenticContext,
  ): Promise<ToolResult> {
    const parsed = parseScopeArgs(args);
    if (!parsed.ok) return parsed.error;

    const dept = resolveDepartmentArg(args);
    if (!dept) {
      return { success: false, error: 'departmentCode or label is required' };
    }

    const org = await loadOrgStructure(parsed.scope, parsed.contactId, ctx);
    if (!org) return emptyOrgResult(parsed.scope);

    const department = findDepartment(org, dept);
    if (!department) {
      return {
        success: true,
        data: { found: false, reason: `Department not found: ${dept.value}` },
      };
    }

    const head = department.members.find(m => m.isDepartmentHead && m.status === 'active');
    if (!head) {
      return {
        success: true,
        data: {
          found: false,
          departmentCode: department.code,
          departmentLabel: department.label ?? null,
          reason: 'Department has no active head',
        },
      };
    }

    return {
      success: true,
      data: {
        found: true,
        departmentCode: department.code,
        departmentLabel: department.label ?? null,
        member: serializeMember(head),
      },
    };
  }

  // --------------------------------------------------------------------------
  // 3. find_department_member
  // --------------------------------------------------------------------------

  private async findDepartmentMember(
    args: Record<string, unknown>,
    ctx: AgenticContext,
  ): Promise<ToolResult> {
    const parsed = parseScopeArgs(args);
    if (!parsed.ok) return parsed.error;

    const query = stringArg(args.query);
    if (!query) return { success: false, error: 'query is required' };

    const org = await loadOrgStructure(parsed.scope, parsed.contactId, ctx);
    if (!org) return emptyOrgResult(parsed.scope);

    const matches = fuzzyFindMembers(org, query);
    const limited = matches.slice(0, MAX_MEMBERS_RESPONSE);

    return {
      success: true,
      data: {
        query,
        matches: limited,
        truncated: matches.length > limited.length,
      },
      count: limited.length,
    };
  }

  // --------------------------------------------------------------------------
  // 4. traverse_hierarchy
  // --------------------------------------------------------------------------

  private async traverseHierarchy(
    args: Record<string, unknown>,
    ctx: AgenticContext,
  ): Promise<ToolResult> {
    const parsed = parseScopeArgs(args);
    if (!parsed.ok) return parsed.error;

    const memberId = stringArg(args.memberId);
    if (!memberId) return { success: false, error: 'memberId is required' };

    const direction: TraversalDirection =
      args.direction === 'ascendants' ? 'ascendants' : 'descendants';
    const requestedDepth = numericArg(args.maxDepth, 5);
    const maxDepth = Math.min(Math.max(requestedDepth, 1), MAX_TRAVERSAL_DEPTH);

    const org = await loadOrgStructure(parsed.scope, parsed.contactId, ctx);
    if (!org) return emptyOrgResult(parsed.scope);

    const startMember = findMemberById(org, memberId);
    if (!startMember) {
      return { success: true, data: { found: false, reason: `Member not found: ${memberId}` } };
    }

    const collected =
      direction === 'ascendants'
        ? collectAscendants(org, startMember, maxDepth)
        : collectDescendants(org, startMember, maxDepth);

    const limited = collected.slice(0, MAX_MEMBERS_RESPONSE);

    return {
      success: true,
      data: {
        found: true,
        startMember: serializeMember(startMember),
        direction,
        maxDepth,
        results: limited,
        truncated: collected.length > limited.length,
      },
      count: limited.length,
    };
  }

  // --------------------------------------------------------------------------
  // 5. resolve_routing_email
  // --------------------------------------------------------------------------

  private async resolveRoutingEmail(
    args: Record<string, unknown>,
    ctx: AgenticContext,
  ): Promise<ToolResult> {
    const parsed = parseScopeArgs(args);
    if (!parsed.ok) return parsed.error;

    if (parsed.scope === 'tenant') {
      return this.resolveTenantRouting(args, ctx);
    }
    return this.resolveContactRouting(args, parsed.contactId, ctx);
  }

  private async resolveTenantRouting(
    args: Record<string, unknown>,
    ctx: AgenticContext,
  ): Promise<ToolResult> {
    const event = stringArg(args.event);
    if (!event) {
      return { success: false, error: 'event is required for tenant scope' };
    }
    if (!CANONICAL_EVENT_CODES.includes(event as NotificationEventCode)) {
      return { success: false, error: `Unknown notification event: ${event}` };
    }

    const result = await resolveTenantNotificationEmail(
      ctx.companyId,
      event as NotificationEventCode,
    );
    return result
      ? { success: true, data: { resolved: true, ...result } }
      : { success: true, data: { resolved: false, reason: 'No email resolved for event' } };
  }

  private async resolveContactRouting(
    args: Record<string, unknown>,
    contactId: string | null,
    ctx: AgenticContext,
  ): Promise<ToolResult> {
    if (!contactId) {
      return { success: false, error: 'contactId is required for contact scope' };
    }
    const verified = await verifyContactBelongsToTenant(contactId, ctx.companyId);
    if (!verified) {
      return { success: false, error: 'Contact not found or outside tenant scope' };
    }

    const dept = resolveDepartmentArg(args);
    if (!dept) {
      return { success: false, error: 'departmentCode or label is required for contact scope' };
    }
    const code = canonicalCodeFromArg(dept);
    if (!code) {
      return {
        success: true,
        data: { resolved: false, reason: `Cannot map "${dept.value}" to a canonical department code` },
      };
    }

    const result = await resolveContactDepartmentEmail(contactId, code);
    return result
      ? { success: true, data: { resolved: true, ...result } }
      : { success: true, data: { resolved: false, reason: 'No email resolved for contact department' } };
  }
}

// Backward-compat re-export so `OrgScope` consumers keep working without
// crossing handler internals.
export type { OrgScope };
