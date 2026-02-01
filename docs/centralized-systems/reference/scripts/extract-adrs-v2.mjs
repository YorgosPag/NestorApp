/**
 * ADR Extraction Script v2 - Improved Parsing
 *
 * Extracts individual ADRs from adr-index.md to separate files in the adrs/ folder.
 * This version improves content capture and category detection.
 *
 * Usage: node docs/centralized-systems/reference/scripts/extract-adrs-v2.mjs
 *
 * @author Γιώργος Παγώνης + Claude Code (Anthropic AI)
 * @date 2026-02-01
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Category detection patterns (ordered by specificity)
const CATEGORY_PATTERNS = [
  { pattern: /UI COMPONENTS/i, category: 'UI Components' },
  { pattern: /DESIGN SYSTEM/i, category: 'Design System' },
  { pattern: /CANVAS.*RENDERING/i, category: 'Canvas & Rendering' },
  { pattern: /DATA.*STATE/i, category: 'Data & State' },
  { pattern: /DRAWING SYSTEM/i, category: 'Drawing System' },
  { pattern: /SECURITY.*AUTH/i, category: 'Security & Auth' },
  { pattern: /BACKEND SYSTEMS/i, category: 'Backend Systems' },
  { pattern: /INFRASTRUCTURE/i, category: 'Infrastructure' },
  { pattern: /PERFORMANCE/i, category: 'Performance' },
  { pattern: /TOOLS.*KEYBOARD/i, category: 'Tools & Keyboard' },
  { pattern: /ENTITY SYSTEMS/i, category: 'Entity Systems' },
  { pattern: /FILTERS.*SEARCH/i, category: 'Filters & Search' },
];

// =============================================================================
// EXTRACTION FUNCTIONS
// =============================================================================

/**
 * Parse status from ADR content
 */
function parseStatus(content) {
  const statusPatterns = [
    /\*\*Status\*\*:\s*✅?\s*\*?\*?([^\n|*]+)/i,
    /Status:\s*✅?\s*([^\n|]+)/i,
  ];

  for (const pattern of statusPatterns) {
    const match = content.match(pattern);
    if (match) {
      let status = match[1].trim().replace(/\*\*/g, '').trim();
      if (status.includes('IMPLEMENTED')) return 'IMPLEMENTED';
      if (status.includes('APPROVED')) return 'APPROVED';
      if (status.includes('COMPLETED')) return 'COMPLETED';
      if (status.includes('PLANNING')) return 'PLANNING';
      if (status.includes('DEPRECATED')) return 'DEPRECATED';
      return status.toUpperCase();
    }
  }

  // Check content for status indicators
  if (content.includes('IMPLEMENTED')) return 'IMPLEMENTED';
  if (content.includes('APPROVED')) return 'APPROVED';
  if (content.includes('COMPLETED')) return 'COMPLETED';
  if (content.includes('PLANNING')) return 'PLANNING';

  return 'APPROVED';
}

/**
 * Parse date from ADR content
 */
function parseDate(content) {
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

  return '2026-01-01';
}

/**
 * Parse canonical location from ADR content
 */
function parseCanonical(content) {
  const canonicalPatterns = [
    /\*\*Canonical(?:\s+Location)?\*\*:\s*`([^`]+)`/i,
    /Canonical:\s*`([^`]+)`/i,
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
function normalizeAdrId(id) {
  return id.replace(/\./g, '-').toUpperCase();
}

/**
 * Generate filename from ADR ID and title
 */
function generateFilename(id, title) {
  const normalizedId = normalizeAdrId(id);
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);

  return `${normalizedId}-${slug}.md`;
}

/**
 * Format ADR content into standard template
 */
function formatAdrFile(adr) {
  const header = `# ${adr.id}: ${adr.title}

| Metadata | Value |
|----------|-------|
| **Status** | ${adr.status} |
| **Date** | ${adr.date} |
| **Category** | ${adr.category} |${adr.canonical ? `\n| **Canonical Location** | \`${adr.canonical}\` |` : ''}
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

`;

  // Clean and format content
  let content = adr.content.trim();

  // If content starts with bullet points, add a Summary section
  if (content.startsWith('- **')) {
    content = `## Summary\n\n${content}`;
  }

  return header + content + '\n';
}

