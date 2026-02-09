/**
 * ============================================================================
 * ESCO Occupations Import Script (ADR-132)
 * ============================================================================
 *
 * Downloads ESCO occupations from the EU API and imports them into Firestore.
 *
 * Strategy: Uses `isInScheme` parameter to browse ALL occupations in the
 * concept scheme. Search results already contain `preferredLabel` in ALL
 * languages, so only ~6 paginated requests are needed (500/page × 2942 total).
 *
 * Usage:
 *   tsx scripts/import-esco-occupations.ts
 *
 * What it does:
 * 1. Paginates through all ESCO occupations via concept-scheme browsing
 * 2. Extracts bilingual labels (EL + EN) from search results directly
 * 3. Generates search tokens for prefix matching (accent-normalized)
 * 4. Batch writes to Firestore: system/esco_cache/occupations
 *
 * Requirements:
 * - Firebase Admin SDK (already available in project)
 * - Internet access (ESCO API is public, no API key needed)
 * - ADC or service account: `gcloud auth application-default login`
 *
 * Performance: ~6 API calls + ~8 Firestore batch writes = < 1 minute
 *
 * @see https://ec.europa.eu/esco/api/doc/esco_api_doc.html
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, WriteBatch } from 'firebase-admin/firestore';
import * as path from 'path';
import * as fs from 'fs';

// ============================================================================
// CONFIGURATION
// ============================================================================

const ESCO_API_BASE = 'https://ec.europa.eu/esco/api';
const ESCO_OCCUPATIONS_SCHEME = 'http://data.europa.eu/esco/concept-scheme/occupations';
const FIRESTORE_COLLECTION = 'system/esco_cache/occupations';
const BATCH_SIZE = 400; // Firestore max is 500, leave margin
const API_PAGE_SIZE = 500; // ESCO API supports up to 500
const API_DELAY_MS = 500; // Polite delay between API requests

// ============================================================================
// TYPES
// ============================================================================

interface EscoSearchResult {
  uri: string;
  title: string;
  className: string;
  classId: string;
  code?: string;
  preferredLabel: Record<string, string>;
  broaderIscoGroup?: string[];
  broaderOccupation?: string[];
  isTopConceptInScheme?: string[];
  _links: {
    self: { href: string; uri: string; title: string };
  };
}

interface EscoSearchResponse {
  total: number;
  offset: number;
  limit: number;
  _embedded?: {
    results?: EscoSearchResult[];
  };
}

interface OccupationDocument {
  uri: string;
  iscoCode: string;
  iscoGroup: string;
  preferredLabel: { el: string; en: string };
  alternativeLabels: { el: string[]; en: string[] };
  searchTokensEl: string[];
  searchTokensEn: string[];
  updatedAt: Date;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate PREFIX search tokens from a label for Firestore array-contains matching.
 *
 * Firestore `array-contains` requires EXACT element match, so we generate
 * all prefixes of each word (min 2 chars) to enable autocomplete.
 *
 * Example: "φαρμακοποιός" → ["φα", "φαρ", "φαρμ", "φαρμα", "φαρμακ", "φαρμακο",
 *   "φαρμακοπ", "φαρμακοπο", "φαρμακοποι", "φαρμακοποιο", "φαρμακοποιος"]
 */
function generateSearchTokens(label: string, altLabels: string[] = []): string[] {
  const allText = [label, ...altLabels].join(' ');

  // Remove accents/diacritics (critical for Greek: ά→α, έ→ε, etc.)
  const normalized = allText.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Split into words, lowercase, filter very short words
  const words = normalized
    .toLowerCase()
    .split(/[\s,.\-/()]+/)
    .filter(word => word.length >= 2);

  // Generate prefix tokens for each word (min 2 chars)
  const prefixSet = new Set<string>();
  for (const word of words) {
    for (let i = 2; i <= word.length; i++) {
      prefixSet.add(word.substring(0, i));
    }
  }

  return Array.from(prefixSet);
}

/**
 * Extract ISCO-08 4-digit code from the ESCO `code` field.
 * ESCO code format: "2142.1.9" → ISCO code: "2142"
 */
