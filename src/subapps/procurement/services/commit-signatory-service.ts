/**
 * ADR-336 — Commit-signatory orchestration service.
 *
 * Glues four subsystems behind a single user-initiated commit:
 *   1. signatory-resolver        — find existing IndividualContact (strong/weak/none)
 *   2. relationship-type-registry — pick or create the relationship type
 *   3. contacts collection        — create a new IndividualContact when no link
 *   4. contact_relationships      — idempotent vendor↔signatory edge
 *
 * Idempotency rules:
 *  - Same labelEl → same RegistryEntry (handled by registry)
 *  - Same (vendorContactId, signatoryContactId, relationshipType) tuple →
 *    returns existing relationship id, no duplicate write
 *  - Strong-match resolver returns the same contactId on re-run, so the
 *    second commit click is a no-op
 *
 * Custom relationship types (created via Q4 self-extending taxonomy) cannot
 * fit the static `RelationshipType` union. They are persisted as
 * `relationshipType: 'other'` plus `customFields.customRelationshipType*` so
 * the strict typing of `ContactRelationship` is preserved while the custom
 * label travels with the document for UI rendering.
 */

import 'server-only';

import admin from 'firebase-admin';
import { safeFirestoreOperation } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { sanitizeForFirestore } from '@/utils/firestore-sanitize';
import { generateContactId, generateRelationshipId } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry';
import { EntityAuditService } from '@/services/entity-audit.service';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { safeFireAndForget } from '@/lib/safe-fire-and-forget';
import {
  resolveSignatory,
  type SignatoryInput,
  type WeakCandidate,
} from '@/services/contacts/signatory-resolver';
import {
  findOrCreateRelationshipType,
  type RegistryEntry,
} from '@/services/contact-relationships/relationship-type-registry';
import { getQuote } from './quote-service';
import type { AuthContext } from '@/lib/auth';
import type {
  IndividualContact,
  EmailInfo,
  PhoneInfo,
} from '@/types/contacts/contracts';
import type { ContactRelationship } from '@/types/contacts/relationships';
import type { RelationshipType } from '@/types/contacts/relationships/core/relationship-types';

const logger = createModuleLogger('COMMIT_SIGNATORY');

// ============================================================================
// PUBLIC TYPES
// ============================================================================

export interface CommitSignatoryFields {
  firstName: string;
  lastName: string;
  role: string | null;
  profession: string | null;
  /** ESCO occupation URI (ADR-034). Null when free-text. */
  escoUri: string | null;
  escoLabel: string | null;
  iscoCode: string | null;
  mobile: string | null;
  email: string | null;
  vatNumber: string | null;
}

export type CommitRelationshipTypeInput =
  | { kind: 'static'; type: RelationshipType }
  | { kind: 'custom'; labelEl: string; reverseLabelEl?: string | null };

export interface CommitSignatoryInput {
  signatory: CommitSignatoryFields;
  relationshipType: CommitRelationshipTypeInput;
  /** Manual disambiguation: user picked an existing contact from weak-match candidates. */
  linkToContactId?: string | null;
  /** Manual disambiguation: user chose to create a new contact despite weak overlap. */
  forceCreate?: boolean;
}

export type CommitSignatoryResult =
  | {
      ok: true;
      contactId: string;
      relationshipId: string;
      matchKind: 'strong' | 'weak_force_create' | 'none' | 'manual_link';
      relationshipTypeKey: string;
      relationshipTypeIsStatic: boolean;
      reused: { contact: boolean; relationship: boolean };
    }
  | { ok: false; requiresDisambiguation: true; candidates: WeakCandidate[] }
  | { ok: false; error: string; status: number };

// ============================================================================
// CONTACT CREATION
// ============================================================================