/**
 * Extract ADRs from the index file using line-by-line parsing
 */
function extractAdrs(indexContent) {
  const adrs = [];
  const lines = indexContent.split('\n');

  let currentCategory = 'Uncategorized';
  let currentAdr = null;
  let contentLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for category headers (## 🎨 **UI COMPONENTS** etc.)
    const categoryMatch = line.match(/^##\s+[🎨📊🖼️✏️🔒🔧🛠️📂🔍⚡]\s*\*\*([^*]+)\*\*/);
    if (categoryMatch) {
      // Save previous ADR if exists
      if (currentAdr) {
        currentAdr.content = contentLines.join('\n').trim();
        adrs.push(currentAdr);
        currentAdr = null;
        contentLines = [];
      }

      const categoryText = categoryMatch[1].toUpperCase().trim();
      for (const { pattern, category } of CATEGORY_PATTERNS) {
        if (pattern.test(categoryText)) {
          currentCategory = category;
          break;
        }
      }
      continue;
    }

    // Check for new ADR header (### ADR-NNN: Title)
    const adrMatch = line.match(/^###\s+(ADR-[\w.-]+):\s*(.+)$/);
    if (adrMatch) {
      // Save previous ADR if exists
      if (currentAdr) {
        currentAdr.content = contentLines.join('\n').trim();
        adrs.push(currentAdr);
        contentLines = [];
      }

      const id = adrMatch[1];
      const title = adrMatch[2].trim();

      // Skip if already exists as separate file
      if (EXISTING_ADRS.has(id)) {
        currentAdr = null;
        continue;
      }

      currentAdr = {
        id,
        title,
        status: 'APPROVED',
        date: '2026-01-01',
        category: currentCategory,
        content: '',
        canonical: undefined,
      };
      continue;
    }

    // Check for new section (## that's not a category)
    if (line.match(/^##\s+/) && !line.includes('**')) {
      // Save previous ADR if exists
      if (currentAdr) {
        currentAdr.content = contentLines.join('\n').trim();
        adrs.push(currentAdr);
        currentAdr = null;
        contentLines = [];
      }
      continue;
    }

    // Accumulate content for current ADR
    if (currentAdr) {
      contentLines.push(line);
    }
  }

  // Don't forget the last ADR
  if (currentAdr) {
    currentAdr.content = contentLines.join('\n').trim();
    adrs.push(currentAdr);
  }

  // Post-process: extract status, date, canonical from content
  for (const adr of adrs) {
    adr.status = parseStatus(adr.content);
    adr.date = parseDate(adr.content);
    adr.canonical = parseCanonical(adr.content);
  }

  return adrs;
}

/**
 * Main extraction function
 */
async function main() {
  const result = {
    extracted: 0,
    skipped: 0,
    updated: 0,
    errors: [],
  };

  console.log('📋 ADR Extraction Script v2');
  console.log('===========================\n');

  // Read the index file
  if (!fs.existsSync(ADR_INDEX_PATH)) {
    console.error(`❌ Index file not found: ${ADR_INDEX_PATH}`);
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
  console.log(`🔍 Found ${adrs.length} ADRs to process\n`);

  // Write each ADR to a file
  for (const adr of adrs) {
    try {
      const filename = generateFilename(adr.id, adr.title);
      const filepath = path.join(ADRS_FOLDER, filename);
      const content = formatAdrFile(adr);

      // Check if file exists and compare
      if (fs.existsSync(filepath)) {
        const existingContent = fs.readFileSync(filepath, 'utf-8');
        if (existingContent.length < content.length) {
          // Update if new content is longer (more complete)
          fs.writeFileSync(filepath, content, 'utf-8');
          console.log(`🔄 Updated: ${filename} (+${content.length - existingContent.length} chars)`);
          result.updated++;
        } else {
          console.log(`⏭️  Skipping (no update needed): ${filename}`);
          result.skipped++;
        }
        continue;
      }

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
  console.log('\n===========================');
  console.log('📊 Summary:');
  console.log(`   ✅ Extracted: ${result.extracted}`);
  console.log(`   🔄 Updated: ${result.updated}`);
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
