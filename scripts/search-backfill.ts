#!/usr/bin/env ts-node
/**
 * =============================================================================
 * 🔍 SEARCH INDEX BACKFILL SCRIPT
 * =============================================================================
 *
 * Backfills search index for existing entities in Firestore.
 * Run this script after deploying search triggers to index existing data.
 *
 * USAGE:
 *   npx ts-node scripts/search-backfill.ts --dry-run              # Show what would be indexed
 *   npx ts-node scripts/search-backfill.ts --execute              # Index all entities
 *   npx ts-node scripts/search-backfill.ts --execute --type=contact  # Index only contacts
 *
 * OPTIONS:
 *   --dry-run          Show what would be indexed without making changes
 *   --execute          Actually create search documents
 *   --type=<type>      Only index specific entity type (project, contact, building, unit, file)
 *   --limit=<n>        Limit number of documents to process (default: unlimited)
 *   --company=<id>     Only index entities for specific company
 *
 * @module scripts/search-backfill
 * @enterprise ADR-029 - Global Search v1
 * @compliance Local_Protocol.txt - ZERO any
 */

import * as admin from 'firebase-admin';
import * as path from 'path';

// =============================================================================
// TYPES (Mirrored from functions/src/search/indexBuilder.ts)
// =============================================================================

const SEARCH_ENTITY_TYPES = {
  PROJECT: 'project',
  BUILDING: 'building',
  UNIT: 'unit',
  CONTACT: 'contact',
  FILE: 'file',
} as const;

type SearchEntityType = typeof SEARCH_ENTITY_TYPES[keyof typeof SEARCH_ENTITY_TYPES];

const SEARCH_AUDIENCE = {
  INTERNAL: 'internal',
  EXTERNAL: 'external',
} as const;

type SearchAudience = typeof SEARCH_AUDIENCE[keyof typeof SEARCH_AUDIENCE];

interface SearchFields {
  normalized: string;
  prefixes: string[];
}

interface SearchDocumentInput {
  tenantId: string;
  entityType: SearchEntityType;
  entityId: string;
  title: string;
  subtitle: string;
  status: string;
  search: SearchFields;
  audience: SearchAudience;
  requiredPermission: string;
  links: {
    href: string;
    routeParams: Record<string, string>;
  };
}

// =============================================================================
// COLLECTIONS
// =============================================================================

const COLLECTIONS = {
  PROJECTS: 'projects',
  BUILDINGS: 'buildings',
  UNITS: 'units',
  CONTACTS: 'contacts',
  FILES: 'files',
  SEARCH_DOCUMENTS: 'searchDocuments',
} as const;

// =============================================================================
// INDEX CONFIG
// =============================================================================

type TitleFieldConfig = string | ((doc: Record<string, unknown>) => string);
type AudienceFieldConfig = SearchAudience | ((doc: Record<string, unknown>) => SearchAudience);

interface SearchIndexConfig {
  collection: string;
  titleField: TitleFieldConfig;
  subtitleFields: string[];
  searchableFields: string[];
  statusField: string;
  audience: AudienceFieldConfig;
  requiredPermission: string;
  routeTemplate: string;
}

