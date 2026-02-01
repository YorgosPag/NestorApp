/**
 * Fix ADR Categories Script
 *
 * Updates the category field in ADR files based on the ADR ID ranges.
 *
 * Usage: node docs/centralized-systems/reference/scripts/fix-categories.cjs
 *
 * @author Γιώργος Παγώνης + Claude Code (Anthropic AI)
 * @date 2026-02-01
 */

const fs = require('fs');
const path = require('path');

const ADRS_FOLDER = path.join(__dirname, '..', 'adrs');

// Category mapping based on ADR ID ranges and specific ADRs
// This is based on the COMPLETE ADR TABLE from adr-index.md
const ADR_CATEGORIES = {
  // UI Components
  'ADR-001': 'UI Components',
  'ADR-003': 'UI Components',
  'ADR-013': 'UI Components',
  'ADR-014': 'UI Components',
  'ADR-015': 'UI Components',
  'ADR-016': 'UI Components',
  'ADR-023': 'UI Components',
  'ADR-037': 'UI Components',
  'ADR-050': 'UI Components',
  'ADR-128': 'UI Components',
  'ADR-135': 'UI Components',
  'ADR-144': 'UI Components',

  // Design System
  'ADR-002': 'Design System',
  'ADR-004': 'Design System',
  'ADR-011': 'Design System',
  'ADR-042': 'Design System',
  'ADR-091': 'Design System',
  'ADR-107': 'Design System',
  'ADR-133': 'Design System',
  'ADR-141': 'Design System',
  'ADR-155': 'Design System',
  'ADR-UI-001': 'Design System',

  // Canvas & Rendering
  'ADR-006': 'Canvas & Rendering',
  'ADR-008': 'Canvas & Rendering',
  'ADR-009': 'Canvas & Rendering',
  'ADR-029': 'Canvas & Rendering',
  'ADR-043': 'Canvas & Rendering',
  'ADR-044': 'Canvas & Rendering',
  'ADR-045': 'Canvas & Rendering',
  'ADR-046': 'Canvas & Rendering',
  'ADR-058': 'Canvas & Rendering',
  'ADR-064': 'Canvas & Rendering',
  'ADR-083': 'Canvas & Rendering',
  'ADR-084': 'Canvas & Rendering',
  'ADR-086': 'Canvas & Rendering',
  'ADR-088': 'Canvas & Rendering',
  'ADR-093': 'Canvas & Rendering',
  'ADR-094': 'Canvas & Rendering',
  'ADR-095': 'Canvas & Rendering',
  'ADR-102': 'Canvas & Rendering',
  'ADR-105': 'Canvas & Rendering',
  'ADR-110': 'Canvas & Rendering',
  'ADR-111': 'Canvas & Rendering',
  'ADR-112': 'Canvas & Rendering',
  'ADR-115': 'Canvas & Rendering',
  'ADR-117': 'Canvas & Rendering',
  'ADR-118': 'Canvas & Rendering',
  'ADR-120': 'Canvas & Rendering',
  'ADR-122': 'Canvas & Rendering',
  'ADR-123': 'Canvas & Rendering',
  'ADR-124': 'Canvas & Rendering',
  'ADR-127': 'Canvas & Rendering',
  'ADR-136': 'Canvas & Rendering',
  'ADR-137': 'Canvas & Rendering',
  'ADR-138': 'Canvas & Rendering',
  'ADR-139': 'Canvas & Rendering',
  'ADR-140': 'Canvas & Rendering',
  'ADR-142': 'Canvas & Rendering',
  'ADR-143': 'Canvas & Rendering',
  'ADR-146': 'Canvas & Rendering',
  'ADR-147': 'Canvas & Rendering',
  'ADR-148': 'Canvas & Rendering',
  'ADR-150': 'Canvas & Rendering',
  'ADR-151': 'Canvas & Rendering',
  'ADR-152': 'Canvas & Rendering',
  'ADR-153': 'Canvas & Rendering',
  'ADR-154': 'Canvas & Rendering',
  'ADR-158': 'Canvas & Rendering',
  'ADR-163': 'Canvas & Rendering',

  // Data & State
  'ADR-010': 'Data & State',
  'ADR-031': 'Data & State',
  'ADR-034': 'Data & State',
  'ADR-065': 'Data & State',
  'ADR-066': 'Data & State',
  'ADR-067': 'Data & State',
  'ADR-068': 'Data & State',
  'ADR-069': 'Data & State',
  'ADR-070': 'Data & State',
  'ADR-071': 'Data & State',
  'ADR-072': 'Data & State',
  'ADR-073': 'Data & State',
  'ADR-074': 'Data & State',
  'ADR-076': 'Data & State',
  'ADR-077': 'Data & State',
  'ADR-078': 'Data & State',
  'ADR-079': 'Data & State',
  'ADR-080': 'Data & State',
  'ADR-081': 'Data & State',
  'ADR-082': 'Data & State',
  'ADR-087': 'Data & State',
  'ADR-089': 'Data & State',
  'ADR-090': 'Data & State',
  'ADR-100': 'Data & State',
  'ADR-101': 'Data & State',
  'ADR-103': 'Data & State',
  'ADR-108': 'Data & State',
  'ADR-114': 'Data & State',
  'ADR-121': 'Data & State',
  'ADR-125': 'Data & State',
  'ADR-131': 'Data & State',
  'ADR-132': 'Data & State',
  'ADR-134': 'Data & State',
  'ADR-145': 'Data & State',
  'ADR-149': 'Data & State',
  'ADR-156': 'Data & State',
  'ADR-157': 'Data & State',
  'ADR-161': 'Data & State',
  'ADR-162': 'Data & State',
  'ADR-164': 'Data & State',

  // Drawing System
  'ADR-005': 'Drawing System',
  'ADR-032': 'Drawing System',
  'ADR-033': 'Drawing System',
  'ADR-040': 'Drawing System',
  'ADR-041': 'Drawing System',
  'ADR-047': 'Drawing System',
  'ADR-048': 'Drawing System',
  'ADR-049': 'Drawing System',
  'ADR-053': 'Drawing System',
  'ADR-056': 'Drawing System',
  'ADR-057': 'Drawing System',
  'ADR-075': 'Drawing System',
  'ADR-085': 'Drawing System',
  'ADR-099': 'Drawing System',
  'ADR-106': 'Drawing System',
  'ADR-159': 'Drawing System',
  'ADR-160': 'Drawing System',

  // Security & Auth
  'ADR-020': 'Security & Auth',
  'ADR-020-1': 'Security & Auth',
  'ADR-024': 'Security & Auth',
  'ADR-062': 'Security & Auth',
  'ADR-063': 'Security & Auth',

  // Backend Systems
  'ADR-059': 'Backend Systems',
  'ADR-060': 'Backend Systems',

  // Infrastructure
  'ADR-061': 'Infrastructure',
  'ADR-092': 'Infrastructure',

  // Performance
  'ADR-019': 'Performance',
  'ADR-030': 'Performance',
  'ADR-036': 'Performance',
  'ADR-113': 'Performance',
  'ADR-119': 'Performance',

  // Filters & Search
  'ADR-029-SEARCH': 'Filters & Search',
  'ADR-051': 'Filters & Search',

  // Tools & Keyboard
  'ADR-026': 'Tools & Keyboard',
  'ADR-027': 'Tools & Keyboard',
  'ADR-028': 'Tools & Keyboard',
  'ADR-035': 'Tools & Keyboard',
  'ADR-038': 'Tools & Keyboard',
  'ADR-055': 'Tools & Keyboard',
  'ADR-096': 'Tools & Keyboard',
  'ADR-098': 'Tools & Keyboard',

  // Entity Systems
  'ADR-012': 'Entity Systems',
  'ADR-017': 'Entity Systems',
  'ADR-018': 'Entity Systems',
  'ADR-018-1': 'Entity Systems',
  'ADR-025': 'Entity Systems',
  'ADR-052': 'Entity Systems',
  'ADR-054': 'Entity Systems',
  'ADR-104': 'Entity Systems',
  'ADR-126': 'Entity Systems',
  'ADR-129': 'Entity Systems',
  'ADR-130': 'Entity Systems',
};

