/**
 * =============================================================================
 * CDC AUDIT: Contact Write Trigger
 * =============================================================================
 *
 * Firestore `onWrite` trigger on `contacts/{docId}`. For every create / update
 * / delete, computes a generic deep diff and writes an audit entry to
 * `entity_audit_trail` with `source: 'cdc'`. Phase 2 cutover (2026-04-21):
 * CDC is the sole writer for contact audit entries. The service-layer path
 * in contacts.service.ts has been retired after Phase 1 confirmed full field
 * coverage and zero false positives. Pattern ready to extend to other collections.
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
import { resolveAction } from './resolve-action';
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
 * Resolve a user UID to "DisplayName (email)" for audit trail display.
 * Mirrors the service-layer `resolvePerformerDisplayName` in
 * `src/services/entity-audit.service.ts` so both writers produce the same
 * `performedByName` shape and the UI renders identical rows regardless of
 * which writer won the dedup window.
 *
 * Non-blocking: errors fall back to the stamped name unchanged.
 */
async function resolvePerformerDisplayName(
  uid: string,
  stamped: string | null,
): Promise<string | null> {
  // System sentinels (`cdc_unknown`, future `system:*`) and non-email
  // display names are kept as-is.
  if (!uid || uid === 'cdc_unknown') return stamped;
  if (stamped && !stamped.includes('@')) {
    // If the stamped name looks like a display name already, still try to
    // upgrade it to "DisplayName (email)" shape for consistency with the
    // service-layer resolver.
  }

  try {
    const userDoc = await admin
      .firestore()
      .collection(COLLECTIONS.USERS)
      .doc(uid)
      .get();
    if (!userDoc.exists) return stamped;

    const data = userDoc.data() ?? {};
    const displayName = str(data.displayName);
    const email = str(data.email);

    if (displayName && email) return `${displayName} (${email})`;
    if (displayName) return displayName;
    if (email) return email;
    return stamped;
  } catch (err) {
    functions.logger.warn('CDC audit: performer name resolve failed', {
      uid,
      error: err instanceof Error ? err.message : String(err),
    });
    return stamped;
  }
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

// `resolveAction` lives in `./resolve-action.ts` as a pure module so it can
// be unit tested without importing firebase-functions/firebase-admin.

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
    const stampedName = str(source._lastModifiedByName);
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

    // Upgrade stamped name to "DisplayName (email)" shape (parity with the
    // service-layer audit writer). Lookup is best-effort and non-blocking.
    const performedByName = await resolvePerformerDisplayName(
      performedBy,
      stampedName,
    );

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