const SEARCH_INDEX_CONFIG: Record<SearchEntityType, SearchIndexConfig> = {
  project: {
    collection: COLLECTIONS.PROJECTS,
    titleField: 'name',
    subtitleFields: ['address', 'city'],
    searchableFields: ['name', 'address', 'city', 'projectCode'],
    statusField: 'status',
    audience: SEARCH_AUDIENCE.INTERNAL,
    requiredPermission: 'projects:projects:view',
    routeTemplate: '/projects/{id}',
  },
  building: {
    collection: COLLECTIONS.BUILDINGS,
    titleField: 'name',
    subtitleFields: ['address'],
    searchableFields: ['name', 'address', 'buildingCode'],
    statusField: 'status',
    audience: (doc) => (doc.isPublished ? SEARCH_AUDIENCE.EXTERNAL : SEARCH_AUDIENCE.INTERNAL),
    requiredPermission: 'buildings:buildings:view',
    routeTemplate: '/buildings/{id}',
  },
  unit: {
    collection: COLLECTIONS.UNITS,
    titleField: 'name',
    subtitleFields: ['floor', 'type'],
    searchableFields: ['name', 'unitCode', 'floor'],
    statusField: 'status',
    audience: (doc) => (doc.isPublished ? SEARCH_AUDIENCE.EXTERNAL : SEARCH_AUDIENCE.INTERNAL),
    requiredPermission: 'units:units:view',
    routeTemplate: '/units/{id}',
  },
  contact: {
    collection: COLLECTIONS.CONTACTS,
    titleField: (doc) => {
      const displayName = doc.displayName as string | undefined;
      const firstName = doc.firstName as string | undefined;
      const lastName = doc.lastName as string | undefined;
      return displayName || `${firstName || ''} ${lastName || ''}`.trim() || 'Unknown';
    },
    subtitleFields: ['email', 'phone'],
    searchableFields: ['displayName', 'firstName', 'lastName', 'email', 'companyName'],
    statusField: 'status',
    audience: SEARCH_AUDIENCE.INTERNAL,
    requiredPermission: 'crm:contacts:view',
    routeTemplate: '/contacts/{id}',
  },
  file: {
    collection: COLLECTIONS.FILES,
    titleField: 'displayName',
    subtitleFields: ['category', 'domain'],
    searchableFields: ['displayName', 'originalFilename'],
    statusField: 'status',
    audience: SEARCH_AUDIENCE.INTERNAL,
    requiredPermission: 'dxf:files:view',
    routeTemplate: '/files/{id}',
  },
};

// =============================================================================
// FIREBASE ADMIN INITIALIZATION
// =============================================================================

const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  || path.join(__dirname, '..', 'config', 'firebase-service-account.json');

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
    console.log('✅ Firebase Admin initialized with application default credentials');
  } catch {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const serviceAccount = require(serviceAccountPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('✅ Firebase Admin initialized with service account file');
    } catch (err) {
      console.error('❌ Failed to initialize Firebase Admin:', err);
      console.log('\n📋 To fix this, either:');
      console.log('   1. Set GOOGLE_APPLICATION_CREDENTIALS environment variable');
      console.log('   2. Place firebase-service-account.json in config/ folder');
      process.exit(1);
    }
  }
}

const db = admin.firestore();

// =============================================================================
// TEXT NORMALIZATION (Greek-friendly)
// =============================================================================

const GREEK_ACCENT_MAP: Record<string, string> = {
  'ά': 'α', 'έ': 'ε', 'ή': 'η', 'ί': 'ι', 'ό': 'ο', 'ύ': 'υ', 'ώ': 'ω',
  'Ά': 'α', 'Έ': 'ε', 'Ή': 'η', 'Ί': 'ι', 'Ό': 'ο', 'Ύ': 'υ', 'Ώ': 'ω',
  'ϊ': 'ι', 'ϋ': 'υ', 'ΐ': 'ι', 'ΰ': 'υ',
};

function normalizeSearchText(text: string): string {
  if (!text) return '';
  let result = text.toLowerCase();
  for (const [accented, base] of Object.entries(GREEK_ACCENT_MAP)) {
    result = result.replace(new RegExp(accented, 'g'), base);
  }
  return result.replace(/\s+/g, ' ').trim();
}

function generateSearchPrefixes(text: string, maxPrefixLength = 5): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const prefixes: Set<string> = new Set();
  for (const word of words) {
    for (let len = 3; len <= Math.min(maxPrefixLength, word.length); len++) {
      prefixes.add(word.substring(0, len));
    }
  }
  return Array.from(prefixes);
}

// =============================================================================
// BUILDER FUNCTIONS
// =============================================================================

