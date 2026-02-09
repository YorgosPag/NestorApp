/**
 * ============================================================================
 * ESCO Occupations Import Script (ADR-034)
 * ============================================================================
 *
 * Downloads ESCO occupations from the EU API and imports them into Firestore.
 *
 * Usage:
 *   npx tsx scripts/import-esco-occupations.ts
 *
 * What it does:
 * 1. Fetches all ESCO occupations via the REST API (EL + EN)
 * 2. Merges bilingual labels into unified documents
 * 3. Generates search tokens for prefix matching
 * 4. Batch writes to Firestore: system/esco_cache/occupations
 *
 * Requirements:
 * - Firebase Admin SDK (already available in project)
 * - Internet access (ESCO API is public, no API key needed)
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
const FIRESTORE_COLLECTION = 'system/esco_cache/occupations';
const BATCH_SIZE = 400; // Firestore max is 500, leave margin
const API_PAGE_SIZE = 100; // ESCO API max per request
const API_DELAY_MS = 200; // Polite delay between API requests

// ============================================================================
// TYPES
// ============================================================================

interface EscoApiSearchResult {
  _embedded?: {
    results?: Array<{
      uri: string;
      title: string;
      className: string;
    }>;
  };
  total: number;
  offset: number;
  limit: number;
}

interface EscoApiOccupation {
  uri: string;
  title: string;
  preferredLabel?: Record<string, string>;
  alternativeLabel?: Record<string, string[]>;
  description?: Record<string, { literal: string }>;
  hasTopConcept?: Array<{ uri: string; title: string }>;
  broaderIscoGroup?: Array<{ uri: string; title: string }>;
  _links?: {
    iscoGroup?: { href: string; uri: string; title: string };
    broaderIscoGroup?: Array<{ href: string; uri: string; title: string }>;
  };
}

interface MergedOccupation {
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
 * Generate search tokens from a label for prefix matching.
 * Splits into words, lowercases, removes accents for Greek text.
 */
function generateSearchTokens(label: string, altLabels: string[] = []): string[] {
  const allText = [label, ...altLabels].join(' ');

  // Remove accents/diacritics (important for Greek)
  const normalized = allText.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Split into words, lowercase, filter short words
  const tokens = normalized
    .toLowerCase()
    .split(/[\s,.\-/()]+/)
    .filter(token => token.length >= 2)
    .filter((token, index, arr) => arr.indexOf(token) === index); // unique

  return tokens;
}

/**
 * Extract ISCO-08 code from ESCO URI or broaderIscoGroup.
 */
function extractIscoCode(occupation: EscoApiOccupation): string {
  // Try _links.iscoGroup or broaderIscoGroup
  const iscoGroupUri =
    occupation._links?.iscoGroup?.uri ??
    occupation._links?.broaderIscoGroup?.[0]?.uri ??
    occupation.broaderIscoGroup?.[0]?.uri ??
    '';

  // Extract code from URI like "http://data.europa.eu/esco/isco/C2142"
  const match = iscoGroupUri.match(/C(\d{1,4})$/);
  return match ? match[1] : '0000';
}

/**
 * Polite delay between API requests.
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a safe document ID from a URI.
 */
function uriToDocId(uri: string): string {
  // Extract the UUID part from the URI
  const match = uri.match(/\/([a-f0-9-]+)$/i);
  if (match) return match[1];

  // Fallback: replace special chars
  return uri
    .replace('http://data.europa.eu/esco/occupation/', '')
    .replace(/[^a-zA-Z0-9-]/g, '_');
}

// ============================================================================
// ESCO API CLIENT
// ============================================================================

/**
 * Fetch all ESCO occupations in a specific language.
 */
async function fetchAllOccupations(language: 'el' | 'en'): Promise<Map<string, EscoApiOccupation>> {
  const occupations = new Map<string, EscoApiOccupation>();
  let offset = 0;
  let total = 1; // Will be updated after first request

  console.log(`\n📥 Fetching ESCO occupations (${language.toUpperCase()})...`);

  while (offset < total) {
    const url = `${ESCO_API_BASE}/search?text=*&type=occupation&language=${language}&offset=${offset}&limit=${API_PAGE_SIZE}&selectedVersion=v1.2.0`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`API error ${response.status}: ${response.statusText}`);
      }

      const data: EscoApiSearchResult = await response.json();
      total = data.total;

      const results = data._embedded?.results ?? [];
      for (const result of results) {
        // Fetch full occupation details
        const detailUrl = `${ESCO_API_BASE}/resource/occupation?uri=${encodeURIComponent(result.uri)}&language=${language}&selectedVersion=v1.2.0`;
        const detailResponse = await fetch(detailUrl);

        if (detailResponse.ok) {
          const occupation: EscoApiOccupation = await detailResponse.json();
          occupations.set(result.uri, occupation);
        }

        await delay(API_DELAY_MS);
      }

      offset += results.length;
      console.log(`  📊 Progress: ${offset}/${total} occupations (${language.toUpperCase()})`);

    } catch (error) {
      console.error(`  ❌ Error at offset ${offset}:`, error);
      // Continue with next batch
      offset += API_PAGE_SIZE;
    }

    await delay(API_DELAY_MS);
  }

  console.log(`  ✅ Fetched ${occupations.size} occupations (${language.toUpperCase()})`);
  return occupations;
}

