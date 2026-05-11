/**
 * ADR-344 Phase 8 — Custom dictionary Firestore CRUD service.
 *
 * Server-only (Admin SDK) so it can call `EntityAuditService.recordChange`
 * for every mutation (CLAUDE.md N.11 baseline 3.17). API routes are the
 * only intended caller — the SpellCheckExtension and the
 * CustomDictionaryManager UI talk to those routes, never to this module.
 *
 * IDs: every document is created via `setDoc(doc(<col>, generateDictEntryId()))`
 * per CLAUDE.md N.6 — `addDoc` / `Date.now()` / inline `randomUUID()` are
 * forbidden and blocked by `.ssot-registry.json` module `text-spell`.
 *
 * Audit: create/update/delete each emit one `EntityAuditService.recordChange`
 * entry. The audit write is fire-and-forget (failures logged, never thrown)
 * so a transient audit-trail outage cannot break dictionary management.
 *
 * Uniqueness: cross-document uniqueness on `(companyId, language, term)` is
 * enforced here, not in Firestore rules — rules cannot run cross-document
 * predicates. Callers race-prone? Acceptable: the audit log + duplicate
 * detection on the next read will surface the inconsistency, and the UI
 * de-dupes on display.
 *
 * @module text-engine/spell/custom-dictionary.service
 */

import 'server-only';

import { getAdminFirestore, FieldValue } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateDictEntryId } from '@/services/enterprise-id.service';
import { EntityAuditService } from '@/services/entity-audit.service';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import type { AuditFieldChange } from '@/types/audit-trail';
import {
  CustomDictionaryCrossTenantError,
  CustomDictionaryDuplicateError,
  CustomDictionaryNotFoundError,
  CustomDictionaryValidationError,
  type CreateCustomDictionaryEntryInput,
  type CustomDictionaryActor,
  type CustomDictionaryEntryDoc,
  type UpdateCustomDictionaryEntryInput,
} from './custom-dictionary.types';
import {
  collectIssues,
  createCustomDictionaryEntryInputSchema,
  updateCustomDictionaryEntryInputSchema,
} from './custom-dictionary.zod';
import type { SpellLanguage } from './spell.types';

const logger = createModuleLogger('CustomDictionaryService');

// ─── Internal helpers ─────────────────────────────────────────────────────────

function dictionaryCollection() {
  return getAdminFirestore().collection(COLLECTIONS.TEXT_CUSTOM_DICTIONARY);
}

/**
 * Validate `companyId` of a fetched doc against the caller's expected tenant.
 * Defence-in-depth: Firestore rules already block cross-tenant reads via the
 * Admin SDK rules bypass, but the service is the bottleneck so we enforce
 * here too.
 */