function extractTitle(doc: Record<string, unknown>, config: SearchIndexConfig): string {
  if (typeof config.titleField === 'function') {
    return config.titleField(doc);
  }
  return (doc[config.titleField] as string) || '';
}

function extractSubtitle(doc: Record<string, unknown>, config: SearchIndexConfig): string {
  return config.subtitleFields
    .map((field) => doc[field] as string | undefined)
    .filter(Boolean)
    .join(' - ');
}

function determineAudience(doc: Record<string, unknown>, config: SearchIndexConfig): SearchAudience {
  if (typeof config.audience === 'function') {
    return config.audience(doc);
  }
  return config.audience;
}

function extractSearchableText(doc: Record<string, unknown>, config: SearchIndexConfig): string {
  const parts: string[] = [];
  for (const field of config.searchableFields) {
    const value = doc[field];
    if (typeof value === 'string' && value.trim()) {
      parts.push(value);
    }
  }
  return parts.join(' ');
}

function buildSearchDocument(
  entityType: SearchEntityType,
  entityId: string,
  data: Record<string, unknown>
): SearchDocumentInput | null {
  const config = SEARCH_INDEX_CONFIG[entityType];
  if (!config) return null;

  const tenantId = (data.companyId as string) || (data.tenantId as string);
  if (!tenantId) return null;

  const title = extractTitle(data, config);
  const subtitle = extractSubtitle(data, config);
  const status = (data[config.statusField] as string) || 'active';
  const audience = determineAudience(data, config);
  const searchableText = extractSearchableText(data, config);
  const normalizedText = normalizeSearchText(searchableText);
  const prefixes = generateSearchPrefixes(normalizedText);

  return {
    tenantId,
    entityType,
    entityId,
    title,
    subtitle,
    status,
    search: { normalized: normalizedText, prefixes },
    audience,
    requiredPermission: config.requiredPermission,
    links: {
      href: config.routeTemplate.replace('{id}', entityId),
      routeParams: { id: entityId },
    },
  };
}

// =============================================================================
// ARGUMENT PARSING
// =============================================================================

interface BackfillOptions {
  dryRun: boolean;
  execute: boolean;
  type?: SearchEntityType;
  limit?: number;
  companyId?: string;
}

function parseArgs(): BackfillOptions {
  const args = process.argv.slice(2);
  const options: BackfillOptions = {
    dryRun: false,
    execute: false,
  };

  for (const arg of args) {
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--execute') {
      options.execute = true;
    } else if (arg.startsWith('--type=')) {
      const type = arg.split('=')[1] as SearchEntityType;
      if (Object.values(SEARCH_ENTITY_TYPES).includes(type)) {
        options.type = type;
      } else {
        console.error(`❌ Invalid type: ${type}`);
        console.log(`   Valid types: ${Object.values(SEARCH_ENTITY_TYPES).join(', ')}`);
        process.exit(1);
      }
    } else if (arg.startsWith('--limit=')) {
      options.limit = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--company=')) {
      options.companyId = arg.split('=')[1];
    }
  }

  return options;
}

// =============================================================================
// BACKFILL LOGIC
// =============================================================================

