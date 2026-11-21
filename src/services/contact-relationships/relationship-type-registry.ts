/**
 * ADR-336 — Self-extending taxonomy for contact relationship types.
 *
 * Two stores merged at read time:
 *   1. Static (code-level) — `RELATIONSHIP_METADATA` from
 *      `src/types/contacts/relationships/core/relationship-metadata.ts`.
 *      31 immutable types ('employee', 'manager', …) with full metadata.
 *      Labels live in i18n locales (`contacts-relationships.json`).
 *   2. Dynamic (Firestore) — `contact_relationship_type_registry`.
 *      User-created types added through the SignatoryProposalCard UI flow.
 *      Stores labelEl + labelEn + reverseTypeKey + metadata + audit fields.
 *
 * `findOrCreateRelationshipType` operates ONLY on the dynamic store: static
 * types are picked directly by their canonical key in the UI and never enter
 * the find-or-create path. This keeps the ADR-318 SSoT for static metadata
 * intact while enabling Q4's self-extending taxonomy on top.
 *
 * Idempotency: keyed by `normalizeKey(labelEl)` — a second call with the same
 * label (or a near-duplicate stripped of diacritics/whitespace/case) returns
 * the existing record instead of creating a new one.
 */

import 'server-only';

import admin from 'firebase-admin';
import { safeFirestoreOperation } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateOptimisticId } from '@/services/enterprise-id.service';
import { sanitizeForFirestore } from '@/utils/firestore-sanitize';
import { createModuleLogger } from '@/lib/telemetry';
import {
  RELATIONSHIP_METADATA,
  buildCrossingsForSources,
  type RelationshipCategory,
  type RelationshipTypeMetadata,
  type WorkAddressDerivation,
} from '@/types/contacts/relationships/core/relationship-metadata';
import type { RelationshipType } from '@/types/contacts/relationships/core/relationship-types';
import { relationshipTypeI18nSegment } from '@/types/contacts/relationships/core/relationship-orientation';
import elRelationships from '@/i18n/locales/el/contacts-relationships.json';
import enRelationships from '@/i18n/locales/en/contacts-relationships.json';
import type { ContactType } from '@/types/contacts/contracts';
import type { AuthContext } from '@/lib/auth';
import { inferRelationshipTypeAttributes } from './relationship-type-ai-inference';

const logger = createModuleLogger('RELATIONSHIP_TYPE_REGISTRY');

// ============================================================================
// PUBLIC TYPES
// ============================================================================

export interface RegistryEntry {
  /** Canonical lookup key — normalized from labelEl. */
  key: string;
  /**
   * Static types: the `RelationshipType` enum value (e.g. 'employee').
   * Dynamic types: prefixed with `custom:` + the doc id.
   */
  type: string;
  labelEl: string;
  labelEn: string;
  /** Reverse-direction key (resolves to another RegistryEntry). null when unknown. */
  reverseKey: string | null;
  metadata: RelationshipTypeMetadata;
  isStatic: boolean;
}

export interface FindOrCreateInput {
  labelEl: string;
  /** Optional override for the reverse label (Q4 «προχωρημένα ▾» disclosure). */
  reverseLabelEl?: string;
}

interface CustomTypeDoc {
  id: string;
  key: string;
  labelEl: string;
  labelEn: string;
  reverseTypeKey: string | null;
  metadata: RelationshipTypeMetadata;
  aiBacked: boolean;
  createdAt: admin.firestore.Timestamp;
  createdBy: string;
  createdByCompanyId: string;
}

// ============================================================================
// NORMALIZATION
// ============================================================================

export function normalizeKey(label: string): string {
  return label
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '');
}

// ============================================================================
// STATIC TYPE LABELS — derived from the locale files (ADR-372 §Β1)
// ============================================================================
//
// The locale JSON is the ONE place a relationship role is named. This module
// used to keep two hand-written 37-entry copies (EL/EN) that had already
// drifted (e.g. `manager` = «Διευθυντής» here, «Προϊστάμενος» elsewhere).
// Static JSON imports are cheap server-side and keep zero duplication.
//
type RoleLabelBundle = {
  relationships: {
    types: Record<string, string>;
    inverseTypes: Record<string, string>;
  };
};

const LABELS_EL = elRelationships as RoleLabelBundle;
const LABELS_EN = enRelationships as RoleLabelBundle;

function roleLabel(bundle: RoleLabelBundle, type: RelationshipType): string {
  return bundle.relationships.types[relationshipTypeI18nSegment(type)] ?? type;
}

/** Inverse reading (directed types only) — matched too, so «Πελάτης» resolves to `vendor`. */
function inverseRoleLabel(bundle: RoleLabelBundle, type: RelationshipType): string | null {
  if (RELATIONSHIP_METADATA[type].symmetric) return null;
  return bundle.relationships.inverseTypes[relationshipTypeI18nSegment(type)] ?? null;
}

function staticEntries(): RegistryEntry[] {
  return (Object.keys(RELATIONSHIP_METADATA) as RelationshipType[]).map((type) => ({
    key: type,
    type,
    labelEl: roleLabel(LABELS_EL, type),
    labelEn: roleLabel(LABELS_EN, type),
    reverseKey: null,
    metadata: RELATIONSHIP_METADATA[type],
    isStatic: true,
  }));
}