function assertSameTenant(
  entryId: string,
  expectedCompanyId: string,
  doc: CustomDictionaryEntryDoc,
): void {
  if (doc.companyId !== expectedCompanyId) {
    throw new CustomDictionaryCrossTenantError(entryId, expectedCompanyId, doc.companyId);
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

function buildCreationChanges(doc: CustomDictionaryEntryDoc): AuditFieldChange[] {
  return [
    fieldChange('term', null, doc.term, 'Όρος'),
    fieldChange('language', null, doc.language, 'Γλώσσα'),
  ];
}

function buildUpdateChanges(
  before: CustomDictionaryEntryDoc,
  after: { term: string; language: SpellLanguage },
): AuditFieldChange[] {
  const changes: AuditFieldChange[] = [];
  if (before.term !== after.term) {
    changes.push(fieldChange('term', before.term, after.term, 'Όρος'));
  }
  if (before.language !== after.language) {
    changes.push(fieldChange('language', before.language, after.language, 'Γλώσσα'));
  }
  return changes;
}

function buildDeletionChanges(doc: CustomDictionaryEntryDoc): AuditFieldChange[] {
  return [
    fieldChange('term', doc.term, null, 'Όρος'),
    fieldChange('language', doc.language, null, 'Γλώσσα'),
  ];
}

async function recordAudit(
  action: 'created' | 'updated' | 'deleted',
  doc: CustomDictionaryEntryDoc,
  changes: AuditFieldChange[],
  actor: CustomDictionaryActor,
): Promise<void> {
  try {
    await EntityAuditService.recordChange({
      entityType: 'custom_dictionary_entry',
      entityId: doc.id,
      entityName: doc.term,
      action,
      changes,
      performedBy: actor.userId,
      performedByName: actor.userName,
      companyId: doc.companyId,
    });
  } catch (err) {
    logger.warn('custom_dictionary audit entry skipped', {
      action,
      entryId: doc.id,
      error: getErrorMessage(err),
    });
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Read every custom dictionary entry owned by `companyId`. Order: term ASC. */
export async function listCustomDictionaryForCompany(
  companyId: string,
): Promise<CustomDictionaryEntryDoc[]> {
  const snap = await dictionaryCollection()
    .where('companyId', '==', companyId)
    .orderBy('term', 'asc')
    .get();
  return snap.docs.map((d) => d.data() as CustomDictionaryEntryDoc);
}

/**
 * Read a single entry. Throws `CustomDictionaryNotFoundError` if the doc
 * does not exist, `CustomDictionaryCrossTenantError` if it belongs to a
 * different company.
 */
export async function getCustomDictionaryEntryById(
  companyId: string,
  entryId: string,
): Promise<CustomDictionaryEntryDoc> {
  const ref = dictionaryCollection().doc(entryId);
  const snap = await ref.get();
  if (!snap.exists) throw new CustomDictionaryNotFoundError(entryId);
  const doc = snap.data() as CustomDictionaryEntryDoc;
  assertSameTenant(entryId, companyId, doc);
  return doc;
}

/**
 * Check uniqueness for `(companyId, language, term)`. Returns the existing
 * doc if a duplicate is found, otherwise `null`.
 */
export async function findDuplicateTerm(
  companyId: string,
  term: string,
  language: SpellLanguage,
): Promise<CustomDictionaryEntryDoc | null> {
  const snap = await dictionaryCollection()
    .where('companyId', '==', companyId)
    .where('language', '==', language)
    .where('term', '==', term)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return snap.docs[0].data() as CustomDictionaryEntryDoc;
}

/**
 * Create a new custom dictionary entry. Enforces `(companyId, language,
 * term)` uniqueness before write.
 */
export async function createCustomDictionaryEntry(
  input: CreateCustomDictionaryEntryInput,
  actor: CustomDictionaryActor,
): Promise<CustomDictionaryEntryDoc> {
  const parsed = createCustomDictionaryEntryInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new CustomDictionaryValidationError(
      'Invalid custom dictionary input',
      collectIssues(parsed.error),
    );
  }

  const existing = await findDuplicateTerm(input.companyId, input.term, input.language);
  if (existing !== null) {
    throw new CustomDictionaryDuplicateError(input.term, input.language, input.companyId);
  }

  const now = FieldValue.serverTimestamp();
  const id = generateDictEntryId();
  const ref = dictionaryCollection().doc(id);

  await ref.set({
    id,
    companyId: input.companyId,
    term: input.term,
    language: input.language,
    createdAt: now,
    updatedAt: now,
    createdBy: actor.userId,
    createdByName: actor.userName ?? null,
    updatedBy: actor.userId,
    updatedByName: actor.userName ?? null,
  });

  const persisted = (await ref.get()).data() as CustomDictionaryEntryDoc;
  await recordAudit('created', persisted, buildCreationChanges(persisted), actor);
  return persisted;
}

/**
 * Patch an existing entry. Only fields present on `patch` are touched.
 * If the patch results in the same `(companyId, language, term)` triple as
 * a different existing entry, throws `CustomDictionaryDuplicateError`.
 */
export async function updateCustomDictionaryEntry(
  companyId: string,
  entryId: string,
  patch: UpdateCustomDictionaryEntryInput,
  actor: CustomDictionaryActor,
): Promise<CustomDictionaryEntryDoc> {
  const parsed = updateCustomDictionaryEntryInputSchema.safeParse(patch);
  if (!parsed.success) {
    throw new CustomDictionaryValidationError(
      'Invalid custom dictionary patch',
      collectIssues(parsed.error),
    );
  }

  const before = await getCustomDictionaryEntryById(companyId, entryId);

  const nextTerm = patch.term ?? before.term;
  const nextLanguage = patch.language ?? before.language;

  if (nextTerm !== before.term || nextLanguage !== before.language) {
    const conflict = await findDuplicateTerm(companyId, nextTerm, nextLanguage);
    if (conflict !== null && conflict.id !== entryId) {
      throw new CustomDictionaryDuplicateError(nextTerm, nextLanguage, companyId);
    }
  }

  const writePayload: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: actor.userId,
    updatedByName: actor.userName ?? null,
  };
  if (patch.term !== undefined) writePayload.term = patch.term;
  if (patch.language !== undefined) writePayload.language = patch.language;

  await dictionaryCollection().doc(entryId).update(writePayload);
  const after = (await dictionaryCollection().doc(entryId).get()).data() as CustomDictionaryEntryDoc;

  const changes = buildUpdateChanges(before, { term: after.term, language: after.language });
  if (changes.length > 0) {
    await recordAudit('updated', after, changes, actor);
  }
  return after;
}

/** Delete an entry. Records a `deleted` audit entry before the write. */
export async function deleteCustomDictionaryEntry(
  companyId: string,
  entryId: string,
  actor: CustomDictionaryActor,
): Promise<void> {
  const before = await getCustomDictionaryEntryById(companyId, entryId);
  await dictionaryCollection().doc(entryId).delete();
  await recordAudit('deleted', before, buildDeletionChanges(before), actor);
}