function extractIscoCode(code: string | undefined): string {
  if (!code) return '0000';
  const parts = code.split('.');
  return parts[0] || '0000';
}

/**
 * Polite delay between API requests.
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a safe Firestore document ID from an ESCO URI.
 * Extracts the UUID part from URIs like:
 * "http://data.europa.eu/esco/occupation/fbceeac6-798b-4307-a825-626707a753ad"
 */
function uriToDocId(uri: string): string {
  const match = uri.match(/\/([a-f0-9-]+)$/i);
  if (match) return match[1];

  // Fallback: sanitize the full URI path
  return uri
    .replace('http://data.europa.eu/esco/occupation/', '')
    .replace(/[^a-zA-Z0-9-]/g, '_');
}

// ============================================================================
// ESCO API CLIENT
// ============================================================================

/**
 * Fetch ALL ESCO occupations by browsing the concept scheme.
 *
 * Uses `isInScheme` parameter to list all occupations without needing
 * a search term. Each result already contains `preferredLabel` in ALL
 * EU languages — no per-occupation detail requests needed.
 */
async function fetchAllOccupations(): Promise<EscoSearchResult[]> {
  const allResults: EscoSearchResult[] = [];
  let page = 0;
  let totalItems = 1; // Updated after first request
  const totalPages = () => Math.ceil(totalItems / API_PAGE_SIZE);

  console.log('\n📥 Fetching ALL ESCO occupations via concept-scheme browsing...');

  while (page < totalPages()) {
    // ESCO API uses page-based offset (0=first page, 1=second page, etc.)
    const url = `${ESCO_API_BASE}/search?type=occupation&language=en&offset=${page}&limit=${API_PAGE_SIZE}&isInScheme=${encodeURIComponent(ESCO_OCCUPATIONS_SCHEME)}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`API error ${response.status}: ${response.statusText}`);
      }

      const data: EscoSearchResponse = await response.json();
      totalItems = data.total;

      const results = data._embedded?.results ?? [];
      allResults.push(...results);

      page++;
      const pct = Math.round((allResults.length / totalItems) * 100);
      console.log(`  📊 Page ${page}/${totalPages()}: ${allResults.length}/${totalItems} occupations (${pct}%)`);

    } catch (error) {
      console.error(`  ❌ Error at page ${page}:`, error);
      page++; // Skip to next page
    }

    await delay(API_DELAY_MS);
  }

  console.log(`  ✅ Fetched ${allResults.length} occupations total`);
  return allResults;
}

/**
 * Transform raw API results into Firestore-ready documents.
 * Extracts EL + EN labels from the already-bilingual search results.
 */
function transformToDocuments(results: EscoSearchResult[]): OccupationDocument[] {
  console.log('\n🔀 Transforming occupations to Firestore documents...');

  const documents: OccupationDocument[] = [];
  let missingEl = 0;
  let missingEn = 0;

  for (const result of results) {
    const elLabel = result.preferredLabel?.el ?? '';
    const enLabel = result.preferredLabel?.en ?? '';

    if (!elLabel) missingEl++;
    if (!enLabel) missingEn++;

    // Skip occupations without ANY label
    if (!elLabel && !enLabel) continue;

    const iscoCode = extractIscoCode(result.code);
    const iscoGroup = iscoCode.length >= 3 ? iscoCode.substring(0, 3) : iscoCode;

    const doc: OccupationDocument = {
      uri: result.uri,
      iscoCode,
      iscoGroup,
      preferredLabel: {
        el: elLabel,
        en: enLabel,
      },
      // Search results don't include alternative labels — empty for now
      // Can be enriched later with individual detail requests if needed
      alternativeLabels: { el: [], en: [] },
      searchTokensEl: generateSearchTokens(elLabel),
      searchTokensEn: generateSearchTokens(enLabel),
      updatedAt: new Date(),
    };

    documents.push(doc);
  }

  console.log(`  ✅ Transformed ${documents.length} occupations`);
  if (missingEl > 0) console.log(`  ⚠️  ${missingEl} occupations missing Greek label`);
  if (missingEn > 0) console.log(`  ⚠️  ${missingEn} occupations missing English label`);

  return documents;
}

// ============================================================================
// FIRESTORE WRITER
// ============================================================================

/**
 * Write occupation documents to Firestore in batches.
 */
async function writeToFirestore(
  db: FirebaseFirestore.Firestore,
  documents: OccupationDocument[]
): Promise<void> {
  console.log(`\n📤 Writing ${documents.length} occupations to Firestore...`);
  console.log(`  📍 Collection: ${FIRESTORE_COLLECTION}`);

  let written = 0;
  let batchCount = 0;

  for (let i = 0; i < documents.length; i += BATCH_SIZE) {
    const batch: WriteBatch = db.batch();
    const chunk = documents.slice(i, i + BATCH_SIZE);

    for (const doc of chunk) {
      const docId = uriToDocId(doc.uri);
      const docRef = db.collection(FIRESTORE_COLLECTION).doc(docId);
      batch.set(docRef, doc, { merge: true });
    }

    await batch.commit();
    written += chunk.length;
    batchCount++;
    console.log(`  📦 Batch ${batchCount}: ${written}/${documents.length} written`);
  }

  console.log(`  ✅ All ${written} occupations written to Firestore`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  console.log('====================================================');
  console.log('🇪🇺 ESCO Professional Classification Import (ADR-132)');
  console.log('====================================================');
  console.log(`📅 Date: ${new Date().toISOString()}`);
  console.log(`📍 Target: ${FIRESTORE_COLLECTION}`);
  console.log(`📡 Strategy: Concept-scheme browsing (fast, ~6 API calls)`);

  // Initialize Firebase Admin
  const serviceAccountPath = path.resolve(
    process.cwd(),
    process.env.GOOGLE_APPLICATION_CREDENTIALS ?? 'serviceAccountKey.json'
  );

  if (!getApps().length) {
    if (fs.existsSync(serviceAccountPath)) {
      initializeApp({
        credential: cert(serviceAccountPath),
      });
      console.log(`\n🔑 Firebase Admin initialized with: ${serviceAccountPath}`);
    } else {
      // Try Application Default Credentials (gcloud auth application-default login)
      initializeApp();
      console.log('\n🔑 Firebase Admin initialized with default credentials (ADC)');
    }
  }

  const db = getFirestore();

  // Step 1: Fetch all occupations (single paginated request series)
  const startFetch = Date.now();
  const rawResults = await fetchAllOccupations();
  const fetchDuration = ((Date.now() - startFetch) / 1000).toFixed(1);
  console.log(`  ⏱️  Fetch completed in ${fetchDuration}s`);

  // Step 2: Transform to Firestore documents
  const documents = transformToDocuments(rawResults);

  // Step 3: Write to Firestore
  const startWrite = Date.now();
  await writeToFirestore(db, documents);
  const writeDuration = ((Date.now() - startWrite) / 1000).toFixed(1);
  console.log(`  ⏱️  Write completed in ${writeDuration}s`);

  // Step 4: Summary
  const totalDuration = ((Date.now() - startFetch) / 1000).toFixed(1);
  console.log('\n====================================================');
  console.log('✅ IMPORT COMPLETE');
  console.log('====================================================');
  console.log(`📊 Total occupations: ${documents.length}`);
  console.log(`📍 Collection: ${FIRESTORE_COLLECTION}`);
  console.log(`⏱️  Total duration: ${totalDuration}s`);
  console.log(`📡 API calls: ~${Math.ceil(rawResults.length / API_PAGE_SIZE)}`);
  console.log('');
  console.log('Next steps:');
  console.log('  1. Deploy Firestore indexes: firebase deploy --only firestore:indexes');
  console.log('  2. Verify in Firebase Console: Firestore → system → esco_cache → occupations');
  console.log('  3. Test search in the application');
}

main().catch((error) => {
  console.error('❌ Import failed:', error);
  process.exit(1);
});
