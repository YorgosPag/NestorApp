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
  type RelationshipCategory,
  type RelationshipTypeMetadata,
  type WorkAddressDerivation,
} from '@/types/contacts/relationships/core/relationship-metadata';
import type { RelationshipType } from '@/types/contacts/relationships/core/relationship-types';
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
// STATIC TYPE LABELS
// ============================================================================
//
// Greek labels for the 31 static types. Mirrors `contacts-relationships.json`
// entries used client-side. Server-side i18n loaders are expensive; keeping a
// static map here avoids round-trips while still letting locale files drive
// the UI. If labels diverge, the locale file wins for display — this map is
// only used to *match* user input against existing static types.
//
const STATIC_LABELS_EL: Record<RelationshipType, string> = {
  employee: 'Εργαζόμενος',
  manager: 'Διευθυντής',
  director: 'Διευθυντής',
  executive: 'Στέλεχος',
  intern: 'Ασκούμενος',
  contractor: 'Εργολάβος',
  consultant: 'Σύμβουλος',
  shareholder: 'Μέτοχος',
  board_member: 'Μέλος Διοικητικού Συμβουλίου',
  chairman: 'Πρόεδρος',
  ceo: 'Διευθύνων Σύμβουλος',
  representative: 'Εκπρόσωπος',
  partner: 'Συνεργάτης',
  vendor: 'Προμηθευτής',
  client: 'Πελάτης',
  civil_servant: 'Δημόσιος Υπάλληλος',
  elected_official: 'Αιρετός Αξιωματούχος',
  appointed_official: 'Διορισμένος Αξιωματούχος',
  department_head: 'Προϊστάμενος Τμήματος',
  ministry_official: 'Υπουργικός Αξιωματούχος',
  mayor: 'Δήμαρχος',
  deputy_mayor: 'Αντιδήμαρχος',
  regional_governor: 'Περιφερειάρχης',
  advisor: 'Σύμβουλος',
  mentor: 'Μέντορας',
  protege: 'Προστατευόμενος',
  colleague: 'Συνάδελφος',
  supplier: 'Προμηθευτής',
  customer: 'Πελάτης',
  competitor: 'Ανταγωνιστής',
  business_contact: 'Επαγγελματική Επαφή',
  friend: 'Φίλος',
  family: 'Οικογένεια',
  other: 'Άλλο',
  property_buyer: 'Αγοραστής Ακινήτου',
  property_co_buyer: 'Συναγοραστής Ακινήτου',
  property_landowner: 'Οικοπεδούχος',
};

const STATIC_LABELS_EN: Record<RelationshipType, string> = {
  employee: 'Employee',
  manager: 'Manager',
  director: 'Director',
  executive: 'Executive',
  intern: 'Intern',
  contractor: 'Contractor',
  consultant: 'Consultant',
  shareholder: 'Shareholder',
  board_member: 'Board Member',
  chairman: 'Chairman',
  ceo: 'CEO',
  representative: 'Representative',
  partner: 'Partner',
  vendor: 'Vendor',
  client: 'Client',
  civil_servant: 'Civil Servant',
  elected_official: 'Elected Official',
  appointed_official: 'Appointed Official',
  department_head: 'Department Head',
  ministry_official: 'Ministry Official',
  mayor: 'Mayor',
  deputy_mayor: 'Deputy Mayor',
  regional_governor: 'Regional Governor',
  advisor: 'Advisor',
  mentor: 'Mentor',
  protege: 'Protégé',
  colleague: 'Colleague',
  supplier: 'Supplier',
  customer: 'Customer',
  competitor: 'Competitor',
  business_contact: 'Business Contact',
  friend: 'Friend',
  family: 'Family',
  other: 'Other',
  property_buyer: 'Property Buyer',
  property_co_buyer: 'Property Co-buyer',
  property_landowner: 'Property Landowner',
};

function staticEntries(): RegistryEntry[] {
  return (Object.keys(RELATIONSHIP_METADATA) as RelationshipType[]).map((type) => ({
    key: type,
    type,
    labelEl: STATIC_LABELS_EL[type] ?? type,
    labelEn: STATIC_LABELS_EN[type] ?? type,
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
  return {
    category,
    derivesWorkAddress: DEFAULT_DERIVES_WORK_ADDRESS,
    isEmployment: category === 'employment',
    isOwnership:  category === 'ownership',
    isGovernment: category === 'government',
    isProperty:   category === 'property',
    allowedFor: ALLOWED_FOR_BY_CATEGORY[category],
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
  const staticHit = statics.find((s) => normalizeKey(s.labelEl) === key);
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
