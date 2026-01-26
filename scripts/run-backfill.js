/**
 * Run search backfill directly (bypassing HTTP timeout)
 * Run with: pnpm exec node scripts/run-backfill.js [entity-type]
 *
 * Examples:
 *   pnpm exec node scripts/run-backfill.js opportunity
 *   pnpm exec node scripts/run-backfill.js              (all types)
 */

// Load environment variables manually
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  });
}

const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  let serviceAccount;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64) {
    const decoded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64, 'base64').toString('utf8');
    serviceAccount = JSON.parse(decoded);
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  } else {
    console.error('❌ No Firebase service account key found!');
    process.exit(1);
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// Greek text normalization
const GREEK_ACCENT_MAP = {
  'ά': 'α', 'έ': 'ε', 'ή': 'η', 'ί': 'ι', 'ό': 'ο', 'ύ': 'υ', 'ώ': 'ω',
  'Ά': 'α', 'Έ': 'ε', 'Ή': 'η', 'Ί': 'ι', 'Ό': 'ο', 'Ύ': 'υ', 'Ώ': 'ω',
  'ϊ': 'ι', 'ϋ': 'υ', 'ΐ': 'ι', 'ΰ': 'υ',
};

function normalizeSearchText(text) {
  if (!text) return '';
  let result = text.toLowerCase();
  for (const [accented, base] of Object.entries(GREEK_ACCENT_MAP)) {
    result = result.replace(new RegExp(accented, 'g'), base);
  }
  return result.replace(/\s+/g, ' ').trim();
}

function generateSearchPrefixes(text, maxPrefixLength = 5) {
  const words = text.split(/\s+/).filter(Boolean);
  const prefixes = new Set();
  for (const word of words) {
    for (let len = 3; len <= Math.min(maxPrefixLength, word.length); len++) {
      prefixes.add(word.substring(0, len));
    }
  }
  return Array.from(prefixes);
}

// Entity configurations
const ENTITY_CONFIGS = {
  opportunity: {
    collection: 'opportunities',
    titleField: 'title',
    subtitleFields: ['stage', 'status'],
    searchableFields: ['title', 'fullName', 'email', 'phone', 'notes'],
    statusField: 'status',
    routeTemplate: '/crm/opportunities?opportunityId={id}&selected=true',
  },
  communication: {
    collection: 'communications',
    titleField: doc => doc.subject || `${doc.type || 'communication'}`,
    subtitleFields: ['type', 'direction'],
    searchableFields: ['subject', 'content', 'from', 'to'],
    statusField: 'status',
    routeTemplate: '/crm/communications?communicationId={id}&selected=true',
  },
  task: {
    collection: 'tasks',
    titleField: 'title',
    subtitleFields: ['type', 'priority'],
    searchableFields: ['title', 'description'],
    statusField: 'status',
    routeTemplate: '/crm/tasks?taskId={id}&selected=true',
  },
};

async function backfillEntityType(entityType) {
  const config = ENTITY_CONFIGS[entityType];
  if (!config) {
    console.error(`❌ Unknown entity type: ${entityType}`);
    return { processed: 0, indexed: 0, skipped: 0, errors: 0 };
  }

  console.log(`\n📦 Processing ${entityType}...`);

  const snapshot = await db.collection(config.collection).get();
  console.log(`   Found ${snapshot.size} documents`);

  const stats = { processed: 0, indexed: 0, skipped: 0, errors: 0 };
  const batch = db.batch();
  let batchCount = 0;

  for (const doc of snapshot.docs) {
    stats.processed++;
    const data = doc.data();

    // Skip soft-deleted
    if (data.isDeleted === true || data.deletedAt) {
      stats.skipped++;
      continue;
    }

    // Get companyId (required)
    const companyId = data.companyId || data.tenantId;
    if (!companyId) {
      console.log(`   ⏭️ Skipped ${doc.id}: No companyId`);
      stats.skipped++;
      continue;
    }

    // Extract title
    const title = typeof config.titleField === 'function'
      ? config.titleField(data)
      : (data[config.titleField] || '');

    // Extract subtitle
    const subtitle = config.subtitleFields
      .map(f => data[f])
      .filter(Boolean)
      .join(' - ');

    // Extract searchable text
    const searchableText = config.searchableFields
      .map(f => data[f])
      .filter(v => typeof v === 'string' && v.trim())
      .join(' ');

    const normalizedText = normalizeSearchText(searchableText);
    const prefixes = generateSearchPrefixes(normalizedText);

    // Build search document
    const searchDoc = {
      tenantId: companyId,
      entityType,
      entityId: doc.id,
      title,
      subtitle,
      status: data[config.statusField] || 'active',
      search: { normalized: normalizedText, prefixes },
      audience: 'internal',
      requiredPermission: `crm:${entityType}s:view`,
      links: {
        href: config.routeTemplate.replace('{id}', doc.id),
        routeParams: { id: doc.id },
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      indexedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const searchDocId = `${entityType}_${doc.id}`;
    const searchDocRef = db.collection('searchDocuments').doc(searchDocId);

    batch.set(searchDocRef, searchDoc);
    batchCount++;
    stats.indexed++;

    // Commit every 500
    if (batchCount >= 500) {
      await batch.commit();
      console.log(`   ✅ Committed batch of ${batchCount} documents`);
      batchCount = 0;
    }
  }

  // Commit remaining
  if (batchCount > 0) {
    await batch.commit();
    console.log(`   ✅ Committed ${batchCount} documents`);
  }

  console.log(`   📊 ${entityType}: processed=${stats.processed}, indexed=${stats.indexed}, skipped=${stats.skipped}`);
  return stats;
}

async function main() {
  const args = process.argv.slice(2);
  const entityType = args[0];

  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  🔍 SEARCH INDEX BACKFILL');
  console.log('═══════════════════════════════════════════════════════════');

  const startTime = Date.now();
  const totalStats = { processed: 0, indexed: 0, skipped: 0, errors: 0 };

  if (entityType) {
    // Single entity type
    const stats = await backfillEntityType(entityType);
    Object.keys(totalStats).forEach(k => totalStats[k] += stats[k]);
  } else {
    // All CRM entity types
    for (const type of Object.keys(ENTITY_CONFIGS)) {
      const stats = await backfillEntityType(type);
      Object.keys(totalStats).forEach(k => totalStats[k] += stats[k]);
    }
  }

  const duration = Date.now() - startTime;

  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log(`  Total processed: ${totalStats.processed}`);
  console.log(`  Total indexed:   ${totalStats.indexed}`);
  console.log(`  Total skipped:   ${totalStats.skipped}`);
  console.log(`  Duration:        ${duration}ms`);
  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Backfill failed:', err.message);
    process.exit(1);
  });
