/**
 * ADR Index Generator Script (CommonJS)
 *
 * Generates a clean adr-index.md from individual ADR files in the adrs/ folder.
 * This is the Single Source of Truth (SSOT) - the index is GENERATED, not maintained manually.
 *
 * Usage: node docs/centralized-systems/reference/scripts/generate-adr-index.cjs
 *
 * @author Γιώργος Παγώνης + Claude Code (Anthropic AI)
 * @date 2026-02-01
 */

const fs = require('fs');
const path = require('path');

// =============================================================================
// CONFIGURATION
// =============================================================================

const ADRS_FOLDER = path.join(__dirname, '..', 'adrs');
const OUTPUT_PATH = path.join(__dirname, '..', 'adr-index.md');

// Category order for display
const CATEGORY_ORDER = [
  'Domain - Geometry',  // Domain ADRs first
  'UI Components',
  'Design System',
  'Canvas & Rendering',
  'Data & State',
  'Drawing System',
  'Entity Systems',
  'Tools & Keyboard',
  'Filters & Search',
  'Security & Auth',
  'Backend Systems',
  'Infrastructure',
  'Performance',
];

// Category icons
const CATEGORY_ICONS = {
  'Domain - Geometry': '📐',  // Domain ADRs
  'UI Components': '🎨',
  'Design System': '🎨',
  'Canvas & Rendering': '🖼️',
  'Data & State': '📊',
  'Drawing System': '✏️',
  'Entity Systems': '📂',
  'Tools & Keyboard': '🔧',
  'Filters & Search': '🔍',
  'Security & Auth': '🔒',
  'Backend Systems': '🔧',
  'Infrastructure': '🛠️',
  'Performance': '⚡',
};

// =============================================================================
// PARSING FUNCTIONS
// =============================================================================

/**
 * Parse metadata from ADR file content
 */
function parseAdrFile(content, filename) {
  // Strip UTF-8 BOM if present, normalize line endings
  content = content.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Extract title from first heading — supports both "ADR-NNN: Title" and "ADR-NNN — Title"
  const titleMatch = content.match(/^#\s*(ADR-[\w.-]+)\s*[:—]\s*(.+)$/m);
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
function getStatusEmoji(status) {
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
function sortAdrs(adrs) {
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
function generateIndex(adrs) {
  const sortedAdrs = sortAdrs(adrs);
  const today = new Date().toISOString().split('T')[0];

  // Group by category
  const byCategory = new Map();
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
> Run \`node docs/centralized-systems/reference/scripts/generate-adr-index.cjs\` to regenerate.

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

### 🔢 ΔΙΑΘΕΣΙΜΑ IDs (χρησιμοποίησε αυτά ΠΡΩΤΑ):

\`\`\`
034, 065, 066, 067, 068, 070, 071, 072, 073, 074,
077, 078, 079, 080, 089, 090, 100, 103, 121, 131,
132, 134, 145, 156, 161, 164
\`\`\`

> **⚠️ ΣΗΜΑΝΤΙΚΟ**: Αυτά τα IDs ενοποιήθηκαν στο ADR-GEOMETRY. Χρησιμοποίησέ τα για νέα ADRs πριν συνεχίσεις από το 167+.

### 📋 Οδηγίες:

1. **Επέλεξε ID** από τη λίστα παραπάνω (ή 167+ αν τελείωσαν)
2. Create a new file in \`adrs/\` using the template: \`adrs/_template.md\`
3. Follow the naming convention: \`ADR-NNN-short-description.md\`
4. Run the generator script to update this index:
   \`\`\`bash
   node docs/centralized-systems/reference/scripts/generate-adr-index.cjs
   \`\`\`

---

## 🚫 **GLOBAL PROHIBITIONS**

Based on these ADRs, the following are **PROHIBITED**:

- ❌ \`as any\` - Use proper TypeScript types (ADR-CLAUDE)
- ❌ \`@ts-ignore\` - Fix the actual type issues (ADR-CLAUDE)
- ❌ Hardcoded z-index values - Use design tokens (ADR-002)
- ❌ Direct Tailwind border/shadow classes - Use semantic tokens (ADR-UI-001)
- ❌ Duplicate grip rendering - Use UnifiedGripRenderer (ADR-048)
- ❌ Debug endpoints in production (ADR-062)
- ❌ Inline styles - Use centralized design system

---

*Auto-generated by generate-adr-index.cjs*
*Based on: Michael Nygard's Architecture Decision Records*
*Enterprise standards inspired by: Autodesk, Adobe, Bentley Systems, SAP, Google*
`;

  return content;
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log('📋 ADR Index Generator');
  console.log('======================\n');

  // Check if adrs folder exists
  if (!fs.existsSync(ADRS_FOLDER)) {
    console.error(`❌ ADRS folder not found: ${ADRS_FOLDER}`);
    process.exit(1);
  }

  // Read all ADR files (exclude archived folder and templates)
  const files = fs.readdirSync(ADRS_FOLDER).filter(f => {
    // Exclude directories (like 'archived')
    const fullPath = path.join(ADRS_FOLDER, f);
    if (fs.statSync(fullPath).isDirectory()) return false;
    // Only include .md files that don't start with _
    return f.endsWith('.md') && !f.startsWith('_');
  });
  console.log(`📁 Found ${files.length} ADR files in ${ADRS_FOLDER}\n`);

  const adrs = [];
  const errors = [];

  for (const file of files) {
    const filepath = path.join(ADRS_FOLDER, file);
    try {
      const content = fs.readFileSync(filepath, 'utf-8');
      const metadata = parseAdrFile(content, file);
      if (metadata) {
        adrs.push(metadata);
      } else {
        errors.push(`Could not parse: ${file}`);
      }
    } catch (error) {
      errors.push(`Error reading ${file}: ${error}`);
    }
  }

  console.log(`📊 Parsed ${adrs.length} ADRs successfully`);

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
