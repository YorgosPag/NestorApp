/**
 * ADR Index Generator Script
 *
 * Generates a clean adr-index.md from individual ADR files in the adrs/ folder.
 * This is the Single Source of Truth (SSOT) - the index is GENERATED, not maintained manually.
 *
 * Usage: npx ts-node docs/centralized-systems/reference/scripts/generate-adr-index.ts
 *
 * @author Γιώργος Παγώνης + Claude Code (Anthropic AI)
 * @date 2026-02-01
 */

import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// CONFIGURATION
// =============================================================================

const ADRS_FOLDER = path.join(__dirname, '..', 'adrs');
const OUTPUT_PATH = path.join(__dirname, '..', 'adr-index.md');

// Category order for display
const CATEGORY_ORDER = [
  'UI Components',
  'Design System',
  'Canvas & Rendering',
  'Data & State',
  'Drawing System',
  'Security & Auth',
  'Backend Systems',
  'Infrastructure',
  'Performance',
  'Tools & Keyboard',
  'Entity Systems',
  'Filters & Search',
];

// Category icons
const CATEGORY_ICONS: Record<string, string> = {
  'UI Components': '🎨',
  'Design System': '🎨',
  'Canvas & Rendering': '🖼️',
  'Data & State': '📊',
  'Drawing System': '✏️',
  'Security & Auth': '🔒',
  'Backend Systems': '🔧',
  'Infrastructure': '🛠️',
  'Performance': '⚡',
  'Tools & Keyboard': '🔧',
  'Entity Systems': '📂',
  'Filters & Search': '🔍',
};

// =============================================================================
// TYPES
// =============================================================================

interface ADRMetadata {
  id: string;
  title: string;
  status: string;
  date: string;
  category: string;
  canonical?: string;
  filename: string;
}

// =============================================================================
// PARSING FUNCTIONS
// =============================================================================

/**
 * Parse metadata from ADR file content
 */
function parseAdrFile(content: string, filename: string): ADRMetadata | null {
  // Extract title from first heading
  const titleMatch = content.match(/^#\s*(ADR-[\w.-]+):\s*(.+)$/m);
  if (!titleMatch) {
    console.warn(`⚠️ Could not parse title from ${filename}`);
    return null;
  }

  const id = titleMatch[1];
  const title = titleMatch[2].trim();

  // Extract metadata table
  const statusMatch = content.match(/\|\s*\*\*Status\*\*\s*\|\s*([^|]+)\|/);
  const dateMatch = content.match(/\|\s*\*\*Date\*\*\s*\|\s*([^|]+)\|/);
  const categoryMatch = content.match(/\|\s*\*\*Category\*\*\s*\|\s*([^|]+)\|/);
  const canonicalMatch = content.match(/\|\s*\*\*Canonical Location\*\*\s*\|\s*`([^`]+)`\s*\|/);

  return {
    id,
    title,
    status: statusMatch ? statusMatch[1].trim() : 'APPROVED',
    date: dateMatch ? dateMatch[1].trim() : '2026-01-01',
    category: categoryMatch ? categoryMatch[1].trim() : 'Uncategorized',
    canonical: canonicalMatch ? canonicalMatch[1] : undefined,
    filename,
  };
}

/**
 * Get status emoji
 */
function getStatusEmoji(status: string): string {
  const normalizedStatus = status.toUpperCase();
  if (normalizedStatus.includes('IMPLEMENTED')) return '✅';
  if (normalizedStatus.includes('APPROVED')) return '✅';
  if (normalizedStatus.includes('COMPLETED')) return '✅';
  if (normalizedStatus.includes('PLANNING')) return '📋';
  if (normalizedStatus.includes('DEPRECATED')) return '⚠️';
  return '✅';
}

/**
 * Sort ADRs by ID (numeric order)
 */
function sortAdrs(adrs: ADRMetadata[]): ADRMetadata[] {
  return adrs.sort((a, b) => {
    // Extract numeric part for sorting
    const aNum = parseInt(a.id.replace(/ADR-/i, '').replace(/[^\d]/g, '') || '0', 10);
    const bNum = parseInt(b.id.replace(/ADR-/i, '').replace(/[^\d]/g, '') || '0', 10);

    // Handle special cases like ADR-UI-001
    if (a.id.includes('UI-') && !b.id.includes('UI-')) return 1;
    if (!a.id.includes('UI-') && b.id.includes('UI-')) return -1;

    return aNum - bNum;
  });
}

// =============================================================================
// INDEX GENERATION
// =============================================================================

/**
 * Generate the clean index content
 */
function generateIndex(adrs: ADRMetadata[]): string {
  const sortedAdrs = sortAdrs(adrs);
  const today = new Date().toISOString().split('T')[0];

  // Group by category
  const byCategory = new Map<string, ADRMetadata[]>();
  for (const adr of sortedAdrs) {
    const existing = byCategory.get(adr.category) || [];
    existing.push(adr);
    byCategory.set(adr.category, existing);
  }

  // Build the index content
  let content = `# 📋 **ARCHITECTURAL DECISION RECORDS (ADRs) INDEX**

> **Complete Enterprise ADR Registry**
>
> Single source of truth για όλες τις αρχιτεκτονικές αποφάσεις της εφαρμογής
>
> ⚠️ **AUTO-GENERATED FILE** - Do not edit manually!
> Run \`npx ts-node docs/centralized-systems/reference/scripts/generate-adr-index.ts\` to regenerate.

**📊 Stats**: ${adrs.length} ADRs | Last Updated: ${today}

---

## 🎯 **QUICK NAVIGATION**

| Category | Count | Quick Jump |
|----------|-------|------------|
`;

  // Quick navigation table
  for (const category of CATEGORY_ORDER) {
    const categoryAdrs = byCategory.get(category) || [];
    if (categoryAdrs.length > 0) {
      const icon = CATEGORY_ICONS[category] || '📄';
      const anchor = category.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      content += `| ${icon} **${category}** | ${categoryAdrs.length} | [View](#${anchor}) |\n`;
    }
  }

  // Handle uncategorized
  const uncategorized = byCategory.get('Uncategorized') || [];
  if (uncategorized.length > 0) {
    content += `| 📄 **Uncategorized** | ${uncategorized.length} | [View](#uncategorized) |\n`;
  }

  content += `
---

## 📊 **COMPLETE ADR TABLE**

| ADR | Decision | Status | Date | Category | Link |
|-----|----------|--------|------|----------|------|
`;

  // Complete table
  for (const adr of sortedAdrs) {
    const statusEmoji = getStatusEmoji(adr.status);
    const link = `[📄](./adrs/${adr.filename})`;
    content += `| **${adr.id}** | ${adr.title} | ${statusEmoji} ${adr.status} | ${adr.date} | ${adr.category} | ${link} |\n`;
  }

  content += `
---

`;

  // Category sections
  for (const category of [...CATEGORY_ORDER, 'Uncategorized']) {
    const categoryAdrs = byCategory.get(category);
    if (!categoryAdrs || categoryAdrs.length === 0) continue;

    const icon = CATEGORY_ICONS[category] || '📄';
    const anchor = category.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    content += `## ${icon} **${category.toUpperCase()}**

| ADR | Decision | Status | Link |
|-----|----------|--------|------|
`;

    for (const adr of categoryAdrs) {
      const statusEmoji = getStatusEmoji(adr.status);
      const link = `[View](./adrs/${adr.filename})`;
      content += `| **${adr.id}** | ${adr.title} | ${statusEmoji} ${adr.status} | ${link} |\n`;
    }

    content += `
---

`;
  }

  // Footer
  content += `## 📝 **ADDING NEW ADRs**

1. Create a new file in \`adrs/\` using the template: \`adrs/_template.md\`
2. Follow the naming convention: \`ADR-NNN-short-description.md\`
3. Run the generator script to update this index:
   \`\`\`bash
   npx ts-node docs/centralized-systems/reference/scripts/generate-adr-index.ts
   \`\`\`

---

*Auto-generated by generate-adr-index.ts*
*Based on: Michael Nygard's Architecture Decision Records*
*Enterprise standards inspired by: Autodesk, Adobe, Bentley Systems, SAP, Google*
`;

  return content;
}

// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
  console.log('📋 ADR Index Generator');
  console.log('======================\n');

  // Check if adrs folder exists
  if (!fs.existsSync(ADRS_FOLDER)) {
    console.error(`❌ ADRS folder not found: ${ADRS_FOLDER}`);
    process.exit(1);
  }

  // Read all ADR files
  const files = fs.readdirSync(ADRS_FOLDER).filter(f => f.endsWith('.md') && !f.startsWith('_'));
  console.log(`📁 Found ${files.length} ADR files in ${ADRS_FOLDER}\n`);

  const adrs: ADRMetadata[] = [];
  const errors: string[] = [];

  for (const file of files) {
    const filepath = path.join(ADRS_FOLDER, file);
    try {
      const content = fs.readFileSync(filepath, 'utf-8');
      const metadata = parseAdrFile(content, file);
      if (metadata) {
        adrs.push(metadata);
        console.log(`✅ Parsed: ${metadata.id} - ${metadata.title.substring(0, 40)}...`);
      } else {
        errors.push(`Could not parse: ${file}`);
      }
    } catch (error) {
      errors.push(`Error reading ${file}: ${error}`);
    }
  }

  console.log(`\n📊 Parsed ${adrs.length} ADRs successfully`);

  if (errors.length > 0) {
    console.log('\n⚠️ Warnings:');
    errors.forEach(e => console.log(`   - ${e}`));
  }

  // Generate index
  console.log('\n📝 Generating index...');
  const indexContent = generateIndex(adrs);

  // Write index
  fs.writeFileSync(OUTPUT_PATH, indexContent, 'utf-8');
  console.log(`✅ Index written to: ${OUTPUT_PATH}`);

  // Stats
  const stats = fs.statSync(OUTPUT_PATH);
  console.log(`📊 Index size: ${(stats.size / 1024).toFixed(1)} KB`);
  console.log(`📊 Line count: ~${indexContent.split('\n').length} lines`);
}

main().catch(console.error);