async function createIndividualContact(
  sig: SignatoryInput,
  esco: { escoUri: string | null; escoLabel: string | null; iscoCode: string | null },
  ctx: AuthContext
): Promise<string> {
  return safeFirestoreOperation(async (db) => {
    const id = generateContactId();
    const now = admin.firestore.Timestamp.now();

    const phones: PhoneInfo[] = sig.mobile
      ? [{ number: sig.mobile, type: 'mobile', isPrimary: true }]
      : [];
    const emails: EmailInfo[] = sig.email
      ? [{ email: sig.email, type: 'work', isPrimary: true }]
      : [];

    // SAP/Procore parity: role/job-title belongs to the vendor↔signatory
    // relationship, not to the IndividualContact master record.
    const contact: Partial<IndividualContact> & {
      type: 'individual';
      companyId: string;
    } = {
      id,
      type: 'individual',
      isFavorite: false,
      status: 'active',
      firstName: sig.firstName ?? '',
      lastName: sig.lastName ?? '',
      profession: sig.profession ?? undefined,
      escoUri: esco.escoUri ?? undefined,
      escoLabel: esco.escoLabel ?? undefined,
      iscoCode: esco.iscoCode ?? undefined,
      employerId: sig.vendorContactId,
      vatNumber: sig.vatNumber ?? undefined,
      phones,
      emails,
      companyId: ctx.companyId,
      createdAt: now,
      updatedAt: now,
      createdBy: ctx.uid,
    };

    await db.collection(COLLECTIONS.CONTACTS).doc(id).set(sanitizeForFirestore(contact));
    safeFireAndForget(
      EntityAuditService.recordChange({
        entityType: ENTITY_TYPES.CONTACT,
        entityId: id,
        entityName: `${sig.firstName ?? ''} ${sig.lastName ?? ''}`.trim() || id,
        action: 'created',
        changes: [],
        performedBy: ctx.uid,
        performedByName: null,
        companyId: ctx.companyId,
      })
    );
    logger.info('Created IndividualContact for quote signatory', {
      id,
      vendorContactId: sig.vendorContactId,
      companyId: ctx.companyId,
    });
    return id;
  });
}

// ============================================================================
// RELATIONSHIP CREATION (idempotent)
// ============================================================================

async function findOrCreateRelationship(
  vendorContactId: string,
  signatoryContactId: string,
  relType: RelationshipType,
  customFields: Record<string, unknown>,
  rolePosition: string | null,
  ctx: AuthContext
): Promise<{ id: string; reused: boolean }> {
  return safeFirestoreOperation(async (db) => {
    const existing = await db
      .collection(COLLECTIONS.CONTACT_RELATIONSHIPS)
      .where('sourceContactId', '==', vendorContactId)
      .where('targetContactId', '==', signatoryContactId)
      .where('relationshipType', '==', relType)
      .where('companyId', '==', ctx.companyId)
      .limit(1)
      .get();
    if (!existing.empty) {
      return { id: existing.docs[0].id, reused: true };
    }

    const id = generateRelationshipId();
    const now = admin.firestore.Timestamp.now();
    const today = now.toDate().toISOString().slice(0, 10);

    const relationship: Partial<ContactRelationship> & { companyId: string } = {
      id,
      sourceContactId: vendorContactId,
      targetContactId: signatoryContactId,
      relationshipType: relType,
      status: 'active',
      position: rolePosition ?? null,
      startDate: today,
      customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
      createdBy: ctx.uid,
      lastModifiedBy: ctx.uid,
      createdAt: now,
      updatedAt: now,
      companyId: ctx.companyId,
    };

    await db
      .collection(COLLECTIONS.CONTACT_RELATIONSHIPS)
      .doc(id)
      .set(sanitizeForFirestore(relationship));
    logger.info('Created ContactRelationship vendor↔signatory', {
      id,
      vendorContactId,
      signatoryContactId,
      relType,
    });
    return { id, reused: false };
  });
}

// ============================================================================
// MAIN ORCHESTRATION
// ============================================================================

