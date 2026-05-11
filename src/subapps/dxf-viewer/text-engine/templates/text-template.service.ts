/**
 * ADR-344 Phase 7.B — Text-template Firestore CRUD service.
 *
 * Server-only (Admin SDK) so it can call `EntityAuditService.recordChange`
 * for every mutation (CLAUDE.md N.11 baseline 3.17). API routes are the
 * only intended caller — the management UI (Phase 7.D) talks to those
 * routes, never to this module directly.
 *
 * IDs: every document is created via `setDoc(doc(<col>, generateTextTemplateId()))`
 * per CLAUDE.md N.6 — `addDoc` / `Date.now()` / inline `randomUUID()` are
 * forbidden and blocked by `.ssot-registry.json` module `text-templates`.
 *
 * Audit: create/update/delete each emit one `EntityAuditService.recordChange`
 * entry with diff'd field changes. The audit write is fire-and-forget inside
 * the service implementation (failures logged, never thrown) so a transient
 * audit-trail outage cannot break template management.
 *
 * @module text-engine/templates/text-template.service
 */

import 'server-only';

import { getAdminFirestore, FieldValue } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateTextTemplateId } from '@/services/enterprise-id.service';
import { EntityAuditService } from '@/services/entity-audit.service';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import type { AuditFieldChange } from '@/types/audit-trail';
import type { DxfTextNode } from '../types/text-ast.types';
import { extractPlaceholders } from './extract-placeholders';
import {
  TextTemplateCrossTenantError,
  TextTemplateNotFoundError,
  TextTemplateValidationError,
  type CreateTextTemplateInput,
  type TextTemplateActor,
  type UpdateTextTemplateInput,
  type UserTextTemplateDoc,
} from './text-template.types';
import {
  collectIssues,
  createTextTemplateInputSchema,
  updateTextTemplateInputSchema,
} from './text-template.zod';

const logger = createModuleLogger('TextTemplateService');

// ─── Internal helpers ─────────────────────────────────────────────────────────

function templateCollection() {
  return getAdminFirestore().collection(COLLECTIONS.TEXT_TEMPLATES);
}

/**
 * Validate `companyId` of a fetched doc against the caller's expected
 * tenant. Defence-in-depth: Firestore rules already block cross-tenant
 * reads via Admin SDK rules bypass, but the service is the bottleneck so
 * we enforce here too.
 */
function assertSameTenant(
  templateId: string,
  expectedCompanyId: string,
  doc: UserTextTemplateDoc,
): void {
  if (doc.companyId !== expectedCompanyId) {
    throw new TextTemplateCrossTenantError(templateId, expectedCompanyId, doc.companyId);
  }
}

function fieldChange(
  field: string,
  oldValue: AuditFieldChange['oldValue'],
  newValue: AuditFieldChange['newValue'],
  label?: string,
): AuditFieldChange {
  return label ? { field, oldValue, newValue, label } : { field, oldValue, newValue };
}

/** Build the field-change list for a "created" audit entry. */
function buildCreationChanges(doc: UserTextTemplateDoc): AuditFieldChange[] {
  return [
    fieldChange('name', null, doc.name, 'Όνομα'),
    fieldChange('category', null, doc.category, 'Κατηγορία'),
    fieldChange('placeholders', null, doc.placeholders.length, 'Πλήθος placeholders'),
  ];
}

/**
 * Build the field-change list for an "updated" audit entry. We diff only
 * the user-controlled fields (name / category / content-summary).
 *
 * `content` is a deep AST so we summarise it as paragraph count + extracted
 * placeholder count rather than serialising the entire tree into the audit
 * log. Phase 7.D may add a richer diff later.
 */
function buildUpdateChanges(
  before: UserTextTemplateDoc,
  after: { name: string; category: string; content: DxfTextNode; placeholders: readonly string[] },
): AuditFieldChange[] {
  const changes: AuditFieldChange[] = [];
  if (before.name !== after.name) {
    changes.push(fieldChange('name', before.name, after.name, 'Όνομα'));
  }
  if (before.category !== after.category) {
    changes.push(fieldChange('category', before.category, after.category, 'Κατηγορία'));
  }
  if (before.content !== after.content) {
    changes.push(
      fieldChange(
        'content.paragraphs',
        before.content.paragraphs.length,
        after.content.paragraphs.length,
        'Πλήθος παραγράφων',
      ),
    );
    if (before.placeholders.length !== after.placeholders.length) {
      changes.push(
        fieldChange(
          'placeholders',
          before.placeholders.length,
          after.placeholders.length,
          'Πλήθος placeholders',
        ),
      );
    }
  }
  return changes;
}

/** Build the field-change list for a "deleted" audit entry. */
function buildDeletionChanges(doc: UserTextTemplateDoc): AuditFieldChange[] {
  return [
    fieldChange('name', doc.name, null, 'Όνομα'),
    fieldChange('category', doc.category, null, 'Κατηγορία'),
  ];
}

