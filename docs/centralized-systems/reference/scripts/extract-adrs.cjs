/**
 * ADR Extraction Script (CommonJS version)
 *
 * Extracts individual ADRs from adr-index.md to separate files in the adrs/ folder.
 *
 * Usage: node docs/centralized-systems/reference/scripts/extract-adrs.cjs
 *
 * @author Γιώργος Παγώνης + Claude Code (Anthropic AI)
 * @date 2026-02-01
 */

const fs = require('fs');
const path = require('path');

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

// Category detection based on content location
const CATEGORY_SECTIONS = {
  'UI COMPONENTS': 'UI Components',
  'DESIGN SYSTEM': 'Design System',
  'CANVAS & RENDERING': 'Canvas & Rendering',
  'DATA & STATE MANAGEMENT': 'Data & State',
  'DATA & STATE': 'Data & State',
  'DRAWING SYSTEM': 'Drawing System',
  'SECURITY & AUTHENTICATION': 'Security & Auth',
  'SECURITY & AUTH': 'Security & Auth',
  'BACKEND SYSTEMS': 'Backend Systems',
  'INFRASTRUCTURE': 'Infrastructure',
  'PERFORMANCE': 'Performance',
  'TOOLS & KEYBOARD': 'Tools & Keyboard',
  'ENTITY SYSTEMS': 'Entity Systems',
  'FILTERS & SEARCH': 'Filters & Search',
};

// =============================================================================
// EXTRACTION FUNCTIONS
// =============================================================================

function parseStatus(content) {
  if (content.includes('IMPLEMENTED')) return 'IMPLEMENTED';
  if (content.includes('APPROVED')) return 'APPROVED';
  if (content.includes('COMPLETED')) return 'COMPLETED';
  if (content.includes('PLANNING')) return 'PLANNING';
  if (content.includes('DEPRECATED')) return 'DEPRECATED';
  return 'APPROVED';
}

function parseDate(content) {
  const patterns = [
    /\*\*Date\*\*:\s*(\d{4}-\d{2}-\d{2})/,
    /Date:\s*(\d{4}-\d{2}-\d{2})/,
    /\((\d{4}-\d{2}-\d{2})\)/,
    /(\d{4}-\d{2}-\d{2})/,
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) return match[1];
  }
  return '2026-01-01';
}

function parseCanonical(content) {
  const patterns = [
    /\*\*Canonical(?:\s*Location)?\*\*:\s*`([^`]+)`/i,
    /Canonical:\s*`([^`]+)`/i,
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) return match[1];
  }
  return undefined;
}

function normalizeAdrId(id) {
  return id.replace(/\./g, '-').toUpperCase();
}

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

function formatAdrFile(adr) {
  const header = `# ${adr.id}: ${adr.title}

| Metadata | Value |
|----------|-------|
| **Status** | ${adr.status} |
| **Date** | ${adr.date} |
| **Category** | ${adr.category} |${adr.canonical ? `
| **Canonical Location** | \`${adr.canonical}\` |` : ''}
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

`;

  let content = adr.content.trim();

  // Add Summary section if content starts with bullet points
  if (content.startsWith('- **')) {
    content = `## Summary\n\n${content}`;
  }

  return header + content + '\n';
}

function extractAdrs(indexContent) {
  const adrs = [];
  // Normalize line endings (Windows \r\n → Unix \n)
  const normalizedContent = indexContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalizedContent.split('\n');

  let currentCategory = 'Uncategorized';
  let currentAdr = null;
  let contentLines = [];
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect COMPLETE ADR TABLE section and skip it
    if (line.includes('COMPLETE ADR TABLE')) {
      inTable = true;
      continue;
    }

    // Exit table when we hit next section
    if (inTable && line.match(/^##\s+[🎨📊🖼️✏️🔒🔧🛠️📂🔍⚡]/)) {
      inTable = false;
    }

    if (inTable) continue;

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
      currentCategory = CATEGORY_SECTIONS[categoryText] || categoryText;
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

    // Check for new section (## that ends the current category)
    if (line.match(/^##\s+/) && currentAdr) {
      // Don't end on ### headers, only ## headers
      currentAdr.content = contentLines.join('\n').trim();
      adrs.push(currentAdr);
      currentAdr = null;
      contentLines = [];
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

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  const result = {
    extracted: 0,
    skipped: 0,
    updated: 0,
    errors: [],
  };

  console.log('📋 ADR Extraction Script');
  console.log('========================\n');

  if (!fs.existsSync(ADR_INDEX_PATH)) {
    console.error(`❌ Index file not found: ${ADR_INDEX_PATH}`);
    return result;
  }

  const indexContent = fs.readFileSync(ADR_INDEX_PATH, 'utf-8');
  console.log(`📖 Reading from: ${ADR_INDEX_PATH}`);
  console.log(`📁 Output folder: ${ADRS_FOLDER}\n`);

  if (!fs.existsSync(ADRS_FOLDER)) {
    fs.mkdirSync(ADRS_FOLDER, { recursive: true });
  }

  const adrs = extractAdrs(indexContent);
  console.log(`🔍 Found ${adrs.length} ADRs to process\n`);

  for (const adr of adrs) {
    try {
      const filename = generateFilename(adr.id, adr.title);
      const filepath = path.join(ADRS_FOLDER, filename);
      const content = formatAdrFile(adr);

      if (fs.existsSync(filepath)) {
        const existingContent = fs.readFileSync(filepath, 'utf-8');
        if (existingContent.length < content.length) {
          fs.writeFileSync(filepath, content, 'utf-8');
          console.log(`🔄 Updated: ${filename} (+${content.length - existingContent.length} chars)`);
          result.updated++;
        } else {
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

  console.log('\n========================');
  console.log('📊 Summary:');
  console.log(`   ✅ Extracted: ${result.extracted}`);
  console.log(`   🔄 Updated: ${result.updated}`);
  console.log(`   ⏭️  Skipped: ${result.skipped}`);
  console.log(`   ❌ Errors: ${result.errors.length}`);

  return result;
}

main().catch(console.error);
