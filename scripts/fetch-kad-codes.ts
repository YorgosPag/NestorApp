/**
 * @fileoverview One-time script to fetch Greek ΚΑΔ (Activity Codes) from forin.gr API
 * @description Fetches paginated data from forin.gr DataTables API and outputs a TypeScript file.
 *
 * Usage:
 *   npx tsx scripts/fetch-kad-codes.ts
 *
 * Output:
 *   src/subapps/accounting/data/greek-kad-codes.ts
 *
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-10
 * @see ADR-ACC-013 Searchable ΔΟΥ + ΚΑΔ Dropdowns
 */

import { writeFileSync } from 'fs';
import { join } from 'path';

// ============================================================================
// TYPES
// ============================================================================

interface ForinKadResponse {
  iTotalRecords: number;
  iTotalDisplayRecords: number;
  aaData: string[][];
}

interface KadCode {
  code: string;
  description: string;
}

// ============================================================================
// FETCH LOGIC
// ============================================================================

const API_URL = 'https://www.forin.gr/tools/kad/kads';
const PAGE_SIZE = 500; // forin.gr uses legacy DataTables — keep pages reasonable

async function fetchPage(start: number): Promise<ForinKadResponse> {
  // forin.gr uses legacy DataTables 1.9 params (iDisplayStart/iDisplayLength)
  const params = new URLSearchParams({
    sEcho: '1',
    iDisplayStart: String(start),
    iDisplayLength: String(PAGE_SIZE),
    sSearch: '',
  });

  const response = await fetch(`${API_URL}?${params.toString()}`, {
    headers: {
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json() as Promise<ForinKadResponse>;
}

async function fetchAllKadCodes(): Promise<KadCode[]> {
  const allCodes: KadCode[] = [];
  let start = 0;
  let total = Infinity;

  console.log('Fetching ΚΑΔ codes from forin.gr...');

  while (start < total) {
    const page = await fetchPage(start);
    total = page.iTotalRecords;

    for (const row of page.aaData) {
      // row[0] = code (may contain HTML), row[1] = description HTML with nested <li> elements
      const code = stripHtml(row[0]).trim();
      // Extract the last <li> content as the most specific description
      const description = extractLastLi(row[1]);
      if (code && description) {
        allCodes.push({ code, description });
      }
    }

    start += PAGE_SIZE;
    console.log(`  Fetched ${Math.min(start, total)} / ${total}`);

    // Rate limiting — be kind to forin.gr
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return allCodes;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
}

function extractLastLi(html: string): string {
  // The API returns nested <ul><li>...</li></ul> — the last <li> has the most specific description
  const liMatches = html.match(/<li[^>]*>(.*?)<\/li>/g);
  if (!liMatches || liMatches.length === 0) return stripHtml(html).trim();
  const lastLi = liMatches[liMatches.length - 1];
  return stripHtml(lastLi).trim();
}

// ============================================================================
// OUTPUT
// ============================================================================

function generateTypeScriptFile(codes: KadCode[]): string {
  const lines = codes.map(
    (c) => `  { code: '${c.code}', description: '${c.description.replace(/'/g, "\\'")}' },`,
  );

  return `/**
 * @fileoverview Greek ΚΑΔ (Activity Codes) — NACE Rev.2
 * @description Auto-generated from forin.gr API. ${codes.length} κωδικοί δραστηριότητας.
 * @generated ${new Date().toISOString().split('T')[0]}
 * @see ADR-ACC-013 Searchable ΔΟΥ + ΚΑΔ Dropdowns
 */

export interface KadCode {
  /** ΚΑΔ code (e.g. "41.20.20") */
  code: string;
  /** Greek description */
  description: string;
}

export const GREEK_KAD_CODES: KadCode[] = [
${lines.join('\n')}
];
`;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  try {
    const codes = await fetchAllKadCodes();
    console.log(`\nTotal ΚΑΔ codes fetched: ${codes.length}`);

    const outputPath = join(__dirname, '..', 'src', 'subapps', 'accounting', 'data', 'greek-kad-codes.ts');
    const content = generateTypeScriptFile(codes);
    writeFileSync(outputPath, content, 'utf-8');

    console.log(`\nOutput written to: ${outputPath}`);
    console.log(`File size: ${(Buffer.byteLength(content) / 1024).toFixed(1)} KB`);
  } catch (error) {
    console.error('Failed to fetch ΚΑΔ codes:', error);
    process.exit(1);
  }
}

main();