async function recordAudit(
  action: 'created' | 'updated' | 'deleted',
  doc: UserTextTemplateDoc,
  changes: AuditFieldChange[],
  actor: TextTemplateActor,
): Promise<void> {
  try {
    await EntityAuditService.recordChange({
      entityType: 'text_template',
      entityId: doc.id,
      entityName: doc.name,
      action,
      changes,
      performedBy: actor.userId,
      performedByName: actor.userName,
      companyId: doc.companyId,
    });
  } catch (err) {
    logger.warn('text_template audit entry skipped', {
      action,
      templateId: doc.id,
      error: getErrorMessage(err),
    });
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Read every text template owned by `companyId`. Result order: name ASC. */
export async function listTextTemplatesForCompany(
  companyId: string,
): Promise<UserTextTemplateDoc[]> {
  const snap = await templateCollection()
    .where('companyId', '==', companyId)
    .orderBy('name', 'asc')
    .get();
  return snap.docs.map((d) => d.data() as UserTextTemplateDoc);
}

/**
 * Read a single template. Throws `TextTemplateNotFoundError` if the doc
 * does not exist, `TextTemplateCrossTenantError` if it belongs to a
 * different company.
 */
export async function getTextTemplateById(
  companyId: string,
  templateId: string,
): Promise<UserTextTemplateDoc> {
  const ref = templateCollection().doc(templateId);
  const snap = await ref.get();
  if (!snap.exists) throw new TextTemplateNotFoundError(templateId);
  const doc = snap.data() as UserTextTemplateDoc;
  assertSameTenant(templateId, companyId, doc);
  return doc;
}

/**
 * Create a new template. `placeholders` is derived server-side via
 * `extractPlaceholders(input.content)` so the persisted list cannot drift
 * from the actual AST tokens.
 */
export async function createTextTemplate(
  input: CreateTextTemplateInput,
  actor: TextTemplateActor,
): Promise<UserTextTemplateDoc> {
  const parsed = createTextTemplateInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new TextTemplateValidationError(
      'Invalid text template input',
      collectIssues(parsed.error),
    );
  }
  const now = FieldValue.serverTimestamp();
  const id = generateTextTemplateId();
  const placeholders = extractPlaceholders(input.content);
  const ref = templateCollection().doc(id);

  await ref.set({
    id,
    companyId: input.companyId,
    name: input.name,
    category: input.category,
    content: input.content,
    placeholders,
    isDefault: false,
    createdAt: now,
    updatedAt: now,
    createdBy: actor.userId,
    createdByName: actor.userName ?? null,
    updatedBy: actor.userId,
    updatedByName: actor.userName ?? null,
  });

  const persisted = (await ref.get()).data() as UserTextTemplateDoc;
  await recordAudit('created', persisted, buildCreationChanges(persisted), actor);
  return persisted;
}

/**
 * Patch an existing template. Only the fields present on `patch` are
 * touched; `placeholders` is re-derived when `content` is patched.
 */
export async function updateTextTemplate(
  companyId: string,
  templateId: string,
  patch: UpdateTextTemplateInput,
  actor: TextTemplateActor,
): Promise<UserTextTemplateDoc> {
  const parsed = updateTextTemplateInputSchema.safeParse(patch);
  if (!parsed.success) {
    throw new TextTemplateValidationError(
      'Invalid text template patch',
      collectIssues(parsed.error),
    );
  }

  const before = await getTextTemplateById(companyId, templateId);

  const nextContent = patch.content ?? before.content;
  const nextPlaceholders = patch.content
    ? extractPlaceholders(patch.content)
    : before.placeholders;
  const writePayload: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: actor.userId,
    updatedByName: actor.userName ?? null,
  };
  if (patch.name !== undefined) writePayload.name = patch.name;
  if (patch.category !== undefined) writePayload.category = patch.category;
  if (patch.content !== undefined) {
    writePayload.content = patch.content;
    writePayload.placeholders = nextPlaceholders;
  }

  await templateCollection().doc(templateId).update(writePayload);
  const after = (await templateCollection().doc(templateId).get()).data() as UserTextTemplateDoc;

  const changes = buildUpdateChanges(before, {
    name: after.name,
    category: after.category,
    content: nextContent,
    placeholders: nextPlaceholders,
  });
  if (changes.length > 0) {
    await recordAudit('updated', after, changes, actor);
  }
  return after;
}

/** Delete a template. Records a `deleted` audit entry before the write. */
export async function deleteTextTemplate(
  companyId: string,
  templateId: string,
  actor: TextTemplateActor,
): Promise<void> {
  const before = await getTextTemplateById(companyId, templateId);
  await templateCollection().doc(templateId).delete();
  await recordAudit('deleted', before, buildDeletionChanges(before), actor);
}
