/**
 * ADR Extraction Script
 *
 * Extracts individual ADRs from adr-index.md to separate files in the adrs/ folder.
 *
 * Usage: npx ts-node docs/centralized-systems/reference/scripts/extract-adrs.ts
 *
 * @author Γιώργος Παγώνης + Claude Code (Anthropic AI)
 * @date 2026-02-01
 */

import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// CONFIGURATION
// =============================================================================

const ADR_INDEX_PATH = path.join(__dirname, '..', 'adr-index.md');
const ADRS_FOLDER = path.join(__dirname, '..', 'adrs');

// ADRs that already exist as separate files (skip extraction)
const EXISTING_ADRS = new Set([
  'ADR-048',
  'ADR-059',
  'ADR-060',
  'ADR-061',
  'ADR-062',
  'ADR-063',
  'ADR-UI-001',
]);

// Category mapping based on section headers
const CATEGORY_MAP: Record<string, string> = {
  'UI COMPONENTS': 'UI Components',
  'DESIGN SYSTEM': 'Design System',
  'CANVAS & RENDERING': 'Canvas & Rendering',
  'DATA & STATE MANAGEMENT': 'Data & State',
  'DRAWING SYSTEM': 'Drawing System',
  'SECURITY & AUTHENTICATION': 'Security & Auth',
  'BACKEND SYSTEMS': 'Backend Systems',
  'INFRASTRUCTURE': 'Infrastructure',
  'PERFORMANCE': 'Performance',
  'TOOLS & KEYBOARD': 'Tools & Keyboard',
  'ENTITY SYSTEMS': 'Entity Systems',
  'FILTERS & SEARCH': 'Filters & Search',
};

// =============================================================================
// TYPES
// =============================================================================

interface ADRData {
  id: string;
  title: string;
  status: string;
  date: string;
  category: string;
  content: string;
  canonical?: string;
}

interface ExtractionResult {
  extracted: number;
  skipped: number;
  errors: string[];
}

// =============================================================================
// EXTRACTION FUNCTIONS
// =============================================================================

/**
 * Parse status from ADR content
 */
function parseStatus(content: string): string {
  // Look for explicit status patterns
  const statusPatterns = [
    /\*\*Status\*\*:\s*([^\n|]+)/i,
    /Status:\s*([^\n|]+)/i,
    /✅\s*(APPROVED|IMPLEMENTED|COMPLETED)/i,
    /📋\s*(PLANNING)/i,
  ];

  for (const pattern of statusPatterns) {
    const match = content.match(pattern);
    if (match) {
      const status = match[1].trim().replace(/\*\*/g, '').replace(/[✅📋]/g, '').trim();
      return status.toUpperCase();
    }
  }

  // Check in first lines for status indicators
  const firstLines = content.split('\n').slice(0, 5).join(' ');
  if (firstLines.includes('IMPLEMENTED')) return 'IMPLEMENTED';
  if (firstLines.includes('APPROVED')) return 'APPROVED';
  if (firstLines.includes('COMPLETED')) return 'COMPLETED';
  if (firstLines.includes('PLANNING')) return 'PLANNING';
  if (firstLines.includes('DEPRECATED')) return 'DEPRECATED';

  return 'APPROVED'; // Default
}

/**
 * Parse date from ADR content
 */
function parseDate(content: string): string {
  // Look for explicit date patterns
  const datePatterns = [
    /\*\*Date\*\*:\s*(\d{4}-\d{2}-\d{2})/,
    /Date:\s*(\d{4}-\d{2}-\d{2})/,
    /\((\d{4}-\d{2}-\d{2})\)/,
    /(\d{4}-\d{2}-\d{2})/,
  ];

  for (const pattern of datePatterns) {
    const match = content.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return '2026-01-01'; // Default
}

/**
 * Parse canonical location from ADR content
 */
function parseCanonical(content: string): string | undefined {
  const canonicalPatterns = [
    /\*\*Canonical\*\*:\s*`([^`]+)`/i,
    /Canonical:\s*`([^`]+)`/i,
    /\*\*Canonical Location\*\*:\s*`([^`]+)`/i,
  ];

  for (const pattern of canonicalPatterns) {
    const match = content.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return undefined;
}

/**
 * Normalize ADR ID
 */
function normalizeAdrId(id: string): string {
  // Handle special cases like ADR-018.1
  return id.replace(/\./g, '-').toUpperCase();
}

/**
 * Generate filename from ADR ID and title
 */
function generateFilename(id: string, title: string): string {
  const normalizedId = normalizeAdrId(id);
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50); // Limit length

  return `${normalizedId}-${slug}.md`;
}

/**
 * Format ADR content into standard template
 */
function formatAdrFile(adr: ADRData): string {
  const header = `# ${adr.id}: ${adr.title}

| Metadata | Value |
|----------|-------|
| **Status** | ${adr.status} |
| **Date** | ${adr.date} |
| **Category** | ${adr.category} |${adr.canonical ? `\n| **Canonical Location** | \`${adr.canonical}\` |` : ''}
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

`;

  // Clean up the content
  let content = adr.content
    // Remove the original header (we've added a new one)
    .replace(/^###?\s*ADR-[^\n]+\n/, '')
    // Remove leading/trailing whitespace
    .trim();

  // Add section headers if missing
  if (!content.includes('## ') && !content.includes('### ')) {
    // Convert bullet points to sections if possible
    if (content.startsWith('- **')) {
      content = `## Summary\n\n${content}`;
    }
  }

  return header + content + '\n';
}