async function backfillEntityType(
  entityType: SearchEntityType,
  options: BackfillOptions
): Promise<{ processed: number; indexed: number; skipped: number; errors: number }> {
  const config = SEARCH_INDEX_CONFIG[entityType];
  const stats = { processed: 0, indexed: 0, skipped: 0, errors: 0 };

  console.log(`\n📦 Processing ${entityType}...`);

  // Build query
  let query: FirebaseFirestore.Query = db.collection(config.collection);

  if (options.companyId) {
    query = query.where('companyId', '==', options.companyId);
  }

  if (options.limit) {
    query = query.limit(options.limit);
  }

  const snapshot = await query.get();
  console.log(`   Found ${snapshot.size} documents`);

  // Process in batches of 500
  const BATCH_SIZE = 500;
  let batch = db.batch();
  let batchCount = 0;

  for (const doc of snapshot.docs) {
    stats.processed++;
    const data = doc.data() as Record<string, unknown>;

    // Skip soft-deleted
    if (data.isDeleted === true || data.deletedAt) {
      stats.skipped++;
      continue;
    }

    const searchDoc = buildSearchDocument(entityType, doc.id, data);
    if (!searchDoc) {
      stats.skipped++;
      continue;
    }

    const searchDocId = `${entityType}_${doc.id}`;
    const searchDocRef = db.collection(COLLECTIONS.SEARCH_DOCUMENTS).doc(searchDocId);

    if (options.dryRun) {
      console.log(`   [DRY-RUN] Would index: ${searchDoc.title} (${searchDocId})`);
      stats.indexed++;
    } else if (options.execute) {
      batch.set(searchDocRef, {
        ...searchDoc,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        indexedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      batchCount++;
      stats.indexed++;

      // Commit batch every 500 documents
      if (batchCount >= BATCH_SIZE) {
        try {
          await batch.commit();
          console.log(`   ✅ Committed batch of ${batchCount} documents`);
          batch = db.batch();
          batchCount = 0;
        } catch (error) {
          console.error(`   ❌ Batch commit failed:`, error);
          stats.errors += batchCount;
          stats.indexed -= batchCount;
          batch = db.batch();
          batchCount = 0;
        }
      }
    }
  }

  // Commit remaining documents
  if (options.execute && batchCount > 0) {
    try {
      await batch.commit();
      console.log(`   ✅ Committed final batch of ${batchCount} documents`);
    } catch (error) {
      console.error(`   ❌ Final batch commit failed:`, error);
      stats.errors += batchCount;
      stats.indexed -= batchCount;
    }
  }

  console.log(`   📊 ${entityType}: processed=${stats.processed}, indexed=${stats.indexed}, skipped=${stats.skipped}, errors=${stats.errors}`);

  return stats;
}

async function main(): Promise<void> {
  console.log('');
  console.log('='.repeat(60));
  console.log('🔍 SEARCH INDEX BACKFILL');
  console.log('='.repeat(60));

  const options = parseArgs();

  if (!options.dryRun && !options.execute) {
    console.log('\n❌ Error: Must specify --dry-run or --execute');
    console.log('\nUsage:');
    console.log('  npx ts-node scripts/search-backfill.ts --dry-run');
    console.log('  npx ts-node scripts/search-backfill.ts --execute');
    console.log('  npx ts-node scripts/search-backfill.ts --execute --type=contact');
    console.log('  npx ts-node scripts/search-backfill.ts --execute --company=abc123');
    process.exit(1);
  }

  console.log(`\nMode: ${options.dryRun ? 'DRY-RUN (no changes)' : 'EXECUTE (will write)'}`);
  if (options.type) console.log(`Type filter: ${options.type}`);
  if (options.limit) console.log(`Limit: ${options.limit}`);
  if (options.companyId) console.log(`Company filter: ${options.companyId}`);

  const totalStats = { processed: 0, indexed: 0, skipped: 0, errors: 0 };

  // Determine which types to process
  const typesToProcess = options.type
    ? [options.type]
    : Object.values(SEARCH_ENTITY_TYPES);

  for (const entityType of typesToProcess) {
    const stats = await backfillEntityType(entityType, options);
    totalStats.processed += stats.processed;
    totalStats.indexed += stats.indexed;
    totalStats.skipped += stats.skipped;
    totalStats.errors += stats.errors;
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 FINAL SUMMARY');
  console.log('='.repeat(60));
  console.log(`   Total processed: ${totalStats.processed}`);
  console.log(`   Total indexed:   ${totalStats.indexed}`);
  console.log(`   Total skipped:   ${totalStats.skipped}`);
  console.log(`   Total errors:    ${totalStats.errors}`);
  console.log('');

  if (options.dryRun) {
    console.log('💡 This was a dry-run. Run with --execute to apply changes.');
  }
}

// Run
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