// ============================================================================
// METADATA DEFAULTS (ADR-336 Q5)
// ============================================================================

const DEFAULT_DERIVES_WORK_ADDRESS: WorkAddressDerivation = 'optional';

const ALLOWED_FOR_BY_CATEGORY: Record<RelationshipCategory, ContactType[]> = {
  employment:   ['company', 'service'],
  ownership:    ['company', 'service'],
  government:   ['company', 'service'],
  professional: ['company', 'service'],
  personal:     ['individual', 'company', 'service'],
  property:     ['individual', 'company', 'service'],
};

export function buildDefaultMetadata(category: RelationshipCategory): RelationshipTypeMetadata {
  const allowedFor = ALLOWED_FOR_BY_CATEGORY[category];
  // ADR-372: derive allowedCrossings from source set; all targets permitted for custom types.
  const allowedCrossings = buildCrossingsForSources(allowedFor);
  return {
    category,
    // Custom types carry no declared direction (ADR-372 §Β2) — read the same from both sides.
    symmetric: true,
    derivesWorkAddress: DEFAULT_DERIVES_WORK_ADDRESS,
    isEmployment: category === 'employment',
    isOwnership:  category === 'ownership',
    isGovernment: category === 'government',
    isProperty:   category === 'property',
    // ADR-372 §8.3: a custom type declares no org-chart place and no people-management —
    // never guessed from its category or its name.
    orgChartLevel: null,
    isManagerial: false,
    allowedFor,
    allowedCrossings,
  };
}

// ============================================================================
// FIRESTORE READS
// ============================================================================

async function fetchCustomDocs(): Promise<CustomTypeDoc[]> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db.collection(COLLECTIONS.CONTACT_RELATIONSHIP_TYPE_REGISTRY).get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as CustomTypeDoc));
  }, []);
}

function customDocToEntry(doc: CustomTypeDoc): RegistryEntry {
  return {
    key: doc.key,
    type: `custom:${doc.id}`,
    labelEl: doc.labelEl,
    labelEn: doc.labelEn,
    reverseKey: doc.reverseTypeKey,
    metadata: doc.metadata,
    isStatic: false,
  };
}

// ============================================================================
// PUBLIC API
// ============================================================================

/** Static + dynamic types, merged. Static types listed first in stable order. */
export async function listAllRelationshipTypes(): Promise<RegistryEntry[]> {
  const customs = await fetchCustomDocs();
  return [...staticEntries(), ...customs.map(customDocToEntry)];
}

/**
 * Find a type matching `labelEl` (after normalization), or create a new
 * dynamic type when no match exists. Static types win on collision: if the
 * normalized key equals a static type's labelEl-normalized form, return that.
 */
export async function findOrCreateRelationshipType(
  input: FindOrCreateInput,
  ctx: AuthContext
): Promise<RegistryEntry> {
  const labelEl = input.labelEl.trim();
  if (!labelEl) {
    throw new Error('relationship-type-registry: labelEl is required');
  }
  const key = normalizeKey(labelEl);

  // 1. Static collision check — match against normalized static labels.
  const statics = staticEntries();
  const staticHit = statics.find((s) => {
    if (normalizeKey(s.labelEl) === key) return true;
    const inverse = inverseRoleLabel(LABELS_EL, s.type as RelationshipType);
    return inverse !== null && normalizeKey(inverse) === key;
  });
  if (staticHit) {
    logger.info('Reusing static relationship type', { key, type: staticHit.type });
    return staticHit;
  }

  // 2. Dynamic store lookup.
  const customs = await fetchCustomDocs();
  const customHit = customs.find((c) => c.key === key);
  if (customHit) {
    logger.info('Reusing custom relationship type', { key, id: customHit.id });
    return customDocToEntry(customHit);
  }

  // 3. Infer + create.
  const inferred = await inferRelationshipTypeAttributes({
    labelEl,
    reverseLabelEl: input.reverseLabelEl,
  });

  const reverseKey = inferred.reverseLabelEl
    ? normalizeKey(inferred.reverseLabelEl)
    : null;
  const metadata = buildDefaultMetadata(inferred.category);
  const id = generateOptimisticId();
  const now = admin.firestore.Timestamp.now();

  const doc: CustomTypeDoc = {
    id,
    key,
    labelEl,
    labelEn: inferred.labelEn,
    reverseTypeKey: reverseKey,
    metadata,
    aiBacked: inferred.aiBacked,
    createdAt: now,
    createdBy: ctx.uid,
    createdByCompanyId: ctx.companyId,
  };

  await safeFirestoreOperation(async (db) => {
    await db.collection(COLLECTIONS.CONTACT_RELATIONSHIP_TYPE_REGISTRY)
      .doc(id)
      .set(sanitizeForFirestore(doc));
  });
  logger.info('Created custom relationship type', {
    key,
    id,
    category: inferred.category,
    aiBacked: inferred.aiBacked,
  });

  return customDocToEntry(doc);
}