/**
 * Extract ADRs from the index file
 */
function extractAdrs(indexContent: string): ADRData[] {
  const adrs: ADRData[] = [];
  let currentCategory = 'Uncategorized';

  // Split by section headers
  const sections = indexContent.split(/^## /gm);

  for (const section of sections) {
    // Check if this is a category section
    const categoryMatch = section.match(/^[🎨📊🖼️✏️🔒🔧🛠️📂🔍⚡]\s*\*\*([^*]+)\*\*/);
    if (categoryMatch) {
      const categoryKey = categoryMatch[1].toUpperCase().trim();
      currentCategory = CATEGORY_MAP[categoryKey] || categoryKey;
    }

    // Find ADR entries (### ADR-NNN: Title)
    const adrRegex = /^### (ADR-[\w.-]+):\s*([^\n]+)\n([\s\S]*?)(?=^### ADR-|^## |$)/gm;
    let match;

    while ((match = adrRegex.exec(section)) !== null) {
      const id = match[1];
      const title = match[2].trim();
      const content = match[3].trim();

      // Skip if already exists as separate file
      if (EXISTING_ADRS.has(id)) {
        continue;
      }

      const adrData: ADRData = {
        id,
        title,
        status: parseStatus(content),
        date: parseDate(content),
        category: currentCategory,
        content,
        canonical: parseCanonical(content),
      };

      adrs.push(adrData);
    }
  }

  return adrs;
}

/**
 * Main extraction function
 */
async function main(): Promise<ExtractionResult> {
  const result: ExtractionResult = {
    extracted: 0,
    skipped: 0,
    errors: [],
  };

  console.log('📋 ADR Extraction Script');
  console.log('========================\n');

  // Read the index file
  if (!fs.existsSync(ADR_INDEX_PATH)) {
    result.errors.push(`Index file not found: ${ADR_INDEX_PATH}`);
    return result;
  }

  const indexContent = fs.readFileSync(ADR_INDEX_PATH, 'utf-8');
  console.log(`📖 Reading from: ${ADR_INDEX_PATH}`);
  console.log(`📁 Output folder: ${ADRS_FOLDER}\n`);

  // Ensure output folder exists
  if (!fs.existsSync(ADRS_FOLDER)) {
    fs.mkdirSync(ADRS_FOLDER, { recursive: true });
  }

  // Extract ADRs
  const adrs = extractAdrs(indexContent);
  console.log(`🔍 Found ${adrs.length} ADRs to extract\n`);

  // Write each ADR to a file
  for (const adr of adrs) {
    try {
      const filename = generateFilename(adr.id, adr.title);
      const filepath = path.join(ADRS_FOLDER, filename);

      // Skip if file already exists
      if (fs.existsSync(filepath)) {
        console.log(`⏭️  Skipping (exists): ${filename}`);
        result.skipped++;
        continue;
      }

      const content = formatAdrFile(adr);
      fs.writeFileSync(filepath, content, 'utf-8');
      console.log(`✅ Extracted: ${filename}`);
      result.extracted++;
    } catch (error) {
      const errorMsg = `Error extracting ${adr.id}: ${error}`;
      result.errors.push(errorMsg);
      console.error(`❌ ${errorMsg}`);
    }
  }

  // Summary
  console.log('\n========================');
  console.log('📊 Summary:');
  console.log(`   ✅ Extracted: ${result.extracted}`);
  console.log(`   ⏭️  Skipped: ${result.skipped}`);
  console.log(`   ❌ Errors: ${result.errors.length}`);

  if (result.errors.length > 0) {
    console.log('\n⚠️ Errors:');
    result.errors.forEach(e => console.log(`   - ${e}`));
  }

  return result;
}

// Run the script
main().catch(console.error);