async function main() {
  console.log('📋 Fix ADR Categories Script');
  console.log('============================\n');

  const files = fs.readdirSync(ADRS_FOLDER).filter(f => f.endsWith('.md') && !f.startsWith('_'));

  let updated = 0;
  let skipped = 0;

  for (const file of files) {
    const filepath = path.join(ADRS_FOLDER, file);
    let content = fs.readFileSync(filepath, 'utf-8');

    // Extract ADR ID from filename (e.g., ADR-001 from ADR-001-select-dropdown.md)
    const idMatch = file.match(/^(ADR-[\d]+(?:-\d+)?)/i);
    if (!idMatch) {
      // Try UI-001 format
      const uiMatch = file.match(/^(ADR-UI-[\d]+)/i);
      if (!uiMatch) {
        console.log(`⏭️  Skipping (no ID): ${file}`);
        skipped++;
        continue;
      }
      var adrId = uiMatch[1].toUpperCase();
    } else {
      var adrId = idMatch[1].toUpperCase();
    }
    const category = ADR_CATEGORIES[adrId];

    if (!category) {
      console.log(`⏭️  Skipping (no category mapping): ${file} (${adrId})`);
      skipped++;
      continue;
    }

    // Check if category needs updating
    if (content.includes(`| **Category** | ${category} |`)) {
      skipped++;
      continue;
    }

    // Update category in the metadata table
    const updated_content = content.replace(
      /\| \*\*Category\*\* \| [^|]+ \|/,
      `| **Category** | ${category} |`
    );

    if (updated_content !== content) {
      fs.writeFileSync(filepath, updated_content, 'utf-8');
      console.log(`✅ Updated: ${file} → ${category}`);
      updated++;
    } else {
      skipped++;
    }
  }

  console.log('\n============================');
  console.log('📊 Summary:');
  console.log(`   ✅ Updated: ${updated}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
}

main().catch(console.error);
