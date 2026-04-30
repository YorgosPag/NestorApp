/**
 * =============================================================================
 * SEED: CONTACT RELATIONSHIP TYPE REGISTRY — ADR-336
 * =============================================================================
 *
 * Seeds the Firestore collection `contact_relationship_type_registry` with
 * the 31 static `RelationshipType` values from
 * `src/types/contacts/relationships/core/relationship-metadata.ts`, so that
 * the Firestore registry holds a complete picture of every type — static +
 * dynamic — for backup, audit, and future migration of code consumers.
 *
 * At runtime the registry merges static (code) + dynamic (Firestore) reads,
 * so this seed is NOT required for V1 functionality. It is a one-shot
 * idempotent dump for operators who want Firestore-only visibility.
 *
 * Usage:
 *   npx tsx scripts/seed-relationship-type-registry.ts
 *
 * Prerequisites:
 *   - Firebase Admin SDK credentials
 *   - Firestore access to the target project
 *
 * Idempotent: re-running overwrites existing static-seeded docs but never
 * touches dynamic (custom) types since their ids are generated and never
 * collide with static type names.
 */

import * as admin from 'firebase-admin';
import {
  RELATIONSHIP_METADATA,
  type RelationshipCategory,
  type RelationshipTypeMetadata,
} from '../src/types/contacts/relationships/core/relationship-metadata';
import type { RelationshipType } from '../src/types/contacts/relationships/core/relationship-types';

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'pagonis-87766',
  });
}

const db = admin.firestore();

const COLLECTION_NAME =
  process.env.NEXT_PUBLIC_CONTACT_RELATIONSHIP_TYPE_REGISTRY_COLLECTION ||
  'contact_relationship_type_registry';

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
  employee: 'Employee', manager: 'Manager', director: 'Director', executive: 'Executive',
  intern: 'Intern', contractor: 'Contractor', consultant: 'Consultant',
  shareholder: 'Shareholder', board_member: 'Board Member', chairman: 'Chairman',
  ceo: 'CEO', representative: 'Representative', partner: 'Partner',
  vendor: 'Vendor', client: 'Client', civil_servant: 'Civil Servant',
  elected_official: 'Elected Official', appointed_official: 'Appointed Official',
  department_head: 'Department Head', ministry_official: 'Ministry Official',
  mayor: 'Mayor', deputy_mayor: 'Deputy Mayor', regional_governor: 'Regional Governor',
  advisor: 'Advisor', mentor: 'Mentor', protege: 'Protégé', colleague: 'Colleague',
  supplier: 'Supplier', customer: 'Customer', competitor: 'Competitor',
  business_contact: 'Business Contact', friend: 'Friend', family: 'Family', other: 'Other',
  property_buyer: 'Property Buyer', property_co_buyer: 'Property Co-buyer',
  property_landowner: 'Property Landowner',
};

interface SeedDoc {
  id: string;
  key: string;
  labelEl: string;
  labelEn: string;
  reverseTypeKey: string | null;
  metadata: RelationshipTypeMetadata;
  isStaticSeed: true;
  createdAt: admin.firestore.Timestamp;
  createdBy: 'system_seed';
}

async function seed(): Promise<void> {
  const types = Object.keys(RELATIONSHIP_METADATA) as RelationshipType[];
  const now = admin.firestore.Timestamp.now();
  const collection = db.collection(COLLECTION_NAME);

  let writes = 0;
  for (const type of types) {
    const doc: SeedDoc = {
      id: type,
      key: type,
      labelEl: STATIC_LABELS_EL[type] ?? type,
      labelEn: STATIC_LABELS_EN[type] ?? type,
      reverseTypeKey: null,
      metadata: RELATIONSHIP_METADATA[type],
      isStaticSeed: true,
      createdAt: now,
      createdBy: 'system_seed',
    };
    await collection.doc(type).set(doc, { merge: true });
    writes += 1;
  }

  // Sanity check: every static category is represented.
  const seen = new Set<RelationshipCategory>();
  for (const type of types) seen.add(RELATIONSHIP_METADATA[type].category);

  console.log(`[seed-relationship-type-registry] wrote ${writes} static type docs`);
  console.log(`[seed-relationship-type-registry] categories present: ${[...seen].join(', ')}`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[seed-relationship-type-registry] failed:', err);
    process.exit(1);
  });
