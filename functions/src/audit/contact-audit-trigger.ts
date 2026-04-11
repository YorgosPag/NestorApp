/**
 * =============================================================================
 * CDC AUDIT: Contact Write Trigger
 * =============================================================================
 *
 * Firestore `onWrite` trigger on `contacts/{docId}`. For every create / update
 * / delete, computes a generic deep diff and writes an audit entry to
 * `entity_audit_trail` with `source: 'cdc'`. Runs in parallel with the existing
 * service-layer audit path (`source: 'service'`) during the Phase 1 comparison
 * window. After one week of dual-write, if CDC coverage matches or exceeds the
 * service path with zero false positives, the service path will be retired for
 * contacts and the same pattern extended to other entity collections.
 *
 * Why CDC:
 *   The manual `CONTACT_TRACKED_FIELDS` + exclude-set pattern at the service
 *   layer caused the shortName bug (Phase 6 regression, 2026-04-11): a field
 *   was silently excluded from the `service` contact type. With CDC there is
 *   no manual list — every field change is diffed automatically, and the only
 *   way to hide a field from audit is to add it to `ignored-fields.ts`
 *   (SSoT, reviewable in isolation).
 *
 * Who-did-it:
 *   The trigger reads `_lastModifiedBy` and `_lastModifiedByName` from the
 *   document itself (written by the client at update time). If missing, falls
 *   back to `'cdc_unknown'` and logs a warning — this is the main gap to
 *   close in Phase 2 before cutover.
 *
 * @module functions/audit/contact-audit-trigger
 * @enterprise ADR-195 — Entity Audit Trail (Phase 1 CDC PoC)
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { deepDiff, type FieldChange } from './deep-diff';
import { COLLECTIONS } from '../config/firestore-collections';
import { generateEntityAuditId } from '../config/enterprise-id';

type DocData = Record<string, unknown>;

interface CdcAuditEntry {
  entityType: 'contact';
  entityId: string;
  entityName: string | null;
  action: string;
  changes: FieldChange[];
  performedBy: string;
  performedByName: string | null;
  companyId: string;
  source: 'cdc';
  timestamp: FirebaseFirestore.FieldValue;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/**
 * Generic name resolver covering all three contact types
 * (individual / company / service). Mirrors the client `getDisplayName()`
 * priority without importing client code.
 */
function resolveContactName(data: DocData | null): string | null {
  if (!data) return null;

  const direct =
    str(data.displayName) ??
    str(data.companyName) ??
    str(data.serviceName) ??
    str(data.name);
  if (direct) return direct;

  const first = str(data.firstName);
  const last = str(data.lastName);
  if (first || last) return [first, last].filter(Boolean).join(' ');

  return null;
}

/**
 * Classify the write into a semantic action. Order matters: create/delete
 * are structural events and take precedence over state transitions.
 */
function resolveAction(before: DocData | null, after: DocData | null): string {
  if (!before && after) return 'created';
  if (before && !after) return 'deleted';
  if (!before || !after) return 'updated';

  if (after.isDeleted === true && before.isDeleted !== true) return 'trashed';
  if (after.isDeleted !== true && before.isDeleted === true) return 'restored';
  if (after.archivedAt && !before.archivedAt) return 'archived';
  if (after.archivedAt === null && before.archivedAt) return 'unarchived';
  if (before.status !== after.status) return 'status_changed';

  return 'updated';
}

export const auditContactWrite = functions
  .runWith({ timeoutSeconds: 60, memory: '256MB' })
  .firestore.document('contacts/{docId}')
  .onWrite(async (change, context) => {
    const entityId = context.params.docId as string;
    const before = change.before.exists
      ? (change.before.data() as DocData)
      : null;
    const after = change.after.exists
      ? (change.after.data() as DocData)
      : null;

    if (!before && !after) return null;

    const changes = deepDiff(before ?? {}, after ?? {});
    const action = resolveAction(before, after);

    // Pure-update writes that produce no meaningful diff are noise (e.g. a
    // client that re-saved the same data, or a system field touch). Creates
    // and deletes always emit an entry even with zero diffed fields.
    if (changes.length === 0 && action === 'updated') {
      return null;
    }

    const source: DocData = after ?? before ?? {};
    const performedBy = str(source._lastModifiedBy) ?? 'cdc_unknown';
    const performedByName = str(source._lastModifiedByName);
    const companyId = str(source.companyId);

    if (!companyId) {
      functions.logger.warn('CDC audit: missing companyId, skipping', {
        entityId,
        action,
      });
      return null;
    }

    if (performedBy === 'cdc_unknown') {
      functions.logger.warn('CDC audit: missing _lastModifiedBy', {
        entityId,
        action,
      });
    }

    const entry: CdcAuditEntry = {
      entityType: 'contact',
      entityId,
      entityName: resolveContactName(after ?? before),
      action,
      changes,
      performedBy,
      performedByName,
      companyId,
      source: 'cdc',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    };

    try {
      const auditId = generateEntityAuditId();
      await admin
        .firestore()
        .collection(COLLECTIONS.ENTITY_AUDIT_TRAIL)
        .doc(auditId)
        .set(entry);

      functions.logger.info('CDC audit entry written', {
        auditId,
        entityId,
        action,
        changeCount: changes.length,
      });
    } catch (err) {
      // Fire-and-forget semantics: a failed audit write must never break the
      // originating Firestore write (which has already succeeded by the time
      // this trigger runs). Just log and move on.
      functions.logger.error('CDC audit write failed', {
        entityId,
        action,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    return null;
  });