function buildRelationshipTypeStorage(entry: RegistryEntry): {
  relationshipType: RelationshipType;
  customFields: Record<string, unknown>;
} {
  if (entry.isStatic) {
    return {
      relationshipType: entry.type as RelationshipType,
      customFields: {},
    };
  }
  return {
    relationshipType: 'other',
    customFields: {
      customRelationshipTypeKey: entry.key,
      customRelationshipTypeId: entry.type,
      customRelationshipTypeLabelEl: entry.labelEl,
      customRelationshipTypeLabelEn: entry.labelEn,
    },
  };
}

export async function commitSignatory(
  quoteId: string,
  input: CommitSignatoryInput,
  ctx: AuthContext
): Promise<CommitSignatoryResult> {
  const quote = await getQuote(ctx.companyId, quoteId);
  if (!quote) {
    return { ok: false, error: 'Quote not found', status: 404 };
  }
  if (!quote.vendorContactId) {
    return { ok: false, error: 'Quote has no vendor — assign a vendor before committing the signatory', status: 400 };
  }

  const sigInput: SignatoryInput = {
    firstName: input.signatory.firstName?.trim() || null,
    lastName: input.signatory.lastName?.trim() || null,
    role: input.signatory.role,
    profession: input.signatory.profession,
    mobile: input.signatory.mobile,
    email: input.signatory.email,
    vatNumber: input.signatory.vatNumber,
    vendorContactId: quote.vendorContactId,
  };

  // ── 1. Resolve / create the contact ─────────────────────────────────────
  let contactId: string;
  let matchKind: 'strong' | 'weak_force_create' | 'none' | 'manual_link';
  let contactReused: boolean;

  if (input.linkToContactId) {
    contactId = input.linkToContactId;
    matchKind = 'manual_link';
    contactReused = true;
  } else {
    const match = await resolveSignatory(sigInput, ctx.companyId);
    if (match.kind === 'strong') {
      contactId = match.contactId;
      matchKind = 'strong';
      contactReused = true;
    } else if (match.kind === 'weak' && !input.forceCreate) {
      return { ok: false, requiresDisambiguation: true, candidates: match.candidates };
    } else {
      contactId = await createIndividualContact(
        sigInput,
        {
          escoUri: input.signatory.escoUri,
          escoLabel: input.signatory.escoLabel,
          iscoCode: input.signatory.iscoCode,
        },
        ctx
      );
      matchKind = match.kind === 'weak' ? 'weak_force_create' : 'none';
      contactReused = false;
    }
  }

  // ── 2. Resolve / create the relationship type ──────────────────────────
  let entry: RegistryEntry;
  if (input.relationshipType.kind === 'static') {
    entry = {
      key: input.relationshipType.type,
      type: input.relationshipType.type,
      labelEl: input.relationshipType.type,
      labelEn: input.relationshipType.type,
      reverseKey: null,
      metadata: {
        category: 'professional',
        derivesWorkAddress: 'never',
        isEmployment: false, isOwnership: false, isGovernment: false, isProperty: false,
        allowedFor: ['individual', 'company', 'service'],
      },
      isStatic: true,
    };
  } else {
    entry = await findOrCreateRelationshipType(
      {
        labelEl: input.relationshipType.labelEl,
        reverseLabelEl: input.relationshipType.reverseLabelEl ?? undefined,
      },
      ctx
    );
  }
  const { relationshipType, customFields } = buildRelationshipTypeStorage(entry);

  // ── 3. Idempotent relationship creation ────────────────────────────────
  const rel = await findOrCreateRelationship(
    quote.vendorContactId,
    contactId,
    relationshipType,
    customFields,
    input.signatory.role,
    ctx
  );

  return {
    ok: true,
    contactId,
    relationshipId: rel.id,
    matchKind,
    relationshipTypeKey: entry.key,
    relationshipTypeIsStatic: entry.isStatic,
    reused: { contact: contactReused, relationship: rel.reused },
  };
}