/**
 * Merge Greek and English occupation data into unified documents.
 */
function mergeOccupations(
  elOccupations: Map<string, EscoApiOccupation>,
  enOccupations: Map<string, EscoApiOccupation>
): MergedOccupation[] {
  console.log('\n🔀 Merging bilingual occupation data...');

  const merged: MergedOccupation[] = [];
  const allUris = new Set([...elOccupations.keys(), ...enOccupations.keys()]);

  for (const uri of allUris) {
    const elOcc = elOccupations.get(uri);
    const enOcc = enOccupations.get(uri);

    // Need at least one language
    const baseOcc = elOcc ?? enOcc;
    if (!baseOcc) continue;

    const iscoCode = extractIscoCode(baseOcc);
    const iscoGroup = iscoCode.length >= 3 ? iscoCode.substring(0, 3) : iscoCode;

    const elLabel = elOcc?.preferredLabel?.el ?? elOcc?.title ?? '';
    const enLabel = enOcc?.preferredLabel?.en ?? enOcc?.title ?? '';

    const elAltLabels = elOcc?.alternativeLabel?.el ?? [];
    const enAltLabels = enOcc?.alternativeLabel?.en ?? [];

    const occupation: MergedOccupation = {
      uri,
      iscoCode,
      iscoGroup,
      preferredLabel: {
        el: elLabel,
        en: enLabel,
      },
      alternativeLabels: {
        el: elAltLabels,
        en: enAltLabels,
      },
      searchTokensEl: generateSearchTokens(elLabel, elAltLabels),
      searchTokensEn: generateSearchTokens(enLabel, enAltLabels),
      updatedAt: new Date(),
    };

    merged.push(occupation);
  }

  console.log(`  ✅ Merged ${merged.length} occupations`);
  return merged;
}

// ============================================================================
// FIRESTORE WRITER
// ============================================================================

/**
 * Write merged occupations to Firestore in batches.
 */
async function writeToFirestore(
  db: FirebaseFirestore.Firestore,
  occupations: MergedOccupation[]
): Promise<void> {
  console.log(`\n📤 Writing ${occupations.length} occupations to Firestore...`);
  console.log(`  📍 Collection: ${FIRESTORE_COLLECTION}`);

  let written = 0;
  let batchCount = 0;

  for (let i = 0; i < occupations.length; i += BATCH_SIZE) {
    const batch: WriteBatch = db.batch();
    const chunk = occupations.slice(i, i + BATCH_SIZE);

    for (const occupation of chunk) {
      const docId = uriToDocId(occupation.uri);
      const docRef = db.collection(FIRESTORE_COLLECTION).doc(docId);
      batch.set(docRef, occupation, { merge: true });
    }

    await batch.commit();
    written += chunk.length;
    batchCount++;
    console.log(`  📦 Batch ${batchCount}: ${written}/${occupations.length} written`);
  }

  console.log(`  ✅ All ${written} occupations written to Firestore`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  console.log('====================================================');
  console.log('🇪🇺 ESCO Professional Classification Import');
  console.log('====================================================');
  console.log(`📅 Date: ${new Date().toISOString()}`);
  console.log(`📍 Target: ${FIRESTORE_COLLECTION}`);

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
      // Try default credentials (ADC)
      initializeApp();
      console.log('\n🔑 Firebase Admin initialized with default credentials');
    }
  }

  const db = getFirestore();

  // Step 1: Fetch occupations in both languages
  const elOccupations = await fetchAllOccupations('el');
  const enOccupations = await fetchAllOccupations('en');

  // Step 2: Merge bilingual data
  const merged = mergeOccupations(elOccupations, enOccupations);

  // Step 3: Write to Firestore
  await writeToFirestore(db, merged);

  // Step 4: Summary
  console.log('\n====================================================');
  console.log('✅ IMPORT COMPLETE');
  console.log('====================================================');
  console.log(`📊 Total occupations: ${merged.length}`);
  console.log(`📍 Collection: ${FIRESTORE_COLLECTION}`);
  console.log(`🇬🇷 Greek labels: ${elOccupations.size}`);
  console.log(`🇬🇧 English labels: ${enOccupations.size}`);
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
