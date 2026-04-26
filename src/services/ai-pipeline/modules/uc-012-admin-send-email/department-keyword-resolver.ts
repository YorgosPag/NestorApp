/**
 * Department Keyword Resolver for UC-012 (ADR-326 Phase 7)
 *
 * Scans an admin's natural-language send-email command for Greek department
 * keywords and, when found, resolves the recipient email via the tenant's
 * orgStructure (L1) using the canonical resolver-by-department helper.
 *
 * Used in UC-012 lookup BEFORE the contact-by-name search, so that commands
 * like "στείλε email στο λογιστήριο" route to the active department head
 * without requiring a Contact match.
 *
 * @module services/ai-pipeline/modules/uc-012-admin-send-email/department-keyword-resolver
 * @see ADR-326 §3.12 (AI integration) + Phase 7
 */

import 'server-only';

import { DEPARTMENT_CODES, type DepartmentCode } from '@/config/department-codes';
import { getOrgStructure } from '@/services/org-structure/org-structure-repository';
import { createModuleLogger } from '@/lib/telemetry/Logger';

const logger = createModuleLogger('UC_012_DEPT_KEYWORD');

/**
 * Greek-first keyword → canonical department code mapping.
 *
 * Uses Unicode-aware "word boundaries" `(?<![\p{L}])` / `(?![\p{L}])` because
 * JavaScript's `\b` is ASCII-only — `\b` before/after Greek letters never
 * triggers and silently breaks pattern matching.
 */
const L = '(?<![\\p{L}])';   // Unicode boundary: not preceded by a letter
const R = '(?![\\p{L}])';    // Unicode boundary: not followed by a letter
const flags = 'iu';

const KEYWORD_TO_DEPARTMENT: ReadonlyArray<[RegExp, DepartmentCode]> = [
  [new RegExp(`${L}λογιστήρ[ιί]ο\\w*${R}`, flags), DEPARTMENT_CODES.ACCOUNTING],
  [new RegExp(`${L}λογιστικ[όή]${R}`, flags), DEPARTMENT_CODES.ACCOUNTING],
  [new RegExp(`${L}accounting${R}`, flags), DEPARTMENT_CODES.ACCOUNTING],
  [new RegExp(`${L}μηχανικ\\p{L}*${R}`, flags), DEPARTMENT_CODES.ENGINEERING],
  [new RegExp(`${L}τεχνικ[όή]\\s+τμήμα${R}`, flags), DEPARTMENT_CODES.ENGINEERING],
  [new RegExp(`${L}engineering${R}`, flags), DEPARTMENT_CODES.ENGINEERING],
  [new RegExp(`${L}μελ[έε]τ\\p{L}*${R}`, flags), DEPARTMENT_CODES.ARCHITECTURE_STUDIES],
  [new RegExp(`${L}architecture${R}`, flags), DEPARTMENT_CODES.ARCHITECTURE_STUDIES],
  [new RegExp(`${L}κατασκευ[ήή]${R}`, flags), DEPARTMENT_CODES.CONSTRUCTION],
  [new RegExp(`${L}εργοτάξι\\p{L}*${R}`, flags), DEPARTMENT_CODES.CONSTRUCTION],
  [new RegExp(`${L}πωλήσεις${R}`, flags), DEPARTMENT_CODES.SALES],
  [new RegExp(`${L}sales${R}`, flags), DEPARTMENT_CODES.SALES],
  [new RegExp(`${L}νομικ[όήο]${R}`, flags), DEPARTMENT_CODES.LEGAL],
  [new RegExp(`${L}legal${R}`, flags), DEPARTMENT_CODES.LEGAL],
  [new RegExp(`${L}ανθρώπιν\\p{L}+\\s+δυναμικ\\p{L}*${R}`, flags), DEPARTMENT_CODES.HR],
  [/(?<![A-Za-z])HR(?![A-Za-z])/u, DEPARTMENT_CODES.HR],
  [new RegExp(`${L}πληροφορικ[ήη]${R}`, flags), DEPARTMENT_CODES.IT],
  [/(?<![A-Za-z])IT(?![A-Za-z])/u, DEPARTMENT_CODES.IT],
  [new RegExp(`${L}προμήθει\\p{L}*${R}`, flags), DEPARTMENT_CODES.PROCUREMENT],
  [new RegExp(`${L}procurement${R}`, flags), DEPARTMENT_CODES.PROCUREMENT],
  [new RegExp(`${L}λειτουργ\\p{L}*${R}`, flags), DEPARTMENT_CODES.OPERATIONS],
  [new RegExp(`${L}διοίκηση${R}`, flags), DEPARTMENT_CODES.MANAGEMENT],
  [new RegExp(`${L}management${R}`, flags), DEPARTMENT_CODES.MANAGEMENT],
  [new RegExp(`${L}εξυπηρέτηση\\s+πελατ\\p{L}*${R}`, flags), DEPARTMENT_CODES.CUSTOMER_SERVICE],
  [new RegExp(`${L}customer\\s+service${R}`, flags), DEPARTMENT_CODES.CUSTOMER_SERVICE],
];

export interface DepartmentRouteResolution {
  email: string;
  departmentCode: DepartmentCode;
  source: 'head' | 'backup' | 'dept';
  memberDisplayName?: string;
}

/** Detect a department keyword in the message, returning the canonical code if any. */
export function detectDepartmentKeyword(message: string): DepartmentCode | null {
  if (!message) return null;
  for (const [pattern, code] of KEYWORD_TO_DEPARTMENT) {
    if (pattern.test(message)) return code;
  }
  return null;
}

/**
 * Try to resolve a recipient email from a department keyword.
 * Returns null if no keyword matched, no orgStructure, or no email resolves.
 */
export async function tryResolveDepartmentEmail(
  message: string,
  companyId: string,
  requestId: string,
): Promise<DepartmentRouteResolution | null> {
  const code = detectDepartmentKeyword(message);
  if (!code) return null;

  const org = await getOrgStructure(companyId);
  if (!org) {
    logger.warn('UC-012 dept-keyword: orgStructure missing — skip routing', {
      requestId,
      companyId,
      detectedDept: code,
    });
    return null;
  }

  const dept = org.departments.find(d => d.code === code && d.status === 'active');
  if (!dept) return null;

  const activeMembers = dept.members.filter(m => m.status === 'active');
  const head = activeMembers.find(m => m.isDepartmentHead);
  const headEmail = head?.emails.find(e => e.isPrimary)?.email;
  if (headEmail) {
    return { email: headEmail, departmentCode: code, source: 'head', memberDisplayName: head!.displayName };
  }

  const backup = activeMembers.find(m => !m.isDepartmentHead && m.receivesNotifications);
  const backupEmail = backup?.emails.find(e => e.isPrimary)?.email;
  if (backupEmail) {
    return { email: backupEmail, departmentCode: code, source: 'backup', memberDisplayName: backup!.displayName };
  }

  const deptEmail = dept.emails?.[0]?.email;
  if (deptEmail) {
    return { email: deptEmail, departmentCode: code, source: 'dept' };
  }

  return null;
}
